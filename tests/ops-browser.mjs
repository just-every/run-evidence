// OPS-001 uses production owner doors and real D1/R2 with shipped styling.
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { readFile, mkdir } from 'node:fs/promises'
import { resolve, extname, join } from 'node:path'
import { chromium } from 'playwright'
import { runtime } from './helpers/runtime.mjs'
import { githubFixture } from './helpers/github-fixture.mjs'
const edge=githubFixture(),app=await runtime({outbound:edge.outbound})
const output=resolve(process.env.EVIDENCE_BROWSER_OUTPUT??'.cache/browser/ops')
let browser,server,origin
try {
 const cookie=await app.signin()
 const connect=await app.fetch('/api/connections',{method:'POST',headers:{origin:app.origin,'content-type':'application/json'},body:JSON.stringify({account:'northstar',token:'github_pat_good',label:'Northstar production repositories'})})
 assert.equal(connect.status,201);await app.tick()
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
 browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']});await mkdir(output,{recursive:true})
 for(const width of [1440,390]) {
  const context=await browser.newContext({viewport:{width,height:1000}})
  await context.addCookies(cookie.split('; ').map(pair=>{const i=pair.indexOf('=');return{name:pair.slice(0,i),value:pair.slice(i+1),url:origin}}))
  const page=await context.newPage()
  await page.goto(origin+'/app');await page.getByRole('link',{name:'Operations',exact:true}).click()
  for(const heading of ['Storage and recovery','Queue','Connector health','Durable outcomes'])await page.getByRole('heading',{name:heading,exact:true}).waitFor()
  assert.match(await page.locator('main').innerText(),/Northstar production repositories/)
  assert.match(await page.locator('main').innerText(),/No total|no total/)
  const capture=async name=>{await page.evaluate(()=>document.fonts.ready);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:join(output,`${width}-${name}.png`),fullPage:true})}
  await capture('health')
  // A real durable pending claim is the same state an interrupted Worker leaves.
  const id=crypto.randomUUID()
  await app.db.prepare("INSERT INTO operation_steps(id,step,scheduled_at,lease_until,outcome,detail) VALUES(?,'collections','2026-10-11T12:10:00.000Z','2026-10-11T12:25:00.000Z','running','')").bind(id).run()
  await page.reload();await page.getByRole('button',{name:'Cancel collections',exact:true}).click()
  await page.waitForURL(origin+'/app/operations')
  assert.equal((await app.db.prepare('SELECT outcome FROM operation_steps WHERE id=?').bind(id).first()).outcome,'unknown')
  assert.match(await page.locator('main').innerText(),/Cancelled by owner/)
  await capture('cancelled')
  await page.getByRole('link',{name:'Export or restore a complete backup'}).click();await page.waitForURL(origin+'/app/archive')
  console.log(`PASS OPS-001: owner health, queue, limits, backup, last collection and cancel end state at ${width}`)
  await context.close()
 }
} finally {await browser?.close();if(server)await new Promise(done=>server.close(done));await app.close()}
