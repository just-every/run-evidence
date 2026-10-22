import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { readFile, mkdir } from 'node:fs/promises'
import { resolve, extname, join } from 'node:path'
import { chromium } from 'playwright'
// COLLECTION-001: existing schedule form, shipped styling and real owner HTTP
// handlers. The loopback bridge retains this harness's authenticated owner.
export async function collectionScheduleBrowser(app, connections, { suffix = '', expected = [], reportExpected = [] } = {}) {
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
    await page.getByRole('heading',{name:'Source-event collection',exact:true}).waitFor()
    const interval = page.getByRole('spinbutton', { name: 'Interval in minutes', exact: true })
    assert.equal(await interval.inputValue(), '60')
    await interval.fill('30'); await page.getByRole('button', { name: 'Save collection schedule', exact: true }).click()
    await page.waitForURL('**/app/connections/' + c.id + '#schedule-title'); await page.reload()
    assert.equal(await interval.inputValue(), '30')
    assert.match(await page.locator('main').innerText(), /every 30 minutes after the last attempt/)
    for (const text of expected) assert.ok((await page.locator('main').innerText()).includes(text), text + ' at ' + width)
    const eventToken=page.getByRole('checkbox',{name:/Source-event forwarder/}).first()
    if(await eventToken.count()) {
     await eventToken.uncheck();await page.getByLabel('Reason for changing event access').fill('Review event access in the owner browser')
     await page.getByRole('button',{name:'Save source-event access',exact:true}).click();await page.waitForURL('**#source-events');await page.reload();assert.equal(await eventToken.isChecked(),false)
     await eventToken.check();await page.getByLabel('Reason for changing event access').fill('Approve our named event forwarder in the owner browser')
     await page.getByRole('button',{name:'Save source-event access',exact:true}).click();await page.waitForURL('**#source-events');await page.reload();assert.equal(await eventToken.isChecked(),true)
    }
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
    const summaries = page.locator('details[data-collection-context] > summary')
    if (await summaries.count()) {
     await summaries.first().click()
     assert.match(await summaries.first().locator('..').innerText(), /Library revision/)
    }
    for(const text of reportExpected){const entry=page.locator('details').filter({hasText:text}).first();assert.ok(await entry.count(),text+' retained in period report');if(!await entry.evaluate(e=>e.open))await entry.locator('summary').click();assert.ok((await entry.innerText()).includes(text))}
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'collection report overflow at ' + width)
    await page.screenshot({ path: join(output, `${width}-${c.provider}${suffix}-period-report.png`), fullPage: true })
    await page.screenshot({ path: join(output, `${width}-${c.provider}${suffix}-period-viewport.png`) })
    const detail = await (await app.fetch('/api/connections/' + c.id)).json()
    const linked = detail.runs.map(r => JSON.parse(r.coverage_json).context?.controls ?? []).flat()[0]
    if (linked) {
     await page.goto(origin + '/app/controls/' + linked.control_id + '/report?from=2026-10-01&to=2026-11-01')
     await page.getByRole('heading', { name: 'Source collection history', exact: true }).waitFor()
     assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'control collection report overflow at ' + width)
     await page.screenshot({ path: join(output, `${width}-${c.provider}${suffix}-control-report.png`), fullPage: true })
    }
    console.log(`PASS COLLECTION-001: ${c.provider} schedule saved and reloaded at ${width}`)
   }
   await context.close()
  }
 } finally { await browser?.close(); if (server) await new Promise(done => server.close(done)) }
}
