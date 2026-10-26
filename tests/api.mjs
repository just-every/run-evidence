import { step } from './helpers/step.mjs'
import { credentialJourney } from './helpers/credential-journey.mjs'
// The v1 public API, continuous tests and remediation through public doors:
// Bearer-token API calls, owner pages' JSON doors and the Cron Trigger, on real
// workerd, D1 and R2. Only the paid mail edge is faked.
process.env.RER_SERVER_JOURNEY = '1'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { runtime } from './helpers/runtime.mjs'
const app = await runtime()
let passed = 0
const scenario = async (name, fn) => { await fn(); passed++; console.log('PASS ' + name) }
const owner = async (path, body, status = 201) => { const r = await app.fetch(path, { method: 'POST', headers: { origin: app.origin, 'content-type': 'application/json' }, body: JSON.stringify(body) }); const text = await r.text(); assert.equal(r.status, status, path + ' ' + text); return text ? JSON.parse(text) : null }
const get = async path => { const r = await app.fetch(path); assert.equal(r.status, 200, path); return r.json() }
const v1 = (token, method, path, body) => app.fetch(path, { method, headers: { cookie: '', ...(token ? { authorization: 'Bearer ' + token } : {}), ...(body && !(body instanceof FormData) ? { 'content-type': 'application/json' } : {}) }, ...(body ? { body: body instanceof FormData ? body : JSON.stringify(body) } : {}) })
const services = (count, insecure = 'svc-07') => Array.from({ length: count }, (_, i) => { const id = 'svc-' + String(i + 1).padStart(2, '0'); return { uniqueId: id, displayName: 'Service ' + id, attributes: { mfa_enforced: id !== insecure, owner: 'platform', tier: i % 3 } } })
const count = async (sql, ...binds) => (await app.db.prepare(sql).bind(...binds).first()).n
let push, reader, evidence, testId, obligation, soc2, ownerCookie
try {
 await scenario('Scoped expiring tokens; foreign, revoked, cookie-only and out-of-scope calls are refused with nothing written', async () => {
  ownerCookie = await app.signin()
  soc2 = (await owner('/api/programs', { framework: 'soc2', name: 'SOC 2', legal_entity: 'Northstar', report_type: 'Type II', audit_from: '2026-07-01', audit_to: '2027-06-30' })).id
  push = await owner('/api/api-tokens', { name: 'Inventory sync', scopes: ['resource-push', 'read', 'test-write'], expires_at: '2027-04-01' })
  reader = await owner('/api/api-tokens', { name: 'Board report', scopes: ['read'], expires_at: '2027-04-01' })
  evidence = await owner('/api/api-tokens', { name: 'Scanner uploads', scopes: ['evidence-push'], expires_at: '2027-04-01' })
  await owner('/api/api-tokens', { name: 'Forever', scopes: ['read'], expires_at: '2030-01-01' }, 400)
  await owner('/api/api-tokens', { name: 'Approver', scopes: ['approve'], expires_at: '2027-04-01' }, 400)
  const stored = await app.db.prepare('SELECT * FROM api_tokens WHERE id=?').bind(push.grant.id).first()
  assert.equal(stored.token_hash, createHash('sha256').update(push.token).digest('hex')); assert.ok(!JSON.stringify(await get('/api/connections')).includes(push.token))
  const spec = await (await app.fetch('/v1/openapi.json')).json()
  assert.equal(spec.openapi, '3.1.0'); for (const path of ['/v1/resources/{type}', '/v1/tests', '/v1/evidence', '/v1/programs', '/v1/remediation']) assert.ok(spec.paths[path], path)
  const foreign = 'evd_0123456789_' + 'A'.repeat(43)
  assert.equal((await v1(foreign, 'GET', '/v1/programs')).status, 401)
  assert.equal((await v1(null, 'GET', '/v1/programs')).status, 401)
  assert.equal((await app.fetch('/v1/programs')).status, 401)
  assert.equal((await v1(reader.token, 'PUT', '/v1/resource-types/internal_service', { schema: { fields: { mfa_enforced: 'boolean' } } })).status, 403)
  assert.equal(await count('SELECT COUNT(*) AS n FROM resource_types'), 0)
  const throwaway = await owner('/api/api-tokens', { name: 'Throwaway', scopes: ['resource-push'], expires_at: '2027-04-01' })
  await owner(`/api/api-tokens/${throwaway.grant.id}/revoke`, {}, 200)
  assert.equal((await v1(throwaway.token, 'PUT', '/v1/resource-types/internal_service', { schema: { fields: { mfa_enforced: 'boolean' } } })).status, 401)
  assert.equal(await count('SELECT COUNT(*) AS n FROM resource_types'), 0)
  assert.equal((await v1(push.token, 'GET', '/api/desk')).status, 403)
  const calls = (await app.db.prepare('SELECT * FROM api_calls').all()).results
  assert.deepEqual(calls.map(c => c.status).sort(), [401, 401, 401, 401, 403]); assert.ok(!JSON.stringify(calls).includes(push.token) && !JSON.stringify(calls).includes(stored.token_hash))
 })
 await scenario('API-001 / INVENTORY-001: pushed resource identity survives token replacement; full sync and invalid items retain their semantics', async () => {
  assert.equal((await v1(push.token, 'PUT', '/v1/resource-types/internal_service', { schema: { fields: { mfa_enforced: 'boolean', owner: 'string', tier: 'number' }, required: ['mfa_enforced'] } })).status, 200)
  const first = await (await v1(push.token, 'PUT', '/v1/resources/internal_service', { resources: services(50) })).json()
  assert.equal(first.created, 50)
  const stamps = (await app.db.prepare('SELECT unique_id,updated_at FROM resources ORDER BY unique_id').all()).results
  await app.clock('2026-10-11T12:10:00Z')
  const again = await (await v1(push.token, 'PUT', '/v1/resources/internal_service', { resources: services(50) })).json()
  assert.equal(again.unchanged, 50); assert.equal(await count('SELECT COUNT(*) AS n FROM resources'), 50)
  assert.deepEqual((await app.db.prepare('SELECT unique_id,updated_at FROM resources ORDER BY unique_id').all()).results, stamps)
  const sync = await (await v1(push.token, 'PUT', '/v1/resources/internal_service', { resources: services(49), fullSync: true })).json()
  assert.equal(sync.removed, 1); assert.equal(sync.results.find(r => r.outcome === 'removed').uniqueId, 'svc-50')
  const removed = await app.db.prepare("SELECT id,removed_at FROM resources WHERE unique_id='svc-50'").first()
  assert.ok(removed.removed_at); assert.deepEqual((await app.db.prepare('SELECT change FROM resource_versions WHERE resource_id=? ORDER BY at,rowid').bind(removed.id).all()).results.map(r => r.change), ['created', 'removed'])
  const before = (await get('/api/inventory')).records.find(r => r.source_id === sync.results.find(r => r.uniqueId === 'svc-49').id)
  const replacement = await owner('/api/api-tokens', { name: 'Replacement inventory sync', scopes: ['resource-push'], expires_at: '2027-04-01' })
  const replaced = await (await v1(replacement.token, 'PUT', '/v1/resources/internal_service', { resources: [{ ...services(49)[48], displayName: 'Replacement Service 49' }] })).json()
  assert.equal(replaced.updated, 1); assert.equal(replaced.results[0].id, before.source_id)
  assert.equal(await count('SELECT COUNT(*) AS n FROM resources'), 50)
  const after = (await get('/api/inventory')).records.find(r => r.source_id === before.source_id)
  assert.equal(after.source_key, before.source_key); assert.match(after.source_label, /Replacement inventory sync/)
  const mixed = await v1(push.token, 'PUT', '/v1/resources/internal_service', { resources: [{ uniqueId: 'svc-90', attributes: { mfa_enforced: 'yes' } }, { uniqueId: 'svc-91', attributes: { unknown_field: true, mfa_enforced: true } }, { attributes: { mfa_enforced: true } }, { uniqueId: 'svc-92', attributes: { mfa_enforced: true } }] })
  const outcome = await mixed.json()
  assert.deepEqual(outcome.results.map(r => r.outcome), ['rejected', 'rejected', 'rejected', 'created'])
  assert.match(outcome.results[0].reasons.join(), /mfa_enforced must be boolean/); assert.match(outcome.results[1].reasons.join(), /unknown_field is not a declared field/)
  assert.equal((await v1(push.token, 'PUT', '/v1/resources/github.repository', { resources: [] })).status, 400)
 })
 await scenario("TEST-001 / REMEDY-002: a pushed MFA failure follows re-test, regression and prospective SLA decisions", async () => {
  await step('A custom mfa_enforced test labels its failure source-reported; readiness and paginated API reads reconcile with the owner view', async () => {
    const created = await (await v1(push.token, 'POST', '/v1/tests', { name: 'Internal services enforce MFA', resourceType: 'internal_service', criteria: [{ attribute: 'mfa_enforced', op: 'equals', value: true }], cadence: 'hourly', category: 'identity', severity: 'high', controls: ['AC-05'] })).json()
    testId = created.id
    assert.equal(created.first_run.results.length, 50); assert.equal(created.first_run.results.filter(r => r.result === 'fail').length, 1)
    assert.ok(created.first_run.results.every(r => r.source_kind === 'source-reported'))
    const detail = await get('/api/tests/' + testId)
    const failing = detail.latest.find(o => o.result === 'fail')
    assert.equal(failing.display_name, 'Service svc-07'); assert.match(failing.source_label, /Source-reported via API token "Inventory sync"/)
    assert.equal(detail.controls[0].library_id, 'AC-05')
    const readiness = (await get('/api/programs/' + soc2)).readiness
    const cc61 = readiness.requirements.find(r => r.ref === 'CC6.1')
    assert.equal(cc61.testing, 'failing'); assert.match(cc61.failing_sources.join(), /Source-reported via API token "Inventory sync"/)
    const pages = []; let cursor = null
    do { const page = await (await v1(reader.token, 'GET', '/v1/test-results?limit=20' + (cursor ? '&cursor=' + cursor : ''))).json(); pages.push(...page.data); cursor = page.next_cursor } while (cursor)
    assert.equal(pages.length, 50); assert.equal(new Set(pages.map(o => o.id)).size, 50)
    const changed = await (await v1(reader.token, 'GET', '/v1/test-results?changed_since=2027-01-01T00:00:00Z')).json(); assert.equal(changed.data.length, 0)
    const remediation = await (await v1(reader.token, 'GET', '/v1/remediation')).json()
    assert.equal(remediation.data.length, 1); obligation = remediation.data[0]
    assert.equal(obligation.state, 'open'); assert.equal(obligation.sla.status, 'within SLA')
    const queue = await get('/api/remediation'); assert.equal(queue.open[0].id, obligation.id); assert.equal(queue.open[0].sla.due, obligation.sla.due)
    const draft = await owner('/api/policies', { title: 'Access control policy', body: 'Access is granted by role and reviewed quarterly.' })
    const revision = await get(`/api/policies/${draft.policy}/revisions/${draft.revision}`)
    await owner(`/api/policies/${draft.policy}/revisions/${draft.revision}/decision`, { decision: 'approved', body_sha256: '0'.repeat(64) }, 409)
    await owner(`/api/policies/${draft.policy}/revisions/${draft.revision}/publish`, {}, 409)
    await owner(`/api/policies/${draft.policy}/revisions/${draft.revision}/decision`, { decision: 'approved', body_sha256: revision.body_sha256, note: 'Matches our IdP setup' }, 200)
    await owner(`/api/policies/${draft.policy}/revisions/${draft.revision}/publish`, { effective_date: '2026-10-11' }, 200)
    const policies = (await (await v1(reader.token, 'GET', '/v1/policies')).json()).data
    assert.deepEqual([policies[0].title, policies[0].published_version, policies[0].review_due, policies[0].published_sha256], ['Access control policy', 1, '2027-10-11', revision.body_sha256])
    for (const name of ['programs', 'controls', 'requirements', 'people', 'vendors', 'risks', 'tests']) assert.equal((await v1(reader.token, 'GET', '/v1/' + name)).status, 200, name)
    assert.equal((await (await v1(reader.token, 'GET', '/v1/programs')).json()).data[0].id, soc2)
    assert.equal((await v1(reader.token, 'POST', '/v1/tests', { name: 'x' })).status, 403)
    for (const [path, text] of [['/app/tests', 'Internal services enforce MFA'], ['/app/tests/' + testId, 'Service svc-07'], ['/app/remediation', 'Service svc-07'], ['/app/remediation/' + obligation.id, 'Mark work done'], ['/app/connections', 'Inventory sync'], ['/app/policies', 'Access control policy']]) { const page = await app.fetch(path); assert.equal(page.status, 200, path); const html = await page.text(); assert.ok(html.includes(text), path); assert.ok(!html.includes(push.token), path) }
    const issued = await app.fetch('/app/api-tokens', { method: 'POST', headers: { origin: app.origin, 'content-type': 'application/x-www-form-urlencoded' }, body: 'name=Form+token&scopes%5B%5D=read&expires_at=2027-01-01' })
    assert.equal(issued.status, 303); const shown = await app.fetch(issued.headers.get('location')); assert.match(await shown.text(), /Copy this token now[\s\S]*evd_[a-f0-9]{10}_/)
    assert.ok(!(await (await app.fetch('/app/connections')).text()).match(/evd_[a-f0-9]{10}_[A-Za-z0-9_-]{43}/))
   })
   await step('Marking work done waits for a re-test; the queued re-test fails and keeps it open; the source fix verifies; a regression reopens', async () => {
    const person = await owner('/api/people', { name: 'Ada Park', email: 'ada@northstar.test', kind: 'employee' })
    await owner(`/api/remediation/${obligation.id}/assign`, { owner_person_id: person.id, next_action: 'Turn on MFA for svc-07 admins', target_date: '2026-10-20' }, 200)
    const assigned = await get('/api/remediation/' + obligation.id); assert.equal(assigned.obligation.target_date, '2026-10-20'); assert.equal(assigned.controls[0].library_id, 'AC-05')
    await owner(`/api/remediation/${obligation.id}/comments`, { body: 'Ticket PLAT-142 opened' })
    await owner(`/api/remediation/${obligation.id}/changes`, { body: 'https://git.example.test/platform/pull/88' })
    await owner(`/api/remediation/${obligation.id}/done`, { body: 'Merged the change' }, 200)
    assert.equal((await get('/api/remediation/' + obligation.id)).obligation.state, 'awaiting verification')
    await app.tick()
    let detail = await get('/api/remediation/' + obligation.id)
    assert.equal(detail.obligation.state, 'open'); assert.ok(detail.events.some(e => e.kind === 'retest failed'))
    assert.equal(detail.observations[0].run_trigger, 'retest')
    await app.clock('2026-10-11T13:00:00Z')
    const fixed = services(49, 'none')
    assert.equal((await (await v1(push.token, 'PUT', '/v1/resources/internal_service', { resources: fixed })).json()).tests_run, 1)
    detail = await get('/api/remediation/' + obligation.id)
    assert.equal(detail.obligation.state, 'verified'); assert.equal(detail.obligation.sla.status, 'resolved within SLA'); assert.match(detail.events.at(-1).body, /source-reported data/)
    await app.clock('2026-10-11T14:00:00Z')
    await v1(push.token, 'PUT', '/v1/resources/internal_service', { resources: services(49) })
    detail = await get('/api/remediation/' + obligation.id)
    assert.equal(detail.obligation.state, 'open'); assert.equal(detail.obligation.cycles, 2); assert.equal(detail.obligation.clock_started_at, '2026-10-11T14:00:00.000Z')
    assert.deepEqual(detail.observations.map(o => o.result).slice(0, 3), ['fail', 'pass', 'fail'])
    assert.equal(await count("SELECT COUNT(*) AS n FROM obligation_events WHERE obligation_id=? AND kind IN ('opened','verified','reopened')", obligation.id), 3)
   })
   await step('SLA policy changes apply only to new clocks, exceptions pause them, misses escalate once and expired risk acceptance reopens', async () => {
    await owner('/api/remediation/sla', { category: 'identity', severity: 'high', days: '7' })
    await v1(push.token, 'PUT', '/v1/resources/internal_service', { resources: [...services(49).filter(s => s.uniqueId !== 'svc-12'), { uniqueId: 'svc-12', displayName: 'Service svc-12', attributes: { mfa_enforced: false, owner: 'platform', tier: 2 } }] })
    const queue = (await get('/api/remediation')).open
    const old = queue.find(o => o.id === obligation.id), fresh = queue.find(o => o.resource_name === 'Service svc-12')
    assert.equal(old.sla_days, 30); assert.equal(fresh.sla_days, 7)
    await app.clock('2026-10-12T15:00:00Z')
    await owner(`/api/tests/${testId}/exceptions`, { resource_id: fresh.resource_id, reason: 'Vendor MFA rollout window', expires_at: '2026-10-14T15:00:00Z' })
    assert.equal((await get('/api/remediation')).open.find(o => o.id === fresh.id).sla.paused, true)
    await app.clock('2026-10-19T12:00:00Z')
    let row = (await get('/api/remediation')).open.find(o => o.id === fresh.id)
    assert.equal(row.sla.due, '2026-10-20T14:00:00.000Z'); assert.equal(row.sla.status, 'approaching')
    await app.clock('2026-10-21T12:00:00Z')
    row = (await get('/api/remediation')).open.find(o => o.id === fresh.id); assert.equal(row.sla.status, 'SLA missed')
    await app.tick(); await app.tick()
    const escalations = app.messages.filter(m => /SLA missed: Internal services enforce MFA on Service svc-12/.test(m.subject))
    assert.equal(escalations.length, 1); assert.deepEqual(escalations[0].to, ['owner@example.test'])
    await owner(`/api/remediation/${obligation.id}/accept`, { rationale: 'Legacy service retiring next month', until: '2026-10-25T00:00:00' }, 200)
    assert.equal((await get('/api/remediation/' + obligation.id)).obligation.state, 'risk accepted')
    await app.clock('2026-10-25T00:05:00Z'); await app.tick()
    const detail = await get('/api/remediation/' + obligation.id)
    assert.equal(detail.obligation.state, 'open'); assert.ok(detail.events.some(e => e.kind === 'acceptance expired'))
    const before = (await get('/api/tests/' + testId)).runs.length
    await owner(`/api/tests/${testId}/revisions`, { excluded: `${fresh.resource_id} Retired with the legacy billing stack`, reason: 'Scope: svc-12 retired' }, 200)
    await owner(`/api/tests/${testId}/run`, {}, 200)
    const tuned = await get('/api/tests/' + testId)
    assert.equal(tuned.test.revision, 2); assert.equal(tuned.runs.length, before + 1)
    const item = tuned.latest.find(o => o.resource_id === fresh.resource_id)
    assert.equal(item.result, 'not applicable'); assert.match(item.reason, /Retired with the legacy billing stack/); assert.equal(item.revision, 2)
    const history = (await get('/api/remediation/' + fresh.id)).observations
    assert.equal(history[0].revision, 2); assert.ok(history.some(o => o.revision === 1 && o.result === 'fail'), 'earlier failure kept under revision 1')
    const resolved = (await get('/api/remediation?category=identity&from=2026-10-01&to=2026-10-31')).resolved
    assert.equal(resolved.length, 0)
   })
 })
 await scenario('Evidence pushed through the API is a labelled, verified receipt and an unscoped token writes nothing', async () => {
  const requirement = (await get('/api/desk')).requirements.find(r => r.library_id === 'OPS-04')
  const form = () => { const f = new FormData(); f.set('requirement_id', requirement.id); f.set('covered_from', '2026-10-01'); f.set('covered_to', '2026-10-31'); f.set('source', 'Weekly scanner export'); f.set('origin', 'source-observed'); f.set('file', new File(['scan results'], 'scan.json', { type: 'application/json' })); return f }
  assert.equal((await v1(push.token, 'POST', '/v1/evidence', form())).status, 403)
  const before = await count('SELECT COUNT(*) AS n FROM receipts')
  const r = await v1(evidence.token, 'POST', '/v1/evidence', form()); assert.equal(r.status, 201, await r.clone().text())
  const issued = await r.json(); assert.equal(await count('SELECT COUNT(*) AS n FROM receipts'), before + 1)
  const receipt = await get('/api/receipts/' + issued.receipt)
  assert.equal(receipt.origin, 'manually-asserted'); assert.match(receipt.source, /^Source-reported via API token "Scanner uploads" \(owner Evidence owner\): Weekly scanner export/)
  assert.equal(receipt.pushed_by_token, 'Scanner uploads')
  const bytes = Buffer.from(await (await app.fetch('/api/receipts/' + issued.receipt + '/download')).arrayBuffer())
  assert.equal(createHash('sha256').update(bytes).digest('hex'), receipt.sha256)
 })
 await scenario('Rate limits answer 429 with a retry time and the call is audited', async () => {
  await app.clock('2026-10-25T01:00:00Z')
  const statuses = []
  for (let i = 0; i < 122; i++) statuses.push((await v1(reader.token, 'GET', '/v1/people?limit=1')).status)
  assert.equal(statuses.filter(s => s === 200).length, 120)
  const limited = await v1(reader.token, 'GET', '/v1/people')
  assert.equal(limited.status, 429); assert.ok(Number(limited.headers.get('retry-after')) > 0); assert.ok((await limited.json()).retry_after_seconds > 0)
  assert.ok(await count("SELECT COUNT(*) AS n FROM api_calls WHERE status=429") >= 2)
 })
 await scenario('Native credential forms redirect before a once-only display and refresh never issues another credential', () => credentialJourney(app, ownerCookie))
 console.log(`${passed} API, test and remediation public-door scenarios passed with real workerd, D1 and R2.`)
} finally { await app.close() }
