import assert from 'node:assert/strict'
import { runtime } from './runtime.mjs'
// PROGRAM-004 through the owner's doors: each named extended program is created on a business that already runs SOC 2,
// opens readiness with no unmapped requirement, shows the SOC 2 evidence it reuses and its external dependency, keeps an
// excluded requirement visible, and exports. CMMC Level 2 computes an SPRS score, USDP evaluates state thresholds, and
// ISO/IEC 27701 keeps controller and processor controls separately applicable.
export async function extendedProgramsJourney({ app, post, get, upload, libraryRequirement, soc2, owner }) {
 const pdfText = bytes => [...Buffer.from(bytes).toString('latin1').matchAll(/\((.*)\) Tj/g)].map(m => m[1].replace(/\\([\\()])/g, '$1')).join('\n')
 const bytesOf = async path => { const r = await app.fetch(path); assert.equal(r.status, 200, path); return new Uint8Array(await r.arrayBuffer()) }
 const docUrl = (program, kind) => `/api/programs/${program}/documents/${kind}`, tip = async (program, kind) => (await get(docUrl(program, kind))).revision.revision
 const generate = async (program, kind) => { await post(`/api/programs/${program}/documents`, { kind, owner_person_id: owner.id }); return get(docUrl(program, kind)) }
 const make = (framework, edition, extra = {}, status = 201) => post('/api/programs', { framework, edition, name: `${framework} ${edition}`, legal_entity: 'Northstar Studio, Inc.', products: ['Web app'], regions: ['us-east-1'], audit_from: '2026-07-01', audit_to: '2027-06-30', ...extra }, status)
 const programs = {}
 const figures = { annual_revenue_usd: 40_000_000, small_business: false, sale_revenue_percent: 5, sensitive_data: false, consumers: { CA: 12_000, TX: 8_000, MT: 30_000 } }
 const specs = [
  ['usdp', '2026-10', /self-attested|counsel/i, { figures }, null],
  ['iso27701', '2019', /accredited certification body/i, { categories: ['controller', 'processor'] }, 55],
  ['gdpr', '2016-679', /No GDPR certification/i, {}, null],
  ['iso42001', '2023', /accredited certification body/i, {}, 65],
  ['nistairmf', '1.0', /self-assessed/i, {}, 72],
  ['nistcsf', '2.0', /self-assessed/i, {}, 106],
  ['nist80053', 'r5-moderate', /FedRAMP authorization is a separate program/i, {}, 287],
  ['nist80053', 'r5-low', /FedRAMP authorization is a separate program/i, {}, 149],
  ['cmmc', 'level-2', /C3PAO/i, {}, 110],
  ['cmmc', 'level-1', /C3PAO/i, {}, 17],
  ['hitrust', 'v11', /External Assessor/i, {}, 19],
 ]
 for (const [framework, edition, dependency, extra, total] of specs) {
  const created = await make(framework, edition, extra), { readiness } = await get('/api/programs/' + created.id)
  programs[framework + ':' + edition] = created.id
  assert.equal(readiness.totals.unmapped, 0, framework + ' ' + edition)
  assert.ok(readiness.requirements.filter(r => r.state === 'included').every(r => r.controls.length > 0), framework + ' every requirement has a mapped control')
  if (total) assert.equal(readiness.totals.requirements, total, framework + ' ' + edition)
  assert.match(readiness.dependency, dependency)
  const reused = readiness.reuse.find(x => x.program_id === soc2)
  assert.ok(reused && reused.shared_controls > 0 && reused.requirements_covered > 0 && reused.evidence_items >= 0, framework + ' reuses SOC 2 evidence')
  // One requirement excluded with a rationale stays visible as excluded.
  const first = readiness.requirements.find(r => r.state === 'included'); assert.ok(first, framework + ' ' + edition + ' has an included requirement'); const ref = first.ref
  await post(`/api/programs/${created.id}/applicability`, { ref, state: 'excluded', rationale: 'Outside this business\'s scope, per counsel.' }, 200)
  const after = (await get('/api/programs/' + created.id)).readiness
  assert.equal(after.requirements.find(r => r.ref === ref).state, 'excluded'); assert.match(after.requirements.find(r => r.ref === ref).rationale, /per counsel/); assert.equal(after.totals.excluded, readiness.totals.excluded + 1)
  const exported = await get(`/api/programs/${created.id}/export`)
  assert.match(exported.certification, /None asserted/); assert.ok(exported.requirements.some(r => r.ref === ref && r.state === 'excluded')); assert.equal(exported.extended.dependency, readiness.dependency)
 }
 // CMMC Level 2: SPRS from the DoD Assessment Methodology weights, moving with a control's state.
 const cmmc = programs['cmmc:level-2'], start = (await get('/api/programs/' + cmmc)).readiness.sprs
 assert.equal(start.maximum, 110); assert.equal(start.minimum, -203); assert.equal(start.excluded, 1); assert.equal(start.score, -203 + 5, 'nothing implemented scores the published floor, less the excluded 3.1.1 (5 points)')
 const maintenance = await libraryRequirement('PHY-04')
 await upload(maintenance.id, { covered_from: '2026-10-01', covered_to: '2026-12-31' })
 const better = (await get('/api/programs/' + cmmc)).readiness.sprs, fixed = start.deductions.filter(d => !better.deductions.some(x => x.ref === d.ref))
 assert.ok(fixed.length >= 6 && fixed.every(d => /^3\.7\./.test(d.ref)), 'the maintenance requirements are now implemented')
 assert.equal(better.score - start.score, fixed.reduce((n, d) => n + d.deduction, 0)); assert.ok(better.score > start.score)
 assert.equal(better.deductions.find(d => d.ref === '3.5.3').deduction, 5)
 await post(`/api/programs/${cmmc}/inputs`, { mfa: 'privileged-remote', fips: 'not-validated', reason: 'MFA rolled out to remote and privileged users; encryption awaiting validation' }, 200)
 const partial = (await get('/api/programs/' + cmmc)).readiness.sprs
 assert.equal(partial.score - better.score, 4); assert.deepEqual(partial.qualifiers, { mfa: 'privileged-remote', fips: 'not-validated' }); assert.match(partial.blocked, /3\.12\.4/)
 await post(`/api/programs/${cmmc}/inputs`, { mfa: 'bad', fips: 'validated', reason: 'x' }, 400)
 // CMMC records: the system security plan derives each requirement's implementation from live proof; the plan of action lists the rest.
 const ssp = await generate(cmmc, 'cmmc-ssp'), table = ssp.revision.content.sections.find(x => x.id === 'status').table.rows
 assert.equal(table.length, 110); assert.equal(table.find(r => r[0] === '3.7.1')[2], 'implemented'); assert.equal(table.find(r => r[0] === '3.5.3')[2], 'not implemented'); assert.equal(table.find(r => r[0] === '3.1.1')[2], 'not applicable (excluded)')
 assert.equal(ssp.revision.content.sections.find(x => x.id === 'boundary').status, 'owner-needed')
 await post(`${docUrl(cmmc, 'cmmc-ssp')}/approvals`, { revision: await tip(cmmc, 'cmmc-ssp'), approver_person_id: owner.id }, 409)
 const plan = await generate(cmmc, 'cmmc-poam'), open = plan.revision.content.sections[0].statements
 assert.equal(open.length, table.filter(r => !['implemented', 'not applicable (excluded)'].includes(r[2])).length); assert.ok(open.some(x => /^3\.5\.3 .*No plan of action recorded/.test(x.text)))
 await post(`${docUrl(cmmc, 'cmmc-poam')}/revisions`, { inputs: JSON.stringify({ plans: [{ requirement: '3.5.3', planned_action: 'Enforce MFA for all users', owner: 'Priya Shah', due: '2026-12-31' }] }), reason: 'Plan for MFA' })
 assert.match((await get(docUrl(cmmc, 'cmmc-poam'))).revision.content.sections[0].statements.find(x => /^3\.5\.3 /.test(x.text)).text, /Planned action: Enforce MFA for all users; owner Priya Shah; due 2026-12-31[^]*does not make a requirement implemented/)
 for (const [key, kind] of [['nist80053:r5-moderate', 'nist80053-ssp'], ['nist80053:r5-moderate', 'nist80053-poam'], ['nistcsf:2.0', 'nistcsf-profile'], ['nistairmf:1.0', 'nistairmf-profile'], ['nistairmf:1.0', 'airmf-ai-register'], ['iso42001:2023', 'iso42001-soa'], ['iso42001:2023', 'iso42001-ai-register'], ['iso42001:2023', 'iso42001-impact'], ['hitrust:v11', 'hitrust-readiness']]) assert.ok((await generate(programs[key], kind)).revision.revision >= 1, kind)
 assert.equal((await get(docUrl(programs['nistcsf:2.0'], 'nistcsf-profile'))).revision.content.sections.find(x => x.id === 'status').table.rows.length, 106)
 // US Data Privacy: thresholds evaluated on the figures; raising Montana's figures is a reviewable change.
 const usdp = programs['usdp:2026-10'], first = (await get('/api/programs/' + usdp)).readiness, byState = Object.fromEntries(first.usdp.states.map(s => [s.code, s]))
 assert.deepEqual(['CA', 'TX', 'MT'].map(c => byState[c].applies), [true, true, false]); assert.ok(first.usdp.states.filter(s => !['CA', 'TX'].includes(s.code)).every(s => !s.applies))
 const inScope = ref => first.requirements.find(r => r.ref === ref)
 assert.equal(inScope('CA.ACCESS').state, 'included'); assert.equal(inScope('TX.DELETE').state, 'included'); assert.equal(inScope('MT.ACCESS').state, 'excluded')
 assert.match(inScope('MT.ACCESS').rationale, /50,000 consumers[^]*30,000 Montana consumers[^]*\$40,000,000/); assert.match(inScope('VA.ACCESS').rationale, /0 Virginia consumers/)
 assert.match(inScope('CA.ACCESS').section, /California Consumer Privacy Act.*effective 2020-01-01/)
 const ids = r => first.requirements.filter(x => x.ref.startsWith(r)).length; assert.ok(ids('CA.') > 0 && ids('MT.') > 0 && ids('RI.') > 0)

 // The self-attestation and the program's required records are versioned program documents.
 const attestation = await generate(usdp, 'usdp-self-attestation'), sections = Object.fromEntries(attestation.revision.content.sections.map(x => [x.id, x]))
 assert.deepEqual(sections.applicable.statements.map(x => x.text.split(':')[0]).sort(), ['California', 'Texas']); assert.match(sections.applicable.statements.find(x => /^California/.test(x.text)).text, /effective Jan 1, 2020/)
 assert.ok(sections.excluded.statements.some(x => /Montana does not apply[^]*30,000 Montana consumers/.test(x.text)))
 await post(`${docUrl(usdp, 'usdp-self-attestation')}/approvals`, { revision: await tip(usdp, 'usdp-self-attestation'), approver_person_id: owner.id }, 409)
 await post(`${docUrl(usdp, 'usdp-self-attestation')}/revisions`, { inputs: JSON.stringify({ statement: 'On behalf of Northstar Studio, I state that the business has assessed the listed state laws on its recorded figures.' }), reason: 'Officer statement written' })
 const attested = await tip(usdp, 'usdp-self-attestation')
 await post(`${docUrl(usdp, 'usdp-self-attestation')}/approvals`, { revision: attested, approver_person_id: owner.id, effective_date: '2026-10-22', note: 'Approved' })
 const pdf = pdfText(await bytesOf(`${docUrl(usdp, 'usdp-self-attestation')}/export?format=pdf&revision=${attested}`)); assert.match(pdf, /California/); assert.match(pdf, /Texas/); assert.match(pdf, /does not sign, attest or certify/i)
 assert.ok((await bytesOf(`${docUrl(usdp, 'usdp-self-attestation')}/export?format=docx&revision=${attested}`)).length > 1000)
const rights = await generate(usdp, 'usdp-rights-requests'); await post(`${docUrl(usdp, 'usdp-rights-requests')}/revisions`, { inputs: JSON.stringify({ requests: [{ received: '2026-08-01', state: 'CA', right: 'delete', status: 'open', responded: '' }, { received: '2026-09-20', state: 'TX', right: 'access', status: 'answered', responded: '2026-10-01' }] }), reason: 'Request log' })
 const logged = (await get(docUrl(usdp, 'usdp-rights-requests'))).revision.content.sections[0]
 assert.equal(logged.statements.length, 2); assert.match(logged.statements[0].text, /open more than 45 days/); assert.doesNotMatch(logged.statements[1].text, /open more than/)
 for (const kind of ['usdp-notice-optout', 'usdp-assessments']) assert.ok((await generate(usdp, kind)).revision.revision >= 1)
 assert.ok(rights.revision.revision >= 1)
 const gdpr = programs['gdpr:2016-679']
 await generate(gdpr, 'gdpr-ropa'); await post(`${docUrl(gdpr, 'gdpr-ropa')}/revisions`, { inputs: JSON.stringify({ processing: [{ activity: 'Customer support', purpose: 'Resolve tickets', data_subjects: 'Customers', data_categories: 'Contact details', recipients: 'Zendesk', transfers: 'US under SCCs', retention: '24 months' }] }), reason: 'Article 30 register' })
 assert.match((await get(docUrl(gdpr, 'gdpr-ropa'))).revision.content.sections[0].statements[0].text, /activity: Customer support[^]*retention: 24 months/)
 for (const kind of ['gdpr-dpia', 'gdpr-dsr']) assert.ok((await generate(gdpr, kind)).revision.revision >= 1)
 assert.ok((await generate(programs['iso27701:2019'], 'pims-records')).revision.revision >= 1)
 await post(`/api/programs/${usdp}/inputs`, { annual_revenue_usd: 40_000_000, small_business: false, sale_revenue_percent: 5, consumers: { CA: 12_000, TX: 8_000, MT: 60_000 }, reason: 'Montana customer growth' }, 200)
 const raised = (await get('/api/programs/' + usdp)).readiness
 assert.equal(raised.usdp.states.find(s => s.code === 'MT').pending, 'include'); assert.equal(raised.requirements.find(r => r.ref === 'MT.ACCESS').state, 'excluded', 'nothing changes until the owner accepts')
 await post(`/api/programs/${usdp}/state-changes`, { state: 'MT', reason: '' }, 400)
 await post(`/api/programs/${usdp}/state-changes`, { state: 'CA', reason: 'not pending' }, 409)
 await post(`/api/programs/${usdp}/state-changes`, { state: 'MT', reason: 'Counsel confirmed Montana applies' }, 200)
 const accepted = (await get('/api/programs/' + usdp)).readiness
 assert.equal(accepted.requirements.find(r => r.ref === 'MT.ACCESS').state, 'included'); assert.match(accepted.requirements.find(r => r.ref === 'MT.ACCESS').rationale, /Counsel confirmed Montana applies/); assert.equal(accepted.usdp.states.find(s => s.code === 'MT').pending, null)
 const drifted = await get(docUrl(usdp, 'usdp-self-attestation')); assert.equal(drifted.state, 'needs review'); assert.ok(drifted.drift.items.some(i => /Montana/.test(i.label)))
 const trail = (await get('/api/audit?action=program.')).entries.filter(e => e.subject === 'program:' + usdp)
 assert.ok(trail.some(e => e.action === 'program.state-change' && /MT included/.test(e.detail) && e.reason === 'Counsel confirmed Montana applies'))
 // ISO/IEC 27701: reuse from ISO 27001, with controller and processor controls separately applicable.
 const pims = (await get('/api/programs/' + programs['iso27701:2019'])).readiness
 assert.ok(pims.roles.controller.included > 0 && pims.roles.processor.included > 0 && pims.roles.both.included > 0)
 assert.ok(pims.requirements.some(r => r.ref === 'A.7.2.1' && r.state === 'included') && pims.requirements.some(r => r.ref === 'B.8.2.1' && r.state === 'included'))
 const controllerOnly = await make('iso27701', '2019', { name: 'PIMS controller only', categories: ['controller'] }), only = (await get('/api/programs/' + controllerOnly.id)).readiness
 assert.equal(only.requirements.find(r => r.ref === 'B.8.2.1').state, 'excluded'); assert.match(only.requirements.find(r => r.ref === 'B.8.2.1').rationale, /processor role is not in this program/); assert.equal(only.requirements.find(r => r.ref === 'A.7.2.1').state, 'included')
 await make('iso27701', '2019', { name: 'No role', categories: [] }, 400)
 // Custody archive parity: the extended programs, their applicability, figures and documents restore into an empty installation.
 const archive = Buffer.from(await bytesOf('/api/archive/export')), target = await runtime()
 try {
  await target.signin()
  const restored = await target.fetch('/api/archive/restore', { method: 'POST', headers: { origin: target.origin, 'content-type': 'application/octet-stream', 'x-evidence-confirm': 'restore', 'x-evidence-erasure-history': 'unverified acknowledged' }, body: archive }); assert.equal(restored.status, 200, await restored.clone().text())
  const there = await (await target.fetch(`/api/programs/${usdp}`)).json(), here = (await get(`/api/programs/${usdp}`))
  assert.equal(there.program.framework, 'usdp'); assert.deepEqual(there.readiness.requirements.map(r => [r.ref, r.state, r.rationale]), here.readiness.requirements.map(r => [r.ref, r.state, r.rationale])); assert.deepEqual(there.readiness.usdp.figures, here.readiness.usdp.figures)
  assert.equal((await (await target.fetch(docUrl(usdp, 'usdp-self-attestation'))).json()).revision.revision, await tip(usdp, 'usdp-self-attestation'))
  assert.equal((await (await target.fetch(`/api/programs/${programs['cmmc:level-2']}`)).json()).readiness.sprs.qualifiers.mfa, 'privileged-remote')
 } finally { await target.close() }
 return programs
}
