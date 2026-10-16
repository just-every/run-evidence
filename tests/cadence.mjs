// Recurring policy and vendor reviews (CADENCE-001) through the owner's JSON
// doors and the Cron Trigger on the harness clock. Only mail is faked.
process.env.RER_SERVER_JOURNEY = '1'
import assert from 'node:assert/strict'
import { runtime } from './helpers/runtime.mjs'
const app = await runtime()
let passed = 0
const scenario = async (name, fn) => { await fn(); passed++; console.log('PASS ' + name) }
const post = async (path, body, status = 201) => { const r = await app.fetch(path, { method: 'POST', headers: { origin: app.origin, 'content-type': 'application/json' }, body: JSON.stringify(body) }); const text = await r.text(); assert.equal(r.status, status, path + ' ' + text); return text ? JSON.parse(text) : null }
const get = async path => { const r = await app.fetch(path); assert.equal(r.status, 200, path); return r.json() }
const review = async name => (await get('/api/reviews')).reviews.find(r => r.name === name)
const policyTest = async () => { const t = (await get('/api/tests')).tests.find(x => x.catalogue_id === 'policy.access-control'); return (await get('/api/tests/' + t.id)).latest[0].result }
const at = async time => { await app.clock(time); await app.tick() }
const mail = (to, pattern) => app.messages.filter(m => m.to?.includes(to) && pattern.test(m.subject))
let program, policy, priya, lee
try {
 await scenario('A policy review cycle moves to semi-annual from now on, goes overdue, reminds its owner, fails the policy test, and a recorded review restores it; a one-off date moves only the current cycle', async () => {
  await app.signin()
  program = (await post('/api/programs', { framework: 'soc2', name: 'SOC 2', legal_entity: 'Northstar', report_type: 'Type II', audit_from: '2026-02-01', audit_to: '2027-01-31' })).id
  priya = (await post('/api/people', { name: 'Priya Shah', email: 'priya@northstar.test', kind: 'employee' })).id
  const draft = await post('/api/policies/templates/access-control', { program_id: program })
  const revision = await get(`/api/policies/${draft.policy}/revisions/${draft.revision}`)
  await post(`/api/policies/${draft.policy}/revisions/${draft.revision}/decision`, { decision: 'approved', body_sha256: revision.body_sha256 }, 200)
  await post(`/api/policies/${draft.policy}/revisions/${draft.revision}/publish`, { effective_date: '2026-01-15' }, 200)
  policy = draft.policy
  let r = await review('Access control policy')
  assert.deepEqual([r.cadence ?? r.schedule.cadence, r.schedule.anchor, r.last_review, r.due, r.state], ['annual', 'effective-date', '2026-01-15', '2027-01-15', 'covered'])
  await post(`/api/reviews/policy/${policy}/schedule`, { cadence: 'semi-annual', anchor: 'effective-date', owner_person_id: priya, reason: 'Customer contract requires semi-annual review' })
  r = await review('Access control policy')
  assert.deepEqual([r.schedule.cadence, r.due, r.state], ['semi-annual', '2026-07-15', 'overdue'])
  await app.tick(); await app.tick()
  assert.equal(mail('priya@northstar.test', /Review overdue: Access control policy/).length, 1)
  assert.equal(await policyTest(), 'fail')
  assert.equal((await get('/api/policies')).policies.find(p => p.id === policy).review_state, 'review overdue')
  await post(`/api/reviews/policy/${policy}/complete`, { completed_on: '2026-10-11', notes: 'Reviewed with engineering; no change' })
  await app.tick()
  r = await review('Access control policy')
  assert.deepEqual([r.last_review, r.due, r.state], ['2026-10-11', '2027-04-11', 'covered']); assert.equal(await policyTest(), 'pass')
  await post(`/api/reviews/policy/${policy}/renewal-date`, { due_date: '2027-05-01', reason: 'Align with the board meeting' })
  r = await review('Access control policy'); assert.equal(r.due, '2027-05-01'); assert.equal(r.override.reason, 'Align with the board meeting')
  await app.clock('2027-04-20T12:00:00Z')
  await post(`/api/reviews/policy/${policy}/complete`, { completed_on: '2027-04-20', notes: 'Annual access review alignment' })
  r = await review('Access control policy'); assert.deepEqual([r.due, r.override], ['2027-10-20', null])
  assert.deepEqual(r.history.map(h => [h.cadence, h.reason]), [['semi-annual', 'Customer contract requires semi-annual review']])
  await app.clock('2026-10-11T12:00:00Z')
 })
 await scenario('Vendor reviews anchor to a program audit window or a fiscal year: due soon reminds the owner once, a review covers the window, and a missed window is overdue', async () => {
  lee = (await post('/api/people', { name: 'Lee Park', email: 'lee@northstar.test', kind: 'employee' })).id
  const stripe = (await post('/api/vendors', { name: 'Stripe', owner_person_id: lee, criticality: 'critical', data_access: 'Payment data' })).id
  const slack = (await post('/api/vendors', { name: 'Slack', owner_person_id: lee, criticality: 'medium', data_access: 'Internal messages' })).id
  assert.equal((await review('Stripe')).state, 'never reviewed')
  await post(`/api/reviews/vendor/${stripe}/schedule`, { cadence: 'annual', anchor: 'audit-window', program_id: program, reason: 'Reassess within each audit period' })
  await post(`/api/reviews/vendor/${slack}/schedule`, { cadence: 'annual', anchor: 'fiscal-year', fiscal_start_month: '7', reason: 'Fiscal-year vendor cycle' })
  let r = await review('Stripe')
  assert.deepEqual([r.period.from, r.period.to, r.due, r.state], ['2026-02-01', '2027-01-31', '2027-02-01', 'due'])
  assert.deepEqual([(await review('Slack')).period.from, (await review('Slack')).period.to], ['2026-07-01', '2027-06-30'])
  await at('2026-12-01T15:00:00Z'); await at('2026-12-01T15:05:00Z')
  assert.equal((await review('Stripe')).state, 'due soon'); assert.equal(mail('lee@northstar.test', /Review due soon: Stripe/).length, 1)
  await post(`/api/reviews/vendor/${stripe}/complete`, { completed_on: '2026-12-01', notes: 'SOC 2 Type II report reviewed; no exceptions' })
  assert.equal((await review('Stripe')).state, 'covered')
  await app.clock('2027-02-02T12:00:00Z'); r = await review('Stripe')
  assert.deepEqual([r.period.from, r.state], ['2027-02-01', 'due'])
  await app.clock('2028-02-05T12:00:00Z'); assert.equal((await review('Stripe')).state, 'overdue')
 })
 console.log(`${passed} recurring review public-door scenarios passed.`)
} finally { await app.close() }
