import assert from 'node:assert/strict'
import { runtime } from './runtime.mjs'
import { githubFixture } from './github-fixture.mjs'
import { vantaZip, vantaFiles } from '../fixtures/vanta/bundle.mjs'
import { secureframeZip, secureframeFiles } from '../fixtures/secureframe/bundle.mjs'
import { zip, digest } from '../fixtures/drata/fixture.mjs'
const json = (app, path, body, status = 200) => app.fetch(path, { method: 'POST', headers: { origin: app.origin, 'content-type': 'application/json' }, body: JSON.stringify(body) }).then(async r => { assert.equal(r.status, status, path + ' ' + await r.clone().text()); return r.json().catch(() => null) })
const get = async (app, path) => { const r = await app.fetch(path); assert.equal(r.status, 200, path); return r.json() }
export const upload = (app, provider, bytes) => { const form = new FormData(); form.set('file', new File([bytes], provider + '.zip', { type: 'application/zip' })); return app.fetch('/api/import/' + provider, { method: 'POST', headers: { origin: app.origin }, body: form }) }
const table = rec => Object.fromEntries(rec.map(c => [c.id, [c.source, c.admitted, c.unsupported, c.refused]]))
const counts = app => app.db.prepare("SELECT (SELECT COUNT(*) FROM receipts) r,(SELECT COUNT(*) FROM controls) c,(SELECT COUNT(*) FROM people) p,(SELECT COUNT(*) FROM test_runs) t,(SELECT COUNT(*) FROM observations) o,(SELECT COUNT(*) FROM connections) k,(SELECT COUNT(*) FROM vendors) v,(SELECT COUNT(*) FROM risks) i").first()
const finish = async (app, id) => { let job = (await json(app, '/api/import/' + id + '/commit', { approve: 'commit', fingerprint: (await get(app, '/api/import/' + id)).review.fingerprint })).job; for (let i = 0; job.state === 'applying' && i < 20; i++) job = (await json(app, '/api/import/' + id + '/resume', {})).job; return job }
async function undo(app, id) { let job = (await json(app, '/api/import/' + id + '/undo', { approve: 'undo' })).job; for (let i = 0; ['undoing', 'rolling_back'].includes(job.state) && i < 20; i++) job = (await json(app, '/api/import/' + id + '/resume', {})).job; return job }
const archive = async app => Buffer.from(await (await app.fetch('/api/archive/export')).arrayBuffer())
async function restore(source, bytes) { const target = await runtime(); await target.signin(); const r = await target.fetch('/api/archive/restore', { method: 'POST', headers: { origin: target.origin, 'content-type': 'application/octet-stream', 'x-evidence-confirm': 'restore', 'x-evidence-erasure-history': 'unverified acknowledged' }, body: bytes }); assert.equal(r.status, 200, await r.clone().text()); return target }
export const vantaTable = { frameworks_controls: [11, 10, 0, 1], test_history: [6, 5, 0, 1], policies: [6, 6, 0, 0], people: [5, 4, 0, 1], vendors: [3, 2, 0, 1], risks: [2, 2, 0, 0], access_reviews: [0, 0, 0, 0], audit_requests: [4, 3, 0, 1], trust_answers: [0, 0, 0, 0], exhibits: [6, 3, 2, 1] }
export const secureframeTable = { frameworks_controls: [11, 9, 0, 2], test_history: [2, 2, 0, 0], policies: [1, 1, 0, 0], people: [4, 3, 0, 1], vendors: [2, 2, 0, 0], risks: [1, 1, 0, 0], access_reviews: [2, 1, 1, 0], audit_requests: [0, 0, 0, 0], trust_answers: [3, 3, 0, 0], exhibits: [2, 1, 1, 0] }
// Vanta and Secureframe move-in through the owner's doors: preview, identity review, approval, reconciliation per
// record class, export, undo, restore, and imported history distinct from a freshly connected source.
export async function migrateRefusals(app) {
 const good = vantaZip()
 assert.equal((await upload(app, 'secureframe', good)).status, 400)
 assert.equal((await upload(app, 'vanta', secureframeZip())).status, 400)
 assert.equal((await upload(app, 'vanta', zip([['vanta/people/page-1.json', '{"results":{"data":[]}}']]))).status, 400)
 assert.equal((await upload(app, 'vanta', zip([['vanta/people/page-1.json', 'not json']]))).status, 400)
 assert.equal((await upload(app, 'vanta', zip([['vanta/people/page-1.json', '{"results":{"data":[],"pageInfo":{"endCursor":null,"startCursor":null,"hasNextPage":false,"hasPreviousPage":false}}}']]))).status, 400)
 assert.equal((await upload(app, 'secureframe', zip([['secureframe/users/page-1.json', '{"records":[]}']]))).status, 400)
 assert.equal((await upload(app, 'vanta', zip([['readme.txt', 'no api pages']]))).status, 400)
 assert.equal((await upload(app, 'vanta', zip([...Object.entries(vantaFiles()), ['secureframe/users/page-1.json', '{"data":[]}']]))).status, 400)
 assert.equal((await app.db.prepare('SELECT COUNT(*) n FROM import_reviews').first()).n, 0)
}
export async function migrateVanta() {
 const { github, outbound } = githubFixture(); github.clock = '2026-10-11T12:00:00Z'
 const app = await runtime({ outbound }); let restored
 try {
  await app.signin(); await migrateRefusals(app)
  const carla = await json(app, '/api/people', { name: 'Carla Mendes', email: 'Carla@northstar.example', kind: 'employee' }, 201)
  const before = await counts(app)
  const staged = await upload(app, 'vanta', vantaZip()); assert.equal(staged.status, 201)
  const { review, summary } = await staged.json(), path = '/api/import/' + review.id
  assert.deepEqual(table(summary.classes), vantaTable); assert.equal(summary.provider, 'Vanta'); assert.equal(summary.exported_at, '2026-10-01T08:00:00Z')
  assert.ok(summary.warnings.some(w => /people ends with hasNextPage=false/.test(w)) === false)
  const exhibits = summary.classes.find(c => c.id === 'exhibits')
  assert.deepEqual(exhibits.issues.map(i => i.verdict + ' ' + i.id).sort(), ['refused d-2/u-2', 'unsupported d-1/u-old', 'unsupported d-3'])
  assert.equal(summary.bytes.admitted, Buffer.byteLength('Q3 access review: 41 accounts reviewed, 2 removed.\n'))
  for (const [id, what] of [['access_reviews', /no access-review resource/], ['trust_answers', /answer library/], ['test_history', /Run-by-run/], ['frameworks_controls', /Per-requirement/], ['policies', /version history/]]) { const c = summary.classes.find(c => c.id === id); assert.ok(c.absent.some(a => what.test(a.what) && a.route && a.manual), id) }
  assert.deepEqual(await counts(app), before); assert.equal((await app.db.prepare('SELECT COUNT(*) n FROM import_additions').first()).n, 0)
  const detail = await get(app, path)
  assert.deepEqual(detail.identity_groups.map(g => [g.key, g.members.length, g.existing?.id ?? null]), [['email:ana@northstar.example', 2, null], ['email:carla@northstar.example', 1, carla.id]])
  // Identity conflicts are the owner's: no mapping and no approval until every group is decided.
  assert.equal((await json(app, path + '/mapping', { mapping: { identity: [] } }, 400)).error.includes('Resolve every'), true)
  assert.equal((await json(app, path + '/mapping', { mapping: { identity: [{ group: 'email:ana@northstar.example', decision: 'link-existing' }, { group: 'email:carla@northstar.example', decision: 'link-existing' }] } }, 400)).error.includes('Choose one of'), true)
  assert.equal((await json(app, path + '/commit', { approve: 'commit', fingerprint: 'x' }, 409)).error.includes('Review'), true)
  const mapped = await json(app, path + '/mapping', { mapping: { identity: [{ group: 'email:ana@northstar.example', decision: 'same' }, { group: 'email:carla@northstar.example', decision: 'link-existing' }] } })
  assert.equal(mapped.counts.mapped, 35); assert.equal(mapped.counts.rejected, 6); assert.equal(mapped.counts.unmapped, 2)
  assert.deepEqual(await counts(app), before)
  const html = await (await app.fetch('/app/import/' + review.id)).text(); assert.match(html, /Reconciliation by record class/); assert.match(html, /Approve this import/)
  assert.match(html, /Not exported:<\/strong> Access-review decisions: the Vanta API has no access-review resource[^]*Manual route:<\/em> Access reviews \(\/app\/access-reviews\)/); assert.match(html, /Fields kept per record type[^]*person keeps[^]*<code>email<\/code>/); assert.match(html, /Refused<\/strong> · person <code>p-bad<\/code>/)
  assert.deepEqual(summary.classes.find(c => c.id === 'people').fields.person.slice(0, 3), ['display_name', 'email', 'employment_status'])
  const job = await finish(app, review.id); assert.equal(job.state, 'completed')
  const trail = (await get(app, '/api/audit?action=import.')).entries.filter(e => e.subject === 'import:' + review.id)
  assert.ok(trail.some(e => e.action === 'import.mapping' && e.outcome === 'succeeded' && e.revision === 'move-in-records-1' && /same, link-existing identity decisions/.test(e.detail)))
  assert.ok(trail.some(e => e.action === 'import.commit' && e.outcome === 'succeeded' && /^Vanta import approved with plan fingerprint/.test(e.detail)))
  // Reconciliation per class after admission, from the retained additions and live links.
  const done = await get(app, path); assert.deepEqual(table(done.reconciliation), vantaTable); assert.ok(done.reconciliation.every(c => c.reconciled && c.active === c.admitted && c.unlinked === 0))
  const people = (await get(app, path + '/records?class=people')).records
  const ana = people.filter(r => r.source_id.startsWith('p-ana')), carlaRecord = people.find(r => r.source_id === 'p-carla')
  assert.equal(ana.length, 2); assert.equal(ana[0].identity.id, ana[1].identity.id); assert.equal(ana[0].identity.decision, 'same')
  assert.equal(carlaRecord.identity.linked_person_id, carla.id); assert.ok(people.every(r => r.origin === 'imported' && r.verified === false && r.incumbent === 'Vanta' && r.exported_at === '2026-10-01T08:00:00Z' && r.source_hash.length === 64))
  assert.equal(people.find(r => r.source_id === 'p-ben').fields.start_date, '2024-02-05T09:00:00.000Z')
  assert.equal((await get(app, path + '/records?class=policies')).records.filter(r => r.type === 'attestation').length, 4)
  const audits = (await get(app, path + '/records?class=audit_requests')).records; assert.deepEqual(audits.find(r => r.type === 'audit').fields.auditStartDate, '2026-01-01T09:00:00.000Z')
  // Original exhibit bytes and digest; refused and unsupported files are not served.
  const exhibit = (await get(app, path + '/records?class=exhibits')).records.find(r => r.type === 'upload')
  const bytes = Buffer.from(await (await app.fetch(path + '/exhibit/' + exhibit.id)).arrayBuffer()); assert.equal(await digest(bytes), exhibit.file.sha256); assert.equal(bytes.toString(), 'Q3 access review: 41 accounts reviewed, 2 removed.\n')
  assert.equal((await app.fetch(path + '/exhibit/00000000-0000-0000-0000-000000000000')).status, 404)
  // Imported history is never a native record, a run or an observation.
  assert.deepEqual(await counts(app), before)
  const desk = await get(app, '/api/desk?date=2026-10-11'); assert.ok(desk.requirements.every(r => !['covered', 'due soon'].includes(r.gap)))
  // Export carries the reconciliation and every record; each export is audited.
  const exported = await get(app, path + '/export'); assert.equal(exported.format, 'evidence-import-export'); assert.equal(exported.records.length, 35); assert.deepEqual(table(exported.reconciliation), vantaTable); assert.equal(exported.review.incumbent, 'Vanta')
  const csv = await app.fetch('/app/import/' + review.id + '/export.csv'); assert.equal(csv.status, 200); assert.equal((await csv.text()).trim().split('\r\n').length, 36)
  assert.deepEqual((await get(app, '/api/audit?action=import.exported')).entries.map(e => e.detail).sort(), ['csv', 'json'])
  // Reconnect an actual source: fresh observations stay source-observed and separate from the imported Vanta history.
  const connection = await json(app, '/api/connections', { account: 'northstar', token: 'synthetic-evidence-1', label: 'GitHub production' }, 201)
  await json(app, `/api/connections/${connection.id}/repositories`, { repositories: ['northstar/web', 'northstar/site'] })
  await app.tick()
  const fresh = (await get(app, '/api/tests')).tests.find(t => t.catalogue_id === 'github.branch-protection'), detailTest = await get(app, '/api/tests/' + fresh.id)
  assert.ok(detailTest.latest.length === 2 && detailTest.latest.every(o => o.source_kind === 'source-observed'))
  const history = (await get(app, '/api/import/records?class=test_history')).records
  assert.equal(history.length, 5); assert.ok(history.every(r => r.origin === 'imported' && r.incumbent === 'Vanta' && r.active))
  assert.ok(history.find(r => r.type === 'entity' && r.fields.displayName === 'northstar/site').fields.entityStatus === 'FAILING')
  assert.ok((await app.db.prepare('SELECT COUNT(*) n FROM observations WHERE source_kind<>?').bind('source-observed').first()).n === 0)
  // The whole record set and its reconciliation survive archive restore, inert.
  restored = await restore(app, await archive(app))
  assert.deepEqual((await restored.db.prepare('SELECT kind,id,review_id,value_json FROM import_additions ORDER BY kind,id').all()).results, (await app.db.prepare('SELECT kind,id,review_id,value_json FROM import_additions ORDER BY kind,id').all()).results)
  assert.deepEqual((await get(restored, '/api/import/records')).records, (await get(app, '/api/import/records')).records)
  assert.equal((await restored.fetch(path + '/resume', { method: 'POST', headers: { origin: restored.origin, 'content-type': 'application/json' }, body: '{}' })).status, 403)
  assert.equal((await restored.db.prepare('SELECT COUNT(*) n FROM connections WHERE secret_ciphertext IS NOT NULL AND status=?').bind('active').first()).n, 0)
  // Undo unlinks the live records only; additions, the source ZIP and fresh observations remain.
  const undone = await undo(app, review.id); assert.equal(undone.state, 'undone')
  assert.equal((await get(app, '/api/import/records')).records.length, 0)
  const after = await get(app, path); assert.ok(after.reconciliation.every(c => c.active === 0 && c.unlinked === c.admitted && c.reconciled))
  assert.equal((await get(app, path + '/export')).records.length, 35)
  assert.equal((await app.fetch(path + '/source')).status, 200)
  assert.equal((await app.db.prepare('SELECT COUNT(*) n FROM observations').first()).n > 0, true)
 } finally { await app.close(); await restored?.close() }
}
export async function migrateSecureframe() {
 const app = await runtime()
 try {
  await app.signin()
  const staged = await upload(app, 'secureframe', secureframeZip()); assert.equal(staged.status, 201)
  const { review, summary } = await staged.json(), path = '/api/import/' + review.id
  assert.deepEqual(table(summary.classes), secureframeTable); assert.equal(summary.exported_at, '2026-10-02T08:00:00Z')
  const ex = summary.classes.find(c => c.id === 'exhibits'); assert.match(ex.issues[0].reason, /metadata only/); assert.equal(ex.absent.length, 0)
  assert.ok(summary.classes.find(c => c.id === 'audit_requests').absent.some(a => /no audit/.test(a.what) && a.manual))
  assert.deepEqual(summary.classes.find(c => c.id === 'frameworks_controls').issues.map(i => i.reason).sort(), ['Mapping refers to control ctl-gone, which is not in this export.', 'Mapping refers to requirement CC9.9, which is not in this export.'])
  const detail = await get(app, path); assert.deepEqual(detail.identity_groups.map(g => [g.key, g.members.length]), [['email:ana@northstar.example', 2]])
  await json(app, path + '/mapping', { mapping: { identity: [{ group: 'email:ana@northstar.example', decision: 'separate' }] } })
  const before = await counts(app), job = await finish(app, review.id); assert.equal(job.state, 'completed'); assert.deepEqual(await counts(app), before)
  assert.deepEqual(table((await get(app, path)).reconciliation), secureframeTable)
  const people = (await get(app, path + '/records?class=people')).records, ana = people.filter(r => /^0{8}-0{4}-4000-8000-0{10}4[12]$/.test(r.source_id))
  assert.equal(ana.length, 2); assert.notEqual(ana[0].identity.id, ana[1].identity.id)
  const tests = (await get(app, path + '/records?class=test_history')).records; assert.equal(tests.find(r => r.fields.key === 'github-branch-protection').fields.first_failed_at, '2026-09-02T09:00:00.000Z')
  const reviews = (await get(app, path + '/records?class=access_reviews')).records; assert.deepEqual(reviews.map(r => r.fields.taskable_type), ['UserAccessReviewAccount'])
  const exhibit = (await get(app, path + '/records?class=exhibits')).records[0]; assert.equal(Buffer.from(await (await app.fetch(path + '/exhibit/' + exhibit.id)).arrayBuffer()).toString(), 'Access review 2026-09-15: 20 accounts reviewed.\n')
  assert.equal((await undo(app, review.id)).state, 'undone')
  assert.ok((await get(app, path)).reconciliation.every(c => c.active === 0 && c.reconciled))
  // A truncated export is flagged, not silently completed.
  const cut = await upload(app, 'secureframe', secureframeZip(f => { delete f['secureframe/files/' + Object.keys(f).find(k => k.includes('/files/')).split('/').pop()]; return f })); assert.equal(cut.status, 201)
  assert.equal((await cut.json()).summary.classes.find(c => c.id === 'exhibits').unsupported, 2)
 } finally { await app.close() }
}
