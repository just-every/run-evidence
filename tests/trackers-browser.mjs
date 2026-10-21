// WORK-001: production owner pages and real D1, with tracker fakes solely at
// the network edge. Serve the shipped CSS/fonts alongside the same HTTP doors.
process.env.RER_SERVER_JOURNEY='1'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { readFile, mkdir } from 'node:fs/promises'
import { resolve, extname, join } from 'node:path'
import { chromium } from 'playwright'
import { runtime } from './helpers/runtime.mjs'
import { azureDeadlineBrowser, deadlineBrowser } from './helpers/azure-deadline-browser.mjs'
import { trackerFixture, configs } from './helpers/tracker-matrix.mjs'
const edge=trackerFixture(),app=await runtime({outbound:edge.outbound,origin:'https://127.0.0.1:8787'})
const output=resolve(process.env.EVIDENCE_BROWSER_OUTPUT??'.cache/browser/trackers')
let browser,server
try {
 const cookie=await app.signin(),dest={}
 for(const [provider,c] of Object.entries(configs)) {
  const r=await app.fetch('/api/trackers',{method:'POST',headers:{origin:app.origin,'content-type':'application/json'},body:JSON.stringify({provider,api_base:c.base,account:c.account??'',project:c.project,token:edge.keys[provider],due_field:'Custom.RemediationDue',hook_secret:provider==='vector'?'ab'.repeat(32):'test-signing-secret',hook_audience:provider==='vector'?'ws-1 dst-1':''})})
  assert.equal(r.status,201);dest[provider]=await r.json()
 }
 app.setCookie('')
 let origin
 server=createServer(async(req,res)=>{
  try {
   const url=new URL(req.url,origin),path=resolve('public','.'+url.pathname),publicRoot=resolve('public')+'/'
   if(path.startsWith(publicRoot)&&/\.(css|woff2?|svg|png|js)$/.test(path)) {
    const bytes=await readFile(path);res.writeHead(200,{'content-type':({'.css':'text/css','.woff2':'font/woff2','.woff':'font/woff','.svg':'image/svg+xml','.png':'image/png','.js':'text/javascript'})[extname(path)]});res.end(bytes);return
   }
   const chunks=[];for await(const chunk of req)chunks.push(chunk)
   const headers={...req.headers,host:new URL(app.origin).host}
   if(headers.origin===origin)headers.origin=app.origin
   const response=await app.fetch(url.pathname+url.search,{method:req.method,headers,...(['GET','HEAD'].includes(req.method)?{}:{body:Buffer.concat(chunks)})})
   res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()))
  } catch {res.writeHead(500);res.end('Test transport failed')}
 })
 await new Promise(done=>server.listen(0,'127.0.0.1',done));origin='http://127.0.0.1:'+server.address().port
 edge.state.handshake=async(target,secret)=>{const url=new URL(target);return app.fetch(url.pathname+url.search,{method:'POST',headers:{cookie:'','x-hook-secret':secret},body:''})}
 browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
 await mkdir(output,{recursive:true})
 for(const width of [1440,390]) {
  if(width===390) {
   const bc=configs.basecamp,br=await app.fetch('/api/trackers',{method:'POST',headers:{cookie,origin:app.origin,'content-type':'application/json'},body:JSON.stringify({provider:'basecamp',project:bc.project,token:edge.keys.basecamp,label:'Basecamp phone registration'})})
   assert.equal(br.status,201);dest.basecamp=await br.json()
   const c=configs.asana,r=await app.fetch('/api/trackers',{method:'POST',headers:{cookie,origin:app.origin,'content-type':'application/json'},body:JSON.stringify({provider:'asana',project:c.project,token:edge.keys.asana,label:'Asana phone registration'})})
   assert.equal(r.status,201);dest.asana=await r.json()
  }
  const context=await browser.newContext({viewport:{width,height:1000}})
  await context.addCookies(cookie.split('; ').map(pair=>{const index=pair.indexOf('=');return {name:pair.slice(0,index),value:pair.slice(index+1),url:origin}}))
  const page=await context.newPage(),errors=[]
  page.on('pageerror',e=>errors.push(e.message))
  async function capture(name) {
   await page.evaluate(()=>document.fonts.ready)
   const sizes=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}))
   assert.ok(sizes.scroll<=sizes.width,`${name} overflows at ${width}`)
   await page.screenshot({path:join(output,`${width}-${name}.png`),fullPage:true,mask:[page.locator('input[type=password],.issued-token')]})
  }
  assert.equal((await page.goto(origin+'/app/trackers')).status(),200)
  assert.equal(await page.locator('select[name=provider] option').count(),13)
  for(const provider of Object.keys(configs))assert.ok(await page.locator(`[data-cost-provider="${provider}"]`).count())
  await page.getByLabel('Tracker',{exact:true}).focus();assert.equal(await page.locator('select[name=provider]').evaluate(el=>el===document.activeElement),true)
  await page.keyboard.press('ArrowDown');await page.keyboard.press('Tab');assert.equal(await page.locator('input[name=api_base]').evaluate(el=>el===document.activeElement),true)
  await capture('trackers')
  for(const [provider,c] of Object.entries(configs)) {
   assert.equal((await page.goto(origin+'/app/trackers/'+dest[provider].id)).status(),200)
   assert.ok(await page.getByRole('heading',{name:'Field rules and mapping'}).count())
   assert.match(await page.locator('main').innerText(),/polled every 10 minutes|polling every 10 minutes|ten-minute polling|Every 10 minutes/)

   if(provider==='basecamp') {
    await capture('basecamp-before-registration')
    await page.getByRole('button',{name:'Register Basecamp callback'}).click()
    await page.waitForURL(origin+'/app/trackers/'+dest[provider].id)
    assert.equal(await page.getByRole('button',{name:'Register Basecamp callback'}).count(),0)
    assert.match(await page.locator('main').innerText(),/Registered secret address withheld/)
    const secret=new URL([...edge.state.basecampHooks.values()].at(-1).payload_url).searchParams.get('secret')
    assert.ok(!(await page.content()).includes(secret))
    await capture('basecamp-registered')
    const h=[...edge.state.basecampHooks.values()].at(-1);h.active=false
    edge.state.clock=new Date(Date.parse(edge.state.clock)+60*60000).toISOString()
    await app.clock(edge.state.clock);assert.equal((await app.tick()).outcome,'ok')
    await page.reload()
    assert.match(await page.locator('main').innerText(),/Deactivated, changed or unavailable/)
    await capture('basecamp-deactivated')
    await page.getByRole('button',{name:'Register Basecamp callback'}).click()
    await page.waitForURL(origin+'/app/trackers/'+dest[provider].id)
    assert.match(await page.locator('main').innerText(),/Registered secret address withheld/)

   }
   if(provider==='asana') {
    await capture('asana-before-registration')
    await page.getByRole('button',{name:'Register Asana webhook'}).click()
    await page.waitForURL(origin+'/app/trackers/'+dest[provider].id)
    assert.equal(await page.getByRole('button',{name:'Register Asana webhook'}).count(),0)
   }
   await capture(provider+'-details')
   if(provider==='github')await deadlineBrowser({page,app,edge,cookie,destination:dest[provider],width,capture,provider})
   if(provider==='azure-boards')await azureDeadlineBrowser({page,app,edge,cookie,destination:dest[provider],width,capture})
  }
  assert.deepEqual(errors,[])
  console.log(`PASS WORK-001: tracker setup, all thirteen destination details, cost disclosures, field rules, keyboard access and overflow at ${width}`)
  await context.close()
 }
} finally {
 await browser?.close()
 if(server)await new Promise(done=>server.close(done))
 await app.close()
}
