// Okta, Google Workspace, Microsoft Entra ID and JumpCloud directory
// connections, identity populations, tests and reviewable matches through the
// owner's doors and the Cron Trigger. The four directories are the only fakes:
// network-edge stand-ins answering their documented API shapes. Google's token
// endpoint verifies the service account's RS256 assertion with its public key.
process.env.RER_SERVER_JOURNEY = '1'
import assert from 'node:assert/strict'
import { generateKeyPairSync, randomBytes, verify as verifySignature } from 'node:crypto'
import { runtime } from './helpers/runtime.mjs'
const TENANT = '0e5f1c2a-1111-4222-8333-944455556666', CLIENT = '7a1b2c3d-1111-4222-8333-944455556666'
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } })
const secrets = { okta: randomBytes(20).toString('hex'), entra: randomBytes(24).toString('base64'), jumpcloud: randomBytes(20).toString('hex'), google: JSON.stringify({ client_email: 'evidence@service-account.test', private_key: privateKey }) }
const ago = days => new Date(Date.parse('2026-10-11T12:00:00Z') - days * 86400000).toISOString()
const dir = {
 okta: [{ id: 'o1', email: 'ana@northstar.test', first: 'Ana', status: 'ACTIVE', type: '', admin: true, mfa: true, last: ago(2) }, { id: 'o2', email: 'ben@northstar.test', first: 'Ben', status: 'ACTIVE', type: '', admin: false, mfa: false, last: ago(200) }, { id: 'o3', email: 'dana@contract.test', first: 'Dana', status: 'ACTIVE', type: 'Contractor', admin: false, mfa: true, last: ago(10) }, { id: 'o4', email: 'deploy@northstar.test', first: 'Deploy', status: 'ACTIVE', type: 'Service', admin: false, mfa: false, last: ago(1) }, { id: 'o5', email: 'old@northstar.test', first: 'Old', status: 'SUSPENDED', type: '', admin: false, mfa: false, last: ago(400) }],
 google: [{ id: 'g1', email: 'ana@northstar.test', name: 'Ana Ruiz', admin: true, mfa: true, last: ago(1), suspended: false }, { id: 'g2', email: 'cy@northstar.test', name: 'Cy Park', admin: false, mfa: false, last: '1970-01-01T00:00:00.000Z', created: ago(120), suspended: false }],
 entra: [{ id: 'e1', mail: 'ana@northstar.test', name: 'Ana Ruiz', enabled: true, type: 'Member', mfa: true, roles: ['Global Administrator'], last: ago(3) }, { id: 'e2', mail: 'partner@vendor.test', name: 'Partner', enabled: true, type: 'Guest', mfa: true, roles: ['User Administrator'], last: ago(4) }, { id: 'e3', mail: 'eve@northstar.test', name: 'Eve Moss', enabled: true, type: 'Member', mfa: false, roles: [], last: ago(5) }],
 jumpcloud: [{ _id: 'a'.repeat(24), email: 'frank@northstar.test', firstname: 'Frank', sudo: { enabled: true }, mfa: { configured: false }, state: 'ACTIVATED', activated: true }, { _id: 'b'.repeat(24), email: 'gina@northstar.test', firstname: 'Gina', sudo: { enabled: false }, mfa: { configured: true }, state: 'ACTIVATED', activated: true }],
 entraDenied: new Set(), calls: [],
}
const b64url = value => Buffer.from(value, 'base64url')
async function fakeDirectories(request) {
 const url = new URL(request.url), auth = request.headers.get('authorization') ?? ''
 if (url.hostname === 'northstar.okta.com') {
  dir.calls.push('okta ' + url.pathname)
  if (auth !== 'SSWS ' + secrets.okta) return Response.json({ errorCode: 'E0000011' }, { status: 401 })
  if (url.pathname === '/api/v1/org') return Response.json({ companyName: 'Northstar' })
  if (url.pathname === '/api/v1/users') { const after = Number(url.searchParams.get('after') ?? 0), page = dir.okta.slice(after, after + 3); return Response.json(page.map(u => ({ id: u.id, status: u.status, created: ago(500), lastLogin: u.last, profile: { firstName: u.first, lastName: '', email: u.email, login: u.email, userType: u.type } })), { headers: after + 3 < dir.okta.length ? { link: `<https://northstar.okta.com/api/v1/users?limit=200&after=${after + 3}>; rel="next"` } : {} }) }
  if (url.pathname === '/api/v1/iam/assignees/users') return Response.json({ value: dir.okta.filter(u => u.admin).map(u => ({ id: u.id })) })
  const factors = /^\/api\/v1\/users\/(\w+)\/factors$/.exec(url.pathname)
  if (factors) return Response.json(dir.okta.find(u => u.id === factors[1]).mfa ? [{ id: 'f1', factorType: 'token:software:totp', status: 'ACTIVE' }] : [])
 }
 if (url.hostname === 'oauth2.googleapis.com') {
  const form = new URLSearchParams(await request.text()), [header, claims, signature] = (form.get('assertion') ?? '').split('.')
  const body = JSON.parse(b64url(claims).toString())
  const valid = verifySignature('RSA-SHA256', Buffer.from(`${header}.${claims}`), publicKey, b64url(signature)) && body.iss === 'evidence@service-account.test' && body.sub === 'admin@northstar.test' && body.scope === 'https://www.googleapis.com/auth/admin.directory.user.readonly' && body.aud === 'https://oauth2.googleapis.com/token'
  return valid ? Response.json({ access_token: 'google-access', expires_in: 600 }) : Response.json({ error: 'invalid_grant' }, { status: 400 })
 }
 if (url.hostname === 'admin.googleapis.com') {
  if (auth !== 'Bearer google-access') return Response.json({}, { status: 401 })
  return Response.json({ users: dir.google.map(u => ({ id: u.id, primaryEmail: u.email, name: { fullName: u.name }, isAdmin: u.admin, isDelegatedAdmin: false, isEnrolledIn2Sv: u.mfa, suspended: u.suspended, archived: false, lastLoginTime: u.last, creationTime: u.created ?? ago(400) })) })
 }
 if (url.hostname === 'login.microsoftonline.com') {
  const form = new URLSearchParams(await request.text())
  return url.pathname === `/${TENANT}/oauth2/v2.0/token` && form.get('client_id') === CLIENT && form.get('client_secret') === secrets.entra && form.get('grant_type') === 'client_credentials' ? Response.json({ access_token: 'graph-access' }) : Response.json({ error: 'invalid_client' }, { status: 401 })
 }
 if (url.hostname === 'graph.microsoft.com') {
  dir.calls.push('graph ' + url.pathname + url.search)
  if (auth !== 'Bearer graph-access') return Response.json({}, { status: 401 })
  if (url.pathname === '/v1.0/organization') return Response.json({ value: [{ displayName: 'Northstar Inc.' }] })
  if (url.pathname === '/v1.0/users') { if (url.searchParams.get('$select').includes('signInActivity') && dir.entraDenied.has('signin')) return Response.json({ error: { code: 'Authorization_RequestDenied' } }, { status: 403 }); return Response.json({ value: dir.entra.map(u => ({ id: u.id, displayName: u.name, userPrincipalName: u.mail.replace('@', '_') + '#EXT#', mail: u.mail, accountEnabled: u.enabled, userType: u.type, createdDateTime: ago(300), ...(dir.entraDenied.has('signin') ? {} : { signInActivity: { lastSignInDateTime: u.last } }) })) }) }
  if (url.pathname === '/v1.0/reports/authenticationMethods/userRegistrationDetails') return dir.entraDenied.has('mfa') ? Response.json({ error: { code: 'Authentication_RequestFromNonPremiumTenantOrB2CTenant' } }, { status: 403 }) : Response.json({ value: dir.entra.map(u => ({ id: u.id, isMfaRegistered: u.mfa, isAdmin: u.roles.length > 0 })) })
  if (url.pathname === '/v1.0/directoryRoles') { const names = [...new Set(dir.entra.flatMap(u => u.roles))]; return Response.json({ value: names.map(n => ({ id: n, displayName: n, members: dir.entra.filter(u => u.roles.includes(n)).map(u => ({ id: u.id })) })) }) }
 }
 if (url.hostname === 'console.jumpcloud.com') {
  if (request.headers.get('x-api-key') !== secrets.jumpcloud) return Response.json({ message: 'Unauthorized' }, { status: 401 })
  const skip = Number(url.searchParams.get('skip') ?? 0), limit = Number(url.searchParams.get('limit'))
  return Response.json({ totalCount: dir.jumpcloud.length, results: dir.jumpcloud.slice(skip, skip + limit).map(u => ({ ...u, created: ago(100) })) })
 }
 return null
}
const app = await runtime({ outbound: fakeDirectories })
let passed = 0
const scenario = async (name, fn) => { await fn(); passed++; console.log('PASS ' + name) }
const owner = async (path, body, status = 201) => { const r = await app.fetch(path, { method: 'POST', headers: { origin: app.origin, 'content-type': 'application/json' }, body: JSON.stringify(body) }); const text = await r.text(); assert.equal(r.status, status, path + ' ' + text); return text ? JSON.parse(text) : null }
const get = async path => { const r = await app.fetch(path); assert.equal(r.status, 200, path); return r.json() }
const testOf = async id => (await get('/api/tests')).tests.find(t => t.catalogue_id === id)
const results = async id => Object.fromEntries((await get('/api/tests/' + (await testOf(id)).id)).latest.map(o => [o.display_name.replace(/ <.*/, ''), o.result]))
const conn = {}
try {
 await scenario('Okta, Google Workspace, Entra ID and JumpCloud are kept only after a real read; credentials stay sealed', async () => {
  await app.signin()
  await owner('/api/connections', { provider: 'okta', domain: 'northstar.okta.com', secret: 'wrong-token' }, 400)
  await owner('/api/connections', { provider: 'google', domain: 'northstar.test', admin_email: 'admin@northstar.test', secret: JSON.stringify({ client_email: 'evidence@service-account.test', private_key: generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } }).privateKey }) }, 400)
  await owner('/api/connections', { provider: 'entra', tenant_id: TENANT, client_id: CLIENT, secret: 'not-the-secret' }, 400)
  assert.equal((await app.db.prepare('SELECT COUNT(*) AS n FROM connections').first()).n, 0)
  conn.okta = await owner('/api/connections', { provider: 'okta', domain: 'northstar.okta.com', secret: secrets.okta })
  conn.google = await owner('/api/connections', { provider: 'google', domain: 'northstar.test', admin_email: 'admin@northstar.test', secret: secrets.google })
  conn.entra = await owner('/api/connections', { provider: 'entra', tenant_id: TENANT, client_id: CLIENT, secret: secrets.entra })
  conn.jumpcloud = await owner('/api/connections', { provider: 'jumpcloud', secret: secrets.jumpcloud })
  const visible = JSON.stringify(await get('/api/connections')) + (await Promise.all(Object.values(conn).map(async c => (await app.fetch('/app/connections/' + c.id)).text()))).join('') + JSON.stringify((await app.db.prepare('SELECT * FROM product_audit').all()).results)
  for (const s of [secrets.okta, secrets.entra, secrets.jumpcloud, 'BEGIN PRIVATE KEY']) assert.ok(!visible.includes(s), 'credential leaked')
  assert.ok((await get('/api/tests')).tests.some(t => t.catalogue_id === 'idp.admin-mfa'))
  assert.match((await get('/api/tests')).catalogue.find(e => e.id === 'jumpcloud.inactive').manualRequirement, /Directory Insights/)
 })
 await scenario('Hourly reads bring people, contractors, guests, service and suspended accounts as explicit populations, and fail MFA, admin MFA, guest admin and inactive accounts', async () => {
  await app.tick()
  for (const c of Object.values(conn)) assert.equal((await get('/api/connections/' + c.id)).runs[0].outcome, 'complete', c.id)
  const ids = await get('/api/identities')
  assert.deepEqual(ids.populations, { person: 8, contractor: 1, guest: 1, service: 1, suspended: 1 })
  assert.deepEqual(ids.duplicates, ['ana@northstar.test'])
  const mfa = await results('idp.mfa')
  assert.equal(mfa['Ben'], 'fail'); assert.equal(mfa['Deploy'], 'fail'); assert.equal(mfa['Cy Park'], 'fail'); assert.equal(mfa['Eve Moss'], 'fail'); assert.equal(mfa['Frank'], 'fail'); assert.equal(mfa['Old'], 'pass'); assert.equal(mfa['Gina'], 'pass')
  const admins = await results('idp.admin-mfa')
  assert.equal(admins['Frank'], 'fail'); assert.equal(admins['Ana Ruiz'], 'pass'); assert.equal(admins['Ben'], 'pass')
  assert.equal((await results('idp.guest-admin'))['Partner'], 'fail')
  const inactive = await results('idp.inactive')
  assert.equal(inactive['Ben'], 'fail'); assert.equal(inactive['Cy Park'], 'fail'); assert.equal(inactive['Ana'], 'pass'); assert.equal(inactive['Frank'], 'unknown')
  assert.ok((await get('/api/remediation')).open.some(o => o.resource_name.startsWith('Partner')))
 })
 await scenario('Matches are proposed by email and decided by a person; a duplicate is reconciled by human decisions, and a disabled account and a denied scope stay visible', async () => {
  const ana = await owner('/api/people', { name: 'Ana Ruiz', email: 'ana@northstar.test', kind: 'employee' }), dana = await owner('/api/people', { name: 'Dana Fox', email: 'dana@northstar.test', kind: 'contractor' })
  await app.clock('2026-10-11T13:00:00Z'); await app.tick()
  let ids = await get('/api/identities')
  const anas = ids.accounts.filter(a => a.email === 'ana@northstar.test')
  assert.equal(anas.length, 3); assert.ok(anas.every(a => a.match?.state === 'proposed' && a.match.person_id === ana.id))
  assert.equal(ids.accounts.find(a => a.email === 'dana@contract.test').match, null)
  await owner(`/api/identities/${anas[0].id}/match`, { decision: 'approved' }, 200)
  await owner(`/api/identities/${anas[1].id}/match`, { decision: 'rejected', reason: 'Shared admin mailbox' }, 200)
  await owner(`/api/identities/${ids.accounts.find(a => a.email === 'dana@contract.test').id}/match`, { decision: 'approved', person_id: dana.id }, 200)
  ids = await get('/api/identities')
  assert.deepEqual(ids.accounts.filter(a => a.email === 'ana@northstar.test').map(a => a.match.state).sort(), ['approved', 'proposed', 'rejected'])
  assert.equal(ids.accounts.find(a => a.email === 'dana@contract.test').match.basis, 'owner choice')
  dir.okta.find(u => u.id === 'o2').status = 'SUSPENDED'
  dir.entraDenied.add('mfa')
  await app.clock('2026-10-11T14:00:00Z'); await app.tick()
  ids = await get('/api/identities')
  assert.equal(ids.accounts.find(a => a.email === 'ben@northstar.test').status, 'suspended')
  assert.equal((await results('idp.mfa'))['Ben'], 'pass')
  const entraRun = (await get('/api/connections/' + conn.entra.id)).runs[0]
  assert.equal(entraRun.outcome, 'partial'); assert.match(entraRun.coverage_json, /MFA registration not readable/)
  assert.equal((await results('idp.mfa'))['Eve Moss'], 'unknown')
  assert.equal(ids.accounts.filter(a => a.match?.state === 'approved').length, 2)
  const exported = Buffer.from(await (await app.fetch('/api/archive/export')).arrayBuffer())
  const target = await runtime(); await target.signin()
  assert.equal((await target.fetch('/api/archive/restore', { method: 'POST', headers: { origin: target.origin, 'content-type': 'application/octet-stream', 'x-evidence-confirm': 'restore' }, body: exported })).status, 200)
  assert.deepEqual((await target.db.prepare('SELECT * FROM identity_matches ORDER BY rowid').all()).results, (await app.db.prepare('SELECT * FROM identity_matches ORDER BY rowid').all()).results)
  assert.deepEqual([...new Set((await target.db.prepare('SELECT status,secret_ciphertext FROM connections').all()).results.map(r => JSON.stringify(r)))], [JSON.stringify({ status: 'inactive after restore', secret_ciphertext: null })])
  await target.close()
 })
 console.log(`${passed} identity public-door scenarios passed; the four directories are faked only at the network edge.`)
} finally { await app.close() }
