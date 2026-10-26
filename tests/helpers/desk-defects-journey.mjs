import assert from 'node:assert/strict'
import { runtime } from './runtime.mjs'
import { browserBridge } from './browser-bridge.mjs'
import { retainedFormsJourney } from './refused-forms-browser.mjs'

// Native one-off defect probes, with mail controlled only at its network edge.
const app = await runtime(), failures = []
const probe = async (name, run) => { try { await run(); console.log('PASS ' + name) } catch (error) { failures.push(error); console.log('FAIL ' + name + ': ' + error.message) } }
let bridge
try {
 const cookie = await app.signin()
 await app.clock('2026-10-26T12:00:00Z')
 const created = await app.fetch('/app/controls', { method:'POST',headers:{ origin:app.origin,'content-type':'application/x-www-form-urlencoded' },body:new URLSearchParams({ name:'Quarterly access review',group:'Access',proof:'Signed access review',cadence:'quarterly' }) })
 assert.equal(created.status,303)
 const requirementPath = created.headers.get('location'), id = requirementPath.split('/').at(-1)
 const form = new FormData()
 for(const[k,v]of Object.entries({source:'Completed third-quarter access review',covered_from:'2026-07-01',covered_to:'2026-09-30'}))form.set(k,v)
 form.set('file',new File(['Signed third-quarter review'],'access-review.txt'))
 assert.equal((await app.fetch(requirementPath+'/uploads',{method:'POST',headers:{origin:app.origin},body:form})).status,303)
 const row = (await(await app.fetch('/api/desk')).json()).requirements.find(r=>r.id===id)
 await probe('Expired proof deadline explains the current overdue state', async()=>{
  assert.equal(row.gap,'overdue');assert.equal(row.renewal.due,'2026-10-01');assert.equal(row.renewal.expired_on,row.renewal.due)
  const history=(await(await app.fetch('/api/desk?date=2026-08-15')).json()).requirements.find(r=>r.id===id)
  assert.equal(history.gap,'covered');assert.equal(history.renewal.due,row.renewal.due)
  await app.tick()
  const reminder=app.messages.find(m=>m.subject==='Overdue: Signed access review')
  assert.ok(reminder);assert.match(reminder.text??reminder.html,/was due.*2026-10-01/)
 })
 bridge=await browserBridge(app,'desk-defects')
 for(const width of [1440,390]) {
  const context=await bridge.context(width,cookie),page=await context.newPage()
  await probe('Desk definition link accepts a pointer click at '+width,async()=>{
   await page.goto(bridge.origin+'/app')
   const card=page.locator('article').filter({has:page.getByRole('heading',{name:'Quarterly access review',exact:true})})
   const link=card.getByRole('link',{name:'Control definition & mappings',exact:true})
   await link.click({timeout:3000})
   assert.equal(new URL(page.url()).pathname,'/app/controls/'+row.control_id)
   await bridge.capture(page,'control-definition')
   await page.goto(bridge.origin+'/app')
   await card.getByRole('link',{name:/Upload proof/}).click()
   assert.equal(new URL(page.url()).pathname,requirementPath)
   await bridge.capture(page,'overdue-requirement')
   await page.goto(bridge.origin+'/app');await bridge.capture(page,'overdue-desk')
  })
  await probe('Refused form values at '+width,()=>retainedFormsJourney(page,bridge.origin,width,(p,n)=>bridge.capture(p,n),'2026-10-26'))
  await context.close()
 }
 if(failures.length)throw new AggregateError(failures,'Unresolved native defect probes: '+failures.length)
}finally{if(bridge)await bridge.close();await app.close()}
