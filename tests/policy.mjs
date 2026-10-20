// Policy templates, the guided builder, exact-revision approval, policy tests,
// readiness, and employee attestations through public doors: owner JSON doors,
// Base invitations and email-link sign-in for members, the employee door and
// the Cron Trigger. Only the mail provider is faked, at the network edge.
process.env.RER_SERVER_JOURNEY = '1'
import assert from 'node:assert/strict'
import { runtime } from './helpers/runtime.mjs'
const app = await runtime()
let passed = 0
const scenario = async (name, fn) => { await fn(); passed++; console.log('PASS ' + name) }
const post = async (path, body, status = 201) => { const r = await app.fetch(path, { method: 'POST', headers: { origin: app.origin, 'content-type': 'application/json' }, body: JSON.stringify(body) }); const text = await r.text(); assert.equal(r.status, status, path + ' ' + text); return text ? JSON.parse(text) : null }
const get = async (path, status = 200) => { const r = await app.fetch(path); assert.equal(r.status, status, path); return status === 200 ? r.json() : null }
const testOf = async id => (await get('/api/tests')).tests.find(t => t.catalogue_id === id)
const latest = async id => (await get('/api/tests/' + (await testOf(id)).id)).latest.map(o => [o.display_name, o.result])
// Draft from a template, approve the exact text and publish it.
async function adopt(template, program, publishBody = {}) {
 const draft = await post(`/api/policies/templates/${template}`, { program_id: program })
 const revision = await get(`/api/policies/${draft.policy}/revisions/${draft.revision}`)
 await post(`/api/policies/${draft.policy}/revisions/${draft.revision}/decision`, { decision: 'approved', body_sha256: revision.body_sha256 }, 200)
 await post(`/api/policies/${draft.policy}/revisions/${draft.revision}/publish`, publishBody, 200)
 return { ...draft, body: revision.body }
}
// A member accepts their invitation through Base's email link and gets their own session.
async function acceptInvitation(email) {
 const mail = app.messages.filter(m => m.to?.includes(email)).at(-1)
 const token = new URL(mail.html.match(/href="([^"]*\/auth\/confirm\?token=[^"]+)"/)[1].replaceAll('&amp;', '&'), app.origin).searchParams.get('token')
 app.setCookie('')
 const confirmed = await app.fetch('/auth/confirm', { method: 'POST', headers: { origin: app.origin, 'content-type': 'application/json' }, body: JSON.stringify({ token }) })
 assert.equal(confirmed.status, 303, 'invitation accepted')
 return confirmed.headers.getSetCookie().map(x => x.split(';')[0]).join('; ')
}
let ownerCookie, soc2, iso, aup
try {
 await scenario('LOG-001 / A fresh program lists every requirement lacking a published policy; the builder tailors templates; only the exact approved revision publishes, passes its policy test and is audited with its version', async () => {
  ownerCookie = await app.signin()
  soc2 = (await post('/api/programs', { framework: 'soc2', name: 'SOC 2', legal_entity: 'Northstar Labs Inc.', report_type: 'Type II', products: 'Northstar Billing', systems: 'billing-api, ledger-db', audit_from: '2026-07-01', audit_to: '2027-06-30' })).id
  iso = (await post('/api/programs', { framework: 'iso27001', name: 'ISO 27001', legal_entity: 'Northstar Labs Inc.', audit_from: '2026-07-01', audit_to: '2027-06-30' })).id
  const before = (await get('/api/programs/' + soc2)).readiness
  assert.ok(before.totals.policy_missing > 10); assert.deepEqual(before.requirements.find(r => r.ref === 'CC2.2').policies_missing.sort(), ['Acceptable use policy', 'Incident response policy', 'Information security policy'])
  const builder = await get('/api/policies/builder?program=' + soc2)
  assert.equal(builder.templates.length, 22); assert.equal(builder.facts.company, 'Northstar Labs Inc.'); assert.equal(builder.facts.products, 'Northstar Billing'); assert.equal(builder.facts.identity, 'the company identity provider')
  const draft = await post('/api/policies/templates/access-control', { program_id: soc2 })
  const revision = await get(`/api/policies/${draft.policy}/revisions/${draft.revision}`)
  assert.match(revision.body, /Northstar Labs Inc\./); assert.match(revision.body, /billing-api, ledger-db/); assert.match(revision.body, /not legal advice/)
  assert.deepEqual(await latest('policy.access-control'), [['Access control policy', 'fail']])
  await post(`/api/policies/${draft.policy}/revisions/${draft.revision}/decision`, { decision: 'approved', body_sha256: 'f'.repeat(64) }, 409)
  const changed = await post('/api/policies', { title: 'Access control policy', body: revision.body + '\n\nAn unreviewed change.' })
  const changedRevision = await get(`/api/policies/${changed.policy}/revisions/${changed.revision}`)
  await post(`/api/policies/${changed.policy}/revisions/${changed.revision}/decision`, { decision: 'rejected', body_sha256: changedRevision.body_sha256, note: 'Not reviewed' }, 200)
  await post(`/api/policies/${changed.policy}/revisions/${changed.revision}/publish`, {}, 409)
  await post(`/api/policies/${draft.policy}/revisions/${draft.revision}/decision`, { decision: 'approved', body_sha256: revision.body_sha256 }, 200)
  await post(`/api/policies/${draft.policy}/revisions/${draft.revision}/publish`, { effective_date: '2026-10-11' }, 200)
  assert.deepEqual(await latest('policy.access-control'), [['Access control policy', 'pass']])
  const decisions = (await get('/api/audit?action=policy.')).entries.map(e => [e.action, e.actor_name, e.reason, e.revision])
  for (const expected of [['policy.rejected', 'Evidence owner', 'Not reviewed', String(changedRevision.version)], ['policy.approved', 'Evidence owner', '', String(revision.version)], ['policy.published', 'Evidence owner', '', String(revision.version)]]) assert.ok(decisions.some(d => JSON.stringify(d) === JSON.stringify(expected)), expected.join(' '))
  for (const t of builder.templates.filter(t => t.id !== 'access-control')) { const adopted = await adopt(t.id, soc2); if (t.id === 'acceptable-use') aup = adopted }
  for (const id of [soc2, iso]) { const r = (await get('/api/programs/' + id)).readiness; assert.equal(r.totals.policy_missing, 0, id); assert.ok(r.requirements.every(x => x.policy !== 'missing')) }
  await app.clock('2027-10-12T12:00:00Z'); await app.tick()
  assert.deepEqual(await latest('policy.access-control'), [['Access control policy', 'fail']])
  assert.ok((await get('/api/programs/' + soc2)).readiness.totals.policy_missing > 10)
  await app.clock('2026-10-11T12:00:00Z'); await app.tick()
 })
 await scenario('An employee and a contractor sign in and acknowledge the exact version themselves; the other is reminded and overdue; a material revision reassigns; a departure ends access and keeps the record', async () => {
  const ana = await post('/api/people', { name: 'Ana Ruiz', email: 'ana@northstar.test', kind: 'employee' }), carl = await post('/api/people', { name: 'Carl Ito', email: 'carl@contract.test', kind: 'contractor' })
  await post(`/api/people/${ana.id}/invite`, {}, 202); await post(`/api/people/${carl.id}/invite`, {}, 202)
  assert.deepEqual((await post('/api/attestations/assign', { policy_id: aup.policy, audience: 'everyone', due_date: '2026-10-13' })), { assigned: 2 })
  const anaCookie = await acceptInvitation('ana@northstar.test'), carlCookie = await acceptInvitation('carl@contract.test')
  app.setCookie(anaCookie)
  const mine = await get('/api/me')
  assert.equal(mine.person.email, 'ana@northstar.test'); assert.equal(mine.assignments.length, 1); assert.equal(mine.assignments[0].status, 'pending')
  const shown = await get('/api/me/assignments/' + mine.assignments[0].id)
  assert.equal(shown.body, aup.body)
  await get('/api/programs', 403); await get('/api/attestations', 403)
  await post(`/api/me/assignments/${mine.assignments[0].id}/acknowledge`, { body_sha256: '0'.repeat(64) }, 409)
  await post(`/api/me/assignments/${mine.assignments[0].id}/acknowledge`, { body_sha256: shown.body_sha256 }, 200)
  await post(`/api/me/assignments/${mine.assignments[0].id}/acknowledge`, { body_sha256: shown.body_sha256 }, 409)
  app.setCookie(carlCookie)
  const carlTasks = await get('/api/me')
  await post(`/api/me/assignments/${mine.assignments[0].id}/acknowledge`, { body_sha256: shown.body_sha256 }, 404)
  app.setCookie(ownerCookie)
  await get('/api/me', 403)
  await app.clock('2026-10-15T12:00:00Z'); await app.tick()
  assert.equal(app.messages.filter(m => m.to.includes('carl@contract.test') && /Overdue: acknowledge the Acceptable use policy/.test(m.subject)).length, 1)
  const tracked = await get('/api/attestations')
  assert.deepEqual(tracked.assignments.map(a => [a.email, a.status]).sort(), [['ana@northstar.test', 'acknowledged'], ['carl@contract.test', 'overdue']])
  assert.equal(tracked.assignments.find(a => a.email === 'ana@northstar.test').operator_email, 'ana@northstar.test')
  assert.deepEqual((await latest('attest.acknowledged')).sort(), [['Ana Ruiz <ana@northstar.test>', 'pass'], ['Carl Ito <carl@contract.test>', 'fail']])
  const v2 = await post('/api/policies', { title: 'Acceptable use policy', body: aup.body + '\n\n6. Generative AI tools may receive only Public information.' })
  const v2rev = await get(`/api/policies/${v2.policy}/revisions/${v2.revision}`)
  await post(`/api/policies/${v2.policy}/revisions/${v2.revision}/decision`, { decision: 'approved', body_sha256: v2rev.body_sha256 }, 200)
  assert.equal((await post(`/api/policies/${v2.policy}/revisions/${v2.revision}/publish`, { material: 'yes', reassign_due: '2026-10-30' }, 200)).reassigned, 2)
  app.setCookie(anaCookie)
  assert.deepEqual((await get('/api/me')).assignments.map(a => [a.version, a.status]), [[2, 'pending'], [1, 'superseded']])
  app.setCookie(ownerCookie)
  assert.equal((await post(`/api/people/${carl.id}/depart`, { reason: 'Contract ended' }, 200)).outcome, 'sign-in account deactivated')
  app.setCookie(carlCookie); assert.ok([401, 403].includes((await app.fetch('/api/me')).status)); app.setCookie(ownerCookie)
  const after = await get('/api/attestations')
  assert.deepEqual(after.assignments.filter(a => a.email === 'carl@contract.test').map(a => [a.version, a.state]).sort(), [[1, 'superseded'], [2, 'departed']])
  assert.ok(after.assignments.find(a => a.email === 'ana@northstar.test' && a.version === 1).acknowledged_at)
  const exported = Buffer.from(await (await app.fetch('/api/archive/export')).arrayBuffer()).toString('latin1')
  assert.match(exported, /policy_acknowledgments/); assert.match(exported, /ana@northstar\.test/); assert.match(exported, /Contract ended/)
  assert.ok(carlTasks.assignments.length === 1)
 })
 console.log(`${passed} policy and attestation public-door scenarios passed with Base invitations and member sign-in.`)
} finally { await app.close() }
