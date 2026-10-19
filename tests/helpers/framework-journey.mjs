import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { frameworkFixture,frameworkUpload,revisedFrameworkFixture } from './framework-fixture.mjs'
const sha=bytes=>createHash('sha256').update(bytes).digest('hex')
// One public-door CONTROL-001 journey, called by tests/evidence.mjs with its real runtime.
export async function frameworkJourney(app,fixture={}) {
 const fetch=app.fetch,post=(path,body)=>fetch(path,{method:'POST',headers:{origin:app.origin,'content-type':'application/json'},body:JSON.stringify(body)})
 const read=async path=>{const r=await fetch(path);assert.equal(r.status,200,await r.clone().text());return r.json()}
 const upload=(bytes,fields={},filename)=>fetch('/api/frameworks/import',{method:'POST',headers:{origin:app.origin},body:frameworkUpload(bytes,fields,filename)})
 for(const path of ['/api/frameworks','/api/frameworks/import']) assert.equal((await fetch(path,{headers:{cookie:''}})).status,401)
 assert.equal((await fetch('/api/frameworks',{method:'POST',headers:{origin:'https://foreign.test','content-type':'application/json'},body:JSON.stringify({name:'Refused'})})).status,403)
 assert.equal((await fetch('/api/frameworks',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:'Refused'})})).status,403)
 const native=fixture.control??(await read('/api/desk')).requirements[0]?.control_id
 assert.ok(native,'The parent owner journey provides a native control')
 const created=await post('/api/frameworks',{name:'Internal production-access obligations',actor_name:'Forged importer'});assert.equal(created.status,201)
 const manual=await created.json(),manualBase=`/api/frameworks/${manual.id}`
 assert.equal((await post(manualBase+'/requirements',{ref:'INT-1',title:'',control_ids:native})).status,400)
 const added=await post(manualBase+'/requirements',{ref:'INT-1',title:'Review production privileges',description:'Owner-defined access obligation',section:'Access'});assert.equal(added.status,201)
 const requirement=await added.json(),manualRequirement=manualBase+'/requirements/'+requirement.id
 assert.equal((await read(manualBase+'/readiness')).totals.unmapped,1)
 assert.equal((await post(manualRequirement+'/mappings',{control_id:'unknown',decision:'mapped',reason:'Invalid mapping'})).status,400)
 assert.equal((await post(manualRequirement+'/mappings',{control_id:native,decision:'mapped',reason:'Owner maps existing production access control'})).status,200)
 assert.equal((await read(manualBase+'/readiness')).totals.unmapped,0)
 assert.equal((await post(manualRequirement,{ref:'INT-1',title:'Review production and emergency privileges',description:'Expanded intent prospectively',section:'Access',reason:'Strengthen after failed observation'})).status,200)
 const manualHistory=await read(manualRequirement);assert.equal(manualHistory.history[0].requirement.title,'Review production privileges');assert.equal(manualHistory.requirement.title,'Review production and emergency privileges')
 assert.equal(manualHistory.mapping_history[0].actor_name,'Evidence owner')
 const exported=await read(manualBase+'/export');assert.ok(exported.requirements[0].mappings.includes(native));assert.equal(exported.mapping_history[0].origin,'manual')
 const historicalReport=await read(`/api/controls/${native}/report?from=2026-01-01&to=2026-12-31`)
 if(fixture.test)assert.ok(historicalReport.evaluated.some(r=>r.result==='fail'),'Original control failure exists before framework re-import')
 const bytes=frameworkFixture(native),before=(await read('/api/frameworks')).frameworks.length
 const dry=await upload(bytes);assert.equal(dry.status,200,await dry.clone().text());const preview=await dry.json()
 assert.equal(preview.dry_run,true);assert.equal(preview.total,80);assert.equal(preview.admitted,78);assert.equal(preview.refused,2)
 assert.equal(preview.rows.filter(r=>r.errors.some(e=>/Duplicate/.test(e))).length,1);assert.equal(preview.rows.filter(r=>r.errors.some(e=>/Unknown control/.test(e))).length,1)
 assert.equal((await read('/api/frameworks')).frameworks.length,before)
 assert.equal((await upload(bytes,{confirm:'yes',exclude_invalid:'yes'})).status,409)
 assert.equal((await upload(bytes,{confirm:'yes',review_hash:preview.review_hash})).status,400)
 const missingTitle=Buffer.from('id,title,control_ids\r\nMISSING,,AC-02\r\nVALID,Valid title,\r\n')
 const missingForm=new FormData();missingForm.set('name','Missing-title check');missingForm.set('file',new File([missingTitle],'missing-title.csv',{type:'text/csv'}))
 const missingResponse=await fetch('/api/frameworks/import',{method:'POST',headers:{origin:app.origin},body:missingForm});assert.equal(missingResponse.status,200);const missingPreview=await missingResponse.json();assert.equal(missingPreview.refused,1);assert.match(missingPreview.rows[0].errors.join(' '),/Title is required/)
 missingForm.set('confirm','yes');missingForm.set('exclude_invalid','yes');missingForm.set('review_hash',missingPreview.review_hash)
 const csvAdmission=await fetch('/api/frameworks/import',{method:'POST',headers:{origin:app.origin},body:missingForm});assert.equal(csvAdmission.status,201,await csvAdmission.clone().text());const csvFramework=await csvAdmission.json();assert.equal((await read('/api/frameworks/'+csvFramework.id)).totals.requirements,1);assert.equal((await read('/api/frameworks/'+csvFramework.id)).totals.unmapped,1)
 assert.deepEqual(Buffer.from(await(await fetch('/api/frameworks/'+csvFramework.id+'/revisions/1/file')).arrayBuffer()),missingTitle)
 const confirmed=await upload(bytes,{confirm:'yes',exclude_invalid:'yes',review_hash:preview.review_hash});assert.equal(confirmed.status,201,await confirmed.clone().text())
 const admitted=await confirmed.json(),base='/api/frameworks/'+admitted.id
 let detail=await read(base);assert.equal(detail.totals.requirements,78);assert.equal(detail.totals.unmapped,57);assert.equal(detail.requirements.filter(r=>r.mappings.includes('AC-02')).length,20)
 assert.ok(detail.requirements.find(r=>r.ref==='ADD-078').mappings.includes(native));assert.ok(detail.requirements.find(r=>r.ref==='ADD-001').controls[0].state.id)
 assert.equal(detail.history[0].actor_name,'Evidence owner');assert.equal(detail.history[0].filename,'customer-addendum.xlsx');assert.ok(detail.history[0].at);assert.equal(detail.history[0].sha256,sha(bytes))
 const original=await fetch(base+'/revisions/1/file');assert.equal(original.status,200);assert.deepEqual(Buffer.from(await original.arrayBuffer()),bytes);assert.equal(original.headers.get('x-content-type-options'),'nosniff');assert.match(original.headers.get('content-disposition'),/^attachment;/)
 const revised=revisedFrameworkFixture(native),review=await (await upload(revised,{framework_id:admitted.id})).json();assert.deepEqual(review.differences,{added:[],changed:['ADD-001','ADD-002','ADD-003'],removed:['ADD-078']})
 // A manual mapping advances the revision and invalidates an already reviewed file.
 const target=detail.requirements.find(r=>r.ref==='ADD-021')
 assert.equal((await post(base+'/requirements/'+target.id+'/mappings',{control_id:native,decision:'mapped',reason:'Owner mapping while import is under review'})).status,200)
 assert.equal((await upload(revised,{framework_id:admitted.id,confirm:'yes',review_hash:review.review_hash})).status,409)
 assert.equal((await read(base)).totals.requirements,78)
 const fresh=await (await upload(revised,{framework_id:admitted.id})).json();assert.deepEqual(fresh.differences,{added:[],changed:['ADD-001','ADD-002','ADD-003'],removed:['ADD-078']})
 const applied=await upload(revised,{framework_id:admitted.id,confirm:'yes',review_hash:fresh.review_hash});assert.equal(applied.status,201,await applied.clone().text())
 detail=await read(base);assert.equal(detail.totals.requirements,77);assert.equal(detail.totals.removed,1);assert.ok(detail.requirements.find(r=>r.ref==='ADD-021').mappings.includes(native),'Manual mapping survives file re-import')
 const removed=detail.requirements.find(r=>r.ref==='ADD-078'),removedHistory=await read(base+'/requirements/'+removed.id)
 assert.ok(removed.removed_at);assert.ok(removedHistory.history.some(h=>!h.requirement.removed_at&&h.requirement.mappings.includes(native)));assert.equal(removedHistory.history.at(-1).requirement.removed_at,removed.removed_at)
 const afterRemovalReport=await read(`/api/controls/${native}/report?from=2026-01-01&to=2026-12-31`);assert.deepEqual(afterRemovalReport.evaluated,historicalReport.evaluated,'Requirement removal preserves exact earlier control observations')
 const removedPage=await fetch('/app/frameworks/'+admitted.id+'/requirements/'+removed.id);assert.match(await removedPage.text(),new RegExp(`/app/controls/${native}/report`))
 const oldRevision=await read(base+'/revisions/1');assert.equal(oldRevision.snapshot.requirements.find(r=>r.ref==='ADD-001').title,'Customer obligation 1');assert.equal(oldRevision.snapshot.requirements.find(r=>r.ref==='ADD-078').removed_at,null)
 assert.equal((await post(base+'/requirements/'+removed.id+'/mappings',{control_id:native,decision:'unmapped',reason:'Removed requirements retain history'})).status,404)
 const finalExport=await read(base+'/export');assert.ok(finalExport.requirements.some(r=>r.id===removed.id&&r.removed_at));assert.ok(finalExport.mapping_history.some(m=>m.origin==='manual'))
 for(const path of ['/app/frameworks','/app/frameworks/'+admitted.id,'/app/frameworks/'+admitted.id+'?show=unmapped','/app/frameworks/'+admitted.id+'/requirements/'+removed.id,'/app/frameworks/'+admitted.id+'/revisions/1'])assert.equal((await fetch(path)).status,200)
 // Restart workerd at the recorded revision's timestamp; owner auth and original custody persist.
 await app.clock(detail.history.at(-1).at)
 assert.equal((await read(base)).totals.requirements,77);assert.deepEqual(Buffer.from(await(await fetch(base+'/revisions/1/file')).arrayBuffer()),bytes)
 // Deliberate storage loss is reported through the actual original download door.
 const bucket=await app.mf.getR2Bucket('EXHIBITS');await bucket.put(detail.history[0].object_key,'changed original bytes')
 assert.equal((await fetch(base+'/revisions/1/file')).status,410);assert.equal((await read(base)).history[0].sha256,sha(bytes))
 await bucket.put(detail.history[0].object_key,bytes)
 return {framework:admitted.id,manual_framework:manual.id,removed_requirement:removed.id}
}
