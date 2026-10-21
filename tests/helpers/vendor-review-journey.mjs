import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { runtime } from './runtime.mjs'
import { socReport,pdfFixture } from './pdf-fixture.mjs'
export async function vendorReviewJourney() {
 const app=await runtime()
 try {
  await app.signin();await app.clock('2026-11-02T15:00:00Z')
  const post=async(path,body,status=201)=>{const r=await app.fetch(path,{method:'POST',headers:{origin:app.origin,'content-type':'application/json'},body:JSON.stringify(body)});assert.equal(r.status,status,path+' '+await r.clone().text());return r.json()}
  const get=async path=>{const r=await app.fetch(path);assert.equal(r.status,200,path+' '+await r.clone().text());return r.json()}
  const upload=async(vendor,kind,bytes,extra={})=>{const f=new FormData();f.set('file',new File([bytes],kind+'.pdf',{type:'application/pdf'}));f.set('kind',kind);for(const [k,v] of Object.entries(extra))f.set(k,v);const r=await app.fetch(`/api/vendors/${vendor}/documents`,{method:'POST',headers:{origin:app.origin},body:f});assert.equal(r.status,201,await r.clone().text());return r.json()}
  const reviewer=await post('/api/people',{name:'Dana Okafor',email:'reviewer@northstar.test',kind:'employee'})
  const vendor=await post('/api/vendors',{name:'Synthetic report supplier',criticality:'low'})
  const control=await app.fetch('/app/controls',{method:'POST',headers:{origin:app.origin,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({name:'Quarterly supplier access review',group:'Access',proof:'Access roster review',cadence:'quarterly'})});assert.equal(control.status,303)
  const requirement=control.headers.get('location').split('/').at(-1),cid=(await get('/api/desk')).requirements.find(r=>r.id===requirement).control_id
  const bytes=socReport(),doc=await upload(vendor.id,'soc2',bytes)
  const prepared=await post(`/api/vendors/${vendor.id}/documents/${doc.id}/reviews`,{}),path=`/api/vendors/${vendor.id}/document-reviews/${prepared.id}`
  let d=await get(path)
  assert.deepEqual(d.snapshot.fields.filter(f=>f.kind==='report-type').map(f=>f.value),['SOC 2 Type II'])
  assert.equal(d.snapshot.fields.find(f=>f.kind==='period').value,'2026-01-01 to 2026-03-31')
  assert.equal(d.snapshot.fields.find(f=>f.kind==='auditor').value,'Harbour Assurance LLP')
  assert.equal(d.snapshot.fields.find(f=>f.kind==='opinion').value,'unqualified')
  assert.equal(d.snapshot.fields.filter(f=>f.kind==='exception').length,1);assert.equal(d.snapshot.fields.filter(f=>f.kind==='cuec').length,2)
  assert.match(d.snapshot.fields.find(f=>f.kind==='subservice').value,/carve-out/)
  for(const f of d.snapshot.fields){const source=await get(path+'/pages/'+f.page);assert.ok(source.text.includes(f.quote));assert.equal(source.document_sha256,createHash('sha256').update(bytes).digest('hex'))}
  assert.equal(d.bridge.state,'bridge letter missing');assert.equal(d.bridge.months,3)
  assert.equal((await get('/api/vendors/'+vendor.id)).findings.length,0)
  const original=await app.fetch(`/app/vendors/${vendor.id}/documents/${doc.id}/download`);assert.deepEqual(Buffer.from(await original.arrayBuffer()),bytes)
  // Correct a source-supported value. Both proposal revisions remain readable.
  const auditor=d.snapshot.fields.find(f=>f.kind==='auditor')
  await post(path+'/correct',{snapshot_hash:prepared.snapshot_hash,field_id:auditor.id,value:'Invented auditor',quote:auditor.quote,page:auditor.page,reason:'Unsupported correction'},400)
  const corrected=await post(path+'/correct',{snapshot_hash:prepared.snapshot_hash,field_id:auditor.id,value:'Harbour Assurance',quote:auditor.quote,page:auditor.page,reason:'Use the trading name, preserving the original extraction'})
  const correctedPath=`/api/vendors/${vendor.id}/document-reviews/${corrected.id}`
  await post(path+'/decision',{snapshot_hash:prepared.snapshot_hash,decision:'approved',reviewer_person_id:reviewer.id,reason:'Stale correction'},409)
  d=await get(correctedPath);assert.equal(d.history.length,2);assert.equal((await get(path)).snapshot.fields.find(f=>f.id===auditor.id).value,'Harbour Assurance LLP')
  const cuecs=d.snapshot.fields.filter(f=>f.kind==='cuec'),decision={snapshot_hash:corrected.snapshot_hash,decision:'approved',reviewer_person_id:reviewer.id,reason:'Reviewed every original page',['mapping_'+cuecs[0].id]:cid,['mapping_'+cuecs[1].id]:'unaddressed'}
  await post(correctedPath+'/decision',{...decision,snapshot_hash:'0'.repeat(64)},409)
  await post(correctedPath+'/decision',decision,200)
  let obligations=(await get('/api/vendors/obligations')).obligations;assert.equal(obligations.length,2);assert.equal(obligations.filter(c=>!c.control_id).length,1);assert.equal(obligations.find(c=>!c.control_id).accepted_unaddressed,1)
  let detail=await get('/api/vendors/'+vendor.id);assert.equal(detail.findings.length,1);assert.equal(detail.profile.risk_tier,'high')
  await post(correctedPath+'/decision',decision,409)
  const program=await post('/api/programs',{framework:'soc2',report_type:'Type II',name:'Supplier obligation program',legal_entity:'Northstar Inc',audit_from:'2026-01-01',audit_to:'2026-12-31'})
  const report=await get('/api/programs/'+program.id);assert.equal(report.readiness.totals.vendor_cuecs_open,1)
  await upload(vendor.id,'bridge',pdfFixture([['Bridge letter: no material change through 2026-11-01']]),{effective_on:'2026-11-01'})
  assert.equal((await get(correctedPath)).bridge.state,'letter on file')
  await post(`/api/vendors/${vendor.id}/review-settings`,{bridge_months:'0'},400)
  await post(`/api/vendors/${vendor.id}/review-settings`,{bridge_months:'12'},200)
  assert.equal((await get(correctedPath)).bridge.months,12)
  const qualified=await upload(vendor.id,'soc1',socReport('qualified')),q=await post(`/api/vendors/${vendor.id}/documents/${qualified.id}/reviews`,{}),qp=`/api/vendors/${vendor.id}/document-reviews/${q.id}`
  assert.equal((await get('/api/vendors/'+vendor.id)).findings.length,1,'proposal never creates a finding')
  await post(qp+'/decision',{snapshot_hash:q.snapshot_hash,decision:'rejected',reviewer_person_id:reviewer.id,reason:'Not the applicable report'},200)
  assert.equal((await get('/api/vendors/'+vendor.id)).findings.length,1,'rejection changes nothing')
  const q2=await post(`/api/vendors/${vendor.id}/documents/${qualified.id}/reviews`,{})
  await post(`/api/vendors/${vendor.id}/document-reviews/${q2.id}/decision`,{snapshot_hash:q2.snapshot_hash,decision:'approved',reviewer_person_id:reviewer.id,reason:'Qualified report reviewed'},200)
  assert.equal((await get('/api/vendors/'+vendor.id)).findings.length,3,'exception and qualified opinion only appear after approval')
  await assert.rejects(app.db.prepare('UPDATE vendor_document_reviews SET snapshot_hash=? WHERE id=?').bind('a'.repeat(64),prepared.id).run(),/immutable_vendor_review/)
  const archive=Buffer.from(await (await app.fetch('/api/archive/export')).arrayBuffer()),dest=await runtime()
  try{await dest.signin();const r=await dest.fetch('/api/archive/restore',{method:'POST',headers:{origin:dest.origin,'content-type':'application/octet-stream','x-evidence-confirm':'restore','x-evidence-erasure-history':'unverified acknowledged'},body:archive});assert.equal(r.status,200,await r.clone().text());assert.deepEqual((await (await dest.fetch(correctedPath)).json()).snapshot,(await get(correctedPath)).snapshot);assert.deepEqual((await (await dest.fetch('/api/vendors/obligations')).json()).obligations,(await get('/api/vendors/obligations')).obligations)}finally{await dest.close()}
  console.log('PASS VENDOR-003: PDF page citations, review corrections, exact named approvals, CUECs in readiness, bridge letters, qualified findings and archive parity')
 }finally{await app.close()}
}
