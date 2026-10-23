import assert from 'node:assert/strict'
import {runtime} from './runtime.mjs'
import {githubFixture} from './github-fixture.mjs'
import {decodeArchive} from './portable-format.mjs'
export async function engagementJourney(browserProof){
 const {github,outbound}=githubFixture();github.clock='2026-10-11T12:00:00Z'
 const app=await runtime({outbound}),target=await runtime({ownerEmail:'restored-owner@example.test'})
 const call=async(path,body,status=200,cookie)=>{const r=await app.fetch(path,{...(body===undefined?{}:{method:'POST',body:JSON.stringify(body)}),headers:{...(body===undefined?{}:{origin:app.origin,'content-type':'application' + '/' + 'json'}),...(cookie===undefined?{}:{cookie})}});assert.equal(r.status,status,`${path}: ${await r.clone().text()}`);return r.json()}
 let ownerCookie,auditorCookie
 try{
 ownerCookie=await app.signin();await app.clock('2026-10-09T12:00:00Z')
 const person=await call('/api/people',{name:'Request owner',email:'requests@example.test',kind:'employee'},201)
 const control=await app.fetch('/app/controls',{method:'POST',headers:{origin:app.origin,'content-type':'application' + '/' + 'x-www-form-urlencoded'},body:new URLSearchParams({name:'Audited control',group:'Access',proof:'Exact period exhibit',cadence:'daily'})});assert.equal(control.status,303)
 const rid=control.headers.get('location').split('/').at(-1),requirement=(await call('/api/desk')).requirements.find(r=>r.id===rid)
 const program=await call('/api/programs',{framework:'soc2',name:'Auditor period program',legal_entity:'Northstar',report_type:'Type II',audit_from:'2026-10-10',audit_to:'2026-10-11'},201)
 await call('/api/controls/'+requirement.control_id+'/mappings',{framework:'soc2',edition:'tsc-2017-pof-2022',ref:'CC6.1',reason:'Engagement request scope'},201)
 const input={name:'Period engagement',period_from:'2026-10-10',period_to:'2026-10-11',control_ids:[requirement.control_id]}
 const e=await call('/api/audit-engagements',input,201),other=await call('/api/audit-engagements',{...input,name:'Unshared engagement'},201),base='/api/audit-engagements/'+e.id,view='/api/auditor/'+e.id
 await call('/api/audit-engagements',input,401,'')
 const grant=await call(base+'/auditors',{name:'Independent auditor',email:'auditor@example.test',reason:'Explicit engagement approval',expires_at:'2026-10-20T00:00:00Z'},201)
 const mail=app.messages.at(-1),url=new URL(mail.html.match(/href="([^"]*\/auth\/confirm\?token=[^"]+)"/)[1].replaceAll('&amp;','&'),app.origin)
 const confirmed=await app.fetch('/auth/confirm',{method:'POST',headers:{cookie:'',origin:app.origin,'content-type':'application' + '/' + 'json'},body:JSON.stringify({token:url.searchParams.get('token')})});assert.equal(confirmed.status,303);auditorCookie=confirmed.headers.getSetCookie().map(s=>s.split(';')[0]).join('; ')
 await call(view,undefined,401,'');await call('/api/auditor/'+other.id,undefined,404,auditorCookie)
 for(const path of ['/api/desk','/api/me','/api/folders','/api/people','/api/archive/export','/me'])await call(path,undefined,403,auditorCookie)
 await call(base+'/auditors',{name:'Existing owner',email:'owner@example.test',reason:'Invalid widening',expires_at:'2026-10-20T00:00:00Z'},409)
 const req={title:'Operating proof',control_id:requirement.control_id,owner_person_id:person.id,due_date:'2026-10-15'}
 await call(base+'/requests',{requests:JSON.stringify([req,{...req,control_id:crypto.randomUUID()}])},400)
 assert.equal((await call(base)).requests.length,0,'request import is atomic')
 const imported=await call(base+'/requests',{requests:JSON.stringify([req,{...req,title:'Continuous control evidence'},{...req,title:'Additional scope explanation'}])},201),request=imported.ids[0],door=base+'/requests/'+request,auditorDoor=view+'/requests/'+request
 const connection=await call('/api/connections',{account:'northstar',token:'synthetic-evidence-1',label:'Auditor source'},201)
 await call('/api/connections/'+connection.id+'/repositories',{repositories:connection.repositories})
 const test=await call('/api/tests',{name:'Audited private repositories',resourceType:'github.repository',criteria:JSON.stringify([{attribute:'private',op:'equals',value:true}]),cadence:'hourly',category:'code',severity:'high',controls:[requirement.control_id]},201)
 github.clock='2026-10-09T12:00:00Z';await app.clock(github.clock);await call('/api/connections/'+connection.id+'/collect',{},201)
 const before=(await call('/api/tests/'+test.id)).latest.map(o=>o.id)
 github.clock='2026-10-11T12:00:00Z';await app.clock(github.clock);await call('/api/connections/'+connection.id+'/collect',{},201)
 await call('/api/tests/'+test.id+'/exceptions',{reason:'Owner-approved bounded exception',expires_at:'2026-10-12T12:00:00Z'},201)
 const period=(await call(view,undefined,200,auditorCookie)).requests.find(r=>r.id===imported.ids[1])
 assert.ok(period.observations.length>0);assert.ok(period.observations.every(o=>o.source_connector==='github'&&o.source_account==='northstar'&&o.observed_at.startsWith('2026-10-11')))
 assert.equal(period.exceptions.length,1);assert.equal(period.exceptions[0].approved_name,'Evidence owner');assert.equal(period.exceptions[0].expires_at,'2026-10-12T12:00:00.000Z')
 assert.ok(period.observations.some(o=>o.result==='fail'));assert.ok(!period.observations.some(o=>before.includes(o.id)))
 for(const observation of period.observations)assert.deepEqual(await call(view+'/requests/'+imported.ids[1]+'/observations/'+observation.id,undefined,200,auditorCookie),observation)
 await call(view+'/requests/'+imported.ids[1]+'/observations/'+before[0],undefined,404,auditorCookie)
 const badOrigin=await app.fetch(auditorDoor+'/comments',{method:'POST',headers:{cookie:auditorCookie,origin:'https://elsewhere.test','content-type':'application' + '/' + 'json'},body:JSON.stringify({body:'Refused'})});assert.equal(badOrigin.status,403)
 const replacementOwner=await call('/api/people',{name:'Current request owner',email:'current-request-owner@example.test',kind:'employee'},201)
 await call('/api/people/'+person.id+'/depart',{reason:'Request owner left'})
 let handover=(await call('/api/handover')).items.filter(i=>i.kind==='audit-request');assert.equal(handover.length,3);assert.ok(handover.every(i=>i.state==='owner left'))
 if(browserProof)await browserProof(app,{cookie:ownerCookie,program:program.id,leaver:person.id})
 await call('/api/handover/reassign',{person_id:person.id,kind:'audit-request',item_id:request,role:'owner',to_person_id:replacementOwner.id,reason:'Owner left; assign current reviewer'})
 await call('/api/people/'+person.id+'/handover',{to_person_id:replacementOwner.id,reason:'Complete request handover'})
 assert.equal((await call('/api/handover')).items.filter(i=>i.kind==='audit-request').length,0)
 assert.ok((await call(base)).requests.every(r=>r.owner_person_id===replacementOwner.id))
 const readinessBefore=(await call('/api/programs/'+program.id)).readiness
 const counts=readinessBefore.checklist.find(a=>a.area==='Audit requests');assert.deepEqual([counts.ready,counts.total,counts.records.length],[0,3,3])
 const upload=async(from,to,body)=>{const form=new FormData();form.set('source','Owner supplied period exhibit');form.set('covered_from',from);form.set('covered_to',to);form.set('file',new File([body],'period.txt',{type:'text' + '/' + 'plain'}));const r=await app.fetch('/app/requirements/'+rid+'/uploads',{method:'POST',headers:{origin:app.origin},body:form});assert.equal(r.status,303);return call(r.headers.get('location').replace('/app/','/api/'))}
 const excluded=await upload('2026-10-09','2026-10-10','Outside period'),first=await upload('2026-10-10','2026-10-10','Original evidence'),second=await upload('2026-10-11','2026-10-11','Replacement evidence')
 await call(door+'/submissions',{receipt_id:excluded.id},404)
 const submitted=await call(door+'/submissions',{receipt_id:first.id},201)
 await call(door+'/close',{reason:'Upload is not acceptance'},409)
 await call(auditorDoor+'/comments',{body:'Please explain the population.'},201,auditorCookie)
 await call(door+'/comments',{body:'Original retained; revised proof follows.'},201)
 for(const state of ['rejected','needs-more'])await call(auditorDoor+'/decisions',{submission_id:submitted.id,state,reason:'Needs the complete period'},201,auditorCookie)
 const replacement=await call(door+'/submissions',{receipt_id:second.id},201)
 await call(auditorDoor+'/decisions',{submission_id:submitted.id,state:'accepted',reason:'Stale submission'},409,auditorCookie)
 await call(auditorDoor+'/decisions',{submission_id:replacement.id,state:'accepted',reason:'Period evidence complete'},201,auditorCookie)
 await call(door+'/close',{reason:'Latest exact submission accepted'})
 await call(auditorDoor+'/comments',{body:'Closed request'},409,auditorCookie)
 const pack=await call(view+'/pack',undefined,200,auditorCookie),reviewed=pack.requests.find(r=>r.id===request)
 assert.equal(reviewed.state,'closed');assert.deepEqual(reviewed.decisions.map(d=>d.state),['rejected','needs-more','accepted']);assert.equal(reviewed.comments.length,2);assert.equal(reviewed.submissions.length,2)
 assert.deepEqual(pack,await call(base+'/pack'),'owner and auditor receive the same scoped pack')
 assert.ok(!JSON.stringify(pack).includes(excluded.id));assert.ok(reviewed.submissions.every(s=>s.receipt.source&&s.receipt.added_at&&s.receipt.sha256.length===64));assert.ok(!JSON.stringify(pack).includes('object_key'))
 const readinessAfter=(await call('/api/programs/'+program.id)).readiness
 assert.deepEqual(readinessAfter.totals,readinessBefore.totals,'auditor acceptance never changes readiness passes')
 assert.equal(readinessAfter.checklist.find(a=>a.area==='Audit requests').ready,1)
 const bytes=await app.fetch(auditorDoor+'/receipts/'+first.id,{headers:{cookie:auditorCookie}});assert.equal(bytes.status,200);assert.equal(await bytes.text(),'Original evidence')
 await call(auditorDoor+'/receipts/'+excluded.id,undefined,404,auditorCookie)
 const secondGrant=await call('/api/audit-engagements/'+other.id+'/auditors',{name:'Independent auditor',email:'auditor@example.test',reason:'Separate explicit engagement authorization',expires_at:'2026-10-20T00:00:00Z'},201)
 assert.equal((await call('/api/auditor/'+other.id,undefined,200,auditorCookie)).requests.length,0)
 await call(base+'/auditors/'+grant.id+'/revoke',{reason:'Engagement review ended'})
 for(const path of [view,view+'/pack',auditorDoor+'/receipts/'+first.id])await call(path,undefined,404,auditorCookie)
 const retained=await call(base+'/pack');assert.deepEqual(retained,pack,'revocation retains authorized owner history')
 // Every request needs its own decision before engagement close-out.
 await call(base+'/close',{reason:'Requests remain open'},409)
 for(const requestId of imported.ids.slice(1)){
  const current=base+'/requests/'+requestId,submission=await call(current+'/submissions',{receipt_id:second.id},201)
  await call(view+'/requests/'+requestId+'/decisions',{submission_id:submission.id,state:'accepted',reason:'Exact period evidence accepted'},404,auditorCookie)
 }
 const renewed=await call(base+'/auditors',{name:'Independent auditor',email:'auditor@example.test',reason:'Explicit final request review',expires_at:'2026-10-20T00:00:00Z'},201)
 for(const current of (await call(base)).requests.filter(r=>!r.closed_at)){
  await call(view+'/requests/'+current.id+'/decisions',{submission_id:current.submissions.at(-1).id,state:'accepted',reason:'Exact period evidence accepted'},201,auditorCookie)
  await call(base+'/requests/'+current.id+'/close',{reason:'Auditor accepted the current submission'})
 }
 await call(base+'/close',{reason:'All requested evidence accepted'})
 await call(view,undefined,404,auditorCookie)
 if(browserProof)await browserProof(app,{cookie:ownerCookie,program:program.id,leaver:person.id,stage:'closed'})
 const finalPack=await call(base+'/pack')
 const archiveResponse=await app.fetch('/api/archive/export');assert.equal(archiveResponse.status,200,await archiveResponse.clone().text());const archive=Buffer.from(await archiveResponse.arrayBuffer()),decoded=decodeArchive(archive)
 assert.equal(decoded.allRows.audit_submissions.length,4);assert.equal(decoded.allRows.audit_decisions.length,5)
 await target.signin();const restore=await target.fetch('/api/archive/restore',{method:'POST',headers:{origin:target.origin,'content-type':'application' + '/' + 'octet-stream','x-evidence-confirm':'restore','x-evidence-erasure-history':'unverified acknowledged'},body:archive});assert.equal(restore.status,200,await restore.clone().text())
 const restored=await target.fetch(base+'/pack');assert.equal(restored.status,200);assert.deepEqual(await restored.json(),finalPack)
 await app.db.prepare(`CREATE TRIGGER audit_test_revoke_during_view AFTER INSERT ON product_audit WHEN NEW.action='audit.auditor.viewed' AND NEW.subject='${other.id}' BEGIN UPDATE audit_grants SET revoked_at=NEW.at WHERE engagement_id=NEW.subject; END`).run()
 try{await call('/api/auditor/'+other.id,undefined,404,auditorCookie)}finally{await app.db.prepare('DROP TRIGGER audit_test_revoke_during_view').run()}
 const expiring=await call('/api/audit-engagements/'+other.id+'/auditors',{name:'Independent auditor',email:'auditor@example.test',reason:'Short explicit grant',expires_at:'2026-10-11T12:01:00Z'},201)
 await app.clock('2026-10-11T12:01:00Z');await call('/api/auditor/'+other.id,undefined,404,auditorCookie)
 await call('/api/audit-engagements/'+other.id+'/auditors/'+secondGrant.id+'/revoke',{reason:'End second grant'})
 assert.ok((await target.db.prepare('SELECT revoked_at FROM audit_grants').all()).results.every(g=>g.revoked_at),'restored grants remain inactive')
 }finally{await app.close();await target.close()}
}
