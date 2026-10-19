// Risk register, shipped library, spreadsheet import and versioned scoring
// through the owner's doors and the Cron Trigger. Only the mail edge is faked.
process.env.RER_SERVER_JOURNEY = '1'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {createRequire} from 'node:module'
const require = createRequire(import.meta.url), dependency = createRequire(require.resolve('wrangler/package.json'))
const {unstable_splitSqlQuery} = dependency('wrangler')
import { runtime } from './helpers/runtime.mjs'
import { xlsx } from './helpers/xlsx.mjs'
const app = await runtime()
let passed = 0
const scenario = async (name, fn) => { await fn(); passed++; console.log('PASS ' + name) }
const owner = async (path, body, status = 201) => { const r = await app.fetch(path, { method: 'POST', headers: { origin: app.origin, 'content-type': 'application/json' }, body: JSON.stringify(body) }); const text = await r.text(); assert.equal(r.status, status, path + ' ' + text); return text ? JSON.parse(text) : null }
const get = async path => { const r = await app.fetch(path); assert.equal(r.status, 200, path); return r.json() }
const importFile = async (name, bytes, fields = {}, status = 200) => { const form = new FormData(); form.set('file', new File([bytes], name)); for (const [k, v] of Object.entries(fields)) form.set(k, v); const r = await app.fetch('/api/risks/import', { method: 'POST', headers: { origin: app.origin }, body: form }); const text = await r.text(); assert.equal(r.status, status, text); return JSON.parse(text) }
const v1 = (token, method, path, body) => app.fetch(path, { method, headers: { cookie: '', authorization: 'Bearer ' + token, 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
let person, push
try {
 await scenario('RISK-002: Five library scenarios become risks linked to suggested controls and matching in-scope assets', async () => {
  await app.signin()
  person = await owner('/api/people', { name: 'Lee Morgan', email: 'lee@northstar.test', kind: 'employee' })
  await owner('/api/programs', { framework: 'iso27001', name: 'ISO 27001', legal_entity: 'Northstar', audit_from: '2026-09-01', audit_to: '2027-08-31' })
  push = await owner('/api/api-tokens', { name: 'Service inventory', scopes: ['resource-push', 'risk-push', 'test-write'], expires_at: '2027-04-01' })
  assert.equal((await v1(push.token, 'PUT', '/v1/resource-types/internal_service', { schema: { fields: { mfa_enforced: 'boolean' } } })).status, 200)
  assert.equal((await v1(push.token, 'PUT', '/v1/resources/internal_service', { resources: [{ uniqueId: 'billing', attributes: { mfa_enforced: false } }, { uniqueId: 'search', attributes: { mfa_enforced: true } }, ...Array.from({length: 30}, (_, i) => ({uniqueId: 'service-' + i, attributes: {mfa_enforced: true}}))] })).status, 200)
  const page = await (await app.fetch('/app/risks')).text()
  assert.ok((page.match(/<option value="R-/g) ?? []).length >= 100)
  const library = await get('/api/risks/library')
  assert.ok(library.scenarios.every(r => r.threat && r.vulnerability && r.assets.length && r.controls.length && r.treatment))
  assert.deepEqual(new Set(library.scenarios.map(r => r.area)), new Set(['Access','Change','Vendor and supply chain','Data loss and privacy','Availability and continuity','People','Physical','Application security','AI']))
  const controls = new Map()
  const iso = (await get('/api/programs')).programs.find(p => p.framework === 'iso27001')
  for (const r of (await get('/api/programs/' + iso.id)).readiness.requirements) for (const c of r.controls) if (c.library_id) controls.set(c.library_id, c.id)
  const added = []
  for (const id of ['R-ACC-01', 'R-CHG-01', 'R-DAT-01', 'R-APP-03', 'R-AIG-01']) added.push(await owner('/api/risks/library', { scenario: id }))
  for (const risk of added) {
   const detail = await get('/api/risks/' + risk.id)
   assert.equal(detail.risk.origin, 'library'); assert.equal(detail.risk.library_revision, library.revision); assert.equal(detail.assessments.length, 1)
   const source = library.scenarios.find(s => s.id === detail.risk.library_id)
   assert.deepEqual(new Set(detail.links.filter(l => l.kind === 'control').map(l => l.target)), new Set(source.controls.map(id => controls.get(id) ?? 'library:' + id)))
   assert.equal(detail.links.filter(l => l.kind === 'asset').length, (source.assets.includes('application') ? 32 : 0) + (source.assets.includes('person') ? 1 : 0))
  }
  const hipaa = await owner('/api/programs', {framework: 'hipaa', name: 'HIPAA', legal_entity: 'Northstar', audit_from: '2026-09-01', audit_to: '2027-08-31'})
  assert.equal((await get('/api/programs/' + hipaa.id)).program.framework, 'hipaa')
  const ephi = library.scenarios.find(s => /ePHI/.test(s.title))
  const healthRisk = await owner('/api/risks/library', {scenario: ephi.id, revision: library.revision})
  assert.match((await get('/api/risks/' + healthRisk.id)).risk.scenario, /HIPAA/)
  const accountTakeover = await get('/api/risks/' + added[0].id)
  assert.ok(accountTakeover.links.filter(l => l.kind === 'asset').length === 32, 'application assets matched to internal services')
  assert.ok(accountTakeover.links.some(l => l.kind === 'control' && !l.target.startsWith('library:')), 'adopted AC-05 is linked by control id')
 })
 await scenario('RISK-002: A 30-row register CSV dry-runs, refuses one invalid row and admits 29 labelled imported only on confirmation', async () => {
  const rows = ['Risk,Description,L,I,Treatment,Owner,Review', ...Array.from({ length: 30 }, (_, i) => `"Imported risk ${i + 1}","Scenario, with a comma ${i + 1}",${i === 17 ? 9 : 1 + (i % 5)},${1 + ((i + 2) % 5)},mitigate,${i % 2 ? 'lee@northstar.test' : 'nobody@elsewhere.test'},2027-01-31`)].join('\r\n')
  const mapping = { map_title: 'Risk', map_scenario: 'Description', map_likelihood: 'L', map_impact: 'I', map_treatment: 'Treatment', map_owner_email: 'Owner', map_review_due: 'Review' }
  const before = (await get('/api/risks')).risks.length
  const plan = await importFile('register.csv', rows, mapping)
  assert.equal(plan.total, 30); assert.equal(plan.admit, 29); assert.equal(plan.refuse, 1)
  assert.equal(plan.rows.find(r => r.outcome === 'refuse').row, 19); assert.match(plan.rows.find(r => r.outcome === 'refuse').reasons[0], /1 to 5/)
  assert.equal(plan.rows.filter(r => r.owner === 'matched').length, 15)
  assert.equal((await get('/api/risks')).risks.length, before)
  await importFile('register.csv', rows, { ...mapping, confirm: 'yes', sha256: '0'.repeat(64) }, 409)
  const confirmed = await importFile('register.csv', rows, { ...mapping, confirm: 'yes', sha256: plan.sha256 }, 201)
  assert.equal(confirmed.admit, 29)
  const risks = (await get('/api/risks')).risks.filter(r => r.origin === 'import')
  assert.equal(risks.length, 29); assert.ok(risks.every(r => /^Imported from register\.csv on 2026-10-11$/.test(r.source_label)))
  const preview = await app.fetch('/app/risks/import', { method: 'POST', headers: { origin: app.origin }, body: (() => { const f = new FormData(); f.set('file', new File([rows.replaceAll('Imported risk', 'Preview risk')], 'register.csv')); for (const [k, v] of Object.entries(mapping)) f.set(k, v); return f })() })
  assert.equal(preview.status, 200); assert.match(await preview.text(), /29 would be admitted, 1 refused/)
  for (const [path, text] of [['/app/risks', 'Imported risk 1'], ['/app/risks/' + risks[0].id, 'Assessments']]) { const page = await app.fetch(path); assert.equal(page.status, 200, path); assert.ok((await page.text()).includes(text), path) }
  const again = await importFile('register.csv', rows, mapping); assert.equal(again.admit, 0); assert.match(again.rows[0].reasons.join(), /Duplicate/)
  const invalidControl = await importFile('control-mapping.csv', 'title,likelihood,impact,controls\nUnknown mapping,2,3,NOT-A-CONTROL')
  assert.equal(invalidControl.admit, 0); assert.equal(invalidControl.refuse, 1)
  assert.match(invalidControl.rows[0].reasons.join(), /Unknown control/)
  const sheet = xlsx([['Title', 'Likelihood', 'Impact'], ['Spreadsheet risk one', 2, 3], ['Spreadsheet risk two', 4, 4]])
  const fromXlsx = await importFile('risks.xlsx', sheet, { map_title: 'Title', map_likelihood: 'Likelihood', map_impact: 'Impact' })
  assert.equal(fromXlsx.admit, 2)
  assert.equal((await importFile('risks.xlsx', sheet, { map_title: 'Title', map_likelihood: 'Likelihood', map_impact: 'Impact', confirm: 'yes', sha256: fromXlsx.sha256 }, 201)).admit, 2)
  const bad = await app.fetch('/api/risks/import', { method: 'POST', headers: { origin: app.origin }, body: (() => { const f = new FormData(); f.set('file', new File(['Risk\n"unterminated'], 'bad.csv')); return f })() })
  assert.equal(bad.status, 400)
 })
 await scenario('RISK-002: Changing the scoring scale never rescores history and a reassessment sits beside the original', async () => {
  const risk = (await get('/api/risks')).risks.find(r => r.title === 'Imported risk 2')
  const original = (await get('/api/risks/' + risk.id)).assessments[0]
  assert.equal(original.method_revision, 1); assert.equal(original.likelihood_label, 'Unlikely')
  assert.equal((await owner('/api/risks/method', { scale: '4', formula: 'product', likelihood_labels: 'Low, Medium, High, Very high', impact_labels: 'Minor, Moderate, Serious, Critical', likelihood_definitions: ['Unusual', 'Occasional', 'Frequent', 'Imminent'], impact_definitions: ['Brief disruption', 'Team disruption', 'Service loss', 'Business interruption'], thresholds: 'Low:3, Medium:8, High:16' })).revision, 2)
  await owner(`/api/risks/${risk.id}/assessments`, { kind: 'inherent', likelihood: '5', impact: '1' }, 400)
  await owner(`/api/risks/${risk.id}/assessments`, { kind: 'inherent', likelihood: '4', impact: '2', notes: 'Reassessed on the 4x4 scale' })
  const detail = await get('/api/risks/' + risk.id)
  assert.deepEqual(new Map(detail.assessments.map(a => [a.method_revision, a.likelihood_label])), new Map([[1, 'Unlikely'], [2, 'Very high']]))
  const historical = detail.assessments.find(a => a.id === original.id)
  assert.deepEqual(historical, original)
  assert.equal(detail.methods.find(m => m.revision === original.method_revision).scale, 5)
  assert.equal(detail.methods.find(m => m.revision === 2).scale, 4)
  assert.equal(detail.methods.find(m => m.revision === 2).likelihood_definitions[3], 'Imminent')
  const page = await (await app.fetch('/app/risks/' + risk.id)).text()
  assert.match(page, /5×5/); assert.match(page, /4×4/); assert.match(page, /Imminent/)
  const csv = await (await app.fetch('/api/risks/export')).text()
  assert.ok(csv.split('\r\n')[0].includes('method_revision'))
  const lines = csv.split('\r\n').filter(l => l.startsWith(risk.id))
  assert.equal(lines.length, 2); assert.ok(lines.some(l => /,1,2,Unlikely,/.test(l))); assert.ok(lines.some(l => /,2,4,Very high,/.test(l)))
 })
 await scenario('RISK-001 / RISK-002: A risk from a failing control expires its acceptance into an escalation and a passing re-test verifies its treatment', async () => {
  const test = await (await v1(push.token, 'POST', '/v1/tests', { name: 'Services enforce MFA', resourceType: 'internal_service', criteria: [{ attribute: 'mfa_enforced', op: 'equals', value: true }], category: 'identity', severity: 'high', controls: ['AC-05'] })).json()
  const risk = await owner('/api/risks', { title: 'Billing service admins without MFA', scenario: 'Failing MFA test on billing', likelihood: '4', impact: '4', treatment: 'mitigate', owner_person_id: person.id, controls: 'AC-05', test_id: test.id })
  const vendor = await owner('/api/vendors', { name: 'Okta', criticality: 'high', data_access: 'Workforce identities', owner_person_id: person.id })
  await owner(`/api/risks/${risk.id}/links`, { kind: 'vendor', target: vendor.id })
  await owner(`/api/risks/${risk.id}/links`, { kind: 'incident', target: 'INC-2026-014 MFA bypass report' })
  await owner(`/api/risks/${risk.id}/treatments`, { title: 'Enforce MFA on billing', owner_person_id: person.id, due_date: '2026-10-31', verification_test_id: test.id })
  await owner(`/api/risks/${risk.id}/acceptances`, { rationale: 'x', expires_at: '2026-10-20' }, 409)
  await owner(`/api/risks/${risk.id}/assessments`, { kind: 'residual', likelihood: '2', impact: '3', notes: 'Compensating alerting in place' })
  await owner(`/api/risks/${risk.id}/acceptances`, { rationale: 'Accept until MFA rollout completes', expires_at: '2026-10-20' })
  let detail = await get('/api/risks/' + risk.id)
  assert.deepEqual(detail.links.map(l => l.kind).sort(), ['control', 'incident', 'test', 'vendor'])
  const treatment = detail.treatments[0]
  await owner(`/api/risks/${risk.id}/treatments/${treatment.id}/done`, { evidence: 'Change PLAT-77 merged' }, 200)
  const assessments = detail.assessments.length
  await app.clock('2026-10-20T00:10:00Z'); await app.tick()
  detail = await get('/api/risks/' + risk.id)
  assert.ok(detail.acceptances[0].escalated_at); assert.equal(detail.treatments[0].status, 'done')
  assert.equal(app.messages.filter(m => /Risk acceptance expired: Billing service admins without MFA/.test(m.subject) && m.to.includes('lee@northstar.test')).length, 1)
  await app.tick(); assert.equal(app.messages.filter(m => /Risk acceptance expired/.test(m.subject)).length, 1)
  await v1(push.token, 'PUT', '/v1/resources/internal_service', { resources: [{ uniqueId: 'billing', attributes: { mfa_enforced: true } }, { uniqueId: 'search', attributes: { mfa_enforced: true } }] })
  await app.tick()
  detail = await get('/api/risks/' + risk.id)
  assert.equal(detail.treatments[0].status, 'verified'); assert.match(detail.treatments[0].evidence, /Verified by passing test "Services enforce MFA"/)
  assert.equal(detail.assessments.length, assessments)
  assert.equal((await (await v1(push.token, 'POST', '/v1/risks', { title: 'Pushed risk from GRC sheet', scenario: 'Imported via script', likelihood: 3, impact: 2 })).json()).origin, 'api')
  assert.match((await get('/api/risks')).risks.find(r => r.title === 'Pushed risk from GRC sheet').source_label, /API token Service inventory/)
 })
 await scenario('RISK-002: Reviewed library provenance, editable risk links, matrix definitions and archive restore preserve earlier assessments', async () => {
  const risk = (await get('/api/risks')).risks.find(r => r.origin === 'library')
  const before = await get('/api/risks/' + risk.id)
  const control = before.links.find(l => l.kind === 'control')
  await owner(`/api/risks/${risk.id}/links/remove`, control, 200)
  await owner(`/api/risks/${risk.id}`, {title: 'Reviewed workforce risk', scenario: 'Owner-adjusted vulnerability and threat', treatment: 'avoid', owner_person_id: person.id, review_due: '2027-01-31'}, 200)
  let detail = await get('/api/risks/' + risk.id)
  assert.equal(detail.risk.title, 'Reviewed workforce risk'); assert.equal(detail.risk.treatment, 'avoid'); assert.equal(detail.risk.owner_person_id, person.id)
  assert.ok(!detail.links.some(l => l.kind === control.kind && l.target === control.target))
  assert.deepEqual(detail.assessments, before.assessments)
  await owner(`/api/risks/${risk.id}/links`, control, 201)
  const asset = detail.links.find(l => l.kind === 'asset')
  if (asset) {
   await owner(`/api/risks/${risk.id}/links/remove`, asset, 200)
   detail = await get('/api/risks/' + risk.id)
   assert.ok(!JSON.parse(detail.risk.assets).includes(asset.target))
   await owner(`/api/risks/${risk.id}/links`, asset)
   assert.ok(JSON.parse((await get('/api/risks/' + risk.id)).risk.assets).includes(asset.target))
  }
  const workforce = await owner('/api/risks/library', {scenario:'R-PPL-01'})
  assert.ok((await get('/api/risks/'+workforce.id)).links.some(l => l.kind === 'asset' && l.target === person.id))
  const supplier = (await get('/api/vendors')).vendors.find(v => v.name === 'Okta')
  const supplyRisk = await owner('/api/risks/library', {scenario:'R-VEN-01'})
  assert.ok((await get('/api/risks/'+supplyRisk.id)).links.some(l => l.kind === 'asset' && l.target === supplier.id))
  const library = await get('/api/risks/library')
  assert.ok(library.adopted.some(r => r.id === risk.id && r.library_revision === before.risk.library_revision))
  await owner('/api/risks/library', {scenario: before.risk.library_id, revision: library.revision + 1}, 409)
  assert.match(await (await app.fetch('/app/risks/library')).text(), /Prior additions/)
  const matrix = [['Routine','Routine','Review'], ['Routine','Review','Urgent'], ['Review','Urgent','Urgent']]
  await owner('/api/risks/method', {scale: 3, formula: 'matrix', likelihood_labels: ['Rare','Possible','Likely'], impact_labels: ['Small','Material','Severe'], likelihood_definitions: ['Exceptional event','Can happen','Expected event'], impact_definitions: ['Local impact','Service impact','Company impact'], matrix: JSON.stringify(matrix)})
  await owner(`/api/risks/${risk.id}/assessments`, {kind:'inherent', likelihood:3, impact:2})
  detail = await get('/api/risks/' + risk.id)
  assert.ok(detail.assessments.some(a => a.method_revision === 3 && a.level === 'Urgent' && a.score === 6))
  assert.ok(detail.assessments.some(a => a.id === before.assessments[0].id && a.score === before.assessments[0].score))
  const archive = await app.fetch('/api/archive/export'); assert.equal(archive.status, 200)
  const bytes = await archive.arrayBuffer(), restored = await runtime()
  try {
   await restored.signin()
   const result = await restored.fetch('/api/archive/restore', {method:'POST', headers:{origin:restored.origin,'content-type':'application/octet-stream','x-evidence-confirm':'restore'}, body:bytes})
   assert.equal(result.status, 200, await result.text())
   const copy = await (await restored.fetch('/api/risks/' + risk.id)).json()
   assert.deepEqual(copy.risk, detail.risk); assert.deepEqual(copy.assessments, detail.assessments); assert.deepEqual(copy.methods, detail.methods)
  } finally {await restored.close()}
 })
 await scenario('RISK-002: a populated prior-schema default assessment survives upgrade with unknown definitions labelled honestly', async () => {
  const prior = await runtime({migrationThrough:'0034'}), id = crypto.randomUUID()
  try {
   await prior.signin()
   // A predecessor-schema fixture, not application writes with a mocked store.
   await prior.db.prepare("INSERT INTO risks(id,title,scenario,origin,source_label,treatment,created_at,updated_at) VALUES(?,'Legacy workforce access','Old assessment','form','Entered by owner','mitigate','2026-10-01','2026-10-01')").bind(id).run()
   await prior.db.prepare("INSERT INTO risk_assessments(id,risk_id,kind,method_revision,likelihood,impact,score,level,likelihood_label,impact_label,actor_name,at) VALUES(?,?,'inherent',1,2,3,6,'Medium','Unlikely','Moderate','Original owner','2026-10-01')").bind(crypto.randomUUID(),id).run()
   const sql = await readFile('migrations/core/0035_risk_details.sql','utf8')
   await prior.db.batch(unstable_splitSqlQuery(sql).map(s=>prior.db.prepare(s)))
   const response = await prior.fetch('/api/risks/'+id); assert.equal(response.status,200)
   const detail = await response.json()
   assert.equal(detail.assessments[0].score,6); assert.equal(detail.assessments[0].actor_name,'Original owner')
   assert.deepEqual(detail.methods[0].likelihood_definitions,[])
   assert.match(await (await prior.fetch('/app/risks/'+id)).text(), /legacy, not recorded/)
   const exported = Buffer.from(await (await prior.fetch('/api/archive/export')).arrayBuffer())
   const magic = Buffer.from('EVIDENCE-ARCHIVE\n'), length = exported.readUInt32BE(magic.length)
   const envelope = JSON.parse(exported.subarray(magic.length+4,magic.length+4+length))
   const manifest = JSON.parse(envelope.manifest)
   manifest.version = 4; delete manifest.extensions.program.files; manifest.extensions.program.rows.risk_methods = []
   for (const row of manifest.extensions.program.rows.risks) delete row.library_revision
   const text = JSON.stringify(manifest), legacyEnvelope = Buffer.from(JSON.stringify({manifest:text,sha256:createHash('sha256').update(text).digest('hex')}))
   const size = Buffer.alloc(4); size.writeUInt32BE(legacyEnvelope.length)
   const legacy = Buffer.concat([magic,size,legacyEnvelope,exported.subarray(magic.length+4+length)])
   const target = await runtime()
   try {
    await target.signin()
    const restored = await target.fetch('/api/archive/restore',{method:'POST',headers:{origin:target.origin,'content-type':'application/octet-stream','x-evidence-confirm':'restore'},body:legacy})
    assert.equal(restored.status,200,await restored.text())
    const copy = await (await target.fetch('/api/risks/'+id)).json()
    assert.equal(copy.assessments[0].score,6);assert.deepEqual(copy.methods[0].likelihood_definitions,[])
    assert.match(await (await target.fetch('/app/risks/'+id)).text(), /legacy, not recorded/)
   } finally {await target.close()}

  } finally {await prior.close()}
 })
 console.log(`${passed} risk register public-door scenarios passed with real workerd, D1 and R2.`)
} finally { await app.close() }
