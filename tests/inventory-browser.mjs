process.env.RER_SERVER_JOURNEY='1'
import assert from 'node:assert/strict'
import {mkdir} from 'node:fs/promises'
import {resolve,join} from 'node:path'
import {chromium} from 'playwright'
import {installation,signIn} from './helpers/review-browser-runtime.mjs'
import {inventoryFixture} from './helpers/inventory-fixture.mjs'
const output=resolve(process.env.EVIDENCE_BROWSER_OUTPUT||'.cache/inventory-browser')
await mkdir(output,{recursive:true})
let browser,app
try {
 for(const width of [1440,390]) {
  app=await installation(process.cwd())
  const open=await app.start()
  browser ||= await chromium.launch({headless:true,args:['--use-mock-keychain','--password-store=basic']})
  const context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage(),errors=[]
  page.on('pageerror',error=>errors.push(error.message))
  await signIn(page,open)
  const request=context.request,origin=app.origin
  const get=async path=>{const r=await request.get(origin+path);assert.equal(r.status(),200,path);return r.json()}
  const post=async(path,body,status=201)=>{const r=await request.post(origin+path,{headers:{origin},data:body});assert.equal(r.status(),status,path);return r.json()}
  const put=async(token,path,body,method='PUT',status=200)=>{const r=await request.fetch(origin+path,{method,headers:{authorization:'Bearer '+token},data:body});assert.equal(r.status(),status,path);return r.json()}
  const population=async(kind,source,csv)=>{
   const multipart={kind,source_system:source,as_of:new Date().toISOString().slice(0,10),refresh_days:'30',file:{name:kind+'.csv',mimeType:'text/csv',buffer:Buffer.from(csv)}}
   const dry=await request.post(origin+'/api/populations',{headers:{origin},multipart});assert.equal(dry.status(),200)
   const admitted=await request.post(origin+'/api/populations',{headers:{origin},multipart:{...multipart,confirm:'yes',sha256:(await dry.json()).sha256}});assert.equal(admitted.status(),201);return admitted.json()
  }
  const fixture=await inventoryFixture({get,post,put,population})
  const capture=async name=>{
   await page.evaluate(()=>document.fonts.ready)
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),name+' horizontal overflow')
   await page.screenshot({path:join(output,`${width}-${name}.png`),fullPage:true})
  }
  await page.goto(origin+'/app/inventory')
  await page.getByRole('heading',{name:'Inventory scope',exact:true}).waitFor()
  assert.match(await page.locator('[aria-labelledby="inv-people"]').innerText(),/no account found/)
  await capture('INVENTORY-001-initial')
  const initial=await get('/api/inventory'),deviceKeys=initial.records.filter(r=>r.kind==='device').map(r=>r.source_key)
  const form=page.locator('form[action="/app/inventory/groups"]').first()
  await form.getByRole('checkbox',{name:'Select Morgan Lane (morgan@northstar.test) from People',exact:true}).first().check()
  const firstDevice=initial.records.find(r=>r.source_key===deviceKeys[0])
  await form.getByRole('checkbox',{name:`Select ${firstDevice.name} from ${firstDevice.source_label}`,exact:true}).check()
  await form.getByLabel('Reason',{exact:true}).fill('Attempt incompatible kinds; verify refusal preserves all source rows')
  await form.getByRole('button',{name:'Record grouping decision',exact:true}).click()
  await page.getByRole('heading',{name:'Could not save',exact:true}).waitFor()
  assert.match(await page.locator('main').innerText(),/same kind/)
  await capture('INVENTORY-001-refused')
  await page.getByRole('link',{name:'Go back',exact:true}).click()
  assert.deepEqual((await get('/api/inventory')).counts,initial.counts)

  for(const record of initial.records.filter(r=>deviceKeys.includes(r.source_key)))await form.getByRole('checkbox',{name:`Select ${record.name} from ${record.source_label}`,exact:true}).check()
  await form.getByLabel('Reason',{exact:true}).fill('Compared both source lists; one physical laptop, keep both rows')
  await form.getByRole('button',{name:'Record grouping decision',exact:true}).click()
  await page.waitForURL('**/app/inventory')
  const grouped=await get('/api/inventory');assert.equal(grouped.counts.canonical,initial.counts.canonical-1);assert.equal(grouped.counts.source_rows,initial.counts.source_rows)
  await capture('INVENTORY-001-grouped')
  const resource=grouped.records.find(r=>r.source_id===fixture.resource.id)
  await page.getByRole('link',{name:'Billing production service',exact:true}).click()
  await page.getByRole('heading',{name:'Record metadata',exact:true}).waitFor()
  await page.getByLabel('Record owner',{exact:true}).selectOption(fixture.unmatched.id)
  await page.getByLabel('Criticality',{exact:true}).selectOption('critical')
  await page.getByLabel('Scope',{exact:true}).selectOption('excluded')
  await page.getByLabel('Lifecycle',{exact:true}).selectOption('retired')
  await page.getByLabel('Reason',{exact:true}).fill('Out of audit scope; retain the original failure and history')
  await page.getByRole('button',{name:'Save metadata decision',exact:true}).click()
  await page.getByRole('heading',{name:'Review history',exact:true}).waitFor()
  assert.match(await page.locator('[aria-labelledby="inv-history"]').innerText(),/Out of audit scope/)
  await capture('INVENTORY-001-metadata')
  const before=(await get('/api/tests/'+fixture.test.id)).latest
  assert.equal(before.length,1);assert.equal(before[0].result,'fail')
  await page.getByRole('link',{name:'Back to Inventory',exact:true}).click()
  const final=await get('/api/inventory')
  assert.equal(final.people.find(p=>p.id===fixture.unmatched.id).account_status,'no account found')
  await capture('INVENTORY-001-final')
  const exported=await request.get(origin+'/app/inventory/export?format=json');assert.equal(exported.status(),200);assert.deepEqual((await exported.json()).counts,final.counts)
  const csv=await request.get(origin+'/app/inventory/export?format=csv');assert.equal(csv.status(),200);assert.match(await csv.text(),/Out of audit scope/)
  await page.goto(origin+'/app/inventory/record?source_key='+encodeURIComponent(deviceKeys[1]))
  await page.getByRole('heading',{name:'Canonical members',exact:true}).waitFor()
  await capture('INVENTORY-001-group-detail')
  await page.getByLabel('Reason to separate this member',{exact:true}).fill('Reviewed source lists independently; keep both identities separate')
  await page.getByRole('button',{name:'Separate this source record',exact:true}).click()
  await page.waitForURL('**/app/inventory')
  const separate=await get('/api/inventory');assert.equal(new Set(separate.records.filter(r=>deviceKeys.includes(r.source_key)).map(r=>r.canonical_key)).size,2)
  await capture('INVENTORY-001-separated')
  assert.deepEqual((await get('/api/tests/'+fixture.test.id)).latest,before)
  assert.deepEqual(errors,[])
  await context.close();await app.close();app=null
 }
 console.log('PASS INVENTORY-001 installed console grouping, scope export, retained failure, no-account ownership and metadata at 1440/390.')
}finally{await browser?.close();await app?.close()}
