import assert from 'node:assert/strict'
import { runtime } from './runtime.mjs'
import { xlsx,zipFixture } from './xlsx.mjs'
export const questionRows=[['id','section','question','format','answer'],['Q1','Access','Describe quarterly access reviews','text',''],['Q2','Unknown','Describe submarine docking safeguards','text',''],['Q3','Access','Do you perform quarterly access reviews?','yes/no','']]
export const csvQuestionnaire=()=>questionRows.map(r=>r.map(s=>'"'+s.replaceAll('"','""')+'"').join(',')).join('\r\n')
export const docxQuestionnaire=()=>zipFixture({'[Content_Types].xml':'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>','_rels/.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>','word/document.xml':'<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:tbl>'+questionRows.map(r=>'<w:tr>'+r.map(c=>'<w:tc><w:p><w:r><w:t>'+c+'</w:t></w:r></w:p></w:tc>').join('')+'</w:tr>').join('')+'</w:tbl></w:body></w:document>','word/media/synthetic.bin':Buffer.from([0,255,1,254])})
export function zipEntries(bytes){const out=new Map();let at=0;while(bytes.readUInt32LE(at)===0x04034b50){const size=bytes.readUInt32LE(at+18),n=bytes.readUInt16LE(at+26),extra=bytes.readUInt16LE(at+28),name=bytes.subarray(at+30,at+30+n).toString();out.set(name,bytes.subarray(at+30+n+extra,at+30+n+extra+size));at+=30+n+extra+size}return out}
export async function answerJourney(){const app=await runtime();try{
 await app.signin()
 const post=async(path,body,status=201)=>{const r=await app.fetch(path,{method:'POST',headers:{origin:app.origin,'content-type':'application/json'},body:JSON.stringify(body)});assert.equal(r.status,status,path+' '+await r.clone().text());return r.json()},get=async path=>{const r=await app.fetch(path);assert.equal(r.status,200,path);return r.json()}
 const reviewer=await post('/api/people',{name:'Security reviewer',email:'security@northstar.test',kind:'employee'}),program=await post('/api/programs',{framework:'soc2',name:'Questionnaire program',legal_entity:'Northstar',report_type:'Type II',audit_from:'2026-01-01',audit_to:'2026-12-31'})
 const body='Access reviews occur quarterly for all users.',policy=await post('/api/policies',{title:'Questionnaire access policy',body}),revision=await get(`/api/policies/${policy.policy}/revisions/${policy.revision}`)
 await post('/api/questionnaires/sources',{kind:'policy',source_id:policy.revision,quote:body},409)
 await post(`/api/policies/${policy.policy}/revisions/${policy.revision}/decision`,{decision:'approved',body_sha256:revision.body_sha256},200)
 await post('/api/questionnaires/sources',{kind:'policy',source_id:policy.revision,quote:'Invented policy'},400)
 const source=await post('/api/questionnaires/sources',{kind:'policy',source_id:policy.revision,quote:body})
 const created=[]
 for(const [name,bytes] of [['customer.csv',csvQuestionnaire()],['customer.xlsx',xlsx(questionRows)],['customer.docx',docxQuestionnaire()]]){
  const f=new FormData();for(const [k,v] of Object.entries({name,program_id:program.id,id_column:'id',question_column:'question',section_column:'section',format_column:'format',answer_column:'answer'}))f.set(k,v);f.set('file',new File([bytes],name))
  const upload=await app.fetch('/api/questionnaires',{method:'POST',headers:{origin:app.origin},body:f});assert.equal(upload.status,201,await upload.clone().text());const q=await upload.json(),draft=await post(`/api/questionnaires/${q.id}/drafts`,{}),path=`/api/questionnaires/${q.id}/drafts/${draft.id}`,data=await get(path)
  assert.deepEqual(data.snapshot.stats,{cited:1,flagged:2,conflicting:0,total:3});assert.equal(data.snapshot.answers[0].answer,body);assert.equal(data.snapshot.answers[0].citations[0].revision,revision.body_sha256);assert.equal(data.snapshot.answers[1].answer,'');assert.match(data.snapshot.answers[2].reason,/non-text/)
  assert.equal((await app.fetch(path+'/export?recipient=buyer@customer.test')).status,409)
  const approval={snapshot_hash:draft.snapshot_hash,reviewer_person_id:reviewer.id,recipient:'buyer@customer.test',expires_on:'2027-01-01',reason:'Reviewed exact source excerpts and explicit gaps'}
  await post(path+'/approve',{...approval,snapshot_hash:'0'.repeat(64)},409)
  await post(path+'/approve',approval,200)
  assert.equal((await app.fetch(path+'/export?recipient=other@customer.test')).status,409)
  const output=await app.fetch(path+'/export?recipient=buyer@customer.test');assert.equal(output.status,200);const exported=Buffer.from(await output.arrayBuffer())
  if(name.endsWith('.csv')){assert.match(exported.toString(),/Source policy:/);assert.match(exported.toString(),/Q1/);assert.match(exported.toString(),/FLAGGED/)}else{const files=zipEntries(exported),original=zipEntries(Buffer.from(bytes));for(const [key,value]of original)if(!['word/document.xml','xl/worksheets/sheet1.xml'].includes(key))assert.deepEqual(files.get(key),value,key+' preserved');const text=files.get(name.endsWith('.docx')?'word/document.xml':'xl/worksheets/sheet1.xml').toString();assert.ok(text.includes(body));assert.ok(text.includes('FLAGGED'));assert.ok(text.includes('Q1'))}
  const retained=await (await app.mf.getR2Bucket('EXHIBITS')).get(q.object_key);assert.deepEqual(Buffer.from(await retained.arrayBuffer()),Buffer.from(bytes))
  created.push({q,draft,path})
 }
 // Contradictory source observations are not hidden by an approved policy.
 const token=await post('/api/api-tokens',{name:'Questionnaire observation feed',scopes:['resource-push','read'],expires_at:'2027-01-01'})
 const put=async(path,body)=>{const r=await app.fetch(path,{method:'PUT',headers:{cookie:'',authorization:'Bearer '+token.token,'content-type':'application/json'},body:JSON.stringify(body)});assert.equal(r.status,200,path+' '+await r.clone().text());return r.json()}
 await put('/v1/resource-types/questionnaire_service',{schema:{fields:{access_reviews_quarterly:'boolean'},required:['access_reviews_quarterly']}})
 await put('/v1/resources/questionnaire_service',{resources:[{uniqueId:'synthetic-evidence-questionnaire-service',displayName:'Questionnaire review source',attributes:{access_reviews_quarterly:false}}]})
 const test=await post('/api/tests',{name:'Quarterly access reviews',resourceType:'questionnaire_service',criteria:JSON.stringify([{attribute:'access_reviews_quarterly',op:'equals',value:true}]),cadence:'hourly',category:'identity',severity:'high',controls:[]})
 await post('/api/tests/'+test.id+'/run',{},200)
 const observed=await app.fetch('/v1/test-results?limit=100',{headers:{cookie:'',authorization:'Bearer '+token.token}});assert.equal(observed.status,200)
 const observation=(await observed.json()).data.find(o=>o.result==='fail');assert.ok(observation)
 await post('/api/questionnaires/sources',{kind:'observation',source_id:observation.id,quote:'access_reviews_quarterly'})
 const conflicting=await post(`/api/questionnaires/${created[2].q.id}/drafts`,{}),conflicts=(await get(`/api/questionnaires/${created[2].q.id}/drafts/${conflicting.id}`)).snapshot
 assert.deepEqual(conflicts.stats,{cited:0,flagged:2,conflicting:1,total:3});assert.equal(conflicts.answers[0].answer,'');assert.ok(conflicts.answers[0].citations.some(c=>c.state==='fail'))
 const checklist=(await get('/api/programs/'+program.id)).readiness.checklist.find(a=>a.area==='Questionnaires');assert.equal(checklist.total,3);assert.equal(checklist.ready,0);assert.equal(checklist.records.length,3)
 const current=created[0],edit=await post(current.path+'/edit',{snapshot_hash:current.draft.snapshot_hash,question_id:'Q2',flag:'yes',reason:'Buyer asks about an unsupported activity'})
 assert.equal((await app.fetch(current.path+'/export?recipient=buyer@customer.test')).status,409,'a new draft requires a fresh decision')
 assert.equal((await get(current.path)).snapshot.answers[1].reason,'No authorized matching source passage.','earlier draft unchanged')
 const changed=await post('/api/policies',{title:'Questionnaire access policy',body:'Access reviews occur monthly for all users.'}),changedRevision=await get(`/api/policies/${changed.policy}/revisions/${changed.revision}`)
 await post(`/api/policies/${changed.policy}/revisions/${changed.revision}/decision`,{decision:'approved',body_sha256:changedRevision.body_sha256},200)
 for(const c of created.slice(1))assert.equal((await app.fetch(c.path+'/export?recipient=buyer@customer.test')).status,409,'source change invalidates reuse')
 await post(`/api/questionnaires/${current.q.id}/drafts/${edit.id}/approve`,{snapshot_hash:edit.snapshot_hash,reviewer_person_id:reviewer.id,recipient:'buyer@customer.test',expires_on:'2027-01-01',reason:'Old source'},409)
 const archive=Buffer.from(await (await app.fetch('/api/archive/export')).arrayBuffer()),dest=await runtime()
 try{await dest.signin();const r=await dest.fetch('/api/archive/restore',{method:'POST',headers:{origin:dest.origin,'content-type':'application/octet-stream','x-evidence-confirm':'restore','x-evidence-erasure-history':'unverified acknowledged'},body:archive});assert.equal(r.status,200,await r.clone().text());const restored=await (await dest.fetch(created[1].path)).json();assert.deepEqual(restored.snapshot,(await get(created[1].path)).snapshot);assert.equal((await dest.fetch(created[1].path+'/export?recipient=buyer@customer.test')).status,409)}finally{await dest.close()}
 console.log('PASS ANSWER-001 slice: CSV/XLSX/DOCX template custody, exact cited excerpts and flags, named recipient approval, draft/source invalidation, checklist drilldown and archive parity')
}finally{await app.close()}}
