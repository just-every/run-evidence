import { step } from './helpers/step.mjs'
process.env.RER_SERVER_JOURNEY = '1'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { frameworkJourney } from './helpers/framework-journey.mjs'
import { controlJourney, controlArchiveJourney } from './helpers/control-journey.mjs'
import { runtime } from './helpers/runtime.mjs'
const app = await runtime()
let passed = 0
const scenario = async (name,fn) => {await fn();passed++;console.log('PASS '+name)}
const rows = async(date) => {const response=await app.fetch('/api/desk'+(date?'?date='+date:''));assert.equal(response.status,200);return (await response.json()).requirements}
const upload = async(id,fields={},bytes='real stored exhibit',filename='proof.txt') => {
 const form = new FormData();for(const [k,v] of Object.entries({source:'Owner access review',covered_from:'2026-10-11',covered_to:'2026-10-11',...fields})) form.set(k,v)
 form.set('file',new File([bytes],filename,{type:filename.endsWith('svg')?'image/svg+xml':'text/html'}))
 return app.fetch('/app/requirements/'+id+'/uploads',{method:'POST',headers:{origin:app.origin},body:form})
}
const readReceipt=async(response)=>{assert.equal(response.status,303,await response.clone().text());return (await app.fetch(response.headers.get('location').replace('/app/','/api/'))).json()}
let requirement,first,second,cookie
const primary = async(date) => (await rows(date)).find(r=>r.id===requirement)
try {
 await scenario("PUBLIC-001 / AUTH-001: first-run Lobby leads to an authenticated empty owner desk", async () => {
  await step('Installed Lobby exposes only first-run state before and after owner setup',async()=>{
    const state=await app.fetch('/setup/state');assert.equal(state.status,200);assert.equal((await state.json()).state,'unclaimed')
    const lobby=await app.fetch('/');assert.equal(lobby.status,200);assert.match(await lobby.text(),/href="\/setup"/)
    assert.equal((await app.fetch('/setup/state',{headers:{host:'evil.test'}})).status,404)
   })
   await step('Owner routes refuse anonymous, invalid sessions and cross-origin requests',async()=>{
    for(const path of ['/app','/api/desk','/app/requirements/abc','/app/receipts/abc','/app/receipts/abc/download','/api/receipts/abc','/api/receipts/abc/download']) for(const cookie of ['', 'operator_session_local=invalid']) assert.equal((await app.fetch(path,{headers:{cookie}})).status,401,path)
    for(const path of ['/app/controls','/app/requirements/abc/uploads']) assert.equal((await app.fetch(path,{method:'POST',headers:{origin:app.origin}})).status,401)
    cookie=await app.signin()
    assert.equal((await (await app.fetch('/setup/state')).json()).state,'claimed')
    const lobby=await app.fetch('/',{headers:{cookie:''}});assert.equal(lobby.status,200)
    const signIn = (await lobby.text()).match(/href="([^"]*\/signin[^"]*)"/)
    assert.ok(signIn)
    const target = new URL(signIn[1], app.origin)
    assert.equal(target.pathname, '/signin')
    assert.equal(target.searchParams.get('login_hint'), 'owner@example.test')

    for(const headers of [{origin:'https://evil.test'},{'sec-fetch-site':'cross-site'},{host:'evil.test'}]) assert.equal((await app.fetch('/api/desk',{headers})).status,403)
    for(const headers of [{},{origin:'https://evil.test'}]) assert.equal((await app.fetch('/app/controls',{method:'POST',headers})).status,403)
   })
   await step('Empty authenticated desk has no invented controls',async()=>{assert.deepEqual(await rows(),[]);assert.equal((await app.fetch('/app')).status,200)})
 })
 await scenario("PROOF-001: create a requirement, store attributable bytes and refuse unsafe uploads", async () => {
  await step('Control and named proof persist through a real runtime restart',async()=>{
    const response=await app.fetch('/app/controls',{method:'POST',headers:{origin:app.origin,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({name:'Review production access',group:'Access',proof:'Dated review',cadence:'daily'})})
    assert.equal(response.status,303);requirement=(await rows())[0].id
    await app.clock('2026-10-11T12:00:01Z');const [row]=await rows();assert.equal(row.id,requirement);assert.equal(row.gap,'missing');assert.equal(row.control_name,'Review production access')
   })
   await step('Stored-byte receipt resists caller-forged facts and downloads hostile content safely',async()=>{
    first=await readReceipt(await upload(requirement,{origin:'source-observed',added_by:'forged',added_at:'1900-01-01',sha256:'fake'},'<script>globalThis.pwned=true</script>','../../hostile.html'))
    assert.equal(first.origin,'manually-asserted');assert.notEqual(first.added_by,'forged');assert.equal(first.added_by_name,'Evidence owner');assert.equal(first.added_at,'2026-10-11T12:00:01.000Z');assert.equal(first.source,'Owner access review')
    assert.match(first.object_key,/^exhibits\/[a-f0-9-]+$/);assert.ok(!first.object_key.includes('hostile'))
    const file=await app.fetch('/app/receipts/'+first.id+'/download');const bytes=Buffer.from(await file.arrayBuffer());assert.equal(bytes.toString(),'<script>globalThis.pwned=true</script>');assert.equal(createHash('sha256').update(bytes).digest('hex'),first.sha256)
    assert.match(file.headers.get('content-disposition'),/^attachment;/);assert.equal(file.headers.get('x-content-type-options'),'nosniff');assert.equal(file.headers.get('content-type'),'application/octet-stream');assert.ok(!(await (await app.fetch('/app/receipts/'+first.id)).text()).includes('<script>globalThis.pwned'))
   })
   await step('Invalid periods and bounded oversized uploads refuse without receipts',async()=>{
    for(const fields of [{covered_from:'2026-02-30'},{covered_to:'2026-10-10'},{covered_from:'tomorrow'}]) assert.equal((await upload(requirement,fields)).status,400)
    assert.equal((await upload(requirement,{},new Uint8Array(10*1024*1024+1))).status,413)
    const stream=new ReadableStream({start(controller){for(let i=0;i<12;i++)controller.enqueue(new Uint8Array(1024*1024));controller.close()}})
    assert.equal((await app.fetch('/app/requirements/'+requirement+'/uploads',{method:'POST',headers:{origin:app.origin,'content-type':'multipart/form-data; boundary=x'},body:stream,duplex:'half'})).status,413)
    assert.equal((await primary()).receipts.length,1)
   })
 })
 await scenario('Cadence advances covered to due soon to overdue without changing business rows',async()=>{
  assert.equal((await primary()).gap,'covered');await app.clock('2026-10-11T20:00:00Z');assert.equal((await primary()).gap,'due soon');await app.clock('2026-10-12T00:00:00Z');assert.equal((await primary()).gap,'overdue')
  assert.equal((await primary('2026-10-11')).gap,'covered')
  for(const [cadence,from,to,early,soon,late] of [
   ['weekly','2026-10-12','2026-10-18','2026-10-12T12:00:00Z','2026-10-18T12:00:00Z','2026-10-19T00:00:00Z'],
   ['monthly','2026-02-01','2026-02-28','2026-02-01T12:00:00Z','2026-02-28T12:00:00Z','2026-03-01T00:00:00Z'],
   ['quarterly','2026-01-01','2026-03-31','2026-01-02T12:00:00Z','2026-03-30T12:00:00Z','2026-04-01T00:00:00Z']]) {
   const response=await app.fetch('/app/controls',{method:'POST',headers:{origin:app.origin,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({name:cadence+' review',group:'Data',proof:'Period proof',cadence})})
   assert.equal(response.status,303);const id=response.headers.get('location').split('/').at(-1)
   await readReceipt(await upload(id,{covered_from:from,covered_to:to}))
   for(const [time,expected] of [[early,'covered'],[soon,'due soon'],[late,'overdue']]) {await app.clock(time);assert.equal((await rows()).find(r=>r.id===id).gap,expected,cadence+' '+time)}
   const overdue=(await rows()).find(r=>r.id===id);assert.equal(overdue.renewal.due,late.slice(0,10));assert.equal(overdue.renewal.expired_on,overdue.renewal.due)
   await app.clock(new Date(Date.parse(late)+14*86400000).toISOString());assert.equal((await rows()).find(r=>r.id===id).renewal.due,late.slice(0,10))
  }
  await app.clock('2026-10-12T00:00:00Z')
 })
 await scenario("PROOF-001: replace an exhibit without rewriting facts and refuse unavailable bytes", async () => {
  await step('Explicit supersession appends a relationship and retains original facts and bytes',async()=>{
    second=await readReceipt(await upload(requirement,{supersedes:first.id,covered_from:'2026-10-12',covered_to:'2026-10-12'},'<svg onload="alert(1)"></svg>','proof.svg'))
    assert.equal(second.supersedes,first.id);assert.notEqual(second.object_key,first.object_key)
    const old=await (await app.fetch('/api/receipts/'+first.id)).json();const {superseded_by,...facts}=old;assert.equal(superseded_by,second.id);const {superseded_by:was,...before}=first;assert.deepEqual(facts,before)
    assert.equal((await app.fetch('/app/receipts/'+first.id+'/download')).status,200);assert.equal((await primary('2026-10-11')).gap,'superseded-only')
    assert.equal((await upload(requirement,{supersedes:first.id})).status,409)
    const svg=await app.fetch('/app/receipts/'+second.id+'/download');assert.match(svg.headers.get('content-disposition'),/^attachment;/);assert.equal(svg.headers.get('x-content-type-options'),'nosniff')
    for(const method of ['DELETE','PATCH']) assert.equal((await app.fetch('/api/receipts/'+first.id,{method,headers:{origin:app.origin}})).status,405)
    await assert.rejects(app.db.prepare('UPDATE receipts SET source=? WHERE id=?').bind('rewritten',first.id).run(),/immutable_receipt/)
    await assert.rejects(app.db.prepare('DELETE FROM exhibits WHERE id=?').bind(first.exhibit_id).run(),/immutable_exhibit/)
   })
   await step('Removed or changed R2 bytes yield unavailable, retain receipts, refuse download',async()=>{
    const bucket=await app.mf.getR2Bucket('EXHIBITS');await bucket.put(second.object_key,'tampered')
    assert.equal((await primary()).gap,'unavailable bytes');assert.equal((await app.fetch('/app/receipts/'+second.id+'/download')).status,410)
    await bucket.delete(second.object_key);assert.equal((await primary()).gap,'unavailable bytes');assert.equal((await primary()).receipts.length,2)
   })
 })
 await scenario('CONTROL-001 / CONTROL-002 prospective controls, multiple requirements, exact failed observations and exported mappings',async()=>{ const fixture=await controlJourney(app); await frameworkJourney(app,fixture); await controlArchiveJourney(app) })
 console.log(`${passed} public-door scenarios passed; real workerd, D1, R2 and Base email-link sign-in.`)
} finally { await app.close() }
