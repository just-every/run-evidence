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
let program, push, testId
try {
 await scenario('A 7-day identity SLA gives each failing user its own clock: one resolved within SLA, one missed with one escalation, and readiness, test history and the queue agree', async () => {
  await app.signin()
  program = (await owner('/api/programs', { framework: 'soc2', name: 'SOC 2', legal_entity: 'Northstar', report_type: 'Type II', audit_from: '2026-10-01', audit_to: '2026-12-31' })).id
  await owner('/api/remediation/sla', { category: 'identity', severity: 'high', days: 7 })
  push = await owner('/api/api-tokens', { name: 'IdP export', scopes: ['resource-push', 'test-write', 'read'], expires_at: '2027-04-01' })
  assert.equal((await v1(push.token, 'PUT', '/v1/resource-types/idp_user', { schema: { fields: { mfa: 'boolean' } } })).status, 200)
  assert.equal((await v1(push.token, 'PUT', '/v1/resources/idp_user', { resources: users(['ana', 'ben']) })).status, 200)
  testId = (await (await v1(push.token, 'POST', '/v1/tests', { name: 'People sign in with MFA', resourceType: 'idp_user', criteria: [{ attribute: 'mfa', op: 'equals', value: true }], cadence: 'hourly', category: 'identity', severity: 'high', controls: ['AC-05'] })).json()).id
  await app.clock('2026-10-14T12:00:00Z')
  assert.equal((await v1(push.token, 'PUT', '/v1/resources/idp_user', { resources: users(['ben']) })).status, 200)
  await app.tick()
  await app.clock('2026-10-18T13:00:00Z'); await app.tick(); await app.tick()
  const escalations = app.messages.filter(m => /SLA missed/.test(m.subject))
  assert.equal(escalations.length, 1); assert.match(escalations[0].subject, /ben@northstar\.test/)
  const queue = await get('/api/remediation')
  const ben = queue.open.find(o => o.resource_name === 'ben@northstar.test'), ana = queue.resolved.find(o => o.resource_name === 'ana@northstar.test')
  assert.equal(ben.sla.status, 'SLA missed'); assert.equal(ben.sla_days, 7); assert.equal(ana.sla.status, 'resolved within SLA')
  const results = Object.fromEntries((await get('/api/tests/' + testId)).latest.map(o => [o.display_name, [o.result, o.sla]]))
  assert.deepEqual(results, { 'ana@northstar.test': ['pass', 'resolved within SLA'], 'ben@northstar.test': ['fail', 'SLA missed'], 'cy@northstar.test': ['pass', null] })
  const totals = (await get('/api/programs/' + program)).readiness.totals
  assert.deepEqual([totals.open_obligations, totals.sla_missed, totals.sla_approaching, totals.sla_within], [1, 1, 0, 0])
 })
 await scenario('The board report reconciles per-item SLA, freshness, exceptions, policies and trend in JSON and CSV; a filter narrows items and never improves readiness', async () => {
  const connection = await owner('/api/connections', { account: 'northstar', token: 'github_pat_any' })
  await owner(`/api/connections/${connection.id}/collect`, {})
  github.up = false
  await app.clock('2026-10-19T13:00:00Z'); await app.tick()
  const ben = (await get('/api/remediation')).open[0]
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
  const rows = csvRows(await csv.text())
  assert.deepEqual(rows.filter(r => r[0] === 'remediation').map(r => [r[1], r[4]]).sort(), report.items.map(i => [i.obligation, i.sla]).sort())
  assert.equal(rows.filter(r => r[0] === 'trend').length, report.trend.length); assert.equal(rows.filter(r => r[0] === 'policy').length, report.policies.length)
  const filtered = await get(`/api/programs/${program}/board?severity=low`)
  assert.equal(filtered.items.length, 0); assert.deepEqual(filtered.readiness, report.readiness); assert.equal(filtered.sla.missed, 0)
  const page = await (await app.fetch(`/app/programs/${program}/board`)).text()
  assert.match(page, /SLA missed/); assert.match(page, /Export CSV/)
  const audit = (await app.db.prepare("SELECT detail FROM product_audit WHERE action='program.board-exported' ORDER BY rowid").all()).results.map(r => r.detail)
  assert.deepEqual(audit, ['json', 'csv', 'json'])
 })
 console.log(`${passed} SLA and board report public-door scenarios passed.`)
} finally { await app.close() }
