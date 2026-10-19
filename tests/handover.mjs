// LIFECYCLE-002 ownership handover through public doors: owner JSON and HTML
// doors, the v1 API, Base invitations for the leaver, the member door and the
// Cron Trigger on real workerd, D1 and R2. Only the mail provider is faked.
process.env.RER_SERVER_JOURNEY = '1'
import assert from 'node:assert/strict'
import { runtime } from './helpers/runtime.mjs'
const app = await runtime()
let passed = 0
const scenario = async (name, fn) => { await fn(); passed++; console.log('PASS ' + name) }
const post = async (path, body, status = 201) => { const r = await app.fetch(path, { method: 'POST', headers: { origin: app.origin, 'content-type': 'application/json' }, body: JSON.stringify(body) }); const text = await r.text(); assert.equal(r.status, status, path + ' ' + text); return text ? JSON.parse(text) : null }
const get = async path => { const r = await app.fetch(path); assert.equal(r.status, 200, path); return r.json() }
const html = async path => { const r = await app.fetch(path); assert.equal(r.status, 200, path); return r.text() }
const v1 = (token, method, path, body) => app.fetch(path, { method, headers: { cookie: '', authorization: 'Bearer ' + token, 'content-type': 'application/json' }, body: JSON.stringify(body) })
const mail = (to, pattern) => app.messages.filter(m => m.to?.includes(to) && pattern.test(m.subject))
const key = i => `${i.kind}:${i.item_id}:${i.role}`
async function acceptInvitation(email) {
 const sent = app.messages.filter(m => m.to?.includes(email)).at(-1)
 const token = new URL(sent.html.match(/href="([^"]*\/auth\/confirm\?token=[^"]+)"/)[1].replaceAll('&amp;', '&'), app.origin).searchParams.get('token')
 app.setCookie('')
 const confirmed = await app.fetch('/auth/confirm', { method: 'POST', headers: { origin: app.origin, 'content-type': 'application/json' }, body: JSON.stringify({ token }) })
 assert.equal(confirmed.status, 303, 'invitation accepted')
 return confirmed.headers.getSetCookie().map(x => x.split(';')[0]).join('; ')
}
let program, dana, priya, sam, cc62, other, third, policy, risk, vendor, treatment, obligation, ownerCookie
try {
 await scenario('LIFECYCLE-002: a departure flags every responsibility "owner left" the same day, readiness counts the controls unowned and the compliance owner is asked to hand over', async () => {
  ownerCookie = await app.signin()
  await app.clock('2026-10-16T15:00:00Z')
  program = (await post('/api/programs', { framework: 'soc2', name: 'SOC 2', legal_entity: 'Northstar', report_type: 'Type II', audit_from: '2026-10-01', audit_to: '2027-09-30' })).id
  dana = await post('/api/people', { name: 'Dana Leaver', email: 'dana@northstar.test', kind: 'employee' })
  priya = await post('/api/people', { name: 'Priya Shah', email: 'priya@northstar.test', kind: 'employee' })
  sam = await post('/api/people', { name: 'Sam Ortiz', email: 'sam@northstar.test', kind: 'employee' })
  const ready = (await get('/api/programs/' + program)).readiness
  cc62 = ready.requirements.find(r => r.ref === 'CC6.2').controls[0].id
  other = ready.requirements.find(r => r.ref === 'CC7.2').controls.find(c => c.id !== cc62).id
  for (const control of [cc62, other]) await post(`/api/controls/${control}/owners`, { owner_person_id: dana.id, reason: 'Security lead' }, 200)
  third = ready.requirements.find(r => r.ref === 'CC8.1').controls.find(c => ![cc62, other].includes(c.id)).id
  await post(`/api/controls/${third}/owners`, { owner_person_id: sam.id, contributors: [dana.id], reason: 'Change review' }, 200)
  // An approval the leaver made before leaving: their own acknowledgment of the policy they own.
  policy = await post('/api/policies', { title: 'Access control policy', body: 'Access is granted by role and reviewed quarterly.', owner_person_id: dana.id })
  const revision = await get(`/api/policies/${policy.policy}/revisions/${policy.revision}`)
  await post(`/api/policies/${policy.policy}/revisions/${policy.revision}/decision`, { decision: 'approved', body_sha256: revision.body_sha256 }, 200)
  await post(`/api/policies/${policy.policy}/revisions/${policy.revision}/publish`, {}, 200)
  await post(`/api/people/${dana.id}/invite`, {}, 202)
  await post('/api/attestations/assign', { policy_id: policy.policy, audience: 'selected', people: [dana.id], due_date: '2026-10-30' })
  app.setCookie(await acceptInvitation('dana@northstar.test'))
  const mine = await get('/api/me'), shown = await get('/api/me/assignments/' + mine.assignments[0].id)
  await post(`/api/me/assignments/${mine.assignments[0].id}/acknowledge`, { body_sha256: shown.body_sha256 }, 200)
  app.setCookie(ownerCookie)
  risk = await post('/api/risks', { title: 'Stale production access', scenario: 'Leavers keep production access', likelihood: '3', impact: '4', treatment: 'mitigate', owner_person_id: dana.id })
  await post(`/api/risks/${risk.id}/treatments`, { title: 'Quarterly access recertification', due_date: '2026-12-31', owner_person_id: dana.id }, 201)
  treatment = (await get('/api/risks/' + risk.id)).treatments[0].id
  vendor = await post('/api/vendors', { name: 'Okta', criticality: 'high', owner_person_id: dana.id })
  const push = await post('/api/api-tokens', { name: 'IdP export', scopes: ['resource-push', 'test-write', 'read'], expires_at: '2027-04-01' })
  assert.equal((await v1(push.token, 'PUT', '/v1/resource-types/idp_user', { schema: { fields: { mfa: 'boolean' } } })).status, 200)
  assert.equal((await v1(push.token, 'PUT', '/v1/resources/idp_user', { resources: [{ uniqueId: 'ana', displayName: 'ana@northstar.test', attributes: { mfa: false } }] })).status, 200)
  assert.equal((await v1(push.token, 'POST', '/v1/tests', { name: 'People sign in with MFA', resourceType: 'idp_user', criteria: [{ attribute: 'mfa', op: 'equals', value: true }], cadence: 'hourly', category: 'identity', severity: 'high', controls: ['AC-05'] })).status, 201)
  obligation = (await get('/api/remediation')).open[0].id
  await post(`/api/remediation/${obligation}/assign`, { owner_person_id: dana.id, next_action: 'Enforce MFA' }, 200)
  const before = (await get('/api/programs/' + program)).readiness.totals
  assert.equal(before.owner_left, 0)
  assert.deepEqual((await get('/api/handover')).items, [])

  const departed = await post(`/api/people/${dana.id}/depart`, { reason: 'Resigned' }, 200)
  assert.equal(departed.handover.to, 'compliance owner')
  const { items, window_days } = await get('/api/handover')
  assert.equal(window_days, 5)
  assert.deepEqual(items.map(i => [i.kind, i.item_id, i.role]).sort(), [['control', cc62, 'owner'], ['control', other, 'owner'], ['control', third, 'contributor'], ['obligation', obligation, 'owner'], ['policy', policy.policy, 'owner'], ['risk', risk.id, 'owner'], ['treatment', treatment, 'owner'], ['vendor', vendor.id, 'owner']].sort())
  for (const i of items) { assert.equal(i.state, 'owner left'); assert.equal(i.person_name, 'Dana Leaver'); assert.equal(i.departed_at, '2026-10-16T15:00:00.000Z'); assert.equal(i.deadline, '2026-10-23') }
  for (const path of ['/app/controls/' + cc62, '/app/policies', '/app/risks/' + risk.id, '/app/risks', '/app/remediation/' + obligation, '/app/vendors', '/app/handover']) assert.match(await html(path), /owner left 2026-10-16|Dana Leaver · left 2026-10-16/, path)
  const after = (await get('/api/programs/' + program)).readiness.totals
  assert.equal(after.owner_left, 2); assert.equal(after.unowned_controls, before.unowned_controls + 2)
  const asked = mail('owner@example.test', /Hand over 8 responsibilities: Dana Leaver left/)
  assert.equal(asked.length, 1); assert.match(asked[0].text, /As their compliance owner, please hand over by 2026-10-23/)
 })
 await scenario('LIFECYCLE-002: reassigning CC6.2 to Priya notifies her and keeps the departed owner and reason in its history; a bulk handover moves the rest item by item; past decisions keep their actor', async () => {
  const { items } = await get('/api/handover'), control = items.find(i => i.item_id === cc62)
  await post('/api/handover/reassign', { person_id: dana.id, kind: 'control', item_id: cc62, role: 'owner', to_person_id: dana.id, reason: 'x' }, 409)
  const moved = await post('/api/handover/reassign', { person_id: dana.id, kind: control.kind, item_id: cc62, role: control.role, to_person_id: priya.id, reason: 'Priya runs access provisioning now' }, 200)
  assert.equal(moved.notified, 'accepted')
  assert.equal(mail('priya@northstar.test', /Handed over to you: /).length, 1)
  const detail = await get('/api/controls/' + cc62)
  assert.equal(detail.owners.at(-1).owner_email, 'priya@northstar.test')
  assert.equal(detail.owners.at(-2).owner_email, 'dana@northstar.test')
  assert.match(detail.owners.at(-1).reason, /Handover from Dana Leaver \(left 2026-10-16\): Priya runs access provisioning now/)
  assert.match(await html('/app/controls/' + cc62), /Priya runs access provisioning now/)
  assert.equal((await get('/api/programs/' + program)).readiness.totals.owner_left, 1)
  await post('/api/handover/reassign', { person_id: dana.id, kind: 'control', item_id: cc62, role: 'owner', to_person_id: sam.id, reason: 'again' }, 404)

  const rest = (await get('/api/handover?person=' + dana.id)).items.filter(i => i.kind !== 'risk')
  const bulk = await post(`/api/people/${dana.id}/handover`, { to_person_id: sam.id, reason: 'Sam covers security operations', items: rest.map(key) }, 200)
  assert.equal(bulk.moved, 6)
  assert.equal(mail('sam@northstar.test', /6 responsibilities handed over to you/).length, 1)
  const left = (await get('/api/handover')).items
  assert.deepEqual(left.map(i => [i.kind, i.item_id]), [['risk', risk.id]])
  const history = (await get('/api/handover?person=' + dana.id)).history
  assert.equal(history.length, 7); assert.deepEqual(history.filter(h => h.bulk).map(h => h.kind).sort(), ['control', 'control', 'obligation', 'policy', 'treatment', 'vendor'])
  const changed = await get('/api/controls/' + third)
  assert.equal(changed.owners.at(-1).owner_email, 'sam@northstar.test'); assert.deepEqual(changed.owners.at(-1).contributor_names, []); assert.deepEqual(changed.owners.at(-2).contributor_names, ['Dana Leaver'])
  assert.equal((await get('/api/vendors')).vendors.find(v => v.id === vendor.id).owner_name, 'Sam Ortiz')
  assert.equal((await get('/api/risks/' + risk.id)).treatments[0].owner_person_id, sam.id)
  assert.ok(history.every(h => h.from_name === 'Dana Leaver'))
  assert.equal((await get('/api/policies')).policies.find(p => p.id === policy.policy).owner_person_id, sam.id)
  const remediation = await get('/api/remediation/' + obligation)
  assert.equal(remediation.obligation.owner_person_id, sam.id)
  assert.ok(remediation.events.some(e => e.kind === 'reassigned' && /Sam covers security operations/.test(e.body)))
  assert.equal((await get('/api/programs/' + program)).readiness.totals.owner_left, 0)
  // Nothing is reattributed: the leaver's acknowledgment, ownership rows and assignment events still name them.
  const ack = (await get('/api/attestations')).assignments.find(a => a.policy_id === policy.policy && a.person_id === dana.id)
  assert.equal(ack.status, 'acknowledged'); assert.equal(ack.operator_email, 'dana@northstar.test')
  assert.equal((await get('/api/controls/' + other)).owners.filter(o => o.owner_email === 'dana@northstar.test').length, 1)
  assert.ok(remediation.events.some(e => e.kind === 'assigned'))
 })
 await scenario('LIFECYCLE-002: an item left past the owner-set business-day window escalates once', async () => {
  await post('/api/handover/settings', { window_days: '0' }, 400)
  await post('/api/handover/settings', { window_days: '3' }, 200)
  const [item] = (await get('/api/handover')).items
  assert.equal(item.deadline, '2026-10-21')
  await app.clock('2026-10-21T20:00:00Z'); await app.tick()
  assert.equal(mail('owner@example.test', /^Escalation: /).length, 0)
  assert.equal((await get('/api/handover')).items[0].state, 'owner left')
  await app.clock('2026-10-22T14:00:00Z'); await app.tick(); await app.tick()
  const escalated = mail('owner@example.test', /^Escalation: 1 responsibilities of Dana Leaver still unowned/)
  assert.equal(escalated.length, 1); assert.match(escalated[0].text, /Stale production access/)
  assert.equal((await get('/api/handover')).items[0].state, 'escalated')
  assert.match(await html('/app/handover'), /escalated/)
  await post('/api/handover/reassign', { person_id: dana.id, kind: 'risk', item_id: risk.id, role: 'owner', to_person_id: priya.id, reason: 'Priya owns access risks' }, 200)
  assert.deepEqual((await get('/api/handover')).items, [])
  assert.match(await html('/app/risks/' + risk.id), /Priya Shah/)
 })
 console.log(`${passed} handover public-door scenarios passed with real workerd, D1, R2 and native owner sessions.`)
} finally { await app.close() }
