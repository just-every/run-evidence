// Labelled CSV populations and Inventory through the owner's doors: dry runs,
// whole-or-nothing admission, reviewable matches, differences between lists,
// staleness and custody of the original file. Only mail is faked.
process.env.RER_SERVER_JOURNEY = '1'
import assert from 'node:assert/strict'
import { runtime } from './helpers/runtime.mjs'
const app = await runtime()
let passed = 0
const scenario = async (name, fn) => { await fn(); passed++; console.log('PASS ' + name) }
const post = async (path, body, status = 201) => { const r = await app.fetch(path, { method: 'POST', headers: { origin: app.origin, 'content-type': 'application/json' }, body: JSON.stringify(body) }); const text = await r.text(); assert.equal(r.status, status, path + ' ' + text); return text ? JSON.parse(text) : null }
const get = async path => { const r = await app.fetch(path); assert.equal(r.status, 200, path); return r.json() }
async function upload(fields, csv, status) {
 const form = new FormData()
 for (const [k, v] of Object.entries(fields)) form.append(k, v)
 form.append('file', new Blob([csv], { type: 'text/csv' }), fields.filename ?? 'list.csv')
 const r = await app.fetch('/api/populations', { method: 'POST', headers: { origin: app.origin }, body: form })
 const text = await r.text(); if (status) assert.equal(r.status, status, text)
 return { status: r.status, body: JSON.parse(text) }
}
const roster = rows => 'Work Email,Full Name,Employment Type,Start Date,Termination Date\r\n' + rows.map(r => r.join(',')).join('\r\n') + '\r\n'
const rosterFields = { kind: 'roster', source_system: 'Justworks', as_of: '2026-10-10', refresh_days: '30', map_email: 'Work Email', map_name: 'Full Name', filename: 'justworks.csv' }
const people = {}
let first
try {
 await scenario('A roster and an app account list are checked row by row and admitted whole; a renamed column is mapped, an ambiguous match is resolved and an unmatched row stays visible, all labelled manual', async () => {
  await app.signin()
  for (const [k, name, email] of [['ana', 'Ana Ruiz', 'ana@northstar.test'], ['sam1', 'Sam Lee', 'sam.lee@northstar.test'], ['sam2', 'Sam Lee', 'samuel.lee@northstar.test'], ['ben', 'Ben Ode', 'ben@northstar.test']]) people[k] = (await post('/api/people', { name, email, kind: 'employee' })).id
  const bad = roster([['ana@northstar.test', 'Ana Ruiz', 'W-2', '2024-01-02', ''], ['not-an-email', 'Pat', 'W-2', '2024-01-02', ''], ['ana@northstar.test', 'Ana Again', '1099', '2025-13-40', ''], ['', '', '', '', '']])
  const dry = (await upload(rosterFields, bad, 200)).body
  assert.equal(dry.dry_run, true); assert.equal(dry.refuse, 2); assert.equal(dry.admit, 1)
  assert.match(dry.rows.find(r => r.row === 3).reasons.join(), /email "not-an-email" is not an email address/)
  assert.match(dry.rows.find(r => r.row === 4).reasons.join(), /repeats an earlier row/); assert.match(dry.rows.find(r => r.row === 4).reasons.join(), /start_date "2025-13-40" is not a date/)
  const refused = await upload({ ...rosterFields, confirm: 'yes', sha256: dry.sha256 }, bad, 400)
  assert.ok(refused.body.details.some(d => /row 3: email/.test(d)))
  assert.equal((await get('/api/populations')).uploads.length, 0)
  const good = roster([['ana@northstar.test', 'Ana Ruiz', 'W-2', '2024-01-02', ''], ['ben@northstar.test', 'Ben Ode', 'W-2', '2023-05-01', ''], ['dee@northstar.test', 'Dee Lane', '1099', '2025-02-01', '']])
  const checked = (await upload(rosterFields, good, 200)).body
  assert.equal(checked.refuse, 0); assert.equal(checked.mapping.email, 'Work Email'); assert.equal(checked.mapping.employment_type, 'Employment Type')
  first = (await upload({ ...rosterFields, confirm: 'yes', sha256: checked.sha256 }, good, 201)).body
  await upload({ ...rosterFields, confirm: 'yes', sha256: 'a'.repeat(64) }, good, 409)
  const accounts = 'account_id,name,role,status,email\r\nU1,Sam Lee,admin,active,\r\nU2,Zed Unknown,member,active,\r\nU3,Ana Ruiz,member,active,ana@northstar.test\r\n'
  const accountFields = { kind: 'accounts', source_system: 'Figma', as_of: '2026-10-09', refresh_days: '90', filename: 'figma-users.csv' }
  const dryAccounts = (await upload(accountFields, accounts, 200)).body
  const figma = (await upload({ ...accountFields, confirm: 'yes', sha256: dryAccounts.sha256 }, accounts, 201)).body
  const rows = (await get('/api/populations/' + figma.id)).rows
  const sam = rows.find(r => r.row_key === 'u1'), zed = rows.find(r => r.row_key === 'u2'), ana = rows.find(r => r.row_key === 'u3')
  assert.equal(sam.match.state, 'ambiguous'); assert.deepEqual(sam.match.candidates.sort(), [people.sam1, people.sam2].sort())
  assert.equal(zed.match, null); assert.deepEqual([ana.match.state, ana.match.person_id, ana.match.basis], ['proposed', people.ana, 'same email'])
  await post(`/api/populations/rows/${sam.id}/match`, { decision: 'approved', person_id: people.sam1 }, 200)
  await post(`/api/populations/rows/${ana.id}/match`, { decision: 'approved' }, 200)
  const rosterAna = (await get('/api/populations/' + first.id)).rows.find(r => r.row_key === 'ana@northstar.test')
  await post(`/api/populations/rows/${rosterAna.id}/match`, { decision: 'approved' }, 200)
  const inventory = await get('/api/inventory')
  const manualAccounts = inventory.accounts.filter(a => a.provenance === 'manually-asserted')
  assert.equal(manualAccounts.length, 3); assert.ok(manualAccounts.every(a => a.tests === 'unknown: needs a source read' && a.source === 'Figma' && a.observed))
  assert.equal(manualAccounts.find(a => a.key === 'u1').person, 'Sam Lee'); assert.equal(manualAccounts.find(a => a.key === 'u2').person, null)
  assert.equal(inventory.unmatched.accounts, 1)
  assert.deepEqual(inventory.people.find(p => p.email === 'ana@northstar.test').manual.map(m => m.replace(/uploaded .*\)/, 'uploaded)')).sort(), ['Figma accounts (manual, uploaded)', 'Justworks roster (manual, uploaded)'])
  const listed = (await get('/api/populations')).uploads
  assert.ok(listed.every(u => u.provenance === 'manually-asserted' && u.state === 'current'))
  const file = await app.fetch(`/app/populations/${first.id}/file`)
  assert.equal(file.status, 200); assert.equal(await file.text(), good)
  assert.match(await (await app.fetch('/app/inventory')).text(), /needs a source read/)
 })
 await scenario('A revised roster keeps the original file and shows joiners, leavers and removed rows; past its refresh window a population is stale', async () => {
  const revised = roster([['ana@northstar.test', 'Ana Ruiz', 'W-2', '2024-01-02', ''], ['ben@northstar.test', 'Ben Ode', 'W-2', '2023-05-01', '2026-10-20'], ['cy@northstar.test', 'Cy Park', 'W-2', '2026-10-21', '']])
  const fields = { ...rosterFields, as_of: '2026-10-22', filename: 'justworks-oct22.csv' }
  const dry = (await upload(fields, revised, 200)).body
  const second = (await upload({ ...fields, confirm: 'yes', sha256: dry.sha256 }, revised, 201)).body
  const detail = await get('/api/populations/' + second.id)
  assert.deepEqual(detail.differences, { joiners: ['cy@northstar.test'], removed: ['dee@northstar.test'], leavers: ['ben@northstar.test'] })
  assert.equal(detail.upload.previous_id, first.id)
  assert.equal((await app.fetch(`/app/populations/${first.id}/file`)).status, 200)
  await app.clock('2026-11-15T12:00:00Z')
  const states = Object.fromEntries((await get('/api/populations')).uploads.map(u => [u.id, u.state]))
  assert.equal(states[first.id], 'stale'); assert.equal(states[second.id], 'current')
  await app.clock('2026-12-01T12:00:00Z')
  assert.equal((await get('/api/populations')).uploads.find(u => u.id === second.id).state, 'stale')
 })
 console.log(`${passed} population public-door scenarios passed.`)
} finally { await app.close() }
