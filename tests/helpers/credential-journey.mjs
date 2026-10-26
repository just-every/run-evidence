import { credentialBrowser } from './credential-browser.mjs'
import assert from 'node:assert/strict'
// Native owner form submissions must navigate to a GET before showing a secret.
export async function credentialJourney(app, ownerCookie) {
 const json = async (path, body) => {
  const r = await app.fetch(path, { method: 'POST', headers: { origin: app.origin, 'content-type': 'application/json' }, body: JSON.stringify(body) })
  assert.equal(r.status, 201, path); return r.json()
 }
 const control = await app.fetch('/app/controls', { method: 'POST', headers: { origin: app.origin, 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ name: 'Quarterly access review', group: 'Access', proof: 'Signed access review', cadence: 'quarterly' }) })
 assert.equal(control.status, 303)
 const requirement = (await (await app.fetch('/api/desk')).json()).requirements.find(r => r.name === 'Signed access review')
 const vendor = await json('/api/vendors', { name: 'Northwind Claims Clearinghouse', criticality: 'high', data_access: 'Customer records', review_due: '2026-11-30' })
 const cases = [
  { path: '/app/folders', table: 'review_folders', body: { reviewer_label: 'Cedar Ridge annual review', period_from: '2026-10-01', period_to: '2026-10-11', expires_at: '2026-11-01T12:00:00Z', control_ids: requirement.control_id }, secret: /value="(http[^\"]*\/review\/[a-f0-9]{64})"/ },
  { path: '/app/agent/tokens', table: 'agent_tokens', body: { label: 'Quarterly review assistant', expires_at: '2026-11-01T12:00:00Z' }, secret: /<pre[^>]*>([a-f0-9]{64})<\/pre>/ },
  { path: `/app/vendors/${vendor.id}/requests`, table: 'vendor_links', body: { kinds: 'soc2', expires_at: '2026-11-01', due_date: '2026-10-30' }, secret: /<code[^>]*>(http[^<]*\/supplier\/[a-f0-9]{64})<\/code>/ },
  { path: '/app/api-tokens', table: 'api_tokens', body: { name: 'Inventory readback', 'scopes[]': 'read', expires_at: '2026-11-01' }, secret: /(evd_[a-f0-9]{10}_[A-Za-z0-9_-]{43})/ },
 ]
 const failures = []
 for (const c of cases) {
  try {
   const count = async () => (await app.db.prepare(`SELECT COUNT(*) AS n FROM ${c.table}`).first()).n
   const before = await count()
   const issued = await app.fetch(c.path, { method: 'POST', headers: { origin: app.origin, 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(c.body) })
   assert.equal(issued.status, 303, c.path + ' must redirect after issuance')
   const location = issued.headers.get('location'); assert.ok(location?.startsWith('/app/'))
   assert.ok(!/evd_|\/review\/|\/supplier\//.test(location), 'redirect never carries a credential')
   const foreign = await app.fetch(location, { headers: { cookie: '' } }); assert.ok([401, 303].includes(foreign.status), 'signed-out request cannot consume the secret')
   assert.equal((await app.fetch(location, { method: 'HEAD' })).status, 200)
   const first = await app.fetch(location), html = await first.text()
   assert.equal(first.status, 200); assert.ok(c.secret.test(html), c.path + ' displays the secret once')
   const secret = html.match(c.secret)[1]
   const refreshed = await app.fetch(location)
   assert.equal(refreshed.status, 200); assert.ok(!(await refreshed.text()).includes(secret), c.path + ' refresh cannot recover secret')
   assert.equal(await count(), before + 1, c.path + ' refresh never mints another credential')
   console.log('PASS credential redirect and once-only refresh: ' + c.path)
  } catch (error) { failures.push(error); console.error('FAIL ' + error.message.split('\n')[0]) }
 }
 assert.equal(failures.length, 0, 'all credential forms use a safe redirect')
 if (ownerCookie) await credentialBrowser(app, ownerCookie, requirement, vendor)
}
