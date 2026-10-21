import assert from 'node:assert/strict'
import { runtime } from './runtime.mjs'
import { xlsx,zipFixture } from './xlsx.mjs'
import { socReport,pdfFixture } from './pdf-fixture.mjs'
export const questionRows=[['id','section','question','format','answer'],['Q1','Access','Describe quarterly access reviews','text',''],['Q2','Unknown','Describe submarine docking safeguards','text',''],['Q3','Access','Do you perform quarterly access reviews?','yes/no','']]
export const csvQuestionnaire=()=>questionRows.map(r=>r.map(s=>'"'+s.replaceAll('"','""')+'"').join(',')).join('\r\n')
export const docxQuestionnaire=()=>zipFixture({'[Content_Types].xml':'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>','_rels/.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>','word/document.xml':'<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:tbl>'+questionRows.map(r=>'<w:tr>'+r.map(c=>'<w:tc><w:p><w:r><w:t>'+c+'</w:t></w:r></w:p></w:tc>').join('')+'</w:tr>').join('')+'</w:tbl></w:body></w:document>','word/media/synthetic.bin':Buffer.from([0,255,1,254])})
export function zipEntries(bytes){const out=new Map();let at=0;while(bytes.readUInt32LE(at)===0x04034b50){const size=bytes.readUInt32LE(at+18),n=bytes.readUInt16LE(at+26),extra=bytes.readUInt16LE(at+28),name=bytes.subarray(at+30,at+30+n).toString();out.set(name,bytes.subarray(at+30+n+extra,at+30+n+extra+size));at+=30+n+extra+size}return out}
export async function answerJourney(){const app=await runtime();try{
 await app.signin();await app.clock('2026-11-02T15:00:00Z')
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
  await post(path+'/edit',{snapshot_hash:draft.snapshot_hash,question_id:'Q3',source_id:source.id,answer_value:'maybe',mapping_confirm:'yes',reason:'Unsupported buyer vocabulary'},400)
  await post(path+'/edit',{snapshot_hash:draft.snapshot_hash,question_id:'Q3',source_id:source.id,answer_value:'yes',reason:'Not explicitly confirmed'},400)
  const mapped=await post(path+'/edit',{snapshot_hash:draft.snapshot_hash,question_id:'Q3',source_id:source.id,answer_value:'yes',mapping_confirm:'yes',reason:'The policy explicitly requires quarterly access reviews for all users'}),mappedPath=`/api/questionnaires/${q.id}/drafts/${mapped.id}`
  assert.equal((await get(mappedPath)).snapshot.answers[2].answer,'yes');assert.equal((await get(mappedPath)).snapshot.stats.cited,2)
  await post(mappedPath+'/approve',{...approval,snapshot_hash:mapped.snapshot_hash},200)
  const mappedOutput=await app.fetch(mappedPath+'/export?recipient=buyer@customer.test');assert.equal(mappedOutput.status,200)
  const mappedBytes=Buffer.from(await mappedOutput.arrayBuffer())
  if(name.endsWith('.csv'))assert.ok(mappedBytes.toString().includes('"Q3","Access","Do you perform quarterly access reviews?","yes/no","yes"'),'declared choice cell contains only the selected value')
  const manifest=await get(mappedPath+'/citations?recipient=buyer@customer.test')
  assert.equal(manifest.snapshot_hash,mapped.snapshot_hash);assert.equal(manifest.answers[2].mapping.value,'yes');assert.equal(manifest.answers[2].citations[0].quote,body);assert.equal(manifest.answers[1].state,'flagged')
  assert.equal((await app.fetch(mappedPath+'/citations?recipient=other@customer.test')).status,409)
  created.push({q,draft:mapped,path:mappedPath})
 }
 // Prior cited answers retain their exact decision and recursively validate
 // every underlying source. A new draft or expiry of the parent invalidates reuse.
 const parent=created[0],prior=await post('/api/questionnaires/sources',{kind:'approved-answer',source_id:parent.draft.id+':Q1',quote:body})
 const reuse=await post(created[1].path+'/edit',{snapshot_hash:created[1].draft.snapshot_hash,question_id:'Q1',source_id:prior.id})
 created[1]={...created[1],draft:reuse,path:`/api/questionnaires/${created[1].q.id}/drafts/${reuse.id}`}
 let reused=(await get(created[1].path)).snapshot.answers[0]
 assert.equal(reused.citations[0].kind,'approved-answer');assert.equal(reused.citations[0].revision,parent.draft.snapshot_hash)
 await post(created[1].path+'/approve',{snapshot_hash:reuse.snapshot_hash,reviewer_person_id:reviewer.id,recipient:'buyer@customer.test',expires_on:'2027-01-01',reason:'Reviewed parent answer and its current approved policy'},200)
 assert.equal((await app.fetch(created[1].path+'/export?recipient=buyer@customer.test')).status,200)
 // A SOC report passage is usable only after its latest exact cited review was
 // approved; its original digest and period remain attached to the answer.
 const vendor=await post('/api/vendors',{name:'Northstar audit-report custodian',criticality:'low'})
 const uploadReport=async bytes=>{const f=new FormData();f.set('kind','soc2');f.set('file',new File([bytes],'northstar-soc2.pdf',{type:'application/pdf'}));const r=await app.fetch(`/api/vendors/${vendor.id}/documents`,{method:'POST',headers:{origin:app.origin},body:f});assert.equal(r.status,201);return r.json()}
 const quote='Quarterly access reviews are performed by company security.',report=await uploadReport(pdfFixture([['SOC 2 Type II','Period: 2026-01-01 to 2026-09-30','Service auditor: Synthetic CPA LLP','Opinion: unqualified',quote]])),review=await post(`/api/vendors/${vendor.id}/documents/${report.id}/reviews`,{})
 await post('/api/questionnaires/sources',{kind:'audit-report',source_id:review.id,quote},409)
 await post(`/api/vendors/${vendor.id}/document-reviews/${review.id}/decision`,{snapshot_hash:review.snapshot_hash,decision:'approved',reviewer_person_id:reviewer.id,reason:'Reviewed exact report pages'},200)
 const audit=await post('/api/questionnaires/sources',{kind:'audit-report',source_id:review.id,quote})
 const editedReport=await post(created[2].path+'/edit',{snapshot_hash:created[2].draft.snapshot_hash,question_id:'Q1',source_id:audit.id})
 created[2]={...created[2],draft:editedReport,path:`/api/questionnaires/${created[2].q.id}/drafts/${editedReport.id}`}
 const reportAnswer=(await get(created[2].path)).snapshot.answers[0],citation=reportAnswer.citations[0]
 assert.equal(reportAnswer.answer,quote);assert.equal(citation.kind,'audit-report');assert.equal(citation.period_from,'2026-01-01');assert.equal(citation.period_to,'2026-09-30');assert.equal(citation.revision,review.snapshot_hash+':'+report.sha256)
 const citedPage=await app.fetch(citation.href);assert.equal(citedPage.status,200);assert.ok((await citedPage.text()).includes(quote))
 await post(created[2].path+'/approve',{snapshot_hash:editedReport.snapshot_hash,reviewer_person_id:reviewer.id,recipient:'buyer@customer.test',expires_on:'2027-01-01',reason:'Reviewed exact SOC report source and dates'},200)
 assert.equal((await app.fetch(created[2].path+'/export?recipient=buyer@customer.test')).status,200)
 await uploadReport(socReport('qualified'))
 assert.equal((await app.fetch(created[2].path+'/export?recipient=buyer@customer.test')).status,409,'superseded report invalidates its exact answer set')
 const undated=await uploadReport(pdfFixture([['SOC 2 Type II','Opinion: unqualified',quote]])),undatedReview=await post(`/api/vendors/${vendor.id}/documents/${undated.id}/reviews`,{})
 await post(`/api/vendors/${vendor.id}/document-reviews/${undatedReview.id}/decision`,{snapshot_hash:undatedReview.snapshot_hash,decision:'approved',reviewer_person_id:reviewer.id,reason:'The source is retained, with period explicitly unresolved'},200)
 await post('/api/questionnaires/sources',{kind:'audit-report',source_id:undatedReview.id,quote},409)

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
 assert.equal((await app.fetch(created[1].path+'/export?recipient=buyer@customer.test')).status,409,'a newer parent draft invalidates recursively reused answers')
 assert.equal((await get(current.path)).snapshot.answers[1].reason,'No authorized matching source passage.','earlier draft unchanged')
 const changed=await post('/api/policies',{title:'Questionnaire access policy',body:'Access reviews occur monthly for all users.'}),changedRevision=await get(`/api/policies/${changed.policy}/revisions/${changed.revision}`)
 await post(`/api/policies/${changed.policy}/revisions/${changed.revision}/decision`,{decision:'approved',body_sha256:changedRevision.body_sha256},200)
 for(const c of created.slice(1))assert.equal((await app.fetch(c.path+'/export?recipient=buyer@customer.test')).status,409,'source change invalidates reuse')
 await post(`/api/questionnaires/${current.q.id}/drafts/${edit.id}/approve`,{snapshot_hash:edit.snapshot_hash,reviewer_person_id:reviewer.id,recipient:'buyer@customer.test',expires_on:'2027-01-01',reason:'Old source'},409)
 const archive=Buffer.from(await (await app.fetch('/api/archive/export')).arrayBuffer()),dest=await runtime()
 try{await dest.signin();const r=await dest.fetch('/api/archive/restore',{method:'POST',headers:{origin:dest.origin,'content-type':'application/octet-stream','x-evidence-confirm':'restore','x-evidence-erasure-history':'unverified acknowledged'},body:archive});assert.equal(r.status,200,await r.clone().text());const restored=await (await dest.fetch(created[1].path)).json();assert.deepEqual(restored.snapshot,(await get(created[1].path)).snapshot);assert.equal((await dest.fetch(created[1].path+'/export?recipient=buyer@customer.test')).status,409)}finally{await dest.close()}
 await app.clock('2027-01-02T15:00:00Z')
 await post('/api/questionnaires/sources',{kind:'approved-answer',source_id:reuse.id+':Q1',quote:body},409)
 console.log('PASS ANSWER-001 slice: CSV/XLSX/DOCX template custody, exact cited excerpts and flags, named recipient approval, draft/source invalidation, checklist drilldown and archive parity')
}finally{await app.close()}}
