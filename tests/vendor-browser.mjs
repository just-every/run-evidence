// VENDOR-001: the vendor register, a vendor's diligence page and the supplier link screens.
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { readFile, mkdir } from 'node:fs/promises'
import { resolve, extname, join } from 'node:path'
import { chromium } from 'playwright'
import { runtime } from './helpers/runtime.mjs'
const app = await runtime(), output = resolve(process.env.EVIDENCE_BROWSER_OUTPUT ?? '.cache/browser/vendor')
let browser, server, origin
const api = async (path, body) => { const r = await app.fetch(path, { method: 'POST', headers: { origin: app.origin, 'content-type': 'application/json' }, body: JSON.stringify(body) }); assert.ok(r.status < 300, path + await r.text()); return r.json() }
try {
 const cookie = await app.signin()
 await app.clock('2026-11-02T15:00:00Z')
 const person = await api('/api/people', { name: 'Dana Okafor', email: 'dana@northstar.test', kind: 'employee' })
 const vendor = await api('/api/vendors', { name: 'Acme Notes', service: 'Clinical note-taking SaaS', criticality: 'high', data_types: ['PHI'], region: 'us-east-1', annual_cost_usd: '48000', renewal_date: '2027-02-01', contact_email: 'security@acme-notes.example', owner_person_id: person.id })
 const issued = await api(`/api/vendors/${vendor.id}/requests`, { kinds: ['soc2', 'baa', 'questionnaire'], template_id: 'caiq-v4', expires_at: '2026-11-09' })
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
 const supplierPath = new URL(issued.url).pathname
 for (const width of [1440, 390]) {
  const context = await browser.newContext({ viewport: { width, height: 1000 } })
  const page = await context.newPage(), errors = []; page.on('pageerror', e => errors.push(e.message))
  const capture = async name => { await page.evaluate(() => document.fonts.ready); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${name} overflow at ${width}`); await page.screenshot({ path: join(output, `${width}-${name}.png`), fullPage: true }) }
  // The supplier needs no sign-in: the link shows only its own requests.
  await page.goto(origin + supplierPath)
  await page.getByRole('heading', { name: 'Security information for Acme Notes' }).waitFor()
  assert.equal(await page.getByRole('link', { name: 'Vendors' }).count(), 0, 'no owner navigation on the supplier page')
  await capture('supplier-requests')
  await page.getByRole('link', { name: 'Answer the questionnaire' }).click()
  await page.getByRole('heading', { name: /CSA CAIQ v4/ }).waitFor()
  await capture('supplier-questionnaire')
  await page.locator('input[type=radio][value=yes]').evaluateAll(radios => radios.forEach(r => r.click()))
  await page.getByLabel('Your name').fill('Sam Rivera'); await page.getByLabel('Your email').fill('security@acme-notes.example')
  await page.getByLabel(/Submit these answers as final/).check()
  await page.getByRole('button', { name: 'Save answers' }).click()
  await page.getByText('Submitted. Thank you.').waitFor()
  await page.goto(origin + supplierPath); await capture('supplier-submitted')
  // The owner signs in with a session in this browser context only.
  await context.addCookies(cookie.split('; ').map(pair => { const i = pair.indexOf('='); return { name: pair.slice(0, i), value: pair.slice(i + 1), url: origin } }))
  await page.goto(origin + '/app/vendors')
  await page.getByRole('heading', { name: 'Vendors', exact: true }).waitFor(); await capture('vendors')
  await page.getByRole('link', { name: 'Acme Notes' }).click()
  await page.getByRole('heading', { name: 'Diligence checklist' }).waitFor()
  assert.match(await page.locator('main').innerText(), /not verified by Evidence/)
  await page.getByLabel('Rationale').fill('Acceptable while the BAA is chased'); await page.getByLabel('Decision', { exact: true }).last().selectOption('conditional')
  await page.getByLabel('Condition (conditional approval)').fill('Provide the signed BAA'); await page.getByLabel('Condition expires on').fill('2026-12-01')
  await page.getByLabel('Named approver (required for exceptions)').selectOption({ label: 'Dana Okafor · dana@northstar.test' })
  await page.getByRole('button', { name: 'Record decision' }).click()
  await page.getByText('conditionally approved').first().waitFor(); await capture('vendor-approved')
  assert.deepEqual(errors, [])
  await context.close()
  console.log(`PASS VENDOR-001: register, diligence page and supplier link screens at ${width}`)
 }
} finally { await browser?.close(); if (server) await new Promise(done => server.close(done)); await app.close() }
