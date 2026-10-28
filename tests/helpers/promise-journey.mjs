import {tailoringFixture} from './tailoring-journey.mjs'
import assert from 'node:assert/strict'
export async function promiseJourney(app,{browserProof}={}){
 const cookie=await app.signin();await app.clock('2026-11-02T12:00:00Z')
 const post=async(path,body,status=201)=>{const r=await app.fetch(path,{method:'POST',headers:{origin:app.origin,'content-type':'application'+'/'+'json'},body:JSON.stringify(body)});assert.equal(r.status,status,path+' '+await r.clone().text());return r.json()}
 const get=async path=>{const r=await app.fetch(path);assert.equal(r.status,200,path+' '+await r.clone().text());return r.json()}
 const reviewer=await post('/api/people',{name:'Promise security reviewer',email:'security@northstar.test',kind:'employee'}),program=await post('/api/programs',{framework:'soc2',name:'Promise program',legal_entity:'Northstar',report_type:'Type II',audit_from:'2026-01-01',audit_to:'2026-12-31'})
 const create=await app.fetch('/app/controls',{method:'POST',headers:{origin:app.origin,'content-type':'application'+'/'+'x-www-form-urlencoded'},body:new URLSearchParams({name:'Quarterly access reviews',group:'Access',proof:'Quarterly review proof',cadence:'daily'})});assert.equal(create.status,303)
 const control=(await get('/api/desk')).requirements.find(r=>create.headers.get('location').endsWith(r.id)).control_id
 const token=await post('/api/api-tokens',{name:'Promise source',scopes:['resource-push','read'],expires_at:'2027-01-01'})
 const put=async(path,body)=>{const r=await app.fetch(path,{method:'PUT',headers:{cookie:'',authorization:'Bearer '+token.token,'content-type':'application'+'/'+'json'},body:JSON.stringify(body)});assert.equal(r.status,200,path+' '+await r.clone().text());return r.json()}
 await put('/v1/resource-types/promise_service',{schema:{fields:{access_reviews_quarterly:'boolean'},required:['access_reviews_quarterly']}})
 const resource=value=>put('/v1/resources/promise_service',{resources:[{uniqueId:'synthetic-evidence-1',displayName:'Promise service',attributes:{access_reviews_quarterly:value}}]})
 await resource(true)
 const test=await post('/api/tests',{name:'Quarterly access reviews',resourceType:'promise_service',criteria:JSON.stringify([{attribute:'access_reviews_quarterly',op:'equals',value:true}]),cadence:'hourly',category:'identity',severity:'high',controls:[control]})
 await post('/api/tests/'+test.id+'/run',{},200)
 const results=await app.fetch('/v1/test-results?limit=100',{headers:{cookie:'',authorization:'Bearer '+token.token}});assert.equal(results.status,200)
 const originalObservation=(await results.json()).data.find(o=>o.test_id===test.id&&o.result==='pass');assert.ok(originalObservation)
 const body='Access reviews occur quarterly for all users.',policy=await post('/api/policies',{title:'Promise access policy',body}),revision=await get(`/api/policies/${policy.policy}/revisions/${policy.revision}`)
 await post(`/api/policies/${policy.policy}/revisions/${policy.revision}/decision`,{decision:'approved',body_sha256:revision.body_sha256},200)
 await post('/api/questionnaires/sources',{kind:'policy',source_id:policy.revision,quote:body})
 const file=new FormData();for(const [k,v]of Object.entries({name:'Customer promise',program_id:program.id,id_column:'id',question_column:'question',section_column:'section',format_column:'format',answer_column:'answer'}))file.set(k,v)
 file.set('file',new File(['id,section,question,format,answer\nQ1,Access,Describe quarterly access reviews,text,\n'],'promise.csv'))
 const uploaded=await app.fetch('/api/questionnaires',{method:'POST',headers:{origin:app.origin},body:file});assert.equal(uploaded.status,201)
 const q=await uploaded.json(),draft=await post(`/api/questionnaires/${q.id}/drafts`,{}),answer=`/api/questionnaires/${q.id}/drafts/${draft.id}`
 const contract=await tailoringFixture(app,'promise'),proposal=await post('/api/tailoring',{...contract.input,requirement_id:contract.requirements[0].id})
 await post('/api/tailoring/'+proposal.id+'/decision',{snapshot_hash:proposal.snapshot_hash,decision:'approved',approver_person_id:contract.owner.id,reason:'Reviewed exact customer obligation'},200)
 const obligation=(await get('/api/tailoring')).obligations.find(o=>o.proposal_id===proposal.id)
 const link={kind:'control',source_id:control,quote:'Quarterly access reviews'}
 await post('/api/questionnaires/sources',{kind:'observation',source_id:originalObservation.id,quote:'access_reviews_quarterly'})
 await post(answer+'/dependencies',link)
 const upload=new FormData();for(const [k,v]of Object.entries({source:'Promise exhibit',covered_from:'2026-01-01',covered_to:'2026-12-31'}))upload.set(k,v);upload.set('file',new File(['synthetic-evidence-3'],'promise-proof.txt',{type:'text'+'/'+'plain'}))
 const exhibitResponse=await app.fetch('/app/requirements/'+(await get('/api/desk')).requirements.find(r=>r.control_id===control).id+'/uploads',{method:'POST',headers:{origin:app.origin},body:upload});assert.equal(exhibitResponse.status,303)
 const exhibit=await get(exhibitResponse.headers.get('location').replace('/app/','/api/'))
 const supporting=[{kind:'exhibit',source_id:exhibit.id,quote:'promise-proof.txt'},{kind:'policy',source_id:policy.revision,quote:body},{kind:'obligation',source_id:obligation.id,quote:obligation.body},{kind:'audit-period',source_id:program.id,quote:'2026-01-01'}]
 for(const source of supporting)await post(answer+'/dependencies',source)
 await post('/api/trust/settings',{postal_address:'80 Test Street',notice_days:'30',public_enabled:'on',confirmations_enabled:'on'},200)
 // Use the public double-opt-in path, never infer consent from an owner upload.
 await app.fetch('/trust/subscribe',{method:'POST',headers:{cookie:'',origin:app.origin,'content-type':'application'+'/'+'json',accept:'application'+'/'+'json'},body:JSON.stringify({email:'buyer@customer.test',categories:['security']})})
 const confirmation=app.messages.filter(m=>m.to.includes('buyer@customer.test')).at(-1),confirmPath=new URL(confirmation.text.match(/https:\/\/\S+\/trust\/confirm\/[a-f0-9]+/)[0]).pathname
 assert.equal((await app.fetch(confirmPath,{method:'POST',headers:{cookie:'',origin:app.origin,'content-type':'application'+'/'+'x-www-form-urlencoded'},body:'confirm=yes'})).status,200)
 for(let i=0;i<26;i++)await post('/api/trust/subscribers',{email:`synthetic-evidence-${i+10}@customer.test`,categories:['security'],reason:'Owner recorded the customer request for security notices'},201)
 const trust=await post('/api/trust/updates',{category:'security',title:'Quarterly access promise',body,visibility:'public'}),trustPath='/api/trust/updates/'+trust.id
 await post(trustPath+'/dependencies',link)
 for(const source of supporting)await post(trustPath+'/dependencies',source)
 const erasure=await post('/api/privacy/requests',{kind:'exhibit',subject_id:exhibit.exhibit_id,reason:'Inspect linked customer-promise custody'})
 assert.equal(JSON.parse(erasure.snapshot_json).supported,false);assert.equal(JSON.parse(erasure.snapshot_json).promise_linked,true)
 await post('/api/privacy/requests/'+erasure.id+'/confirm',{snapshot_hash:erasure.snapshot_hash,confirm:'ERASE'},409)
 assert.equal((await app.fetch('/api/receipts/'+exhibit.id+'/download')).status,200,'refused erasure preserves the original')
 // Entity batching cannot bypass the standalone derivative fence.
 await post('/api/privacy/classifications',{kind:'person',subject_id:reviewer.id,exhibit_id:exhibit.exhibit_id,reason:'Owner classified the retained promise original'})
 upload.set('file',new File(['synthetic-evidence-unlinked-original'],'synthetic-evidence-unlinked.txt',{type:'text'+'/'+'plain'}))
 const unlinkedResponse=await app.fetch('/app/requirements/'+exhibit.requirement_id+'/uploads',{method:'POST',headers:{origin:app.origin},body:upload})
 assert.equal(unlinkedResponse.status,303)
 const unlinked=await get(unlinkedResponse.headers.get('location').replace('/app/','/api/'))
 await post('/api/privacy/classifications',{kind:'person',subject_id:reviewer.id,exhibit_id:unlinked.exhibit_id,reason:'Owner classified the other original'})
 const entityErasure=await post('/api/privacy/requests',{kind:'person',subject_id:reviewer.id,reason:'Do not bypass unclassified promise derivatives'})
 const entityPlan=JSON.parse(entityErasure.snapshot_json)
 assert.equal(entityPlan.supported,false)
 assert.deepEqual(new Set(entityPlan.items.map(item=>item.subject)),new Set([exhibit.exhibit_id,unlinked.exhibit_id]))
 await post('/api/privacy/requests/'+entityErasure.id+'/confirm',{snapshot_hash:entityErasure.snapshot_hash,confirm:'ERASE'},409)
 assert.equal((await app.fetch('/api/receipts/'+exhibit.id+'/download')).status,200)
 assert.equal(await (await app.fetch('/api/receipts/'+unlinked.id+'/download')).text(),'synthetic-evidence-unlinked-original')

 if(browserProof)await browserProof(app,{cookie,stage:'promise-erasure-fenced',followLink:false,screens:[['privacy','/app/privacy/requests/'+erasure.id,'No completed erasure is claimed']]})
 const approval={snapshot_hash:draft.snapshot_hash,reviewer_person_id:reviewer.id,recipient:'buyer@customer.test',expires_on:'2027-01-01',reason:'Reviewed exact promise and passing control'}
 await post(answer+'/approve',approval,409)
 await post(answer+'/approve',{...approval,dependency_hash:(await get(answer)).dependencies.hash},200)
 await post(trustPath+'/approve',{notify:'on',reviewer_person_id:reviewer.id,reason:'Reviewed exact source revisions and customer promises',dependency_hash:(await get(trustPath)).dependencies.hash},200)
 await post(answer+'/dependencies',link,409);await post(trustPath+'/dependencies',link,409)
 assert.equal((await app.fetch(answer+'/export?recipient=buyer@customer.test')).status,200)
 await post(trustPath+'/publish',{notify:'on'},200)
 const external=(await get(trustPath)).deliveries;assert.equal(external.length,27);assert.ok(external.some(d=>d.recipient==='buyer@customer.test'));assert.equal(external.filter(d=>!d.attempted_at).length,2)
 const before=app.messages.length
 // Freeze another approved publication, then invalidate before dispatch.
 const waiting=await post('/api/trust/updates',{category:'security',title:'Pending promise',body,visibility:'public'}),pending='/api/trust/updates/'+waiting.id
 await post(pending+'/dependencies',link);await post(pending+'/approve',{notify:'on',reviewer_person_id:reviewer.id,reason:'Reviewed exact source revisions and customer promises',dependency_hash:(await get(pending)).dependencies.hash},200)
 if(browserProof)await browserProof(app,{cookie,stage:'promise-current',followLink:false,screens:[['answer',answer.replace('/api/','/app/'),'Current source revisions'],['trust',trustPath.replace('/api/','/app/'),'Current source revisions']]})
 await app.clock('2026-11-02T12:10:00Z');await resource(false);await post('/api/tests/'+test.id+'/run',{},200)
 await post('/api/questionnaires/sources',{kind:'observation',source_id:originalObservation.id,quote:'access_reviews_quarterly'},409)
 for(const path of [answer,trustPath]){const data=await get(path);assert.equal(data.dependencies.current,false);assert.deepEqual(data.dependencies.affected_commitments.map(s=>s.source_id),[obligation.id]);assert.match(data.dependencies.rows[0].reason,/failed|changed/)}
 assert.equal((await app.fetch(answer+'/export?recipient=buyer@customer.test')).status,409)
 assert.equal((await app.fetch(answer+'/citations?recipient=buyer@customer.test')).status,409)
 await post('/api/questionnaires/sources',{kind:'approved-answer',source_id:draft.id+':Q1',quote:body},409)
 await post(pending+'/publish',{notify:'on'},409)
 assert.equal((await app.fetch(trustPath+'/export')).status,409);assert.equal(app.messages.length,before)
 assert.equal((await post('/api/trust/deliveries/dispatch',{},200)).processed,0)
 const suppressed=(await get(trustPath)).deliveries
 assert.deepEqual(suppressed.map(d=>[d.id,d.recipient]),external.map(d=>[d.id,d.recipient]),'prior recipient history retained')
 assert.deepEqual(suppressed.filter(d=>d.attempted_at),external.filter(d=>d.attempted_at),'prior external versions retained exactly')
 assert.ok(suppressed.filter(d=>!d.attempted_at).every(d=>d.state==='failed'&&d.detail.includes('dependency changed')))
 assert.equal(app.messages.length,before,'queued stale promises never cross the mail edge')
 if(browserProof)await browserProof(app,{cookie,stage:'promise-invalidated',followLink:false,screens:[['answer',answer.replace('/api/','/app/'),'Invalidated'],['trust',trustPath.replace('/api/','/app/'),'Invalidated']]})
 // A recovered control still needs a new exact revision and fresh decision.
 await resource(true);await post('/api/tests/'+test.id+'/run',{},200)
 assert.equal((await app.fetch(answer+'/export?recipient=buyer@customer.test')).status,409)
 const source=(await get(answer)).dependencies.rows[0],fresh=await post(answer+'/refresh-source',{...link,dependency_id:source.id}),freshPath=`/api/questionnaires/${q.id}/drafts/${fresh.id}`
 assert.equal((await app.fetch(freshPath+'/export?recipient=buyer@customer.test')).status,409)
 await post(freshPath+'/approve',{...approval,snapshot_hash:fresh.snapshot_hash,dependency_hash:(await get(freshPath)).dependencies.hash},200)
 assert.equal((await app.fetch(freshPath+'/export?recipient=buyer@customer.test')).status,200)
 assert.equal((await app.fetch(freshPath+'/export?recipient=other@customer.test')).status,409)
 const trustSource=(await get(trustPath)).dependencies.rows[0],revised=await post(trustPath+'/refresh-source',{...link,dependency_id:trustSource.id,body:'Reviewed again: '+body}),revisedPath='/api/trust/updates/'+revised.id
 await post(revisedPath+'/publish',{notify:'on'},409)
 await post(revisedPath+'/approve',{notify:'on',reviewer_person_id:reviewer.id,reason:'Reviewed exact source revisions and customer promises',dependency_hash:(await get(revisedPath)).dependencies.hash},200)
 await post(revisedPath+'/publish',{notify:'on'},200)
 assert.equal((await get(trustPath)).update.body,body)
 assert.equal((await get(revisedPath)).previous_revision.previous_update_id,trust.id)
 assert.equal((await get(revisedPath)).review.reviewer_person_id,reviewer.id)
 // Policy invalidation remains independent of the explicit control dependency.
 const changed=await post('/api/policies',{title:'Promise access policy',body:'Access reviews occur monthly for all users.'}),changedPolicy=await get(`/api/policies/${changed.policy}/revisions/${changed.revision}`)
 await post(`/api/policies/${changed.policy}/revisions/${changed.revision}/decision`,{decision:'approved',body_sha256:changedPolicy.body_sha256},200)
 assert.equal((await app.fetch(freshPath+'/export?recipient=buyer@customer.test')).status,409)
 assert.equal((await get(revisedPath)).dependencies.current,false,'policy change independently invalidates trust promises')
 const updatedQuote='Access reviews occur monthly for all users.'
 await post('/api/questionnaires/sources',{kind:'policy',source_id:changed.revision,quote:updatedQuote})
 const changedLink={kind:'policy',source_id:changed.revision,quote:updatedQuote},answerPolicy=(await get(freshPath)).dependencies.rows.find(r=>r.source.kind==='policy'),lastAnswer=await post(freshPath+'/refresh-source',{...changedLink,dependency_id:answerPolicy.id}),lastAnswerPath=`/api/questionnaires/${q.id}/drafts/${lastAnswer.id}`
 assert.equal((await app.fetch(lastAnswerPath+'/export?recipient=buyer@customer.test')).status,409)
 await post(lastAnswerPath+'/approve',{...approval,snapshot_hash:lastAnswer.snapshot_hash,dependency_hash:(await get(lastAnswerPath)).dependencies.hash},200)
 const latestAnswer=(await get(lastAnswerPath)).snapshot.answers[0];assert.equal(latestAnswer.answer,updatedQuote);assert.equal(latestAnswer.citations[0].revision,changedPolicy.body_sha256)
 assert.equal((await app.fetch(lastAnswerPath+'/export?recipient=buyer@customer.test')).status,200)
 const trustPolicy=(await get(revisedPath)).dependencies.rows.find(r=>r.source.kind==='policy'),lastTrust=await post(revisedPath+'/refresh-source',{...changedLink,dependency_id:trustPolicy.id,body:updatedQuote}),lastTrustPath='/api/trust/updates/'+lastTrust.id
 await post(lastTrustPath+'/approve',{notify:'on',reviewer_person_id:reviewer.id,reason:'Reviewed monthly source policy and retained customer obligations',dependency_hash:(await get(lastTrustPath)).dependencies.hash},200)
 await post(lastTrustPath+'/publish',{notify:'on'},200)
 assert.equal((await get(lastTrustPath)).previous_revision.previous_update_id,revised.id)
 if(browserProof)await browserProof(app,{cookie,stage:'promise-refreshed',followLink:false,screens:[['answer',lastAnswerPath.replace('/api/','/app/'),updatedQuote],['trust',lastTrustPath.replace('/api/','/app/'),'Named reviewer:']]})
 // The source cadence is evaluated with a pinned clock, independently of failure.
 await app.clock('2026-11-02T16:00:00Z')
 assert.equal((await app.fetch(lastAnswerPath+'/export?recipient=buyer@customer.test')).status,409,'a passing control expires without a new observation')
 assert.equal((await app.fetch(lastTrustPath+'/export')).status,409)
 const archive=await app.fetch('/api/archive/export');assert.equal(archive.status,200);const archiveBytes=await archive.arrayBuffer()
 const {runtime}=await import('./runtime.mjs'),dest=await runtime()
 try{await dest.signin();await dest.clock('2026-11-02T16:00:00Z');const restored=await dest.fetch('/api/archive/restore',{method:'POST',headers:{origin:dest.origin,'content-type':'application'+'/'+'octet-stream','x-evidence-confirm':'restore','x-evidence-erasure-history':'unverified acknowledged'},body:archiveBytes});assert.equal(restored.status,200,await restored.clone().text());assert.deepEqual((await (await dest.fetch(answer)).json()).dependencies.rows.map(r=>r.source),(await get(answer)).dependencies.rows.map(r=>r.source));assert.equal((await dest.fetch(freshPath+'/export?recipient=buyer@customer.test')).status,409);assert.equal((await dest.fetch(trustPath+'/export')).status,409);assert.equal((await (await dest.fetch(lastTrustPath)).json()).review.snapshot_hash,(await get(lastTrustPath)).review.snapshot_hash);const mailBefore=dest.messages.length;assert.equal((await (await dest.fetch('/api/trust/deliveries/dispatch',{method:'POST',headers:{origin:dest.origin,'content-type':'application'+'/'+'json'},body:'{}'})).json()).processed,0);assert.equal(dest.messages.length,mailBefore,'restore never replays external promises')}finally{await dest.close()}
 console.log('PASS AGENT-005: exact control dependencies, failure invalidation, stale reuse and export and publication refusal, fresh human decision, original recipient history and inactive restore')
}
