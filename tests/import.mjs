process.env.RER_SERVER_JOURNEY='1'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { runtime } from './helpers/runtime.mjs'
import { fixture,zip,digest } from './fixtures/drata/fixture.mjs'
let app,target,passed=0
const scenario=async(name,fn)=>{await fn();passed++;console.log('PASS '+name)}
const post=(app,path,body)=>app.fetch(path,{method:'POST',headers:{origin:app.origin,'content-type':'application/json'},body:JSON.stringify(body)})
async function upload(app,bytes){const form=new FormData();form.set('file',new File([bytes],'audit.zip',{type:'application/zip'}));return app.fetch('/api/import/drata',{method:'POST',headers:{origin:app.origin},body:form})}
const rows=async(app,table)=>(await app.db.prepare(`SELECT * FROM ${table} ORDER BY 1`).all()).results
const mappings=[{action:'create',name:'Review who has customer access',proof:'Dated access review',group:'Access',cadence:'monthly',covered_from:'2026-09-01',covered_to:'2026-09-30'},{action:'create',name:'Train everyone on security',proof:'Training completion register',group:'People',cadence:'monthly',covered_from:'2026-09-01',covered_to:'2026-09-30'}]
try{
 app=await runtime();await app.signin();let review,bytes,plan,job,receipts
 await scenario('Every import door enforces owner authentication and origin before storage',async()=>{
  for(const path of ['/api/import','/app/import','/app/import/shape','/api/import/drata','/api/import/00000000-0000-0000-0000-000000000000','/api/import/00000000-0000-0000-0000-000000000000/mapping','/api/import/00000000-0000-0000-0000-000000000000/commit','/api/import/00000000-0000-0000-0000-000000000000/resume','/api/import/00000000-0000-0000-0000-000000000000/undo','/api/import/00000000-0000-0000-0000-000000000000/source','/api/import/00000000-0000-0000-0000-000000000000/manifest']){
   assert.equal((await app.fetch(path,{headers:{cookie:''}})).status,401)
   for(const headers of [{host:'evil.test'},{origin:'https://evil.test'},{'sec-fetch-site':'cross-site'}])assert.equal((await app.fetch(path,{headers})).status,403)
  }
  assert.equal((await app.fetch('/api/import/drata',{method:'POST'})).status,403)
 })
 await scenario('A signed-in non-owner cannot use read, upload, mapping, commit or undo doors',async()=>{
  const owner=await app.db.prepare("SELECT * FROM oa_operators WHERE role='owner'").first(),spare=crypto.randomUUID()
  await app.db.prepare("INSERT INTO oa_operators(id,email,display_name,role,status,created_at) VALUES(?,?,?,'owner','active',?)").bind(spare,'second-owner@example.test','Second owner',Date.now()).run()
  await app.db.prepare("UPDATE oa_operators SET role='member' WHERE id=?").bind(owner.id).run()
  await app.db.prepare('UPDATE oa_sessions SET operator_version=(SELECT version FROM oa_operators WHERE id=?) WHERE operator_id=?').bind(owner.id,owner.id).run()
  for(const path of ['/api/import','/app/import/shape','/api/import/drata','/api/import/00000000-0000-0000-0000-000000000000/mapping','/api/import/00000000-0000-0000-0000-000000000000/commit','/api/import/00000000-0000-0000-0000-000000000000/undo'])assert.equal((await app.fetch(path)).status,403)
  await app.db.prepare("UPDATE oa_operators SET role='owner' WHERE id=?").bind(owner.id).run()
  await app.db.prepare('UPDATE oa_sessions SET operator_version=(SELECT version FROM oa_operators WHERE id=?) WHERE operator_id=?').bind(owner.id,owner.id).run()
  await app.db.prepare('DELETE FROM oa_operators WHERE id=?').bind(spare).run()
 })
 await scenario('ZIP dry-run counts, digests, missing and unmapped files are truthful and inert',async()=>{
  bytes=await fixture({deflate:true});const response=await upload(app,bytes);assert.equal(response.status,201);const data=await response.json();review=data.review;for(let i=0;i<mappings.length;i++)mappings[i].source_id=data.summary.controls[i].id
  assert.deepEqual(data.summary.counts,{controls:2,evidence:3,available:2,missing:1,unreferenced:3});assert.deepEqual(data.summary.missing,['Evidence/2.pdf']);assert.equal(data.summary.archive_sha256,await digest(bytes));assert.equal(data.summary.evidence.find(e=>e.path==='Evidence/1.txt').sha256,await digest(Buffer.from('Historical access review\n')))
  assert.equal((await rows(app,'receipts')).length,0);assert.equal((await rows(app,'controls')).length,0);assert.equal((await rows(app,'ik_jobs')).length,0)
  const source=await app.fetch('/api/import/'+review.id+'/source');assert.equal(source.status,200);assert.deepEqual(Buffer.from(await source.arrayBuffer()),bytes)
  const manifest=await app.fetch('/api/import/'+review.id+'/manifest');assert.match(manifest.headers.get('content-disposition'),/^attachment/);assert.deepEqual(Buffer.from(await manifest.arrayBuffer()),await readFile(new URL('./fixtures/drata/evidence_manifest.html',import.meta.url)))
 })
 await scenario('Path traversal, duplicate names, links to external paths and corrupt ZIPs refuse without writes',async()=>{
  const manifest=await readFile(new URL('./fixtures/drata/evidence_manifest.html',import.meta.url)),before=(await rows(app,'import_reviews')).length
  const cases=['../escape','/absolute','C:drive','evidence\\escape','evidence/%2e%2e/escape'].map(path=>zip([['evidence_manifest.html',manifest],[path,'bad']]))
  cases.push(zip([['evidence_manifest.html',manifest],['notes.txt','one'],['NOTES.txt','two']]),Buffer.from('not a ZIP'))
  const corrupt=await fixture();corrupt[35]^=1;cases.push(corrupt)
  for(const bad of cases){const response=await upload(app,bad);assert.equal(response.status,400)}
  assert.equal((await rows(app,'import_reviews')).length,before);assert.equal((await rows(app,'receipts')).length,0)
 })
 await scenario('Owner must review mapping and explicitly approve its exact saved fingerprint',async()=>{
  const path='/api/import/'+review.id
  assert.equal((await post(app,path+'/commit',{approve:'commit',fingerprint:'stale'})).status,409)
  const response=await post(app,path+'/mapping',{mapping:mappings});assert.equal(response.status,200);plan=await response.json();assert.equal(plan.counts.mapped,4);assert.equal(plan.counts.unmapped,1)
  assert.equal((await rows(app,'receipts')).length,0);assert.equal((await rows(app,'ik_jobs')).length,0)
  assert.equal((await post(app,path+'/commit',{fingerprint:plan.review.fingerprint})).status,409)
  assert.equal((await post(app,path+'/commit',{approve:'commit',fingerprint:'0'.repeat(64)})).status,409)
  const html=await(await app.fetch('/app/import/'+review.id)).text();assert.match(html,/name="approve" value="commit" required/)
  const committed=await post(app,path+'/commit',{approve:'commit',fingerprint:plan.review.fingerprint});assert.equal(committed.status,200);job=(await committed.json()).job
  for(let i=0;job.state==='applying'&&i<10;i++){const resumed=await post(app,path+'/resume',{});assert.equal(resumed.status,200);job=(await resumed.json()).job}assert.equal(job.state,'completed')
  assert.equal((await post(app,path+'/mapping',{mapping:mappings})).status,409)
 })
 await scenario('Imported receipts retain provenance and verified bytes without passing historical imports',async()=>{
  receipts=await rows(app,'receipts');assert.equal(receipts.length,2)
  for(const r of receipts){assert.equal(r.origin,'imported');assert.equal(r.added_at,review.staged_at);assert.notEqual(r.added_at,'2026-09-30T09:00:00Z');const response=await app.fetch('/api/receipts/'+r.id+'/download');assert.equal(response.status,200);assert.equal(await digest(await response.arrayBuffer()),r.sha256)}
  const desk=await(await app.fetch('/api/desk?date=2026-09-10')).json();assert.ok(desk.requirements.every(r=>!['covered','due soon'].includes(r.gap)))
  assert.equal((await rows(app,'ik_provenance')).length,4);assert.ok((await rows(app,'ik_originals')).length>=2)
  const again=await post(app,'/api/import/'+review.id+'/commit',{approve:'commit',fingerprint:plan.review.fingerprint});assert.equal(again.status,200);assert.equal((await rows(app,'receipts')).length,2)
 })
 await scenario('Full owner archive carries import journal and source originals into inert restored history',async()=>{
  const response=await app.fetch('/api/archive/export');assert.equal(response.status,200);const archive=await response.arrayBuffer()
  target=await runtime();await target.signin();const restored=await target.fetch('/api/archive/restore',{method:'POST',headers:{origin:target.origin,'content-type':'application/octet-stream','x-evidence-confirm':'restore', 'x-evidence-erasure-history':'unverified acknowledged'},body:archive});assert.equal(restored.status,200)
  assert.deepEqual(await rows(target,'import_reviews'),await rows(app,'import_reviews'));assert.deepEqual(await rows(target,'ik_provenance'),await rows(app,'ik_provenance'));assert.deepEqual(await rows(target,'import_active'),await rows(app,'import_active'))
  const r=await(await target.mf.getR2Bucket('EXHIBITS')).get(review.object_key);assert.ok(r);assert.equal(await digest(await r.arrayBuffer()),review.archive_sha256)
  assert.equal((await post(target,'/api/import/'+review.id+'/resume',{})).status,403)
 })
 await scenario('Undo unlinks only imported additions and retains immutable receipts, bytes and later native proof',async()=>{
  const imported=receipts[0],form=new FormData();form.set('file',new File(['Later owner evidence'],'later.txt'));form.set('source','Current owner review');form.set('covered_from','2026-10-01');form.set('covered_to','2026-10-31')
  const response=await app.fetch('/app/requirements/'+imported.requirement_id+'/uploads',{method:'POST',headers:{origin:app.origin},body:form});assert.equal(response.status,303)
  const later=(await rows(app,'receipts')).find(r=>r.origin==='manually-asserted')
  assert.equal((await post(app,'/api/import/'+review.id+'/undo',{})).status,409)
  let undo=await post(app,'/api/import/'+review.id+'/undo',{approve:'undo'});assert.equal(undo.status,200);let undone=(await undo.json()).job
  for(let i=0;['undoing','rolling_back'].includes(undone.state)&&i<10;i++){undo=await post(app,'/api/import/'+review.id+'/resume',{});assert.equal(undo.status,200);undone=(await undo.json()).job}assert.equal(undone.state,'undone')
  assert.equal((await rows(app,'import_active')).length,0);assert.equal((await rows(app,'import_additions')).length,4);assert.equal((await rows(app,'receipts')).length,3)
  assert.equal((await app.fetch('/api/receipts/'+later.id+'/download')).status,200)
  for(const r of receipts)assert.equal((await app.fetch('/api/receipts/'+r.id+'/download')).status,200)
  const desk=await(await app.fetch('/api/desk?date=2026-10-11')).json();assert.ok(desk.requirements.some(r=>r.id===later.requirement_id&&['covered','due soon'].includes(r.gap)))
  assert.ok((await rows(app,'ik_originals')).length>=2);assert.ok((await rows(app,'import_reviews'))[0].approved_at)
 })
 console.log(`${passed} import scenarios passed`)
}finally{await app?.close();await target?.close()}
