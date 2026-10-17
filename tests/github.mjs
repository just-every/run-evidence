// GitHub connection custody, scheduled collection and catalogue tests through
// the owner's doors and the Cron Trigger. GitHub itself is the only fake: a
// network-edge stand-in for api.github.com that answers the documented REST
// shapes, pages its repository list and records every method it receives.
process.env.RER_SERVER_JOURNEY = '1'
import assert from 'node:assert/strict'
import { runtime } from './helpers/runtime.mjs'
const github = { tokens: new Set(['github_pat_good']), throttleUntil: 0, methods: [], hidden: new Set(), org: { login: 'northstar', two_factor_requirement_enabled: false }, repos: {
 'northstar/web': { private: true, protection: { reviews: 1, checks: ['ci'] }, dependabot: 0, secrets: 0 },
 'northstar/site': { private: false, protection: null, dependabot: 2, secrets: 0 },
 'northstar/tools': { private: true, protection: null, dependabot: 0, secrets: 0 },
} }
const reply = (status, body, headers = {}) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'x-ratelimit-remaining': '4999', ...headers } })
async function fakeGitHub(request) {
 const url = new URL(request.url)
 if (url.origin !== 'https://api.github.com') return null
 github.methods.push(request.method)
 const now = Date.parse(github.clock)
 if (github.throttleUntil > now) return reply(403, { message: 'API rate limit exceeded' }, { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': String(Math.floor(github.throttleUntil / 1000)) })
 if (!github.tokens.has((request.headers.get('authorization') ?? '').replace('Bearer ', ''))) return reply(401, { message: 'Bad credentials' })
 const path = url.pathname
 if (path === '/orgs/northstar') return reply(200, github.org)
 if (path === '/orgs/northstar/repos') {
  const names = Object.keys(github.repos), page = Number(url.searchParams.get('page') ?? 1), slice = names.slice((page - 1) * 2, page * 2)
  return reply(200, slice.map(full_name => ({ full_name })), page * 2 < names.length ? { link: `<https://api.github.com/orgs/northstar/repos?per_page=100&type=all&page=${page + 1}>; rel="next"` } : {})
 }
 const match = /^\/repos\/(northstar\/[a-z]+)(\/.*)?$/.exec(path), repo = match && github.repos[match[1]]
 if (!repo || github.hidden.has(match[1])) return reply(404, { message: 'Not Found' })
 if (!match[2]) return reply(200, { full_name: match[1], private: repo.private, archived: false, default_branch: 'main' })
 if (match[2] === '/branches/main/protection') return repo.protection ? reply(200, { required_pull_request_reviews: { required_approving_review_count: repo.protection.reviews }, required_status_checks: { contexts: repo.protection.checks }, enforce_admins: { enabled: true } }) : reply(404, { message: 'Branch not protected' })
 if (match[2] === '/dependabot/alerts') return reply(200, Array.from({ length: repo.dependabot }, (_, i) => ({ number: i + 1, state: 'open' })))
 if (match[2] === '/secret-scanning/alerts') return reply(200, Array.from({ length: repo.secrets }, (_, i) => ({ number: i + 1, state: 'open' })))
 return reply(404, { message: 'Not Found' })
}
const app = await runtime({ outbound: fakeGitHub })
github.clock = '2026-10-11T12:00:00Z'
const at = async time => { github.clock = time; await app.clock(time) }
let passed = 0
const scenario = async (name, fn) => { await fn(); passed++; console.log('PASS ' + name) }
const owner = async (path, body, status = 201) => { const r = await app.fetch(path, { method: 'POST', headers: { origin: app.origin, 'content-type': 'application/json' }, body: JSON.stringify(body) }); const text = await r.text(); assert.equal(r.status, status, path + ' ' + text); return text ? JSON.parse(text) : null }
const get = async path => { const r = await app.fetch(path); assert.equal(r.status, 200, path); return r.json() }
const testByCatalogue = async id => (await get('/api/tests')).tests.find(t => t.catalogue_id === id)
const results = async id => Object.fromEntries((await get('/api/tests/' + (await testByCatalogue(id)).id)).latest.map(o => [o.display_name, o.result]))
let connection
try {
 await scenario('A GitHub credential is kept only after a real read check, encrypted, and never shown again', async () => {
  await app.signin()
  await owner('/api/connections', { account: 'northstar', token: 'github_pat_wrong' }, 400)
  for (const api_base of ['https://169.254.169.254', 'https://ghe.internal', 'http://ghe.example.test/api/v3']) await owner('/api/connections', { account: 'northstar', token: 'github_pat_good', api_base }, 400)
  assert.equal((await app.db.prepare('SELECT COUNT(*) AS n FROM connections').first()).n, 0)
  connection = await owner('/api/connections', { account: 'northstar', token: 'github_pat_good', label: 'GitHub production' })
  assert.deepEqual(connection.repositories.sort(), ['northstar/site', 'northstar/tools', 'northstar/web'])
  const stored = await app.db.prepare('SELECT * FROM connections').first()
  assert.ok(stored.secret_ciphertext && !stored.secret_ciphertext.includes('github_pat_good'))
  for (const text of [JSON.stringify(await get('/api/connections')), JSON.stringify(await get('/api/connections/' + connection.id)), JSON.stringify((await app.db.prepare('SELECT * FROM product_audit').all()).results), await (await app.fetch('/app/connections/' + connection.id)).text()]) assert.ok(!text.includes('github_pat_good') && !text.includes(stored.secret_ciphertext))
  const tests = (await get('/api/tests')).tests.filter(t => t.origin === 'catalogue')
  assert.deepEqual(tests.map(t => t.catalogue_id).sort(), ['github.branch-protection', 'github.dependabot-critical', 'github.org-two-factor', 'github.repository-private', 'github.required-checks', 'github.required-review', 'github.secret-scanning-open'])
  assert.ok((await get('/api/tests')).catalogue.find(e => e.id === 'github.departed-members').manualRequirement)
 })
 await scenario('The scheduler reads only selected repositories and catalogue tests fail with per-provider remediation steps', async () => {
  await owner(`/api/connections/${connection.id}/repositories`, { repositories: ['northstar/web', 'northstar/site'] }, 200)
  await app.tick()
  const detail = await get('/api/connections/' + connection.id)
  assert.equal(detail.runs.length, 1); assert.equal(detail.runs[0].outcome, 'complete'); assert.equal(detail.runs[0].trigger, 'schedule')
  assert.deepEqual(JSON.parse(detail.runs[0].coverage_json).repositories_read.sort(), ['northstar/site', 'northstar/web'])
  assert.deepEqual(await results('github.branch-protection'), { 'northstar/site': 'fail', 'northstar/web': 'pass' })
  assert.deepEqual(await results('github.repository-private'), { 'northstar/site': 'fail', 'northstar/web': 'pass' })
  assert.deepEqual(await results('github.dependabot-critical'), { 'northstar/site': 'fail', 'northstar/web': 'pass' })
  assert.deepEqual(await results('github.org-two-factor'), { 'northstar (organization)': 'fail' })
  const branch = await get('/api/tests/' + (await testByCatalogue('github.branch-protection')).id)
  assert.match(branch.entry.remediation.github.terraform, /github_branch_protection/); assert.match(branch.entry.remediation.github.api, /protection/)
  assert.ok(branch.latest.every(o => o.source_kind === 'source-observed'))
  assert.match(await (await app.fetch('/app/tests/' + branch.test.id)).text(), /How to remediate/)
  assert.ok((await get('/api/remediation')).open.some(o => o.resource_name === 'northstar/site' && o.test_name === 'Default branch is protected'))
  assert.ok(github.methods.length > 0 && github.methods.every(m => m === 'GET'))
 })
 await scenario('A source fix verifies on the next hourly read; revoked repository access stays in the denominator as unknown', async () => {
  github.repos['northstar/site'].protection = { reviews: 2, checks: ['ci'] }
  await at('2026-10-11T13:00:00Z'); await app.tick()
  assert.deepEqual(await results('github.branch-protection'), { 'northstar/site': 'pass', 'northstar/web': 'pass' })
  const verified = (await get('/api/remediation')).resolved.find(o => o.resource_name === 'northstar/site' && o.test_name === 'Default branch is protected')
  const history = await get('/api/remediation/' + verified.id)
  assert.deepEqual(history.observations.map(o => o.result).slice(0, 2), ['pass', 'fail'])
  github.hidden.add('northstar/web')
  await at('2026-10-11T14:00:00Z'); await app.tick()
  const runs = (await get('/api/connections/' + connection.id)).runs
  assert.equal(runs[0].outcome, 'partial'); assert.match(runs[0].coverage_json, /northstar\/web.*access revoked/)
  assert.deepEqual(await results('github.branch-protection'), { 'northstar/site': 'pass', 'northstar/web': 'unknown' })
  github.hidden.delete('northstar/web')
 })
 await scenario('Throttling backs off without fabricated runs; rotation and revocation never resurrect old authority; stale reads go unknown', async () => {
  github.throttleUntil = Date.parse('2026-10-11T15:30:00Z')
  await at('2026-10-11T15:00:00Z'); await app.tick()
  let runs = (await get('/api/connections/' + connection.id)).runs
  assert.equal(runs[0].outcome, 'throttled'); assert.ok((await get('/api/connections/' + connection.id)).connection.next_attempt_at >= '2026-10-11T15:30:00.000Z')
  await at('2026-10-11T15:10:00Z'); await app.tick()
  assert.equal((await get('/api/connections/' + connection.id)).runs.length, runs.length)
  await at('2026-10-11T16:05:00Z'); await app.tick()
  runs = (await get('/api/connections/' + connection.id)).runs; assert.equal(runs[0].outcome, 'complete')
  github.tokens = new Set(['synthetic-github_pat_rotated'])
  await at('2026-10-11T17:05:00Z'); await app.tick()
  const broken = await get('/api/connections/' + connection.id)
  assert.equal(broken.connection.status, 'needs reconnect'); assert.equal(broken.runs[0].outcome, 'failed')
  await owner(`/api/connections/${connection.id}/rotate`, { token: 'github_pat_good' }, 400)
  await owner(`/api/connections/${connection.id}/rotate`, { token: 'synthetic-github_pat_rotated' }, 200)
  assert.equal((await owner(`/api/connections/${connection.id}/collect`, {})).outcome, 'complete')
  await owner(`/api/connections/${connection.id}/revoke`, {}, 200)
  const revoked = await app.db.prepare('SELECT status,secret_ciphertext FROM connections').first()
  assert.deepEqual(revoked, { status: 'revoked', secret_ciphertext: null })
  assert.equal((await owner(`/api/connections/${connection.id}/collect`, {})).outcome, 'failed')
  const before = (await get('/api/connections/' + connection.id)).runs.length
  await at('2026-10-11T21:00:00Z'); await app.tick()
  assert.equal((await get('/api/connections/' + connection.id)).runs.length, before)
  assert.deepEqual(await results('github.branch-protection'), { 'northstar/site': 'unknown', 'northstar/web': 'unknown' })
  const latest = (await get('/api/tests/' + (await testByCatalogue('github.branch-protection')).id)).latest
  assert.ok(latest.every(o => /stale/.test(o.reason)))
 })
 await scenario('A version 4 custody archive carries every program record; restored tokens and connections hold no authority', async () => {
  const program = await owner('/api/programs', { framework: 'soc2', name: 'SOC 2', legal_entity: 'Northstar', report_type: 'Type I', audit_from: '2026-10-01', audit_to: '2026-10-01' })
  const token = await owner('/api/api-tokens', { name: 'Restore probe', scopes: ['read'], expires_at: '2027-04-01' })
  await owner('/api/policies', { title: 'Information security policy', body: 'Security is everyone\'s job.' })
  await owner('/api/people', { name: 'Ana Ruiz', email: 'ana@northstar.test', kind: 'employee' })
  const exported = Buffer.from(await (await app.fetch('/api/archive/export')).arrayBuffer())
  const manifest = await get('/api/archive/manifest')
  assert.equal(manifest.manifest.version, 4); assert.ok(manifest.counts.observations > 0 && manifest.counts.programs === 1 && manifest.counts.connections === 1)
  assert.ok(!exported.includes('github_pat_') && !exported.includes(token.token))
  const target = await runtime(); await target.signin()
  const restored = await target.fetch('/api/archive/restore', { method: 'POST', headers: { origin: target.origin, 'content-type': 'application/octet-stream', 'x-evidence-confirm': 'restore' }, body: exported })
  assert.equal(restored.status, 200, await restored.clone().text())
  for (const table of ['people', 'programs', 'program_revisions', 'library_adoptions', 'tests', 'test_runs', 'observations', 'obligations', 'obligation_events', 'collection_runs', 'policy_revisions', 'product_audit', 'resources']) {
   const rows = async db => (await db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()).results
   assert.deepEqual(await rows(target.db), await rows(app.db), table)
  }
  assert.equal((await target.db.prepare('SELECT COUNT(*) AS n FROM api_tokens WHERE token_hash IS NULL').first()).n, (await app.db.prepare('SELECT COUNT(*) AS n FROM api_tokens').first()).n)
  assert.equal((await target.fetch('/v1/programs', { headers: { cookie: '', authorization: 'Bearer ' + token.token } })).status, 401)
  assert.deepEqual(await target.db.prepare('SELECT status,secret_ciphertext FROM connections').first(), { status: 'inactive after restore', secret_ciphertext: null })
  assert.equal((await target.fetch('/api/programs/' + program.id)).status, 200)
  const again = await app.fetch('/api/archive/restore', { method: 'POST', headers: { origin: app.origin, 'content-type': 'application/octet-stream', 'x-evidence-confirm': 'restore' }, body: exported })
  assert.equal(again.status, 400); assert.match((await again.json()).error, /empty Evidence database/)
  await target.close()
 })
 console.log(`${passed} GitHub connection public-door scenarios passed; GitHub is faked only at the network edge.`)
} finally { await app.close() }
