// FOLLOWUP-002 through the owner's doors and the Cron Trigger on the harness
// clock: a failing observation notifies its owner at once on their chosen
// channel, a multi-item failure sends one grouped notice, Acknowledge and
// Reassign never close anything, and a verified fix or a regression is announced.
// Slack, Teams, Jira and the mail provider are faked at the network edge.
process.env.RER_SERVER_JOURNEY = '1'
import assert from 'node:assert/strict'
import { runtime } from './helpers/runtime.mjs'
const TEAMS = 'https://prod-07.westus.logic.azure.com/workflows/1f2e/triggers/manual/paths/invoke?api-version=2016-06-01&sig=teams-signature-secret'
const JIRA = 'https://northstar.atlassian.net', jiraAuth = 'Basic ' + Buffer.from('it@northstar.test:jira_token').toString('base64')
const slack = { token: 'synthetic-evidence-1', posts: [], users: { 'ana@northstar.test': 'U0ANA' }, failNext: null }, teams = { posts: [] }, jira = { issues: new Map(), count: 0 }
const reply = (status, body) => new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
async function fake(request) {
 const url = new URL(request.url)
 if (url.hostname === 'slack.com') {
  const body = Object.fromEntries(new URLSearchParams(await request.text()))
  if (request.headers.get('authorization') !== 'Bearer ' + slack.token) return reply(200, { ok: false, error: 'invalid_auth' })
  if (url.pathname === '/api/auth.test') return reply(200, { ok: true, team: 'Northstar', user_id: 'UBOT' })
  if (url.pathname === '/api/users.lookupByEmail') return slack.users[body.email] ? reply(200, { ok: true, user: { id: slack.users[body.email] } }) : reply(200, { ok: false, error: 'users_not_found' })
  if (url.pathname === '/api/chat.postMessage') { if (slack.failNext) { const error = slack.failNext; slack.failNext = null; return reply(200, { ok: false, error }) } slack.posts.push(body); return reply(200, { ok: true, ts: String(slack.posts.length) }) }
 }
 if (url.hostname === 'prod-07.westus.logic.azure.com') { teams.posts.push(await request.json()); return new Response(null, { status: 202 }) }
 if (url.origin === JIRA) {
  if (request.headers.get('authorization') !== jiraAuth) return reply(401, { errorMessages: ['Unauthorized'] })
  if (url.pathname === '/rest/api/3/myself') return reply(200, { displayName: 'IT', emailAddress: 'it@northstar.test' })
  if (url.pathname === '/rest/api/3/project/SEC') return reply(200, { key: 'SEC', name: 'Security' })
  if (url.pathname === '/rest/api/3/issue') { const key = 'SEC-' + (++jira.count); jira.issues.set(key, { due: (await request.json()).fields.duedate ?? null }); return reply(201, { id: String(1000 + jira.count), key }) }
  const m = /^\/rest\/api\/3\/issue\/(SEC-\d+)(\/comment)?$/.exec(url.pathname), issue = m && jira.issues.get(m[1])
  if (!issue) return reply(404, { errorMessages: ['Issue does not exist'] })
  if (m[2]) return reply(200, { comments: [] })
  return reply(200, { key: m[1], fields: { status: { name: 'To Do', statusCategory: { key: 'new' } }, assignee: null, duedate: issue.due } })
 }
 return null
}
const app = await runtime({ outbound: fake })
let passed = 0
const scenario = async (name, fn) => { await fn(); passed++; console.log('PASS ' + name) }
const owner = async (path, body, status = 201) => { const r = await app.fetch(path, { method: 'POST', headers: { origin: app.origin, 'content-type': 'application/json' }, body: JSON.stringify(body) }); const text = await r.text(); assert.equal(r.status, status, path + ' ' + text); return text ? JSON.parse(text) : null }
const get = async path => { const r = await app.fetch(path); assert.equal(r.status, 200, path); return r.json() }
const v1 = (token, method, path, body) => app.fetch(path, { method, headers: { cookie: '', authorization: 'Bearer ' + token, 'content-type': 'application/json' }, body: JSON.stringify(body) })
const at = async time => { await app.clock(time); await app.tick() }
const people = {}, obligation = {}
const open = async () => (await get('/api/remediation')).open
const notices = async who => (await get('/api/remediation/' + obligation[who])).events.filter(e => e.kind === 'notified')
const setMfa = async (state) => assert.equal((await v1(push.token, 'PUT', '/v1/resources/idp_user', { resources: Object.entries(state).map(([u, mfa]) => ({ uniqueId: u, displayName: u + '@northstar.test', attributes: { mfa } })) })).status, 200)
let push
try {
 await scenario('FOLLOWUP-002 / A failing observation notifies its owner at once on their channel with the test, item, control, requirements, owner, due date, first step, private link and Jira ticket; three items send one grouped card; a restart sends nothing twice', async () => {
  await app.clock('2026-10-30T16:00:00Z'); await app.signin()
  await owner('/api/followups/channels', { kind: 'slack', secret: slack.token, target: 'C0SECURITY' }); await owner('/api/followups/channels', { kind: 'teams', secret: TEAMS })
  for (const [key, name, via] of [['ana', 'Ana Ruiz', 'slack'], ['ben', 'Ben Ode', 'teams'], ['cy', 'Cy Park', 'email']]) {
   people[key] = (await owner('/api/people', { name, email: key + '@northstar.test', kind: 'employee' })).id
   await owner('/api/followups/preferences', { person_id: people[key], via, all_clear: '0' }, 200)
  }
  await owner('/api/remediation/sla', { category: 'identity', severity: 'high', days: 7 })
  await owner('/api/remediation/sla', { category: 'cloud', severity: 'high', days: 7 })
  const jiraDestination = await owner('/api/trackers', { provider: 'jira', api_base: JIRA, account: 'it@northstar.test', project: 'SEC', token: 'jira_token' })
  push = await owner('/api/api-tokens', { name: 'Inventory', scopes: ['resource-push', 'test-write', 'read'], expires_at: '2027-04-01' })
  assert.equal((await v1(push.token, 'PUT', '/v1/resource-types/idp_user', { schema: { fields: { mfa: 'boolean' } } })).status, 200)
  assert.equal((await v1(push.token, 'PUT', '/v1/resource-types/laptop', { schema: { fields: { encrypted: 'boolean' } } })).status, 200)
  await setMfa({ ana: false })
  assert.equal((await v1(push.token, 'PUT', '/v1/resources/laptop', { resources: ['l1', 'l2', 'l3'].map(u => ({ uniqueId: u, displayName: 'Laptop ' + u, attributes: { encrypted: false } })) })).status, 200)
  assert.equal((await v1(push.token, 'POST', '/v1/tests', { name: 'MFA is on', resourceType: 'idp_user', criteria: [{ attribute: 'mfa', op: 'equals', value: true }], cadence: 'daily', category: 'identity', severity: 'high', controls: ['AC-05'], remediation: 'Turn on MFA for the account in the identity provider.' })).status, 201)
  assert.equal((await v1(push.token, 'POST', '/v1/tests', { name: 'Disks are encrypted', resourceType: 'laptop', criteria: [{ attribute: 'encrypted', op: 'equals', value: true }], cadence: 'daily', category: 'cloud', severity: 'high', controls: ['AC-05'] })).status, 201)
  const control = (await app.db.prepare('SELECT control_id FROM test_controls LIMIT 1').first()).control_id
  await owner(`/api/controls/${control}/owners`, { owner_person_id: people.cy, reason: 'Security lead' }, 200)
  for (const o of await open()) {
   const who = o.resource_name.startsWith('Laptop') ? 'ben' : 'ana'
   obligation[o.resource_name] = o.id
   if (who === 'ben') await owner(`/api/remediation/${o.id}/assign`, { owner_person_id: people.ben, next_action: 'Encrypt the disk' }, 200)
   else { obligation.ana = o.id; await owner(`/api/remediation/${o.id}/assign`, { owner_person_id: people.ana, next_action: 'Turn on MFA' }, 200); await owner(`/api/remediation/${o.id}/tickets`, { destination_id: jiraDestination.id }) }
  }
  assert.equal(slack.posts.length, 0); assert.equal(teams.posts.length, 1)
  await app.tick()
  assert.equal(slack.posts.length, 1); assert.equal(slack.posts[0].channel, 'U0ANA')
  const text = slack.posts[0].text
  for (const part of ['Failing: MFA is on on ana@northstar.test', 'Owner: Ana Ruiz', 'Severity: high', 'remediate by Nov 6, 2026', 'Turn on MFA for the account', `/app/remediation/${obligation.ana}`, 'SEC-1', `${JIRA}/browse/SEC-1`]) assert.ok(text.includes(part), part + '\n' + text)
  assert.match(text, /Control: .*\. Requirements: \S+/)
  assert.equal(teams.posts.length, 2)
  const card = JSON.stringify(teams.posts[1])
  for (const l of ['l1', 'l2', 'l3']) assert.ok(card.includes('Laptop ' + l), l)
  assert.equal((card.match(/remediate by Nov 6, 2026/g) ?? []).length, 3); assert.match(card, /Failing: Disks are encrypted on 3 items/)
  assert.match((await notices('ana'))[0].body, /^cycle 1 to ana@northstar\.test\nNotice accepted/)
  for (const l of ['l1', 'l2', 'l3']) assert.equal((await notices('Laptop ' + l)).length, 1)
  await at('2026-10-30T16:05:00Z'); await at('2026-10-30T20:00:00Z')
  assert.equal(slack.posts.length, 1); assert.equal(teams.posts.length, 2); assert.equal((await notices('ana')).length, 1)
  assert.equal((await get('/api/remediation/' + obligation.ana)).obligation.state, 'open')
 })
 await scenario('FOLLOWUP-002 / A failing item with no owner goes to the control owner and says so; Acknowledge records who and when and stays open; Reassign needs a reason, records it and notifies the new owner once', async () => {
  assert.equal((await v1(push.token, 'PUT', '/v1/resources/idp_user', { resources: [{ uniqueId: 'dev', displayName: 'dev@northstar.test', attributes: { mfa: false } }, { uniqueId: 'ana', displayName: 'ana@northstar.test', attributes: { mfa: false } }] })).status, 200)
  await at('2026-10-30T20:10:00Z')
  const dev = (await open()).find(o => o.resource_name === 'dev@northstar.test'); obligation.dev = dev.id
  const mail = app.messages.find(m => /Failing: MFA is on on dev@northstar\.test/.test(m.subject))
  assert.deepEqual(mail.to, ['cy@northstar.test']); assert.match(mail.text, /no assigned owner, so this notice goes to the control owner Cy Park/)
  assert.match((await notices('dev'))[0].body, /control owner/)
  await owner(`/api/remediation/${obligation.ana}/acknowledge`, {}, 200)
  const acknowledged = (await get('/api/remediation/' + obligation.ana)).events.find(e => e.kind === 'acknowledged')
  assert.match(acknowledged.body, /Acknowledged by Evidence owner .* for Ana Ruiz; the obligation stays open/); assert.ok(acknowledged.at)
  assert.equal((await get('/api/remediation/' + obligation.ana)).obligation.state, 'open')
  assert.match(await (await app.fetch('/app/remediation/' + obligation.ana)).text(), /Acknowledge or reassign/)
  await owner(`/api/remediation/${obligation.ana}/reassign`, { owner_person_id: people.cy, reason: '' }, 400)
  await owner(`/api/remediation/${obligation.ana}/reassign`, { owner_person_id: people.ana, reason: 'same' }, 409)
  await owner(`/api/remediation/${obligation.ana}/reassign`, { owner_person_id: people.cy, reason: 'Ana is on leave this week' }, 200)
  assert.equal((await get('/api/remediation/' + obligation.ana)).obligation.owner_person_id, people.cy)
  await at('2026-10-30T20:15:00Z'); await at('2026-10-30T20:20:00Z')
  const moved = app.messages.filter(m => /Failing: MFA is on on ana@northstar\.test/.test(m.subject) && m.to.includes('cy@northstar.test'))
  assert.equal(moved.length, 1); assert.match(moved[0].text, /Reassigned to you by Evidence owner: Ana is on leave this week/)
  assert.equal((await notices('ana')).length, 2); assert.equal(slack.posts.length, 1)
 })
 await scenario('FOLLOWUP-002 / A verified fix is announced closed to whoever heard of it, a regression sends a new notice, and quiet hours defer a notice until the business window', async () => {
  await setMfa({ ana: true, dev: false })
  await at('2026-10-30T20:30:00Z')
  assert.equal((await get('/api/remediation/' + obligation.ana)).obligation.state, 'verified')
  const verified = app.messages.filter(m => /Verified: MFA is on on ana@northstar\.test/.test(m.subject)); assert.equal(verified.length, 1); assert.deepEqual(verified[0].to, ['cy@northstar.test'])
  await at('2026-10-30T20:35:00Z'); assert.equal(app.messages.filter(m => /Verified: MFA is on on ana@/.test(m.subject)).length, 1)
  await setMfa({ ana: false, dev: false })
  await at('2026-10-30T20:40:00Z')
  const again = app.messages.filter(m => /Failing: MFA is on on ana@northstar\.test/.test(m.subject) && m.to.includes('cy@northstar.test')); assert.equal(again.length, 2)
  assert.deepEqual((await notices('ana')).map(e => e.body.split('\n')[0]), ['cycle 1 to ana@northstar.test', 'cycle 1 to cy@northstar.test', 'verified cycle 1 to cy@northstar.test', 'cycle 2 to cy@northstar.test'])
  await owner('/api/followups/settings', { timezone: 'America/New_York', calendar_enabled: 'on', business_days: ['1', '2', '3', '4', '5'], holidays: '', quiet_start: '18:00', quiet_end: '09:00', digest_enabled: '0' }, 200)
  assert.equal((await v1(push.token, 'PUT', '/v1/resources/idp_user', { resources: [{ uniqueId: 'late', displayName: 'late@northstar.test', attributes: { mfa: false } }, { uniqueId: 'ana', displayName: 'ana@northstar.test', attributes: { mfa: false } }, { uniqueId: 'dev', displayName: 'dev@northstar.test', attributes: { mfa: false } }] })).status, 200)
  const before = app.messages.length
  await at('2026-10-30T23:30:00Z')
  assert.equal(app.messages.slice(before).filter(m => /late@northstar/.test(m.subject)).length, 0)
  await at('2026-10-31T13:30:00Z'); assert.equal(app.messages.filter(m => /late@northstar/.test(m.subject)).length, 0, 'Saturday is not a business day')
  await at('2026-11-02T14:05:00Z')
  assert.equal(app.messages.filter(m => /Failing: MFA is on on late@northstar/.test(m.subject)).length, 1)
 })
 await scenario('FOLLOWUP-002 / A paused item stays silent until resumed, and a revoked Slack token shows the failed notice with its reason on the obligation', async () => {
  const [late] = (await open()).filter(o => o.resource_name === 'late@northstar.test'); obligation.late = late.id
  await owner(`/api/remediation/${late.id}/assign`, { owner_person_id: people.ana, next_action: 'Turn on MFA' }, 200)
  await owner(`/api/remediation/${late.id}/followups/pause`, { reason: 'Waiting on new phones' }, 200)
  await at('2026-11-02T14:20:00Z')
  assert.equal(slack.posts.filter(p => /Failing: MFA is on on late@/.test(p.text)).length, 0); assert.equal((await notices('late')).length, 1, 'only the control-owner notice exists')
  await owner(`/api/remediation/${late.id}/followups/resume`, {}, 200)
  slack.failNext = 'token_revoked'
  await at('2026-11-02T14:30:00Z')
  const failed = (await notices('late')).at(-1); assert.match(failed.body, /Notice failed/); assert.match(failed.body, /token_revoked/)
 })
 console.log(`${passed} FOLLOWUP-002 scenarios passed`)
} finally { await app.close() }
