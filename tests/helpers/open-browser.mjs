import assert from 'node:assert/strict'
// OPEN-001: a real rer installation needs no author account, license or payment.
// The disposable checkout and native owner admission are established by browser.mjs.
export async function openSetupScreens(page, origin, width, capture) {
 for (const area of ['connections', 'trackers', 'followups', 'training']) {
  assert.equal((await page.goto(origin + '/app/' + area)).status(), 200)
  assert.ok(await page.getByRole('complementary', {name: 'Provider costs in USD'}).count())
  await capture(page, `${width}-open-${area}`)
 }
 console.log(`PASS OPEN-001: installed public-source owner opens provider setup without author credentials at ${width}`)
}
