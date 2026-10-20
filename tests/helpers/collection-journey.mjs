import assert from 'node:assert/strict'
import { runtime } from './runtime.mjs'
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
  const initial = history[0], resourceCount = (await app.db.prepare('SELECT COUNT(*) AS n FROM resource_versions').first()).n
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
  await target.signin()
  const restored = await target.fetch('/api/archive/restore', { method: 'POST', headers: { origin: target.origin, 'content-type': 'application/octet-stream', 'x-evidence-confirm': 'restore', 'x-evidence-erasure-history': 'unverified acknowledged' }, body: await (await app.fetch('/api/archive/export')).arrayBuffer() })
  assert.equal(restored.status, 200, await restored.clone().text())
  const copy = await (await target.fetch(path)).json()
  assert.deepEqual(copy.runs, (await get(path)).runs); assert.equal(JSON.parse(copy.connection.config_json).collection_minutes, 15)
  assert.equal(copy.connection.status, 'inactive after restore')
 } finally { await app.close(); await target.close() }
}
