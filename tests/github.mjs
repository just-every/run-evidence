import {gitlabScopeJourney,gitlabHistoryJourney,gitlabPagingJourney,gitlabMembersJourney} from './helpers/gitlab-journey.mjs'
// GitHub connection custody, scheduled collection and catalogue tests through
// the owner's doors and the Cron Trigger. GitHub itself is the only fake: a
// network-edge stand-in for api.github.com that answers the documented REST
// shapes, pages its repository list and records every method it receives.
process.env.RER_SERVER_JOURNEY = '1'
import assert from 'node:assert/strict'
import { runtime } from './helpers/runtime.mjs'
import { githubDependenciesJourney } from './helpers/github-dependencies-journey.mjs'
import { githubMembersJourney } from './helpers/github-members-journey.mjs'
import { githubHistoryJourney } from './helpers/github-history-journey.mjs'
import { collectionJourney } from './helpers/collection-journey.mjs'
import { githubFixture } from './helpers/github-fixture.mjs'
const { github, outbound: fakeGitHub } = githubFixture()
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
 await scenario('CONNECT-001: a GitHub credential is kept only after a real read check, encrypted, and never shown again', async () => {
  await app.signin()
  await owner('/api/connections', { account: 'northstar', token: 'synthetic-evidence-99' }, 400)
  for (const api_base of ['https://169.254.169.254', 'https://ghe.internal', 'http://ghe.example.test/api/v3']) await owner('/api/connections', { account: 'northstar', token: 'synthetic-evidence-1', api_base }, 400)
  assert.equal((await app.db.prepare('SELECT COUNT(*) AS n FROM connections').first()).n, 0)
  connection = await owner('/api/connections', { account: 'northstar', token: 'synthetic-evidence-1', label: 'GitHub production' })
  assert.deepEqual(connection.repositories.sort(), ['northstar/site', 'northstar/tools', 'northstar/web'])
  const stored = await app.db.prepare('SELECT * FROM connections').first()
  assert.ok(stored.secret_ciphertext && !stored.secret_ciphertext.includes('synthetic-evidence-1'))
  for (const text of [JSON.stringify(await get('/api/connections')), JSON.stringify(await get('/api/connections/' + connection.id)), JSON.stringify((await app.db.prepare('SELECT * FROM product_audit').all()).results), await (await app.fetch('/app/connections/' + connection.id)).text()]) assert.ok(!text.includes('synthetic-evidence-1') && !text.includes(stored.secret_ciphertext))
  const tests = (await get('/api/tests')).tests.filter(t => t.origin === 'catalogue')
  assert.deepEqual(tests.map(t => t.catalogue_id).sort(), ['github.branch-protection', 'github.departed-members', 'github.dependabot-critical', 'github.org-two-factor', 'github.repository-private', 'github.required-checks', 'github.required-review', 'github.secret-scanning-open'])
  assert.deepEqual((await get('/api/tests')).catalogue.find(e => e.id === 'github.departed-members').criteria, [{attribute:'departed_members',op:'max',value:0}])
 })
 await scenario('CONNECT-001: The scheduler reads only selected repositories and catalogue tests fail with per-provider remediation steps', async () => {
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
 await scenario('CONNECT-001: A source fix verifies on the next hourly read; revoked repository access stays in the denominator as unknown', async () => {
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
 await scenario('CONNECT-001: Throttling backs off without fabricated runs; rotation and revocation never resurrect old authority; stale reads go unknown', async () => {
  github.throttleUntil = Date.parse('2026-10-11T15:30:00Z')
  await at('2026-10-11T15:00:00Z'); await app.tick()
  let runs = (await get('/api/connections/' + connection.id)).runs
  assert.equal(runs[0].outcome, 'throttled'); assert.ok((await get('/api/connections/' + connection.id)).connection.next_attempt_at >= '2026-10-11T15:30:00.000Z')
  await at('2026-10-11T15:10:00Z'); await app.tick()
  assert.equal((await get('/api/connections/' + connection.id)).runs.length, runs.length)
  await at('2026-10-11T16:05:00Z'); await app.tick()
  runs = (await get('/api/connections/' + connection.id)).runs; assert.equal(runs[0].outcome, 'complete')
  github.tokens = new Set(['synthetic-evidence-2'])
  await at('2026-10-11T17:05:00Z'); await app.tick()
  const broken = await get('/api/connections/' + connection.id)
  assert.equal(broken.connection.status, 'needs reconnect'); assert.equal(broken.runs[0].outcome, 'failed')
  await owner(`/api/connections/${connection.id}/rotate`, { token: 'synthetic-evidence-1' }, 400)
  await owner(`/api/connections/${connection.id}/rotate`, { token: 'synthetic-evidence-2' }, 200)
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
 await scenario('CODE-001: GitHub SPDX package metadata enters inventory without secret fields or invented manifest revisions, retaining denied scope, removals and custody history', githubDependenciesJourney)
 await scenario('CODE-001: GitHub membership, MFA and owner-reviewed People matches preserve departed accounts, denied scope and source removal without merging people', githubMembersJourney)
 await scenario('CODE-001: GitHub merged change reviews, exact-revision checks and deployments retain source times, gaps, cursor recovery and immutable period history', githubHistoryJourney)
 await scenario('COLLECTION-001: configurable elapsed schedules retain schema and pagination gaps, recover only on fresh reads, and survive restart and restore', collectionJourney)
 await scenario('PORTABLE-001 / CONNECT-001: a custody archive carries every program record; restored tokens and connections hold no authority', async () => {
  const program = await owner('/api/programs', { framework: 'soc2', name: 'SOC 2', legal_entity: 'Northstar', report_type: 'Type I', audit_from: '2026-10-01', audit_to: '2026-10-01' })
  const token = await owner('/api/api-tokens', { name: 'Restore probe', scopes: ['read'], expires_at: '2027-04-01' })
  await owner('/api/policies', { title: 'Information security policy', body: 'Security is everyone\'s job.' })
  await owner('/api/people', { name: 'Ana Ruiz', email: 'ana@northstar.test', kind: 'employee' })
  const exported = Buffer.from(await (await app.fetch('/api/archive/export')).arrayBuffer())
  const manifest = await get('/api/archive/manifest')
  assert.ok(manifest.counts.observations > 0 && manifest.counts.programs === 1 && manifest.counts.connections === 1)
  assert.ok(!exported.includes('github_pat_') && !exported.includes(token.token))
  const target = await runtime(); await target.signin()
  const restored = await target.fetch('/api/archive/restore', { method: 'POST', headers: { origin: target.origin, 'content-type': 'application/octet-stream', 'x-evidence-confirm': 'restore', 'x-evidence-erasure-history':'unverified acknowledged' }, body: exported })
  assert.equal(restored.status, 200, await restored.clone().text())
  for (const table of ['people', 'programs', 'program_revisions', 'library_adoptions', 'tests', 'test_runs', 'observations', 'obligations', 'obligation_events', 'collection_runs', 'policy_revisions', 'product_audit', 'resources']) {
   const rows = async db => (await db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()).results, source = await rows(app.db), ids = new Set(source.map(r => r.id))
   // The destination owner's own sign-in entries (LOG-001) precede the restored audit.
   const all = await rows(target.db)
   if (table === 'product_audit') assert.ok(all.filter(r => !ids.has(r.id)).every(r => r.action.startsWith('auth.')))
   assert.deepEqual(table === 'product_audit' ? all.filter(r => ids.has(r.id)) : all, source, table)
  }
  assert.equal((await target.db.prepare('SELECT COUNT(*) AS n FROM api_tokens WHERE token_hash IS NULL').first()).n, (await app.db.prepare('SELECT COUNT(*) AS n FROM api_tokens').first()).n)
  assert.equal((await target.fetch('/v1/programs', { headers: { cookie: '', authorization: 'Bearer ' + token.token } })).status, 401)
  assert.deepEqual(await target.db.prepare('SELECT status,secret_ciphertext FROM connections').first(), { status: 'inactive after restore', secret_ciphertext: null })
  assert.equal((await target.fetch('/api/programs/' + program.id)).status, 200)
  const again = await app.fetch('/api/archive/restore', { method: 'POST', headers: { origin: app.origin, 'content-type': 'application/octet-stream', 'x-evidence-confirm': 'restore', 'x-evidence-erasure-history':'unverified acknowledged' }, body: exported })
  assert.equal(again.status, 400); assert.match((await again.json()).error, /empty Evidence database/)
  await target.close()
 })
 await scenario('INVENTORY-001: source IDs remain connection-qualified after reconnect and one connection cannot shrink another population', async () => {
  const test = await testByCatalogue('github.branch-protection')
  const original = (await get('/api/tests/' + test.id)).latest
  const replacement = await owner('/api/connections', { account: 'northstar', token: 'synthetic-evidence-2', label: 'Replacement GitHub connection' })
  await owner(`/api/connections/${replacement.id}/repositories`, { repositories: ['northstar/web'] }, 200)
  assert.equal((await owner(`/api/connections/${replacement.id}/collect`, {})).outcome, 'complete')
  const after = (await get('/api/tests/' + test.id)).latest
  assert.equal(after.length, original.length + 1)
  for (const old of original) assert.ok(after.some(row => row.resource_id === old.resource_id), 'original connection subject retained')
  const shared = after.filter(row => row.display_name === 'northstar/web')
  assert.equal(new Set(shared.map(row => row.resource_id)).size, 2)
  assert.equal(shared.filter(row => row.result === 'unknown').length, 1)
  await owner(`/api/connections/${replacement.id}/repositories`, { repositories: [] }, 200)
  await owner(`/api/connections/${replacement.id}/collect`, {})
  const retained = (await get('/api/tests/' + test.id)).latest
  assert.deepEqual(retained.map(row => row.resource_id).sort(), original.map(row => row.resource_id).sort())
  const snapshot = await get('/api/inventory')
  const repos = snapshot.records.filter(row => row.source_type === 'github.repository')
  assert.equal(repos.length, original.length + 1)
  assert.equal(new Set(repos.map(row => row.source_key)).size, repos.length)
  assert.ok(repos.every(row => row.lifecycle === 'active'), 'source absence never records an owner retirement')
  assert.ok(repos.some(row => row.collection_state === 'removed'))
  const bytes=await (await app.fetch('/api/archive/export')).arrayBuffer(),receiver=await runtime({ownerEmail:'inventory-receiver@northstar.test'})
  try {
   await receiver.signin()
   const restored=await receiver.fetch('/api/archive/restore',{method:'POST',headers:{origin:receiver.origin,'content-type':'application/octet-stream','x-evidence-confirm':'restore','x-evidence-erasure-history':'unverified acknowledged'},body:bytes})
   assert.equal(restored.status,200,await restored.clone().text())
   const after=await (await receiver.fetch('/api/inventory')).json()
   assert.deepEqual(after.records.filter(r=>r.source_type==='github.repository').map(r=>r.source_key).sort(),repos.map(r=>r.source_key).sort(),'PORTABLE-001 retains both connection-qualified copies of a provider ID')
  }finally{await receiver.close()}

 })
 await scenario('LIBRARY-001: one connected MFA observation on the shared AC-05 control passes and then fails SOC 2, ISO 27001 and HIPAA; an accepted library revision moves mappings forward while earlier runs keep their revision, through restore', async () => {
  const lib = await runtime({ outbound: fakeGitHub }), target = await runtime()
  try {
   await lib.clock('2026-10-12T09:00:00Z'); github.clock = '2026-10-12T09:00:00Z'; github.org.two_factor_requirement_enabled = true
   await lib.signin()
   const send = async (path, body, status = 201, origin = lib.origin) => { const r = await lib.fetch(path, { method: 'POST', headers: { origin, 'content-type': 'application/json' }, body: JSON.stringify(body) }); const text = await r.text(); assert.equal(r.status, status, path + ' ' + text); return text ? JSON.parse(text) : null }
   const read = async path => { const r = await lib.fetch(path); assert.equal(r.status, 200, path); return r.json() }
   const programs = {}
   for (const framework of ['soc2', 'iso27001', 'hipaa']) programs[framework] = (await send('/api/programs', { framework, name: framework + ' program', legal_entity: 'Northstar', report_type: 'Type II', audit_from: '2026-10-01', audit_to: '2027-09-30' })).id
   const linked = await send('/api/connections', { account: 'northstar', token: 'synthetic-evidence-2', label: 'GitHub org' })
   await send(`/api/connections/${linked.id}/repositories`, { repositories: ['northstar/web'] }, 200)
   const receipts = async () => (await lib.db.prepare('SELECT COUNT(*) AS n FROM receipts').first()).n, stored = await receipts()
   const mfa = async () => { const test = (await read('/api/tests')).tests.find(t => t.catalogue_id === 'github.org-two-factor'); return read('/api/tests/' + test.id) }
   // Every requirement of each program that AC-05 serves, with that control's test state.
   const served = async framework => (await read('/api/programs/' + programs[framework])).readiness.requirements.filter(r => r.controls.some(c => c.library_id === 'AC-05')).map(r => ({ ref: r.ref, testing: r.testing, control: r.controls.find(c => c.library_id === 'AC-05'), libraries: r.controls.map(c => c.library_id) }))
   assert.equal((await send(`/api/connections/${linked.id}/collect`, {})).outcome, 'complete')
   let detail = await mfa()
   assert.deepEqual(detail.latest.map(o => [o.display_name, o.result, o.library_revision]), [['northstar (organization)', 'pass', 1]])
   assert.equal((await lib.db.prepare('SELECT COUNT(*) AS n FROM observations WHERE test_id=?').bind(detail.test.id).first()).n, 1)
   for (const [framework, ref] of [['soc2', 'CC6.1'], ['iso27001', 'A.8.5'], ['hipaa', '164.312(d)']]) {
    const rows = await served(framework)
    assert.ok(rows.some(r => r.ref === ref), framework + ' ' + ref)
    for (const r of rows) assert.deepEqual([r.control.tests.tests, r.control.tests.pass, r.control.tests.fail, r.control.tests.unknown], [1, 1, 0, 0], framework + ' ' + r.ref)
   }
   assert.equal(await receipts(), stored)
   // Revision 2 waits as a reviewable change set; current mappings stay at revision 1.
   const review = await read('/api/library')
   assert.equal(review.accepted, 1); assert.equal(review.latest, 4); assert.deepEqual(review.history, [])
   const change = review.pending[0].changes.find(x => x.control === 'AC-13')
   assert.deepEqual([change.framework, change.ref, change.change, change.programs.map(p => p.id)], ['iso27001', 'A.5.16', 'added', [programs.iso27001]])
   const isoRow = async ref => (await read('/api/programs/' + programs.iso27001)).readiness.requirements.find(r => r.ref === ref).controls.map(c => c.library_id)
   assert.ok(!(await isoRow('A.5.16')).includes('AC-13')); assert.ok(!(await isoRow('A.8.5')).includes('AC-12'))
   assert.match(await (await lib.fetch('/app/library')).text(), /Revision 2 · waiting for review/)
   await send('/api/library/revisions/2', {}, 400)
   await send('/api/library/revisions/2', { reason: 'x' }, 403, 'https://evil.test')
   await send('/api/library/revisions/5', { reason: 'Not shipped' }, 404)
   assert.deepEqual((await send('/api/library/revisions/2', { reason: 'Reviewed with our assessor' }, 200)).accepted, 2)
   await send('/api/library/revisions/2', { reason: 'again' }, 409); await send('/api/library/revisions/1', { reason: 'back' }, 409)
   assert.ok((await isoRow('A.5.16')).includes('AC-13')); assert.ok((await isoRow('A.8.5')).includes('AC-12'))
   assert.ok((await served('soc2')).find(r => r.ref === 'CC6.1').libraries.includes('AC-12'))
   assert.equal((await read('/api/library')).accepted, 2)
   assert.ok((await read('/api/audit')).entries.some(e => e.action === 'library.revision-accepted' && /1 -> 2: Reviewed with our assessor/.test(e.detail)))
   // The same test now fails: one new observation under revision 2; the earlier one keeps revision 1.
   github.org.two_factor_requirement_enabled = false
   await lib.clock('2026-10-12T09:20:00Z'); github.clock = '2026-10-12T09:20:00Z'
   assert.equal((await send(`/api/connections/${linked.id}/collect`, {})).outcome, 'complete')
   detail = await mfa()
   assert.deepEqual(detail.runs.map(r => [r.library_revision, r.failed, r.passed]), [[2, 1, 0], [1, 0, 1]])
   assert.equal((await lib.db.prepare('SELECT COUNT(*) AS n FROM observations WHERE test_id=?').bind(detail.test.id).first()).n, 2)
   for (const framework of ['soc2', 'iso27001', 'hipaa']) for (const r of await served(framework)) {
    assert.equal(r.testing, 'failing', framework + ' ' + r.ref); assert.deepEqual([r.control.tests.pass, r.control.tests.fail], [0, 1])
   }
   assert.equal(await receipts(), stored)
   assert.match(await (await lib.fetch('/app/tests/' + detail.test.id)).text(), /Library revision/)
   // The catalogue entry and each program's readiness board show the last-run time.
   assert.equal((await read('/api/tests')).tests.find(t => t.id === detail.test.id).last_run, '2026-10-12T09:20:00.000Z')
   for (const id of Object.values(programs)) assert.deepEqual((await read(`/api/programs/${id}/board`)).tests.filter(t => t.id === detail.test.id).map(t => [t.last_run, t.status]), [['2026-10-12T09:20:00.000Z', 'failing']])
   const obligation = (await read('/api/remediation')).open.find(o => o.test_id === detail.test.id)
   assert.equal((await read('/api/remediation/' + obligation.id)).observations[0].library_revision, 2)
   assert.match(await (await lib.fetch('/app/remediation/' + obligation.id)).text(), /library revision 2/)
   // Restore carries the acceptance and every run's revision unchanged.
   await target.signin()
   const restored = await target.fetch('/api/archive/restore', { method: 'POST', headers: { origin: target.origin, 'content-type': 'application/octet-stream', 'x-evidence-confirm': 'restore', 'x-evidence-erasure-history': 'unverified acknowledged' }, body: Buffer.from(await (await lib.fetch('/api/archive/export')).arrayBuffer()) })
   assert.equal(restored.status, 200, await restored.clone().text())
   for (const table of ['library_acceptances', 'run_library_revisions']) assert.deepEqual((await target.db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()).results, (await lib.db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()).results, table)
   assert.equal((await (await target.fetch('/api/library')).json()).accepted, 2)
  } finally { await lib.close(); await target.close() }
 })
 await scenario('CODE-001: GitLab inherited members require explicit People matches, preserve unknown MFA and retain departed, denied and removed account history',gitlabMembersJourney)
 await scenario('CODE-001: GitLab owner authorization, scoped privacy and protection tests, source fixes, lost access, credential rotation and revocation',gitlabScopeJourney)
 await scenario('CODE-001: GitLab source reviews, exact-head pipelines, deployments and dependency inventory retain unknown event times, earlier failures and custody',gitlabHistoryJourney)
 await scenario('CODE-001 / COLLECTION-001: GitLab resumes the saved page after restart, refuses query-filter changes and inherits schedules, events and inactive restore',gitlabPagingJourney)
 console.log(`${passed} code connection public-door scenarios passed; GitHub is faked only at the network edge.`)
} finally { await app.close() }
