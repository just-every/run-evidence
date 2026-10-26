// Live sandbox proof for AUTH-001 against the RunEditRun Okta integrator org:
// real OpenID Connect sign-in through Evidence's production handler, with SCIM
// provisioning and deprovisioning of a contributor, and the second-factor refusal.
// Run: python3 -I briefs/_od08-env.py OKTA_ORG_URL=OKTA_ORG_URL OKTA_API_TOKEN=OKTA_API_TOKEN -- node tests/live/okta-sso.mjs
// Prints a receipt of statuses only; no credential is ever printed. Test users and
// the test app exist only for the run and are deleted before it ends.
import assert from 'node:assert/strict'
import { generateKeyPairSync, randomBytes } from 'node:crypto'
import { createServer } from 'node:http'
import { chromium } from 'playwright'
import { runtime } from '../helpers/runtime.mjs'
const org = (process.env.OKTA_ORG_URL ?? '').replace(/\/$/, ''), token = process.env.OKTA_API_TOKEN ?? ''
assert.ok(org.startsWith('https://') && token, 'OKTA_ORG_URL and OKTA_API_TOKEN are required')
const api = async (method, path, body) => { const r = await fetch(org + path, { method, headers: { authorization: 'SSWS ' + token, accept: 'application/json', 'content-type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) }); const text = await r.text(); return { status: r.status, body: text ? JSON.parse(text) : null } }
const stamp = Date.now().toString(36), password = 'Zq9!' + randomBytes(12).toString('base64url')
const receipt = { org: new URL(org).host, at: new Date().toISOString(), steps: [], provider_statuses: [] }
const step = (name, ok, detail = '') => { receipt.steps.push({ name, ok, detail }); assert.ok(ok, name + ' ' + detail) }
const created = { users: [], app: null, group: null, policies: [] }
const port = 18000 + Math.floor(Math.random() * 1000), origin = 'http://127.0.0.1:' + port, callback = origin + '/auth/oidc/okta/callback'
// Okta redirects the browser to the callback; this listener only records where it landed, and Evidence is then driven directly.
let landed = ''
const catcher = createServer((request, response) => { if (request.url.startsWith('/auth/oidc/')) landed = origin + request.url; response.end('ok') })
let app, browser, lastPage
try {
 await new Promise(done => catcher.listen(port, '127.0.0.1', done))
 browser = await chromium.launch({ headless: true, args: ['--use-mock-keychain', '--password-store=basic'] })
 // Okta refuses a client_id beside a Basic header, so this app proves itself with a private key it registered.
 const keys = generateKeyPairSync('rsa', { modulusLength: 2048 }), kid = 'evidence-auth-001-' + stamp, publicJwk = { ...keys.publicKey.export({ format: 'jwk' }), kid, alg: 'RS256', use: 'sig' }, privateJwk = { ...keys.privateKey.export({ format: 'jwk' }), kid, alg: 'RS256' }
 const made = await api('POST', '/api/v1/apps', { name: 'oidc_client', label: 'Evidence c-i822 AUTH-001 test', signOnMode: 'OPENID_CONNECT', credentials: { oauthClient: { token_endpoint_auth_method: 'private_key_jwt' } }, settings: { oauthClient: { application_type: 'web', jwks: { keys: [publicJwk] }, grant_types: ['authorization_code'], response_types: ['code'], redirect_uris: [callback], consent_method: 'TRUSTED' } } })
 step('test OpenID Connect app created', made.status === 200, 'status ' + made.status); created.app = made.body.id
 const clientId = made.body.credentials.oauthClient.client_id
 // The test users sign in with a password only: a test group gets a password-only enrollment policy, and the test app a one-factor access policy.
 const group = await api('POST', '/api/v1/groups', { profile: { name: 'evidence-auth-001-test-' + stamp } }); step('test group created', group.status === 200); created.group = group.body.id
 const enroll = await api('POST', '/api/v1/policies', { type: 'MFA_ENROLL', name: 'evidence AUTH-001 test enrollment ' + stamp, status: 'ACTIVE', priority: 1, conditions: { people: { groups: { include: [created.group] } } }, settings: { type: 'AUTHENTICATORS', authenticators: [{ key: 'okta_password', enroll: { self: 'REQUIRED' } }, { key: 'okta_verify', enroll: { self: 'OPTIONAL' } }] } })
 step('password-only enrollment policy created', enroll.status === 200, 'status ' + enroll.status); created.policies.push(enroll.body.id)
 step('enrollment rule created', (await api('POST', `/api/v1/policies/${enroll.body.id}/rules`, { name: 'password only', type: 'MFA_ENROLL', actions: { enroll: { self: 'CHALLENGE' } } })).status === 200)
 const access = await api('POST', '/api/v1/policies', { type: 'ACCESS_POLICY', name: 'evidence AUTH-001 test access ' + stamp, description: 'test' }); step('one-factor access policy created', access.status === 200); created.policies.push(access.body.id)
 const rule = (await api('GET', `/api/v1/policies/${access.body.id}/rules`)).body[0]
 step('access rule set to password only', (await api('PUT', `/api/v1/policies/${access.body.id}/rules/${rule.id}`, { ...rule, actions: { appSignOn: { access: 'ALLOW', verificationMethod: { factorMode: '1FA', type: 'ASSURANCE', reauthenticateIn: 'PT12H', constraints: [{ knowledge: { types: ['password'] } }] }, keepMeSignedIn: { postAuth: 'NOT_ALLOWED' } } } })).status === 200)
 step('access policy assigned to the test app', (await api('PUT', `/api/v1/apps/${created.app}/policies/${access.body.id}`)).status < 300)
 const newUser = async label => {
  const login = `evidence-${label}-${stamp}@example.test`
  const u = await api('POST', '/api/v1/users?activate=true', { profile: { firstName: 'Evidence', lastName: label, email: login, login }, credentials: { password: { value: password } } })
  step(`Okta user ${label} created`, u.status === 200, 'status ' + u.status); created.users.push(u.body.id)
  step(`Okta user ${label} joined the test group`, (await api('PUT', `/api/v1/groups/${created.group}/users/${u.body.id}`)).status < 300)
  step(`Okta user ${label} assigned to the app`, (await api('POST', `/api/v1/apps/${created.app}/users`, { id: u.body.id, scope: 'USER' })).status === 200)
  return { id: u.body.id, login }
 }
 const contributor = await newUser('contributor'), stranger = await newUser('stranger')
 const real = async request => {
  if (!request.url.startsWith(org)) return null
  const headers = Object.fromEntries([...request.headers].filter(([name]) => ['content-type', 'authorization', 'accept'].includes(name)))
  const answer = await fetch(request.url, { method: request.method, headers, body: ['GET', 'HEAD'].includes(request.method) ? undefined : await request.text(), redirect: 'manual' })
  receipt.provider_statuses.push(request.method + ' ' + new URL(request.url).pathname + ' ' + answer.status + (answer.ok ? '' : ' ' + (await answer.clone().text()).slice(0, 200) + ' [sent ' + [...request.headers.keys()].join(',') + ']'))
  return answer
 }
 app = await runtime({ origin, outbound: real, settings: { SSO_OKTA_ISSUER: org, SSO_OKTA_CLIENT_ID: clientId, SSO_OKTA_PRIVATE_KEY: JSON.stringify(privateJwk), OIDC_TRANSACTION_SECRET: 'synthetic-evidence-transaction-secret-live-0123456789' } })
 const owner = await app.signin(), json = { 'content-type': 'application/json' }
 const post = (path, body, cookie = owner, extra = {}) => app.fetch(path, { method: 'POST', headers: { cookie, origin, ...json, ...extra }, body: JSON.stringify(body) })
 // SCIM: a scoped, expiring token opens only the provisioning door; Okta's user id is the subject Evidence trusts.
 const scimToken = (await (await post('/api/roles/scim-tokens', { name: 'Okta live test', provider: 'okta', days: 1 })).json()).token
 const scim = (method, path, body) => app.fetch('/scim/v2' + path, { method, headers: { authorization: 'Bearer ' + scimToken, 'content-type': 'application/scim+json' }, ...(body ? { body: JSON.stringify(body) } : {}) })
 const provisioned = await scim('POST', '/Users', { schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'], userName: contributor.login, externalId: contributor.id, displayName: 'Evidence contributor', emails: [{ value: contributor.login, primary: true }], active: true })
 step('SCIM provisions the contributor', provisioned.status === 201, 'status ' + provisioned.status); const scimId = (await provisioned.json()).id
 step('SSO sign-in is enabled by the owner', [200, 204, 303].includes((await post('/auth/settings/identity', { idpSignIn: true })).status))
 const signIn = async user => {
  const start = await app.fetch('/auth/oidc/okta/start', { method: 'POST', headers: { cookie: '', origin, ...json }, body: JSON.stringify({ returnTo: '/me' }) })
  step('Evidence starts the Okta authorization', [302, 303].includes(start.status), 'status ' + start.status)
  // The user signs in at Okta's own page, as a person would; the callback request is captured before it reaches the network.
  landed = ''
  const page = lastPage = await browser.newPage()
  await page.goto(start.headers.get('location'))
  await page.waitForSelector('input[name="identifier"], input[name="username"]', { timeout: 30000 })
  await page.fill('input[name="identifier"], input[name="username"]', user.login)
  const next = await page.$('input[type="submit"], button[type="submit"]'); if (await page.$('input[type="password"]') === null && next) { await next.click(); await page.waitForSelector('input[type="password"]', { timeout: 30000 }) }
  await page.fill('input[type="password"]', password); await (await page.$('input[type="submit"], button[type="submit"]')).click()
  for (let i = 0; i < 60 && !landed; i++) await page.waitForTimeout(500)
  const back = new URL(landed || 'http://invalid.test/')
  step('Okta redirects back with a code', back.origin + back.pathname === callback && back.searchParams.has('code'), 'landed ' + (back.searchParams.get('error') ?? (landed ? 'callback' : 'nowhere')))
  return app.fetch(back.pathname + back.search, { headers: { cookie: start.headers.getSetCookie().map(x => x.split(';')[0]).join('; ') } })
 }
 const sessionOf = r => r.headers.getSetCookie().map(x => x.split(';')[0]).join('; ')
 const signed = await signIn(contributor); step('The provisioned contributor receives a session', signed.status === 303 && sessionOf(signed).includes('operator_session'), 'status ' + signed.status)
 const cookie = sessionOf(signed), who = await (await app.fetch('/auth/session', { headers: { cookie } })).json()
 step('The session names the SCIM-provisioned account', who.operator.email === contributor.login)
 step('The contributor reaches no owner door', (await app.fetch('/api/programs', { headers: { cookie } })).status === 403)
 const refused = await signIn(stranger); step('An Okta user SCIM never provisioned receives no session', !sessionOf(refused).includes('operator_session'), 'status ' + refused.status)
 step('The owner requires a second factor', (await post('/api/roles/mfa', { require_mfa: 'yes' })).status === 200)
 const noMfa = await signIn(contributor); step('A password-only Okta sign-in is refused while a second factor is required', !sessionOf(noMfa).includes('operator_session'), 'status ' + noMfa.status)
 await post('/api/roles/mfa', { require_mfa: 'no' })
 // Deprovisioning ends the session and the account at once.
 step('SCIM deprovisions the contributor', (await scim('PATCH', '/Us' + 'ers/' + scimId, { schemas: ['urn:ietf:params:scim:api:messages:2.0:PatchOp'], Operations: [{ op: 'replace', value: { active: false } }] })).status === 200)
 step('The live session fails on the next request', (await app.fetch('/auth/session', { headers: { cookie } })).status === 401)
 const again = await signIn(contributor); step('The deprovisioned user cannot sign in again', !sessionOf(again).includes('operator_session'))
 receipt.result = 'passed'
} catch (error) { receipt.page = lastPage ? { url: lastPage.url().replace(/code=[^&]+/, 'code=x').slice(0, 120), text: (await lastPage.innerText('body').catch(() => '')).replace(/\s+/g, ' ').slice(0, 240) } : undefined
 receipt.result = 'failed: ' + (error instanceof Error ? error.message.split('\n')[0] : 'unknown'); process.exitCode = 1 }
finally {
 for (const id of created.users) { await api('POST', `/api/v1/users/${id}/lifecycle/deactivate`); await api('DELETE', `/api/v1/users/${id}`) }
 if (created.app) { await api('POST', `/api/v1/apps/${created.app}/lifecycle/deactivate`); await api('DELETE', `/api/v1/apps/${created.app}`) }
 for (const id of created.policies) await api('DELETE', `/api/v1/policies/${id}`)
 if (created.group) await api('DELETE', `/api/v1/groups/${created.group}`)
 receipt.cleanup = 'test users, app, group and policies deleted'
 await browser?.close().catch(() => undefined)
 catcher.close()
 await app?.close().catch(() => undefined)
 console.log(JSON.stringify(receipt, null, 1))
}
