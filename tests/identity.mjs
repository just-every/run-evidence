// Okta, Google Workspace, Microsoft Entra ID and JumpCloud directory
// connections, identity populations, tests and reviewable matches through the
// owner's doors and the Cron Trigger. The four directories are the only fakes:
// network-edge stand-ins answering their documented API shapes. Google's token
// endpoint verifies the service account's RS256 assertion with its public key.
process.env.RER_SERVER_JOURNEY = '1'
import assert from 'node:assert/strict'
import { generateKeyPairSync, randomBytes, verify as verifySignature } from 'node:crypto'
import { runtime } from './helpers/runtime.mjs'
import { collectionScheduleBrowser } from './helpers/collection-schedule-browser.mjs'
import { collectionScheduleJourney } from './helpers/collection-schedule-journey.mjs'
const TENANT = '0e5f1c2a-1111-4222-8333-944455556666', CLIENT = '7a1b2c3d-1111-4222-8333-944455556666'
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } })
const secrets = { okta: randomBytes(20).toString('hex'), entra: randomBytes(24).toString('base64'), jumpcloud: randomBytes(20).toString('hex'), google: JSON.stringify({ client_email: 'evidence@service-account.test', private_key: privateKey }) }
const ago = days => new Date(Date.parse('2026-10-11T12:00:00Z') - days * 86400000).toISOString()
const dir = {
 okta: [{ id: 'o1', email: 'ana@northstar.test', first: 'Ana', status: 'ACTIVE', type: '', admin: true, mfa: true, last: ago(2) }, { id: 'o2', email: 'ben@northstar.test', first: 'Ben', status: 'ACTIVE', type: '', admin: false, mfa: false, last: ago(200) }, { id: 'o3', email: 'dana@contract.test', first: 'Dana', status: 'ACTIVE', type: 'Contractor', admin: false, mfa: true, last: ago(10) }, { id: 'o4', email: 'deploy@northstar.test', first: 'Deploy', status: 'ACTIVE', type: 'Service', admin: false, mfa: false, last: ago(1) }, { id: 'o5', email: 'old@northstar.test', first: 'Old', status: 'SUSPENDED', type: '', admin: false, mfa: false, last: ago(400) }],
 google: [{ id: 'g1', email: 'ana@northstar.test', name: 'Ana Ruiz', admin: true, mfa: true, last: ago(1), suspended: false }, { id: 'g2', email: 'cy@northstar.test', name: 'Cy Park', admin: false, mfa: false, last: '1970-01-01T00:00:00.000Z', created: ago(120), suspended: false }],
 entra: [{ id: 'e1', mail: 'ana@northstar.test', name: 'Ana Ruiz', enabled: true, type: 'Member', mfa: true, roles: ['Global Administrator'], last: ago(3) }, { id: 'e2', mail: 'partner@vendor.test', name: 'Partner', enabled: true, type: 'Guest', mfa: true, roles: ['User Administrator'], last: ago(4) }, { id: 'e3', mail: 'eve@northstar.test', name: 'Eve Moss', enabled: true, type: 'Member', mfa: false, roles: [], last: ago(5) }],
 jumpcloud: [{ _id: 'a'.repeat(24), email: 'frank@northstar.test', firstname: 'Frank', sudo: { enabled: true }, mfa: { configured: false }, state: 'ACTIVATED', activated: true }, { _id: 'b'.repeat(24), email: 'gina@northstar.test', firstname: 'Gina', sudo: { enabled: false }, mfa: { configured: true }, state: 'ACTIVATED', activated: true }],
 entraDenied: new Set(), groupsDenied: new Set(), calls: [], overrides: new Map(),
}
const b64url = value => Buffer.from(value, 'base64url')
async function fakeDirectories(request) {
 const url = new URL(request.url), auth = request.headers.get('authorization') ?? ''
 const override = dir.overrides.get(url.href)
 if (override) return Response.json(override.body, { headers: override.headers ?? {} })
 if (url.hostname === 'northstar.okta.com') {
  dir.calls.push('okta ' + url.pathname)
  if (auth !== 'SSWS ' + secrets.okta) return Response.json({ errorCode: 'E0000011' }, { status: 401 })
  if (url.pathname === '/api/v1/org') return Response.json({ companyName: 'Northstar' })
  if (url.pathname === '/api/v1/users') { const after = Number(url.searchParams.get('after') ?? 0), page = dir.okta.slice(after, after + 3); return Response.json(page.map(u => ({ id: u.id, status: u.status, created: ago(500), lastLogin: u.last, profile: { firstName: u.first, lastName: '', email: u.email, login: u.email, userType: u.type } })), { headers: after + 3 < dir.okta.length ? { link: `<https://northstar.okta.com/api/v1/users?limit=200&after=${after + 3}>; rel="next"` } : {} }) }
  if (url.pathname === '/api/v1/iam/assignees/users') return Response.json({ value: dir.okta.filter(u => u.admin).map(u => ({ id: u.id })) })
  const groups = /^\/api\/v1\/users\/(\w+)\/groups$/.exec(url.pathname)
  if (groups) return dir.groupsDenied.has('okta') ? Response.json({ errorCode: 'E0000006' }, { status: 403 }) : Response.json(dir.okta.find(u => u.id === groups[1]).admin ? [{ id: 'g1', profile: { name: 'Everyone' } }, { id: 'g2', profile: { name: 'Security admins' } }] : [{ id: 'g1', profile: { name: 'Everyone' } }])
  const factors = /^\/api\/v1\/users\/(\w+)\/factors$/.exec(url.pathname)
  if (factors) return Response.json(dir.okta.find(u => u.id === factors[1]).mfa ? [{ id: 'f1', factorType: 'token:software:totp', status: 'ACTIVE' }] : [])
 }
 if (url.hostname === 'oauth2.googleapis.com') {
  const form = new URLSearchParams(await request.text()), [header, claims, signature] = (form.get('assertion') ?? '').split('.')
  const body = JSON.parse(b64url(claims).toString())
  const valid = verifySignature('RSA-SHA256', Buffer.from(`${header}.${claims}`), publicKey, b64url(signature)) && body.iss === 'evidence@service-account.test' && body.sub === 'admin@northstar.test' && body.scope === 'https://www.googleapis.com/auth/admin.directory.user.readonly https://www.googleapis.com/auth/admin.directory.group.readonly' && body.aud === 'https://oauth2.googleapis.com/token'
  return valid ? Response.json({ access_token: 'google-access', expires_in: 600 }) : Response.json({ error: 'invalid_grant' }, { status: 400 })
 }
 if (url.hostname === 'admin.googleapis.com') {
  if (auth !== 'Bearer google-access') return Response.json({}, { status: 401 })
  if (url.pathname === '/admin/directory/v1/groups') return Response.json({ groups: url.searchParams.get('userKey') === 'ana@northstar.test' ? [{ email: 'admins@northstar.test', name: 'Workspace admins' }] : [] })
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
  const memberOf = /^\/v1\.0\/users\/(\w+)\/memberOf\/microsoft\.graph\.group$/.exec(url.pathname)
  if (memberOf) return dir.groupsDenied.has('entra') ? Response.json({ error: { code: 'Authorization_RequestDenied' } }, { status: 403 }) : Response.json({ value: memberOf[1] === 'e2' ? [{ displayName: 'Vendor partners' }] : [{ displayName: 'All staff' }] })
  if (url.pathname === '/v1.0/directoryRoles') { const names = [...new Set(dir.entra.flatMap(u => u.roles))]; return Response.json({ value: names.map(n => ({ id: n, displayName: n, members: dir.entra.filter(u => u.roles.includes(n)).map(u => ({ id: u.id })) })) }) }
 }
 if (url.hostname === 'console.jumpcloud.com') {
  if (request.headers.get('x-api-key') !== secrets.jumpcloud) return Response.json({ message: 'Unauthorized' }, { status: 401 })
  if (url.pathname === '/api/v2/usergroups') return Response.json([{ id: 'ug1', name: 'Engineering' }])
  if (/^\/api\/v2\/users\/\w+\/memberof$/.test(url.pathname)) return Response.json([{ id: 'ug1', type: 'user_group' }])
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
  const groupsOf = (source, email) => ids.accounts.find(a => a.source.startsWith(source) && a.email === email).groups
  assert.equal(groupsOf('Okta', 'ana@northstar.test'), 'Everyone, Security admins'); assert.equal(groupsOf('Google', 'ana@northstar.test'), 'Workspace admins'); assert.equal(groupsOf('Microsoft', 'partner@vendor.test'), 'Vendor partners'); assert.equal(groupsOf('JumpCloud', 'frank@northstar.test'), 'Engineering')
  const mfa = await results('idp.mfa')
  assert.equal(mfa['Ben'], 'fail'); assert.equal(mfa['Deploy'], 'fail'); assert.equal(mfa['Cy Park'], 'fail'); assert.equal(mfa['Eve Moss'], 'fail'); assert.equal(mfa['Frank'], 'fail'); assert.equal(mfa['Old'], 'pass'); assert.equal(mfa['Gina'], 'pass')
  const admins = await results('idp.admin-mfa')
  assert.equal(admins['Frank'], 'fail'); assert.equal(admins['Ana Ruiz'], 'pass'); assert.equal(admins['Ben'], 'pass')
  assert.equal((await results('idp.guest-admin'))['Partner'], 'fail')
  const inactive = await results('idp.inactive')
  assert.equal(inactive['Ben'], 'fail'); assert.equal(inactive['Cy Park'], 'fail'); assert.equal(inactive['Ana'], 'pass'); assert.equal(inactive['Frank'], 'unknown')
  assert.ok((await get('/api/remediation')).open.some(o => o.resource_name.startsWith('Partner')))
 })
 await scenario('INVENTORY-001 / PORTABLE-001 / IDENTITY-001: Matches are proposed by email and decided by a person; a duplicate is reconciled by human decisions, and a disabled account and a denied scope stay visible', async () => {
  const ana = await owner('/api/people', { name: 'Ana Ruiz', email: 'ana@northstar.test', kind: 'employee' }), dana = await owner('/api/people', { name: 'Dana Fox', email: 'dana@northstar.test', kind: 'contractor' })
  const sameName=await owner('/api/people',{name:'Ana Ruiz',email:'ana-unmatched@northstar.test',kind:'employee'})
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
  const inventory=await get('/api/inventory')
  assert.equal(inventory.people.find(p=>p.id===ana.id).directory.length,1)
  assert.deepEqual(inventory.people.find(p=>p.id===sameName.id).directory,[],'same-named People never borrow another person’s directory match')
  assert.equal(inventory.people.find(p=>p.id===sameName.id).account_status,'no account found')

  dir.okta.find(u => u.id === 'o2').status = 'SUSPENDED'
  dir.entraDenied.add('mfa'); dir.groupsDenied.add('okta')
  await app.clock('2026-10-11T14:00:00Z'); await app.tick()
  ids = await get('/api/identities')
  assert.equal(ids.accounts.find(a => a.email === 'ben@northstar.test').status, 'suspended')
  assert.equal(ids.accounts.find(a => a.source.startsWith('Okta') && a.email === 'ana@northstar.test').groups, null)
  assert.match((await get('/api/connections/' + conn.okta.id)).runs[0].coverage_json, /group membership not readable/)
  assert.equal((await results('idp.mfa'))['Ben'], 'pass')
  const entraRun = (await get('/api/connections/' + conn.entra.id)).runs[0]
  assert.equal(entraRun.outcome, 'partial'); assert.match(entraRun.coverage_json, /MFA registration not readable/)
  assert.equal((await results('idp.mfa'))['Eve Moss'], 'unknown')
  assert.equal(ids.accounts.filter(a => a.match?.state === 'approved').length, 2)
  const exported = Buffer.from(await (await app.fetch('/api/archive/export')).arrayBuffer())
  const target = await runtime(); await target.signin()
  assert.equal((await target.fetch('/api/archive/restore', { method: 'POST', headers: { origin: target.origin, 'content-type': 'application/octet-stream', 'x-evidence-confirm': 'restore', 'x-evidence-erasure-history':'unverified acknowledged' }, body: exported })).status, 200)
  assert.deepEqual((await target.db.prepare('SELECT * FROM identity_matches ORDER BY rowid').all()).results, (await app.db.prepare('SELECT * FROM identity_matches ORDER BY rowid').all()).results)
  assert.deepEqual([...new Set((await target.db.prepare('SELECT status,secret_ciphertext FROM connections').all()).results.map(r => JSON.stringify(r)))], [JSON.stringify({ status: 'inactive after restore', secret_ciphertext: null })])
  await target.close()
 })
 await scenario('COLLECTION-001: all four directories refuse malformed security facts and incomplete pages without losing known identities; fresh recovery preserves failures and custody', async () => {
  dir.entraDenied.clear(); dir.groupsDenied.clear()
  let time = Date.parse((await get('/api/connections/' + conn.okta.id)).runs[0].started_at)
  const advance = async () => { time += 60000; await app.clock(new Date(time).toISOString()) }
  const send = async provider => { await advance(); await owner('/api/connections/' + conn[provider].id + '/collect', {}); return (await get('/api/connections/' + conn[provider].id)).runs[0] }
  for (const provider of Object.keys(conn)) await send(provider)
  const fixtures = [
   ['okta','https://northstar.okta.com/api/v1/users?limit=200', 'users', body => null],
   ['okta','https://northstar.okta.com/api/v1/users?limit=200', 'users', body => body.map((u,i) => i ? u : { ...u, status: undefined })],
   ['okta','https://northstar.okta.com/api/v1/users?limit=200', 'users', body => body.map((u,i) => i ? u : { ...u, lastLogin: 'not a timestamp' })],
   ['okta','https://northstar.okta.com/api/v1/users/o1/factors', 'factor status', body => [{ status: true }]],
   ['okta','https://northstar.okta.com/api/v1/iam/assignees/users?limit=200', 'admin assignments', body => ({ value: [{ id: null }] })],
   ['google','https://admin.googleapis.com/admin/directory/v1/users?customer=my_customer&maxResults=500&projection=basic', 'security flags', body => ({ ...body, users: body.users.map((u,i) => i ? u : { ...u, suspended: 'false' }) })],
   ['google','https://admin.googleapis.com/admin/directory/v1/users?customer=my_customer&maxResults=500&projection=basic', 'nextPageToken', body => ({ ...body, nextPageToken: 42 })],
   ['google','https://admin.googleapis.com/admin/directory/v1/groups?userKey=ana%40northstar.test&maxResults=200', 'groups', body => ({ groups: 'admins' })],
   ['entra','https://graph.microsoft.com/v1.0/users?$select=id,displayName,userPrincipalName,mail,accountEnabled,userType,employeeType,createdDateTime,signInActivity&$top=999', 'lifecycle', body => ({ value: body.value.map((u,i) => i ? u : { ...u, accountEnabled: undefined }) })],
   ['entra','https://graph.microsoft.com/v1.0/reports/authenticationMethods/userRegistrationDetails?$top=999', 'MFA registration', body => ({ value: [{ id: 'e1', isMfaRegistered: 'true' }] })],
   ['entra','https://graph.microsoft.com/v1.0/directoryRoles?$expand=members($select=id)', 'role members', body => ({ value: [{ displayName: 'Global Administrator', members: [{ id: null }] }] })],
   ['jumpcloud','https://console.jumpcloud.com/api/systemusers?limit=100&skip=0', 'system users', body => ({ ...body, totalCount: '2' })],
   ['jumpcloud','https://console.jumpcloud.com/api/systemusers?limit=100&skip=0', 'security flags', body => ({ ...body, results: body.results.map((u,i) => i ? u : { ...u, sudo: { enabled: 'false' } }) })],
   ['jumpcloud','https://console.jumpcloud.com/api/v2/usergroups?limit=100', 'group identity', body => [{ id: null, name: 'Engineering' }]],
  ]
  const failures = new Map(Object.keys(conn).map(provider => [provider, []]))
  const mfa = (await get('/api/tests')).tests.find(t => t.catalogue_id === 'idp.mfa').id
  const sourceLabels = { okta: 'Okta ', google: 'Google Workspace ', entra: 'Microsoft Entra ID ', jumpcloud: 'JumpCloud ' }
  const observations = async provider => (await get('/api/tests/' + mfa)).latest.filter(o => o.source_label.startsWith(sourceLabels[provider]))
  for (const [provider, raw, field, change] of fixtures) {
   const url = new URL(raw).href
   const headers = provider === 'okta' ? { authorization: 'SSWS ' + secrets.okta } : provider === 'google' ? { authorization: 'Bearer google-access' } : provider === 'entra' ? { authorization: 'Bearer graph-access' } : { 'x-api-key': secrets.jumpcloud }
   const fixture = await (await fakeDirectories(new Request(url, { headers }))).json()
   const before = await observations(provider); assert.ok(before.length)
   dir.overrides.set(url, { body: change(fixture) })
   const failed = await send(provider); failures.get(provider).push(failed)
   assert.equal(failed.outcome, 'failed'); assert.match(failed.error_code, /schema drift/); assert.ok(failed.error_code.includes(field), failed.error_code)
   const after = await observations(provider)
   assert.deepEqual(after.map(o => o.resource_id).sort(), before.map(o => o.resource_id).sort())
   assert.ok(after.every(o => o.result === 'unknown'), 'malformed source never leaves a false pass or removes an identity')
   dir.overrides.clear(); await send(provider)
   assert.deepEqual((await observations(provider)).map(o => o.result), before.map(o => o.result))
  }
  const url = new URL('https://northstar.okta.com/api/v1/users?limit=200').href
  const fixture = await (await fakeDirectories(new Request(url, { headers: { authorization: 'SSWS ' + secrets.okta } }))).json()
  for (const next of [url, 'https://outside.example.test/steal']) {
   dir.overrides.set(url, { body: fixture, headers: { link: '<' + next + '>; rel="next"' } })
   const run = await send('okta'); failures.get('okta').push(run)
   assert.equal(run.outcome, 'failed'); assert.match(run.error_code, /pagination incomplete/)
   assert.ok((await observations('okta')).every(o => o.result === 'unknown'))
   dir.overrides.clear(); await send('okta')
  }
  // A source may declare another membership page; never admit its first page as complete.
  const group = new URL('https://admin.googleapis.com/admin/directory/v1/groups?userKey=ana%40northstar.test&maxResults=200').href
  dir.overrides.set(group, { body: { groups: [], nextPageToken: 'unread-membership-page' } })
  const incomplete = await send('google'); failures.get('google').push(incomplete)
  assert.equal(incomplete.outcome, 'failed'); assert.match(incomplete.error_code, /pagination incomplete/)
  dir.overrides.clear(); await send('google')
  const source = new Map()
  for (const provider of Object.keys(conn)) { const runs = (await get('/api/connections/' + conn[provider].id)).runs; source.set(provider,runs); for (const row of failures.get(provider)) assert.deepEqual(runs.find(r => r.id === row.id),row) }
  const target = await runtime()
  try {
   await target.signin()
   const restored = await target.fetch('/api/archive/restore', { method: 'POST', headers: { origin: target.origin, 'content-type': 'application/octet-stream', 'x-evidence-confirm': 'restore', 'x-evidence-erasure-history':'unverified acknowledged' }, body: await (await app.fetch('/api/archive/export')).arrayBuffer() })
   assert.equal(restored.status,200,await restored.clone().text())
   for (const provider of Object.keys(conn)) assert.deepEqual((await (await target.fetch('/api/connections/' + conn[provider].id)).json()).runs,source.get(provider))
  } finally { await target.close() }
  await collectionScheduleBrowser(app, await Promise.all(Object.keys(conn).map(async provider => (await get('/api/connections/' + conn[provider].id)).connection)), { suffix: '-directory-schema', expected: ['schema drift'] })
 })
 await scenario('COLLECTION-001: hosted collector schedules through owner doors, Cron, browser and restore', () => collectionScheduleJourney(app))
 console.log(`${passed} identity public-door scenarios passed; the four directories are faked only at the network edge.`)
} finally { await app.close() }
