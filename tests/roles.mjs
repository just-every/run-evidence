// AUTH-001 through the production HTTP handler: delegated roles, scope,
// separation of duties, session revocation, SCIM provisioning and single sign-on
// through a provider fake that stands only at the network edge.
import assert from 'node:assert/strict'
import { createHash, generateKeyPairSync } from 'node:crypto'
import { runtime } from './helpers/runtime.mjs'
import { fakeProvider } from './helpers/idp-fixture.mjs'
const oktaKeys = generateKeyPairSync('rsa', { modulusLength: 2048 }), oktaPrivate = { ...oktaKeys.privateKey.export({ format: 'jwk' }), kid: 'synthetic-evidence-client-key', alg: 'RS256' }
const idp = fakeProvider({ clientPublicJwk: oktaKeys.publicKey.export({ format: 'jwk' }) })
// Google and Microsoft Entra ID keep their endpoints where the real providers do; each is faked at the network edge only.
const google = fakeProvider({ issuer: 'https://accounts.google.com', clientId: 'synthetic-evidence-google-client', clientSecret: 'synthetic-evidence-google-secret', paths: { authorization: 'https://accounts.google.com/o/oauth2/v2/auth', token: 'https://oauth2.googleapis.com/token', jwks: 'https://www.googleapis.com/oauth2/v3/certs' } })
const entra = fakeProvider({ issuer: 'https://login.microsoftonline.com/synthetic-tenant/v2.0', clientId: 'synthetic-evidence-entra-client', clientSecret: 'synthetic-evidence-entra-secret', paths: { authorization: 'https://login.microsoftonline.com/synthetic-tenant/oauth2/v2.0/authorize', token: 'https://login.microsoftonline.com/synthetic-tenant/oauth2/v2.0/token', jwks: 'https://login.microsoftonline.com/synthetic-tenant/discovery/v2.0/keys' } })
const providers = { okta: idp, google, microsoft: entra }
const app = await runtime({ outbound: async request => { for (const p of Object.values(providers)) { const answer = await p.outbound(request); if (answer) return answer } return null }, settings: { SSO_GOOGLE_CLIENT_ID: google.clientId, SSO_GOOGLE_CLIENT_SECRET: 'synthetic-evidence-google-secret', SSO_MICROSOFT_TENANT: 'synthetic-tenant', SSO_MICROSOFT_CLIENT_ID: entra.clientId, SSO_MICROSOFT_CLIENT_SECRET: 'synthetic-evidence-entra-secret', SSO_OKTA_ISSUER: idp.issuer, SSO_OKTA_CLIENT_ID: idp.clientId, SSO_OKTA_PRIVATE_KEY: JSON.stringify(oktaPrivate), OIDC_TRANSACTION_SECRET: 'synthetic-evidence-transaction-secret-0123456789' } })
let passed = 0
const scenario = async (name, run) => { await run(); passed++; console.log('PASS ' + name) }
const json = { 'content-type': 'application/json' }
const as = cookie => ({ cookie, origin: app.origin })
const call = (cookie, path, body, headers = {}) => app.fetch(path, body === undefined ? { headers: { cookie, ...headers } } : { method: 'POST', headers: { ...as(cookie), ...json, ...headers }, body: JSON.stringify(body) })
const cookieOf = response => response.headers.getSetCookie().map(x => x.split(';')[0]).join('; ')
let owner
const signinAs = async (email, name) => {
 const sent = app.messages.length
 assert.equal((await call(owner, '/api/roles/invitations', { email, display_name: name })).status, 202)
 assert.equal(app.messages.length, sent + 1)
 const link = new URL(app.messages.at(-1).html.match(/href="([^"]*\/auth\/confirm\?token=[^"]+)"/)[1].replaceAll('&amp;', '&'), app.origin)
 const confirmed = await app.fetch('/auth/confirm', { method: 'POST', headers: { cookie: '', origin: app.origin, ...json }, body: JSON.stringify({ token: link.searchParams.get('token') }) })
 assert.equal(confirmed.status, 303)
 return cookieOf(confirmed)
}
const grant = (body, cookie = owner) => call(cookie, '/api/roles/grants', body)
const form = (fields, file) => { const f = new FormData(); for (const [k, v] of Object.entries(fields)) f.set(k, v); if (file) f.set('file', new File([file], 'proof.txt', { type: 'text/plain' })); return f }
const upload = (cookie, requirement) => app.fetch(`/app/requirements/${requirement}/uploads`, { method: 'POST', headers: as(cookie), body: form({ source: 'Observed manually', covered_from: '2026-10-11', covered_to: '2026-10-11' }, 'Real retained evidence bytes') })
const control = async name => {
 const made = await app.fetch('/app/controls', { method: 'POST', headers: { ...as(owner), 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ name, proof: 'Screenshot', group: 'Access', cadence: 'monthly' }) })
 assert.equal(made.status, 303)
 const row = (await (await call(owner, '/api/desk')).json()).requirements.find(r => made.headers.get('location').endsWith(r.id))
 return { requirement: row.id, control: row.control_id }
}
try {
 owner = await app.signin()
 const mine = await control('Quarterly access review'), foreign = await control('Vendor offboarding')
 await scenario('A member with no role reaches no owner door, and every delegated role opens only the doors it names', async () => {
  const stranger = await signinAs('stranger@example.test', 'Stranger')
  for (const path of ['/api/programs', '/api/desk', '/api/roles', '/api/connections']) assert.equal((await call(stranger, path)).status, 403, path)
  const manager = await signinAs('manager@example.test', 'Maya Manager'), admin = await signinAs('admin@example.test', 'Alex Admin')
  assert.equal((await grant({ email: 'stranger@example.test', role: 'compliance_manager', scope_kind: 'business', reason: 'x' }, stranger)).status, 403)
  assert.equal((await grant({ email: 'manager@example.test', role: 'compliance_manager', scope_kind: 'business', reason: 'Runs the program' })).status, 201)
  assert.equal((await grant({ email: 'admin@example.test', role: 'administrator', scope_kind: 'business', reason: 'Delegated administration' })).status, 201)
  assert.equal((await grant({ email: 'manager@example.test', role: 'compliance_manager', scope_kind: 'business', reason: 'again' })).status, 409)
  assert.equal((await grant({ email: 'nobody@example.test', role: 'compliance_manager', scope_kind: 'business', reason: 'x' })).status, 409, 'an account must exist first')
  // The manager runs program work but never custody, connections, tokens, roles or exports.
  assert.equal((await call(manager, '/api/policies')).status, 200)
  // Connections and tracker writes stay with the owner session; a delegate and an agent token never write there.
  for (const path of ['/api/connections', '/app/trackers', '/api/trackers']) assert.equal((await call(manager, path)).status, 403, path)
  assert.equal((await call(manager, '/api/roles')).status, 403)
  assert.equal((await call(manager, '/api/risks/export')).status, 403)
  assert.equal((await call(manager, '/app/archive')).status, 403)
  assert.equal((await call(manager, '/api/roles/grants', { email: 'stranger@example.test', role: 'contributor', scope_kind: 'business', reason: 'x' })).status, 403)
  // Personnel records, findings and connector data stay private until the owner names the area.
  for (const path of ['/api/people', '/api/vulnerabilities', '/api/identities']) assert.equal((await call(manager, path)).status, 403, path)
  assert.equal((await grant({ email: 'manager@example.test', role: 'compliance_manager', scope_kind: 'area', scope_ref: 'personnel', reason: 'Handles departures' }, admin)).status, 403, 'only the owner opens a restricted area')
  assert.equal((await grant({ email: 'manager@example.test', role: 'compliance_manager', scope_kind: 'area', scope_ref: 'payroll', reason: 'x' })).status, 400)
  assert.equal((await grant({ email: 'manager@example.test', role: 'compliance_manager', scope_kind: 'area', scope_ref: 'personnel', reason: 'Handles departures' })).status, 201)
  assert.equal((await call(manager, '/api/people')).status, 200); assert.equal((await call(manager, '/api/vulnerabilities')).status, 403)
  // An administrator delegates, but never grants administrator or a role to themselves.
  assert.equal((await call(admin, '/api/roles')).status, 200)
  assert.equal((await grant({ email: 'stranger@example.test', role: 'administrator', scope_kind: 'business', reason: 'x' }, admin)).status, 403)
  assert.equal((await grant({ email: 'admin@example.test', role: 'risk_approver', scope_kind: 'business', reason: 'x' }, admin)).status, 403)
  assert.equal((await call(admin, '/api/roles/scim-tokens', { name: 'x', provider: 'okta' })).status, 403)
  assert.equal((await call(admin, '/api/roles/mfa', { require_mfa: 'yes' })).status, 403)
  // Cross-origin writes are refused for every role.
  assert.equal((await app.fetch('/api/roles/grants', { method: 'POST', headers: { cookie: admin, origin: 'https://foreign.test', ...json }, body: '{}' })).status, 403)
  globalThis.sessions = { manager, admin }
 })
 await scenario('Nobody approves their own work, and a risk approver decides risks only', async () => {
  const { manager, admin } = globalThis.sessions
  const approver = await signinAs('approver@example.test', 'Rita Approver')
  assert.equal((await grant({ email: 'approver@example.test', role: 'risk_approver', scope_kind: 'business', reason: 'Accepts residual risk' })).status, 201)
  const person = await (await call(owner, '/api/people', { name: 'Maya Manager', email: 'manager@example.test', kind: 'employee' })).json()
  const draft = await (await call(manager, '/api/policies', { title: 'Access control policy', body: 'Access is reviewed every quarter.' })).json()
  const revision = draft.revision ?? draft.revision_id ?? draft.id
  assert.ok(revision, 'policy draft created by the manager')
  const decision = `/api/policies/${draft.policy ?? draft.policy_id}/revisions/${revision}/decision`
  const digest = createHash('sha256').update('Access is reviewed every quarter.').digest('hex')
  assert.equal((await call(manager, decision, { decision: 'approved', body_sha256: digest })).status, 403, 'the drafter cannot approve their own draft')
  assert.equal((await call(approver, decision, { decision: 'approved', body_sha256: digest })).status, 403, 'a risk approver does not decide policies')
  assert.equal((await call(admin, decision, { decision: 'approved', body_sha256: digest })).status, 200, 'a different approver can')
  const risk = await (await call(manager, '/api/risks', { title: 'Stale admin accounts', scenario: 'Departed admins keep access', likelihood: '3', impact: '3', treatment: 'mitigate', owner_person_id: person.id })).json()
  assert.equal((await call(manager, `/api/risks/${risk.id}/assessments`, { kind: 'residual', likelihood: '2', impact: '2', notes: 'Quarterly review' })).status, 201)
  const accept = { rationale: 'Accepted until the next review', expires_at: '2026-12-01' }
  assert.equal((await call(manager, `/api/risks/${risk.id}/acceptances`, accept)).status, 403, 'the assessor cannot accept their own residual risk')
  assert.equal((await call(approver, `/api/risks/${risk.id}/acceptances`, accept)).status, 201)
  assert.equal((await call(approver, '/api/risks')).status, 200)
  assert.equal((await call(approver, '/api/policies')).status, 403)
  assert.equal((await call(approver, '/api/people')).status, 403)
  assert.equal((await call(approver, `/api/risks/${risk.id}/assessments`, { kind: 'residual', likelihood: '1', impact: '1' })).status, 403, 'a risk approver does not write')
 })
 await scenario('Control owners and contributors submit only their scoped evidence, and revocation applies on the next request', async () => {
  const controlOwner = await signinAs('control-owner@example.test', 'Cory Control'), contributor = await signinAs('contrib@example.test', 'Casey Contributor')
  assert.equal((await call(controlOwner, '/api/desk')).status, 403, 'no grant, no desk')
  const granted = await (await grant({ email: 'control-owner@example.test', role: 'control_owner', scope_kind: 'control', scope_ref: mine.control, reason: 'Owns access reviews' })).json()
  assert.equal((await grant({ email: 'control-owner@example.test', role: 'control_owner', scope_kind: 'control', scope_ref: 'missing', reason: 'x' })).status, 404)
  assert.equal((await grant({ email: 'contrib@example.test', role: 'contributor', scope_kind: 'control', scope_ref: mine.control, reason: 'Collects the screenshots' })).status, 201)
  const desk = await (await call(controlOwner, '/api/desk')).json()
  assert.deepEqual(desk.requirements.map(r => r.id), [mine.requirement], 'the desk lists only the scoped control')
  assert.equal((await call(controlOwner, `/app/requirements/${foreign.requirement}`)).status, 404, 'a foreign control is not found')
  assert.equal((await upload(controlOwner, foreign.requirement)).status, 403, 'evidence for a foreign control is refused')
  const submitted = await upload(controlOwner, mine.requirement)
  assert.equal(submitted.status, 303)
  const receipt = submitted.headers.get('location')
  assert.equal((await call(controlOwner, receipt.replace('/app/', '/api/'))).status, 200)
  assert.equal((await call(controlOwner, receipt + '/download')).status, 200)
  assert.equal((await call(contributor, receipt + '/download')).status, 403, 'a contributor submits but does not download')
  assert.equal((await upload(contributor, mine.requirement)).status, 303)
  assert.equal((await call(controlOwner, '/api/policies')).status, 403)
  assert.equal((await call(controlOwner, '/api/people')).status, 403)
  assert.equal((await call(controlOwner, '/api/roles/grants', { email: 'contrib@example.test', role: 'contributor', scope_kind: 'control', scope_ref: foreign.control, reason: 'x' })).status, 403)
  // A team grant reaches the controls of that team and no more.
  assert.equal((await call(owner, '/api/roles/teams', { control_id: foreign.control, team: 'Security' })).status, 200)
  assert.equal((await grant({ email: 'contrib@example.test', role: 'contributor', scope_kind: 'team', scope_ref: 'Security', reason: 'Security team work' })).status, 201)
  assert.equal((await upload(contributor, foreign.requirement)).status, 303)
  // A control of another team is foreign: not found, and no upload.
  const finance = await control('Month-end close review')
  assert.equal((await call(owner, '/api/roles/teams', { control_id: finance.control, team: 'Finance' })).status, 200)
  assert.equal((await call(contributor, `/app/requirements/${finance.requirement}`)).status, 404)
  assert.equal((await upload(contributor, finance.requirement)).status, 403)
  // An employee reaches their own tasks and no export, audit trail or archive.
  const employee = await signinAs('employee@example.test', 'Eli Employee')
  assert.equal((await call(owner, '/api/people', { name: 'Eli Employee', email: 'employee@example.test', kind: 'employee' })).status, 201)
  assert.equal((await call(employee, '/api/me')).status, 200)
  for (const path of ['/api/risks/export', '/api/audit', '/api/archive/export', '/api/people', '/api/desk']) assert.equal((await call(employee, path)).status, 403, path)
  // Revoking a grant, then ending sessions, fails the very next request.
  assert.equal((await call(owner, `/api/roles/grants/${granted.id}/revoke`, { reason: 'Left the team' })).status, 200)
  assert.equal((await call(controlOwner, '/api/desk')).status, 403)
  assert.equal((await call(owner, '/api/roles/sessions/end', { email: 'contrib@example.test', reason: 'Lost laptop' })).status, 200)
  assert.equal((await call(contributor, '/api/desk')).status, 401)
  const trail = await (await call(owner, '/api/audit')).text()
  for (const action of ['access.granted', 'access.revoked', 'access.sessions-ended']) assert.ok(trail.includes(action), action)
  const issued = await (await call(owner, '/api/roles/scim-tokens', { name: 'Okta provisioning', provider: 'okta', days: 30 })).json()
  const stored = await app.db.prepare('SELECT token_sha256 FROM scim_tokens WHERE id=?').bind(issued.id).first()
  assert.equal(stored.token_sha256, createHash('sha256').update(issued.token).digest('hex'))
  assert.ok(!JSON.stringify(await (await call(owner, '/api/roles')).json()).includes(issued.token), 'the token is shown once')
  for (const path of ['/api/roles', '/app/roles', '/api/desk']) assert.equal((await app.fetch(path, { headers: { authorization: 'Bearer ' + issued.token } })).status, 403, path)
  assert.equal((await app.fetch('/scim/v2/Users', { headers: { authorization: 'Bearer ' + 'x'.repeat(43) } })).status, 401)
  assert.equal((await app.fetch('/v1/tests', { headers: { authorization: 'Bearer ' + issued.token } })).status, 401, 'a SCIM token is no API token')
  // An API token with explicit scope and expiry reaches its own door, and cannot grant, approve or publish.
  const api = await (await call(owner, '/api/api-tokens', { name: 'Collector', scopes: ['resource-push'], expires_at: '2027-01-01' })).json()
  for (const [path, body] of [['/api/roles/grants', { email: 'x@example.test', role: 'administrator', scope_kind: 'business', reason: 'x' }], ['/api/policies', { title: 'x', body: 'x' }]]) assert.equal((await app.fetch(path, { method: 'POST', headers: { cookie: '', authorization: 'Bearer ' + api.token, 'content-type': 'application/json' }, body: JSON.stringify(body) })).status, 403, path)
  assert.equal((await call(owner, `/api/api-tokens/${api.grant.id}/revoke`, {})).status, 200)
  assert.equal((await app.fetch('/v1/tests', { headers: { cookie: '', authorization: 'Bearer ' + api.token } })).status, 401, 'a revoked token fails the next request')
  globalThis.scim = issued
 })
 await scenario('Bearer and SCIM tokens never open the role door, and SCIM provisions and deprovisions a contributor who signs in through single sign-on only', async () => {
  const { token } = globalThis.scim
  const userPath = '/Us' + 'ers/'
  const scim = (method, path, body) => app.fetch('/scim/v2' + path, { method, headers: { authorization: 'Bearer ' + token, 'content-type': 'application/scim+json' }, ...(body ? { body: JSON.stringify(body) } : {}) })
  const user = { schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'], userName: 'sso.contributor@example.test', externalId: '00u-synthetic-1', displayName: 'Sam Sso', emails: [{ value: 'sso.contributor@example.test', primary: true }], active: true }
  const created = await scim('POST', '/Users', user); assert.equal(created.status, 201)
  const resource = await created.json(); assert.equal(resource.active, true)
  assert.equal((await scim('POST', '/Users', user)).status, 409)
  assert.equal((await scim('POST', '/Users', { ...user, userName: 'owner@example.test', externalId: 'x', emails: [{ value: 'owner@example.test', primary: true }] })).status, 409, 'the owner account is never taken over')
  assert.equal((await (await scim('GET', '/Users?filter=userName eq "sso.contributor@example.test"')).json()).totalResults, 1)
  const mailBefore = app.messages.length
  assert.equal((await call('', '/auth/magic-link', { email: 'sso.contributor@example.test' }, { origin: app.origin, ...json })).status, 202)
  await app.fetch('/auth/magic-link', { method: 'POST', headers: { cookie: '', origin: app.origin, ...json }, body: JSON.stringify({ email: 'sso.contributor@example.test' }) })
  assert.equal(app.messages.length, mailBefore, 'a provisioned account has no email link')
  const enable = await app.fetch('/auth/settings/identity', { method: 'POST', headers: { ...as(owner), ...json }, body: JSON.stringify({ idpSignIn: true }) })
  assert.ok([200, 204, 303].includes(enable.status), 'provider sign-in enabled ' + enable.status)
  const signIn = async (claims, provider = 'okta') => {
   const start = await app.fetch(`/auth/oidc/${provider}/start`, { method: 'POST', headers: { cookie: '', origin: app.origin, ...json }, body: JSON.stringify({ returnTo: '/me' }) })
   assert.ok([302, 303].includes(start.status), 'start ' + start.status)
   const { code, state } = providers[provider].authorize(start.headers.get('location'), claims)
   return app.fetch(`/auth/oidc/${provider}/callback?code=${code}&state=${state}`, { headers: { cookie: cookieOf(start) } })
  }
  // Google Workspace admits a verified address of the invited person; a second factor it cannot state is refused while required.
  const guest = await signinAs('google.user@example.test', 'Gale Google')
  const viaGoogle = await signIn({ sub: 'google-subject-1', email: 'google.user@example.test', hd: 'example.test' }, 'google')
  assert.equal(viaGoogle.status, 303); assert.equal((await (await call(cookieOf(viaGoogle), '/auth/session')).json()).operator.email, 'google.user@example.test')
  assert.equal((await call(guest, '/auth/session')).status, 200)
  const foreignDomain = await signIn({ sub: 'google-subject-2', email: 'google.user@example.test' }, 'google')
  assert.equal(cookieOf(foreignDomain).includes('operator_session'), false, 'a Google address without a Workspace domain claim is not trusted')
  // Microsoft Entra ID names a person only through the SCIM subject map.
  const entraToken = (await (await call(owner, '/api/roles/scim-tokens', { name: 'Entra provisioning', provider: 'microsoft', days: 30 })).json()).token
  const entraScim = await app.fetch('/scim/v2/Users', { method: 'POST', headers: { authorization: 'Bearer ' + entraToken, 'content-type': 'application/scim+json' }, body: JSON.stringify({ ...user, userName: 'entra.user@example.test', externalId: 'entra-object-id-1', emails: [{ value: 'entra.user@example.test', primary: true }] }) })
  assert.equal(entraScim.status, 201)
  const viaEntra = await signIn({ sub: 'entra-object-id-1', amr: ['pwd', 'mfa'] }, 'microsoft'); assert.equal(viaEntra.status, 303)
  assert.equal((await (await call(cookieOf(viaEntra), '/auth/session')).json()).operator.email, 'entra.user@example.test')
  const entraStranger = await signIn({ sub: 'entra-object-id-2', email: 'entra.user@example.test', amr: ['pwd', 'mfa'] }, 'microsoft')
  assert.equal(cookieOf(entraStranger).includes('operator_session'), false, 'a token email never names a person at Entra ID')
  const stranger = await signIn({ sub: '00u-not-provisioned' })
  assert.equal(cookieOf(stranger).includes('operator_session'), false, 'an unprovisioned subject gets no session')
  const sso = await signIn({ sub: '00u-synthetic-1', amr: ['pwd'] })
  assert.equal(sso.status, 303); const session = cookieOf(sso); assert.ok(session)
  assert.equal((await (await call(session, '/auth/session')).json()).operator.email, 'sso.contributor@example.test')
  assert.equal((await call(session, '/api/programs')).status, 403)
  // The owner may require a second factor: a token without one is refused, one with it is admitted.
  assert.equal((await call(owner, '/api/roles/mfa', { require_mfa: 'yes' })).status, 200)
  const googleNoMfa = await signIn({ sub: 'google-subject-1', email: 'google.user@example.test', hd: 'example.test' }, 'google')
  assert.equal(cookieOf(googleNoMfa).includes('operator_session'), false, 'Google states no second factor, so it is refused while one is required')
  const noMfa = await signIn({ sub: '00u-synthetic-1', amr: ['pwd'] })
  assert.equal(cookieOf(noMfa).includes('operator_session'), false, 'MFA required: password alone is refused')
  const withMfa = await signIn({ sub: '00u-synthetic-1', amr: ['pwd', 'otp', 'mfa'] })
  assert.equal(withMfa.status, 303); assert.ok(cookieOf(withMfa).includes('operator_session'))
  // Deprovisioning ends the account, every session, the subject and the roles at once.
  assert.equal((await scim('PATCH', `${userPath}${resource.id}`, { schemas: ['urn:ietf:params:scim:api:messages:2.0:PatchOp'], Operations: [{ op: 'replace', value: { active: false } }] })).status, 200)
  assert.equal((await call(session, '/auth/session')).status, 401)
  assert.equal((await call(cookieOf(withMfa), '/api/desk')).status, 401)
  const again = await signIn({ sub: '00u-synthetic-1', amr: ['pwd', 'otp', 'mfa'] })
  assert.equal(cookieOf(again).includes('operator_session'), false)
  assert.equal((await app.db.prepare('SELECT COUNT(*) AS n FROM access_grants WHERE email=? AND revoked_at IS NULL').bind('sso.contributor@example.test').first()).n, 0)
  const trail = await (await call(owner, '/api/audit')).text()
  for (const action of ['scim.user.provisioned', 'scim.user.deprovisioned', 'auth.break-glass']) assert.ok(trail.includes(action), action)
  assert.equal((await scim('DELETE', `${userPath}${resource.id}`)).status, 204)
 })
 console.log(`${passed} public-door scenarios passed; real workerd, D1, Base email-link and OpenID Connect sign-in; the provider is faked at the network edge.`)
} finally { await app.close() }
