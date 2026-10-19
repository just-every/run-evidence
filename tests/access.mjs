// ACCESS-001 access-review campaigns through public doors: the owner's JSON
// doors, Base invitations and member sign-in for resource owners, the employee
// door, the population upload door, the receipt door and the Cron Trigger.
// Okta and mail are the only fakes, at the network edge.
process.env.RER_SERVER_JOURNEY = '1'
import assert from 'node:assert/strict'
import { createHash, randomBytes } from 'node:crypto'
import { runtime } from './helpers/runtime.mjs'
const TOKEN = randomBytes(20).toString('hex')
const okta = [
 { id: 'o1', email: 'rita@northstar.test', first: 'Rita', type: '', status: 'ACTIVE', admin: true },
 { id: 'o2', email: 'ana@northstar.test', first: 'Ana', type: '', status: 'ACTIVE', admin: false },
 { id: 'o3', email: 'partner@vendor.test', first: 'Partner', type: 'Guest', status: 'ACTIVE', admin: false },
 { id: 'o4', email: 'deploy@northstar.test', first: 'Deploy', type: 'Service', status: 'ACTIVE', admin: true },
]
async function fakeOkta(request) {
 const url = new URL(request.url)
 if (url.hostname !== 'northstar.okta.com') return null
 if (request.headers.get('authorization') !== 'SSWS ' + TOKEN) return Response.json({}, { status: 401 })
 if (url.pathname === '/api/v1/org') return Response.json({ companyName: 'Northstar' })
 if (url.pathname === '/api/v1/users') return Response.json(okta.map(u => ({ id: u.id, status: u.status, created: '2025-01-01T00:00:00.000Z', lastLogin: '2026-10-01T00:00:00.000Z', profile: { firstName: u.first, lastName: '', email: u.email, login: u.email, userType: u.type } })))
 if (url.pathname === '/api/v1/iam/assignees/users') return Response.json({ value: okta.filter(u => u.admin).map(u => ({ id: u.id })) })
 if (/\/groups$/.test(url.pathname)) return Response.json([{ id: 'g', profile: { name: 'Everyone' } }])
 if (/\/factors$/.test(url.pathname)) return Response.json([{ status: 'ACTIVE' }])
 return null
}
const app = await runtime({ outbound: fakeOkta })
let passed = 0
const scenario = async (name, fn) => { await fn(); passed++; console.log('PASS ' + name) }
const post = async (path, body, status = 201) => { const r = await app.fetch(path, { method: 'POST', headers: { origin: app.origin, 'content-type': 'application/json' }, body: JSON.stringify(body) }); const text = await r.text(); assert.equal(r.status, status, path + ' ' + text); return text ? JSON.parse(text) : null }
const get = async (path, status = 200) => { const r = await app.fetch(path); assert.equal(r.status, status, path); return status === 200 ? r.json() : null }
async function upload(csv, asOf) {
 const send = async extra => { const form = new FormData(); for (const [k, v] of Object.entries({ kind: 'accounts', source_system: 'Figma', as_of: asOf, refresh_days: '90', ...extra })) form.append(k, v); form.append('file', new Blob([csv], { type: 'text/csv' }), 'figma.csv'); return (await app.fetch('/api/populations', { method: 'POST', headers: { origin: app.origin }, body: form })).json() }
 const dry = await send({}); return send({ confirm: 'yes', sha256: dry.sha256 })
}
async function acceptInvitation(email) {
 const mail = app.messages.filter(m => m.to?.includes(email)).at(-1)
 const token = new URL(mail.html.match(/href="([^"]*\/auth\/confirm\?token=[^"]+)"/)[1].replaceAll('&amp;', '&'), app.origin).searchParams.get('token')
 app.setCookie('')
 const confirmed = await app.fetch('/auth/confirm', { method: 'POST', headers: { origin: app.origin, 'content-type': 'application/json' }, body: JSON.stringify({ token }) })
 assert.equal(confirmed.status, 303)
 return confirmed.headers.getSetCookie().map(x => x.split(';')[0]).join('; ')
}
const as = async (cookie, fn) => { app.setCookie(cookie); try { return await fn() } finally { app.setCookie(cookies.owner) } }
const cookies = {}, people = {}
let review, connection
const item = (list, key) => list.find(i => i.account_key === key)
try {
 await scenario('ACCESS-001: a quarterly campaign freezes directory and uploaded populations; resource owners decide with reasons in their own sign-in, never about their own access, and a delegation is explicit', async () => {
  cookies.owner = await app.signin()
  for (const [k, name, kind] of [['rita', 'Rita Gomez', 'employee'], ['omar', 'Omar Haddad', 'employee'], ['ana', 'Ana Ruiz', 'employee'], ['former', 'Fran Former', 'employee']]) people[k] = (await post('/api/people', { name, email: k + '@northstar.test', kind })).id
  await post(`/api/people/${people.former}/depart`, { reason: 'Left the company on 30 September' }, 200)
  connection = await post('/api/connections', { provider: 'okta', domain: 'northstar.okta.com', secret: TOKEN })
  await app.tick()
  await upload('account_id,name,email,role,status\r\nU1,Ana Ruiz,ana@northstar.test,editor,active\r\nU2,Fran Former,former@northstar.test,admin,active\r\nU3,Omar Haddad,omar@northstar.test,owner,active\r\nU4,Gus Contractor,gus@contractor.test,editor,active\r\n', '2026-10-10')
  for (const k of ['rita', 'omar']) await post(`/api/people/${people[k]}/invite`, {}, 202)
  cookies.rita = await acceptInvitation('rita@northstar.test'); cookies.omar = await acceptInvitation('omar@northstar.test'); app.setCookie(cookies.owner)
  const available = (await get('/api/access-reviews')).sources
  assert.deepEqual(available.map(s => s.provenance), ['source-observed', 'manually-asserted'])
  review = await post('/api/access-reviews', { name: 'Q4 access review', cadence: 'quarterly', period_from: '2026-10-01', period_to: '2026-12-31', due_date: '2026-10-20', sources: available.map(s => s.key), [`reviewer_${available[0].key}`]: people.rita, [`reviewer_${available[1].key}`]: people.omar })
  assert.equal(review.items, 8)
  let list = (await get('/api/access-reviews/' + review.id)).items
  assert.equal(item(list, 'u2').provenance, 'manually-asserted'); assert.equal(item(list, 'ana@northstar.test').provenance, 'source-observed')
  // The uploaded list is reconciled to People: the departed person's account says so; an unknown contractor has no match.
  assert.deepEqual([item(list, 'u2').person.name, item(list, 'u2').person.departed_at?.slice(0, 10), item(list, 'u4').person], ['Fran Former', '2026-10-11', null])
  assert.equal(item(list, 'u1').person.name, 'Ana Ruiz')
  const rita = await as(cookies.rita, () => get('/api/me'))
  assert.equal(rita.access.length, 4); assert.ok(rita.access.find(i => i.display_name.startsWith('Rita')).own)
  await as(cookies.rita, () => post(`/api/me/access/${item(list, 'rita@northstar.test').id}`, { decision: 'retain', reason: 'Mine' }, 403))
  await as(cookies.omar, () => post(`/api/me/access/${item(list, 'ana@northstar.test').id}`, { decision: 'retain', reason: 'Not mine to decide' }, 404))
  await post(`/api/access-reviews/items/${item(list, 'rita@northstar.test').id}/delegate`, { person_id: people.omar, reason: 'Reviewer cannot review their own admin access' }, 200)
  await as(cookies.rita, async () => {
   await post(`/api/me/access/${item(list, 'ana@northstar.test').id}`, { decision: 'retain', reason: 'Active engineer on billing' }, 200)
   await post(`/api/me/access/${item(list, 'partner@vendor.test').id}`, { decision: 'revoke', reason: 'Vendor contract ended in September' }, 200)
   await post(`/api/me/access/${item(list, 'deploy@northstar.test').id}`, { decision: 'change', reason: 'Service account needs read-only, not admin' }, 200)
  })
  await as(cookies.omar, async () => {
   await post(`/api/me/access/${item(list, 'u2').id}`, { decision: 'revoke', reason: 'Left the company on 30 September' }, 200)
   await post(`/api/me/access/${item(list, 'u4').id}`, { decision: 'revoke', reason: 'Contract ended' }, 200)
   await post(`/api/me/access/${item(list, 'u1').id}`, { decision: 'retain', reason: 'Designer' }, 200)
   await post(`/api/me/access/${item(list, 'u3').id}`, { decision: 'retain', reason: 'Mine' }, 403)
  })
  await post(`/api/access-reviews/items/${item(list, 'u3').id}/exclude`, { reason: 'Workspace owner account, reviewed by the CFO separately' }, 200)
  list = (await get('/api/access-reviews/' + review.id)).items
  assert.equal(item(list, 'rita@northstar.test').delegated_to, 'Omar Haddad'); assert.equal(item(list, 'u3').decision.decision, 'excluded')
  assert.deepEqual([item(list, 'partner@vendor.test').revocation.state, item(list, 'u2').revocation.state], ['requested', 'requested'])
 })
 await scenario('ACCESS-001: revocation closes only on evidence: an active account stays unresolved past the due date, a fresh read or a re-uploaded list verifies it, overdue decisions remind, and late accounts join as supplemental work', async () => {
  await app.clock('2026-10-21T15:00:00Z'); await app.tick()
  let summary = await get('/api/access-reviews/' + review.id)
  assert.equal(item(summary.items, 'partner@vendor.test').revocation.state, 'unresolved'); assert.equal(summary.summary.overdue, 1)
  assert.equal(app.messages.filter(m => m.to.includes('omar@northstar.test') && /Overdue: 1 access decisions in Q4 access review/.test(m.subject)).length, 1)
  okta.find(u => u.id === 'o3').status = 'SUSPENDED'
  okta.push({ id: 'o5', email: 'newbie@northstar.test', first: 'Newbie', type: '', status: 'ACTIVE', admin: false })
  await upload('account_id,name,email,role,status\r\nU1,Ana Ruiz,ana@northstar.test,editor,active\r\nU3,Omar Haddad,omar@northstar.test,owner,active\r\nU4,Gus Contractor,gus@contractor.test,editor,active\r\n', '2026-10-21')
  await app.clock('2026-10-21T16:05:00Z'); await app.tick()
  summary = await get('/api/access-reviews/' + review.id)
  assert.equal(item(summary.items, 'partner@vendor.test').revocation.state, 'verified'); assert.match(item(summary.items, 'partner@vendor.test').revocation.evidence, /shows the account suspended/)
  assert.equal(item(summary.items, 'u2').revocation.state, 'verified'); assert.match(item(summary.items, 'u2').revocation.evidence, /no longer lists the account/)
  assert.equal((await get('/api/populations')).uploads.filter(u => u.source_system === 'Figma').length, 2)
  const late = item(summary.items, 'newbie@northstar.test')
  assert.ok(late.supplemental); assert.equal(late.reviewer, 'Rita Gomez')
 })
 await scenario('ACCESS-001: an app without a connector evidences a revocation with an attached exhibit kept as an immutable receipt on the adopted AC-04 requirement; a decision alone, a still-listed account or a directory account never closes that way', async () => {
  let list = (await get('/api/access-reviews/' + review.id)).items
  assert.equal(item(list, 'u4').revocation.state, 'unresolved')
  const exhibit = Buffer.from('Figma admin console: gus@contractor.test removed 2026-10-21 16:20 UTC')
  const attach = async (key, status, note = 'Admin console shows the account removed') => { const form = new FormData(); form.append('note', note); form.append('file', new Blob([exhibit], { type: 'text/plain' }), 'figma-removal.txt'); const r = await app.fetch(`/api/access-reviews/items/${item(list, key).id}/revocation-exhibit`, { method: 'POST', headers: { origin: app.origin }, body: form }); const text = await r.text(); assert.equal(r.status, status, text); return JSON.parse(text) }
  assert.match((await attach('partner@vendor.test', 409)).error, /fresh source read/)
  assert.match((await attach('u1', 409)).error, /Only a revoke decision/)
  await as(cookies.omar, async () => assert.ok((await app.fetch(`/api/access-reviews/items/${item(list, 'u4').id}/revocation-exhibit`, { method: 'POST', headers: { origin: app.origin }, body: new FormData() })).status >= 400))
  const attached = await attach('u4', 201)
  assert.equal(attached.sha256, createHash('sha256').update(exhibit).digest('hex'))
  list = (await get('/api/access-reviews/' + review.id)).items
  const revocation = item(list, 'u4').revocation
  assert.equal(revocation.state, 'verified'); assert.equal(revocation.receipt_id, attached.receipt); assert.match(revocation.evidence, /figma-removal\.txt.*attached by .*Admin console shows the account removed/)
  const receipt = await get('/api/receipts/' + attached.receipt)
  assert.deepEqual([receipt.sha256, receipt.origin, receipt.covered_from, receipt.covered_to], [attached.sha256, 'manually-asserted', '2026-10-01', '2026-12-31'])
  assert.equal(Buffer.from(await (await app.fetch(`/api/receipts/${attached.receipt}/download`)).arrayBuffer()).toString(), exhibit.toString())
  assert.match((await attach('u4', 409)).error, /already evidenced/)
  const page = await (await app.fetch('/app/access-reviews/' + review.id)).text()
  assert.match(page, /Fran Former \(proposed match\) · left 2026-10-11/); assert.match(page, new RegExp(`/app/receipts/${attached.receipt}`))
 })
 await scenario('ACCESS-001: the export carries the frozen population, every decision and the revocation evidence, and a quarterly campaign starts its next period', async () => {
  const exported = await get(`/api/access-reviews/${review.id}/export`)
  assert.equal(exported.population.length, 9); assert.ok(exported.population.some(i => i.provenance === 'manually-asserted'))
  assert.ok(exported.decisions.some(d => d.decision === 'revoke' && /Vendor contract ended/.test(d.reason) && d.by === 'Rita Gomez'))
  const csv = await (await app.fetch(`/app/access-reviews/${review.id}/export.csv`)).text()
  assert.equal(csv.trim().split('\r\n').length, 10); assert.match(csv, /Re-uploaded list/); assert.match(csv, /kept as receipt/)
  assert.ok(exported.population.find(i => i.account_key === 'u2').person.departed_at)
  const sources = (await get('/api/access-reviews')).sources
  await post('/api/access-reviews', { name: 'Bad custom', cadence: 'custom', every_months: '25', period_from: '2026-10-01', period_to: '2026-11-30', due_date: '2026-12-04', sources: [sources[1].key], [`reviewer_${sources[1].key}`]: people.omar }, 400)
  const custom = await post('/api/access-reviews', { name: 'Privileged accounts', cadence: 'custom', every_months: '2', period_from: '2026-10-01', period_to: '2026-11-30', due_date: '2026-12-04', sources: [sources[1].key], [`reviewer_${sources[1].key}`]: people.omar })
  assert.equal((await get('/api/access-reviews/' + custom.id)).review.cadence, 'every-2-months')
  await app.clock('2027-01-02T15:00:00Z'); await app.tick()
  const reviews = (await get('/api/access-reviews')).reviews, next = reviews.find(r => r.previous_id === review.id), nextCustom = reviews.find(r => r.previous_id === custom.id)
  assert.deepEqual([next.period_from, next.period_to, next.due_date], ['2027-01-01', '2027-03-31', '2027-01-20'])
  // Owner-configured: every 2 months, the period ends the day before the shifted day after it ended.
  assert.deepEqual([nextCustom.cadence, nextCustom.period_from, nextCustom.period_to, nextCustom.due_date], ['every-2-months', '2026-12-01', '2027-01-31', '2027-02-04'])
 })
 console.log(`${passed} access review public-door scenarios passed with Base invitations and member sign-in.`)
} finally { await app.close() }
