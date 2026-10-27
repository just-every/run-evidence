// SECURE-001 through the production HTTP handler: restricted records with
// need-to-know grants and explicit publication, hostile attachments, key custody
// with rotation and unavailable-key refusals, declared outbound model flows, and
// secret exclusion from every export. Only the model provider is faked, at the
// network edge.
import assert from 'node:assert/strict'
import { runtime } from './helpers/runtime.mjs'
const MODEL_KEY = 'synthetic-evidence-model-key-0001', NEXT_KEY = 'synthetic-evidence-model-key-0002'
const SECOND_CUSTODY = 'synthetic-evidence-custody-secret-0123456789abcdef'
let app, passed = 0, owner, manager, seen = []
const scenario = async (name, run) => { await run(); passed++; console.log('PASS ' + name) }
const json = { 'content-type': 'application/json' }, cookieOf = r => r.headers.getSetCookie().map(x => x.split(';')[0]).join('; ')
const call = (cookie, path, body, headers = {}) => app.fetch(path, body === undefined ? { headers: { cookie, ...headers } } : { method: 'POST', headers: { cookie, origin: app.origin, ...json, ...headers }, body: JSON.stringify(body) })
const provider = async request => {
 if (request.url !== 'https://api.anthropic.com/v1/messages') return null
 const body = await request.json(); seen.push({ key: request.headers.get('x-api-key'), body })
 return Response.json({ content: [{ type: 'text', text: 'ok' }] })
}
const signinAs = async (email, name) => {
 assert.equal((await call(owner, '/api/roles/invitations', { email, display_name: name })).status, 202)
 const link = new URL(app.messages.at(-1).html.match(/href="([^"]*\/auth\/confirm\?token=[^"]+)"/)[1].replaceAll('&amp;', '&'), app.origin)
 const confirmed = await app.fetch('/auth/confirm', { method: 'POST', headers: { cookie: '', origin: app.origin, ...json }, body: JSON.stringify({ token: link.searchParams.get('token') }) })
 assert.equal(confirmed.status, 303); return cookieOf(confirmed)
}
const upload = async (cookie, requirement, fields, bytes, filename, type = 'text/plain') => {
 const f = new FormData(); for (const [k, v] of Object.entries({ source: 'Manual source', covered_from: '2026-10-10', covered_to: '2026-10-10', ...fields })) f.set(k, v)
 f.set('file', new File([bytes], filename, { type }))
 const r = await app.fetch(`/app/requirements/${requirement}/uploads`, { method: 'POST', headers: { cookie, origin: app.origin }, body: f })
 assert.equal(r.status, 303); return r.headers.get('location').split('/').at(-1)
}
app = await runtime({ outbound: provider })
try {
 owner = await app.signin()
 const made = await app.fetch('/app/controls', { method: 'POST', headers: { cookie: owner, origin: app.origin, 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ name: 'Personnel files', proof: 'Review record', group: 'People', cadence: 'daily' }) })
 const requirement = made.headers.get('location').split('/').at(-1), desk = (await (await call(owner, '/api/desk')).json()).requirements.find(r => r.id === requirement)
 manager = await signinAs('manager@example.test', 'Maya Manager')
 assert.equal((await call(owner, '/api/roles/grants', { email: 'manager@example.test', role: 'compliance_manager', scope_kind: 'business', reason: 'Runs the program' })).status, 201)
 let hostile, sensitive
 await scenario('Hostile HTML and SVG download only as inert attachments, and a sensitive employee document stays private, opens to a need-to-know grant and fails the next read once revoked', async () => {
  for (const [name, bytes, type] of [['page.html', '<script>window.hostile=true</script>', 'text/html'], ['image.svg', '<svg onload="alert(1)"></svg>', 'image/svg+xml']]) {
   const id = await upload(owner, requirement, {}, bytes, name, type), response = await app.fetch(`/app/receipts/${id}/download`, { headers: { cookie: owner } })
   assert.equal(response.status, 200); assert.equal(response.headers.get('content-type'), 'application/octet-stream')
   assert.match(response.headers.get('content-disposition'), /^attachment/); assert.match(response.headers.get('content-security-policy'), /sandbox/); assert.equal(response.headers.get('x-content-type-options'), 'nosniff')
   assert.equal(await response.text(), bytes); hostile = id
  }
  sensitive = await upload(owner, requirement, { sensitivity: 'sensitive', sensitivity_reason: 'Employee performance review' }, 'Performance review: confidential', 'review-jordan.txt')
  assert.deepEqual((await (await call(owner, `/api/receipts/${sensitive}/restricted`)).json()).sensitive.reason, 'Employee performance review')
  // The manager runs the program but is not a need-to-know holder: the record is absent and every door refuses.
  const rows = (await (await call(manager, '/api/desk')).json()).requirements.find(r => r.id === requirement).receipts.map(r => r.id)
  assert.ok(rows.includes(hostile) && !rows.includes(sensitive), 'the sensitive record is not listed for a manager')
  for (const path of [`/api/receipts/${sensitive}`, `/app/receipts/${sensitive}`, `/app/receipts/${sensitive}/download`]) assert.equal((await call(manager, path)).status, 403, path)
  assert.equal((await call(manager, `/api/receipts/${sensitive}/grants`, { email: 'manager@example.test', reason: 'x' })).status, 403, 'a manager cannot grant themselves access')
  assert.equal((await call(manager, `/api/receipts/${sensitive}/publication`, { reason: 'x' })).status, 403, 'a manager cannot publish')
  const trail = await (await call(owner, '/api/audit')).text()
  assert.ok(trail.includes('record.read-refused'), 'the refusal is audited')
  const events = (await (await call(owner, '/api/connections/flows')).json()).disclosures
  assert.ok(events.some(e => e.kind === 'unauthorized-read' && e.subject === 'receipt:' + sensitive), 'a suspected disclosure is recorded')
  assert.equal((await call(owner, `/app/receipts/${sensitive}/download`)).status, 200)
  assert.ok((await (await call(owner, '/api/audit')).text()).includes('record.read'), 'the owner read is audited')
  const granted = await (await call(owner, `/api/receipts/${sensitive}/grants`, { email: 'manager@example.test', reason: 'Investigating the review' })).json()
  assert.equal((await call(manager, `/app/receipts/${sensitive}/download`)).status, 200)
  assert.equal((await call(manager, `/api/receipts/${sensitive}`)).status, 200)
  assert.equal((await call(owner, `/api/receipts/${sensitive}/grants/${granted.id}/revoke`, {})).status, 200)
  assert.equal((await call(manager, `/app/receipts/${sensitive}/download`)).status, 403)
  assert.equal((await call(manager, `/api/receipts/${sensitive}`)).status, 403)
 })
 await scenario('A sensitive record reaches a reviewer only after explicit publication, and withdrawal removes it again', async () => {
  const issued = await (await call(owner, '/api/folders', { reviewer_label: 'Independent reviewer', period_from: '2026-10-10', period_to: '2026-10-11', expires_at: '2026-10-20T12:00:00Z', control_ids: [desk.control_id] })).json()
  const door = new URL(issued.review_url).pathname, viewer = path => app.fetch(path, { headers: { cookie: '', 'sec-fetch-site': 'cross-site' } })
  const listing = async () => (await (await viewer(door + '/exhibits')).json()).requirements[0].receipts.map(r => r.id)
  assert.ok(!(await listing()).includes(sensitive), 'unpublished sensitive record is withheld')
  for (const suffix of ['', '/view', '/download']) assert.equal((await viewer(`${door}/receipts/${sensitive}${suffix}`)).status, 404)
  assert.ok((await (await call(owner, '/api/connections/flows')).json()).disclosures.some(e => e.kind === 'unpublished-record-request'), 'the attempt is a suspected disclosure')
  assert.equal((await call(owner, `/api/receipts/${sensitive}/publication`, { reason: 'Auditor sampled this review' })).status, 201)
  assert.ok((await listing()).includes(sensitive)); assert.equal((await viewer(`${door}/receipts/${sensitive}/download`)).status, 200)
  assert.equal((await call(owner, `/api/receipts/${sensitive}/publication/revoke`, {})).status, 200)
  assert.ok(!(await listing()).includes(sensitive)); assert.equal((await viewer(`${door}/receipts/${sensitive}/download`)).status, 404)
 })
 await scenario('A model flow is enabled only after its exact declaration is reviewed; its key is sealed, rotated and never exported, and custody rotates and fails explicitly when its key is gone', async () => {
  const declaration = { provider: 'anthropic', model: 'synthetic-model', purpose: 'policy-tailoring', data_classes: ['policy text', 'customer contract text'], retention: 'No retention beyond 30 days', region: 'us', account: 'org-synthetic-1', api_key: MODEL_KEY }
  assert.equal((await call(owner, '/api/connections/flows', { ...declaration, data_classes: ['exhibit files'] })).status, 400, 'only the listed data classes can be declared')
  assert.equal((await call(manager, '/api/connections/flows', declaration)).status, 403)
  const declared = await (await call(owner, '/api/connections/flows', declaration)).json()
  assert.equal(declared.status, 'declared')
  const stored = await app.db.prepare('SELECT * FROM flow_declarations WHERE id=?').bind(declared.id).first()
  assert.ok(!JSON.stringify(stored).includes(MODEL_KEY), 'the key is stored only as ciphertext')
  assert.equal((await call(owner, `/api/connections/flows/${declared.id}/enable`, { declaration_sha256: 'wrong' })).status, 409)
  assert.equal((await call(owner, `/api/connections/flows/${declared.id}/enable`, { declaration_sha256: declared.declaration_sha256 })).status, 200)
  assert.equal((await call(owner, `/api/connections/flows/${declared.id}/key`, { api_key: NEXT_KEY })).status, 200)
  const after = await app.db.prepare('SELECT secret_ciphertext FROM flow_declarations WHERE id=?').bind(declared.id).first()
  assert.notEqual(after.secret_ciphertext, stored.secret_ciphertext)
  // No export or log carries either key.
  const surfaces = [await (await call(owner, '/api/connections/flows')).text(), await (await call(owner, '/api/audit')).text(), await (await call(owner, '/api/archive/export')).text()]
  for (const text of surfaces) for (const secret of [MODEL_KEY, NEXT_KEY]) assert.ok(!text.includes(secret))
  globalThis.flow = declared
  // The installation restarts with a second custody key as the current one; the owner's session carries on.
  await app.setSettings({ CUSTODY_KEYS: JSON.stringify({ k2: SECOND_CUSTODY }), CUSTODY_CURRENT: 'k2' })
  let status = (await (await call(owner, '/api/connections/flows')).json()).custody
  assert.deepEqual(status.sealed_by_key, { session: 1 }); assert.equal(status.current, 'k2')
  const rotated = await (await call(owner, '/api/connections/custody/rotate', {})).json()
  assert.equal(rotated.resealed, 1); assert.deepEqual(rotated.unrecoverable, [])
  status = (await (await call(owner, '/api/connections/flows')).json()).custody; assert.deepEqual(status.sealed_by_key, { k2: 1 })
  assert.ok((await (await call(owner, '/api/audit')).text()).includes('custody.rotated'))
  // The custody key goes missing: the credential cannot be opened and nothing falls back to another key.
  await app.setSettings({ CUSTODY_KEYS: undefined, CUSTODY_CURRENT: undefined, CUSTODY_SESSION_KEY_RETIRED: 'yes' })
  assert.deepEqual((await (await call(owner, '/api/connections/flows')).json()).custody.unavailable, ['k2'])
  assert.equal((await call(owner, `/api/connections/flows/${globalThis.flow.id}/disable`, {})).status, 200)
  const blocked = await call(owner, `/api/connections/flows/${globalThis.flow.id}/enable`, { declaration_sha256: globalThis.flow.declaration_sha256 })
  assert.equal(blocked.status, 409); assert.match((await blocked.json()).error, /custody is unavailable/)
  // Restoring the key recovers it.
  await app.setSettings({ CUSTODY_KEYS: JSON.stringify({ k2: SECOND_CUSTODY }), CUSTODY_CURRENT: 'k2', CUSTODY_SESSION_KEY_RETIRED: undefined })
  assert.equal((await call(owner, `/api/connections/flows/${globalThis.flow.id}/enable`, { declaration_sha256: globalThis.flow.declaration_sha256 })).status, 200)
 })
 console.log(`${passed} public-door scenarios passed; real workerd, D1 and R2; the model provider is faked at the network edge.`)
} finally { await app.close().catch(() => undefined) }
