import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { readFile, mkdir } from 'node:fs/promises'
import { resolve, extname, join } from 'node:path'
import { chromium } from 'playwright'
// COLLECTION-001: existing schedule form, shipped styling and real owner HTTP
// handlers. The loopback bridge retains this harness's authenticated owner.
export async function collectionScheduleBrowser(app, connections, { suffix = '', expected = [] } = {}) {
 const output = resolve(process.env.EVIDENCE_BROWSER_OUTPUT ?? '.cache/browser/collection-schedules')
 let server, browser, origin
 try {
  server = createServer(async (req, res) => {
   try {
    const url = new URL(req.url, origin), path = resolve('public', '.' + url.pathname)
    if (path.startsWith(resolve('public') + '/') && /\.(css|woff2?|svg|png|js)$/.test(path)) {
     res.writeHead(200, { 'content-type': ({ '.css': 'text/css', '.woff2': 'font/woff2', '.woff': 'font/woff', '.svg': 'image/svg+xml', '.png': 'image/png', '.js': 'text/javascript' })[extname(path)] }); res.end(await readFile(path)); return
    }
    const chunks = []; for await (const chunk of req) chunks.push(chunk)
    const headers = { ...req.headers, host: new URL(app.origin).host }; if (headers.origin === origin) headers.origin = app.origin
    const r = await app.fetch(url.pathname + url.search, { method: req.method, headers, ...(['GET', 'HEAD'].includes(req.method) ? {} : { body: Buffer.concat(chunks) }) })
    res.writeHead(r.status, Object.fromEntries(r.headers)); res.end(Buffer.from(await r.arrayBuffer()))
   } catch { res.writeHead(500); res.end('Transport unavailable') }
  })
  await new Promise(done => server.listen(0, '127.0.0.1', done)); origin = 'http://127.0.0.1:' + server.address().port
  browser = await chromium.launch({ headless: true, args: ['--use-mock-keychain', '--password-store=basic'] }); await mkdir(output, { recursive: true })
  for (const width of [1440, 390]) {
   const context = await browser.newContext({ viewport: { width, height: 1000 } }), page = await context.newPage()
   for (const c of connections) {
    await page.goto(origin + '/app/connections/' + c.id)
    await page.getByRole('heading', { name: 'Collection schedule', exact: true }).waitFor()
    const interval = page.getByRole('spinbutton', { name: 'Interval in minutes', exact: true })
    assert.equal(await interval.inputValue(), '60')
    await interval.fill('30'); await page.getByRole('button', { name: 'Save collection schedule', exact: true }).click()
    await page.waitForURL('**/app/connections/' + c.id + '#schedule-title'); await page.reload()
    assert.equal(await interval.inputValue(), '30')
    assert.match(await page.locator('main').innerText(), /every 30 minutes after the last attempt/)
    for (const text of expected) assert.ok((await page.locator('main').innerText()).includes(text), text + ' at ' + width)
    await page.evaluate(() => document.fonts.ready)
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), c.provider + ' overflow at ' + width)
    await page.screenshot({ path: join(output, `${width}-${c.provider}${suffix}-saved.png`), fullPage: true })
    await interval.fill('60'); await page.getByRole('button', { name: 'Save collection schedule', exact: true }).click()
    await page.waitForURL('**/app/connections/' + c.id + '#schedule-title'); await page.reload()
    assert.equal(await interval.inputValue(), '60')
    await page.screenshot({ path: join(output, `${width}-${c.provider}${suffix}-restored.png`), fullPage: true })
    await page.getByLabel('Report from', { exact: true }).fill('2026-10-01')
    await page.getByLabel('Report to', { exact: true }).fill('2026-11-01')
    await page.getByRole('button', { name: 'View collection period', exact: true }).click()
    await page.getByRole('heading', { name: 'Collection period report', exact: true }).waitFor()
    await page.getByRole('heading', { name: 'Missing coverage', exact: true }).waitFor()
    await page.getByRole('heading', { name: 'Collection attempts and retained revisions', exact: true }).waitFor()
    if (await page.locator('details').count()) {
     await page.locator('details').first().locator('summary').click()
     assert.match(await page.locator('details').first().innerText(), /context/)
    }
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'collection report overflow at ' + width)
    await page.screenshot({ path: join(output, `${width}-${c.provider}${suffix}-period-report.png`), fullPage: true })
    console.log(`PASS COLLECTION-001: ${c.provider} schedule saved and reloaded at ${width}`)
   }
   await context.close()
  }
 } finally { await browser?.close(); if (server) await new Promise(done => server.close(done)) }
}
