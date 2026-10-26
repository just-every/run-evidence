import assert from 'node:assert/strict'
import { browserBridge } from './browser-bridge.mjs'
export async function credentialBrowser(app, ownerCookie, requirement, vendor) {
 const bridge = await browserBridge(app, 'credentials'), { origin, capture } = bridge
 const count = async table => (await app.db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first()).n
 try {
  for (const width of [1440, 390]) {
   const context = await bridge.context(width, ownerCookie), page = await context.newPage()
   const forms = [
    { path: '/app/folders', action: '/app/folders', table: 'review_folders', fill: async form => { await form.getByLabel('Reviewer label').fill('Cedar Ridge annual review'); await form.locator(`input[name=control_ids][value="${requirement.control_id}"]`).check(); await form.getByLabel('Covered from (UTC)', { exact: true }).fill('2026-10-01'); await form.getByLabel('Covered through (UTC)', { exact: true }).fill('2026-10-11'); await form.getByLabel('Expiry date and time (UTC)').fill('2026-11-01T12:00:00') }, secret: '#reviewer-link', screen: 'review-folder' },
    { path: '/app/agent', action: '/app/agent/tokens', table: 'agent_tokens', fill: async form => { await form.getByLabel('Agent label').fill('Quarterly review assistant'); await form.getByLabel('Expiry (UTC)', { exact: true }).fill('2026-11-01T12:00') }, secret: '[data-secret]', screen: 'agent-access' },
    { path: `/app/vendors/${vendor.id}`, action: `/app/vendors/${vendor.id}/requests`, table: 'vendor_links', fill: async form => { await form.locator('input[name=kinds]').evaluateAll(items => items.forEach(el => { el.checked = false })); await form.locator('input[name=kinds][value=soc2]').check(); await form.getByLabel('Link expires (UTC, at most 90 days)').fill('2026-11-01') }, secret: '[role=status] code', screen: 'supplier-link' },
    { path: '/app/connections', action: '/app/api-tokens', table: 'api_tokens', fill: async form => { await form.getByLabel('Name', { exact: true }).fill('Inventory readback'); await form.locator('input[name="scopes[]"][value=read]').check(); await form.getByLabel('Expires (UTC date)').fill('2026-11-01') }, secret: '[data-secret], .token-once code, .issued-token code', screen: 'api-token' },
   ]
   for (const c of forms) {
    await page.goto(origin + c.path)
    const form = page.locator(`form[action="${c.action}"]`), before = await count(c.table)
    await c.fill(form); await form.getByRole('button').click()
    await page.waitForURL(url => url.searchParams.has('issued'))
    const response = await page.request.get(page.url(), { method: 'HEAD' })
    assert.equal(response.status(), 200)
    const secret = page.locator(c.secret).first()
    await secret.waitFor()
    const value = await secret.evaluate(el => el.value ?? el.textContent)
    assert.ok(value.trim().length >= 32)
    await capture(page, c.screen + '-created', [secret])
    await page.reload()
    assert.equal(await count(c.table), before + 1)
    assert.ok(!(await page.locator('main').innerText()).includes(value.trim()))
    assert.equal(await page.locator(c.secret).count(), 0)
    await capture(page, c.screen + '-refreshed')
   }
   await context.close()
   console.log(`PASS four credential forms create once and refresh safely at ${width}`)
  }
 } finally { await bridge.close() }
}
