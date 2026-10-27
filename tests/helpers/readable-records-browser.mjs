import { moveInAndPrepare } from './move-in-browser.mjs'
import { archiveDisplayBrowser } from './archive-display-browser.mjs'
import assert from 'node:assert/strict'
import { browserBridge } from './browser-bridge.mjs'
export async function readableRecordsBrowser(app, ownerCookie, paths) {
 const bridge = await browserBridge(app, 'readable-records')
 try {
  for (const width of [1440, 390]) {
   const owner = await bridge.context(width, ownerCookie), viewer = await bridge.context(width)
   const ownerPage = await owner.newPage(), viewerPage = await viewer.newPage()
   const screens = [
    [ownerPage, paths.document, 'auditor-document'],
    [ownerPage, paths.receipt, 'owner-receipt'],
    [ownerPage, '/app/folders/events', 'folder-access-log'],
    [viewerPage, paths.review + '/receipts/' + paths.receipt.split('/').at(-1) + '/view', 'reviewer-receipt'],
    [viewerPage, '/trust', 'public-trust-center'],
    [ownerPage, '/app/unknown', 'unknown-app-page'],
    [ownerPage, '/app/audit', 'named-audit-records'],
    [ownerPage, '/app/tests', 'readable-test-results'],
    [ownerPage, paths.document.split('/documents/')[0], 'program-edition'],
    [ownerPage, '/app/archive', 'archive-inventory'],
   ]
   for (const [page, path, name] of screens) {
    const response = await page.goto(bridge.origin + path)
    assert.equal(response.status(), name === 'unknown-app-page' ? 404 : 200)
    const visible = await page.locator('main').innerText()
    assert.doesNotMatch(visible, /\b[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\b/)
    assert.equal(await page.getByRole('link', { name: 'Receipt JSON', exact: true }).count(), 0)
    await bridge.capture(page, name)
   }
   await moveInAndPrepare(ownerPage, bridge.origin, width, async (page, name) => bridge.capture(page, name, [page.locator('input[readonly], [data-secret], .issued-token code')]), process.cwd(), () => new Date('2026-10-11T12:00:00Z'))
   await viewer.close(); await owner.close()
   console.log(`PASS named records, auditor document, public trust and browser errors at ${width}`)
  }
  await archiveDisplayBrowser(app)
 } finally { await bridge.close() }
}
