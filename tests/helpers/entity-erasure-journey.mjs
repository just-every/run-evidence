import assert from 'node:assert/strict'
import { runtime } from './runtime.mjs'

// The entity workflow uses the same public preview and confirmation doors,
// native D1 and R2, and only the storage deletion failure edge is substituted.
export async function entityErasureJourney(app) {
 const post=async(path,body,status=200)=>{
  const r=await app.fetch(path,{method:'POST',headers:{origin:app.origin,'content-type':'application'+'/'+'json'},body:JSON.stringify(body)})
  assert.equal(r.status,status,path+' '+await r.clone().text());return r.json()
 }
 const readObject=async key=>(await app.mf.getR2Bucket('EXHIBITS')).get(key)
 const upload=async(requirement,label)=>{
  const form=new FormData()
  for(const [k,v]of Object.entries({source:'synthetic-evidence-source-'+label,covered_from:'2026-10-11',covered_to:'2026-10-11'}))form.set(k,v)
  form.set('file',new File(['synthetic-evidence-bytes-'+label],'synthetic-evidence-'+label+'.txt'))
  const r=await app.fetch('/app/requirements/'+requirement+'/uploads',{method:'POST',headers:{origin:app.origin},body:form})
  assert.equal(r.status,303)
  return (await app.fetch(r.headers.get('location').replace('/app/','/api/'))).json()
 }
 const before=Buffer.from(await (await app.fetch('/api/archive/export')).arrayBuffer())
 const previews=[]
 for(const [index,kind]of ['person','vendor','engagement','business'].entries()) {
  const created=await app.fetch('/app/controls',{method:'POST',headers:{origin:app.origin,'content-type':'application'+'/'+'x-www-form-urlencoded'},body:new URLSearchParams({name:'Entity erasure '+kind,group:'Data',proof:'Retain held proof only',cadence:'monthly'})})
  assert.equal(created.status,303)
  const requirement=created.headers.get('location').split('/').at(-1)
  const control=(await (await app.fetch('/api/desk')).json()).requirements.find(r=>r.id===requirement).control_id
  const subject=kind==='person'?(await post('/api/people',{name:'synthetic-evidence-person-'+index,email:'synthetic-evidence-'+index+'@'+'example.test',kind:'employee'},201)).id
   :kind==='vendor'?(await post('/api/vendors',{name:'synthetic-evidence-vendor-'+index,criticality:'low'},201)).id
   :kind==='engagement'?(await post('/api/audit-engagements',{name:'synthetic-evidence-engagement-'+index,period_from:'2026-10-11',period_to:'2026-10-11',control_ids:[control]},201)).id:'business'
  const erase=await upload(requirement,kind+'-erase'),keep=await upload(requirement,kind+'-held')
  if(kind==='person'||kind==='vendor')for(const exhibit of [erase,keep])await post('/api/privacy/classifications',{kind,subject_id:subject,exhibit_id:exhibit.exhibit_id,reason:'Owner reviewed subject records'},201)
  const held=await post('/api/privacy/holds',{kind:'exhibit',subject_id:keep.exhibit_id,reason:'Keep the original for a dispute',review_on:'2027-01-01'},201)
  const folder=await post('/api/folders',{reviewer_label:'Entity share '+kind,period_from:'2026-10-11',period_to:'2026-10-11',expires_at:'2026-12-01T12:00:00Z',control_ids:[control]},201)
  const share=new URL(folder.review_url).pathname
  const preview=()=>post('/api/privacy/requests',{kind,subject_id:subject,reason:'Erase classified exhibits; disclose held originals'},201)
  let row=await preview()
  const plan=JSON.parse(row.snapshot_json)
  assert.equal(plan.supported,true,kind)
  assert.ok(plan.items.some(item=>item.subject===erase.exhibit_id))
  const retention=plan.held_items.find(item=>item.exhibit_id===keep.exhibit_id)
  assert.deepEqual(retention.holds.map(h=>[h.id,h.reason,h.authorized_name,h.review_on]),[[held.id,'Keep the original for a dispute','Evidence owner','2027-01-01']])
  await post('/api/privacy/requests/'+row.id+'/confirm',{snapshot_hash:row.snapshot_hash,confirm:'yes'},409)
  await post('/api/privacy/requests/'+row.id+'/confirm',{snapshot_hash:'0'.repeat(64),confirm:'ERASE'},409)
  // New entity membership invalidates the exact preview before any deletion.
  const added=await upload(requirement,kind+'-later')
  if(kind==='person'||kind==='vendor')await post('/api/privacy/classifications',{kind,subject_id:subject,exhibit_id:added.exhibit_id,reason:'New record after preview'},201)
  await post('/api/privacy/requests/'+row.id+'/confirm',{snapshot_hash:row.snapshot_hash,confirm:'ERASE'},409)
  assert.equal(await (await readObject(erase.object_key)).text(),'synthetic-evidence-bytes-'+kind+'-erase')
  row=await preview()
  if(kind==='person') {
   // Interruption is durable for the entire set, and all shares close before
   // the first storage operation even when the provider refuses deletion.
   await app.setSettings({HARNESS_R2_DELETE_FAILURE:'true'})
   const pending=await post('/api/privacy/requests/'+row.id+'/confirm',{snapshot_hash:row.snapshot_hash,confirm:'ERASE'})
   assert.equal(pending.state,'pending');assert.equal(pending.completed_at,null)
   assert.equal(await (await readObject(erase.object_key)).text(),'synthetic-evidence-bytes-person-erase')
   assert.equal((await app.fetch(share+'/exhibits',{headers:{cookie:''}})).status,404)
   await post('/api/privacy/holds',{kind:'exhibit',subject_id:erase.exhibit_id,reason:'Cannot reverse pending erasure',review_on:'2027-01-01'},409)
   await post('/api/privacy/holds',{kind:'person',subject_id:subject,reason:'Cannot reverse pending entity',review_on:'2027-01-01'},409)
   assert.equal((await app.fetch('/api/archive/export')).status,400)
   await app.setSettings({HARNESS_R2_DELETE_FAILURE:undefined})
   assert.equal((await (await app.fetch('/api/privacy/requests/'+row.id)).json()).state,'pending')
  }
  const final=await post('/api/privacy/requests/'+row.id+'/confirm',{snapshot_hash:row.snapshot_hash,confirm:'ERASE'})
  assert.equal(final.state,'partial','unprocessed entity stores must never claim complete')
  assert.equal(JSON.parse(final.counts_json).R2,2)
  assert.equal(await readObject(erase.object_key),null)
  assert.equal(await readObject(added.object_key),null)
  assert.equal(await (await readObject(keep.object_key)).text(),'synthetic-evidence-bytes-'+kind+'-held')
  assert.equal((await app.fetch('/api/receipts/'+erase.id+'/download')).status,410)
  assert.equal(await (await app.fetch('/api/receipts/'+keep.id+'/download')).text(),'synthetic-evidence-bytes-'+kind+'-held')
  assert.equal((await app.fetch(share+'/exhibits',{headers:{cookie:''}})).status,404)
  const facts=await (await app.fetch('/api/receipts/'+erase.id)).json()
  assert.equal(facts.filename,'Erased exhibit');assert.equal(facts.source,'Erased exhibit')
  assert.equal(facts.sha256,erase.sha256,'opaque digest is retained')
  assert.match(JSON.parse(final.snapshot_json).remaining,/Other entity records/)
  assert.equal((await post('/api/privacy/requests/'+row.id+'/confirm',{snapshot_hash:row.snapshot_hash,confirm:'ERASE'})).state,'partial')
  await assert.rejects(app.db.prepare("UPDATE privacy_requests SET state='complete' WHERE id=?").bind(row.id).run(),/retained_privacy_request/)
  previews.push({row:final,keep,erase,added,held})
 }
 const audit=(await (await app.fetch('/api/audit')).json()).entries
 assert.equal(audit.filter(a=>a.action==='privacy.partial'&&previews.some(p=>a.subject==='privacy:'+p.row.id)).length,4)
 const journal=await (await app.fetch('/api/archive/journal')).json()
 const oldTarget=await runtime()
 try {
  await oldTarget.signin()
  const r=await oldTarget.fetch('/api/archive/restore',{method:'POST',headers:{origin:oldTarget.origin,'content-type':'application'+'/'+'octet-stream','x-evidence-confirm':'restore','x-evidence-journal':JSON.stringify(journal)},body:before})
  assert.equal(r.status,400);assert.match(await r.text(),/later source erasure journal fences/)
 }finally{await oldTarget.close()}
 const exported=Buffer.from(await (await app.fetch('/api/archive/export')).arrayBuffer())
 assert.ok(!exported.includes(Buffer.from('synthetic-evidence-bytes-person-erase')))
 const target=await runtime()
 try {
  await target.signin()
  const r=await target.fetch('/api/archive/restore',{method:'POST',headers:{origin:target.origin,'content-type':'application'+'/'+'octet-stream','x-evidence-confirm':'restore','x-evidence-erasure-history':'unverified acknowledged'},body:exported})
  assert.equal(r.status,200,await r.clone().text())
  for(const {row,keep,erase,held}of previews) {
   const restored=await (await target.fetch('/api/privacy/requests/'+row.id)).json()
   assert.equal(restored.state,'partial')
   assert.equal(JSON.parse(restored.snapshot_json).held_items.find(item=>item.exhibit_id===keep.exhibit_id).holds[0].id,held.id)
   assert.equal((await target.fetch('/api/receipts/'+erase.id+'/download')).status,410)
   assert.equal(await (await target.fetch('/api/receipts/'+keep.id+'/download')).text(),await (await app.fetch('/api/receipts/'+keep.id+'/download')).text())
  }
 }finally{await target.close()}
 console.log('PASS ERASE-001: all four entity exhibit sets, held disclosure, exact preview, durable retry, share revocation and partial custody restore')
}
