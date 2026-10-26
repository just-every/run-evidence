import './engagement-browser.mjs'
import {decodeArchive} from './helpers/portable-format.mjs'
// Real dev, two clean installations, independent owner/reviewer contexts.
process.env.RER_SERVER_JOURNEY='1'
import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { createHash } from 'node:crypto'
import { chromium } from 'playwright'
import { installation, signIn, sanitize, wait } from './helpers/review-browser-runtime.mjs'
import { inspectArchive } from './helpers/review-browser-archive.mjs'
import { portableBrowserJourney } from './helpers/portable-browser.mjs'

const output=resolve(process.env.EVIDENCE_BROWSER_OUTPUT||'.cache/review-browser')
await mkdir(output,{recursive:true})
const measurements=[],errors=[],comparisons=[],installations=[],expectedRefusals=[],folderIssues=[]
let browser
const digest=bytes=>createHash('sha256').update(bytes).digest('hex')
async function capture(page,name) {
 await page.evaluate(()=>document.fonts.ready)
 const measurement=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,clipped:[...document.querySelectorAll('main input,main button,main select,main article,main section,main a,main code')].filter(el=>{const b=el.getBoundingClientRect();return b.width>0&&(b.left<0||b.right>innerWidth+1)}).map(el=>el.tagName)}))
 measurements.push({name,...measurement})
 assert.ok(measurement.scrollWidth<=measurement.width,name+' horizontal overflow')
 assert.deepEqual(measurement.clipped,[],name+' clipped controls')
 // The capability field is intentionally masked, even on the one-time page.
 await page.screenshot({path:join(output,name+'.png'),fullPage:true,mask:[page.locator('input[readonly]')]})
}
async function context(width,origin) {
 const result=await browser.newContext({viewport:{width,height:1000},permissions:['clipboard-read','clipboard-write']})
 await result.grantPermissions(['clipboard-read','clipboard-write'],{origin})
 const page=await result.newPage()
 const client={context:result,page,expectRefusal:false}
 page.on('pageerror',error=>errors.push(sanitize(error.message)))
 page.on('console',message=>{if(message.type()==='error'){
  const text=sanitize(message.text())
  if(client.expectRefusal&&/Failed to load resource.*404/.test(text))expectedRefusals.push('expected closed/expired navigation 404')
  else if(client.archiveRefusal&&/Failed to load resource.*400/.test(text)&&message.location().url.includes('/api/archive/uploads/'))expectedRefusals.push('expected invalid erasure journal 400')
  else errors.push(text)
 }})
 return client
}
async function control(page,origin,name,bytes,today) {
 await page.goto(origin+'/app')
 await page.getByLabel('Control in plain words').fill(name)
 await page.getByLabel('Group',{exact:true}).selectOption('Access')
 await page.getByLabel('Named proof').fill('Dated review evidence')
 await page.getByLabel('Cadence',{exact:true}).selectOption('daily')
 await page.getByRole('button',{name:'Add control',exact:true}).click()
 await page.waitForURL('**/app/requirements/*')
 const requirement=page.url()
 if(bytes){
  await page.getByLabel('File',{exact:true}).setInputFiles({name:'review-evidence.html',mimeType:'text/html',buffer:bytes})
  await page.getByLabel('Source',{exact:true}).fill('Owner supplied dated review')
  await page.getByLabel('Covered from (UTC)',{exact:true}).fill(today)
  await page.getByLabel('Covered through (UTC)',{exact:true}).fill(today)
  await page.getByRole('button',{name:'Store proof & issue receipt'}).click()
  await page.waitForURL('**/app/receipts/*')
 }
 return {requirement,receipt:bytes?page.url():null}
}
async function deskSnapshot(owner,origin) {
 const response=await owner.context.request.get(origin+'/api/desk')
 assert.equal(response.status(),200,'owner desk available')
 return response.json()
}
async function issue(page,origin,today,label,expiry) {
 await page.goto(origin+'/app/folders')
 const form=page.locator('form[action="/app/folders"]')
 await form.locator('[name="reviewer_label"]').fill(label)
 await form.locator('[name="period_from"]').fill(today)
 await form.locator('[name="period_to"]').fill(today)
 // datetime-local canonical values omit a zero seconds component. Preserve the
 // exact instant while using the browser's accepted native input representation.
 const expiryValue=expiry.toISOString().slice(0,19).replace(/:00$/,'')
 await form.locator('[name="expires_at"]').fill(expiryValue)
 const boxes=form.locator('[name="control_ids"]')
 const count=await boxes.count();assert.equal(count,3,'all owner controls selectable')
 // Select by public accessible labels rather than database identity/order.
 await form.getByRole('checkbox',{name:'Selected access review · Access',exact:true}).check()
 await form.getByRole('checkbox',{name:'Selected missing review · Access',exact:true}).check()
 const [response]=await Promise.all([
  page.waitForResponse(response=>new URL(response.url()).pathname==='/app/folders'&&response.request().method()==='POST'),
  form.locator('button[type="submit"],button:not([type])').click(),
 ])
 if(response.status()!==303){
  const requestOrigin=response.request().headers().origin
  const observation={status:response.status(),requestOrigin:requestOrigin==='null'?'null':requestOrigin?'present':'absent',body:sanitize(await response.text())}
  await writeFile(join(output,'folder-issue-refused.json'),JSON.stringify(observation,null,2)+'\n')
  await page.screenshot({path:join(output,`${page.viewportSize().width}-issue-refused.png`),fullPage:true,mask:[page.locator('input[readonly]')]})
  throw Error('Owner folder issue failed: '+JSON.stringify(observation))
 }
 assert.ok(response.request().headers().origin===origin,'successful owner form preserves its same-origin header')
 folderIssues.push({width:page.viewportSize().width,status:response.status(),requestOrigin:'same-origin'})
 assert.equal(new URL(response.headers().location,origin).pathname,'/app/folders','issuance redirects to a GET page')
 const field=page.locator('input[readonly]')
 await field.waitFor()
 const url=await field.inputValue()
 assert.ok(new URL(url).pathname.startsWith('/review/'),'issued reviewer URL')
 // Clipboard access belongs to the active window. A reviewer context may
 // have taken focus since the owner's previous navigation.
 await page.bringToFront()
 await page.waitForFunction(()=>document.hasFocus())
 await page.getByRole('button',{name:'Copy link',exact:true}).click()
 await page.waitForFunction(expected=>navigator.clipboard.readText().then(actual=>actual===expected),url)
 return url
}
async function refused(viewer,url) {
 const response=await viewer.context.request.get(url)
 assert.equal(response.status(),404,'closed reviewer door refuses')
 const result={body:await response.text(),type:response.headers()['content-type']}
 assert.match(result.type,/^text\/plain/,'refusal is plain text')
 return result
}
async function compareDesk(owner,origin,before) {
 const after=await deskSnapshot(owner,origin)
 assert.deepEqual(after,before,'restored controls, receipt facts and availability match source desk')
 const receipts=before.requirements.flatMap(row=>row.receipts)
 for(const row of receipts){
  const response=await owner.context.request.get(origin+'/app/receipts/'+row.id+'/download')
  assert.equal(response.status(),200,'restored file downloads')
  assert.equal(digest(await response.body()),row.sha256,'restored bytes match source receipt')
 }
 return {controls:before.requirements.length,receipts:receipts.length,files:receipts.length,deskDifferences:0,fileDifferences:0}
}
async function compareArchive(owner,origin,before) {
 const response=await owner.context.request.get(origin+'/api/archive/manifest')
 assert.equal(response.status(),200,'restored manifest available to owner')
 const after=decodeArchive(Buffer.from(await(await owner.context.request.get(origin+'/api/archive/export')).body())).manifest
 for(const [table,rows] of Object.entries(before.rows)){
  if(table==='review_folders'){
   assert.ok(after.rows[table].every(row=>row.closed_at),'every restored folder is closed')
   const omitClosure=values=>values.map(({closed_at,...rest})=>rest)
   assert.deepEqual(omitClosure(after.rows[table]),omitClosure(rows),'folder facts preserved except closure')
  } else assert.deepEqual(after.rows[table],rows,'archive rows preserved: '+table)
 }
 assert.deepEqual(after.files,before.files,'restored file inventory matches source')
}

try {
 for(const width of [1440,390]) {
  const source=await installation(process.cwd());installations.push(source)
  const target=await installation(process.cwd());installations.push(target)
  const open=await source.start()
  browser ||= await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
  const owner=await context(width,source.origin)
  await signIn(owner.page,open)
  const today=new Date().toISOString().slice(0,10)
  const bytes=Buffer.from('<html><body>Owner supplied evidence; never rendered.</body></html>')
  const selected=await control(owner.page,source.origin,'Selected access review',bytes,today)
  const priorId=new URL(selected.receipt).pathname.split('/').at(-1)
  await owner.page.goto(selected.requirement)
  await owner.page.getByLabel('File',{exact:true}).setInputFiles({name:'replacement-review.html',mimeType:'text/html',buffer:bytes})
  await owner.page.getByLabel('Source',{exact:true}).fill('Later owner review replaces prior receipt')
  await owner.page.getByLabel('Covered from (UTC)',{exact:true}).fill(today)
  await owner.page.getByLabel('Covered through (UTC)',{exact:true}).fill(today)
  await owner.page.getByLabel('Supersede a receipt (explicit replacement)').selectOption(priorId)
  await owner.page.getByRole('button',{name:'Store proof & issue receipt'}).click()
  await owner.page.waitForURL('**/app/receipts/*')
  await control(owner.page,source.origin,'Selected missing review',null,today)
  await control(owner.page,source.origin,'Private excluded control',bytes,today)
  await capture(owner.page,`${width}-owner-receipt`)
  const reviewURL=await issue(owner.page,source.origin,today,'External reviewer',new Date(Date.now()+3600000))
  await capture(owner.page,`${width}-issued`)
  const viewer=await context(width,source.origin)
  assert.equal((await viewer.context.cookies()).length,0,'reviewer begins without owner cookies')
  await viewer.page.goto(reviewURL)
  const reviewText=await viewer.page.locator('main').textContent()
  assert.ok(reviewText.includes('Selected access review')&&reviewText.includes('Selected missing review'),'viewer sees selected controls')
  assert.ok(!reviewText.includes('Private excluded control')&&!reviewText.includes('owner@example.test'),'viewer omits other controls and owner account')
  assert.match(reviewText,/missing/,'selected missing control retains gap')
  assert.match(reviewText,/fingerprint/i,'reviewer sees fingerprint caveat')
  await capture(viewer.page,`${width}-reviewer`)
  await viewer.page.locator('a[href$="/view"]').first().click()
  const receiptRecord=await viewer.context.request.get(viewer.page.url().replace(/\/view$/,''))
  assert.equal((await receiptRecord.json()).origin,'manually-asserted','reviewer receipt retains origin through its record door')
  const downloadLink=await viewer.page.locator('a[href$="/download"]').getAttribute('href')
  const staleDownload=new URL(downloadLink,source.origin).href
  const [file]=await Promise.all([viewer.page.waitForEvent('download'),viewer.page.locator('a[href$="/download"]').click()])
  assert.ok((await readFile(await file.path())).equals(bytes),'reviewer attachment contains original bytes')
  await capture(viewer.page,`${width}-reviewer-receipt`)
  await owner.page.goto(source.origin+'/app/folders')
  assert.equal(await owner.page.locator('input[readonly]').count(),0,'owner revisit cannot recover link')
  await capture(owner.page,`${width}-folders`)
  await owner.page.getByRole('link',{name:'View all access events'}).click()
  await capture(owner.page,`${width}-access-log`)
  await owner.page.goto(source.origin+'/app/folders')
  const closing=owner.page.locator('form[action$="/close"]')
  assert.equal(await closing.count(),1,'one issued folder can close')
  await closing.locator('button').click()
  viewer.expectRefusal=true
  const closed=await viewer.page.goto(reviewURL)
  assert.equal(closed.status(),404,'viewer reload immediately refuses after closure')
  assert.deepEqual(await refused(viewer,staleDownload),await refused(viewer,reviewURL),'stale attachment and page have uniform refusal')
  await capture(owner.page,`${width}-closed`)
  const expires=new Date(Math.floor((Date.now()+15000)/1000)*1000)
  const expiring=await issue(owner.page,source.origin,today,'Short review',expires)
  viewer.expectRefusal=false
  assert.equal((await viewer.page.goto(expiring)).status(),200,'near-expiry link works before edge')
  await wait(Math.max(0,expires.getTime()-Date.now()+100))
  viewer.expectRefusal=true
  assert.equal((await viewer.page.reload()).status(),404,'real-clock expiry refuses at edge')
  assert.deepEqual(await refused(viewer,expiring),await refused(viewer,reviewURL),'expired and closed doors have uniform refusal')
  await viewer.context.close()
  const before=await deskSnapshot(owner,source.origin)
  assert.ok(before.requirements.flatMap(row=>row.receipts).some(row=>row.superseded_by),'source includes replacement history')
  await owner.page.goto(source.origin+'/app/archive')
  await capture(owner.page,`${width}-archive`)
  const [archiveDownload]=await Promise.all([owner.page.waitForEvent('download'),owner.page.getByRole('link',{name:/Download archive/}).click()])
  const archiveBytes=await readFile(await archiveDownload.path())
  for(const issued of [reviewURL,expiring])assert.ok(!archiveBytes.includes(Buffer.from(new URL(issued).pathname.split('/').at(-1))),'archive omits bearer tokens')
  const inspected=inspectArchive(archiveBytes)
  assert.equal(inspected.summary.receipts,before.requirements.flatMap(row=>row.receipts).length,'archive includes every desk receipt')
  const journalResponse=await owner.context.request.get(source.origin+'/api/archive/journal');assert.equal(journalResponse.status(),200)
  const journalBytes=await journalResponse.body()
  await owner.context.close();await source.stop()
  const restored=await context(width,target.origin)
  await signIn(restored.page,await target.start())
  assert.equal((await deskSnapshot(restored,target.origin)).requirements.length,0,'restore destination has independently empty business data')
  await portableBrowserJourney({targetPage:restored.page,archiveBytes,journalBytes,artifacts:output,width,capture,expectJournalRefusal:value=>{restored.archiveRefusal=value}})
  await capture(restored.page,`${width}-PORTABLE-001-restored-archive`)
  comparisons.push({width,...await compareDesk(restored,target.origin,before),archive:inspected.summary})
  await compareArchive(restored,target.origin,inspected.manifest)
  await restored.page.goto(target.origin+'/app')
  await capture(restored.page,`${width}-restored-desk`)
  await restored.page.goto(target.origin+new URL(selected.receipt).pathname)
  await capture(restored.page,`${width}-restored-receipt`)
  await restored.page.goto(target.origin+'/app/folders')
  assert.equal(await restored.page.locator('form[action$="/close"]').count(),0,'restored folders have no open access')
  await capture(restored.page,`${width}-restored-folders`)
  const independent=await context(width,target.origin);independent.expectRefusal=true
  assert.equal((await independent.page.goto(target.origin+new URL(reviewURL).pathname)).status(),404,'original grant cannot open restored folder')
  await independent.context.close();await restored.context.close();await target.stop()
 }
 assert.deepEqual(errors,[],'No browser runtime or console errors')
 await writeFile(join(output,'report.json'),JSON.stringify({viewports:[1440,390],errors,expectedRefusals,folderIssues,measurements,comparisons},null,2)+'\n')
 console.log('PASS PORTABLE-001 and r2 browser journeys at 1440 and 390; independent review, closure, real expiry, archive round trip, zero overflow/errors.')
} catch(error) {
 await writeFile(join(output,'failure.json'),JSON.stringify({error:sanitize(error.message),errors,measurements,comparisons},null,2)+'\n')
 throw new Error(sanitize(error.stack ?? error.message))
}
finally {
 const cleanup=await Promise.allSettled([browser?.close(),...installations.reverse().map(item=>item.close())])
 assert.ok(cleanup.every(result=>result.status==='fulfilled'),'every scratch installation stopped and removed')
}
