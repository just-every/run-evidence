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
 // Isolate approval expiry from the source/parent changes tested above.
 const currentQuote='Access reviews occur monthly for all users.',stableSource=await post('/api/questionnaires/sources',{kind:'policy',source_id:changed.revision,quote:currentQuote})
 const expiryFile=new FormData();for(const [k,v]of Object.entries({name:'Approval expiry isolation',program_id:program.id,id_column:'id',question_column:'question',section_column:'section',format_column:'format',answer_column:'answer'}))expiryFile.set(k,v)
 expiryFile.set('file',new File(['id,section,question,format,answer\nEXP,Access,Describe monthly access reviews,text,\n'],'expiry.csv'))
 const expiryUpload=await app.fetch('/api/questionnaires',{method:'POST',headers:{origin:app.origin},body:expiryFile});assert.equal(expiryUpload.status,201)
 const expiryQ=await expiryUpload.json(),expiryDraft=await post(`/api/questionnaires/${expiryQ.id}/drafts`,{}),stableDraft=await post(`/api/questionnaires/${expiryQ.id}/drafts/${expiryDraft.id}/edit`,{snapshot_hash:expiryDraft.snapshot_hash,question_id:'EXP',source_id:stableSource.id}),stablePath=`/api/questionnaires/${expiryQ.id}/drafts/${stableDraft.id}`
 await post(stablePath+'/approve',{snapshot_hash:stableDraft.snapshot_hash,reviewer_person_id:reviewer.id,recipient:'buyer@customer.test',expires_on:'2026-11-03',reason:'Expiry proof with a stable current source'},200)
 await post('/api/questionnaires/sources',{kind:'approved-answer',source_id:stableDraft.id+':EXP',quote:currentQuote})
 assert.equal((await app.fetch(stablePath+'/export?recipient=buyer@customer.test')).status,200)
 await app.clock('2026-11-04T15:00:00Z')
 await post('/api/questionnaires/sources',{kind:'policy',source_id:changed.revision,quote:currentQuote})
 await post('/api/questionnaires/sources',{kind:'approved-answer',source_id:stableDraft.id+':EXP',quote:currentQuote},409)
 assert.equal((await app.fetch(stablePath+'/export?recipient=buyer@customer.test')).status,409,'approval expiry alone refuses the original and its reuse')
 // Portal capture uses its own inbound-only scope and preserves typed pages
 // without granting access to answers, other API reads or owner decisions.
 const captureToken=await post('/api/api-tokens',{name:'Synthetic portal capture',scopes:['portal-capture','portal-fill'],expires_at:'2026-12-01'})
 const portalPages=[
  {id:'access',title:'Access controls',url:'https://portal.example.test/access',unsupported:[],fields:[{id:'access-text',label:'Describe monthly access reviews',type:'text',section:'Access',options:[]}]},
  {id:'choices',title:'Control selection',url:'https://portal.example.test/choices',unsupported:[],fields:[{id:'access-choice',label:'Review cadence',type:'choice',options:[{value:'monthly',label:'Monthly'},{value:'annual',label:'Annual'}]},{id:'access-multi',label:'Review participants',type:'multi-select',options:[{value:'security',label:'Security'},{value:'legal',label:'Legal'}]}]},
  {id:'documents',title:'Documents',url:'https://portal.example.test/documents',unsupported:[],fields:[{id:'enabled',label:'Reviews enabled',type:['yes','no'].join('/'),options:[{value:'yes',label:'Yes'}]},{id:'policy-file',label:'Attach reviewed policy',type:'file',options:[],accept:'.pdf'}]},
 ]
 const captureBody={name:'Captured procurement portal',program_id:program.id,pages:portalPages}
 const portalCall=(token,body,path='/v1/questionnaires/captures')=>app.fetch(path,{method:'POST',headers:{cookie:'',authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify(body)})
 assert.equal((await portalCall(captureToken.token,captureBody,'/api/questionnaires')).status,403)
 assert.equal((await app.fetch('/v1/programs',{headers:{cookie:'',authorization:'Bearer '+captureToken.token}})).status,403)
 const readToken=await post('/api/api-tokens',{name:'No capture authority',scopes:['read'],expires_at:'2026-12-01'})
 assert.equal((await portalCall(readToken.token,captureBody)).status,403)
 for(const pages of [[{...portalPages[0],unsupported:['Unidentified field']}],[portalPages[0],portalPages[0]],[{...portalPages[0],url:'https://portal.example.test/access?token=synthetic-evidence-1'}],[portalPages[0],{...portalPages[1],url:'https://other.example.test/choices'}],[{...portalPages[0],fields:[{...portalPages[0].fields[0],type:'password'}]}]])assert.equal((await portalCall(captureToken.token,{...captureBody,pages})).status,400)
 const captureResponse=await portalCall(captureToken.token,captureBody);assert.equal(captureResponse.status,201,await captureResponse.clone().text());const captured=await captureResponse.json()
 const portalView=await get('/api/questionnaires/'+captured.id)
 assert.deepEqual(portalView.questions.map(q=>q.format),['text','choice','multi-select',['yes','no'].join('/'),'file'])
 assert.deepEqual(portalView.questions.map(q=>q.page),['access','choices','choices','documents','documents'])
 assert.deepEqual(portalView.questions[1].portal.options,portalPages[1].fields[0].options)
 const captureObject=await (await app.mf.getR2Bucket('EXHIBITS')).get(captured.object_key),original=JSON.parse(await captureObject.text())
 assert.equal(original.captured_at,'2026-11-04T15:00:00.000Z');assert.equal(original.pages.length,3)
 const captureDraft=await post(`/api/questionnaires/${captured.id}/drafts`,{}),captureReview=await get(`/api/questionnaires/${captured.id}/drafts/${captureDraft.id}`)
 assert.equal(captureReview.snapshot.stats.flagged,4,'unsupported choice and file drafting stays explicitly flagged')
 assert.equal(captureReview.snapshot.answers[0].answer,currentQuote)
 const fillBody={draft_id:captureDraft.id,recipient:'buyer@customer.test',page:portalPages[0]}
 const fillPath='/v1/questionnaires/'+captured.id+'/fill-plan'
 assert.equal((await portalCall(captureToken.token,fillBody,fillPath)).status,409,'unapproved capture draft cannot fill')
 let mappedPortal=captureDraft
 for(const [index,value]of [[1,'monthly'],[2,JSON.stringify(['security','legal'])]]){
  const qid=portalView.questions[index].id
  const mappedResponse=await post(`/api/questionnaires/${captured.id}/drafts/${mappedPortal.id}/edit`,{snapshot_hash:mappedPortal.snapshot_hash,question_id:qid,source_id:stableSource.id,answer_value:value,mapping_confirm:'yes',reason:'Reviewed this exact portal choice against the source passage'})
  mappedPortal=mappedResponse
 }
 await post(`/api/questionnaires/${captured.id}/drafts/${mappedPortal.id}/approve`,{snapshot_hash:mappedPortal.snapshot_hash,reviewer_person_id:reviewer.id,recipient:'buyer@customer.test',expires_on:'2026-12-01',reason:'Reviewed exact text, choices and remaining flagged answers'},200)
 fillBody.draft_id=mappedPortal.id
 assert.equal((await portalCall(captureToken.token,{...fillBody,recipient:'other@customer.test'},fillPath)).status,409)
 const planResponse=await portalCall(captureToken.token,fillBody,fillPath);assert.equal(planResponse.status,200,await planResponse.clone().text());const plan=await planResponse.json()
 assert.equal(plan.results[0].value,currentQuote,'fill carries exact approved text, without appended citation text')
 const changedPage=structuredClone(portalPages[1]);changedPage.fields[0].options.push({value:'weekly',label:'Weekly'})
 const changedResponse=await portalCall(captureToken.token,{...fillBody,page:changedPage},fillPath);assert.equal(changedResponse.status,200);const changedPlan=await changedResponse.json()
 assert.equal(changedPlan.results[0].state,'refused');assert.match(changedPlan.results[0].reason,/changed/)
 assert.equal(changedPlan.results[1].value,JSON.stringify(['security','legal']))
 for(const page of [
  {...portalPages[0],fields:[]},
  {...portalPages[0],fields:[{...portalPages[0].fields[0],type:'file'}]},
  {...portalPages[0],fields:[...portalPages[0].fields,{...portalPages[0].fields[0],id:'added-field'}]},
 ]){const r=await portalCall(captureToken.token,{...fillBody,page},fillPath);assert.equal(r.status,200);assert.ok((await r.json()).results.some(f=>f.state==='refused'&&/removed|changed|added/.test(f.reason)))}
 const unapprovedResponse=await portalCall(captureToken.token,{...fillBody,page:portalPages[2]},fillPath);assert.equal(unapprovedResponse.status,200);const unapprovedPlan=await unapprovedResponse.json();assert.ok(unapprovedPlan.results.every(r=>r.state==='refused'))
 const otherFillToken=await post('/api/api-tokens',{name:'Different capture token',scopes:['portal-fill'],expires_at:'2026-12-01'})
 assert.equal((await portalCall(otherFillToken.token,fillBody,fillPath)).status,403)
 const recaptureResponse=await portalCall(captureToken.token,{...captureBody,previous_id:captured.id,pages:[portalPages[0],changedPage,portalPages[2]]});assert.equal(recaptureResponse.status,201);const recapture=await recaptureResponse.json()
 assert.equal(JSON.parse(recapture.mapping_json).portal.previous_id,captured.id)
 assert.equal((await portalCall(captureToken.token,{...fillBody,draft_id:mappedPortal.id},'/v1/questionnaires/'+recapture.id+'/fill-plan')).status,404,'re-capture needs its own draft and decision')
 const reported=await portalCall(captureToken.token,{draft_id:mappedPortal.id,snapshot_hash:mappedPortal.snapshot_hash,page_id:'access',results:[{id:'access-text',state:'filled'}]},'/v1/questionnaires/'+captured.id+'/fill-reports');assert.equal(reported.status,201)
 const fillHistory=(await app.db.prepare("SELECT action,revision FROM product_audit WHERE subject=? AND action LIKE 'questionnaire.portal-fill-%'").bind('questionnaire:'+captured.id).all()).results
 assert.ok(fillHistory.some(h=>h.action==='questionnaire.portal-fill-reported'&&h.revision===mappedPortal.snapshot_hash))
 await portalBrowser(app,program,reviewer,stableSource,currentQuote,post,get)
 const captureArchiveResponse=await app.fetch('/api/archive/export');assert.equal(captureArchiveResponse.status,200,await captureArchiveResponse.clone().text())
 const captureArchive=Buffer.from(await captureArchiveResponse.arrayBuffer()),portalDestination=await runtime()
 try{await portalDestination.signin();const restored=await portalDestination.fetch('/api/archive/restore',{method:'POST',headers:{origin:portalDestination.origin,'content-type':'application/octet-stream','x-evidence-confirm':'restore','x-evidence-erasure-history':'unverified acknowledged'},body:captureArchive});assert.equal(restored.status,200,await restored.clone().text());assert.deepEqual((await (await portalDestination.fetch('/api/questionnaires/'+captured.id)).json()).questions,portalView.questions);assert.equal((await portalDestination.fetch('/v1/questionnaires/captures',{method:'POST',headers:{authorization:'Bearer '+captureToken.token,'content-type':'application/json'},body:JSON.stringify(captureBody)})).status,401)}finally{await portalDestination.close()}
 await app.clock('2026-12-02T15:00:00Z')
 assert.equal((await portalCall(captureToken.token,fillBody,fillPath)).status,401,'token expiry stops fill before answer release')
 await app.clock('2026-11-04T15:00:00Z')
 const revisedPortal=await post(`/api/questionnaires/${captured.id}/drafts/${mappedPortal.id}/edit`,{snapshot_hash:mappedPortal.snapshot_hash,question_id:portalView.questions[0].id,source_id:stableSource.id})
 assert.equal((await portalCall(captureToken.token,fillBody,fillPath)).status,409,'an edited draft invalidates the earlier exact fill approval')
 await post(`/api/questionnaires/${captured.id}/drafts/${revisedPortal.id}/approve`,{snapshot_hash:revisedPortal.snapshot_hash,reviewer_person_id:reviewer.id,recipient:'buyer@customer.test',expires_on:'2026-12-01',reason:'Fresh exact portal revision'},200)
 const freshFill={...fillBody,draft_id:revisedPortal.id};assert.equal((await portalCall(captureToken.token,freshFill,fillPath)).status,200)
 const supersedingPolicy=await post('/api/policies',{title:'Questionnaire access policy',body:'Access reviews occur weekly for all users.'}),supersedingRevision=await get(`/api/policies/${supersedingPolicy.policy}/revisions/${supersedingPolicy.revision}`)
 await post(`/api/policies/${supersedingPolicy.policy}/revisions/${supersedingPolicy.revision}/decision`,{decision:'approved',body_sha256:supersedingRevision.body_sha256},200)
 assert.equal((await portalCall(captureToken.token,freshFill,fillPath)).status,409,'a superseded policy refuses portal release through AGENT-005')
 await post('/api/api-tokens/'+captureToken.grant.id+'/revoke',{},200)
 assert.equal((await portalCall(captureToken.token,captureBody)).status,401)
 console.log('PASS ANSWER-002 capture slice: inbound scope, typed three-page import, refusals, exact source draft, audit and inactive archive restore')
 console.log('PASS ANSWER-001 slice: CSV/XLSX/DOCX template custody, exact cited excerpts and flags, named recipient approval, draft/source invalidation, checklist drilldown and archive parity')
}finally{await app.close()}}

// Native Chromium proof uses the shipped isolated-world scanner and applier,
// a real three-page portal and the production HTTP approval doors.
export async function portalBrowser(app,program,reviewer,source,quote,post,get){
 const {existsSync}=await import('node:fs'),{createServer}=await import('node:http'),{readFile,mkdir}=await import('node:fs/promises'),{resolve,join,extname}=await import('node:path'),{chromium}=await import('playwright')
 const output=process.env.EVIDENCE_BROWSER_OUTPUT||resolve('.cache/browser/portal');await mkdir(output,{recursive:true})
 let server,browser,origin
 const html=n=>`<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Procurement page ${n}</title><style>body{font:16px system-ui;margin:20px;max-width:800px}label{display:block;margin:20px 0}input,select,textarea,button{font:inherit;max-width:100%;box-sizing:border-box}textarea{width:100%;height:90px}</style><h1>Procurement page ${n}</h1><form id="procurement" onsubmit="window.submitted=true;event.preventDefault()">${n===1?'<label>Describe monthly access reviews<textarea id="access">synthetic-evidence-entered-value</textarea></label><input type="hidden" value="synthetic-evidence-hidden-value"><input type="password" value="synthetic-evidence-password-value">':n===2?'<label>Review cadence<select id="cadence"><option value="monthly">Monthly</option><option value="annual">Annual</option></select></label><label>Review participants<select id="participants" multiple><option value="security">Security</option><option value="legal">Legal</option></select></label>':'<label>Reviews enabled<input id="enabled" type="checkbox"></label><label>Approved policy document<input id="document" type="file" accept=".pdf"></label>'}<button>Submit questionnaire</button></form><nav>${[1,2,3].map(i=>`<a href="/portal/${i}">Page ${i}</a>`).join(' · ')}</nav></html>`
 server=createServer(async(req,res)=>{try{
  const url=new URL(req.url,origin),portal=/^\/portal\/([123])$/.exec(url.pathname)
  if(portal){res.setHeader('content-type','text/html');res.end(html(Number(portal[1])));return}
  if(url.pathname==='/popup.html'){res.setHeader('content-type','text/html');res.setHeader('content-security-policy',"script-src 'none'");res.end(await readFile('public/portal-extension/popup.html'));return}
  const asset=resolve('public','.'+url.pathname)
  if(asset.startsWith(resolve('public')+'/')&&/\.(css|woff2?|svg|png|js)$/.test(asset)){res.setHeader('content-type',({'.css':'text/css','.js':'application/javascript','.woff2':'font/woff2','.svg':'image/svg+xml'})[extname(asset)]||'application/octet-stream');res.end(await readFile(asset));return}
  const chunks=[];for await(const c of req)chunks.push(c)
  const headers={...req.headers,host:new URL(app.origin).host};if(headers.origin===origin)headers.origin=app.origin
  const r=await app.fetch(url.pathname+url.search,{method:req.method,headers,...(['GET','HEAD'].includes(req.method)?{}:{body:Buffer.concat(chunks)})})
  res.writeHead(r.status,Object.fromEntries(r.headers));res.end(Buffer.from(await r.arrayBuffer()))
 }catch(error){res.writeHead(500);res.end('Browser transport unavailable')}})
 await new Promise(done=>server.listen(0,'127.0.0.1',done));origin='http://127.0.0.1:'+server.address().port
 const v1=async(token,path,body,status=200)=>{const r=await app.fetch(path,{method:'POST',headers:{cookie:'',authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify(body)});assert.equal(r.status,status,await r.clone().text());return r}
 try{
  browser=await chromium.launch({...(process.env.EVIDENCE_CHROMIUM_PATH||existsSync('/usr/bin/chromium')?{executablePath:process.env.EVIDENCE_CHROMIUM_PATH||'/usr/bin/chromium'}:{}),headless:true,args:['--no-sandbox','--use-mock-keychain','--password-store=basic']})
  for(const width of [1440,390]){
   const context=await browser.newContext({viewport:{width,height:1000}}),page=await context.newPage(),pages=[]
   const shot=async name=>{const iconOnly=await page.locator('button,a,summary,[role=button]').evaluateAll(nodes=>nodes.filter(el=>el.getClientRects().length&&!el.textContent.trim()).length);assert.equal(iconOnly,0,'Touched screens have no icon-only interactive controls');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No overflow: '+name+' '+width);await page.screenshot({path:join(output,width+'-'+name+'.png'),fullPage:true})}
   for(const n of [1,2,3]){await page.goto(origin+'/portal/'+n);await page.addScriptTag({path:'public/portal-extension/scan.js'});const scan=await page.evaluate(()=>scanPortalPage());assert.deepEqual(scan.unsupported,[]);assert.doesNotMatch(JSON.stringify(scan),/synthetic-evidence-(entered|hidden|password)-value/);pages.push({id:'step-'+n,...scan});await shot('captured-page-'+n)}
   assert.deepEqual(pages.flatMap(p=>p.fields.map(f=>f.type)),['text','choice','multi-select',['yes','no'].join('/'),'file'])
   const token=await post('/api/api-tokens',{name:'Browser portal '+width,scopes:['portal-capture','portal-fill'],expires_at:'2026-12-01'}),capture=await (await v1(token.token,'/v1/questionnaires/captures',{name:'Portal browser '+width,program_id:program.id,pages},201)).json()
   const questions=(await get('/api/questionnaires/'+capture.id)).questions
   let draft=await post('/api/questionnaires/'+capture.id+'/drafts',{})
   const map=async(index,value,sourceId=source.id)=>{draft=await post(`/api/questionnaires/${capture.id}/drafts/${draft.id}/edit`,{snapshot_hash:draft.snapshot_hash,question_id:questions[index].id,source_id:sourceId,answer_value:value,mapping_confirm:'yes',reason:'Reviewed exact source and portal field at '+width})}
   await map(1,'monthly');await map(2,JSON.stringify(['security','legal']))
   const requirement=(await get('/api/desk')).requirements[0].id,form=new FormData();form.set('source','Synthetic reviewed portal document');form.set('covered_from','2026-11-04');form.set('covered_to','2026-11-04');form.set('file',new File(['synthetic-evidence-document-'+width],'synthetic-evidence-'+width+'.pdf',{type:'application/pdf'}))
   const uploaded=await app.fetch('/app/requirements/'+requirement+'/uploads',{method:'POST',headers:{origin:app.origin},body:form});assert.equal(uploaded.status,303)
   const documentId=uploaded.headers.get('location').split('/').at(-1),documentSource=await post('/api/questionnaires/sources',{kind:'exhibit',source_id:documentId,quote:'synthetic-evidence-'+width+'.pdf'})
   await map(4,'',documentSource.id)
   await post(`/api/questionnaires/${capture.id}/drafts/${draft.id}/approve`,{snapshot_hash:draft.snapshot_hash,reviewer_person_id:reviewer.id,recipient:'buyer@customer.test',expires_on:'2026-12-01',reason:'Exact portal text, choices and original document approved; enabled answer remains flagged'},200)
   await page.goto(origin+`/app/questionnaires/${capture.id}/drafts/${draft.id}`);await page.getByRole('heading',{name:'Approved recipient',exact:true}).waitFor();await page.getByLabel('Exact portal choice value or JSON list',{exact:true}).waitFor();await shot('approved-portal-draft')
   await page.goto(origin+'/app/questionnaires');assert.equal(await page.locator('select[name=kind] option[value=exhibit]').count(),1);await shot('questionnaires-source-selection')
   await page.goto(origin+'/app/questionnaires/'+capture.id);await page.getByRole('heading',{name:'Portal capture',exact:true}).waitFor();await shot('capture-history')
   await page.goto(origin+'/app/connections');await page.getByRole('checkbox',{name:'portal-capture',exact:true}).waitFor();await shot('capture-token-settings')
   const fill=async(n,changed=false)=>{
    await page.goto(origin+'/portal/'+n);await page.addScriptTag({path:'public/portal-extension/scan.js'})
    if(changed)await page.evaluate(()=>document.querySelector('#cadence').add(new Option('Weekly','weekly')))
    const scan=await page.evaluate(()=>scanPortalPage()),body={draft_id:draft.id,recipient:'buyer@customer.test',page:{id:'step-'+n,...scan}},plan=await (await v1(token.token,`/v1/questionnaires/${capture.id}/fill-plan`,body)).json()
    for(const field of plan.results.filter(r=>r.state==='ready'&&r.document)){const bytes=Buffer.from(await (await v1(token.token,`/v1/questionnaires/${capture.id}/document`,{...body,field_id:field.id})).arrayBuffer());assert.equal(bytes.toString(),'synthetic-evidence-document-'+width);field.bytes=bytes.toString('base64')}
    const result=await page.evaluate(plan=>applyPortalPlan(plan),plan)
    assert.ok(!await page.evaluate(()=>window.submitted),'Extension never submits the form')
    await v1(token.token,`/v1/questionnaires/${capture.id}/fill-reports`,{draft_id:draft.id,snapshot_hash:draft.snapshot_hash,page_id:'step-'+n,results:result.results},201)
    return {plan,result}
   }
   await fill(1);assert.equal(await page.locator('#access').inputValue(),quote);await shot('exact-text-filled')
   const changed=await fill(2,true);assert.equal(changed.result.results[0].state,'refused');assert.deepEqual(await page.locator('#participants').evaluate(el=>[...el.selectedOptions].map(o=>o.value)),['security','legal']);await shot('changed-choice-refused');const recapturedPage={id:'step-2',...await page.evaluate(()=>scanPortalPage())}
   const files=await fill(3);assert.equal(files.result.results[0].state,'refused');assert.equal(await page.locator('#document').evaluate(el=>el.files[0].name),'synthetic-evidence-'+width+'.pdf');assert.equal(await page.locator('#document').evaluate(async el=>el.files[0].text()),'synthetic-evidence-document-'+width);await shot('document-filled-unapproved-refused')
   // A mutation after the server scan is independently refused in the content world.
   await page.goto(origin+'/portal/1');await page.addScriptTag({path:'public/portal-extension/scan.js'});const scan=await page.evaluate(()=>scanPortalPage()),plan=await (await v1(token.token,`/v1/questionnaires/${capture.id}/fill-plan`,{draft_id:draft.id,recipient:'buyer@customer.test',page:{id:'step-1',...scan}})).json()
   await page.locator('#access').evaluate(el=>el.id='changed-after-scan');const refused=await page.evaluate(plan=>applyPortalPlan(plan),plan);assert.equal(refused.results[0].state,'refused')
   const recapture=await (await v1(token.token,'/v1/questionnaires/captures',{name:'Reviewed recapture '+width,program_id:program.id,previous_id:capture.id,pages:[pages[0],recapturedPage,pages[2]]},201)).json()
   let fresh=await post('/api/questionnaires/'+recapture.id+'/drafts',{})
   for(const [index,value,sourceId] of [[1,'monthly',source.id],[2,JSON.stringify(['security','legal']),source.id],[3,'true',source.id],[4,'',documentSource.id]])fresh=await post(`/api/questionnaires/${recapture.id}/drafts/${fresh.id}/edit`,{snapshot_hash:fresh.snapshot_hash,question_id:questions[index].id,source_id:sourceId,answer_value:value,mapping_confirm:'yes',reason:'Reviewed changed capture and exact source again'})
   await post(`/api/questionnaires/${recapture.id}/drafts/${fresh.id}/approve`,{snapshot_hash:fresh.snapshot_hash,reviewer_person_id:reviewer.id,recipient:'buyer@customer.test',expires_on:'2026-12-01',reason:'Fresh exact decision after portal option change'},200)
   await page.goto(origin+'/portal/2');await page.addScriptTag({path:'public/portal-extension/scan.js'});await page.evaluate(()=>document.querySelector('#cadence').add(new Option('Weekly','weekly')))
   const freshPlan=await (await v1(token.token,`/v1/questionnaires/${recapture.id}/fill-plan`,{draft_id:fresh.id,recipient:'buyer@customer.test',page:recapturedPage})).json(),freshResult=await page.evaluate(plan=>applyPortalPlan(plan),freshPlan)
   assert.ok(freshResult.results.every(r=>r.state==='filled'));assert.equal(await page.locator('#cadence').inputValue(),'monthly');assert.ok(!await page.evaluate(()=>window.submitted));await shot('recaptured-reapproved-filled')
   await page.goto(origin+'/app/questionnaires/'+recapture.id);await page.getByRole('link',{name:'Previous capture and decisions'}).waitFor();await shot('recapture-history')
   await page.goto(origin+'/app/questionnaires/'+capture.id);await shot('fill-history')
   await page.goto(origin+'/popup.html');await shot('extension-popup-layout')
   await context.close();console.log('PASS ANSWER-002 Chromium production scanner and applier: three pages, exact text, choices, document bytes, changed and unapproved refusal, no submission, history at '+width)
  }
 }finally{await browser?.close();if(server)await new Promise(done=>server.close(done))}
}
