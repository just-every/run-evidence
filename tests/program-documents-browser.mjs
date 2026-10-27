import { readableRecordsJourney } from './helpers/readable-records-journey.mjs'
// PROGRAM-003: Program -> Documents list, a document with its citations, owner input forms and approval.
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { readFile, mkdir } from 'node:fs/promises'
import { resolve, extname, join } from 'node:path'
import { chromium } from 'playwright'
import { runtime } from './helpers/runtime.mjs'
const app = await runtime(), output = resolve(process.env.EVIDENCE_BROWSER_OUTPUT ?? '.cache/browser/program-documents')
let browser, server, origin
const api = async (path, body) => { const r = await app.fetch(path, { method: 'POST', headers: { origin: app.origin, 'content-type': 'application/json' }, body: JSON.stringify(body) }); const text = await r.text(); assert.ok(r.status < 300, path + text); return JSON.parse(text) }
try {
 const cookie = await app.signin()
 await app.clock('2026-10-22T10:00:00Z')
 const lead = await api('/api/people', { name: 'Priya Shah', email: 'priya@northstar.test', kind: 'employee' }); await api('/api/people', { name: 'Dana Okafor', email: 'dana@northstar.test', kind: 'employee' })
 const make = name => api('/api/programs', { framework: 'iso27001', name, legal_entity: 'Northstar Studio, Inc.', products: ['Web app'], teams: ['Engineering'], regions: ['us-east-1'], systems: ['AWS'], audit_from: '2026-07-01', audit_to: '2027-06-30', lead_person_id: lead.id })
 const programs = { 1440: await make('ISO 27001 wide'), 390: await make('ISO 27001 narrow') }
 const pciPrograms = {}
 for (const width of [1440, 390]) {
  const p = await api('/api/programs', { framework: 'pci', name: 'PCI worksheet ' + width, legal_entity: 'Northstar Studio, Inc.', audit_from: '2026-01-01', audit_to: '2026-12-31', lead_person_id: lead.id })
  pciPrograms[width] = p
  await api(`/api/programs/${p.id}/documents`, { kind: 'pci-saq' })
  await api(`/api/programs/${p.id}/documents/pci-saq/revisions`, { inputs: JSON.stringify({ saq_answers: { role: 'merchant', channels: ['e-commerce'], stores_chd: 'no', p2pe: 'no', terminals: 'none', ecommerce: 'fully-outsourced' } }), reason: 'Select SAQ A under the accepted library' })
  const doc = await (await app.fetch(`/api/programs/${p.id}/documents/pci-saq`)).json()
  await api(`/api/programs/${p.id}/documents/pci-saq/revisions`, { ...Object.fromEntries(doc.revision.content.sections.find(s => s.id === 'worksheet').table.rows.map(r => ['response.' + r[0], 'in place'])), reason: 'Assess the earlier SAQ revision' })
  await api(`/api/programs/${p.id}/documents/pci-saq/approvals`, { revision: 3, approver_person_id: lead.id })
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
 // Both widths see the reviewable SAQ change before it is accepted.
 for (const width of [1440, 390]) {
  const c = await browser.newContext({ viewport: { width, height: 1000 } })
  await c.addCookies(cookie.split('; ').map(pair => { const i = pair.indexOf('='); return { name: pair.slice(0, i), value: pair.slice(i + 1), url: origin } }))
  const p = await c.newPage(); await p.goto(origin + '/app/library')
  await p.getByRole('heading', { name: 'Revision 3 · waiting for review' }).waitFor()
  assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
  await p.screenshot({ path: join(output, `${width}-saq-library-review.png`), fullPage: true }); await c.close()
 }
 for (const width of [1440, 390]) {
  const context = await browser.newContext({ viewport: { width, height: 1000 } })
  await context.addCookies(cookie.split('; ').map(pair => { const i = pair.indexOf('='); return { name: pair.slice(0, i), value: pair.slice(i + 1), url: origin } }))
  const page = await context.newPage(), errors = []; page.on('pageerror', e => errors.push(e.message))
  const capture = async name => { await page.evaluate(() => document.fonts.ready); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${name} overflow at ${width}`); await page.screenshot({ path: join(output, `${width}-${name}.png`), fullPage: true }) }
  const program = programs[width]
  await page.goto(`${origin}/app/programs/${program.id}`)
  await page.getByRole('link', { name: 'Documents', exact: true }).click()
  await page.getByRole('heading', { name: 'Documents', exact: true }).waitFor(); await capture('documents')
  await page.getByLabel('Accountable owner for Statement of Applicability').selectOption({ label: 'Priya Shah · priya@northstar.test' })
  const generate = page.locator('form').filter({ has: page.locator('input[value="iso-soa"]') }); await generate.getByRole('button', { name: 'Generate' }).click()
  await page.getByRole('heading', { name: /Statement of Applicability/ }).first().waitFor()
  assert.match(await page.locator('main').innerText(), /A\.8\.34/); await capture('soa')
  await page.getByRole('link', { name: 'Export XLSX' }).waitFor()
  await page.getByLabel('Control (such as A.5.15)').fill('A.5.15'); await page.getByLabel('Justification').fill('Access is granted by role and reviewed quarterly.')
  await page.locator('form').filter({ has: page.getByLabel('Control (such as A.5.15)') }).getByLabel('Reason').fill('Owner justification'); await page.getByRole('button', { name: 'Save as a new revision' }).first().click()
  await page.getByText('Revision 2 of 2').waitFor()
  await page.getByLabel('Named approver').selectOption({ label: 'Dana Okafor · dana@northstar.test' }); await page.getByRole('button', { name: 'Approve revision 2' }).click()
  await page.getByText(/approved by Dana Okafor/).first().waitFor(); await capture('approved')
  await page.goto(`${origin}/app/programs/${program.id}/documents/iso-soa?revision=1`)
  await page.getByText('Revision 1 of 2').waitFor(); await capture('prior-revision')
  const pci = pciPrograms[width], saqPath = `/app/programs/${pci.id}/documents/pci-saq`
  await page.goto(origin + saqPath); await capture('saq-earlier-approved')
  if (width === 1440) {
   await page.goto(origin + '/app/library')
   const change = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Revision 3 · waiting for review' }) })
   await change.getByLabel('Reason').fill('Reviewed SAQ A revision 1 with the QSA')
   await change.getByRole('button', { name: 'Accept revision 3' }).click()
  }
  await page.goto(origin + saqPath)
  await page.getByRole('heading', { name: 'Needs review', exact: true }).waitFor()
  await capture('saq-revision-drift')
  await page.locator('form[action$="/reconcile"]').getByLabel('Reason').fill('Apply reviewed SAQ revision')
  await page.getByRole('button', { name: 'Reconcile into a new revision' }).click()
  await page.getByText(/r1 · January 2025/, { exact: false }).first().waitFor()
  assert.equal(await page.getByRole('combobox', { name: 'Response for 6.4.3', exact: true }).count(), 0)
  assert.equal(await page.locator('select[name^="response."]').count(), 27)
  await capture('saq-current-scope')
  await page.getByRole('combobox', { name: 'Response for 3.1.1', exact: true }).selectOption('not applicable')
  const answers = page.locator('form').filter({ has: page.getByRole('heading', { name: 'Worksheet responses', exact: true }) })
  await answers.getByLabel('Reason', { exact: true }).fill('One requirement is not applicable')
  await answers.getByRole('button').click()
  await page.getByLabel('Named approver', { exact: true }).selectOption(lead.id)
  await page.getByRole('button', { name: 'Approve revision 5' }).click()
  await page.getByRole('alert').filter({ hasText: /required explanation/ }).waitFor(); await capture('saq-explanation-required')
  await page.goto(origin + saqPath)
  await page.getByLabel('Explanation for 3.1.1', { exact: true }).fill('No stored card data: all payment processing is outsourced. Confirmed with the QSA.')
  const explained = page.locator('form').filter({ has: page.getByRole('heading', { name: 'Worksheet responses', exact: true }) })
  await explained.getByLabel('Reason', { exact: true }).fill('Document the applicability explanation')
  await explained.getByRole('button').click()
  await page.getByLabel('Named approver', { exact: true }).selectOption(lead.id)
  await page.getByRole('button', { name: 'Approve revision 6' }).click()
  await page.getByText(/approved by Priya Shah/).first().waitFor(); await capture('saq-approved-with-explanation')
  await page.goto(`${origin}/app/programs/${pci.id}/documents`)
  const handoff = page.locator('form').filter({ has: page.locator('input[value="pci-aoc-handoff"]') })
  await handoff.getByRole('button', { name: 'Generate' }).click()
  await page.getByText(/PCI SSC text is licensed and is not shipped/, { exact: false }).waitFor()
  await capture('saq-aoc-handoff')
  assert.deepEqual(errors, [])
  await context.close()
  console.log(`PASS PROGRAM-003: documents list, SoA, approval and prior revision at ${width}`)
 }
} finally { await browser?.close(); if (server) await new Promise(done => server.close(done)); await app.close() }

await readableRecordsJourney({ browser: true })
