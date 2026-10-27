import { fileURLToPath as __rerTestEntryPath } from 'node:url';
const __rerTestEntry = __rerTestEntryPath(import.meta.resolve('@runeditrun/rer/internal/global/rer.mjs'));
const __rerTestEntryArgs = args => args[1] === 'dev' && !args.some(arg => ['--foreground', '--detach', '--stop', '--help'].includes(arg)) ? [...args, '--foreground'] : args;
// Core owner journey through rer dev. All settings, D1/R2 and identity live in a
// disposable checkout. RER_OPEN and dev keys remain in memory, never evidence.
process.env.RER_SERVER_JOURNEY = '1'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { cp, mkdir, mkdtemp, rm, writeFile, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve, basename } from 'node:path'
import { createServer } from 'node:net'
import { createHash } from 'node:crypto'
import { chromium } from 'playwright'
import { controlBrowserJourney } from './helpers/control-browser.mjs'
import { frameworkBrowserJourney } from './helpers/framework-browser.mjs'
import { readinessJourney } from './helpers/readiness-browser.mjs'
import { collectorJourney } from './helpers/collector-browser.mjs'
import { populationJourney } from './helpers/population-browser.mjs'
import { riskJourney } from './helpers/risk-browser.mjs'
import { openSetupScreens } from './helpers/open-browser.mjs'
import { moveInAndPrepare } from './helpers/move-in-browser.mjs'
import { readDevKey, signInAs } from '../src/modules/operator-auth/dev/sign-in-as.mjs'
const root = process.cwd(), scratch = await mkdtemp(join(tmpdir(),'evidence-browser-'))
const output = resolve(process.env.EVIDENCE_BROWSER_OUTPUT || '.cache/browser')
await mkdir(output,{recursive:true})
const queueArgs = process.env.EVIDENCE_NO_QUEUE === '1' ? ['--no-queue'] : []
const env = {...process.env,RER_SERVER_JOURNEY:'1',WRANGLER_SEND_METRICS:'false'}
// The parent verify token owns its checkout's lock. This independent checkout
// must acquire its own; retain process custody and queue policy for its children.
delete env.RER_LOCAL_OPERATION
let browser,server,serverOutput='',errors=[]
async function safeLog(text) {
 for(const name of ['.dev.vars','.rer/local/dev-key.env']) {
  try {for(const line of (await readFile(join(scratch,name),'utf8')).split('\n')) {const value=line.slice(line.indexOf('=')+1).replace(/^['"]|['"]$/g,'');if(value.length>5)text=text.split(value).join('[redacted]')}} catch {}
 }
 return text.replace(/^.*RER_OPEN.*$/gm,'[private sign-in URL withheld]').replace(/https?:\/\/\S+/g,'[URL]').slice(-8000)
}
const run = async(args) => {
 const child=spawn(process.execPath,[__rerTestEntry,...args,...(args.includes('--stop') ? [] : queueArgs)],{cwd:scratch,env,stdio:['ignore','pipe','pipe']});let log=''
 for(const stream of [child.stdout,child.stderr])stream.on('data',chunk=>{log+=chunk})
 const exit=await new Promise((done,fail)=>{child.once('error',fail);child.once('close',done)})
 // Setup/dev output can contain credentials; report phase and status only.
 assert.equal(exit,0,`rer ${args[0]} exited ${exit}: ${await safeLog(log)}`)
}
const wait = ms => new Promise(resolve=>setTimeout(resolve,ms))
const measurements=[]
async function capture(page,name) {
 await page.evaluate(()=>document.fonts.ready)
 const measure=await page.evaluate(()=>({badgeOverlapsMain:(()=>{const badge=document.querySelector('#rer-dev-badge')?.getBoundingClientRect(),main=document.querySelector('main')?.getBoundingClientRect();return !!(badge&&main&&badge.top<main.bottom&&badge.bottom>main.top)})(),width:innerWidth,scrollWidth:document.documentElement.scrollWidth,overflow:[...document.querySelectorAll('main *')].filter(el=>{const b=el.getBoundingClientRect();return b.width>0&&(b.left<0||b.right>innerWidth+1)}).map(el=>el.tagName)}))
 measurements.push({name,...measure});assert.equal(measure.badgeOverlapsMain,false,name+' dev badge covers content');assert.ok(measure.scrollWidth<=measure.width,name+' has horizontal overflow');assert.deepEqual(measure.overflow,[],name+' has clipped elements')
 await page.screenshot({path:join(output,name+'.png'),fullPage:true,mask:[page.locator('[data-secret], input[readonly]')]})
}
try {
 await cp(root,scratch,{recursive:true,filter:path=>!['node_modules','.git','.wrangler','.rer','.seed','.cache','dist','.tanstack','.dev.vars'].includes(basename(path)) && !basename(path).startsWith('.env')})
 const socket=createServer();await new Promise(resolve=>socket.listen(0,'127.0.0.1',resolve));const port=socket.address().port;await new Promise(resolve=>socket.close(resolve))
 const origin=`http://127.0.0.1:${port}`
 console.log('OPS-001: documented rer setup/dev lifecycle in disposable checkout')
 await run(['setup','--owner-email','owner@example.test','--port',String(port),'--non-interactive'])
 server=spawn(process.execPath,__rerTestEntryArgs([__rerTestEntry,'dev','--port',String(port),...queueArgs]),{cwd:scratch,env,stdio:['ignore','pipe','pipe']})
 for(const stream of [server.stdout,server.stderr])stream.on('data',chunk=>{serverOutput+=chunk})
 for(let attempt=0;attempt<720 && !serverOutput.includes('RER_READY');attempt++){if(server.exitCode!==null)throw Error('rer dev exited before ready: '+await safeLog(serverOutput));await wait(250)}
 assert.ok(serverOutput.includes('RER_READY'),'rer dev became ready')
 // Anonymous public dev paths cannot expose explorer, scheduled dispatch or files.
 for(const path of ['/cdn-cgi/local/explorer/api/','/cdn-cgi/local/explorer/api/d1','/cdn-cgi/handler/scheduled','/.rer/local/dev-key.env','/.seed/installer/state.json','/@fs/'+join(scratch,'package.json')]) {
  const response=await fetch(origin+path,{redirect:'manual'});assert.ok([403,404].includes(response.status),`${path.replace(scratch,'CHECKOUT')} returned ${response.status}`);await response.body?.cancel()
 }
 for(const as of ['admin','member']) {
  const other=await signInAs({origin,key:await readDevKey(scratch),as})
  for(const path of ['/app','/api/desk','/app/receipts/abc/download']) assert.equal((await fetch(origin+path,{headers:{cookie:other.header}})).status,403,as+' cannot read owner data')
  assert.equal((await fetch(origin+'/app/controls',{method:'POST',headers:{cookie:other.header,origin}})).status,403,as+' cannot create owner data')
 }
 const open=serverOutput.match(/^RER_OPEN (\S+)/m)?.[1]
 assert.ok(open,'rer dev printed its sign-in link')
 browser=await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
 if(process.env.EVIDENCE_BROWSER_CLAUSE === 'READINESS-001') for(const width of [1440,390]) {
  const context = await browser.newContext({viewport:{width,height:1000}}), page = await context.newPage()
  page.on('pageerror',error=>errors.push(error.message))
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text())})
  await page.goto(open)
  await page.waitForURL(url => url.pathname === '/setup' || url.pathname === '/app')
  if(new URL(page.url()).pathname === '/setup') {await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Finish setup'}).click();await page.waitForURL(url => url.pathname === '/app')}
  await readinessJourney(page,origin,width,capture)
  await context.close()
 }
 if(process.env.EVIDENCE_BROWSER_CLAUSE === 'CONTROL-001') for(const width of [1440,390]) {
  const context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage()
  page.on('pageerror',error=>errors.push(error.message))
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text())})
  await page.goto(open);await page.waitForURL(url=>url.pathname==='/setup'||url.pathname==='/app')
  if(new URL(page.url()).pathname==='/setup'){await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Finish setup'}).click();await page.waitForURL(url=>url.pathname==='/app')}
  const fixture=await controlBrowserJourney(page,origin,width,capture)
  await frameworkBrowserJourney(page,origin,width,capture,fixture)
  await context.close()
 }
 if(!['READINESS-001','CONTROL-001'].includes(process.env.EVIDENCE_BROWSER_CLAUSE)) for(const width of [1440,390]) {
  const context=await browser.newContext({viewport:{width,height:1000}})
  const page=await context.newPage()
  page.on('pageerror',error=>errors.push(error.message))
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text())})
  assert.equal((await page.goto(origin+'/')).status(),200)
  await capture(page,`${width}-lobby`)
  await page.goto(origin+'/signin')
  await capture(page,`${width}-signin`)
  await page.goto(open)
  await page.waitForURL(url=>url.pathname==='/setup'||url.pathname==='/app')
  if(new URL(page.url()).pathname==='/setup'){
   await capture(page,`${width}-setup`)
   if(width===1440){await page.setViewportSize({width:390,height:1000});await capture(page,'390-setup');await page.setViewportSize({width,height:1000})}
   await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Finish setup'}).click()
  }
  await page.waitForURL(url=>url.pathname==='/app')
  assert.equal((await context.request.get(origin+'/api/desk')).status(),200,'printed link opens the owner desk')
  await capture(page,`${width}-desk`)
  if(width===1440){
   await capture(page,'1440-desk-empty')
   await page.setViewportSize({width:390,height:1000});await capture(page,'390-desk-empty');await page.setViewportSize({width,height:1000})
  }
  await page.getByLabel('Control in plain words').fill(width===1440?'Review who can access customer data':'Security awareness training')
  await page.getByLabel('Group',{exact:true}).selectOption('Access')
  await page.getByLabel('Named proof').fill('Dated owner access review')
  await page.getByLabel('Cadence',{exact:true}).selectOption('daily')
  await page.getByRole('button',{name:'Add control',exact:true}).click()
  await page.waitForURL('**/app/requirements/*')
  const requirementURL=page.url()
  await capture(page,`${width}-requirement`)
  const today=new Date().toISOString().slice(0,10),yesterday=new Date(Date.now()-86400000).toISOString().slice(0,10)
  const original=Buffer.from(`Owner supplied access review at ${width}px`)
  await page.getByLabel('File',{exact:true}).setInputFiles({name:'access-review.html',mimeType:'text/html',buffer:original})
  await page.getByLabel('Source',{exact:true}).fill('Local review by the business owner')
  await page.getByLabel('Covered from (UTC)',{exact:true}).fill(yesterday)
  await page.getByLabel('Covered through (UTC)',{exact:true}).fill(yesterday)
  await page.getByRole('button',{name:'Store proof & issue receipt'}).click()
  await page.waitForURL('**/app/receipts/*')
  const firstURL=page.url(),firstId=new URL(firstURL).pathname.split('/').at(-1)
  const fingerprint=await page.locator('.fingerprint').textContent()
  const download=await context.request.get(firstURL+'/download');assert.equal(download.status(),200);assert.deepEqual(await download.body(),original);assert.equal(createHash('sha256').update(await download.body()).digest('hex'),fingerprint)
  assert.match(download.headers()['content-disposition'],/^attachment;/)
  const [browserDownload]=await Promise.all([page.waitForEvent('download'),page.getByRole('link',{name:'Download retained file',exact:true}).click()])
  assert.deepEqual(await readFile(await browserDownload.path()),original,'Browser attachment contains stored bytes')
  await capture(page,`${width}-receipt`)
  await page.goto(requirementURL)
  await page.getByLabel('File',{exact:true}).setInputFiles({name:'replacement.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><text>owner replacement</text></svg>')})
  await page.getByLabel('Source',{exact:true}).fill('Updated owner review')
  await page.getByLabel('Covered from (UTC)',{exact:true}).fill(today)
  await page.getByLabel('Covered through (UTC)',{exact:true}).fill(today)
  await page.getByLabel('Supersede a receipt (explicit replacement)').selectOption(firstId)
  await page.getByRole('button',{name:'Store proof & issue receipt'}).click();await page.waitForURL('**/app/receipts/*')
  await page.goto(requirementURL+'?date='+yesterday)
  assert.match(await page.locator('.state').textContent(),/superseded-only/)
  assert.equal(await page.getByRole('heading',{name:'Receipt history'}).count(),1)
  assert.equal(await page.locator('section article').count(),2)
  await capture(page,`${width}-history`)
  await page.goto(firstURL);assert.match(await page.locator('main').textContent(),/Superseded by/)
  assert.deepEqual(await (await context.request.get(firstURL+'/download')).body(),original)
  await page.goto(origin+'/app?date='+yesterday);await capture(page,`${width}-gap`);await capture(page,`${width}-desk`)
  await moveInAndPrepare(page,origin,width,capture,scratch)
  await openSetupScreens(page, origin, width, capture)
  await riskJourney(page, origin, width, capture)
  await populationJourney(page, origin, width, capture)
  await collectorJourney(page, origin, width, capture)
  const controlFixture=await controlBrowserJourney(page,origin,width,capture)
  await frameworkBrowserJourney(page,origin,width,capture,controlFixture)
  await context.close()
 }
 assert.deepEqual(errors,[],'No browser runtime or console errors')
 await writeFile(join(output,'report.json'),JSON.stringify(process.env.EVIDENCE_BROWSER_CLAUSE === 'READINESS-001' ? {journeys:2,viewports:[1440,390],errors,measurements,clause:'READINESS-001'} : {journeys:2,viewports:[1440,390],errors,measurements,privatePaths:'all refused 403/404',downloadDigest:'independently matched',supersession:'facts and bytes retained'},null,2)+'\n')
 console.log(process.env.EVIDENCE_BROWSER_CLAUSE === 'CONTROL-001' ? 'PASS CONTROL-001 browser owner journeys at 1440 and 390: definitions, exact observations, reviewed imports, history and readiness.' : process.env.EVIDENCE_BROWSER_CLAUSE === 'READINESS-001' ? 'PASS READINESS-001 browser owner journeys: 1440 and 390; readiness, denominator, sources, filters and CSV; no errors or horizontal overflow.' : 'PASS browser owner journeys: 1440 and 390; downloads, replacement, history, gaps, no errors or horizontal overflow; private dev paths refused.')
} catch(error) {
 // Navigation failures can include the credential-bearing printed URL.
 const sanitized=await safeLog(error.stack ?? error.message)
 await writeFile(join(output,'failure.txt'),sanitized)
 console.error('Browser failure: '+sanitized.split('\n').filter(line=>/failed|error|exit|refus|missing|Error|Unexpected/i.test(line)).join('\n'))
 throw new Error(sanitized)
} finally {
 await browser?.close()
 if(server && server.exitCode===null && server.signalCode===null){server.kill('SIGTERM');await new Promise(resolve=>server.once('close',resolve))}
 await rm(scratch,{recursive:true,force:true,maxRetries:3,retryDelay:100})
}
