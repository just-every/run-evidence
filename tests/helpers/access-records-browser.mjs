import assert from 'node:assert/strict'
import { browserBridge } from './browser-bridge.mjs'
export async function accessRecordsBrowser(app, cookie, path) {
 const bridge = await browserBridge(app,'access-records'), failures = []
 try {
  for (const width of [1440,390]) {
   const context = await bridge.context(width,cookie), page = await context.newPage()
   try {
    await page.goto(bridge.origin+path)
    await bridge.capture(page,'revocation-evidence')
    const text = await page.locator('main').innerText()
    assert.doesNotMatch(text,/\b[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\b/)
    assert.match(text,/figma\.csv/);assert.match(text,/figma-removal\.txt/)
    assert.doesNotMatch(text,/2026-10-21T/)
    console.log('PASS named access revocation evidence at '+width)
   } catch(error) {failures.push(width+': '+error.message);console.log('FAIL named access revocation evidence at '+width)}
   finally {await context.close()}
  }
  assert.deepEqual(failures,[])
 } finally {await bridge.close()}
}
