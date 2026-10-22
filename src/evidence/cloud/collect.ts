import { sourceReadTime } from '../connect/pages'
import type { Bindings } from '../../auth.server'
import { upsertResources, type ResourceSchema } from '../resources'
import { runForType } from '../tests/engine'
import { unseal } from '../connect/custody'
import { backoffUpdate, reconnectUpdate, startRun } from '../connect/runs'
import type { Connection } from '../connect/storage'
import { assumeRole, awsClient, AwsFailure, callerIdentity, organizationAccounts, readDatabases, readEbsDefault, readGuardDuty, readIam, readS3, readSecurityGroups, readTrailLogging, type Client } from './aws'
import { awsConfig } from './connect'
// CLOUD-001 collection for one AWS connection. Organization member accounts
// are discovered and stay in the denominator: an account Evidence cannot read
// is recorded unreadable, and its tests are unknown, never passing. Each
// evidence class is read separately, so one denied class is a visible gap.
export const awsRevision = 'aws-2'
const types: Record<string, ResourceSchema> = {
 'aws.account': { fields: { readable: 'boolean', root_mfa_enabled: 'boolean', password_min_length: 'number', s3_account_public_access_blocked: 'boolean', member: 'boolean' }, required: [] },
 'aws.iam_user': { fields: { console_access: 'boolean', mfa_enabled: 'boolean', console_mfa_ok: 'boolean', active_key_age_days: 'number' }, required: [] },
 'aws.s3_bucket': { fields: { region: 'string', public_access_blocked: 'boolean', default_encryption: 'boolean', policy_public: 'boolean' }, required: [] },
 'aws.region': { fields: { cloudtrail_logging: 'boolean', guardduty_enabled: 'boolean', ebs_encryption_by_default: 'boolean' }, required: [] },
 'aws.security_group': { fields: { name: 'string', open_admin_ports: 'boolean' }, required: [] },
 'aws.rds_instance': { fields: { storage_encrypted: 'boolean', backup_retention_days: 'number', publicly_accessible: 'boolean' }, required: [] },
}
type Item = { uniqueId: string; displayName: string; attributes: Record<string, unknown> }
export async function runAwsCollection(env: Bindings, connection: Connection, trigger: 'schedule' | 'manual', now: Date) {
 const started = await startRun(env, connection, awsRevision, trigger, now)
 if (!started) return { run: null, outcome: 'already running' }
 const { finish } = started, at = now.toISOString(), config = awsConfig(connection)
 if (connection.status !== 'active' || !connection.secret_ciphertext || !connection.secret_iv) return finish('failed', {}, 'connection is ' + connection.status)
 let keys: { accessKeyId: string; secretAccessKey: string }
 try { keys = JSON.parse(await unseal(env, connection.secret_ciphertext, connection.secret_iv, connection.id)) }
 catch { return finish('failed', {}, 'credential unreadable under this installation key', reconnectUpdate(env, connection, 'Stored credential cannot be decrypted; reconnect.', now)) }
 const lostAccounts = new Set<string>()
 const clock = () => now, out = new Map<string, Item[]>(Object.keys(types).map(t => [t, []])), unread = new Map<string, string[]>(Object.keys(types).map(t => [t, []]))
 const coverage: { accounts: { id: string; name: string; read: boolean; reason: string }[]; regions: string[]; gaps: { account: string; class: string; region: string; reason: string }[] } = { accounts: [], regions: config.regions, gaps: [] }
 const push = (type: string, item: Item) => out.get(type)!.push(item)
 // One evidence class: a denied, missing or unreachable read becomes a gap for its resource types.
 const attempt = async <T>(account: string, kind: string, region: string, typesRead: string[], read: () => Promise<T>): Promise<T | null> => {
  try { return await read() } catch (error) {
   if (!(error instanceof AwsFailure) || error.kind === 'unauthorized' || error.kind === 'throttled') throw error
   coverage.gaps.push({ account, class: kind, region, reason: error.message }); for (const t of typesRead) unread.get(t)!.push(account); return null
  }
 }
 try {
  let primary: Client = awsClient(keys, clock, connection.account)
  if (config.role_arn) primary = awsClient(await assumeRole(primary, config.role_arn, config.external_id, 'evidence-collector'), clock, connection.account)
  const identity = await callerIdentity(primary)
  if (identity.account !== connection.account) return finish('failed', {}, 'account binding changed', reconnectUpdate(env, connection, `These credentials now reach account ${identity.account}, not ${connection.account}; reconnect deliberately.`, now))
  const members = await organizationAccounts(primary)
  if (members && members.filter(a => a.status === 'ACTIVE').length > 50) throw new AwsFailure('unavailable','coverage','AWS account coverage incomplete: more than 50 active accounts')
  const accounts = [{ id: connection.account, name: members?.find(a => a.id === connection.account)?.name ?? 'this account', status: 'ACTIVE' }, ...(members ?? []).filter(a => a.id !== connection.account && a.status === 'ACTIVE')].slice(0, 50)
  // INVENTORY-001: lost organization-list permission must not remove known
  // member accounts or their assets from any test population.
  const knownAccounts = (await env.DB.prepare("SELECT unique_id,display_name FROM resources WHERE type='aws.account' AND source_ref=? AND removed_at IS NULL").bind('aws:' + connection.id).all<{unique_id:string;display_name:string}>()).results
  for (const known of knownAccounts) if (!accounts.some(a => a.id === known.unique_id)) {
   lostAccounts.add(known.unique_id)
   const reason = 'Previously known account is absent from the readable organization list'
   coverage.accounts.push({id:known.unique_id,name:known.display_name,read:false,reason})
   coverage.gaps.push({account:known.unique_id,class:'Organizations',region:'global',reason})
   push('aws.account',{uniqueId:known.unique_id,displayName:known.display_name,attributes:{readable:false,member:known.unique_id!==connection.account}})
   for (const type of Object.keys(types)) if (type!=='aws.account') unread.get(type)!.push(known.unique_id)
  }
  for (const account of accounts) {
   const member = account.id !== connection.account
   let client: Client | null = member ? null : primary, reason = ''
   if (member && config.member_role) {
    try { client = awsClient(await assumeRole(primary, `arn:aws:iam::${account.id}:role/${config.member_role}`, config.external_id, 'evidence-collector'), clock, account.id) }
    catch (error) { if (!(error instanceof AwsFailure) || error.kind === 'throttled') throw error; reason = `cannot assume ${config.member_role}: ${error.message}` }
   } else if (member) reason = 'no member-account read role is configured'
   coverage.accounts.push({ id: account.id, name: account.name, read: !!client, reason })
   // An unreadable account keeps its account and per-region records, all unknown.
   if (!client) {
    push('aws.account', { uniqueId: account.id, displayName: `${account.name} (${account.id})`, attributes: { readable: false, root_mfa_enabled: null, password_min_length: null, s3_account_public_access_blocked: null, member } })
    for (const region of config.regions) push('aws.region', { uniqueId: `${account.id}/${region}`, displayName: `${account.id} ${region}`, attributes: { cloudtrail_logging: null, guardduty_enabled: null, ebs_encryption_by_default: null } })
    for (const t of ['aws.iam_user', 'aws.s3_bucket', 'aws.security_group', 'aws.rds_instance']) unread.get(t)!.push(account.id)
    continue
   }
   const c = client
   const iam = await attempt(account.id, 'IAM', 'global', ['aws.account', 'aws.iam_user'], () => readIam(c, now))
   if (iam && !iam.users) { coverage.gaps.push({ account: account.id, class: 'IAM credential report', region: 'global', reason: 'credential report not ready; users are read on the next run' }); unread.get('aws.iam_user')!.push(account.id) }
   for (const u of iam?.users ?? []) push('aws.iam_user', { uniqueId: `${account.id}/${u.name}`, displayName: `${u.name} (${account.id})`, attributes: { console_access: u.console, mfa_enabled: u.mfa, console_mfa_ok: !u.console || u.mfa, active_key_age_days: u.keyAgeDays } })
   const s3 = await attempt(account.id, 'S3', 'global', ['aws.s3_bucket'], () => readS3(c, account.id))
   if (s3 && !s3.complete) unread.get('aws.s3_bucket')!.push(account.id)
   for (const b of s3?.buckets ?? []) push('aws.s3_bucket', { uniqueId: `${account.id}/${b.name}`, displayName: `${b.name} (${account.id})`, attributes: { region: b.region, ...b.attributes } })
   push('aws.account', { uniqueId: account.id, displayName: `${account.name} (${account.id})`, attributes: { readable: true, root_mfa_enabled: iam?.rootMfa ?? null, password_min_length: iam?.minLength ?? null, s3_account_public_access_blocked: s3 ? s3.accountBlock : null, member } })
   const trails = new Map<string, boolean>()
   for (const region of config.regions) {
    const logging = await attempt(account.id, 'CloudTrail', region, [], () => readTrailLogging(c, region, trails))
    const ebs = await attempt(account.id, 'EBS default encryption', region, [], () => readEbsDefault(c, region))
    const guardduty = await attempt(account.id, 'GuardDuty', region, [], () => readGuardDuty(c, region))
    push('aws.region', { uniqueId: `${account.id}/${region}`, displayName: `${account.id} ${region}`, attributes: { cloudtrail_logging: logging, guardduty_enabled: guardduty, ebs_encryption_by_default: ebs } })
    const sg = await attempt(account.id, 'Security groups', region, ['aws.security_group'], () => readSecurityGroups(c, region))
    if (sg && !sg.complete) unread.get('aws.security_group')!.push(account.id)
    for (const g of sg?.groups ?? []) push('aws.security_group', { uniqueId: `${account.id}/${region}/${g.id}`, displayName: `${g.name} ${g.id} (${account.id} ${region})`, attributes: { name: g.name, open_admin_ports: g.open } })
    const rds = await attempt(account.id, 'RDS', region, ['aws.rds_instance'], () => readDatabases(c, region))
    if (rds && !rds.complete) unread.get('aws.rds_instance')!.push(account.id)
    for (const d of rds?.databases ?? []) push('aws.rds_instance', { uniqueId: `${account.id}/${region}/${d.id}`, displayName: `${d.id} (${account.id} ${region})`, attributes: { storage_encrypted: d.encrypted, backup_retention_days: d.backupDays, publicly_accessible: d.public } })
   }
  }
 } catch (error) {
  if (error instanceof AwsFailure && error.kind === 'throttled') return finish('throttled', coverage, 'AWS throttled the read', backoffUpdate(env, connection, now.getTime() + 60000, 'AWS', now))
  if (error instanceof AwsFailure && error.kind === 'unauthorized') return finish('failed', coverage, 'credential rejected by AWS', reconnectUpdate(env, connection, `AWS rejected the credential (${error.code}); reconnect with new keys.`, now))
  if (error instanceof AwsFailure) return finish('failed', coverage, error.message, env.DB.prepare('UPDATE connections SET last_attempt_at=?,last_error=? WHERE id=?').bind(at, `AWS read failed: ${error.message}`, connection.id))
  throw error
 }
 // Types read completely mark absent resources removed; a type with any gap removes nothing,
 // and its known resources in an unread account are rewritten as unread, so their tests are
 // unknown from this run on rather than carrying the last answer forward.
 const source = { kind: 'source-observed' as const, ref: 'aws:' + connection.id, label: `AWS ${connection.account} via ${connection.label}` }
 const placeholders = new Set([...lostAccounts].map(id => 'aws.account ' + id))
 for (const [type, gaps] of unread) for (const account of new Set(gaps)) {
  const known = (await env.DB.prepare("SELECT unique_id,display_name FROM resources WHERE type=? AND source_ref=? AND removed_at IS NULL AND substr(unique_id,1,13)=?").bind(type, source.ref, account + '/').all<{ unique_id: string; display_name: string }>()).results
  for (const r of known) if (!out.get(type)!.some(i => i.uniqueId === r.unique_id)) placeholders.add(type + ' ' + r.unique_id), push(type, { uniqueId: r.unique_id, displayName: r.display_name, attributes: Object.fromEntries(Object.keys(types[type].fields).map(f => [f, null])) })
 }
 const fresh: string[] = []
 for (const [type, schema] of Object.entries(types)) {
  const gaps = unread.get(type)!, items = out.get(type)!
  const written = await upsertResources(env, type, schema, items, source, gaps.length ? false : 'source', now)
  fresh.push(...written.results.filter(r => r.id && r.outcome !== 'removed' && r.outcome !== 'rejected' && !placeholders.has(type + ' ' + r.uniqueId)).map(r => r.id!))
 }
 if (fresh.length) await env.DB.prepare('UPDATE resources SET observed_at=? WHERE id IN (SELECT value FROM json_each(?))').bind(sourceReadTime(now), JSON.stringify(fresh)).run()
 const anyRead = coverage.accounts.some(a => a.read)
 const outcome = !anyRead ? 'failed' : coverage.gaps.length || coverage.accounts.some(a => !a.read) ? 'partial' : 'complete'
 const result = await finish(outcome, coverage, anyRead ? '' : 'no account readable', anyRead
  ? env.DB.prepare('UPDATE connections SET last_attempt_at=?,last_success_at=?,next_attempt_at=NULL,backoff_seconds=0,last_error=? WHERE id=?').bind(at, at, outcome === 'partial' ? `${coverage.accounts.filter(a => !a.read).length} accounts and ${coverage.gaps.length} classes unreadable` : '', connection.id)
  : env.DB.prepare('UPDATE connections SET last_attempt_at=?,last_error=? WHERE id=?').bind(at, 'No AWS account was readable.', connection.id))
 for (const type of Object.keys(types)) await runForType(env, type, now)
 return result
}
