// Per-item remediation SLAs and the board and auditor report through public
// doors: owner JSON doors, the v1 API, the CSV export and the Cron Trigger.
// Only the mail provider and GitHub are faked, at the network edge.
process.env.RER_SERVER_JOURNEY = '1'
import assert from 'node:assert/strict'
import { runtime } from './helpers/runtime.mjs'
const github = { up: true }
async function fakeGitHub(request) {
 const url = new URL(request.url)
 if (url.origin !== 'https://api.github.com') return null
 if (!github.up) return new Response('{}', { status: 503 })
 if (url.pathname === '/orgs/northstar') return Response.json({ login: 'northstar', two_factor_requirement_enabled: true }, { headers: { 'x-ratelimit-remaining': '4999' } })
 if (url.pathname === '/orgs/northstar/repos') return Response.json([], { headers: { 'x-ratelimit-remaining': '4999' } })
 return Response.json({ message: 'Not Found' }, { status: 404 })
}
const app = await runtime({ outbound: fakeGitHub })
let passed = 0
const scenario = async (name, fn) => { await fn(); passed++; console.log('PASS ' + name) }
const owner = async (path, body, status = 201) => { const r = await app.fetch(path, { method: 'POST', headers: { origin: app.origin, 'content-type': 'application/json' }, body: JSON.stringify(body) }); const text = await r.text(); assert.equal(r.status, status, path + ' ' + text); return text ? JSON.parse(text) : null }
const get = async path => { const r = await app.fetch(path); assert.equal(r.status, 200, path); return r.json() }
const v1 = (token, method, path, body) => app.fetch(path, { method, headers: { cookie: '', authorization: 'Bearer ' + token, 'content-type': 'application/json' }, body: JSON.stringify(body) })
const users = broken => ['ana', 'ben', 'cy'].map(u => ({ uniqueId: u, displayName: u + '@northstar.test', attributes: { mfa: !broken.includes(u) } }))
const csvRows = text => text.trim().split('\r\n').slice(1).map(line => line.split(','))
const DAY = 86400000
const detail = id => get('/api/remediation/' + id)
const shifted = (at, milliseconds) => new Date(Date.parse(at) + milliseconds).toISOString()
let program, push, testId, firstItems, anaOwner, benOwner
try {
 await scenario('REMEDY-002: A 7-day identity SLA gives each failing user its own clock: one resolved within SLA, one missed with one escalation, and readiness, test history and the queue agree', async () => {
  await app.signin()
  program = (await owner('/api/programs', { framework: 'soc2', name: 'SOC 2', legal_entity: 'Northstar', report_type: 'Type II', audit_from: '2026-10-01', audit_to: '2026-12-31' })).id
  await owner('/api/remediation/sla', { category: 'identity', severity: 'high', days: 7 })
  push = await owner('/api/api-tokens', { name: 'IdP export', scopes: ['resource-push', 'test-write', 'read'], expires_at: '2027-04-01' })
  assert.equal((await v1(push.token, 'PUT', '/v1/resource-types/idp_user', { schema: { fields: { mfa: 'boolean' } } })).status, 200)
  assert.equal((await v1(push.token, 'PUT', '/v1/resources/idp_user', { resources: users(['ana', 'ben']) })).status, 200)
  testId = (await (await v1(push.token, 'POST', '/v1/tests', { name: 'People sign in with MFA', resourceType: 'idp_user', criteria: [{ attribute: 'mfa', op: 'equals', value: true }], cadence: 'hourly', category: 'identity', severity: 'high', controls: ['AC-05'] })).json()).id
  firstItems = (await get('/api/remediation')).open
  assert.deepEqual(firstItems.map(o => o.resource_name).sort(), ['ana@northstar.test', 'ben@northstar.test'])
  assert.equal(new Set(firstItems.map(o => o.id)).size, 2)
  assert.equal(new Set(firstItems.map(o => o.resource_id)).size, 2)
  for (const item of firstItems) {
   const history = await detail(item.id)
   assert.equal(item.clock_started_at, history.observations.at(-1).observed_at)
   assert.equal(history.observations.at(-1).result, 'fail')
   assert.equal(item.sla.due, shifted(item.clock_started_at, 7 * DAY))
   assert.equal(item.sla.status, 'within SLA'); assert.equal(item.sla.paused, false)
   assert.ok(item.sla_policy_id)
  }
  anaOwner = (await owner('/api/people', { name: 'Ana owner', email: 'ana-owner@northstar.test', kind: 'employee' })).id
  benOwner = (await owner('/api/people', { name: 'Ben owner', email: 'ben-owner@northstar.test', kind: 'employee' })).id
  for (const item of firstItems) await owner(`/api/remediation/${item.id}/assign`, { owner_person_id: item.resource_name.startsWith('ana') ? anaOwner : benOwner, next_action: 'Enable MFA' }, 200)
  await app.clock('2026-10-14T12:00:00Z')
  await owner('/api/remediation/sla', { category: 'identity', severity: 'high', days: 10 })
  assert.equal((await v1(push.token, 'PUT', '/v1/resources/idp_user', { resources: users(['ben']) })).status, 200)
  const fixed = await detail(firstItems.find(o => o.resource_name.startsWith('ana')).id)
  assert.equal(fixed.obligation.state, 'verified')
  assert.equal(fixed.observations[0].run_trigger, 'source-change'); assert.equal(fixed.observations[0].result, 'pass')
  assert.equal(fixed.obligation.closed_at, '2026-10-14T12:00:00.000Z')
  await app.tick()
  await app.clock('2026-10-17T12:00:00Z')
  const approaching = (await get('/api/remediation')).open.find(o => o.resource_name.startsWith('ben'))
  assert.equal(approaching.sla.status, 'approaching')
  assert.equal((await get('/api/tests/' + testId)).latest.find(o => o.display_name.startsWith('ben')).sla, 'approaching')
  assert.equal((await get('/api/programs/' + program)).readiness.totals.sla_approaching, 1)
  await app.clock('2026-10-18T13:00:00Z'); await app.tick(); await app.tick()
  const escalations = app.messages.filter(m => /SLA missed/.test(m.subject))
  assert.equal(escalations.length, 1); assert.match(escalations[0].subject, /ben@northstar\.test/)
  const queue = await get('/api/remediation')
  const ben = queue.open.find(o => o.resource_name === 'ben@northstar.test'), ana = queue.resolved.find(o => o.resource_name === 'ana@northstar.test')
  for (const item of [ana, ben]) {
   const original = firstItems.find(o => o.id === item.id)
   assert.equal(item.clock_started_at, original.clock_started_at)
   assert.equal(item.sla.due, original.sla.due)
   assert.equal(item.sla_policy_id, original.sla_policy_id)
  }
  assert.equal(ana.sla.hoursToRemediate, 72)
  assert.equal(ben.sla.hoursToRemediate, null)
  assert.equal(ben.sla.status, 'SLA missed'); assert.equal(ben.sla_days, 7); assert.equal(ana.sla.status, 'resolved within SLA')
  const results = Object.fromEntries((await get('/api/tests/' + testId)).latest.map(o => [o.display_name, [o.result, o.sla]]))
  assert.deepEqual(results, { 'ana@northstar.test': ['pass', 'resolved within SLA'], 'ben@northstar.test': ['fail', 'SLA missed'], 'cy@northstar.test': ['pass', null] })
  const totals = (await get('/api/programs/' + program)).readiness.totals
  assert.deepEqual([totals.open_obligations, totals.sla_missed, totals.sla_approaching, totals.sla_within], [1, 1, 0, 0])
 })
 await scenario('REMEDY-002: The board report reconciles per-item SLA, freshness, exceptions, policies and trend in JSON and CSV; a filter narrows items and never improves readiness', async () => {
  const connection = await owner('/api/connections', { account: 'northstar', token: 'github_pat_any' })
  await owner(`/api/connections/${connection.id}/collect`, {})
  github.up = false
  await app.clock('2026-10-19T13:00:00Z'); await app.tick()
  const ben = (await get('/api/remediation')).open.find(o => o.resource_name === 'ben@northstar.test')
  await owner(`/api/tests/${testId}/exceptions`, { resource_id: ben.resource_id, reason: 'Hardware key on order', expires_at: '2026-10-26T00:00' })
  const report = await get('/api/programs/' + program + '/board')
  assert.equal(report.certification.startsWith('None asserted'), true)
  assert.deepEqual(report.sla, { open: 1, within: 0, approaching: 0, missed: 1, resolved_within: 1, resolved_after: 0 })
  assert.deepEqual(report.items.map(i => [i.item, i.sla]).sort(), [['ana@northstar.test', 'resolved within SLA'], ['ben@northstar.test', 'SLA missed']])
  assert.equal(report.overdue.length, 1); assert.equal(report.overdue[0].item, 'ben@northstar.test'); assert.ok(report.items.find(i => i.item === 'ben@northstar.test').sla_paused)
  assert.ok(report.freshness.find(f => f.kind === 'collector').stale)
  assert.equal(report.exceptions.length, 1); assert.equal(report.exceptions[0].approved_name, 'Evidence owner')
  assert.equal(report.tests.find(t => t.id === testId).last_run.slice(0, 10), '2026-10-19')
  const aup = report.policies.find(p => p.title === 'Acceptable use policy'); assert.equal(aup.state, 'not published')
  assert.deepEqual(report.trend.map(s => s.day), ['2026-10-14', '2026-10-18', '2026-10-19'])
  assert.equal(report.periods.current.snapshot_day, '2026-10-19'); assert.equal(report.periods.prior.from, '2026-07-01'); assert.equal(report.periods.prior.to, '2026-09-30'); assert.match(report.periods.prior.note, /No snapshot/)
  assert.deepEqual(report.readiness, (await get('/api/programs/' + program)).readiness.totals)
  const csv = await app.fetch(`/app/programs/${program}/board.csv`)
  assert.equal(csv.status, 200); assert.match(csv.headers.get('content-disposition'), /attachment/)
  const csvText = await csv.text(), rows = csvRows(csvText)
  const queue = await get('/api/remediation')
  for (const item of report.items) {
   const obligation = [...queue.open, ...queue.resolved].find(o => o.id === item.obligation)
   assert.deepEqual([item.opened, item.due, item.sla, item.owner_person_id, item.category, item.hours_to_remediate], [obligation.clock_started_at, obligation.sla.due, obligation.sla.status, obligation.owner_person_id, obligation.category, obligation.sla.hoursToRemediate])
   const row = rows.find(r => r[0] === 'remediation' && r[1] === item.obligation)
   assert.deepEqual(row.slice(3, 8), [item.state, item.sla, item.due, item.owner, `${item.category} ${item.severity}`])
  }
  assert.deepEqual(rows.filter(r => r[0] === 'remediation').map(r => [r[1], r[4]]).sort(), report.items.map(i => [i.obligation, i.sla]).sort())
  assert.equal(rows.filter(r => r[0] === 'trend').length, report.trend.length); assert.equal(rows.filter(r => r[0] === 'policy').length, report.policies.length)
  const filtered = await get(`/api/programs/${program}/board?severity=low`)
  assert.equal(filtered.items.length, 0); assert.deepEqual(filtered.readiness, report.readiness); assert.equal(filtered.sla.missed, 0)
  const page = await (await app.fetch(`/app/programs/${program}/board`)).text()
  assert.match(page, /SLA missed/); assert.match(page, /Export CSV/)
  for (const [query, names] of [
   [`owner=${anaOwner}`, ['ana@northstar.test']],
   [`owner=${benOwner}`, ['ben@northstar.test']],
   ['category=identity', ['ana@northstar.test', 'ben@northstar.test']],
   ['category=device', []],
   ['from=2026-10-11&to=2026-10-11', ['ana@northstar.test', 'ben@northstar.test']],
   ['from=2026-10-12&to=2026-10-19', []],
   [`owner=${anaOwner}&category=identity&from=2026-10-11&to=2026-10-11`, ['ana@northstar.test']],
  ]) {
   const narrowed = await get(`/api/programs/${program}/board?${query}`)
   assert.deepEqual(narrowed.items.map(i => i.item).sort(), names)
   assert.deepEqual(narrowed.readiness, report.readiness)
   assert.deepEqual(narrowed.items, report.items.filter(i => names.includes(i.item)))
   const exported = await app.fetch(`/app/programs/${program}/board.csv?${query}`)
   assert.equal(exported.status, 200)
   assert.deepEqual(csvRows(await exported.text()).filter(r => r[0] === 'remediation').map(r => [r[1], r[4], r[5]]).sort(), narrowed.items.map(i => [i.obligation, i.sla, i.due]).sort())
  }
  const history = await get(`/api/remediation?owner=${anaOwner}&category=identity&from=2026-10-14&to=2026-10-14`)
  assert.deepEqual(history.resolved.map(o => [o.resource_name, o.sla.hoursToRemediate]), [['ana@northstar.test', 72]])
  assert.deepEqual((await get(`/api/remediation?owner=${anaOwner}&from=2026-10-15`)).resolved, [])
  const audit = (await app.db.prepare("SELECT detail FROM product_audit WHERE action='program.board-exported' ORDER BY rowid").all()).results.map(r => r.detail)
  assert.equal(audit.filter(kind => kind === 'json').length, 9)
  assert.equal(audit.filter(kind => kind === 'csv').length, 8)
  // The downloadable auditor report must carry the same per-item duration as JSON.
  const headers = csvText.split('\r\n')[0].split(','), duration = headers.indexOf('hours_to_remediate')
  assert.ok(duration >= 0, 'REMEDY-002 CSV export omits per-item time-to-remediate history')
  for (const item of report.items) assert.equal(rows.find(r => r[0] === 'remediation' && r[1] === item.obligation)[duration], item.hours_to_remediate === null ? '' : String(item.hours_to_remediate))
 })
 await scenario('REMEDY-002: Approved expiring exceptions pause only their bounded interval; failed work keeps its clock and a verified fix alone permits a new regression clock', async () => {
  const original = firstItems.find(o => o.resource_name === 'ben@northstar.test')
  const before = await detail(original.id)
  const pauseStart = '2026-10-19T13:00:00.000Z', expiry = '2026-10-26T00:00:00.000Z'
  assert.equal(before.obligation.sla.pausedMs, 0)
  await owner(`/api/tests/${testId}/exceptions`, { resource_id: original.resource_id, reason: 'No indefinite exception', expires_at: '2026-10-19T12:00' }, 400)
  await owner(`/api/tests/${testId}/exceptions`, { resource_id: original.resource_id, reason: 'No missing expiry' }, 400)
  await app.clock('2026-10-20T13:00:00Z')
  let current = (await detail(original.id)).obligation
  assert.equal(current.sla.paused, true); assert.equal(current.sla.pausedMs, DAY)
  assert.equal(current.sla.due, shifted(original.sla.due, DAY))
  assert.equal(current.clock_started_at, original.clock_started_at)
  // Overlapping approvals cannot pause one clock twice for the same time.
  await owner(`/api/tests/${testId}/exceptions`, { resource_id: original.resource_id, reason: 'Overlapping hardware-key approval', expires_at: '2026-10-22T13:00' })
  await owner(`/api/remediation/${original.id}/done`, { body: 'Ticket work completed; source still fails' }, 200)
  assert.equal((await detail(original.id)).obligation.state, 'awaiting verification')
  await app.clock('2026-10-20T13:05:00Z'); await app.tick()
  const failed = await detail(original.id)
  assert.equal(failed.obligation.state, 'open')
  assert.equal(failed.observations[0].run_trigger, 'retest'); assert.equal(failed.observations[0].result, 'fail')
  assert.equal(failed.obligation.clock_started_at, original.clock_started_at)
  assert.equal(failed.obligation.sla_policy_id, original.sla_policy_id)
  assert.equal(failed.obligation.cycles, original.cycles)
  await app.clock(expiry)
  current = (await detail(original.id)).obligation
  const boundedPause = Date.parse(expiry) - Date.parse(pauseStart)
  assert.equal(current.sla.paused, false)
  assert.equal(current.sla.pausedMs, boundedPause, 'overlapping exceptions must count their union, not their summed durations')
  assert.equal(current.sla.due, shifted(original.sla.due, boundedPause))
  await app.clock('2026-10-27T00:00:00Z')
  const resumed = (await detail(original.id)).obligation
  assert.equal(resumed.sla.pausedMs, boundedPause); assert.equal(resumed.sla.due, current.sla.due)
  assert.equal(resumed.sla.status, 'SLA missed')
  assert.equal((await v1(push.token, 'PUT', '/v1/resources/idp_user', { resources: users([]) })).status, 200)
  const fixed = await detail(original.id)
  assert.equal(fixed.obligation.state, 'verified'); assert.equal(fixed.obligation.sla.status, 'resolved after SLA')
  assert.equal(fixed.obligation.clock_started_at, original.clock_started_at)
  assert.equal(fixed.observations[0].run_trigger, 'source-change'); assert.equal(fixed.observations[0].result, 'pass')
  const verifiedEvent = fixed.events.find(e => e.kind === 'verified')
  assert.ok(verifiedEvent?.observation_id)
  await app.tick()
  const historyQuery = `snapshot=2026-10-27&owner=${benOwner}&category=identity&from=2026-10-11&to=2026-10-11`
  const resolutionReport = await get(`/api/programs/${program}/board?${historyQuery}`)
  assert.deepEqual(resolutionReport.items.map(i => [i.obligation, i.sla, i.hours_to_remediate]), [[original.id, 'resolved after SLA', fixed.obligation.sla.hoursToRemediate]])
  await app.clock('2026-10-28T00:00:00Z')
  assert.equal((await v1(push.token, 'PUT', '/v1/resources/idp_user', { resources: users(['ben', 'cy']) })).status, 200)
  const regressed = await detail(original.id)
  assert.equal(regressed.obligation.id, original.id); assert.equal(regressed.obligation.resource_id, original.resource_id)
  assert.equal(regressed.obligation.state, 'open'); assert.equal(regressed.obligation.cycles, original.cycles + 1)
  assert.equal(regressed.obligation.clock_started_at, '2026-10-28T00:00:00.000Z')
  assert.equal(regressed.obligation.sla_days, 10); assert.notEqual(regressed.obligation.sla_policy_id, original.sla_policy_id)
  assert.equal(regressed.obligation.sla.due, shifted(regressed.obligation.clock_started_at, 10 * DAY))
  assert.equal(regressed.obligation.sla.pausedMs, 0); assert.equal(regressed.obligation.closed_at, null)
  assert.equal(regressed.obligation.verified_observation_id, null)
  assert.ok(regressed.events.some(e => e.kind === 'reopened'))
  assert.ok(regressed.events.some(e => e.kind === 'verified' && e.observation_id === verifiedEvent.observation_id))
  for (const observation of fixed.observations) assert.ok(regressed.observations.some(o => JSON.stringify(o) === JSON.stringify(observation)), 'regression erased a prior observation')
  const newlyFailed = (await get('/api/remediation')).open.find(o => o.resource_name === 'cy@northstar.test')
  assert.equal(newlyFailed.sla_days, 10); assert.equal(newlyFailed.sla_policy_id, regressed.obligation.sla_policy_id)
  assert.equal(newlyFailed.clock_started_at, regressed.obligation.clock_started_at)
  assert.notEqual(newlyFailed.id, regressed.obligation.id)
  const historical = await get(`/api/programs/${program}/board?${historyQuery}`)
  assert.deepEqual(historical.items, resolutionReport.items, 'regression changed the recorded time-to-remediate history')
 })
 await scenario('REMEDY-002: Owner-defined and API-defined tests in every category start with shipped defaults and preserve independent clocks when the owner changes policy', async () => {
  // These are custom/API controls, not evidence of the missing VULN-001 or
  // ISSUES-001 integrations or their distinct source-owned lifecycle semantics.
  for (const [index, category] of ['cloud', 'identity', 'code', 'device', 'vulnerability', 'security issue', 'personnel', 'policy', 'vendor'].entries()) {
   const type = 'sla_category_' + index, days = index + 2
   assert.equal((await v1(push.token, 'PUT', '/v1/resource-types/' + type, { schema: { fields: { healthy: 'boolean' } } })).status, 200)
   const resources = ['first', 'later'].map(uniqueId => ({ uniqueId, displayName: `${category} ${uniqueId}`, attributes: { healthy: uniqueId === 'later' } }))
   assert.equal((await v1(push.token, 'PUT', '/v1/resources/' + type, { resources })).status, 200)
   const testIds = []
   for (const origin of ['custom', 'api']) {
    const definition = { name: `${category} ${origin} SLA`, resourceType: type, criteria: [{ attribute: 'healthy', op: 'equals', value: true }], cadence: 'daily', category, severity: 'medium' }
    let test
    if (origin === 'custom') {
     test = await owner('/api/tests', {...definition,criteria:JSON.stringify(definition.criteria)})
     await owner(`/api/tests/${test.id}/run`, {}, 200)
    } else {
     const response = await v1(push.token, 'POST', '/v1/tests', definition)
     assert.equal(response.status, 201); test = await response.json()
    }
    testIds.push(test.id)
    assert.equal((await get('/api/tests/' + test.id)).test.origin, origin)
   }
   const earlier = (await get('/api/remediation')).open.filter(o => testIds.includes(o.test_id))
   assert.equal(earlier.length, 2)
   for (const item of earlier) {
    assert.equal(item.category, category); assert.ok(Number.isInteger(item.sla_days) && item.sla_days > 0, category + ' has no usable default SLA')
    assert.equal(item.clock_started_at, (await detail(item.id)).observations.at(-1).observed_at)
    assert.equal(item.sla.due, shifted(item.clock_started_at, item.sla_days * DAY))
    assert.equal(item.sla.status, 'within SLA')
   }
   await app.clock(new Date(Date.UTC(2026, 9, 29, index)).toISOString())
   await owner('/api/remediation/sla', { category, severity: 'medium', days: days + 1 })
   resources[1].attributes.healthy = false
   assert.equal((await v1(push.token, 'PUT', '/v1/resources/' + type, { resources })).status, 200)
   const after = (await get('/api/remediation')).open.filter(o => testIds.includes(o.test_id))
   assert.equal(after.length, 4)
   for (const item of after) {
    const original = earlier.find(o => o.id === item.id)
    if (original) assert.deepEqual([item.clock_started_at, item.sla_days, item.sla_policy_id, item.sla.due], [original.clock_started_at, original.sla_days, original.sla_policy_id, original.sla.due])
    else {
     assert.equal(item.sla_days, days + 1); assert.notEqual(item.sla_policy_id, earlier[0].sla_policy_id)
     assert.equal(item.sla.due, shifted(item.clock_started_at, (days + 1) * DAY))
    }
   }
  }
 })
 console.log(`${passed} SLA and board report public-door scenarios passed.`)
} finally { await app.close() }
