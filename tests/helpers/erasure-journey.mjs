import assert from 'node:assert/strict'
import { runtime } from './runtime.mjs'
export async function erasureJourney(app) {
 const post=async(path,body,status=200)=>{const r=await app.fetch(path,{method:'POST',headers:{origin:app.origin,'content-type':'application/json'},body:JSON.stringify(body)});assert.equal(r.status,status,path+' '+await r.clone().text());return r.json()}
 const control=await app.fetch('/app/controls',{method:'POST',headers:{origin:app.origin,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({name:'Erasure review',group:'Data',proof:'Erasure original',cadence:'monthly'})})
 assert.equal(control.status,303)
 const requirement=control.headers.get('location').split('/').at(-1),form=new FormData()
 for(const [k,v] of Object.entries({source:'synthetic-evidence-erasure-source',covered_from:'2026-10-11',covered_to:'2026-10-11'}))form.set(k,v)
 form.set('file',new File(['synthetic-evidence-erasure-content'],'synthetic-evidence-private-name.txt'))
 const uploaded=await app.fetch('/app/requirements/'+requirement+'/uploads',{method:'POST',headers:{origin:app.origin},body:form});assert.equal(uploaded.status,303)
 const receipt=await (await app.fetch(uploaded.headers.get('location').replace('/app/','/api/'))).json()
 const controlId=(await (await app.fetch('/api/desk')).json()).requirements.find(q=>q.id===requirement).control_id
 const folder=await post('/api/folders',{reviewer_label:'Erasure share',period_from:'2026-10-11',period_to:'2026-10-11',expires_at:'2026-12-01T12:00:00Z',control_ids:[controlId]},201),share=new URL(folder.review_url).pathname
 assert.equal((await app.fetch(share+'/exhibits',{headers:{cookie:''}})).status,200)
 const preview=()=>post('/api/privacy/requests',{kind:'exhibit',subject_id:receipt.exhibit_id,reason:'Owner verified request; remove original'},201)
 console.log('ERASE-001: preview and exact hold review')
 const before=Buffer.from(await (await app.fetch('/api/archive/export')).arrayBuffer())
 let row=await preview();assert.ok(!row.snapshot_json.includes('synthetic-evidence-private-name'));assert.ok(!row.snapshot_json.includes('synthetic-evidence-erasure-source'))
 const hold=await post('/api/privacy/holds',{kind:'exhibit',subject_id:receipt.exhibit_id,reason:'Preserve for dispute',review_on:'2027-01-01'},201)
 await post('/api/privacy/requests/'+row.id+'/confirm',{snapshot_hash:row.snapshot_hash,confirm:'ERASE'},409)
 assert.equal((await app.fetch(uploaded.headers.get('location')+'/download')).status,200)
 await post('/api/privacy/holds/'+hold.id+'/release',{reason:'Dispute resolved'})
 await post('/api/privacy/requests/'+row.id+'/confirm',{snapshot_hash:row.snapshot_hash,confirm:'ERASE'},409)
 row=await preview()
 await post('/api/privacy/requests/'+row.id+'/confirm',{snapshot_hash:'0'.repeat(64),confirm:'ERASE'},409)
 await post('/api/privacy/requests/'+row.id+'/confirm',{snapshot_hash:row.snapshot_hash,confirm:'yes'},409)
 // An actual D1 write failure after R2 deletion must leave durable pending
 // work, never a false completion; the same confirmed request can be retried.
 await app.db.prepare("CREATE TRIGGER synthetic_privacy_completion BEFORE UPDATE ON privacy_requests WHEN NEW.state='complete' BEGIN SELECT RAISE(ABORT,'synthetic-evidence-completion-failure'); END").run()
 await post('/api/privacy/requests/'+row.id+'/confirm',{snapshot_hash:row.snapshot_hash,confirm:'ERASE'},503)
 assert.equal((await (await app.fetch('/api/privacy/requests/'+row.id)).json()).state,'pending')
 assert.equal((await app.fetch('/api/archive/export')).status,400,'pending erasure cannot be exported into an offline copy')
 await app.db.prepare('DROP TRIGGER synthetic_privacy_completion').run()
 const final=await post('/api/privacy/requests/'+row.id+'/confirm',{snapshot_hash:row.snapshot_hash,confirm:'ERASE'})
 assert.equal(final.state,'complete');assert.deepEqual(JSON.parse(final.counts_json),{R2:1,D1_fields:2,live_shares:1})
 assert.equal((await app.fetch(share+'/exhibits',{headers:{cookie:''}})).status,404,'erasure revokes every linked share')
 assert.equal(await (await app.mf.getR2Bucket('EXHIBITS')).get(receipt.object_key),null)
 assert.equal((await app.fetch(uploaded.headers.get('location')+'/download')).status,410)
 const after=await (await app.fetch('/api/receipts/'+receipt.id)).json();assert.equal(after.filename,'Erased exhibit');assert.equal(after.source,'Erased exhibit');assert.equal(after.sha256,receipt.sha256)
 await assert.rejects(app.db.prepare('UPDATE receipts SET source=? WHERE id=?').bind('ordinary rewrite',receipt.id).run(),/immutable_receipt/)
 assert.equal((await post('/api/privacy/requests/'+row.id+'/confirm',{snapshot_hash:row.snapshot_hash,confirm:'ERASE'})).state,'complete')
 console.log('ERASE-001: storage absence and immutable tombstone verified')
 const journal=await (await app.fetch('/api/archive/journal')).json();assert.ok(journal.sequence>0)
 const destination=await runtime()
 try{
  await destination.signin()
  console.log('ERASE-001: refusing old archive with later journal')
  const r=await destination.fetch('/api/archive/restore',{method:'POST',headers:{origin:destination.origin,'content-type':'application/octet-stream','x-evidence-confirm':'restore','x-evidence-journal':JSON.stringify(journal)},body:before})
  assert.equal(r.status,400);assert.match(await r.text(),/later source erasure journal fences/)
 }finally{await destination.close()}
 for(const kind of ['person','vendor','engagement','business']){
  const unsupported=await post('/api/privacy/requests',{kind,subject_id:'synthetic-evidence-unsupported',reason:'Classify first'},201)
  await post('/api/privacy/requests/'+unsupported.id+'/confirm',{snapshot_hash:unsupported.snapshot_hash,confirm:'ERASE'},409)
 }
 console.log('ERASE-001: re-exporting after erasure')
 const exported=Buffer.from(await (await app.fetch('/api/archive/export')).arrayBuffer())
 assert.ok(!exported.includes(Buffer.from('synthetic-evidence-erasure-content')));assert.ok(!exported.includes(Buffer.from('synthetic-evidence-private-name')));assert.ok(!exported.includes(Buffer.from('synthetic-evidence-erasure-source')))
 const restored=await runtime()
 try {
  await restored.signin()
  console.log('ERASE-001: restoring current erased archive')
  const r=await restored.fetch('/api/archive/restore',{method:'POST',headers:{origin:restored.origin,'content-type':'application/octet-stream','x-evidence-confirm':'restore','x-evidence-erasure-history':'unverified acknowledged'},body:exported});assert.equal(r.status,200,await r.clone().text())
  assert.equal((await (await restored.fetch('/api/privacy/requests/'+row.id)).json()).state,'complete')
  assert.equal((await restored.fetch(uploaded.headers.get('location')+'/download')).status,410)
 }finally{await restored.close()}
 console.log('PASS ERASE-001: reviewed exhibit erasure, holds, exact confirmation, tombstone custody, old-archive refusal and populated restore')
}
