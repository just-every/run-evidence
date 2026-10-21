// Google Cloud and Microsoft Azure connections through the owner's doors and
// the Cron Trigger. The clouds are the only fakes: network-edge stand-ins for
// Google OAuth (verifying the service account's RS256 assertion), Resource
// Manager, Cloud Storage, IAM, Cloud SQL and Compute Engine, and for Microsoft
// login and Azure Resource Manager, answering their documented JSON shapes.
process.env.RER_SERVER_JOURNEY = '1'
import assert from 'node:assert/strict'
import { generateKeyPairSync, randomBytes, verify as verifySignature } from 'node:crypto'
import { runtime } from './helpers/runtime.mjs'
import { collectionScheduleBrowser } from './helpers/collection-schedule-browser.mjs'
import { collectionScheduleJourney } from './helpers/collection-schedule-journey.mjs'
const pair = () => generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } })
const { privateKey, publicKey } = pair()
const SA = 'evidence-reader@ops-host.example.test', TENANT = '0e5f1c2a-2222-4333-8444-955566667777', CLIENT = '1b2c3d4e-2222-4333-8444-955566667777', AZ_SECRET = randomBytes(24).toString('base64')
const gcpKey = JSON.stringify({ client_email: SA, private_key: privateKey })
const ago = days => new Date(Date.parse('2026-10-11T12:00:00Z') - days * 86400000).toISOString()
const g = {
 projects: ['northstar-prod', 'northstar-sandbox'], denied: new Set(['northstar-sandbox:iam']), disabled: new Set(['northstar-sandbox:compute']),
 iam: { 'northstar-prod': { bindings: [{ role: 'roles/viewer', members: ['allUsers'] }, { role: 'roles/owner', members: ['user:ana@northstar.test'] }], auditConfigs: [{ service: 'allServices', auditLogConfigs: [{ logType: 'DATA_READ' }, { logType: 'DATA_WRITE' }] }] } },
 buckets: { 'northstar-prod': [{ name: 'prod-assets', prevention: 'inherited', members: ['allUsers'] }, { name: 'prod-logs', prevention: 'enforced', members: [] }], 'northstar-sandbox': [] },
 keys: { 'northstar-prod': [{ sa: 'deployer@northstar-prod.example.test', id: 'k1old', created: ago(200) }, { sa: 'deployer@northstar-prod.example.test', id: 'k2new', created: ago(5) }], 'northstar-sandbox': [] },
 sql: { 'northstar-prod': [{ name: 'prod-db', backups: false, networks: ['0.0.0.0/0'], ssl: false }], 'northstar-sandbox': [] },
 firewalls: { 'northstar-prod': [{ name: 'allow-ssh', ranges: ['0.0.0.0/0'], ports: ['22'] }, { name: 'allow-https', ranges: ['0.0.0.0/0'], ports: ['443'] }] },
}
const az = {
 responses: new Map(), calls: [],
 subs: [['11111111-aaaa-4bbb-8ccc-000000000001', 'Production'], ['11111111-aaaa-4bbb-8ccc-000000000002', 'Development']], denied: new Set(),
 diag: { Production: 1, Development: 0 }, defender: { Production: 'Standard', Development: 'Free' },
 storage: { Production: [{ name: 'prodblobs', public: true, https: true, tls: 'TLS1_0' }], Development: [] },
 sql: { Production: [{ name: 'prod-sql', publicAccess: 'Enabled', dbs: [['orders', 3]] }], Development: [] },
 nsgs: { Production: [], Development: [{ name: 'dev-nsg', rules: [{ direction: 'Inbound', access: 'Allow', sourceAddressPrefix: 'Internet', destinationPortRange: '22' }] }] },
}
const json = (body, status = 200) => Response.json(body, { status })
const denied = () => json({ error: { code: 403, message: 'The caller does not have permission', status: 'PERMISSION_DENIED' } }, 403)
const b64url = value => Buffer.from(value, 'base64url')
async function fakeClouds(request) {
 const url = new URL(request.url), auth = request.headers.get('authorization') ?? ''
 if (url.hostname === 'oauth2.googleapis.com') {
  const [header, claims, signature] = (new URLSearchParams(await request.text()).get('assertion') ?? '').split('.'), body = JSON.parse(b64url(claims).toString())
  const ok = verifySignature('RSA-SHA256', Buffer.from(`${header}.${claims}`), publicKey, b64url(signature)) && body.iss === SA && body.sub === undefined && body.scope === 'https://www.googleapis.com/auth/cloud-platform.read-only'
  return ok ? json({ access_token: 'gcp-access' }) : json({ error: 'invalid_grant' }, 400)
 }
 if (url.hostname.endsWith('.googleapis.com')) {
  if (auth !== 'Bearer gcp-access') return json({ error: { code: 401 } }, 401)
  const project = /projects\/([a-z0-9-]+)/.exec(url.pathname)?.[1] ?? url.searchParams.get('project')
  if (url.hostname === 'cloudresourcemanager.googleapis.com' && url.pathname === '/v1/projects') return json({ projects: g.projects.map(p => ({ projectId: p, name: p.replace('northstar-', 'Northstar '), lifecycleState: 'ACTIVE' })) })
  if (url.hostname === 'cloudresourcemanager.googleapis.com') return g.denied.has(project + ':iam') ? denied() : json(g.iam[project] ?? { bindings: [] })
  if (url.hostname === 'storage.googleapis.com') {
   const iam = /^\/storage\/v1\/b\/([^/]+)\/iam$/.exec(url.pathname)
   if (iam) { const b = Object.values(g.buckets).flat().find(x => x.name === iam[1]); return json({ bindings: b.members.length ? [{ role: 'roles/storage.objectViewer', members: b.members }] : [] }) }
   return json({ items: (g.buckets[project] ?? []).map(b => ({ name: b.name, iamConfiguration: { publicAccessPrevention: b.prevention } })) })
  }
  if (url.hostname === 'iam.googleapis.com') {
   if (url.pathname.endsWith('/serviceAccounts')) return json({ accounts: [...new Set((g.keys[project] ?? []).map(k => k.sa))].map(email => ({ email, name: `projects/${project}/serviceAccounts/${email}` })) })
   const sa = decodeURIComponent(/serviceAccounts\/([^/]+)\/keys/.exec(url.pathname)[1])
   return json({ keys: (g.keys[project] ?? []).filter(k => k.sa === sa).map(k => ({ name: `projects/${project}/serviceAccounts/${sa}/keys/${k.id}`, validAfterTime: k.created, keyType: 'USER_MANAGED' })) })
  }
  if (url.hostname === 'sqladmin.googleapis.com') return json({ items: (g.sql[project] ?? []).map(i => ({ name: i.name, settings: { backupConfiguration: { enabled: i.backups }, ipConfiguration: { ipv4Enabled: true, authorizedNetworks: i.networks.map(value => ({ value })), requireSsl: i.ssl } } })) })
  if (url.hostname === 'compute.googleapis.com') return g.disabled.has(project + ':compute') ? json({ error: { code: 403, errors: [{ reason: 'accessNotConfigured' }], status: 'PERMISSION_DENIED' } }, 403) : json({ items: (g.firewalls[project] ?? []).map(f => ({ name: f.name, network: 'global/networks/default', direction: 'INGRESS', disabled: false, sourceRanges: f.ranges, allowed: [{ IPProtocol: 'tcp', ports: f.ports }] })) })
 }
 if (url.hostname === 'login.microsoftonline.com') {
  const form = new URLSearchParams(await request.text())
  return url.pathname === `/${TENANT}/oauth2/v2.0/token` && form.get('client_id') === CLIENT && form.get('client_secret') === AZ_SECRET && form.get('scope') === 'https://management.azure.com/.default' ? json({ access_token: 'arm-access' }) : json({ error: 'invalid_client' }, 401)
 }
 if (url.hostname === 'management.azure.com') {
  if (auth !== 'Bearer arm-access') return json({ error: { code: 'InvalidAuthenticationToken' } }, 401)
  const requested = url.pathname + url.search; az.calls.push(requested)
  if (az.responses.has(requested)) return json(az.responses.get(requested))
  if (url.pathname === '/subscriptions') return json({ value: az.subs.map(([subscriptionId, displayName]) => ({ subscriptionId, displayName, state: 'Enabled' })) })
  const [, id] = /^\/subscriptions\/([^/]+)/.exec(url.pathname), name = az.subs.find(s => s[0] === id)[1], path = url.pathname.slice(`/subscriptions/${id}`.length)
  if (az.denied.has(`${name}:${path}`)) return json({ error: { code: 'AuthorizationFailed' } }, 403)
  if (path === '/providers/Microsoft.Insights/diagnosticSettings') return json({ value: Array.from({ length: az.diag[name] }, (_, i) => ({ name: 'export' + i })) })
  if (path === '/providers/Microsoft.Security/pricings') return json({ value: [{ name: 'VirtualMachines', properties: { pricingTier: az.defender[name] } }] })
  if (path === '/providers/Microsoft.Storage/storageAccounts') return json({ value: az.storage[name].map(a => ({ name: a.name, properties: { allowBlobPublicAccess: a.public, supportsHttpsTrafficOnly: a.https, minimumTlsVersion: a.tls } })) })
  if (path === '/providers/Microsoft.Sql/servers') return json({ value: az.sql[name].map(x => ({ id: `/subscriptions/${id}/resourceGroups/rg/providers/Microsoft.Sql/servers/${x.name}`, name: x.name, properties: { publicNetworkAccess: x.publicAccess } })) })
  const dbs = /\/servers\/([^/]+)\/databases$/.exec(path)
  if (dbs) return json({ value: [{ name: 'master' }, ...az.sql[name].find(x => x.name === dbs[1]).dbs.map(([db]) => ({ name: db }))].map(d => ({ ...d, id: `/subscriptions/${id}/resourceGroups/rg/providers/Microsoft.Sql/servers/${dbs[1]}/databases/${d.name}` })) })
  const retention = /\/servers\/([^/]+)\/databases\/([^/]+)\/backupShortTermRetentionPolicies\/default$/.exec(path)
  if (retention) return json({ properties: { retentionDays: az.sql[name].find(x => x.name === retention[1]).dbs.find(([db]) => db === retention[2])[1] } })
  if (path === '/providers/Microsoft.Network/networkSecurityGroups') return json({ value: az.nsgs[name].map(n => ({ name: n.name, properties: { securityRules: n.rules.map(r => ({ properties: r })) } })) })
 }
 return null
}
const app = await runtime({ outbound: fakeClouds })
let passed = 0
const scenario = async (name, fn) => { await fn(); passed++; console.log('PASS ' + name) }
const owner = async (path, body, status = 201) => { const r = await app.fetch(path, { method: 'POST', headers: { origin: app.origin, 'content-type': 'application/json' }, body: JSON.stringify(body) }); const text = await r.text(); assert.equal(r.status, status, path + ' ' + text); return text ? JSON.parse(text) : null }
const get = async path => { const r = await app.fetch(path); assert.equal(r.status, 200, path); return r.json() }
const testOf = async id => (await get('/api/tests')).tests.find(t => t.catalogue_id === id)
const results = async id => Object.fromEntries((await get('/api/tests/' + (await testOf(id)).id)).latest.map(o => [o.display_name, o.result]))
const conn = {}
try {
 await scenario('Google Cloud and Azure are kept only after a real read that lists projects or subscriptions; credentials never appear', async () => {
  await app.signin()
  await owner('/api/connections', { provider: 'gcp', secret: JSON.stringify({ client_email: SA, private_key: pair().privateKey }) }, 400)
  await owner('/api/connections', { provider: 'azure', tenant_id: TENANT, client_id: CLIENT, secret: 'wrong' }, 400)
  conn.gcp = await owner('/api/connections', { provider: 'gcp', secret: gcpKey })
  conn.azure = await owner('/api/connections', { provider: 'azure', tenant_id: TENANT, client_id: CLIENT, secret: AZ_SECRET })
  assert.equal(conn.gcp.account, SA); assert.deepEqual(conn.gcp.scopes, g.projects); assert.equal(conn.azure.scopes.length, 2)
  const visible = JSON.stringify(await get('/api/connections')) + await (await app.fetch('/app/connections/' + conn.gcp.id)).text() + JSON.stringify((await app.db.prepare('SELECT * FROM product_audit').all()).results)
  assert.ok(!visible.includes('BEGIN PRIVATE KEY') && !visible.includes(AZ_SECRET))
  const enabled = (await get('/api/tests')).tests.map(t => t.catalogue_id).filter(Boolean)
  assert.ok(['gcp.bucket-public', 'gcp.firewall-admin-ports', 'azure.nsg-admin-ports', 'azure.storage-https'].every(id => enabled.includes(id))); assert.ok(!enabled.includes('gcp.mfa') && !enabled.includes('azure.encryption-at-rest'))
 })
 await scenario('Hourly reads cover every project and subscription class by class: misconfigurations fail with remediation, a denied class is a gap and unknown, a disabled API is noted', async () => {
  await app.tick()
  const gRun = (await get('/api/connections/' + conn.gcp.id)).runs[0], gCov = JSON.parse(gRun.coverage_json)
  assert.equal(gRun.outcome, 'partial'); assert.deepEqual(gCov.gaps.map(x => `${x.account} ${x.class}`), ['northstar-sandbox IAM policy and audit logging']); assert.match(gCov.notes.join(), /northstar-sandbox: Firewall rules API not enabled/)
  assert.deepEqual(await results('gcp.public-iam'), { 'Northstar prod (northstar-prod)': 'fail', 'Northstar sandbox (northstar-sandbox)': 'unknown' })
  assert.deepEqual(await results('gcp.bucket-public'), { 'prod-assets (northstar-prod)': 'fail', 'prod-logs (northstar-prod)': 'pass' })
  assert.deepEqual(Object.values(await results('gcp.sa-key-age')).sort(), ['fail', 'pass'])
  for (const id of ['gcp.sql-backups', 'gcp.sql-public', 'gcp.sql-ssl']) assert.deepEqual(await results(id), { 'prod-db (northstar-prod)': 'fail' }, id)
  assert.deepEqual(await results('gcp.firewall-admin-ports'), { 'allow-https (northstar-prod)': 'pass', 'allow-ssh (northstar-prod)': 'fail' })
  assert.equal((await get('/api/connections/' + conn.azure.id)).runs[0].outcome, 'complete')
  const subs = (name, id) => `${name} (${id})`, [prod, dev] = az.subs
  assert.deepEqual(await results('azure.activity-log'), { [subs('Development', dev[0])]: 'fail', [subs('Production', prod[0])]: 'pass' })
  assert.deepEqual(await results('azure.defender'), { [subs('Development', dev[0])]: 'fail', [subs('Production', prod[0])]: 'pass' })
  for (const id of ['azure.storage-public', 'azure.storage-https']) assert.deepEqual(Object.values(await results(id)), ['fail'], id)
  assert.deepEqual(Object.values(await results('azure.sql-public')), ['fail']); assert.deepEqual(Object.values(await results('azure.sql-backup-retention')), ['fail'])
  assert.deepEqual(Object.values(await results('azure.nsg-admin-ports')), ['fail'])
  for (const id of ['gcp.bucket-public', 'azure.storage-public']) { const t = await get('/api/tests/' + (await testOf(id)).id); assert.match(Object.values(t.entry.remediation)[0].terraform, /public/) }
 })
 await scenario('A source fix passes on the next read with history kept; a revoked read turns its resources unknown; a project no longer listed stays in the denominator', async () => {
  g.buckets['northstar-prod'][0].prevention = 'enforced'
  az.denied.add('Development:/providers/Microsoft.Network/networkSecurityGroups')
  g.projects = ['northstar-prod']
  await app.clock('2026-10-11T13:00:00Z'); await app.tick()
  assert.equal((await results('gcp.bucket-public'))['prod-assets (northstar-prod)'], 'pass')
  const fixed = (await get('/api/remediation')).resolved.find(o => o.resource_name === 'prod-assets (northstar-prod)')
  assert.deepEqual((await get('/api/remediation/' + fixed.id)).observations.map(o => o.result).slice(0, 2), ['pass', 'fail'])
  assert.deepEqual(Object.values(await results('azure.nsg-admin-ports')), ['unknown'])
  assert.equal((await get('/api/connections/' + conn.azure.id)).runs[0].outcome, 'partial')
  const gCov = JSON.parse((await get('/api/connections/' + conn.gcp.id)).runs[0].coverage_json)
  assert.deepEqual(gCov.accounts.map(a => [a.id, a.read]), [['northstar-prod', true], ['northstar-sandbox', false]])
  assert.equal((await results('gcp.public-iam'))['Northstar sandbox (northstar-sandbox)'], 'unknown')
 })
 await scenario('COLLECTION-001 / Azure schema drift and incomplete pages retain known resources as unknown; recovery never rewrites a gap, removes a denominator or fabricates exhibits', async () => {
  az.denied.clear()
  const base = '/subscriptions/' + az.subs[1][0] + '/providers/Microsoft.Network/networkSecurityGroups', route = base + '?api-version=2023-09-01'
  const path = '/api/connections/' + conn.azure.id
  let minute = 0
  const collect = async () => { await app.clock(new Date(Date.parse('2026-10-12T12:00:00Z') + minute++ * 60000).toISOString()); await owner(path + '/collect', {}, 201); return (await get(path)).runs[0] }
  const knownName = 'dev-nsg (' + az.subs[1][0] + ')'
  const baseline = await collect(); assert.equal(baseline.outcome, 'complete')
  const failures = []
  const rules = [{ properties: { direction: 'Inbound', access: 'Allow', sourceAddressPrefix: 'Internet', destinationPortRange: '22' } }]
  const group = securityRules => ({ name: 'dev-nsg', properties: { securityRules } })
  // ARM list envelopes are value arrays; none of these successful HTTP
  // responses proves an empty source or a safe network security group.
  for (const body of [null, {}, { value: {} }, { value: [null] }, { value: [{ name: 'dev-nsg' }] }, { value: [group('changed')] }, { value: [group([{ properties: { ...rules[0].properties, sourceAddressPrefix: 123 } }])] }, { value: [group([{ properties: { ...rules[0].properties, destinationPortRange: undefined } }])] }, { value: [group([{ properties: { ...rules[0].properties, direction: 'changed' } }])] }]) {
   az.responses.set(route, body)
   const run = await collect(); failures.push(run)
   assert.equal(run.outcome, 'partial')
   const gap = JSON.parse(run.coverage_json).gaps.find(g => g.account === az.subs[1][0] && g.class === 'Network security groups')
   assert.match(gap.reason, /schema drift/)
   assert.deepEqual(await results('azure.nsg-admin-ports'), { [knownName]: 'unknown' }, 'known identity survives malformed source')
  }
  for (const nextLink of ['https://outside.example.test/steal', 'not a URL', 42, 'https://management.azure.com' + route]) {
   az.responses.set(route, { value: [], nextLink })
   const before = az.calls.length, run = await collect(); failures.push(run)
   assert.equal(run.outcome, 'partial'); assert.match(run.coverage_json, /pagination incomplete|schema drift/)
   assert.ok(az.calls.length - before < 25, 'no repeated-page loop')
   assert.deepEqual(await results('azure.nsg-admin-ports'), { [knownName]: 'unknown' })
  }
  // Twenty distinct pages with an outstanding continuation are incomplete.
  az.responses.set(route, { value: [], nextLink: 'https://management.azure.com' + base + '?page=1' })
  for (let page = 1; page <= 20; page++) az.responses.set(base + '?page=' + page, { value: [], nextLink: 'https://management.azure.com' + base + '?page=' + (page + 1) })
  const limited = await collect(); failures.push(limited)
  assert.equal(limited.outcome, 'partial'); assert.match(limited.coverage_json, /page limit/)
  assert.ok(!az.calls.includes(base + '?page=20'), 'bounded collection stops at twenty pages')
  assert.deepEqual(await results('azure.nsg-admin-ports'), { [knownName]: 'unknown' })
  // A genuine second page is read and its failing resource is retained.
  az.responses.clear()
  az.responses.set(route, { value: [], nextLink: 'https://management.azure.com' + base + '?page=last' })
  az.responses.set(base + '?page=last', { value: [group(rules)] })
  const recovered = await collect(); assert.equal(recovered.outcome, 'complete')
  assert.deepEqual(await results('azure.nsg-admin-ports'), { [knownName]: 'fail' })
  // Explicit empty rules are safe; missing rules above were unknown.
  az.responses.set(base + '?page=last', { value: [group([])] })
  assert.equal((await collect()).outcome, 'complete')
  assert.deepEqual(await results('azure.nsg-admin-ports'), { [knownName]: 'pass' })
  // Subscription discovery cannot silently admit a partial scope list either.
  const subsRoute = '/subscriptions?api-version=2022-12-01'
  az.responses.set(subsRoute, { value: [{ subscriptionId: null }] })
  const malformedScope = await collect(); failures.push(malformedScope)
  assert.equal(malformedScope.outcome, 'failed'); assert.match(malformedScope.error_code, /schema drift: subscription identity/)
  az.responses.set(subsRoute, { value: az.subs.map(([subscriptionId]) => ({ subscriptionId })), nextLink: 'https://outside.example.test/subscriptions' })
  const lost = await collect(); failures.push(lost)
  assert.equal(lost.outcome, 'failed'); assert.match(lost.error_code, /pagination incomplete/)
  az.responses.clear()
  await collect()
  const history = (await get(path)).runs
  for (const run of failures) assert.deepEqual(history.find(r => r.id === run.id), run, 'recovery retains the exact original gap')
  assert.equal((await app.db.prepare('SELECT COUNT(*) AS n FROM receipts').first()).n, 0, 'no fabricated receipt')
  const connection = (await get(path)).connection
  await collectionScheduleBrowser(app, [connection], { suffix: '-azure-gaps', expected: ['Evidence gaps by run', 'Azure schema drift', 'Azure pagination incomplete'] })
 })
 await scenario('COLLECTION-001: hosted collector schedules through owner doors, Cron, browser and restore', () => collectionScheduleJourney(app))
 console.log(`${passed} Google Cloud and Azure public-door scenarios passed; the clouds are faked only at the network edge.`)
} finally { await app.close() }
