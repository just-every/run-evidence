import assert from 'node:assert/strict'
import { runtime } from './runtime.mjs'
import { browserBridge } from './browser-bridge.mjs'
// Existing archive controls, with actual source bytes and a fresh destination.
export async function archiveDisplayBrowser(source) {
 const archive = await source.fetch('/api/archive/export'), journal = await source.fetch('/api/archive/journal')
 assert.equal(archive.status, 200); assert.equal(journal.status, 200)
 const bytes = Buffer.from(await archive.arrayBuffer()), history = Buffer.from(await journal.arrayBuffer())
 for (const width of [1440, 390]) {
  const target = await runtime(), cookie = await target.signin(), bridge = await browserBridge(target, 'readable-records')
  try {
   const context = await bridge.context(width, cookie), page = await context.newPage()
   await page.goto(bridge.origin + '/app/archive')
   await page.locator('#archive-file').setInputFiles({ name: 'cedar-ridge.evidence', mimeType: 'application/octet-stream', buffer: bytes })
   await page.locator('#archive-journal').setInputFiles({ name: 'erasure-journal.json', mimeType: 'application/json', buffer: history })
   await page.getByRole('button', { name: 'Run dry run', exact: true }).click()
   await page.waitForFunction(() => document.querySelector('#archive-status').textContent.includes('Dry run passed'), null, { timeout: 120000 })
   assert.ok(!(await page.locator('#archive-result').innerText()).includes('ik_d1_'))
   assert.ok(await page.locator('#archive-result dt').count() > 0)
   await bridge.capture(page, 'archive-dry-run')
   await page.getByRole('button', { name: 'Confirm restore', exact: true }).click()
   await page.waitForFunction(() => document.querySelector('#archive-status').textContent.includes('Restore complete'), null, { timeout: 120000 })
   assert.ok(!(await page.locator('#archive-result').innerText()).includes('"counts"'))
   const sourceReceipts = (await source.db.prepare('SELECT COUNT(*) AS n FROM receipts').first()).n
   assert.equal((await target.db.prepare('SELECT COUNT(*) AS n FROM receipts').first()).n, sourceReceipts)
   await bridge.capture(page, 'archive-restored')
   await context.close()
  } finally { await bridge.close(); await target.close() }
 }
}
