import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { runtime } from './helpers/runtime.mjs'
const app = await runtime()
let passed=0, active='initialization'
const scenario=async(name,fn)=>{active=name;await fn();passed++;console.log('PASS '+name)}
const ownerPost=(path,body)=>app.fetch(path,{method:'POST',headers:{origin:app.origin,'content-type':'application/json'},body:JSON.stringify(body)})
// The harness otherwise carries its owner cookie. This independent viewer
// explicitly sends none, including on cross-site navigation from an auditor.
const viewer=(path,init={})=>app.fetch(path,{...init,headers:{cookie:'','sec-fetch-site':'cross-site',...init.headers}})
const fromURL=url=>new URL(url).pathname
const create=async(name)=>{const r=await app.fetch('/app/controls',{method:'POST',headers:{origin:app.origin,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({name,group:'Access',proof:name+' proof',cadence:'daily'})});assert.equal(r.status,303);const id=r.headers.get('location').split('/').at(-1);return (await (await app.fetch('/api/desk')).json()).requirements.find(row=>row.id===id)}
const upload=async(req,from,to,fields={},bytes='Stored proof',filename='proof.txt')=>{const form=new FormData();for(const [key,value] of Object.entries({source:'Manual source',covered_from:from,covered_to:to,...fields}))form.set(key,value);form.set('file',new File([bytes],filename,{type:filename.endsWith('.svg')?'image/svg+xml':'text/html'}));const response=await app.fetch('/app/requirements/'+req.id+'/uploads',{method:'POST',headers:{origin:app.origin},body:form});assert.equal(response.status,303);return (await app.fetch(response.headers.get('location').replace('/app/','/api/'))).json()}
const input=(ids,extra={})=>({reviewer_label:'Independent reviewer',period_from:'2026-10-10',period_to:'2026-10-11',expires_at:'2026-10-20T12:00:00Z',control_ids:ids,...extra})
const issue=async(data)=>{const response=await ownerPost('/api/folders',data);assert.equal(response.status,201);const issued=await response.json();return {...issued,path:fromURL(issued.review_url)}}
const denial=async(path,init)=>{const response=await viewer(path,init);return {status:response.status,type:response.headers.get('content-type'),body:await response.text()}}
const expected404={status:404,type:'text/plain; charset=utf-8',body:'Not found.\n'}
let chosen,other,first,last,outside,spanning,folder,secondFolder,token
try {
 await scenario('Native owner authentication and origin gates protect folder administration',async()=>{
  for(const path of ['/app/folders','/api/folders','/api/folders/events','/app/folders/events'])assert.equal((await viewer(path,{headers:{'sec-fetch-site':'same-origin'}})).status,401)
  assert.equal((await ownerPost('/api/folders',{})).status,401)
  await app.signin()
  for(const headers of [{origin:'https://elsewhere.test'},{'sec-fetch-site':'cross-site'},{host:'elsewhere.test'}])assert.equal((await app.fetch('/api/folders',{headers})).status,403)
  assert.equal((await app.fetch('/api/folders',{method:'POST'})).status,403)
  for(const role of ['admin','member']) {
   assert.equal((await ownerPost('/auth/invite',{email:role+'@example.test',displayName:role,role})).status,202)
   const mail=app.messages.at(-1)
   const link=new URL(mail.html.match(/href="([^"]*\/auth\/confirm\?token=[^"]+)"/)[1].replaceAll('&amp;','&'),app.origin)
   const confirmed=await app.fetch('/auth/confirm',{method:'POST',headers:{cookie:'',origin:app.origin,'content-type':'application/json'},body:JSON.stringify({token:link.searchParams.get('token')})})
   assert.equal(confirmed.status,303)
   const cookie=confirmed.headers.getSetCookie().map(value=>value.split(';')[0]).join('; ')
   assert.equal((await app.fetch('/api/folders',{headers:{cookie}})).status,403)
   for(const path of ['/api/folders/events','/app/folders/events'])assert.equal((await app.fetch(path,{headers:{cookie}})).status,403)
   assert.equal((await app.fetch('/api/folders',{method:'POST',headers:{cookie,origin:app.origin,'content-type':'application/json'},body:'{}'})).status,403)
  }
 })
 await scenario('Only selected controls and whole inclusive receipt intervals are admitted',async()=>{
  chosen=await create('Selected access control');other=await create('PRIVATE_OTHER_CONTROL_92')
  first=await upload(chosen,'2026-10-10','2026-10-10',{},'<script>window.hostile=true</script>','hostile.html')
  last=await upload(chosen,'2026-10-11','2026-10-11',{},'<svg onload="alert(1)"></svg>','hostile.svg')
  outside=await upload(other,'2026-10-11','2026-10-11',{source:'PRIVATE_OTHER_SOURCE_92'})
  spanning=await upload(chosen,'2026-10-09','2026-10-10',{source:'PRIVATE_SPANNING_SOURCE_92'})
  const after=await upload(chosen,'2026-10-11','2026-10-12',{source:'PRIVATE_AFTER_SOURCE_92'})
  const disjoint=await upload(chosen,'2026-10-14','2026-10-14',{source:'PRIVATE_DISJOINT_SOURCE_92'})
  folder=await issue(input([chosen.control_id]));secondFolder=await issue(input([other.control_id],{reviewer_label:'PRIVATE_OTHER_FOLDER_92'}))
  token=folder.path.split('/').at(-1)
  assert.ok(/^[a-f0-9]{64}$/.test(token),'256-bit token encoding')
  const record=await app.db.prepare('SELECT * FROM review_folders WHERE id=?').bind(folder.folder.id).first()
  assert.ok(record.token_hash===createHash('sha256').update(token).digest('hex'),'stored token digest matches')
  assert.ok(!JSON.stringify(record).includes(token),'plaintext grant is absent from storage')
  const response=await viewer(folder.path+'/exhibits');assert.equal(response.status,200)
  const data=await response.json();assert.equal(data.selected,'2026-10-11');assert.equal(data.requirements.length,1)
  assert.deepEqual(data.requirements[0].receipts.map(r=>r.id).sort(),[first.id,last.id].sort())
  for(const row of [outside,spanning,after,disjoint])for(const suffix of ['', '/view','/download'])assert.deepEqual(await denial(folder.path+'/receipts/'+row.id+suffix),expected404)
  assert.deepEqual(await denial(secondFolder.path+'/receipts/'+first.id),expected404)
  for(const row of [first,last])for(const suffix of ['', '/view','/download'])assert.equal((await viewer(folder.path+'/receipts/'+row.id+suffix)).status,200)
 })
 await scenario('Invalid folder creation leaves no grants and owner revisit cannot recover a token',async()=>{
  const before=(await (await app.fetch('/api/folders')).json()).folders.length
  for(const patch of [{period_from:'2026-02-30'},{period_from:'2026-10-12'},{period_to:'yesterday'},{expires_at:'2026-10-11T12:00:00Z'},{expires_at:'2026-02-30T12:00:00Z'},{control_ids:[]},{control_ids:['unknown']},{reviewer_label:''}])assert.equal((await ownerPost('/api/folders',input([chosen.control_id],patch))).status,400)
  const listing=await (await app.fetch('/api/folders')).text();assert.equal(JSON.parse(listing).folders.length,before)
  const html=await (await app.fetch('/app/folders')).text()
  for(const value of [token,'token_hash',folder.review_url]){assert.ok(!listing.includes(value),'owner list excludes grants');assert.ok(!html.includes(value),'owner page excludes grants')}
 })
 await scenario('Public projections exclude identity, storage keys, owner navigation and unrelated history',async()=>{
  const privateValues=[first.added_by,first.added_by_name,first.object_key,last.object_key,outside.id,spanning.id,other.control_id,'PRIVATE_OTHER_CONTROL_92','PRIVATE_OTHER_SOURCE_92','PRIVATE_SPANNING_SOURCE_92','PRIVATE_AFTER_SOURCE_92','PRIVATE_DISJOINT_SOURCE_92','PRIVATE_OTHER_FOLDER_92','object_key','added_by','added_by_name','token_hash','/app','/api/folders','review_events']
  for(const suffix of ['', '/exhibits','/receipts/'+first.id,'/receipts/'+first.id+'/view']){
   const response=await viewer(folder.path+suffix);assert.equal(response.status,200)
   assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(response.headers.get('referrer-policy'),'no-referrer');assert.match(response.headers.get('x-robots-tag'),/noindex/)
   const text=await response.text(),headers=JSON.stringify([...response.headers]);for(const value of privateValues){assert.ok(!text.includes(value),'private projection field omitted');assert.ok(!headers.includes(value),'private response header omitted')}
  }
  const data=await (await viewer(folder.path+'/receipts/'+first.id)).json();assert.equal(data.origin,'manually-asserted');assert.equal(data.source,'Manual source')
  const page=await (await viewer(folder.path)).text();assert.match(page,/fingerprint/);assert.match(page,/not that a control operated/)
  for(const method of ['POST','PATCH','DELETE'])assert.deepEqual(await denial(folder.path+'/receipts/'+first.id,{method}),expected404)
 })
 await scenario('Retained hostile HTML and SVG are verified attachment downloads',async()=>{
  for(const row of [first,last]){
   const response=await viewer(folder.path+'/receipts/'+row.id+'/download');assert.equal(response.status,200)
   assert.equal(response.headers.get('content-type'),'application/octet-stream');assert.equal(response.headers.get('x-content-type-options'),'nosniff');assert.match(response.headers.get('content-disposition'),/^attachment;/);assert.match(response.headers.get('content-security-policy'),/sandbox/)
   assert.equal(createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex'),row.sha256)
  }
 })
 await scenario('Unknown, altered and out-of-scope requests have exactly the same plain refusal',async()=>{
  const altered=folder.path.slice(0,-1)+(folder.path.endsWith('0')?'1':'0')
  for(const path of ['/review/not-a-token','/review/'+'a'.repeat(64),altered,folder.path+'/receipts/00000000-0000-0000-0000-000000000000',folder.path+'/unknown'])assert.deepEqual(await denial(path),expected404)
  for(const base of [altered,'/review/'+'b'.repeat(64)])for(const suffix of ['', '/exhibits','/receipts/'+first.id,'/receipts/'+first.id+'/download'])assert.deepEqual(await denial(base+suffix),expected404)
  assert.deepEqual(await denial(folder.path,{headers:{host:'elsewhere.test'}}),expected404)
 })
 await scenario('Closing is terminal and invalidates every previously obtained public door',async()=>{
  for(const cookie of ['', 'operator_session_local=invalid'])assert.equal((await app.fetch('/api/folders/'+folder.folder.id+'/close',{method:'POST',headers:{cookie,origin:app.origin}})).status,401)
  assert.equal((await ownerPost('/api/folders/'+folder.folder.id+'/close',{})).status,200)
  for(const suffix of ['', '/exhibits','/receipts/'+first.id,'/receipts/'+first.id+'/view','/receipts/'+first.id+'/download'])assert.deepEqual(await denial(folder.path+suffix),expected404)
  const closed=await app.db.prepare('SELECT closed_at FROM review_folders WHERE id=?').bind(folder.folder.id).first()
  await app.clock('2026-10-11T12:00:01Z');await ownerPost('/api/folders/'+folder.folder.id+'/close',{})
  assert.deepEqual(await app.db.prepare('SELECT closed_at FROM review_folders WHERE id=?').bind(folder.folder.id).first(),closed)
  await assert.rejects(app.db.prepare('UPDATE review_folders SET closed_at=NULL WHERE id=?').bind(folder.folder.id).run(),/closed_review_folder/)
  assert.equal((await ownerPost('/api/folders/'+folder.folder.id+'/reopen',{})).status,405)
  const reissued=await issue(input([chosen.control_id]));assert.equal((await viewer(reissued.path)).status,200);assert.ok(reissued.path!==folder.path,'reissue creates a different grant')
 })
 await scenario('Exact expiry equality refuses page, list, receipt and download after preceding success',async()=>{
  const expiring=await issue(input([chosen.control_id],{expires_at:'2026-10-11T12:01:00Z'}))
  await app.clock('2026-10-11T12:00:59.999Z')
  const paths=['','/exhibits','/receipts/'+first.id,'/receipts/'+first.id+'/download']
  for(const path of paths)assert.equal((await viewer(expiring.path+path)).status,200)
  await app.clock('2026-10-11T12:01:00.000Z')
  for(const path of paths)assert.deepEqual(await denial(expiring.path+path),expected404)
  const logs=await (await app.fetch('/api/folders/'+expiring.folder.id+'/events')).json();assert.equal(logs.events.filter(e=>e.outcome==='refused').length,4)
 })
 await scenario('Closure or expiry during the final event insert refuses every public door',async()=>{
  await app.clock('2026-10-11T12:00:00Z')
  const doors=[['','page',2],['/exhibits','list',2],['/receipts/'+first.id,'receipt',1],['/receipts/'+first.id+'/view','receipt',1],['/receipts/'+first.id+'/download','download',1]]
  for(const field of ['closed_at','expires_at'])for(const method of ['GET','HEAD'])for(const [suffix,action,eventCount] of doors){
   const raced=await issue(input([chosen.control_id]))
   // Real D1 commits the transition inside the last allowed event write,
   // after rendering/byte reads and any earlier grant recheck have completed.
   await app.db.prepare(`CREATE TRIGGER review_test_revoke_during_log AFTER INSERT ON review_events
    WHEN NEW.folder_id='${raced.folder.id}' AND NEW.outcome='allowed'
     AND (SELECT COUNT(*) FROM review_events WHERE folder_id=NEW.folder_id AND outcome='allowed')=${eventCount}
    BEGIN UPDATE review_folders SET ${field}=NEW.occurred_at WHERE id=NEW.folder_id; END`).run()
   try {
    const response=await viewer(raced.path+suffix,{method})
    const persisted=await app.db.prepare(`SELECT ${field} AS revoked_at FROM review_folders WHERE id=?`).bind(raced.folder.id).first()
    assert.equal(persisted.revoked_at,'2026-10-11T12:00:00.000Z','transition committed during the event insert')
    assert.equal(response.status,404,'a grant revoked during audit writes must refuse disclosure')
    assert.equal(response.headers.get('content-type'),expected404.type)
    assert.equal(await response.text(),method==='HEAD'?'':expected404.body)
    const logs=(await (await app.fetch('/api/folders/'+raced.folder.id+'/events')).json()).events
    const refusals=logs.filter(event=>event.outcome==='refused')
    assert.equal(refusals.length,1,'the final refusal is recorded for the owner')
    assert.equal(refusals[0].action,action)
    assert.equal(refusals[0].exhibit_id,suffix.startsWith('/receipts/')?first.exhibit_id:null)
   } finally {await app.db.prepare('DROP TRIGGER review_test_revoke_during_log').run()}
  }
 })
 await scenario('LOG-001 / Refused known excluded receipts retain owner-only exhibit attribution, and every folder read and refusal is on the owner Audit without the grant',async()=>{
  const audit=await issue(input([chosen.control_id])), seen=new Set()
  const cases=[outside,spanning,{id:'00000000-0000-0000-0000-000000000000',exhibit_id:null}]
  for(const row of cases)for(const [suffix,action] of [['','receipt'],['/view','receipt'],['/download','download']]){
   assert.deepEqual(await denial(audit.path+'/receipts/'+row.id+suffix),expected404)
   const response=await app.fetch('/api/folders/'+audit.folder.id+'/events');assert.equal(response.status,200)
   const text=await response.text(), logs=JSON.parse(text).events, added=logs.filter(event=>!seen.has(event.id))
   assert.equal(added.length,1)
   assert.equal(added[0].folder_id,audit.folder.id)
   assert.equal(added[0].exhibit_id,row.exhibit_id,'known excluded receipts identify their exhibit only in the owner audit')
   assert.equal(added[0].action,action);assert.equal(added[0].outcome,'refused')
   assert.ok(!text.includes(audit.path.split('/').at(-1)),'owner audit never contains the grant')
   for(const event of added)seen.add(event.id)
  }
  for(const path of ['/api/folders/'+audit.folder.id+'/events','/app/folders/'+audit.folder.id+'/events'])assert.equal((await viewer(path,{headers:{'sec-fetch-site':'same-origin'}})).status,401)
  assert.deepEqual(await denial(audit.path+'/events'),expected404)
  const trail=await (await app.fetch('/api/audit?action=review.')).text(),entries=JSON.parse(trail).entries
  assert.ok(entries.some(e=>e.subject==='exhibit:'+outside.exhibit_id&&e.action==='review.receipt'&&e.outcome==='refused'&&e.actor_name==='Review folder · Independent reviewer'))
  assert.ok(entries.some(e=>e.outcome==='succeeded'&&e.actor_kind==='reviewer'))
  assert.ok(!trail.includes(audit.path.split('/').at(-1)),'the owner Audit never contains the grant')
 })
 await scenario('All six original gap outcomes remain honest without exposing hidden superseders',async()=>{
  await app.clock('2026-10-11T12:00:00Z')
  const hiddenCoverage=await create('Hidden coverage');await upload(hiddenCoverage,'2026-10-01','2026-10-31',{source:'PRIVATE_BROAD_SOURCE_92'})
  const narrow=await issue(input([hiddenCoverage.control_id],{period_from:'2026-10-11'}));const narrowData=await (await viewer(narrow.path+'/exhibits')).json();assert.equal(narrowData.requirements[0].gap,'missing');assert.deepEqual(narrowData.requirements[0].receipts,[])
  const covered=await create('Covered'),missing=await create('Missing'),overdue=await create('Overdue'),superseded=await create('Superseded'),unavailable=await create('Unavailable')
  await upload(covered,'2026-10-11','2026-10-11');await upload(overdue,'2026-10-10','2026-10-10',{source:'PRIVATE_OLD_SOURCE_92'})
  const old=await upload(superseded,'2026-10-11','2026-10-11')
  const next=await upload(superseded,'2026-10-12','2026-10-12',{supersedes:old.id,source:'PRIVATE_SUPERSEDER_SOURCE_92'})
  const broken=await upload(unavailable,'2026-10-11','2026-10-11');await (await app.mf.getR2Bucket('EXHIBITS')).put(broken.object_key,'changed bytes')
  const grant=await issue(input([covered,missing,overdue,superseded,unavailable].map(r=>r.control_id),{period_from:'2026-10-11'}))
  const read=async()=>{const response=await viewer(grant.path+'/exhibits');assert.equal(response.status,200);return response.json()}
  let data=await read();assert.deepEqual(data.requirements.map(r=>r.gap).sort(),['covered','missing','overdue','superseded-only','unavailable bytes'].sort())
  const serialized=JSON.stringify(data);for(const value of [next.id,next.object_key,'PRIVATE_SUPERSEDER_SOURCE_92','PRIVATE_OLD_SOURCE_92'])assert.ok(!serialized.includes(value),'hidden historical receipt omitted')
  const oldView=await (await viewer(grant.path+'/receipts/'+old.id)).json();assert.equal(oldView.superseded,true);assert.equal(oldView.supersedes,null);assert.ok(!JSON.stringify(oldView).includes(next.id),'hidden replacement ID omitted')
  assert.equal((await viewer(grant.path+'/receipts/'+old.id+'/download')).status,200)
  assert.deepEqual(await denial(grant.path+'/receipts/'+next.id),expected404)
  assert.deepEqual(await denial(grant.path+'/receipts/'+broken.id+'/download'),expected404)
  await app.clock('2026-10-11T20:00:00Z');data=await read();assert.equal(data.requirements.find(r=>r.id===covered.id).gap,'due soon')
  await (await app.mf.getR2Bucket('EXHIBITS')).delete(broken.object_key);assert.equal((await read()).requirements.find(r=>r.id===unavailable.id).gap,'unavailable bytes')
 })
 await scenario('Every allowed door and refusal has an owner-only token-free event',async()=>{
  const count=async()=>Number((await app.db.prepare('SELECT COUNT(*) AS n FROM review_events').first()).n)
  for(const suffix of ['', '/exhibits','/receipts/'+outside.id,'/receipts/'+outside.id+'/download']){const before=await count();const result=await viewer(secondFolder.path+suffix);assert.equal(result.status,200);await result.arrayBuffer();assert.equal(await count(),before+1,'each allowed request records its exposed exhibit')}
  const before=await count();assert.deepEqual(await denial('/review/'+'c'.repeat(64)),expected404);assert.equal(await count(),before+1,'each unknown refusal records an event')
  const response=await app.fetch('/api/folders/events');assert.equal(response.status,200);const text=await response.text(),logs=JSON.parse(text).events
  assert.ok(!text.includes(token),'event output has no token');assert.ok(!text.includes('/review/'),'event output has no raw URL');assert.ok(!text.includes('token_hash'),'event output has no grant digest')
  for(const action of ['page','list','receipt','download'])assert.ok(logs.some(e=>e.action===action && e.outcome==='allowed'),'allowed action logged')
  assert.ok(logs.some(e=>e.folder_id===folder.folder.id && e.outcome==='refused'),'closed folder is identified')
  assert.ok(logs.some(e=>e.folder_id===null && e.outcome==='refused'),'unknown grant is unassociated')
  for(const action of ['page','list','receipt','download'])assert.ok(logs.some(e=>e.exhibit_id===first.exhibit_id && e.action===action && e.outcome==='allowed'),'viewed exhibit logged for each public door')
  assert.ok(logs.every(e=>Number.isFinite(Date.parse(e.occurred_at))),'all events timestamped')
  assert.equal((await viewer('/api/folders/events',{headers:{'sec-fetch-site':'same-origin'}})).status,401)
  assert.deepEqual(await denial(secondFolder.path+'/events'),expected404)
 })
 console.log(`${passed} review public-door scenarios passed; independent cookie-free workerd requests, real D1/R2 and native owner sessions.`)
} catch (error) { console.error('FAIL review scenario: '+active);console.error(String(error.stack||'').split('\n').filter(line=>/^\s+at /.test(line)).join('\n'));process.exitCode=1 } finally {await app.close()}
