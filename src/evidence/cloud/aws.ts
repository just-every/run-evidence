import { scopedFetch } from '../ops/execution'
import { sign, type Credentials } from './sigv4'
import { at, items, list, parseXml, textAt, type XmlNode, type XmlValue } from './xml'
// Read-only AWS calls for CLOUD-001. Every call is a Describe, List or Get;
// nothing here can change an AWS account. A denied class is reported as
// unreadable, never as passing.
export type AwsKind = 'denied' | 'unauthorized' | 'throttled' | 'unavailable' | 'missing'
export class AwsFailure extends Error { constructor(public kind: AwsKind, public code: string, message: string) { super(message) } }
const denied = /^(AccessDenied|AccessDeniedException|UnauthorizedOperation|UnauthorizedAccess|AuthorizationError|OptInRequired|SubscriptionRequiredException)$/
const unauthorized = /^(InvalidClientTokenId|SignatureDoesNotMatch|ExpiredToken|ExpiredTokenException|AuthFailure|InvalidAccessKeyId|UnrecognizedClientException|IncompleteSignature|InvalidToken)$/
const throttled = /^(Throttling|ThrottlingException|RequestLimitExceeded|TooManyRequestsException|SlowDown)$/
function classify(status: number, code: string, service: string): AwsFailure {
 const kind: AwsKind = unauthorized.test(code) ? 'unauthorized' : denied.test(code) || status === 403 ? 'denied' : throttled.test(code) || status === 429 ? 'throttled' : status === 404 || /^NoSuch|NotFound/.test(code) ? 'missing' : 'unavailable'
 return new AwsFailure(kind, code || String(status), `${service} answered ${code || status}`)
}
export function awsClient(credentials: Credentials, now: () => Date) {
 async function send(service: string, region: string, method: string, url: URL, body = '', headers: Record<string, string> = {}) {
  const signed = await sign({ method, url, headers, body, region, service, credentials, now: now() })
  let response: Response
  try { response = await scopedFetch(url, { method, headers: signed, body: method === 'GET' ? undefined : body, redirect: 'manual', signal: AbortSignal.timeout(20000) }) }
  catch { throw new AwsFailure('unavailable', 'transport', `${service} could not be reached`) }
  return { status: response.status, text: await response.text() }
 }
 // Query APIs (STS, IAM, EC2, RDS) answer XML; errors carry <Code>.
 async function query(service: string, region: string, host: string, params: Record<string, string>) {
  const reply = await send(service, region, 'POST', new URL(`https://${host}/`), new URLSearchParams(params).toString(), { 'content-type': 'application/x-www-form-urlencoded; charset=utf-8' })
  let doc: XmlNode
  try { doc = parseXml(reply.text) } catch { throw new AwsFailure('unavailable', 'malformed', `${service} answered unreadable XML`) }
  if (reply.status !== 200) throw classify(reply.status, textAt(doc, 'ErrorResponse', 'Error', 'Code') ?? textAt(doc, 'Response', 'Errors', 'Error', 'Code') ?? '', service)
  return doc
 }
 // JSON 1.1 APIs (Organizations, CloudTrail) use X-Amz-Target.
 async function json(service: string, region: string, host: string, target: string, body: unknown) {
  const reply = await send(service, region, 'POST', new URL(`https://${host}/`), JSON.stringify(body), { 'content-type': 'application/x-amz-json-1.1', 'x-amz-target': target })
  let parsed: Record<string, unknown> = {}
  try { parsed = reply.text ? JSON.parse(reply.text) : {} } catch { throw new AwsFailure('unavailable', 'malformed', `${service} answered unreadable JSON`) }
  if (reply.status !== 200) throw classify(reply.status, String(parsed.__type ?? '').split('#').pop() ?? '', service)
  return parsed
 }
 // REST APIs: S3 (XML) and GuardDuty (JSON).
 async function rest(service: string, region: string, url: URL, headers: Record<string, string> = {}) {
  const reply = await send(service, region, 'GET', url, '', headers)
  if (reply.status === 200) return reply.text
  let code = ''
  try { code = service === 's3' ? textAt(parseXml(reply.text), 'Error', 'Code') ?? '' : String((JSON.parse(reply.text) as Record<string, unknown>).__type ?? '') } catch { code = '' }
  throw classify(reply.status, code, service)
 }
 return { query, json, rest }
}
export type Client = ReturnType<typeof awsClient>
const bool = (v: string | null) => v === null ? null : v === 'true'
export async function callerIdentity(c: Client) {
 const doc = await c.query('sts', 'us-east-1', 'sts.amazonaws.com', { Action: 'GetCallerIdentity', Version: '2011-06-15' })
 return { account: textAt(doc, 'GetCallerIdentityResponse', 'GetCallerIdentityResult', 'Account') ?? '', arn: textAt(doc, 'GetCallerIdentityResponse', 'GetCallerIdentityResult', 'Arn') ?? '' }
}
export async function assumeRole(c: Client, roleArn: string, externalId: string, session: string): Promise<Credentials> {
 const doc = await c.query('sts', 'us-east-1', 'sts.amazonaws.com', { Action: 'AssumeRole', Version: '2011-06-15', RoleArn: roleArn, RoleSessionName: session, DurationSeconds: '900', ...(externalId ? { ExternalId: externalId } : {}) })
 const creds = at(doc, 'AssumeRoleResponse', 'AssumeRoleResult', 'Credentials')
 return { accessKeyId: textAt(creds, 'AccessKeyId') ?? '', secretAccessKey: textAt(creds, 'SecretAccessKey') ?? '', sessionToken: textAt(creds, 'SessionToken') ?? '' }
}
// Organization member accounts, or null when this account cannot list them.
export async function organizationAccounts(c: Client) {
 const accounts: { id: string; name: string; status: string }[] = []
 let token: string | undefined, pages = 0
 try {
  do {
   const page = await c.json('organizations', 'us-east-1', 'organizations.us-east-1.amazonaws.com', 'AWSOrganizationsV20161128.ListAccounts', token ? { NextToken: token } : {}) as { Accounts?: { Id: string; Name: string; Status: string }[]; NextToken?: string }
   accounts.push(...(page.Accounts ?? []).map(a => ({ id: a.Id, name: a.Name, status: a.Status }))); token = page.NextToken
  } while (token && ++pages < 20)
 } catch (error) { if (error instanceof AwsFailure && (error.kind === 'denied' || /AWSOrganizationsNotInUse/.test(error.code))) return null; throw error }
 return accounts
}
// IAM: root MFA, password policy and the credential report (users, MFA, keys).
export async function readIam(c: Client, now: Date) {
 const summary = await c.query('iam', 'us-east-1', 'iam.amazonaws.com', { Action: 'GetAccountSummary', Version: '2010-05-08' })
 const entries = list(at(summary, 'GetAccountSummaryResponse', 'GetAccountSummaryResult', 'SummaryMap', 'entry')) as XmlNode[]
 const rootMfa = entries.find(e => e.key === 'AccountMFAEnabled')
 let minLength: number | null = 0
 try { minLength = Number(textAt(await c.query('iam', 'us-east-1', 'iam.amazonaws.com', { Action: 'GetAccountPasswordPolicy', Version: '2010-05-08' }), 'GetAccountPasswordPolicyResponse', 'GetAccountPasswordPolicyResult', 'PasswordPolicy', 'MinimumPasswordLength') ?? 0) }
 catch (error) { if (!(error instanceof AwsFailure && error.kind === 'missing')) throw error }
 await c.query('iam', 'us-east-1', 'iam.amazonaws.com', { Action: 'GenerateCredentialReport', Version: '2010-05-08' })
 let users: { name: string; console: boolean; mfa: boolean; keyAgeDays: number }[] | null = null
 try {
  const report = await c.query('iam', 'us-east-1', 'iam.amazonaws.com', { Action: 'GetCredentialReport', Version: '2010-05-08' })
  const [header, ...rows] = atob(textAt(report, 'GetCredentialReportResponse', 'GetCredentialReportResult', 'Content') ?? '').trim().split('\n').map(line => line.split(','))
  const col = (row: string[], name: string) => row[header.indexOf(name)] ?? ''
  const age = (row: string[], n: 1 | 2) => col(row, `access_key_${n}_active`) === 'true' && Date.parse(col(row, `access_key_${n}_last_rotated`)) ? Math.floor((now.getTime() - Date.parse(col(row, `access_key_${n}_last_rotated`))) / 86400000) : 0
  users = rows.filter(r => col(r, 'user') && col(r, 'user') !== '<root_account>').map(r => ({ name: col(r, 'user'), console: col(r, 'password_enabled') === 'true', mfa: col(r, 'mfa_active') === 'true', keyAgeDays: Math.max(age(r, 1), age(r, 2)) }))
 } catch (error) { if (!(error instanceof AwsFailure && /ReportInProgress|ReportNotPresent|ReportExpired/.test(error.code))) throw error }
 return { rootMfa: rootMfa ? String(rootMfa.value) === '1' : null, minLength, users }
}
// S3: account-level block, then each bucket's block, default encryption and policy status.
export async function readS3(c: Client, account: string) {
 const blockOf = (xml: string) => { const b = at(parseXml(xml), 'PublicAccessBlockConfiguration'); return ['BlockPublicAcls', 'IgnorePublicAcls', 'BlockPublicPolicy', 'RestrictPublicBuckets'].every(k => textAt(b, k) === 'true') }
 let accountBlock = false
 try { accountBlock = blockOf(await c.rest('s3', 'us-east-1', new URL(`https://${account}.s3-control.us-east-1.amazonaws.com/v20180820/configuration/publicAccessBlock`), { 'x-amz-account-id': account })) }
 catch (error) { if (!(error instanceof AwsFailure && error.kind === 'missing')) throw error }
 const buckets = list(at(parseXml(await c.rest('s3', 'us-east-1', new URL('https://s3.amazonaws.com/'))), 'ListAllMyBucketsResult', 'Buckets', 'Bucket')).map(b => textAt(b, 'Name') ?? '').filter(Boolean)
 const out: { name: string; region: string; attributes: Record<string, boolean | null> }[] = []
 for (const name of buckets.slice(0, 200)) {
  const path = '/' + encodeURIComponent(name)
  const region = textAt(parseXml(await c.rest('s3', 'us-east-1', new URL(`https://s3.amazonaws.com${path}?location`))), 'LocationConstraint') || 'us-east-1'
  const get = async (sub: string, absent: (e: AwsFailure) => boolean) => { try { return await c.rest('s3', region, new URL(`https://s3.${region}.amazonaws.com${path}?${sub}`)) } catch (error) { if (error instanceof AwsFailure && absent(error)) return null; throw error } }
  const block = await get('publicAccessBlock', e => e.kind === 'missing'), encryption = await get('encryption', e => e.kind === 'missing' || /ServerSideEncryptionConfigurationNotFound/.test(e.code)), status = await get('policyStatus', e => e.kind === 'missing')
  out.push({ name, region, attributes: { public_access_blocked: accountBlock || (block !== null && blockOf(block)), default_encryption: encryption !== null && !!at(parseXml(encryption), 'ServerSideEncryptionConfiguration', 'Rule'), policy_public: status === null ? false : textAt(parseXml(status), 'PolicyStatus', 'IsPublic') === 'true' } })
 }
 return { accountBlock, buckets: out, complete: buckets.length <= 200 }
}
// Per-region evidence classes, read separately so one denied class is a gap, not a lost region.
export async function readTrailLogging(c: Client, region: string, trails: Map<string, boolean>) {
 const described = await c.json('cloudtrail', region, `cloudtrail.${region}.amazonaws.com`, 'com.amazonaws.cloudtrail.v20131101.CloudTrail_20131101.DescribeTrails', { includeShadowTrails: true }) as { trailList?: { TrailARN: string; IsMultiRegionTrail: boolean; HomeRegion: string }[] }
 let logging = false
 for (const trail of described.trailList ?? []) {
  if (!trails.has(trail.TrailARN)) trails.set(trail.TrailARN, ((await c.json('cloudtrail', trail.HomeRegion, `cloudtrail.${trail.HomeRegion}.amazonaws.com`, 'com.amazonaws.cloudtrail.v20131101.CloudTrail_20131101.GetTrailStatus', { Name: trail.TrailARN })) as { IsLogging?: boolean }).IsLogging === true)
  if ((trail.IsMultiRegionTrail || trail.HomeRegion === region) && trails.get(trail.TrailARN)) logging = true
 }
 return logging
}
export const readEbsDefault = async (c: Client, region: string) => bool(textAt(await c.query('ec2', region, `ec2.${region}.amazonaws.com`, { Action: 'GetEbsEncryptionByDefault', Version: '2016-11-15' }), 'GetEbsEncryptionByDefaultResponse', 'ebsEncryptionByDefault'))
export async function readSecurityGroups(c: Client, region: string) {
 const groups: { id: string; name: string; open: boolean }[] = []
 let next: string | null = null, pages = 0
 do {
  const doc = await c.query('ec2', region, `ec2.${region}.amazonaws.com`, { Action: 'DescribeSecurityGroups', Version: '2016-11-15', MaxResults: '1000', ...(next ? { NextToken: next } : {}) })
  for (const g of items(doc, 'DescribeSecurityGroupsResponse', 'securityGroupInfo')) {
   const open = items(g, 'ipPermissions').some(p => {
    const proto = textAt(p, 'ipProtocol'), from = Number(textAt(p, 'fromPort') ?? 0), to = Number(textAt(p, 'toPort') ?? 65535)
    const world = items(p, 'ipRanges').some(r => textAt(r, 'cidrIp') === '0.0.0.0/0') || items(p, 'ipv6Ranges').some(r => textAt(r, 'cidrIpv6') === '::/0')
    return world && (proto === '-1' || [22, 3389].some(port => from <= port && port <= to))
   })
   groups.push({ id: textAt(g, 'groupId') ?? '', name: textAt(g, 'groupName') ?? '', open })
  }
  next = textAt(doc, 'DescribeSecurityGroupsResponse', 'nextToken')
 } while (next && ++pages < 20)
 return { groups, complete: !next }
}
export async function readDatabases(c: Client, region: string) {
 const databases: { id: string; encrypted: boolean | null; backupDays: number; public: boolean | null }[] = []
 let marker: string | null = null, pages = 0
 do {
  const doc = await c.query('rds', region, `rds.${region}.amazonaws.com`, { Action: 'DescribeDBInstances', Version: '2014-10-31', ...(marker ? { Marker: marker } : {}) })
  for (const d of list(at(doc, 'DescribeDBInstancesResponse', 'DescribeDBInstancesResult', 'DBInstances', 'DBInstance'))) databases.push({ id: textAt(d, 'DBInstanceIdentifier') ?? '', encrypted: bool(textAt(d, 'StorageEncrypted')), backupDays: Number(textAt(d, 'BackupRetentionPeriod') ?? 0), public: bool(textAt(d, 'PubliclyAccessible')) })
  marker = textAt(doc, 'DescribeDBInstancesResponse', 'DescribeDBInstancesResult', 'Marker')
 } while (marker && ++pages < 20)
 return { databases, complete: !marker }
}
export async function readGuardDuty(c: Client, region: string) {
 const detectors = (JSON.parse(await c.rest('guardduty', region, new URL(`https://guardduty.${region}.amazonaws.com/detector`))) as { detectorIds?: string[] }).detectorIds ?? []
 for (const id of detectors) if ((JSON.parse(await c.rest('guardduty', region, new URL(`https://guardduty.${region}.amazonaws.com/detector/${encodeURIComponent(id)}`))) as { status?: string }).status === 'ENABLED') return true
 return false
}
export type { XmlValue }
