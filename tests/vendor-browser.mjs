import { socReport,pdfFixture } from './helpers/pdf-fixture.mjs'
// VENDOR-001: the vendor register, a vendor's diligence page and the supplier link screens.
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { readFile, mkdir } from 'node:fs/promises'
import { resolve, extname, join } from 'node:path'
import { chromium } from 'playwright'
import { runtime } from './helpers/runtime.mjs'
const app = await runtime(), output = resolve(process.env.EVIDENCE_BROWSER_OUTPUT ?? '.cache/browser/vendor')
let browser, server, origin
const api = async (path, body) => { const r = await app.fetch(path, { method: 'POST', headers: { origin: app.origin, 'content-type': 'application/json' }, body: JSON.stringify(body) }); const text = await r.text(); assert.ok(r.status < 300, path + text); return JSON.parse(text) }
try {
 const cookie = await app.signin()
 await app.clock('2026-11-02T15:00:00Z')
 const person = await api('/api/people', { name: 'Dana Okafor', email: 'dana@northstar.test', kind: 'employee' })
 const vendor = await api('/api/vendors', { name: 'Acme Notes', service: 'Clinical note-taking SaaS', criticality: 'high', data_types: ['PHI'], region: 'us-east-1', annual_cost_usd: '48000', renewal_date: '2027-02-01', contact_email: 'security@acme-notes.example', owner_person_id: person.id })
 const links = { 1440: await api(`/api/vendors/${vendor.id}/requests`, { kinds: ['soc2', 'baa', 'questionnaire'], template_id: 'caiq-v4', expires_at: '2026-11-09' }), 390: await api(`/api/vendors/${vendor.id}/requests`, { kinds: ['questionnaire'], template_id: 'caiq-v4', expires_at: '2026-11-09' }) }
 const reportProgram=await api('/api/programs',{framework:'soc2',report_type:'Type II',name:'Vendor obligation readiness',legal_entity:'Northstar Inc',audit_from:'2026-01-01',audit_to:'2026-12-31'})
 const controlResponse=await app.fetch('/app/controls',{method:'POST',headers:{origin:app.origin,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({name:'Supplier access reviews',group:'Access',proof:'Quarterly supplier roster',cadence:'quarterly'})})
 assert.equal(controlResponse.status,303)
 const controlId=(await (await app.fetch('/api/desk')).json()).requirements.find(r=>controlResponse.headers.get('location').endsWith(r.id)).control_id
 const reports={}
 for(const width of [1440,390]){
  const v=await api('/api/vendors',{name:'Report supplier '+width,criticality:'low'})
  const f=new FormData();f.set('kind','soc2');f.set('file',new File([socReport()],'supplier-soc2.pdf',{type:'application/pdf'}))
  const r=await app.fetch(`/api/vendors/${v.id}/documents`,{method:'POST',headers:{origin:app.origin},body:f});assert.equal(r.status,201)
  reports[width]={vendor:v.id,doc:(await r.json()).id}
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
  const supplierPath = new URL(links[width].url).pathname
  const context = await browser.newContext({ viewport: { width, height: 1000 } })
  const page = await context.newPage(), errors = []; page.on('pageerror', e => errors.push(e.message));
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
  await page.getByRole('heading', { name: 'Vendors', exact: true, level: 1 }).waitFor(); await capture('vendors')
  await page.getByRole('link', { name: 'Acme Notes' }).click()
  await page.getByRole('heading', { name: 'Diligence checklist' }).waitFor()
  assert.match(await page.locator('main').innerText(), /not verified by Evidence/)
  await page.getByLabel('Rationale').fill('Acceptable while the BAA is chased'); await page.getByLabel('Decision', { exact: true }).last().selectOption('conditional')
  await page.getByLabel('Condition (conditional approval)').fill('Provide the signed BAA'); await page.getByLabel('Condition expires on').fill('2026-12-01')
  await page.getByLabel('Named approver', { exact: true }).selectOption({ label: 'Dana Okafor · dana@northstar.test' })
  await page.getByRole('button', { name: 'Record decision' }).click()
  await page.getByText('conditionally approved').first().waitFor(); await capture('vendor-approved')
  await page.goto(origin+`/app/vendors/${vendor.id}`)
  const response=page.locator('details').filter({has:page.locator('summary').filter({hasText:/submitted.*supplier-asserted/})}).last()
  await response.locator('summary').click()
  await response.getByRole('button',{name:'Prepare cited questionnaire review'}).click()
  await page.getByRole('heading',{name:'Vendor document review',exact:true}).waitFor()
  await capture('vendor-questionnaire-review')
  const questionnaireReview=page.url()
  await page.getByRole('link',{name:'Page 1',exact:true}).click()
  await page.getByRole('heading',{name:'Original document page',exact:true}).waitFor()
  await page.getByText('Supplier answer: yes',{exact:false}).waitFor()
  await capture('vendor-questionnaire-source')
  await page.goto(questionnaireReview)
  await page.getByLabel('Named reviewer',{exact:true}).selectOption(person.id)
  await page.getByLabel('Decision reason').fill('Read every submitted answer; no unsupported assurance inferred')
  await page.getByRole('button',{name:'Record exact decision'}).click()
  await page.getByRole('heading',{name:'approved',exact:true}).waitFor()
  await capture('vendor-questionnaire-approved')
  // VENDOR-003: original pages, immutable corrections, exact decisions and
  // unmapped CUECs in the program's readiness at both widths.
  const report=reports[width]
  await page.goto(origin+`/app/vendors/${report.vendor}/documents/${report.doc}/reviews`)
  await capture('vendor-review-list')
  await page.getByRole('button',{name:'Prepare cited review'}).click()
  await page.getByRole('heading',{name:'Vendor document review',exact:true}).waitFor()
  await page.getByText('bridge letter missing',{exact:false}).first().waitFor()
  await capture('vendor-review-proposal')
  const reviewUrl=page.url()
  await page.getByRole('link',{name:'Source page 2',exact:true}).first().click()
  await page.getByRole('heading',{name:'Original document page',exact:true}).waitFor()
  await page.getByText('Retained source text',{exact:false}).waitFor()
  await capture('vendor-source-page')
  await page.goto(reviewUrl)
  await page.getByLabel('Field',{exact:true}).selectOption({label:'auditor: Harbour Assurance LLP'})
  await page.getByLabel('Corrected value').fill('Harbour Assurance')
  await page.getByLabel('Source page',{exact:true}).fill('1')
  await page.getByLabel('Exact source passage').fill('Service auditor: Harbour Assurance LLP')
  await page.getByLabel('Correction reason').fill('Use trading name; preserve first proposal')
  await page.getByRole('button',{name:'Retain corrected revision'}).click()
  await page.getByText('Revision 2',{exact:false}).first().waitFor()
  await capture('vendor-review-correction')
  await page.getByLabel('Named reviewer',{exact:true}).selectOption(person.id)
  await page.getByLabel('Review all supplier account access every quarter.',{exact:true}).selectOption(controlId)
  await page.getByLabel('Encrypt customer exports before transmission.',{exact:true}).selectOption('unaddressed')
  await page.getByLabel('Decision reason').fill('Reviewed both pages and exact obligations')
  await page.getByRole('button',{name:'Record exact decision'}).click()
  await page.getByRole('heading',{name:'approved',exact:true}).waitFor()
  await capture('vendor-review-approved')
  await page.getByRole('link',{name:'CUEC readiness obligations',exact:true}).click()
  await page.getByText('Open · accepted as unaddressed').first().waitFor()
  await capture('vendor-cuec-obligations')
  await page.goto(origin+'/app/programs/'+reportProgram.id)
  await page.getByRole('link',{name:/open vendor CUEC obligations/}).waitFor()
  await capture('vendor-cuec-readiness')
  // ERASE-001: privacy requests, hold review and the confirmed receipt use the
  // existing application shell at both required widths.
  await page.goto(origin + '/app/privacy')
  await page.getByRole('heading', { name: 'Privacy', exact: true }).waitFor()
  await capture('privacy')
  const privacyForm=page.locator('form[action="/app/privacy/requests"]')
  await privacyForm.getByLabel('Scope').selectOption('business')
  await privacyForm.getByLabel('Reason').fill('Review all stores before any deletion')
  await privacyForm.getByRole('button').click()
  await page.getByRole('heading',{name:'Erasure review',exact:true}).waitFor()
  await page.getByText('No completed erasure is claimed.').waitFor()
  await capture('privacy-refused-scope')
  await page.goto(origin + '/app/privacy')
  const holdForm=page.locator('form[action="/app/privacy/holds"]')
  await holdForm.getByLabel('Scope').selectOption('business')
  await holdForm.getByLabel('Reason').fill('Preserve records for review')
  await holdForm.getByLabel('Review on').fill('2027-01-01')
  await holdForm.getByRole('button').click()
  await page.getByText('Preserve records for review').first().waitFor()
  await capture('privacy-hold')
  assert.deepEqual(errors, [])
  await context.close()
  console.log(`PASS VENDOR-001: register, diligence page and supplier link screens at ${width}`)
 }
} finally { await browser?.close(); if (server) await new Promise(done => server.close(done)); await app.close() }
