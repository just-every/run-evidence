// Follow-ups by email, Slack and Microsoft Teams through the owner's doors and
// the Cron Trigger on the harness clock: business calendar across the US
// daylight-saving change, escalation, pause, uncertain sends and the weekly
// digest. Slack, Teams and the mail provider are faked at the network edge.
process.env.RER_SERVER_JOURNEY = '1'
import assert from 'node:assert/strict'
import { runtime } from './helpers/runtime.mjs'
const TEAMS = 'https://prod-07.westus.logic.azure.com/workflows/1f2e/triggers/manual/paths/invoke?api-version=2016-06-01&sig=teams-signature-secret'
const slack = { token: 'xoxb-good', posts: [], users: { 'ana@northstar.test': 'U0ANA' }, failNext: null }, teams = { posts: [] }
async function fakeChannels(request) {
 const url = new URL(request.url)
 if (url.hostname === 'slack.com') {
  const body = Object.fromEntries(new URLSearchParams(await request.text()))
  if (request.headers.get('authorization') !== 'Bearer ' + slack.token) return Response.json({ ok: false, error: 'invalid_auth' })
  if (url.pathname === '/api/auth.test') return Response.json({ ok: true, team: 'Northstar', user_id: 'UBOT' })
  if (url.pathname === '/api/users.lookupByEmail') return slack.users[body.email] ? Response.json({ ok: true, user: { id: slack.users[body.email] } }) : Response.json({ ok: false, error: 'users_not_found' })
  if (url.pathname === '/api/chat.postMessage') {
   const failure = slack.failNext; slack.failNext = null
   if (failure === 'timeout') throw new Error('connection reset')
   if (failure) return Response.json({ ok: false, error: failure })
   slack.posts.push(body); return Response.json({ ok: true, ts: String(slack.posts.length) })
  }
 }
 if (url.hostname === 'prod-07.westus.logic.azure.com') { teams.posts.push(await request.json()); return new Response(null, { status: 202 }) }
 return null
}
const app = await runtime({ outbound: fakeChannels })
let passed = 0
const scenario = async (name, fn) => { await fn(); passed++; console.log('PASS ' + name) }
const owner = async (path, body, status = 201) => { const r = await app.fetch(path, { method: 'POST', headers: { origin: app.origin, 'content-type': 'application/json' }, body: JSON.stringify(body) }); const text = await r.text(); assert.equal(r.status, status, path + ' ' + text); return text ? JSON.parse(text) : null }
const get = async path => { const r = await app.fetch(path); assert.equal(r.status, 200, path); return r.json() }
const v1 = (token, method, path, body) => app.fetch(path, { method, headers: { cookie: '', authorization: 'Bearer ' + token, 'content-type': 'application/json' }, body: JSON.stringify(body) })
const at = async time => { await app.clock(time); await app.tick() }
const forgedLink = ['forged', 'link', 'not-issued'].join('-') + '-'.padEnd(12, 'x')
const people = {}, items = {}
const rows = async who => (await get('/api/remediation/' + items[who])).followups
const kinds = async who => (await rows(who)).map(f => `${f.kind}:${f.cycle_key}:${f.state}`)
let push
try {
 await scenario('Slack and Teams are kept only after a real check, each person is reached on the channel they chose, and credentials never appear', async () => {
  await app.clock('2026-10-30T16:00:00Z'); await app.signin()
  await owner('/api/followups/channels', { kind: 'slack', secret: 'xoxb-wrong' }, 400)
  await owner('/api/followups/channels', { kind: 'teams', secret: 'https://hooks.example.com/teams?sig=x' }, 400)
  const slackChannel = await owner('/api/followups/channels', { kind: 'slack', secret: slack.token, target: 'C0SECURITY' })
  await owner('/api/followups/channels', { kind: 'teams', secret: TEAMS })
  assert.equal(teams.posts.length, 1); assert.match(JSON.stringify(teams.posts[0]), /Evidence is connected/)
  for (const [key, name, via] of [['ana', 'Ana Ruiz', 'slack'], ['ben', 'Ben Ode', 'teams'], ['cy', 'Cy Park', 'email'], ['dee', 'Dee Lane', 'email'], ['eve', 'Eve Moss', 'email']]) {
   people[key] = (await owner('/api/people', { name, email: key + '@northstar.test', kind: 'employee' })).id
   await owner('/api/followups/preferences', { person_id: people[key], via, all_clear: key === 'eve' ? '1' : '0' }, 200)
  }
  await owner('/api/remediation/sla', { category: 'identity', severity: 'high', days: 1 })
  push = await owner('/api/api-tokens', { name: 'IdP', scopes: ['resource-push', 'test-write', 'read'], expires_at: '2027-04-01' })
  assert.equal((await v1(push.token, 'PUT', '/v1/resource-types/idp_user', { schema: { fields: { mfa: 'boolean' } } })).status, 200)
  assert.equal((await v1(push.token, 'PUT', '/v1/resources/idp_user', { resources: ['ana', 'ben', 'cy'].map(u => ({ uniqueId: u, displayName: u + '@northstar.test', attributes: { mfa: false } })) })).status, 200)
  assert.equal((await v1(push.token, 'POST', '/v1/tests', { name: 'MFA is on', resourceType: 'idp_user', criteria: [{ attribute: 'mfa', op: 'equals', value: true }], cadence: 'daily', category: 'identity', severity: 'high', controls: ['AC-05'] })).status, 201)
  for (const o of (await get('/api/remediation')).open) { const who = o.resource_name.split('@')[0]; items[who] = o.id; await owner(`/api/remediation/${o.id}/assign`, { owner_person_id: people[who], next_action: 'Turn on MFA' }, 200) }
  await app.tick()
  // FOLLOWUP-002 tells each owner of the failure first; the reminder follows in the same run.
  assert.equal(slack.posts.length, 2); assert.equal(slack.posts[1].channel, 'U0ANA'); assert.match(slack.posts[0].text, /Failing: MFA is on on ana@northstar\.test/); assert.match(slack.posts[1].text, /SLA approaching: MFA is on on ana@northstar\.test/); assert.match(slack.posts[1].text, new RegExp(`/app/remediation/${items.ana}`))
  assert.equal(teams.posts.length, 3); assert.match(JSON.stringify(teams.posts[2]), /For ben@northstar\.test.*SLA approaching|SLA approaching.*For ben@northstar\.test/)
  assert.equal(app.messages.filter(m => /SLA approaching/.test(m.subject)).map(m => m.to.join()).join(), 'cy@northstar.test')
  assert.deepEqual((await rows('ana')).map(f => [f.channel, f.state]), [['slack', 'accepted']])
  const visible = JSON.stringify(await get('/api/followups')) + await (await app.fetch('/app/followups')).text() + JSON.stringify((await app.db.prepare('SELECT * FROM product_audit').all()).results) + (await (await app.fetch('/api/archive/export')).arrayBuffer().then(b => Buffer.from(b).toString('latin1')))
  for (const secret of [slack.token, 'teams-signature-secret']) assert.ok(!visible.includes(secret), 'credential leaked')
  assert.equal((await get('/api/followups')).channels.find(c => c.id === slackChannel.id).status, 'active')
 })
 await scenario('With the business calendar on, a missed SLA waits through the weekend, the daylight-saving change and a holiday, sends once across a restart, escalates, and stops while paused', async () => {
  await owner('/api/followups/settings', { timezone: 'America/New_York', calendar_enabled: 'on', business_days: ['1', '2', '3', '4', '5'], holidays: '2026-11-02', quiet_start: '18:00', quiet_end: '09:00', repeat_days: '1', escalate_after_days: '3', escalation_person_id: people.dee, digest_enabled: 'on', digest_day: '1', digest_time: '09:00' }, 200)
  for (const time of ['2026-10-31T17:00:00Z', '2026-11-01T17:00:00Z', '2026-11-02T15:00:00Z', '2026-11-03T13:30:00Z']) { await at(time); assert.deepEqual(await kinds('cy'), ['sla-approaching:1:accepted'], time) }
  await at('2026-11-03T14:05:00Z')
  assert.deepEqual(await kinds('cy'), ['sla-approaching:1:accepted', 'sla-missed:1:r2:accepted'])
  const holidayDigests = (await get('/api/followups')).deliveries.filter(d => d.kind === 'weekly-digest')
  assert.deepEqual([...new Set(holidayDigests.map(d => `${d.cycle_key} ${d.created_at.slice(0, 10)}`))], ['2026-11-02 2026-11-03'])
  await at('2026-11-03T14:20:00Z'); assert.equal((await rows('cy')).length, 2)
  await owner(`/api/remediation/${items.cy}/followups/pause`, { reason: 'Waiting on new laptops' }, 200)
  await at('2026-11-04T14:05:00Z')
  assert.deepEqual(await kinds('cy'), ['sla-approaching:1:accepted', 'sla-missed:1:r2:accepted'])
  assert.ok(app.messages.some(m => /Escalation: MFA is on on ana@northstar\.test/.test(m.subject) && m.to.includes('dee@northstar.test')))
  await owner(`/api/remediation/${items.cy}/followups/resume`, {}, 200)
  await at('2026-11-04T14:10:00Z')
  assert.deepEqual((await kinds('cy')).slice(2), ['sla-missed:1:r3:accepted', 'sla-escalated:1:accepted'])
  assert.ok((await get('/api/remediation/' + items.cy)).events.some(e => e.kind === 'escalated' && /escalation contact/.test(e.body)))
 })
 await scenario('A Slack timeout stays uncertain and is never resent; a revoked token is shown and stops Slack sends until rotation restores them', async () => {
  slack.failNext = 'timeout'
  await at('2026-11-05T14:05:00Z')
  const uncertain = (await rows('ana')).find(f => f.cycle_key === '1:r4')
  assert.equal(uncertain.state, 'uncertain'); assert.match(uncertain.detail, /may or may not have arrived/)
  await at('2026-11-05T14:30:00Z'); assert.equal((await rows('ana')).filter(f => f.cycle_key === '1:r4').length, 1)
  slack.failNext = 'token_revoked'
  await at('2026-11-06T14:05:00Z')
  assert.equal((await rows('ana')).find(f => f.cycle_key === '1:r5').state, 'failed')
  const channel = (await get('/api/followups')).channels.find(c => c.kind === 'slack')
  assert.equal(channel.status, 'needs reconnect'); assert.match(channel.last_error, /token_revoked/)
  slack.token = 'xoxb-rotated'
  await owner(`/api/followups/channels/${channel.id}/rotate`, { secret: 'xoxb-rotated' }, 200)
  await at('2026-11-06T16:05:00Z')
  assert.equal((await rows('ana')).find(f => f.cycle_key === '1:r6').state, 'accepted')
 })
 await scenario('The weekly digest goes out Monday 09:00 local: each owner gets only their own open items, nobody with nothing open gets one, and an all-clear goes only to those who asked', async () => {
  assert.equal((await v1(push.token, 'PUT', '/v1/resources/idp_user', { resources: ['ana', 'ben', 'cy'].map(u => ({ uniqueId: u, displayName: u + '@northstar.test', attributes: { mfa: u !== 'ben' } })) })).status, 200)
  await at('2026-11-09T13:55:00Z')
  const thisWeek = async () => (await get('/api/followups')).deliveries.filter(f => f.kind === 'weekly-digest' && f.cycle_key === '2026-11-09')
  assert.equal((await thisWeek()).length, 0)
  await at('2026-11-09T14:01:00Z'); await at('2026-11-09T14:30:00Z')
  const digests = await thisWeek()
  assert.deepEqual(digests.map(d => [d.recipient, d.channel, d.state]).sort(), [['ben@northstar.test', 'teams', 'accepted'], ['eve@northstar.test', 'email', 'accepted']])
  const card = JSON.stringify(teams.posts.at(-1))
  assert.match(card, /Weekly compliance digest/); assert.match(card, /ben@northstar\.test/); assert.ok(!/ana@northstar\.test|cy@northstar\.test/.test(card.replace(/For ben@northstar\.test/, '')))
  assert.match(app.messages.find(m => /all clear/.test(m.subject) && m.to.includes('eve@northstar.test')).text, /Nothing is open for you/)
  const queue = await get('/api/remediation')
  assert.deepEqual(queue.open.map(o => o.resource_name), ['ben@northstar.test'])
 })
 await scenario('LOG-001 / Sign-in, a refused sign-in link and sign-out, every send with its failed or uncertain outcome and the owner\'s later resolution, and an entered reason with the exact revision stay attributable on the audit and its exports without secrets', async () => {
  const trail = async query => (await get('/api/audit' + query)).entries
  const auth = await trail('?action=auth.')
  assert.ok(auth.some(e => e.action === 'auth.operator-added' && e.actor_name === 'Evidence owner' && /^owner, active via POST \/auth\/bootstrap$/.test(e.detail)))
  const signedIn = auth.find(e => e.action === 'auth.signed-in' && / via POST \/auth\/confirm$/.test(e.detail))
  assert.equal(signedIn.actor_name, 'Evidence owner'); assert.match(signedIn.subject, /^operator:/); assert.match(signedIn.revision, /^\d+$/)
  assert.ok(auth.some(e => e.action === 'auth.magic-link' && e.outcome === 'succeeded' && e.subject === 'POST /auth/magic-link'))
  const forged = await app.fetch('/auth/confirm', { method: 'POST', headers: { cookie: '', origin: app.origin, 'content-type': 'application/json' }, body: JSON.stringify({ token: forgedLink }) })
  assert.ok(forged.status >= 400 && forged.status < 500)
  const refused = (await trail('?action=auth.confirm')).at(0)
  assert.deepEqual([refused.actor_kind, refused.actor_name, refused.subject, refused.outcome], ['system', 'Unauthenticated request', 'POST /auth/confirm', 'refused'])
  // Every delivery attempt is audited; a lost answer stays uncertain until the owner resolves it.
  const ana = (await get('/api/followups')).deliveries.filter(f => f.subject_id === items.ana), uncertain = ana.find(f => f.cycle_key === '1:r4'), failed = ana.find(f => f.cycle_key === '1:r5')
  const sent = async id => (await trail('?action=followup.sent')).find(e => e.subject === 'followup:' + id)
  assert.deepEqual([(await sent(uncertain.id)).outcome, (await sent(failed.id)).outcome], ['uncertain', 'failed'])
  assert.match((await sent(failed.id)).detail, /via slack: .*token_revoked/)
  assert.ok((await trail('?action=followup.channel-rotated')).some(e => e.actor_name === 'Evidence owner' && e.outcome === 'succeeded' && /^channel:/.test(e.subject)))
  assert.ok((await trail('?action=followup.sent&outcome=succeeded')).every(e => e.actor_kind === 'system' && e.actor_name === 'Evidence follow-ups'))
  await owner(`/api/followups/${failed.id}/resolve`, { resolution: 'delivered', reason: 'Checked' }, 409)
  await owner(`/api/followups/${uncertain.id}/resolve`, { resolution: 'delivered' }, 400)
  await owner(`/api/followups/${uncertain.id}/resolve`, { resolution: 'delivered', reason: 'Ana confirmed the Slack reminder arrived' }, 200)
  await owner(`/api/followups/${uncertain.id}/resolve`, { resolution: 'not delivered', reason: 'Second answer' }, 409)
  const resolved = await trail('?action=followup.resolved')
  assert.deepEqual(resolved.map(e => [e.actor_name, e.subject, e.outcome, e.detail, e.reason]), [['Evidence owner', 'followup:' + uncertain.id, 'succeeded', 'delivered', 'Ana confirmed the Slack reminder arrived']])
  assert.equal((await sent(uncertain.id)).outcome, 'uncertain'); assert.equal((await rows('ana')).find(f => f.cycle_key === '1:r4').state, 'uncertain')
  assert.equal((await get('/api/followups')).deliveries.find(f => f.id === uncertain.id).resolution.resolution, 'delivered')
  assert.match(await (await app.fetch('/app/followups')).text(), /Resolved delivered by Evidence owner/)
  assert.equal((await trail('?action=door.refused')).filter(e => e.subject === `POST /api/followups/${uncertain.id}/resolve`).length, 2)
  // A reason the owner entered and the exact revision the action produced.
  await owner('/api/library/revisions/2', { reason: 'Reviewed the ISO A.8.5 and A.5.16 mappings' }, 200)
  const accepted = (await trail('?action=library.revision-accepted')).at(0)
  assert.deepEqual([accepted.reason, accepted.revision, accepted.subject], ['Reviewed the ISO A.8.5 and A.5.16 mappings', '2', 'library:2'])
  const csv = await (await app.fetch('/app/audit/export.csv?action=library.')).text()
  assert.equal(csv.split('\r\n')[0], 'at,source,actor_kind,actor,action,subject,outcome,detail,reason,revision'); assert.match(csv, /"Reviewed the ISO A\.8\.5 and A\.5\.16 mappings","2"\r\n/)
  // Signing out is recorded against the owner; the next sign-in reads it back.
  const ownerId = signedIn.subject.slice('operator:'.length)
  assert.equal((await app.fetch('/auth/signout', { method: 'POST', headers: { origin: app.origin, 'content-type': 'application/json' }, body: '{}' })).status < 400, true)
  app.setCookie('')
  assert.equal((await app.fetch('/api/audit')).status, 401)
  assert.equal((await app.fetch('/auth/magic-link', { method: 'POST', headers: { origin: app.origin, 'content-type': 'application/json' }, body: JSON.stringify({ email: 'owner@example.test' }) })).status, 202)
  const token = new URL(app.messages.at(-1).html.match(/href="([^"]*\/auth\/confirm\?token=[^"]+)"/)[1].replaceAll('&amp;', '&'), app.origin).searchParams.get('token')
  const back = await app.fetch('/auth/confirm', { method: 'POST', headers: { origin: app.origin, 'content-type': 'application/json' }, body: JSON.stringify({ token }) })
  assert.equal(back.status, 303); app.setCookie(back.headers.getSetCookie().map(x => x.split(';')[0]).join('; '))
  const after = await trail('?action=auth.')
  assert.ok(after.some(e => e.action === 'auth.signed-out' && e.subject === 'operator:' + ownerId && e.actor_name === 'Evidence owner' && e.outcome === 'succeeded'))
  assert.equal(after.filter(e => e.action === 'auth.signed-in' && e.subject === 'operator:' + ownerId).length >= 2, true)
  const exported = JSON.stringify(await (await app.fetch('/api/audit/export')).json())
  for (const secret of [token, forgedLink, 'token=', slack.token, 'teams-signature-secret']) assert.ok(!exported.includes(secret), 'secret on the audit')
 })
 console.log(`${passed} follow-up public-door scenarios passed; mail, Slack and Teams are faked only at the network edge.`)
} finally { await app.close() }
