import { assuranceBrowser } from './helpers/assurance-browser.mjs'
// AGENT-002: the period report, cited findings, original source and rejected end state.
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { readFile,mkdir } from 'node:fs/promises'
import { resolve,extname,join } from 'node:path'
import { chromium } from 'playwright'
import { runtime } from './helpers/runtime.mjs'
import { periodAgentFixture } from './helpers/period-agent-journey.mjs'
const app=await runtime(),output=resolve(process.env.EVIDENCE_BROWSER_OUTPUT??'.cache/browser/period-agent')
let browser,server,origin
try {
 const cookie=await app.signin(),fixture=await periodAgentFixture(app),base='/app/controls/'+fixture.control
 app.setCookie('')
 server=createServer(async(req,res)=>{
  try {
   const url=new URL(req.url,origin),path=resolve('public','.'+url.pathname)
   if(path.startsWith(resolve('public')+'/')&&/\.(css|woff2?|svg|png|js)$/.test(path)) {
    res.writeHead(200,{'content-type':({'.css':'text/css','.woff2':'font/woff2','.woff':'font/woff','.svg':'image/svg+xml','.png':'image/png','.js':'text/javascript'})[extname(path)]});res.end(await readFile(path));return
   }
   const chunks=[];for await(const chunk of req)chunks.push(chunk)
   const headers={...req.headers,host:new URL(app.origin).host};if(headers.origin===origin)headers.origin=app.origin
   const r=await app.fetch(url.pathname+url.search,{method:req.method,headers,...(['GET','HEAD'].includes(req.method)?{}:{body:Buffer.concat(chunks)})})
   res.writeHead(r.status,Object.fromEntries(r.headers));res.end(Buffer.from(await r.arrayBuffer()))
  }catch{res.writeHead(500);res.end('Transport unavailable')}
 })
 await new Promise(done=>server.listen(0,'127.0.0.1',done));origin='http://127.0.0.1:'+server.address().port
 browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
 await mkdir(output,{recursive:true})
 for(const width of [1440,390]) {
  const context=await browser.newContext({viewport:{width,height:1000}})
  await context.addCookies(cookie.split('; ').map(pair=>{const i=pair.indexOf('=');return{name:pair.slice(0,i),value:pair.slice(i+1),url:origin}}))
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message))
  const capture=async name=>{await page.evaluate(()=>document.fonts.ready);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${name} overflow at ${width}`);await page.screenshot({path:join(output,`${width}-${name}.png`),fullPage:true})}
  await page.goto(origin+base+'/report?from=2026-10-12&to=2026-10-14')
  await capture('period-report')
  const investigate=page.getByRole('button',{name:'Ask agent to investigate this period'});await investigate.focus();await page.keyboard.press('Enter')
  await page.waitForURL(/\/investigations\//)
  const investigationURL=page.url()
  await page.getByRole('heading',{name:'Findings',exact:true}).waitFor()
  assert.match(await page.locator('main').innerText(),/Earlier failure; latest result passes/)
  assert.match(await page.locator('main').innerText(),/Missing observation window/)
  await capture('findings')
  const failure=page.locator('main details').filter({has:page.locator('summary').filter({hasText:'Earlier failure; latest result passes'})}).first()
  await failure.locator('summary').click()
  await failure.locator('a[href*="investigation-source"]').first().click()
  await page.getByRole('heading',{name:'Original investigation source',exact:true}).waitFor()
  assert.match(await page.locator('main pre').innerText(),/source_ref|snapshot_json|criteria_json|effective_at/)
  await capture('original-source')
  await page.goto(investigationURL)
  await page.getByLabel('Reason',{exact:true}).fill('Reject the exception: retain the privilege violation and missing window for the assessor')
  await page.getByRole('button',{name:'Record exact findings decision'}).click()
  await page.getByRole('heading',{name:'rejected',exact:true}).waitFor()
  assert.equal(await page.getByRole('button',{name:'Record exact findings decision'}).count(),0)
  await capture('rejected')
  await page.reload();await page.getByRole('heading',{name:'rejected',exact:true}).waitFor()
  await page.goto(origin+base+'/report?from=2026-10-12&to=2026-10-14')
  await Promise.all([page.waitForURL(url=>url.pathname.includes('/investigations/')&&url.href!==investigationURL),page.getByRole('button',{name:'Ask agent to investigate this period'}).click()])
  await page.getByRole('heading',{name:'Review the findings',exact:true}).waitFor()
  await page.getByLabel('Decision',{exact:true}).selectOption('reviewed')
  await page.getByLabel('Reason',{exact:true}).fill('Reviewed findings; exceptions need separate owner approval')
  await page.getByRole('button',{name:'Record exact findings decision'}).click()
  await page.getByRole('heading',{name:'reviewed',exact:true}).waitFor()
  await capture('reviewed')
  assert.deepEqual(errors,[])
  await context.close()
  console.log(`PASS AGENT-002: period investigation, original citations and rejected end state at ${width}`)
 }
} finally {await browser?.close();if(server)await new Promise(done=>server.close(done));await app.close()}

await assuranceBrowser()
