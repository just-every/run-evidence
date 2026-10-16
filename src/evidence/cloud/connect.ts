import type { Bindings } from '../../auth.server'
import { Refusal } from '../upload'
import { auditStatement, text, type Actor, type Input } from '../door'
import { seal } from '../connect/custody'
import { catalogueStatements } from '../tests/storage'
import type { Connection } from '../connect/storage'
import { assumeRole, awsClient, AwsFailure, callerIdentity } from './aws'
// CLOUD-001 AWS connections: an IAM user's access key that can only assume a
// read-only role (SecurityAudit), or that holds SecurityAudit itself. The
// account is bound at connect time; a key that later reaches another account
// is refused. Member accounts are read through a named role in each account.
export interface AwsConfig { regions: string[]; role_arn: string; external_id: string; member_role: string }
export const awsPermissions = ['SecurityAudit managed policy (read-only) on the role or user', 'organizations:ListAccounts on the management account (to discover member accounts)', 'sts:AssumeRole on the member-account read role, when one is named']
export const awsConfig = (c: Pick<Connection, 'config_json'>): AwsConfig => { const v = (() => { try { return JSON.parse(c.config_json) } catch { return {} } })(); return { regions: v.regions ?? ['us-east-1'], role_arn: v.role_arn ?? '', external_id: v.external_id ?? '', member_role: v.member_role ?? '' } }
function parse(input: Input): AwsConfig & { accessKeyId: string; secretAccessKey: string } {
 const accessKeyId = text(input, 'access_key_id', 40), secretAccessKey = text(input, 'secret_access_key', 128)
 if (!/^(AKIA|ASIA)[A-Z0-9]{12,20}$/.test(accessKeyId) || !/^[A-Za-z0-9/+=]{30,60}$/.test(secretAccessKey)) throw new Refusal('Give an AWS access key ID and secret access key.')
 const regions = String(input.regions || 'us-east-1').split(/[\s,]+/).filter(Boolean)
 if (!regions.length || regions.length > 20 || regions.some(r => !/^[a-z]{2}(-gov)?-[a-z]+-\d$/.test(r))) throw new Refusal('List AWS regions like us-east-1, us-west-2.')
 const role_arn = text(input, 'role_arn', 200, true), external_id = text(input, 'external_id', 96, true), member_role = text(input, 'member_role', 64, true)
 if (role_arn && !/^arn:aws(-us-gov)?:iam::\d{12}:role\/[\w+=,.@/-]{1,128}$/.test(role_arn)) throw new Refusal('The role ARN must look like arn:aws:iam::123456789012:role/EvidenceReadOnly.')
 if (member_role && !/^[\w+=,.@-]{1,64}$/.test(member_role)) throw new Refusal('Name the member-account read role, for example EvidenceReadOnly.')
 return { accessKeyId, secretAccessKey, regions: [...new Set(regions)], role_arn, external_id, member_role }
}
// A real STS read binds the account before anything is kept.
async function verify(keys: { accessKeyId: string; secretAccessKey: string }, config: AwsConfig, now: Date) {
 try {
  let client = awsClient(keys, () => now)
  if (config.role_arn) client = awsClient(await assumeRole(client, config.role_arn, config.external_id, 'evidence-connect'), () => now)
  return await callerIdentity(client)
 } catch (error) {
  if (error instanceof AwsFailure) throw new Refusal(error.kind === 'unauthorized' ? 'AWS rejected these keys.' : error.kind === 'denied' ? `AWS refused the read (${error.code}); check the role trust policy and external ID.` : `AWS could not be read (${error.code}).`, error.kind === 'throttled' ? 429 : 400)
  throw error
 }
}
export async function connectAws(env: Bindings, actor: Actor, input: Input, now: Date) {
 const parsed = parse(input), config: AwsConfig = { regions: parsed.regions, role_arn: parsed.role_arn, external_id: parsed.external_id, member_role: parsed.member_role }
 const identity = await verify(parsed, config, now)
 if (await env.DB.prepare("SELECT 1 FROM connections WHERE provider='aws' AND account=? AND status!='revoked'").bind(identity.account).first()) throw new Refusal('This AWS account is already connected; rotate or revoke that connection.', 409)
 const id = crypto.randomUUID(), sealed = await seal(env, JSON.stringify({ accessKeyId: parsed.accessKeyId, secretAccessKey: parsed.secretAccessKey }), id)
 await env.DB.batch([
  env.DB.prepare("INSERT INTO connections(id,provider,label,account,api_base,secret_ciphertext,secret_iv,granted_scopes,status,created_by,created_name,created_at,config_json) VALUES(?,'aws',?,?,'https://sts.amazonaws.com',?,?,?,'active',?,?,?,?)").bind(id, text(input, 'label', 120, true) || 'AWS ' + identity.account, identity.account, sealed.ciphertext, sealed.iv, JSON.stringify([`Reads as ${identity.arn}`]), actor.id, actor.name, now.toISOString(), JSON.stringify(config)),
  auditStatement(env, actor, 'connection.authorized', 'connection:' + id, now, 'succeeded', `aws ${identity.account}`),
  ...await catalogueStatements(env, 'aws', actor, now),
 ])
 return { id, account: identity.account }
}
// Rotation keeps the bound account: new keys that reach a different account are refused.
export async function rotateAws(env: Bindings, actor: Actor, row: Connection, input: Input, now: Date) {
 const parsed = parse({ ...input, regions: awsConfig(row).regions.join(','), role_arn: awsConfig(row).role_arn, external_id: awsConfig(row).external_id, member_role: awsConfig(row).member_role }), identity = await verify(parsed, awsConfig(row), now)
 if (identity.account !== row.account) throw new Refusal(`These keys reach account ${identity.account}, not ${row.account}.`, 409)
 const sealed = await seal(env, JSON.stringify({ accessKeyId: parsed.accessKeyId, secretAccessKey: parsed.secretAccessKey }), row.id)
 await env.DB.batch([
  env.DB.prepare("UPDATE connections SET secret_ciphertext=?,secret_iv=?,status='active',rotated_at=?,revoked_at=NULL,last_error='',backoff_seconds=0,next_attempt_at=NULL WHERE id=?").bind(sealed.ciphertext, sealed.iv, now.toISOString(), row.id),
  auditStatement(env, actor, row.status === 'active' ? 'connection.rotated' : 'connection.reconnected', 'connection:' + row.id, now),
 ])
}
