import assert from 'node:assert/strict'
import { runtime } from './runtime.mjs'
import { collectionScheduleBrowser } from './collection-schedule-browser.mjs'
import { githubFixture } from './github-fixture.mjs'
// COLLECTION-001 through owner HTTP, Cloudflare Cron and streamed custody restore.
export async function collectionJourney() {
 const apiBase = 'https://github.example.test'
 const { github, outbound } = githubFixture(apiBase), app = await runtime({ outbound }), target = await runtime()
 const get = async path => { const r = await app.fetch(path); assert.equal(r.status, 200); return r.json() }
 const send = async (path, body, status = 200) => {
  const r = await app.fetch(path, { method: 'POST', headers: { origin: app.origin, 'content-type': 'application/json' }, body: JSON.stringify(body) })
  assert.equal(r.status, status, await r.clone().text()); return r.json()
 }
 const at = async time => { github.clock = time; await app.clock(time) }
 try {
  const cookie = await app.signin(); github.clock = '2026-10-11T12:00:00Z'
  const connection = await send('/api/connections', { account: 'northstar', token: 'github_pat_good', label: 'Production repositories', api_base: apiBase }, 201), path = '/api/connections/' + connection.id
  await send(path + '/repositories', { repositories: ['northstar/web'] })
  const program = await send('/api/programs', { framework: 'soc2', name: 'Source period', legal_entity: 'Northstar', report_type: 'Type II', audit_from: '2026-10-01', audit_to: '2026-10-31' }, 201)
  const mapped = (await app.db.prepare("SELECT c.* FROM controls c JOIN test_controls tc ON tc.control_id=c.id JOIN tests t ON t.id=tc.test_id WHERE t.catalogue_id='github.branch-protection' ORDER BY c.id LIMIT 1").first())
  assert.ok(mapped)

  for (const minutes of [0, 4, 7, 61, 1.5, '15junk', null, true]) await send(path + '/schedule', { minutes }, 400)
  const forged = await app.fetch(path + '/schedule', { method: 'POST', headers: { origin: 'https://foreign.test', 'content-type': 'application/json' }, body: '{"minutes":15}' })
  assert.equal(forged.status, 403)
  app.setCookie('')
  assert.equal((await app.fetch(path + '/schedule', { method: 'POST', headers: { origin: app.origin, 'content-type': 'application/json' }, body: '{"minutes":15}' })).status, 401)
  app.setCookie(cookie)
  await send(path + '/schedule', { minutes: '15' })
  assert.equal(JSON.parse((await get(path)).connection.config_json).collection_minutes, 15)
  assert.ok((await get('/api/audit')).entries.some(e => e.action === 'connection.schedule' && /15 minutes; previous 60 minutes/.test(e.detail)))
  await app.tick()
  let history = (await get(path)).runs
  assert.equal(history.length, 1); assert.equal(history[0].outcome, 'complete')
  const initial = history[0], initialContext = JSON.parse(initial.coverage_json)
  assert.equal(initialContext.context.library_revision, 1)
  assert.equal(initialContext.context.account, 'northstar')
  assert.ok(initialContext.context.controls.some(c => c.control_id === mapped.id && c.revision === 1))
  assert.ok(initialContext.context.tests.some(t => t.resource_type === 'github.repository' && t.revision === 1))
  assert.ok(initialContext.context.audit_periods.some(p => p.id === program.id && p.audit_from === '2026-10-01' && p.audit_to === '2026-10-31' && p.revision === 1))
  assert.equal(initialContext.source_read_started_at, initial.started_at)
  assert.equal(initialContext.received_at, initial.finished_at); assert.equal(initialContext.source_event_at, null, 'a poll never invents a source event time')
  await send('/api/controls/' + mapped.id + '/revisions', { revision: 1, name: mapped.name, group: mapped.group_name, applicability: 'Included', test_intent: 'Review authorized changes', evaluation_criteria: 'Read source protection', reason: 'Prospective source-period definition' })
  const resourceCount = (await app.db.prepare('SELECT COUNT(*) AS n FROM resource_versions').first()).n
  await at('2026-10-11T12:10:00Z'); await app.tick()
  assert.equal((await get(path)).runs.length, 1, 'no early read')
  github.overrides.set('/repos/northstar/web/branches/main/protection', { body: { required_pull_request_reviews: { required_approving_review_count: 'two' }, required_status_checks: { contexts: 'ci' }, enforce_admins: { enabled: true } } })
  github.overrides.set('/repos/northstar/web/secret-scanning/alerts?state=open&per_page=100', { body: [], headers: { link: '<https://github.example.test/repos/northstar/web/secret-scanning/alerts?state=open&per_page=100>; rel="next"' } })
  await at('2026-10-11T12:15:00Z'); await app.tick()
  history = (await get(path)).runs
  assert.equal(history.length, 2); assert.equal(history[0].outcome, 'partial')
  const gaps = JSON.parse(history[0].coverage_json).gaps
  for (const reason of [/schema drift: required approving/, /schema drift: required status/, /pagination incomplete/]) assert.ok(gaps.some(g => g.asset === 'northstar/web' && reason.test(g.reason)))
  const tests = (await get('/api/tests')).tests
  const latest = async catalogue => (await get('/api/tests/' + tests.find(t => t.catalogue_id === catalogue).id)).latest
  for (const test of ['github.required-review', 'github.required-checks', 'github.secret-scanning-open']) assert.deepEqual((await latest(test)).map(o => o.result), ['unknown'])
  const partial = history[0]
  assert.ok(JSON.parse(partial.coverage_json).context.controls.some(c => c.control_id === mapped.id && c.revision === 2))
  assert.deepEqual(JSON.parse((await get(path)).runs.find(r => r.id === initial.id).coverage_json), initialContext)

  github.overrides.clear()
  github.throttleUntil = Date.parse('2026-10-11T12:55:00Z')
  await at('2026-10-11T12:30:00Z'); await app.tick()
  history = (await get(path)).runs
  assert.equal(history[0].outcome, 'throttled')
  const observations = (await app.db.prepare('SELECT COUNT(*) AS n FROM observations').first()).n
  await at('2026-10-11T12:45:00Z'); await app.tick()
  assert.equal((await get(path)).runs.length, 3, 'backoff overrides elapsed interval')
  assert.equal((await app.db.prepare('SELECT COUNT(*) AS n FROM observations').first()).n, observations, 'no catch-up observations')
  await at('2026-10-11T12:55:00Z'); await app.tick()
  history = (await get(path)).runs
  assert.equal(history[0].outcome, 'complete'); assert.equal(history.length, 4)
  assert.deepEqual(history.find(r => r.id === initial.id), initial)
  assert.deepEqual(history.find(r => r.id === partial.id), partial, 'recovery cannot rewrite the earlier gap')
  assert.deepEqual(JSON.parse(history[0].coverage_json).gaps, [])
  for (const test of ['github.required-review', 'github.required-checks', 'github.secret-scanning-open']) assert.deepEqual((await latest(test)).map(o => o.result), ['pass'])
  await app.tick(); assert.equal((await get(path)).runs.length, 4, 'a repeated scheduler tick cannot duplicate a read')
  assert.equal((await app.db.prepare('SELECT COUNT(*) AS n FROM receipts').first()).n, 0, 'no fabricated exhibits')
  assert.equal((await app.db.prepare('SELECT COUNT(*) AS n FROM resource_versions').first()).n, resourceCount + 2, 'only changed facts append versions')
  // Malformed objects and lists must be named gaps, rather than crash or green.
  github.overrides.set('/orgs/northstar', { body: null })
  github.overrides.set('/repos/northstar/web', { body: [] })
  await at('2026-10-11T13:10:00Z'); await app.tick()
  const failed = (await get(path)).runs[0]
  assert.equal(failed.outcome, 'failed'); assert.match(failed.coverage_json, /schema drift/)
  github.overrides.clear()
  github.overrides.set('/repos/northstar/web/dependabot/alerts', { body: { items: [] } })
  github.overrides.set('/repos/northstar/web/secret-scanning/alerts', { body: [null] })
  github.overrides.set('/orgs/northstar', { body: { login: 'northstar', two_factor_requirement_enabled: 'true' } })
  await at('2026-10-11T13:25:00Z'); await app.tick()
  const malformed = (await get(path)).runs[0]
  assert.equal(malformed.outcome, 'partial')
  assert.match(malformed.coverage_json, /expected an array/); assert.match(malformed.coverage_json, /alert entries/); assert.match(malformed.coverage_json, /two-factor/)
  for (const test of ['github.dependabot-critical', 'github.secret-scanning-open', 'github.org-two-factor']) assert.deepEqual((await latest(test)).map(o => o.result), ['unknown'])
  const html = await (await app.fetch('/app/connections/' + connection.id)).text()
  assert.match(html, /Evidence gaps by run/); assert.match(html, /schema drift/); assert.match(html, /pagination incomplete/)
  // Restart reopens real D1/R2 without changing the schedule or run facts.
  await at('2026-10-11T13:30:00Z'); assert.equal(JSON.parse((await get(path)).connection.config_json).collection_minutes, 15)
  assert.deepEqual((await get(path)).runs.find(r => r.id === failed.id), failed)
  await send(path + '/schedule', { minutes: 60 })
  await collectionScheduleBrowser(app, [(await get(path)).connection])
  await send(path + '/schedule', { minutes: 15 })
  github.overrides.clear()
  const alerts = '/repos/northstar/web/dependabot/alerts?state=open&severity=critical&per_page=100'
  for (let page=1;page<=11;page++) {
   const key = alerts + (page === 1 ? '' : '&page=' + page)
   github.overrides.set(key,{body:[{number:page}],headers:page < 11 ? {link:`<${apiBase}${alerts}&page=${page+1}>; rel="next"`} : {}})
  }
  const requests = github.requests.length
  await at('2026-10-11T13:35:00Z'); await send(path + '/collect',{},201)
  const paused = (await get(path)).runs[0], saved = JSON.parse(paused.coverage_json)
  assert.equal(paused.outcome,'partial'); assert.match(paused.coverage_json,/durable cursor retained/)
  assert.equal(saved.resume.streams[alerts].numbers.length,10); assert.ok(saved.cursor[alerts].endsWith('&page=11'))
  assert.deepEqual((await latest('github.dependabot-critical')).map(o=>o.result),['unknown'])
  github.overrides.set(alerts + '&page=11',{status:429,body:{message:'rate limited'}})
  await at('2026-10-11T13:40:00Z'); await send(path + '/collect',{},201)
  const limited = (await get(path)).runs[0]
  assert.equal(limited.outcome,'throttled')
  github.overrides.set(alerts + '&page=11',{body:[{number:11}]})
  await at('2026-10-11T13:45:00Z'); await send(path + '/collect',{},201)
  const resumed = (await get(path)).runs[0], recovered = JSON.parse(resumed.coverage_json)
  assert.equal(resumed.outcome,'complete')
  assert.equal(recovered.resume.streams[alerts].numbers.length,11)
  assert.equal(recovered.source_read_started_at,'2026-10-11T13:35:00.000Z'); assert.equal(recovered.received_at,'2026-10-11T13:45:00.000Z')
  assert.equal((await get('/api/inventory')).records.find(r=>r.source_ref==='github:'+connection.id && r.source_type==='github.repository').last_observation,'2026-10-11T13:35:00.000Z','resumed cached facts never gain a fabricated fresh timestamp')
  const read = github.requests.slice(requests).filter(p=>p.startsWith(alerts))
  assert.equal(read.filter(p=>p===alerts).length,1,'completed pages are never read again after restart/backoff')
  assert.equal(read.filter(p=>p.endsWith('&page=11')).length,2,'only the throttled page retries')
  assert.deepEqual((await get(path)).runs.find(r=>r.id===paused.id),paused); assert.deepEqual((await get(path)).runs.find(r=>r.id===limited.id),limited)
  // Rotating the authority invalidates every cached page, even for the same scope.
  github.tokens.add('synthetic-evidence-2')
  await at('2026-10-11T13:50:00Z'); await send(path + '/rotate',{token:'synthetic-evidence-2'})
  const beforeRotation = github.requests.length
  await send(path + '/collect',{},201)
  assert.equal((await get(path)).runs[0].outcome,'partial')
  assert.ok(github.requests.slice(beforeRotation).includes(alerts))
  assert.equal(JSON.parse((await get(path)).runs[0].coverage_json).resume.started_at,'2026-10-11T13:50:00.000Z')
  github.overrides.clear()
  await at('2026-10-11T13:55:00Z')
  await send(path + '/revoke', {})
  await send(path + '/collect', {}, 201)
  const refused = (await get(path)).runs[0]
  assert.equal(refused.outcome, 'failed')
  assert.equal(JSON.parse(refused.coverage_json).source_read_started_at, null, 'refused authority cannot acquire a source-read timestamp')
  const query = '?from=2026-10-11&to=2026-10-11'
  const report = await get(path + '/report' + query)
  assert.deepEqual(report.attempts.map(r => r.id).sort(), (await get(path)).runs.map(r => r.id).sort())
  assert.ok(report.attempts.some(r => r.outcome === 'throttled')); assert.ok(report.attempts.some(r => r.outcome === 'failed')); assert.ok(report.attempts.some(r => r.outcome === 'complete'))
  assert.ok(report.missing.some(g => /No recorded collection attempt/.test(g.reason)))
  const controlReport = await get('/api/controls/' + mapped.id + '/report' + query)
  assert.equal(controlReport.collections.length, report.attempts.length)
  assert.ok(controlReport.collections.some(r => r.id === initial.id && JSON.parse(r.coverage_json).context.controls.some(c => c.control_id === mapped.id && c.revision === 1)))
  assert.ok(controlReport.collections.some(r => r.id === partial.id && JSON.parse(r.coverage_json).context.controls.some(c => c.control_id === mapped.id && c.revision === 2)))
  for (const q of ['?from=2026-02-30&to=2026-10-11', '?from=2026-10-12&to=2026-10-11', '']) assert.equal((await app.fetch(path + '/report' + q)).status, 400)
  assert.equal((await app.fetch(path + '/report' + query, { headers: { cookie: '' } })).status, 401)
  assert.equal((await app.fetch(path + '/report' + query, { headers: { origin: 'https://foreign.test' } })).status, 403)

  assert.equal(JSON.parse(refused.coverage_json).interval_minutes, 15, 'COLLECTION-001 retains the schedule even when authority is revoked before any provider read')
  await target.signin()
  const restored = await target.fetch('/api/archive/restore', { method: 'POST', headers: { origin: target.origin, 'content-type': 'application/octet-stream', 'x-evidence-confirm': 'restore', 'x-evidence-erasure-history': 'unverified acknowledged' }, body: await (await app.fetch('/api/archive/export')).arrayBuffer() })
  assert.equal(restored.status, 200, await restored.clone().text())
  const copy = await (await target.fetch(path)).json()
  assert.deepEqual((await (await target.fetch(path + '/report' + query)).json()).attempts, report.attempts); assert.deepEqual(copy.runs, (await get(path)).runs); assert.equal(JSON.parse(copy.connection.config_json).collection_minutes, 15)
  assert.equal(copy.connection.status, 'inactive after restore')
 } finally { await app.close(); await target.close() }
}
