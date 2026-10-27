import assert from 'node:assert/strict'
import {runtime} from './runtime.mjs'
import {githubFixture} from './github-fixture.mjs'
export async function auditSharingJourney(browserProof){
 const {github,outbound}=githubFixture(),app=await runtime({outbound}),target=await runtime({ownerEmail:'restored-sharing@example.test'})
 const call=async(path,body,status=200,cookie)=>{const response=await app.fetch(path,{...(body===undefined?{}:{method:'POST',body:JSON.stringify(body)}),headers:{...(body===undefined?{}:{origin:app.origin,'content-type':'application'+'/'+'json'}),...(cookie===undefined?{}:{cookie})}});assert.equal(response.status,status,path+': '+await response.clone().text());return response.json()}
 try{
 const ownerCookie=await app.signin();await app.clock('2026-10-09T12:00:00Z')
 const makeControl=async name=>{const r=await app.fetch('/app/controls',{method:'POST',headers:{origin:app.origin,'content-type':'application'+'/'+'x-www-form-urlencoded'},body:new URLSearchParams({name,group:'Access',proof:'Period proof',cadence:'daily'})});assert.equal(r.status,303);return(await call('/api/desk')).requirements.find(q=>q.id===r.headers.get('location').split('/').at(-1)).control_id}
 const control=await makeControl('Shared control'),outside=await makeControl('Unshared control')
 const connection=await call('/api/connections',{account:'northstar',token:'synthetic-evidence-1',label:'Share source'},201)
 await call('/api/connections/'+connection.id+'/repositories',{repositories:connection.repositories})
 const definition={name:'Shared test',resourceType:'github.repository',criteria:JSON.stringify([{attribute:'private',op:'equals',value:true}]),cadence:'hourly',category:'code',severity:'high',controls:[control]}
 const test=await call('/api/tests',definition,201),otherTest=await call('/api/tests',{...definition,name:'Outside scope',controls:[outside]},201)
 const changingRepo=Object.values(github.repos).find(r=>!r.private);assert.ok(changingRepo);changingRepo.private=true
 github.clock='2026-10-09T12:00:00Z'
 await call('/api/connections/'+connection.id+'/collect',{},201)
 const token=await call('/api/api-tokens',{name:'Audit population source',scopes:['resource-push','read'],expires_at:'2026-11-01'},201)
 const source=async(method,path,body)=>{const response=await app.fetch(path,{method,headers:{cookie:'',authorization:'Bearer '+token.token,'content-type':'application'+'/'+'json'},body:JSON.stringify(body)});assert.equal(response.status,200,await response.clone().text());return response.json()}
 await source('PUT','/v1/resource-types/audit_service',{schema:{fields:{email:'string',private:'boolean'}}})
 const member={uniqueId:'synthetic-evidence-3',attributes:{email:'period@example.test',private:true}}
 const push=async(resources)=>source('PUT','/v1/resources/audit_service',{resources,fullSync:true})
 await push([member])
 const populationTest=await call('/api/tests',{...definition,name:'Period population',resourceType:'audit_service'},201)
 const privacyTest=await call('/api/tests',{...definition,name:'Shared population privacy',resourceType:'audit_service'},201)
 await app.clock('2026-10-10T06:00:00Z');await push([member,{uniqueId:'synthetic-evidence-4',attributes:{email:'added@example.test',private:false}}])
 await app.clock('2026-10-10T18:00:00Z');await push([{uniqueId:'synthetic-evidence-4',attributes:{email:'changed@example.test',private:true}}])
 await app.clock('2026-10-11T06:00:00Z');await push([member,{uniqueId:'synthetic-evidence-4',attributes:{email:'changed@example.test',private:true}}])

 await app.clock('2026-10-09T12:00:00Z')
 const beforePeriod=(await call('/api/tests/'+test.id)).latest.map(o=>o.id)
 github.clock='2026-10-10T00:00:00Z';await app.clock(github.clock)
 await call('/api/connections/'+connection.id+'/collect',{},201)
 const atPeriodStart=(await call('/api/tests/'+test.id)).latest
 assert.ok(atPeriodStart.every(o=>o.result==='pass'))
 changingRepo.private=false
 github.clock='2026-10-11T12:00:00Z';await app.clock(github.clock)
 await call('/api/connections/'+connection.id+'/collect',{},201)
 const inPeriod=[...atPeriodStart,...(await call('/api/tests/'+test.id)).latest]
 const program=await call('/api/programs',{framework:'soc2',name:'Continuous review',legal_entity:'Northstar',report_type:'Type II',audit_from:'2026-10-10',audit_to:'2026-10-11'},201)
 await call('/api/controls/'+control+'/mappings',{framework:'soc2',edition:'tsc-2017-pof-2022',ref:'CC6.1',reason:'Continuous evidence scope'},201)
 const config={name:'Request-free audit',period_from:'2026-10-10',period_to:'2026-10-11',control_ids:[control]}
 const e=await call('/api/audit-engagements',config,201),base='/api/audit-engagements/'+e.id,view='/api/auditor/'+e.id
 await call('/api/audit-engagements',{...config,detail_level:'Restricted',hidden_attributes:'email'},400)
 const restricted=await call('/api/audit-engagements',{...config,detail_level:'Restricted',hidden_attributes:['email']},201)
 assert.equal(restricted.name,config.name)
 await call('/api/audit-engagements/'+restricted.id+'/requests',{requests:'[]'},409)
 const grant=await call(base+'/auditors',{name:'Sharing auditor',email:'sharing-auditor@example.test',reason:'Explicit Full disclosure',expires_at:'2026-10-13T00:00:00Z'},201)
 const mail=app.messages.at(-1),url=new URL(mail.html.match(/href="([^"]*\/auth\/confirm\?token=[^"]+)"/)[1].replaceAll('&amp;','&'),app.origin)
 const confirmed=await app.fetch('/auth/confirm',{method:'POST',headers:{cookie:'',origin:app.origin,'content-type':'application'+'/'+'json'},body:JSON.stringify({token:url.searchParams.get('token')})});assert.equal(confirmed.status,303)
 const cookie=confirmed.headers.getSetCookie().map(v=>v.split(';')[0]).join('; ')
 const share={kind:'test',subject_id:test.id,reason:'Selected definition for review'}
 await call(base+'/shares',share,401,'');await call(base+'/shares',share,403,cookie)
 assert.equal((await app.fetch(base+'/shares',{method:'POST',headers:{origin:'https://elsewhere.test'},body:JSON.stringify(share)})).status,403)
 await call(base+'/shares',{...share,subject_id:otherTest.id},404)
 await call(base+'/shares',{...share,reason:''},400)
 const shared=await call(base+'/shares',share,201)
 await call(base+'/shares',share,409)
 const sharedControl=await call(base+'/shares',{kind:'control',subject_id:control,reason:'Explicit chosen control'},201)
 await call(base+'/shares',{kind:'control',subject_id:outside,reason:'Outside'},404)
 const draft=await call('/api/policies',{title:'Shared policy',body:'Original approved policy text'},201),policyBase='/api/policies/'+draft.policy+'/revisions/'+draft.revision
 await call(base+'/shares',{kind:'policy',subject_id:draft.policy,reason:'Draft is not approved'},404)
 const revision=await call(policyBase)
 await call(policyBase+'/decision',{decision:'approved',body_sha256:revision.body_sha256,note:'Exact text approved'})
 await call(policyBase+'/publish',{effective_date:'2026-10-10'})
 const policy=await call(base+'/shares',{kind:'policy',subject_id:draft.policy,reason:'Share exact published policy'},201)
 const populationShare=await call(base+'/shares',{kind:'test',subject_id:populationTest.id,reason:'Historical population review'},201)
 const auditor=await call(view+'/evidence',undefined,200,cookie)
 assert.equal(auditor.detail_level,'Full');assert.equal(auditor.shares.length,4);assert.equal(auditor.shares.find(s=>s.id===policy.id).record.body,'Original approved policy text')
 const population=auditor.shares.find(s=>s.id===populationShare.id).population
 assert.equal(population.length,2)
 const original=population.find(p=>p.intervals[0].attributes.email==='period@example.test')
 assert.deepEqual(original.intervals.map(i=>[i.from,i.to]),[
  ['2026-10-10T00:00:00.000Z','2026-10-10T18:00:00.000Z'],
  ['2026-10-11T06:00:00.000Z','2026-10-12T00:00:00.000Z'],
 ])
 assert.deepEqual(original.changes.map(c=>[c.change,c.at]),[['removed','2026-10-10T18:00:00.000Z'],['restored','2026-10-11T06:00:00.000Z']])
 const added=population.find(p=>p.resource_id!==original.resource_id)
 assert.deepEqual(added.intervals.map(i=>[i.from,i.to,i.attributes.email]),[
  ['2026-10-10T06:00:00.000Z','2026-10-10T18:00:00.000Z','added@example.test'],
  ['2026-10-10T18:00:00.000Z','2026-10-12T00:00:00.000Z','changed@example.test'],
 ])
 assert.ok(added.intervals.some(i=>i.attributes.email==='added@example.test'),'old attributes remain after a later update')
 // A prospective test-scope exclusion does not remove earlier membership.
 await app.clock('2026-10-11T10:00:00Z')
 await call('/api/tests/'+populationTest.id+'/revisions',{excluded:original.resource_id+' Explicitly outside test scope',reason:'Prospective scope change'})
 const scopedPopulation=(await call(view+'/evidence/'+populationShare.id,undefined,200,cookie)).shares[0].population
 assert.equal(scopedPopulation.find(p=>p.resource_id===original.resource_id).intervals.at(-1).to,'2026-10-11T10:00:00.000Z')
 assert.deepEqual(scopedPopulation.find(p=>p.resource_id===original.resource_id).intervals[0],original.intervals[0])
 await app.clock('2026-10-11T10:30:00Z')
 await call('/api/tests/'+populationTest.id+'/run',{})
 await app.clock('2026-10-11T11:00:00Z')
 await push([{...member,attributes:{email:'excluded@example.test',private:true}},{uniqueId:'synthetic-evidence-4',attributes:{email:'changed@example.test'}}])
 const excludedObservation=(await call('/api/tests/'+populationTest.id)).latest.find(o=>o.resource_id===original.resource_id)
 assert.equal(excludedObservation.result,'not applicable')
 await app.clock('2026-10-11T11:30:00Z')
 const scopedEvidence=await call(view+'/evidence/'+populationShare.id,undefined,200,cookie)
 assert.ok(scopedEvidence.shares[0].intervals.some(i=>i.state==='unknown'&&i.from==='2026-10-11T11:00:00.000Z'&&i.to==='2026-10-11T11:30:00.000Z'),'unknown source values remain an unknown interval')
 assert.ok(!JSON.stringify(scopedEvidence).includes('excluded@example.test'),'attributes after scope withdrawal stay private')
 assert.ok(scopedEvidence.shares[0].population.find(p=>p.resource_id===original.resource_id).changes.every(c=>c.at<'2026-10-11T10:00:00.000Z'),'changes after scope withdrawal are omitted')
 assert.ok(!scopedEvidence.shares[0].observations.some(o=>o.id===excludedObservation.id),'out-of-scope observations are not returned')
 await call(view+'/evidence/'+populationShare.id+'/observations/'+excludedObservation.id,undefined,404,cookie)
 await app.clock('2026-10-12T00:00:00Z');await push([{...member,attributes:{email:'after-period@example.test',private:false}}])
 assert.deepEqual((await call(base+'/evidence/'+populationShare.id)).shares[0].population,scopedEvidence.shares[0].population,'future removal and attributes never rewrite the period')
 assert.ok(!JSON.stringify((await call(base+'/evidence/'+populationShare.id)).shares[0].population).includes('after-period@example.test'))
 await app.clock('2026-10-11T12:00:00Z')
 assert.deepEqual(await call(view+'/evidence',undefined,200,cookie),await call(base+'/evidence'),'owner preview uses identical projection')
 assert.equal((await call(base)).requests.length,0,'sharing creates no request')
 assert.equal((await call(view+'/evidence/'+shared.id,undefined,200,cookie)).shares.length,1)
 await call(view+'/evidence/'+otherTest.id,undefined,404,cookie)
 await call(view+'/evidence/'+shared.id+'/observations/'+crypto.randomUUID(),undefined,404,cookie)
 const selectedTest=auditor.shares.find(s=>s.id===shared.id)
 const observations=selectedTest.observations
 assert.ok(selectedTest.intervals.some(i=>i.state==='stale'&&i.from==='2026-10-10T01:30:00.000Z'&&i.to==='2026-10-11T12:00:00.000Z'))
 assert.ok(selectedTest.intervals.every(i=>i.from>='2026-10-10T00:00:00.000Z'&&i.to<='2026-10-11T12:00:00.000Z'),'intervals exclude both earlier history and future time')
 assert.deepEqual(selectedTest.library_revisions,[{revision:1,from:'2026-10-10T00:00:00.000Z',to:'2026-10-12T00:00:00.000Z'}])
 assert.deepEqual(selectedTest.criteria_revisions,[{revision:1,criteria:[{attribute:'private',op:'equals',value:true}],cadence:'hourly',from:'2026-10-10T00:00:00.000Z',to:'2026-10-12T00:00:00.000Z'}])
 assert.deepEqual(observations.map(o=>o.id).sort(),inPeriod.map(o=>o.id).sort())
 assert.ok(observations.some(o=>o.result==='fail'),'mid-period failures remain visible')
 assert.ok(observations.every(o=>o.source_connector==='github'&&o.source_account==='northstar'&&o.library_revision>=1&&Array.isArray(o.criteria)))
 assert.ok(!JSON.stringify(auditor).includes(beforePeriod[0]),'pre-period observations are excluded')
 for(const observation of observations)assert.deepEqual(await call(view+'/evidence/'+shared.id+'/observations/'+observation.id,undefined,200,cookie),observation)
 await call(view+'/evidence/'+shared.id+'/observations/'+beforePeriod[0],undefined,404,cookie)
 const outsideObservation=(await call('/api/tests/'+otherTest.id)).latest[0]
 await call(view+'/evidence/'+shared.id+'/observations/'+outsideObservation.id,undefined,404,cookie)
 changingRepo.private=true
 github.clock='2026-10-12T00:00:00Z';await app.clock(github.clock)
 await call('/api/connections/'+connection.id+'/collect',{},201)
 const afterRows=(await call('/api/tests/'+test.id)).latest;assert.ok(afterRows.every(o=>o.result==='pass'))
 const afterPeriod=afterRows.map(o=>o.id)
 await app.clock('2026-10-11T12:00:00Z')
 const bounded=await call(view+'/evidence/'+shared.id,undefined,200,cookie)
 assert.deepEqual(bounded.shares[0].observations,observations,'later source reads do not enter the selected period')
 for(const id of afterPeriod)await call(view+'/evidence/'+shared.id+'/observations/'+id,undefined,404,cookie)
 // Revisions with no intervening run still belong in the period history.
 await app.clock('2026-10-11T13:00:00Z')
 await call('/api/library/revisions/2',{reason:'Reviewed library change during audit'})
 await call('/api/tests/'+test.id+'/revisions',{criteria:JSON.stringify([{attribute:'private',op:'equals',value:false}]),reason:'Prospective period criteria'})
 await app.clock('2026-10-11T14:00:00Z')
 await call('/api/library/revisions/3',{reason:'Second reviewed library change without a run'})
 const revised=(await call(view+'/evidence/'+shared.id,undefined,200,cookie)).shares[0]
 assert.deepEqual(revised.observations,observations,'acceptance and criteria edits do not rewrite observations')
 assert.ok(revised.intervals.some(i=>i.state==='unknown'&&i.from==='2026-10-11T13:00:00.000Z'&&i.to==='2026-10-11T14:00:00.000Z'),'changed criteria remain unknown until a matching revision runs')
 assert.ok(revised.intervals.every(i=>i.to<='2026-10-11T14:00:00.000Z'),'future intervals are never fabricated')
 assert.deepEqual(revised.library_revisions,[
  {revision:1,from:'2026-10-10T00:00:00.000Z',to:'2026-10-11T13:00:00.000Z'},
  {revision:2,from:'2026-10-11T13:00:00.000Z',to:'2026-10-11T14:00:00.000Z'},
  {revision:3,from:'2026-10-11T14:00:00.000Z',to:'2026-10-12T00:00:00.000Z'},
 ])
 assert.deepEqual(revised.criteria_revisions.map(r=>[r.revision,r.criteria[0].value,r.from,r.to]),[
  [1,true,'2026-10-10T00:00:00.000Z','2026-10-11T13:00:00.000Z'],
  [2,false,'2026-10-11T13:00:00.000Z','2026-10-12T00:00:00.000Z'],
 ])
 assert.deepEqual(await call(base+'/evidence/'+shared.id),await call(view+'/evidence/'+shared.id,undefined,200,cookie))
 // Boundary acceptance outside the period must not disclose its new revision.
 await app.clock('2026-10-12T00:00:00Z')
 await call('/api/library/revisions/4',{reason:'After the audited dates'})
 await call('/api/tests/'+test.id+'/revisions',{criteria:JSON.stringify([{attribute:'private',op:'equals',value:true}]),reason:'After-period criteria'})
 const outsideRevision=(await call(base+'/evidence/'+shared.id)).shares[0]
 assert.deepEqual(outsideRevision.criteria_revisions,revised.criteria_revisions)
 assert.deepEqual(outsideRevision.library_revisions,revised.library_revisions)
 const later=await call('/api/audit-engagements',{...config,period_from:'2026-10-12',period_to:'2026-10-12'},201)
 const laterBase='/api/audit-engagements/'+later.id
 const laterShare=await call(laterBase+'/shares',share,201)
 const laterEvidence=(await call(laterBase+'/evidence/'+laterShare.id)).shares[0]
 assert.deepEqual(laterEvidence.library_revisions,[{revision:4,from:'2026-10-12T00:00:00.000Z',to:'2026-10-13T00:00:00.000Z'}])
 assert.equal(laterEvidence.criteria_revisions[0].revision,3)
 assert.equal(laterEvidence.criteria_revisions[0].from,'2026-10-12T00:00:00.000Z')
 await app.clock('2026-10-11T14:00:00Z')
 const decisions=view+'/evidence/'+shared.id+'/decisions',replies=base+'/evidence/'+shared.id+'/replies'
 const before=(await call('/api/programs/'+program.id)).readiness.totals,testBefore=await call('/api/tests/'+test.id)
 await call(decisions,{state:'flagged',expected_revision:0},400,cookie)
 await call(decisions,{state:'not-applicable',reason:' ',expected_revision:0},400,cookie)
 await call(decisions,{state:'accepted'},400,cookie)
 await call(decisions,{state:'accepted',expected_revision:0},403)
 await call(view+'/evidence/'+sharedControl.id+'/decisions',{state:'accepted',expected_revision:0},409,cookie)
 await call(view+'/evidence/'+otherTest.id+'/decisions',{state:'accepted',expected_revision:0},409,cookie)
 assert.equal((await app.fetch(decisions,{method:'POST',headers:{cookie,origin:'https://elsewhere.test','content-type':'application'+'/'+'json'},body:JSON.stringify({state:'accepted',expected_revision:0})})).status,403)
 const flagged=await call(decisions,{state:'flagged',reason:'Explain the failed population',expected_revision:0,actor_name:'Spoofed owner'},201,cookie)
 await call(decisions,{state:'accepted',expected_revision:0},409,cookie)
 await call(replies,{decision_id:flagged.id,body:'Owner reply'},403,cookie)
 await call(replies,{decision_id:crypto.randomUUID(),body:'Wrong decision'},409)
 await call(replies,{decision_id:flagged.id,body:''},400)
 await call(replies,{decision_id:flagged.id,body:'Population review is retained separately.'},201)
 let evidence=await call(view+'/evidence/'+shared.id,undefined,200,cookie)
 assert.deepEqual(evidence,await call(base+'/evidence/'+shared.id))
 assert.equal(evidence.shares[0].decisions[0].actor_name,'Sharing auditor')
 assert.equal(evidence.shares[0].decisions[0].revision,1)
 assert.equal(evidence.shares[0].replies[0].actor_name,'Evidence owner')
 assert.equal(evidence.shares[0].replies[0].decision_id,flagged.id)
 const readiness=(await call('/api/programs/'+program.id)).readiness
 assert.deepEqual(readiness.totals,before,'flag never changes readiness passes')
 assert.deepEqual(await call('/api/tests/'+test.id),testBefore,'review never changes observations, results, mappings or criteria')
 const flags=readiness.checklist.find(a=>a.area==='Auditor decisions')
 assert.deepEqual([flags.ready,flags.total,flags.records.length],[0,1,1]);assert.match(flags.records[0].state,/Sharing auditor: Explain the failed population/)
 assert.equal(flags.records[0].href,base+'/evidence/'+shared.id)
 if(browserProof)await browserProof(app,{cookie:ownerCookie,program:program.id,stage:'flagged',screens:[['readiness','/app/programs/'+program.id,'Explain the failed population'],['board','/app/programs/'+program.id+'/board','Explain the failed population']],followLink:{name:'Shared test',text:'Explain the failed population'}})
 const accepted=await call(decisions,{state:'accepted',expected_revision:1},201,cookie)
 await call(decisions,{state:'not-applicable',reason:'Outside current review objective',expected_revision:2},201,cookie)
 await call(replies,{decision_id:accepted.id,body:'Exact acceptance acknowledged.'},201)
 const policyDecision=await call(view+'/evidence/'+policy.id+'/decisions',{state:'flagged',reason:'Confirm effective date',expected_revision:0},201,cookie)
 await call(base+'/evidence/'+policy.id+'/replies',{decision_id:policyDecision.id,body:'The selected published revision has the date.'},201)
 evidence=await call(view+'/evidence/'+shared.id,undefined,200,cookie)
 assert.deepEqual(evidence.shares[0].decisions.map(d=>[d.revision,d.state]),[[1,'flagged'],[2,'accepted'],[3,'not-applicable']])
 assert.deepEqual(evidence.shares[0].replies.map(r=>r.revision),[1,2])
 const competing=await Promise.all(['First review','Competing review'].map(reason=>app.fetch(decisions,{method:'POST',headers:{cookie,origin:app.origin,'content-type':'application'+'/'+'json'},body:JSON.stringify({state:'accepted',reason,expected_revision:3})})))
 assert.deepEqual(competing.map(r=>r.status).sort(),[201,409],'only one competing exact-revision decision commits')
 const person=await call('/api/people',{name:'Document owner',email:'document-owner@example.test',kind:'employee'},201)
 const documentBase='/api/programs/'+program.id+'/documents/soc2-description'
 await call('/api/programs/'+program.id+'/documents',{kind:'soc2-description',owner_person_id:person.id},201)
 let document=await call(documentBase)
 await call(base+'/shares',{kind:'document',subject_id:document.document.id,reason:'Unapproved document is refused'},404)
 for(const section of document.revision.content.sections.filter(s=>s.status==='owner-needed'))await call(documentBase+'/revisions',{section_id:section.id,text:'Owner supplied '+section.heading+': synthetic-evidence-2',reason:'Documented manual source'},201)
 document=await call(documentBase)
 await call(documentBase+'/approvals',{revision:document.revision.revision,approver_person_id:person.id,effective_date:'2026-10-10',note:'Exact document approved'},201)
 const documentShare=await call(base+'/shares',{kind:'document',subject_id:document.document.id,reason:'Approved document selected for review'},201)
 const documentEvidence=(await call(view+'/evidence/'+documentShare.id,undefined,200,cookie)).shares[0]
 assert.equal(documentEvidence.revision,document.revision.id)
 assert.deepEqual(documentEvidence.record.content,document.revision.content)
 const docDecision=await call(view+'/evidence/'+documentShare.id+'/decisions',{state:'flagged',reason:'Clarify the system boundary',expected_revision:0},201,cookie)
 await call(base+'/evidence/'+documentShare.id+'/replies',{decision_id:docDecision.id,body:'The selected description records the boundary.'},201)
 await call(base+'/evidence/'+documentShare.id+'/replies',{decision_id:flagged.id,body:'Wrong share'},409)
 if(browserProof)await browserProof(app,{cookie:ownerCookie,program:program.id,stage:'document-flagged',screens:[['readiness','/app/programs/'+program.id,'Clarify the system boundary'],['board','/app/programs/'+program.id+'/board','Clarify the system boundary']],followLink:{name:'soc2 description',text:'Clarify the system boundary'}})
 await call(base+'/shares/'+documentShare.id+'/unshare',{reason:'Document review concluded'})
 await call(view+'/evidence/'+documentShare.id,undefined,404,cookie)
 await app.clock('2026-10-12T00:00:00Z')
 const pack=await call(base+'/pack');assert.deepEqual(pack,await call(view+'/pack',undefined,200,cookie));assert.deepEqual(pack.shared_evidence,await call(base+'/evidence'))
 assert.equal(pack.requests.length,0,'continuous decisions are separate from request decisions')
 await app.clock('2026-10-12T00:00:01Z')
 assert.deepEqual(await call(base+'/pack'),pack,'worker restart retains exact decisions and replies')
 await call('/api/tests/'+test.id+'/revisions',{criteria:JSON.stringify([{attribute:'private',op:'equals',value:false}]),reason:'Later criteria'})
 const after=await call(view+'/evidence/'+shared.id,undefined,200,cookie)
 assert.equal(after.shares[0].revision,'1');assert.equal(after.shares[0].record.criteria[0].value,true,'selected revision is retained')
 await call(base+'/shares/'+policy.id+'/unshare',{reason:'Policy withdrawn'},403,cookie)
 await call(base+'/shares/'+policy.id+'/unshare',{reason:'Policy withdrawn'})
 await call(view+'/evidence/'+policy.id,undefined,404,cookie)
 await call(view+'/evidence/'+policy.id+'/decisions',{state:'accepted',expected_revision:1},409,cookie)
 await call(base+'/evidence/'+policy.id+'/replies',{decision_id:policyDecision.id,body:'Withdrawn'},409)
 assert.equal((await call('/api/programs/'+program.id)).readiness.checklist.find(a=>a.area==='Auditor decisions').total,0,'superseded flags and withdrawn policy flags are absent')
 assert.equal((await call(view+'/evidence',undefined,200,cookie)).shares.length,3)
 const again=await call(base+'/shares',{kind:'policy',subject_id:draft.policy,reason:'Explicit fresh grant'},201)
 await app.db.prepare(`CREATE TRIGGER sharing_race AFTER INSERT ON product_audit WHEN NEW.action='audit.auditor.viewed' BEGIN UPDATE audit_evidence_shares SET unshared_at=NEW.at,unshared_by='race',unshare_reason='Concurrent owner withdrawal' WHERE id='${again.id}'; END`).run()
 try{await call(view+'/evidence/'+again.id,undefined,404,cookie)}finally{await app.db.prepare('DROP TRIGGER sharing_race').run()}
 const packShare=await call(base+'/shares',{kind:'policy',subject_id:draft.policy,reason:'Pack withdrawal fence'},201)
 await app.db.prepare(`CREATE TRIGGER sharing_pack_race AFTER INSERT ON product_audit WHEN NEW.action='audit.auditor.viewed' BEGIN UPDATE audit_evidence_shares SET unshared_at=NEW.at,unshared_by='race',unshare_reason='Concurrent pack withdrawal' WHERE id='${packShare.id}'; END`).run()
 try{const racedPack=await call(view+'/pack',undefined,200,cookie);assert.ok(!racedPack.shared_evidence.shares.some(s=>s.id===packShare.id),'pack rechecks withdrawal after its view audit')}finally{await app.db.prepare('DROP TRIGGER sharing_pack_race').run()}
 const events=(await call('/api/audit?action=audit.evidence')).entries.filter(v=>v.subject===e.id)
 assert.ok(events.some(v=>v.action==='audit.evidence.unshared'&&v.reason==='Policy withdrawn'));assert.ok(events.some(v=>v.action==='audit.evidence.previewed'))
 const restrictedBase='/api/audit-engagements/'+restricted.id,restrictedView='/api/auditor/'+restricted.id
 await call(restrictedBase+'/auditors',{name:'Sharing auditor',email:'sharing-auditor@example.test',reason:'Restricted engagement grant',expires_at:'2026-10-13T00:00:00Z'},201)
 const restrictedShares=[]
 for(const subject_id of [test.id,populationTest.id,privacyTest.id])restrictedShares.push(await call(restrictedBase+'/shares',{kind:'test',subject_id,reason:'Restricted continuous evidence review'},201))
 const restrictedPolicy=await call(restrictedBase+'/shares',{kind:'policy',subject_id:draft.policy,reason:'Restricted policy review'},201)
 const restrictedData=await call(restrictedView+'/evidence',undefined,200,cookie)
 assert.equal(restrictedData.detail_level,'Restricted')
 assert.ok(!JSON.stringify(restrictedData).includes('@example.test'),'email values and repeated prose never enter Restricted projection')
 const redactedPopulation=restrictedData.shares.find(s=>s.subject_id===populationTest.id).population
 const matchingPopulation=restrictedData.shares.find(s=>s.subject_id===privacyTest.id).population
 assert.ok(redactedPopulation.length&&matchingPopulation.length)
 const common=redactedPopulation.find(p=>matchingPopulation.some(q=>q.resource_id===p.resource_id))
 assert.ok(common,'resource pseudonyms stay consistent across shared tests')
 assert.ok(common.resource_id.startsWith('subject-'))
 assert.ok(common.intervals.every(i=>String(i.attributes.email).startsWith('subject-')))
 assert.deepEqual(await call(restrictedBase+'/evidence'),restrictedData,'Restricted owner preview has exact field parity')
 const beforeRestricted=await call('/api/tests/'+test.id),readinessBeforeRestricted=(await call('/api/programs/'+program.id)).readiness
 for(const [index,item]of restrictedShares.entries())await call(restrictedView+'/evidence/'+item.id+'/decisions',{state:index?'accepted':'flagged',reason:index?'':'Restricted failure needs review',expected_revision:0},201,cookie)
 await call(restrictedView+'/evidence/'+restrictedPolicy.id+'/decisions',{state:'accepted',expected_revision:0},201,cookie)
 assert.deepEqual(await call('/api/tests/'+test.id),beforeRestricted)
 assert.deepEqual((await call('/api/programs/'+program.id)).readiness.totals,readinessBeforeRestricted.totals)
 const restrictedPack=await call(restrictedView+'/pack',undefined,200,cookie)
 assert.deepEqual(restrictedPack.shared_evidence,(await call(restrictedBase+'/pack')).shared_evidence)
 assert.equal(restrictedPack.shared_evidence.shares.find(s=>s.id===restrictedShares[0].id).decisions[0].state,'flagged')
 assert.ok(!JSON.stringify(restrictedPack.shared_evidence).includes('@example.test'))
 if(browserProof){
  await browserProof(app,{cookie,stage:'restricted-auditor',decisionForm:true,screens:[['evidence','/auditor/'+restricted.id,'Restricted detail']],followLink:false})
  await browserProof(app,{cookie:ownerCookie,stage:'restricted-preview',screens:[['preview','/app/audit-engagements/'+restricted.id+'/preview','Read-only owner preview']],followLink:false})
 }
 await call(restrictedBase+'/shares/'+restrictedPolicy.id+'/unshare',{reason:'Restricted policy withdrawn'})
 await call(restrictedView+'/evidence/'+restrictedPolicy.id,undefined,404,cookie)
 await call(restrictedView+'/evidence/'+crypto.randomUUID(),undefined,404,cookie)
 await call(restrictedView+'/evidence/'+restrictedShares[0].id+'/observations/'+beforePeriod[0],undefined,404,cookie)
 assert.ok((await call('/api/audit?action=audit.evidence')).entries.some(v=>v.subject===restricted.id&&v.reason==='Restricted policy withdrawn'))
 const expectedRestricted=await call(restrictedBase+'/evidence'),decisionCount=(await app.db.prepare('SELECT COUNT(*) AS n FROM audit_evidence_decisions').first()).n
 const expected=await call(base+'/evidence'),expectedPack=await call(base+'/pack'),archive=await app.fetch('/api/archive/export');assert.equal(archive.status,200,await archive.clone().text())
 await target.clock('2026-10-12T00:00:01Z')
 await target.signin()
 const restored=await target.fetch('/api/archive/restore',{method:'POST',headers:{origin:target.origin,'content-type':'application'+'/'+'octet-stream','x-evidence-confirm':'restore','x-evidence-erasure-history':'unverified acknowledged'},body:await archive.arrayBuffer()});assert.equal(restored.status,200,await restored.clone().text())
 assert.deepEqual(await(await target.fetch(base+'/evidence')).json(),expected)
 assert.deepEqual(await(await target.fetch(base+'/pack')).json(),expectedPack)
 assert.equal((await target.db.prepare('SELECT COUNT(*) AS n FROM audit_evidence_decisions').first()).n,decisionCount)
 assert.deepEqual(await(await target.fetch(restrictedBase+'/evidence')).json(),expectedRestricted)
 assert.equal((await target.db.prepare('SELECT COUNT(*) AS n FROM audit_evidence_replies').first()).n,4)
 const settings=await(await target.fetch('/api/audit-engagements/'+restricted.id+'/evidence')).json();assert.deepEqual([settings.detail_level,settings.hidden_attributes],['Restricted',['email']])
 assert.ok((await target.db.prepare('SELECT revoked_at FROM audit_grants').all()).results.every(g=>g.revoked_at))
 await call(base+'/auditors/'+grant.id+'/revoke',{reason:'Review ended'})
 await call(decisions,{state:'accepted',expected_revision:4},404,cookie)
 await call(view+'/evidence',undefined,404,cookie);await call(view+'/evidence/'+sharedControl.id,undefined,404,cookie)
 }finally{await app.close();await target.close()}
}
