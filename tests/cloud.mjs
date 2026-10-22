import { gunzipSync } from 'node:zlib'
// AWS connection, organization discovery and the AWS catalogue through the
// owner's doors and the Cron Trigger. AWS is the only fake: a network-edge
// stand-in that checks every request's Signature Version 4 with its own Node
// implementation and answers the documented STS, Organizations, IAM, S3,
// CloudTrail, EC2, RDS and GuardDuty shapes for three accounts.
process.env.RER_SERVER_JOURNEY = '1'
import assert from 'node:assert/strict'
import { createHash, createHmac, randomBytes } from 'node:crypto'
import { runtime } from './helpers/runtime.mjs'
import { collectionScheduleBrowser } from './helpers/collection-schedule-browser.mjs'
import { collectionScheduleJourney } from './helpers/collection-schedule-journey.mjs'
const MGMT = '111111111111', MEMBER = '222222222222', LOCKED = '333333333333'
// Fake credentials are made fresh for each run; none is written in this file.
const keyId = () => 'AKIA' + randomBytes(8).toString('hex').toUpperCase(), secretKey = () => randomBytes(30).toString('base64')
const MAIN_KEY = keyId(), OTHER_KEY = keyId()
const aws = { now: '2026-10-11T12:00:00Z', keys: { [MAIN_KEY]: { secret: secretKey(), account: MGMT } }, temp: {}, denied: new Set(), calls: [], unsigned: 0, overrides: new Map(),
 roles: { [`arn:aws:iam::${MGMT}:role/EvidenceAudit`]: { account: MGMT, external: 'ext-123', trusts: MGMT }, [`arn:aws:iam::${MEMBER}:role/EvidenceReadOnly`]: { account: MEMBER, external: 'ext-123', trusts: MGMT } },
 accounts: {
  [MGMT]: { rootMfa: true, minLength: 14, users: [['alice', true, true, 10], ['deploy-bot', true, false, 30], ['ci', false, false, 200]], accountBlock: false,
   buckets: { 'northstar-logs': { region: 'us-east-1', block: true, enc: true, public: false }, 'northstar-site': { region: 'us-west-2', block: false, enc: true, public: true } },
   trails: [{ arn: 'arn:aws:cloudtrail:us-east-1:111111111111:trail/east', multi: false, home: 'us-east-1', logging: true }],
   regions: { 'us-east-1': { ebs: true, guardduty: true, groups: [['sg-0web', 'web', 22, '0.0.0.0/0'], ['sg-0app', 'app', 443, '0.0.0.0/0']], dbs: [['orders-db', true, 7, false]] }, 'us-west-2': { ebs: false, guardduty: false, groups: [], dbs: [['reports-db', false, 1, true]] } } },
  [MEMBER]: { rootMfa: false, minLength: null, users: [], accountBlock: true, buckets: {}, trails: [{ arn: 'arn:aws:cloudtrail:us-east-1:222222222222:trail/org', multi: true, home: 'us-east-1', logging: true }],
   regions: { 'us-east-1': { ebs: true, guardduty: true, groups: [], dbs: [] }, 'us-west-2': { ebs: true, guardduty: true, groups: [], dbs: [] } } },
 },
}
aws.denied.add(MEMBER + ':rds')
const sha = value => createHash('sha256').update(value).digest('hex'), hmac = (key, value) => createHmac('sha256', key).update(value).digest()
const enc = value => encodeURIComponent(value).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase())
// Independent SigV4 check: rebuild the canonical request and compare signatures.
function verify(request, url, body) {
 const m = /^AWS4-HMAC-SHA256 Credential=([^/]+)\/(\d{8})\/([^/]+)\/([^/]+)\/aws4_request, SignedHeaders=([^,]+), Signature=([0-9a-f]{64})$/.exec(request.headers.get('authorization') ?? '')
 if (!m) return null
 const [, akid, day, region, service, signed, signature] = m, key = aws.keys[akid] ?? aws.temp[akid]
 if (!key || (aws.temp[akid] && request.headers.get('x-amz-security-token') !== key.token)) return null
 const amzDate = request.headers.get('x-amz-date')
 if (amzDate !== aws.now.replace(/[-:]/g, '').replace(/\.\d{3}/, '') || day !== amzDate.slice(0, 8)) return null
 const value = name => name === 'host' ? url.host : (request.headers.get(name) ?? '').trim().replace(/\s+/g, ' ')
 const query = [...url.searchParams].map(([k, v]) => [enc(k), enc(v)]).sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : 1).map(([k, v]) => `${k}=${v}`).join('&')
 const path = url.pathname.split('/').map(s => service === 's3' ? enc(decodeURIComponent(s)) : enc(enc(decodeURIComponent(s)))).join('/')
 const canonical = [request.method, path, query, signed.split(';').map(n => `${n}:${value(n)}\n`).join(''), signed, sha(body)].join('\n')
 let k = hmac('AWS4' + key.secret, day); for (const part of [region, service, 'aws4_request']) k = hmac(k, part)
 return createHmac('sha256', k).update(['AWS4-HMAC-SHA256', amzDate, `${day}/${region}/${service}/aws4_request`, sha(canonical)].join('\n')).digest('hex') === signature ? { account: key.account, service, region } : null
}
const xml = (status, body) => new Response('<?xml version="1.0" encoding="UTF-8"?>' + body, { status, headers: { 'content-type': 'text/xml' } })
const error = (code, status = 403) => xml(status, `<ErrorResponse><Error><Type>Sender</Type><Code>${code}</Code><Message>${code}</Message></Error></ErrorResponse>`)
const jsonReply = (status, body) => Response.json(body, { status })
const report = users => Buffer.from(['user,arn,user_creation_time,password_enabled,password_last_used,password_last_changed,password_next_rotation,mfa_active,access_key_1_active,access_key_1_last_rotated,access_key_1_last_used_date,access_key_1_last_used_region,access_key_1_last_used_service,access_key_2_active,access_key_2_last_rotated', '<root_account>,arn,2020-01-01T00:00:00+00:00,not_supported,N/A,not_supported,not_supported,true,false,N/A,N/A,N/A,N/A,false,N/A', ...users.map(([name, console, mfa, age]) => `${name},arn,2025-01-01T00:00:00+00:00,${console},N/A,N/A,N/A,${mfa},true,${new Date(Date.parse(aws.now) - age * 86400000).toISOString()},N/A,N/A,N/A,false,N/A`)].join('\n')).toString('base64')
async function fakeAws(request) {
 const url = new URL(request.url)
 if (!url.hostname.endsWith('.amazonaws.com')) return null
 const body = request.method === 'GET' ? '' : await request.text(), who = verify(request, url, body)
 if (!who) { aws.unsigned++; return error('SignatureDoesNotMatch') }
 const params = Object.fromEntries(new URLSearchParams(body)), account = aws.accounts[who.account], action = params.Action ?? request.headers.get('x-amz-target')?.split('.').pop() ?? ''
 const override = aws.overrides.get(`${who.account} ${who.service} ${who.region} ${action || url.pathname + url.search}`)
 if (override) return override({params,url,who})
 aws.calls.push(`${who.account} ${who.service} ${who.region} ${action || url.pathname + url.search}`)
 if (aws.denied.has(`${who.account}:${who.service}`)) return who.service === 'cloudtrail' || who.service === 'organizations' ? jsonReply(400, { __type: 'AccessDeniedException' }) : error('AccessDenied')
 if (who.service === 'sts') {
  if (action === 'GetCallerIdentity') return xml(200, `<GetCallerIdentityResponse><GetCallerIdentityResult><Arn>arn:aws:sts::${who.account}:assumed-role/EvidenceAudit/evidence</Arn><UserId>AIDA</UserId><Account>${who.account}</Account></GetCallerIdentityResult></GetCallerIdentityResponse>`)
  const role = aws.roles[params.RoleArn]
  // The role's trust policy admits only principals of its trusted account, with the external ID.
  if (!role || role.external !== params.ExternalId || role.trusts !== who.account) return error('AccessDenied')
  const id = 'ASIA' + String(Object.keys(aws.temp).length + 1).padStart(16, '0'); aws.temp[id] = { secret: secretKey(), token: randomBytes(24).toString('base64'), account: role.account }
  return xml(200, `<AssumeRoleResponse><AssumeRoleResult><Credentials><AccessKeyId>${id}</AccessKeyId><SecretAccessKey>${aws.temp[id].secret}</SecretAccessKey><SessionToken>${aws.temp[id].token}</SessionToken><Expiration>2026-10-11T13:00:00Z</Expiration></Credentials></AssumeRoleResult></AssumeRoleResponse>`)
 }
 if (who.service === 'organizations') return who.account === MGMT ? jsonReply(200, { Accounts: [MGMT, MEMBER, LOCKED].map(Id => ({ Id, Name: Id === MGMT ? 'management' : Id === MEMBER ? 'production' : 'sandbox', Status: 'ACTIVE' })) }) : jsonReply(400, { __type: 'AccessDeniedException' })
 if (who.service === 'iam') {
  if (action === 'GetAccountSummary') return xml(200, `<GetAccountSummaryResponse><GetAccountSummaryResult><SummaryMap><entry><key>Users</key><value>${account.users.length}</value></entry><entry><key>AccountMFAEnabled</key><value>${account.rootMfa ? 1 : 0}</value></entry></SummaryMap></GetAccountSummaryResult></GetAccountSummaryResponse>`)
  if (action === 'GetAccountPasswordPolicy') return account.minLength === null ? error('NoSuchEntity', 404) : xml(200, `<GetAccountPasswordPolicyResponse><GetAccountPasswordPolicyResult><PasswordPolicy><MinimumPasswordLength>${account.minLength}</MinimumPasswordLength></PasswordPolicy></GetAccountPasswordPolicyResult></GetAccountPasswordPolicyResponse>`)
  if (action === 'GenerateCredentialReport') return xml(200, '<GenerateCredentialReportResponse><GenerateCredentialReportResult><State>COMPLETE</State></GenerateCredentialReportResult></GenerateCredentialReportResponse>')
  if (action === 'GetCredentialReport') return xml(200, `<GetCredentialReportResponse><GetCredentialReportResult><Content>${report(account.users)}</Content><ReportFormat>text/csv</ReportFormat></GetCredentialReportResult></GetCredentialReportResponse>`)
 }
 if (who.service === 's3') {
  const block = on => `<PublicAccessBlockConfiguration>${['BlockPublicAcls', 'IgnorePublicAcls', 'BlockPublicPolicy', 'RestrictPublicBuckets'].map(k => `<${k}>${on}</${k}>`).join('')}</PublicAccessBlockConfiguration>`
  const s3error = (code, status = 404) => xml(status, `<Error><Code>${code}</Code><Message>${code}</Message></Error>`)
  if (url.hostname.includes('s3-control')) return account.accountBlock ? xml(200, block(true)) : s3error('NoSuchPublicAccessBlockConfiguration')
  if (url.pathname === '/') return xml(200, `<ListAllMyBucketsResult><Owner><ID>x</ID></Owner><Buckets>${Object.keys(account.buckets).map(n => `<Bucket><Name>${n}</Name><CreationDate>2025-01-01T00:00:00.000Z</CreationDate></Bucket>`).join('')}</Buckets></ListAllMyBucketsResult>`)
  const bucket = account.buckets[decodeURIComponent(url.pathname.slice(1))]
  if (!bucket) return s3error('NoSuchBucket')
  if (url.search === '?location') return xml(200, bucket.region === 'us-east-1' ? '<LocationConstraint/>' : `<LocationConstraint>${bucket.region}</LocationConstraint>`)
  if (url.hostname !== `s3.${bucket.region}.amazonaws.com`) return s3error('PermanentRedirect', 301)
  if (url.search === '?publicAccessBlock') return bucket.block ? xml(200, block(true)) : s3error('NoSuchPublicAccessBlockConfiguration')
  if (url.search === '?encryption') return bucket.enc ? xml(200, '<ServerSideEncryptionConfiguration><Rule><ApplyServerSideEncryptionByDefault><SSEAlgorithm>AES256</SSEAlgorithm></ApplyServerSideEncryptionByDefault></Rule></ServerSideEncryptionConfiguration>') : s3error('ServerSideEncryptionConfigurationNotFoundError')
  if (url.search === '?policyStatus') return bucket.public ? xml(200, '<PolicyStatus><IsPublic>true</IsPublic></PolicyStatus>') : s3error('NoSuchBucketPolicy')
 }
 const region = account.regions[who.region]
 if (who.service === 'cloudtrail') {
  const target = JSON.parse(body)
  if (action === 'DescribeTrails') return jsonReply(200, { trailList: account.trails.filter(t => t.multi || t.home === who.region).map(t => ({ TrailARN: t.arn, IsMultiRegionTrail: t.multi, HomeRegion: t.home })) })
  return jsonReply(200, { IsLogging: account.trails.find(t => t.arn === target.Name).logging })
 }
 if (who.service === 'ec2') {
  if (action === 'GetEbsEncryptionByDefault') return xml(200, `<GetEbsEncryptionByDefaultResponse><requestId>1</requestId><ebsEncryptionByDefault>${region.ebs}</ebsEncryptionByDefault></GetEbsEncryptionByDefaultResponse>`)
  return xml(200, `<DescribeSecurityGroupsResponse><requestId>1</requestId><securityGroupInfo>${region.groups.map(([id, name, port, cidr]) => `<item><groupId>${id}</groupId><groupName>${name}</groupName><ipPermissions><item><ipProtocol>tcp</ipProtocol><fromPort>${port}</fromPort><toPort>${port}</toPort><ipRanges><item><cidrIp>${cidr}</cidrIp></item></ipRanges><ipv6Ranges/></item></ipPermissions></item>`).join('')}</securityGroupInfo></DescribeSecurityGroupsResponse>`)
 }
 if (who.service === 'rds') return xml(200, `<DescribeDBInstancesResponse><DescribeDBInstancesResult><DBInstances>${region.dbs.map(([id, encrypted, days, isPublic]) => `<DBInstance><DBInstanceIdentifier>${id}</DBInstanceIdentifier><StorageEncrypted>${encrypted}</StorageEncrypted><BackupRetentionPeriod>${days}</BackupRetentionPeriod><PubliclyAccessible>${isPublic}</PubliclyAccessible></DBInstance>`).join('')}</DBInstances></DescribeDBInstancesResult></DescribeDBInstancesResponse>`)
 if (who.service === 'guardduty') return url.pathname === '/detector' ? jsonReply(200, { detectorIds: region.guardduty ? ['det-1'] : [] }) : jsonReply(200, { status: 'ENABLED' })
 return error('InvalidAction', 400)
}
const app = await runtime({ outbound: fakeAws })
let passed = 0
const scenario = async (name, fn) => { await fn(); passed++; console.log('PASS ' + name) }
const owner = async (path, body, status = 201) => { const r = await app.fetch(path, { method: 'POST', headers: { origin: app.origin, 'content-type': 'application/json' }, body: JSON.stringify(body) }); const text = await r.text(); assert.equal(r.status, status, path + ' ' + text); return text ? JSON.parse(text) : null }
const get = async path => { const r = await app.fetch(path); assert.equal(r.status, 200, path); return r.json() }
const at = async time => { aws.now = time; await app.clock(time) }
const testOf = async id => (await get('/api/tests')).tests.find(t => t.catalogue_id === id)
const results = async id => Object.fromEntries((await get('/api/tests/' + (await testOf(id)).id)).latest.map(o => [o.display_name, o.result]))
const keys = { access_key_id: MAIN_KEY, secret_access_key: aws.keys[MAIN_KEY].secret }
let connection
try {
 await scenario('An AWS key is kept only after a signed STS read through the assumed role; keys never appear and the AWS catalogue is enabled', async () => {
  await app.signin()
  await owner('/api/connections', { provider: 'aws', ...keys, secret_access_key: secretKey(), role_arn: `arn:aws:iam::${MGMT}:role/EvidenceAudit`, external_id: 'ext-123' }, 400)
  await owner('/api/connections', { provider: 'aws', ...keys, role_arn: `arn:aws:iam::${MGMT}:role/EvidenceAudit`, external_id: 'wrong' }, 400)
  await owner('/api/connections', { provider: 'aws', ...keys, regions: 'mars-1' }, 400)
  assert.equal((await app.db.prepare("SELECT COUNT(*) AS n FROM connections").first()).n, 0)
  connection = await owner('/api/connections', { provider: 'aws', ...keys, role_arn: `arn:aws:iam::${MGMT}:role/EvidenceAudit`, external_id: 'ext-123', member_role: 'EvidenceReadOnly', regions: 'us-east-1, us-west-2', label: 'AWS organization' })
  assert.equal(connection.account, MGMT); assert.equal(aws.unsigned, 1)
  const visible = JSON.stringify(await get('/api/connections')) + await (await app.fetch('/app/connections/' + connection.id)).text() + JSON.stringify((await app.db.prepare('SELECT * FROM product_audit').all()).results)
  assert.ok(!visible.includes(keys.secret_access_key) && !visible.includes('ext-123x'))
  const enabled = (await get('/api/tests')).tests.filter(t => t.catalogue_id?.startsWith('aws.')).map(t => t.catalogue_id).sort()
  assert.equal(enabled.length, 13); assert.ok(!enabled.includes('aws.s3-tls-only'))
  assert.match((await get('/api/tests')).catalogue.find(e => e.id === 'aws.s3-tls-only').manualRequirement, /aws:SecureTransport/)
 })
 await scenario('BOUNDARY-001 / LIBRARY-001: The hourly read finds every organization account, keeps the unreadable one as unknown, and fails the real misconfigurations with AWS remediation and Terraform', async () => {
  await app.tick()
  const detail = await get('/api/connections/' + connection.id), run = detail.runs[0], coverage = JSON.parse(run.coverage_json)
  assert.equal(run.outcome, 'partial'); assert.equal(run.trigger, 'schedule')
  assert.deepEqual(coverage.accounts.map(a => [a.id, a.read]), [[MGMT, true], [MEMBER, true], [LOCKED, false]])
  assert.match(coverage.accounts[2].reason, /cannot assume EvidenceReadOnly/)
  assert.deepEqual(coverage.gaps.map(g => `${g.account} ${g.class} ${g.region}`), [`${MEMBER} RDS us-east-1`, `${MEMBER} RDS us-west-2`])
  assert.deepEqual(await results('aws.root-mfa'), { [`management (${MGMT})`]: 'pass', [`production (${MEMBER})`]: 'fail', [`sandbox (${LOCKED})`]: 'unknown' })
  assert.deepEqual(await results('aws.console-user-mfa'), { [`alice (${MGMT})`]: 'pass', [`ci (${MGMT})`]: 'pass', [`deploy-bot (${MGMT})`]: 'fail' })
  assert.equal((await results('aws.access-key-age'))[`ci (${MGMT})`], 'fail')
  assert.deepEqual(await results('aws.s3-public-access'), { [`northstar-logs (${MGMT})`]: 'pass', [`northstar-site (${MGMT})`]: 'fail' })
  assert.deepEqual(await results('aws.cloudtrail-logging'), { [`${MGMT} us-east-1`]: 'pass', [`${MGMT} us-west-2`]: 'fail', [`${MEMBER} us-east-1`]: 'pass', [`${MEMBER} us-west-2`]: 'pass', [`${LOCKED} us-east-1`]: 'unknown', [`${LOCKED} us-west-2`]: 'unknown' })
  assert.equal((await results('aws.security-group-admin-ports'))[`web sg-0web (${MGMT} us-east-1)`], 'fail'); assert.equal((await results('aws.security-group-admin-ports'))[`app sg-0app (${MGMT} us-east-1)`], 'pass')
  assert.deepEqual(await results('aws.rds-backups'), { [`orders-db (${MGMT} us-east-1)`]: 'pass', [`reports-db (${MGMT} us-west-2)`]: 'fail' })
  assert.equal((await results('aws.password-policy'))[`production (${MEMBER})`], 'fail')
  const s3 = await get('/api/tests/' + (await testOf('aws.s3-public-access')).id)
  assert.match(s3.entry.remediation.aws.terraform, /aws_s3_bucket_public_access_block/); assert.match(await (await app.fetch('/app/tests/' + s3.test.id)).text(), /How to remediate/)
  assert.ok((await get('/api/remediation')).open.some(o => o.resource_name === `northstar-site (${MGMT})`))
  assert.ok(aws.calls.every(c => /GetCallerIdentity|AssumeRole|ListAccounts|GetAccountSummary|GetAccountPasswordPolicy|CredentialReport|DescribeTrails|GetTrailStatus|GetEbsEncryptionByDefault|DescribeSecurityGroups|DescribeDBInstances|\/detector|\/\?|\/$|location|publicAccessBlock|encryption|policyStatus/.test(c)))
  assert.equal(aws.unsigned, 1)
 })
 await scenario('INVENTORY-001 / CLOUD-001: A source fix passes on the next hourly read with both observations kept; a revoked read is a gap that turns known resources unknown; keys for another account are refused', async () => {
  aws.accounts[MGMT].buckets['northstar-site'].block = true
  aws.denied.add(MGMT + ':ec2')
  await at('2026-10-11T13:00:00Z'); await app.tick()
  assert.equal((await results('aws.s3-public-access'))[`northstar-site (${MGMT})`], 'pass')
  const fixed = (await get('/api/remediation')).resolved.find(o => o.resource_name === `northstar-site (${MGMT})`)
  assert.equal(fixed.state, 'verified'); assert.deepEqual((await get('/api/remediation/' + fixed.id)).observations.map(o => o.result).slice(0, 2), ['pass', 'fail'])
  assert.deepEqual(await results('aws.security-group-admin-ports'), { [`app sg-0app (${MGMT} us-east-1)`]: 'unknown', [`web sg-0web (${MGMT} us-east-1)`]: 'unknown' })
  assert.equal((await results('aws.ebs-default-encryption'))[`${MGMT} us-east-1`], 'unknown')
  const coverage = JSON.parse((await get('/api/connections/' + connection.id)).runs[0].coverage_json)
  assert.ok(coverage.gaps.some(g => g.account === MGMT && g.class === 'Security groups'))
  aws.keys[OTHER_KEY] = { secret: secretKey(), account: MEMBER }
  await owner(`/api/connections/${connection.id}/rotate`, { access_key_id: OTHER_KEY, secret_access_key: aws.keys[OTHER_KEY].secret }, 400)
  const exported = Buffer.from(await (await app.fetch('/api/archive/export')).arrayBuffer()).toString('latin1')
  assert.ok(!exported.includes(keys.secret_access_key))
  const before = (await get('/api/tests/' + (await testOf('aws.root-mfa')).id)).latest
  aws.denied.add(MGMT + ':organizations')
  await at('2026-10-11T14:00:00Z'); await app.tick()
  const after = (await get('/api/tests/' + (await testOf('aws.root-mfa')).id)).latest
  assert.deepEqual(after.map(r => r.resource_id).sort(), before.map(r => r.resource_id).sort(), 'lost discovery permission never shrinks known account subjects')
  assert.equal(after.filter(r => r.result === 'unknown').length, 2)
  const snapshot = await get('/api/inventory'), assets = snapshot.records.filter(r => r.source_ref === 'aws:' + connection.id)
  assert.ok(assets.some(r => r.source_type === 'aws.s3_bucket'))
  assert.ok(assets.every(r => r.lifecycle === 'active' && r.scope === 'included'))
  assert.ok(assets.some(r => r.collection_state === 'unread'))

 })
 await scenario('LIBRARY-001: two connected hours leave at least two runs of every AWS configuration test, and a paused scheduler shows a stale interval, never a carried-forward pass', async () => {
  const hourly = (await get('/api/tests')).tests.filter(t => t.catalogue_id?.startsWith('aws.') && t.cadence === 'hourly')
  assert.ok(hourly.length >= 10)
  for (const t of hourly) assert.ok((await get('/api/tests/' + t.id)).runs.length >= 2, t.catalogue_id)
  const s3 = await testOf('aws.s3-public-access'), before = (await get('/api/tests/' + s3.id)).runs.length
  // The scheduler is paused from 14:00 to 16:30: no run happens and nothing is carried forward.
  await at('2026-10-11T16:30:00Z')
  const paused = await get('/api/tests/' + s3.id)
  assert.deepEqual(paused.stale, [{ from: '2026-10-11T15:00:00.000Z', to: '2026-10-11T16:30:00.000Z' }])
  assert.equal(paused.runs.length, before); assert.ok((await testOf('aws.s3-public-access')).stale)
  assert.match(await (await app.fetch('/app/tests?show=stale')).text(), /S3/)
  await app.tick()
  const resumed = await get('/api/tests/' + s3.id)
  assert.equal(resumed.runs.length, before + 1); assert.equal(resumed.runs[0].started_at, '2026-10-11T16:30:00.000Z')
  assert.deepEqual(resumed.stale, [{ from: '2026-10-11T15:00:00.000Z', to: '2026-10-11T16:30:00.000Z' }])
  assert.ok(resumed.runs.every(r => r.started_at <= '2026-10-11T14:00:00.000Z' || r.started_at === '2026-10-11T16:30:00.000Z'))
 })
 await scenario('COLLECTION-001: AWS malformed Query, JSON and REST facts and incomplete pages retain known class populations as unknown, with fresh recovery and original gaps', async () => {
  const path = '/api/connections/' + connection.id
  let time = Date.parse((await get(path)).runs[0].started_at)
  const collect = async () => { time += 60000; await at(new Date(time).toISOString()); await owner(path + '/collect', {}); return (await get(path)).runs[0] }
  aws.denied.clear(); await collect()
  const cases = [
   ['iam','us-east-1','GetAccountSummary', () => xml(200,'<GetAccountSummaryResponse><GetAccountSummaryResult><SummaryMap/></GetAccountSummaryResult></GetAccountSummaryResponse>'), 'aws.root-mfa'],
   ['iam','us-east-1','GetCredentialReport', () => xml(200,'<GetCredentialReportResponse><GetCredentialReportResult><Content>' + Buffer.from('user,password_enabled,mfa_active\nalice,true,true').toString('base64') + '</Content></GetCredentialReportResult></GetCredentialReportResponse>'), 'aws.console-user-mfa'],
   ['ec2','us-east-1','GetEbsEncryptionByDefault', () => xml(200,'<GetEbsEncryptionByDefaultResponse><ebsEncryptionByDefault>yes</ebsEncryptionByDefault></GetEbsEncryptionByDefaultResponse>'), 'aws.ebs-default-encryption'],
   ['ec2','us-east-1','DescribeSecurityGroups', () => xml(200,'<DescribeSecurityGroupsResponse><securityGroupInfo>missing records</securityGroupInfo></DescribeSecurityGroupsResponse>'), 'aws.security-group-admin-ports'],
   ['ec2','us-east-1','DescribeSecurityGroups', () => xml(200,'<DescribeSecurityGroupsResponse><securityGroupInfo><item><groupId>sg-0web</groupId><groupName>web</groupName><ipPermissions><item><ipProtocol>tcp</ipProtocol><fromPort>unknown</fromPort><toPort>22</toPort></item></ipPermissions></item></securityGroupInfo></DescribeSecurityGroupsResponse>'), 'aws.security-group-admin-ports'],
   ['rds','us-east-1','DescribeDBInstances', () => xml(200,'<DescribeDBInstancesResponse><DescribeDBInstancesResult><DBInstances><DBInstance><DBInstanceIdentifier>orders-db</DBInstanceIdentifier><StorageEncrypted>true</StorageEncrypted><PubliclyAccessible>false</PubliclyAccessible></DBInstance></DBInstances></DescribeDBInstancesResult></DescribeDBInstancesResponse>'), 'aws.rds-backups'],
   ['cloudtrail','us-east-1','DescribeTrails', () => jsonReply(200,{trailList:'missing records'}), 'aws.cloudtrail-logging'],
   ['cloudtrail','us-east-1','GetTrailStatus', () => jsonReply(200,{IsLogging:'true'}), 'aws.cloudtrail-logging'],
   ['guardduty','us-east-1','/detector', () => jsonReply(200,{detectorIds:'det-1'}), 'aws.guardduty'],
   ['guardduty','us-east-1','/detector/det-1', () => jsonReply(200,{}), 'aws.guardduty'],
   ['s3','us-east-1','/northstar-logs?publicAccessBlock', () => xml(200,'<PublicAccessBlockConfiguration><BlockPublicAcls>true</BlockPublicAcls></PublicAccessBlockConfiguration>'), 'aws.s3-public-access'],
   ['s3','us-east-1','/northstar-logs?encryption', () => xml(200,'<ServerSideEncryptionConfiguration><Rule/></ServerSideEncryptionConfiguration>'), 'aws.s3-encryption'],
   ['s3','us-west-2','/northstar-site?policyStatus', () => xml(200,'<PolicyStatus/>'), 'aws.s3-public-access'],
  ]
  const failures = []
  for (const [service,region,action,reply,catalogue] of cases) {
   const before = await results(catalogue), names = Object.keys(before).filter(n => n.includes(MGMT) || service === 's3' && n.includes('northstar-'))
   assert.ok(names.length,catalogue)
   const key = `${MGMT} ${service} ${region} ${action}`
   aws.overrides.set(key,reply)
   const run = await collect(); failures.push(run)
   assert.equal(run.outcome,'partial'); assert.match(run.coverage_json,/AWS schema drift/)
   const after = await results(catalogue)
   const affected = service === 's3' ? names : names.filter(n => service === 'iam' || service === 'rds' || service === 'ec2' && action === 'DescribeSecurityGroups' || n.includes(region))
   assert.ok(affected.some(n => after[n] === 'unknown'),'malformed facts cannot leave a false pass')
   for (const name of names) assert.ok(Object.hasOwn(after,name),'known denominator retained: '+name)
   aws.overrides.delete(key); await collect()
   assert.deepEqual(await results(catalogue),before)
  }
  const key = `${MGMT} ec2 us-east-1 DescribeSecurityGroups`
  aws.overrides.set(key,()=>xml(200,'<DescribeSecurityGroupsResponse><securityGroupInfo/><nextToken>repeated</nextToken></DescribeSecurityGroupsResponse>'))
  const incomplete = await collect(); failures.push(incomplete)
  assert.equal(incomplete.outcome,'partial'); assert.match(incomplete.coverage_json,/pagination incomplete/)
  aws.overrides.clear(); await collect()
  const history = (await get(path)).runs
  for (const run of failures) assert.deepEqual(history.find(r=>r.id===run.id),run)
  await collectionScheduleBrowser(app,[(await get(path)).connection],{suffix:'-aws-schema',expected:['AWS schema drift','pagination incomplete']})
 })
 await scenario('COLLECTION-001: AWS resumes interrupted source pages through fresh authentication without duplicate page reads or rewritten outcomes',async()=>{
  const path='/api/connections/'+connection.id
  let time=Date.parse((await get(path)).runs[0].started_at)
  const cases=[
   ['organizations','ListAccounts','NextToken',()=>jsonReply(200,{Accounts:[{Id:MGMT,Name:'management',Status:'ACTIVE',unexpected_secret:'synthetic-evidence-private'},{Id:MEMBER,Name:'production',Status:'ACTIVE'}],NextToken:'synthetic-page-2'}),()=>jsonReply(200,{Accounts:[{Id:LOCKED,Name:'sandbox',Status:'ACTIVE'}]})],
   ['ec2','DescribeSecurityGroups','NextToken',()=>xml(200,'<DescribeSecurityGroupsResponse><securityGroupInfo/><nextToken>synthetic-page-2</nextToken></DescribeSecurityGroupsResponse>'),()=>xml(200,'<DescribeSecurityGroupsResponse><securityGroupInfo><item><groupId>sg-0web</groupId><groupName>web</groupName><ipPermissions/></item></securityGroupInfo></DescribeSecurityGroupsResponse>')],
   ['rds','DescribeDBInstances','Marker',()=>xml(200,'<DescribeDBInstancesResponse><DescribeDBInstancesResult><DBInstances/><Marker>synthetic-page-2</Marker></DescribeDBInstancesResult></DescribeDBInstancesResponse>'),()=>xml(200,'<DescribeDBInstancesResponse><DescribeDBInstancesResult><DBInstances><DBInstance><DBInstanceIdentifier>orders-db</DBInstanceIdentifier><StorageEncrypted>true</StorageEncrypted><BackupRetentionPeriod>7</BackupRetentionPeriod><PubliclyAccessible>false</PubliclyAccessible></DBInstance></DBInstances></DescribeDBInstancesResult></DescribeDBInstancesResponse>')],
  ]
  for(const [service,action,cursor,one,two]of cases){
   const key=`${MGMT} ${service} us-east-1 ${action}`;let first=0,second=0,throttle=true
   aws.overrides.set(key,({params})=>{if(!params[cursor]){first++;return one()}second++;return throttle?jsonReply(429,{__type:'ThrottlingException'}):two()})
   time+=60000;await at(new Date(time).toISOString());await owner(path+'/collect',{})
   const interrupted=(await get(path)).runs[0],saved=JSON.parse(interrupted.coverage_json)
   assert.equal(interrupted.outcome,'throttled');assert.equal(saved.resume_pages.pending,true)
   assert.ok(!gunzipSync(Buffer.from(saved.resume_pages.data,'base64')).toString().includes('synthetic-evidence-private'))
   throttle=false;time+=300000;await at(new Date(time).toISOString());await owner(path+'/collect',{})
   const recovered=(await get(path)).runs[0],metadata=JSON.parse(recovered.coverage_json)
   assert.equal(first,1);assert.equal(second,2);assert.ok(['complete','partial'].includes(recovered.outcome))
   assert.equal(metadata.source_read_started_at,interrupted.started_at)
   assert.deepEqual((await get(path)).runs.find(r=>r.id===interrupted.id),interrupted)
   aws.overrides.clear()
  }
 })
 await scenario('COLLECTION-001: hosted collector schedules through owner doors, Cron, browser and restore', () => collectionScheduleJourney(app, at))
 console.log(`${passed} AWS public-door scenarios passed; AWS is faked only at the network edge, with every signature checked.`)
} finally { await app.close() }
