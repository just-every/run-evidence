// PROGRAM-004: the extended programs' own screens at 1440 and 390: state applicability and business figures, the SPRS worksheet,
// the reused SOC 2 evidence, and the owner's acceptance of an applicability change.
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { readFile, mkdir } from 'node:fs/promises'
import { resolve, extname, join } from 'node:path'
import { chromium } from 'playwright'
import { runtime } from './helpers/runtime.mjs'
const app = await runtime(), output = resolve(process.env.EVIDENCE_BROWSER_OUTPUT ?? '.cache/browser/extended-programs')
let browser, server, origin
const api = async (path, body) => { const r = await app.fetch(path, { method: 'POST', headers: { origin: app.origin, 'content-type': 'application/json' }, body: JSON.stringify(body) }); const text = await r.text(); assert.equal(r.status, 201 - (path.endsWith('/inputs') ? 1 : 0), path + ' ' + text); return text ? JSON.parse(text) : null }
try {
 const cookie = await app.signin()
 await app.clock('2026-10-22T10:00:00Z')
 const base = { legal_entity: 'Northstar Studio, Inc.', products: ['Web app'], regions: ['us-east-1'], audit_from: '2026-07-01', audit_to: '2027-06-30' }
 await api('/api/programs', { framework: 'soc2', name: 'SOC 2 Type II', report_type: 'Type II', ...base })
 const figures = (mt) => ({ annual_revenue_usd: 40000000, small_business: false, sale_revenue_percent: 5, consumers: { CA: 12000, TX: 8000, MT: mt } })
 const programs = {}
 for (const width of [1440, 390]) {
  programs[width] = { usdp: await api('/api/programs', { framework: 'usdp', edition: '2026-10', name: 'US Data Privacy ' + width, ...base, figures: figures(30000) }), cmmc: await api('/api/programs', { framework: 'cmmc', edition: 'level-2', name: 'CMMC Level 2 ' + width, ...base }), pims: await api('/api/programs', { framework: 'iso27701', name: 'ISO 27701 ' + width, ...base, categories: ['controller', 'processor'] }) }
}
 app.setCookie('')
 server = createServer(async (req, res) => {
  try {
   const url = new URL(req.url, origin), path = resolve('public', '.' + url.pathname)
   if (path.startsWith(resolve('public') + '/') && /\.(css|woff2?|svg|png|js)$/.test(path)) { res.writeHead(200, { 'content-type': ({ '.css': 'text/css', '.woff2': 'font/woff2', '.woff': 'font/woff', '.svg': 'image/svg+xml', '.png': 'image/png', '.js': 'text/javascript' })[extname(path)] }); res.end(await readFile(path)); return }
   const chunks = []; for await (const chunk of req) chunks.push(chunk)
   const headers = { ...req.headers, host: new URL(app.origin).host }; if (headers.origin === origin) headers.origin = app.origin
   const r = await app.fetch(url.pathname + url.search, { method: req.method, headers, redirect: 'manual', ...(['GET', 'HEAD'].includes(req.method) ? {} : { body: Buffer.concat(chunks) }) })
   const out = Object.fromEntries(r.headers); if (out.location?.startsWith(app.origin)) out.location = origin + out.location.slice(app.origin.length)
   res.writeHead(r.status, out); res.end(Buffer.from(await r.arrayBuffer()))
  } catch { res.writeHead(500); res.end('Transport unavailable') }
 })
 await new Promise(done => server.listen(0, '127.0.0.1', done)); origin = 'http://127.0.0.1:' + server.address().port
 browser = await chromium.launch({ headless: true, args: ['--use-mock-keychain', '--password-store=basic'] })
 await mkdir(output, { recursive: true })

 for (const width of [1440, 390]) {
  const context = await browser.newContext({ viewport: { width, height: 1000 } }), errors = []
  await context.addCookies(cookie.split('; ').map(pair => { const i = pair.indexOf('='); return { name: pair.slice(0, i), value: pair.slice(i + 1), url: origin } }))
  const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()) })
  const capture = async (name, fullPage = true) => {
   const iconOnly = await page.locator('a, button, summary, [role=button]').evaluateAll(nodes => nodes.filter(el => el.getClientRects().length && !el.innerText.trim() && el.querySelector('svg, img')).map(el => el.outerHTML))
   assert.deepEqual(iconOnly, [], name + ': all controls have visible words; an icon-only addition needs hover/focus tooltips')
   assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), name + ' overflows at ' + width); await page.screenshot({ path: join(output, `${width}-${name}.png`), fullPage }) }
  const { usdp, cmmc, pims } = programs[width]
  await page.goto(origin + '/app/programs'); await page.getByLabel('Framework and edition').selectOption('usdp|2026-10'); await page.getByRole('heading', { name: 'Start a program' }).waitFor(); await capture('start-program')
  await page.goto(`${origin}/app/programs/${usdp.id}`)
  await page.getByRole('heading', { name: 'State applicability' }).waitFor(); await page.getByRole('heading', { name: 'External assessment dependency' }).waitFor()
  assert.match(await page.locator('#states-title').locator('..').innerText(), /Montana[^]*does not apply/); await capture('usdp-states')
  const figuresForm = page.locator('form[action$="/inputs"]').filter({ has: page.locator('textarea[name="usdp_consumers"]') })
  await figuresForm.locator('textarea[name="usdp_consumers"]').fill('CA 12000\nTX 8000\nMT 60000'); await figuresForm.locator('input[name="reason"]').fill('Montana customer growth')
  await figuresForm.getByRole('button', { name: 'Record figures' }).click()
  await page.getByRole('button', { name: 'Accept: add obligations' }).waitFor(); await capture('usdp-pending-change')
  await page.locator('form[action$="/state-changes"] input[name="reason"]').fill('Counsel confirmed Montana applies'); await page.getByRole('button', { name: 'Accept: add obligations' }).click()
  await page.getByRole('heading', { name: 'State applicability' }).waitFor(); assert.equal(await page.getByRole('button', { name: 'Accept: add obligations' }).count(), 0)
  await page.goto(`${origin}/app/programs/${usdp.id}?show=included#requirements`); assert.match(await page.locator('#requirements').innerText(), /MT\.ACCESS/); await capture('usdp-accepted')
  const accessRow = ref => page.locator('#requirements tbody tr').filter({ has: page.getByText(ref, { exact: true }) })
  assert.match(await accessRow('CA.ACCESS').innerText(), /Cal\. Civ\. Code §§ 1798\.110, 1798\.115.*effective 2020-01-01/s)
  assert.match(await accessRow('MT.UOOS').innerText(), /30-14-2809\(3\).*effective 2025-01-01/s)
  assert.match(await accessRow('TX.UOOS').innerText(), /541\.055\(e\), \(f\).*effective 2026-01-01/s)
  await capture('usdp-duty-citations')
  for (const ref of ['CA.ACCESS', 'MT.UOOS', 'TX.UOOS']) { await accessRow(ref).scrollIntoViewIfNeeded(); await capture('citation-' + ref.replace('.', '-'), false) }
  await page.goto(`${origin}/app/programs/${cmmc.id}`); await page.getByRole('heading', { name: 'SPRS score worksheet' }).waitFor()
  assert.match(await page.locator('#sprs-title').locator('..').innerText(), /Computed score -203 of 110/); await capture('cmmc-sprs')
  await page.goto(`${origin}/app/programs/${pims.id}`); await page.getByRole('heading', { name: 'Controller and processor controls' }).waitFor(); await page.getByRole('heading', { name: 'Evidence reused from your other programs' }).waitFor(); await capture('pims-roles-reuse')
  await page.goto(`${origin}/app/programs/${usdp.id}/documents`); await page.getByText('Self-attestation').first().waitFor(); await capture('usdp-documents')
  assert.deepEqual(errors, []); await context.close()
  console.log(`PASS PROGRAM-004: USDP states and figures, SPRS worksheet, PIMS roles and reused evidence at ${width}`)
 }
} finally { await browser?.close(); if (server) await new Promise(done => server.close(done)); await app.close() }
