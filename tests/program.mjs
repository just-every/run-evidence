// Programs, the shipped library, mappings and ownership, and annual/anchored
// renewal through the owner's public doors on real workerd, D1 and R2. Only the
// paid mail edge is faked; reminders are read from what was sent there.
process.env.RER_SERVER_JOURNEY = '1'
import assert from 'node:assert/strict'
import { runtime } from './helpers/runtime.mjs'
const app = await runtime()
let passed = 0
const scenario = async (name, fn) => { await fn(); passed++; console.log('PASS ' + name) }
const post = async (path, body, status = 201) => { const r = await app.fetch(path, { method: 'POST', headers: { origin: app.origin, 'content-type': 'application/json' }, body: JSON.stringify(body) }); const text = await r.text(); assert.equal(r.status, status, path + ' ' + text); return text ? JSON.parse(text) : null }
const get = async path => { const r = await app.fetch(path); assert.equal(r.status, 200, path); return r.json() }
const upload = async (requirement, fields, bytes = 'report bytes') => {
 const form = new FormData(); for (const [k, v] of Object.entries({ source: 'Independent tester', ...fields })) form.set(k, v)
 form.set('file', new File([bytes], 'report.pdf', { type: 'application/pdf' }))
 const r = await app.fetch('/app/requirements/' + requirement + '/uploads', { method: 'POST', headers: { origin: app.origin }, body: form }); assert.equal(r.status, 303, await r.text())
}
const desk = async date => (await get('/api/desk' + (date ? '?date=' + date : ''))).requirements
const libraryRequirement = async id => (await desk()).find(r => r.library_id === id)
const program = (framework, extra = {}) => post('/api/programs', { framework, name: framework + ' program', legal_entity: 'Northstar Studio, Inc.', report_type: 'Type II', products: ['Web app', 'API'], teams: ['Engineering'], regions: ['us-east-1'], systems: ['AWS production', 'GitHub'], audit_from: '2026-07-01', audit_to: '2027-06-30', assessor: 'Harbour Assurance LLP', milestones: ['2027-07-15 Fieldwork starts'], ...extra })
const sent = to => app.messages.filter(m => m.to?.includes(to) && !/sign in|confirm/i.test(m.subject))
let soc2, iso, hipaa, pci, owner, contributor
try {
 await scenario('Owner program doors refuse anonymous and cross-origin requests', async () => {
  for (const path of ['/app/programs', '/api/programs', '/api/people']) assert.equal((await app.fetch(path)).status, 401)
  await app.signin()
  assert.equal((await app.fetch('/api/programs', { method: 'POST', headers: { origin: 'https://evil.test', 'content-type': 'application/json' }, body: '{}' })).status, 403)
  owner = await post('/api/people', { name: 'Priya Shah', email: 'priya@northstar.test', kind: 'employee' })
  contributor = await post('/api/people', { name: 'Sam Ortiz', email: 'sam@northstar.test', kind: 'contractor' })
  assert.equal((await app.fetch('/api/people', { method: 'POST', headers: { origin: app.origin, 'content-type': 'application/json' }, body: JSON.stringify({ name: 'Dup', email: 'PRIYA@northstar.test', kind: 'employee' }) })).status, 409)
 })
 await scenario('LIBRARY-001: Each core program starts pre-mapped to the library with no unmapped requirement, a test or named proof on every mapped control, and no certification claim', async () => {
  soc2 = (await program('soc2', { categories: ['Availability'], lead_person_id: owner.id })).id
  iso = (await program('iso27001')).id; hipaa = (await program('hipaa')).id; pci = (await program('pci', { audit_from: '2026-01-01', audit_to: '2026-12-31' })).id
  for (const [id, total] of [[soc2, 61], [iso, 118], [hipaa, 67], [pci, 71]]) {
   const { program: row, readiness } = await get('/api/programs/' + id)
   assert.equal(readiness.totals.requirements, total); assert.equal(readiness.totals.unmapped, 0)
   assert.ok(readiness.requirements.filter(r => r.state === 'included').every(r => r.controls.length > 0))
   assert.ok(readiness.requirements.flatMap(r => r.controls).every(c => c.evidence.length > 0 || c.tests?.tests > 0))
   assert.deepEqual(JSON.parse(row.products), ['Web app', 'API'])
  }
  const soc = (await get('/api/programs/' + soc2)).readiness
  assert.equal(soc.totals.excluded, 25); assert.ok(soc.requirements.find(r => r.ref === 'A1.2').state === 'included'); assert.match(soc.requirements.find(r => r.ref === 'P1.1').rationale, /not in this report's scope/)
  const exported = await (await app.fetch('/api/programs/' + pci + '/export')).json()
  assert.match(exported.certification, /^None asserted/); assert.equal(exported.program.audit_from, '2026-01-01'); assert.ok(exported.unresolved.length > 0)
  assert.ok((await desk()).filter(r => r.library_id).length >= 100)
 })
 await scenario('Applicability decisions, the assessor review and an edition upgrade stay reviewable history', async () => {
  const old = (await program('iso27001', { edition: '2013', name: 'ISO 2013 transition' })).id
  await post(`/api/programs/${old}/applicability`, { ref: 'A.8.2.2', state: 'excluded', rationale: 'No labelled information assets in scope' }, 200)
  await post(`/api/programs/${old}/applicability`, { ref: 'A.11.1.6', state: 'excluded', rationale: 'No delivery areas; fully remote' }, 200)
  const review = await post(`/api/programs/${old}/reviews`, { reviewer: 'Harbour Assurance LLP', notes: 'Exclusions agreed in scoping call' }, 200)
  assert.match(review.snapshot_hash, /^[a-f0-9]{64}$/)
  const change = await post(`/api/programs/${old}/editions`, { edition: '2022' })
  assert.deepEqual(change.diff.added.map(a => a.ref).sort(), ['6.3', 'A.5.23', 'A.5.30', 'A.5.7', 'A.7.4', 'A.8.10', 'A.8.11', 'A.8.12', 'A.8.16', 'A.8.23', 'A.8.28', 'A.8.9'].sort())
  await post(`/api/programs/${old}/editions`, { edition: '2022' }, 409)
  await post(`/api/programs/${old}/editions/${change.id}`, { decision: 'accepted', reason: 'Transition to 2022 before surveillance audit' }, 200)
  await post(`/api/programs/${old}/editions/${change.id}`, { decision: 'rejected', reason: 'again' }, 409)
  await post(`/api/programs/${old}`, { name: 'ISO 27001:2022', legal_entity: 'Northstar Studio, Inc.', audit_from: '2026-09-01', audit_to: '2027-08-31', products: 'Web app', reason: 'New certification cycle' }, 200)
  const exported = await (await app.fetch(`/api/programs/${old}/export`)).json()
  assert.equal(exported.program.edition, '2022'); assert.deepEqual(exported.history.editions.map(e => e.edition), ['2013', '2022'])
  assert.equal(exported.history.changes[0].decision, 'accepted'); assert.equal(exported.history.revisions.length, 3); assert.equal(exported.history.reviews.length, 1)
  const labelling = exported.requirements.find(r => r.ref === 'A.5.13'), delivery = exported.requirements.find(r => r.ref === 'A.7.2')
  assert.equal(labelling.state, 'excluded'); assert.match(labelling.rationale, /Carried at edition change from excluded A.8.2.2/)
  assert.equal(delivery.state, 'included')
  assert.ok(exported.applicability_history.some(d => d.ref === 'A.11.1.6'))
  assert.ok(exported.requirements.find(r => r.ref === 'A.5.7').controls.length)
 })
 await scenario('One access-review control serves SOC 2, ISO and HIPAA with an owner, a contributor, shared proof and scope history', async () => {
  const requirement = await libraryRequirement('AC-04'), control = requirement.control_id
  await post(`/api/controls/${control}/owners`, { owner_person_id: owner.id, contributors: [contributor.id], due_date: '2026-12-31', reason: 'Quarterly review owner' }, 200)
  await upload(requirement.id, { covered_from: '2026-10-01', covered_to: '2026-12-31' })
  const detail = await get('/api/controls/' + control)
  const frameworks = new Set(detail.mappings.library.map(m => m.framework))
  for (const f of ['SOC 2', 'ISO/IEC 27001', 'HIPAA', 'PCI DSS']) assert.ok(frameworks.has(f), f)
  assert.equal(detail.owners.at(-1).owner_email, 'priya@northstar.test'); assert.deepEqual(detail.owners.at(-1).contributor_names, ['Sam Ortiz'])
  assert.equal(detail.requirements[0].gap, 'covered')
  for (const id of [soc2, iso, hipaa]) assert.ok((await get('/api/programs/' + id)).readiness.requirements.filter(r => r.controls.some(c => c.id === control)).every(r => r.controls.find(c => c.id === control).proof === 'current'))
  const mapping = await post(`/api/controls/${control}/mappings`, { framework: 'pci', edition: 'v4.0.1', ref: '8.2', reason: 'Account lifecycle reviewed in the same campaign' })
  await post(`/api/controls/${control}/mappings/${mapping.id}/remove`, { reason: 'Covered by AC-02 instead' }, 200)
  for (const asset of ['prod-db', 'admin-console']) await post(`/api/controls/${control}/scope`, { asset, action: 'added', reason: 'In audit scope' }, 200)
  await app.clock('2026-11-15T09:00:00Z')
  await post(`/api/controls/${control}/scope`, { asset: 'admin-console', action: 'removed', reason: 'Console decommissioned' }, 200)
  const report = await get(`/api/controls/${control}/report?from=2026-10-12&to=2026-12-31`)
  assert.deepEqual(report.segments.map(s => s.assets.length), [2, 1]); assert.match(report.segments[1].definition, /Changed definition: admin-console removed .*Console decommissioned/)
  const hostile = await post('/api/people', { name: '<img src=x onerror=alert(1)>', email: 'hostile@northstar.test', kind: 'other' })
  for (const [path, text] of [['/app/programs', 'Start a program'], [`/app/programs/${soc2}?show=excluded`, 'P1.1'], ['/app/controls/' + control, 'Covered by AC-02 instead'], [`/app/controls/${control}/report?from=2026-10-12&to=2026-12-31`, 'Changed definition'], ['/app/people', 'hostile@northstar.test'], ['/app/requirements/' + requirement.id, 'Renewal']]) {
   const page = await app.fetch(path); assert.equal(page.status, 200, path); const html = await page.text()
   assert.ok(html.includes(text), path); assert.ok(!html.includes('<img src=x'), path)
  }
  assert.ok(hostile.id)
  const after = await get('/api/controls/' + control)
  assert.equal(after.mappings.custom[0].removal_reason, 'Covered by AC-02 instead'); assert.deepEqual(after.scope, ['prod-db'])
 })
 await scenario('BOUNDARY-001: a US business scopes HIPAA and PCI, inspects BAA/DPA, regional and licensed-content prerequisites and the assessor handoff, reviews USD costs and exports an assessor pack that claims no certification', async () => {
  const claims = /\b(?:certified|guaranteed?|(?:HIPAA|PCI)[- ]compliant|legally sufficient)\b/i, words = html => html.replace(/<[^>]+>/g, ' ')
  const html = await (await app.fetch('/app/programs/' + hipaa)).text()
  assert.match(html, /Business associate agreements \(BAAs\)/); assert.match(html, /US-first regional scope.*us-east-1/s); assert.match(html, /HIPAA has no certification/)
  assert.match(html, /Not verified by Evidence/); assert.match(html, /Evidence charges USD 0/); assert.match(html, /data-cost-provider="cloudflare"/); assert.match(html, /data-cost-provider="resend"/)
  assert.doesNotMatch(words(html), claims)
  // Follow each specialist link to the page where that provider's records live.
  const start = html.indexOf('id="boundary"'), panel = html.slice(start, html.indexOf('</section>', start))
  const links = [...panel.matchAll(/href="(\/app\/[a-z]+)"/g)].map(m => m[1])
  for (const path of ['/app/vulnerabilities', '/app/connections', '/app/remediation', '/app/folders']) assert.ok(links.includes(path), path)
  for (const path of links) { const page = await app.fetch(path); assert.equal(page.status, 200, path); assert.doesNotMatch(words(await page.text()), claims, path) }
  const abroad = (await program('pci', { name: 'PCI card data', regions: ['us-east-1', 'eu-west-1'] })).id
  const pciPage = await (await app.fetch('/app/programs/' + abroad)).text()
  assert.match(pciPage, /Regions outside the US are in scope: eu-west-1\./); assert.match(pciPage, /PCI DSS standard/); assert.match(pciPage, /Third-party service provider agreements/)
  assert.equal((await app.fetch(`/api/programs/${abroad}/handoff`, { headers: { cookie: '' } })).status, 401)
  assert.equal((await app.fetch('/api/programs/00000000-0000-4000-8000-000000000000/handoff')).status, 404)
  const download = async () => { const r = await app.fetch(`/api/programs/${abroad}/handoff`); assert.equal(r.status, 200); assert.match(r.headers.get('content-disposition'), /^attachment; filename="assessor-handoff-/); return r.json() }
  const pack = await download()
  assert.equal(pack.format, 'evidence-assessor-handoff'); assert.match(pack.certification, /^None asserted\. The merchant or a PCI QSA signs/)
  assert.deepEqual(pack.prerequisites.map(p => p.kind), ['agreement', 'licensed content', 'regional']); assert.ok(pack.prerequisites.every(p => p.status === 'not verified by Evidence'))
  assert.equal(pack.costs.evidence, 'USD 0'); assert.ok(pack.costs.providers.some(p => p.provider === 'cloudflare')); assert.ok(pack.costs.providers.every(p => /USD/.test(p.basis)))
  assert.deepEqual(pack.program.regions, ['us-east-1', 'eu-west-1']); assert.equal(pack.assessor.named, 'Harbour Assurance LLP')
  assert.equal(pack.unresolved.length, pack.readiness.included - pack.readiness.ready); assert.ok(pack.unresolved.length > 0)
  const access = pack.evidence.find(e => e.library_id === 'AC-04'); assert.ok(access.exhibits.length); assert.match(access.exhibits[0].sha256, /^[a-f0-9]{64}$/)
  assert.doesNotMatch(JSON.stringify(pack), claims)
  // A restart keeps the pack's evidence index, and each download is audited.
  await app.clock('2026-11-15T09:00:00Z')
  assert.deepEqual((await download()).evidence, pack.evidence)
  assert.equal((await app.db.prepare("SELECT COUNT(*) AS n FROM product_audit WHERE action='program.handoff-exported' AND subject=?").bind('program:' + abroad).first()).n, 2)
 })
 await scenario('An eight-month-old pentest report covers four months, then due soon and overdue each remind the owner once', async () => {
  await app.clock('2026-10-11T12:00:00Z')
  const pentest = await libraryRequirement('OPS-05')
  assert.equal(pentest.renewal.anchor, 'effective-date'); assert.equal(pentest.gap, 'missing')
  await post(`/api/controls/${pentest.control_id}/owners`, { owner_person_id: owner.id, reason: 'Security lead' }, 200)
  await upload(pentest.id, { covered_from: '2026-02-11', covered_to: '2026-02-11', effective_date: '2026-02-11' })
  let row = await libraryRequirement('OPS-05')
  assert.equal(row.gap, 'covered'); assert.equal(row.renewal.due, '2027-02-11'); assert.equal(row.renewal.effective_date, '2026-02-11')
  await app.tick(); assert.equal(sent('priya@northstar.test').length, 0)
  await app.clock('2026-12-10T12:00:00Z'); row = await libraryRequirement('OPS-05'); assert.equal(row.gap, 'due soon')
  await app.tick(); await app.clock('2026-12-10T12:05:00Z'); await app.tick()
  assert.equal(sent('priya@northstar.test').filter(m => /Due soon: Penetration test report/.test(m.subject)).length, 1)
  await app.clock('2027-02-11T00:00:00Z'); assert.equal((await libraryRequirement('OPS-05')).gap, 'overdue')
  await app.tick(); await app.tick()
  assert.equal(sent('priya@northstar.test').filter(m => /Overdue: Penetration test report/.test(m.subject)).length, 1)
  assert.equal((await libraryRequirement('OPS-05')).renewal.due, '2027-02-11')
  await post(`/api/requirements/${pentest.id}/renewal-date`, { due_date: '2027-03-31', reason: 'Tester rescheduled' }, 200)
  row = await libraryRequirement('OPS-05'); assert.equal(row.renewal.due, '2027-03-31'); assert.equal(row.gap, 'due soon')
  await upload(pentest.id, { covered_from: '2027-03-01', covered_to: '2027-03-01', effective_date: '2027-03-01' })
  await app.clock('2027-03-05T00:00:00Z'); row = await libraryRequirement('OPS-05')
  assert.equal(row.renewal.due, '2028-03-01'); assert.equal(row.renewal.override, null); assert.equal(row.gap, 'covered')
 })
 await scenario('Audit-window and fiscal-year anchors set their periods and earlier periods keep the schedule they ran under', async () => {
  const review = await libraryRequirement('AC-04'), risk = await libraryRequirement('RSK-01'), backups = await libraryRequirement('OPS-08')
  await post(`/api/requirements/${review.id}/schedule`, { cadence: 'semi-annual', anchor: 'audit-window', window_start: '2026-02-01', reason: 'Low-risk systems reviewed semi-annually' }, 200)
  await post(`/api/requirements/${risk.id}/schedule`, { cadence: 'annual', anchor: 'fiscal-year', fiscal_start_month: '7', owner_person_id: owner.id, reason: 'July fiscal year' }, 200)
  await post(`/api/requirements/${backups.id}/schedule`, { cadence: 'annual', anchor: 'calendar', reason: 'Annual restore test' }, 200)
  await post(`/api/requirements/${backups.id}/schedule`, { cadence: 'monthly', anchor: 'effective-date', reason: 'invalid' }, 400)
  const now = (await desk('2027-03-05')).reduce((m, r) => (m[r.id] = r, m), {})
  assert.deepEqual(now[review.id].renewal.period, { from: '2027-02-01', to: '2027-07-31' })
  assert.deepEqual((await desk('2026-10-20')).find(r => r.id === review.id).renewal.cadence, 'quarterly')
  assert.deepEqual(now[risk.id].renewal.period, { from: '2026-07-01', to: '2027-06-30' })
  assert.equal(now[backups.id].renewal.cadence, 'annual')
  const before = (await desk('2026-11-20')).find(r => r.id === backups.id)
  assert.equal(before.renewal.cadence, 'quarterly'); assert.deepEqual(before.renewal.period, { from: '2026-10-01', to: '2026-12-31' })
 })
 console.log(`${passed} program public-door scenarios passed with real workerd, D1, R2 and native owner sessions.`)
} finally { await app.close() }
