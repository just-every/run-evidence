import assert from 'node:assert/strict'
import {runtime} from './runtime.mjs'
import {githubFixture} from './github-fixture.mjs'
export async function auditSharingJourney(){
 const {outbound}=githubFixture(),app=await runtime({outbound}),target=await runtime({ownerEmail:'restored-sharing@example.test'})
 const call=async(path,body,status=200,cookie)=>{const response=await app.fetch(path,{...(body===undefined?{}:{method:'POST',body:JSON.stringify(body)}),headers:{...(body===undefined?{}:{origin:app.origin,'content-type':'application'+'/'+'json'}),...(cookie===undefined?{}:{cookie})}});assert.equal(response.status,status,path+': '+await response.clone().text());return response.json()}
 try{
 await app.signin()
 const makeControl=async name=>{const r=await app.fetch('/app/controls',{method:'POST',headers:{origin:app.origin,'content-type':'application'+'/'+'x-www-form-urlencoded'},body:new URLSearchParams({name,group:'Access',proof:'Period proof',cadence:'daily'})});assert.equal(r.status,303);return(await call('/api/desk')).requirements.find(q=>q.id===r.headers.get('location').split('/').at(-1)).control_id}
 const control=await makeControl('Shared control'),outside=await makeControl('Unshared control')
 const connection=await call('/api/connections',{account:'northstar',token:'synthetic-evidence-1',label:'Share source'},201)
 await call('/api/connections/'+connection.id+'/repositories',{repositories:connection.repositories})
 const definition={name:'Shared test',resourceType:'github.repository',criteria:JSON.stringify([{attribute:'private',op:'equals',value:true}]),cadence:'hourly',category:'code',severity:'high',controls:[control]}
 const test=await call('/api/tests',definition,201),otherTest=await call('/api/tests',{...definition,name:'Outside scope',controls:[outside]},201)
 const config={name:'Request-free audit',period_from:'2026-10-10',period_to:'2026-10-11',control_ids:[control]}
 const e=await call('/api/audit-engagements',config,201),base='/api/audit-engagements/'+e.id,view='/api/auditor/'+e.id
 await call('/api/audit-engagements',{...config,detail_level:'Restricted',hidden_attributes:'email'},400)
 const restricted=await call('/api/audit-engagements',{...config,detail_level:'Restricted',hidden_attributes:['email']},201)
 await call('/api/audit-engagements/'+restricted.id+'/shares',{kind:'test',subject_id:test.id,reason:'No unsafe fallback'},409)
 await call('/api/audit-engagements/'+restricted.id+'/requests',{requests:'[]'},409)
 const grant=await call(base+'/auditors',{name:'Sharing auditor',email:'sharing-auditor@example.test',reason:'Explicit Full disclosure',expires_at:'2026-10-12T00:00:00Z'},201)
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
 const auditor=await call(view+'/evidence',undefined,200,cookie)
 assert.equal(auditor.detail_level,'Full');assert.equal(auditor.shares.length,3);assert.equal(auditor.shares.find(s=>s.id===policy.id).record.body,'Original approved policy text')
 assert.deepEqual(auditor,await call(base+'/evidence'),'owner preview uses identical projection')
 assert.equal((await call(base)).requests.length,0,'sharing creates no request')
 assert.equal((await call(view+'/evidence/'+shared.id,undefined,200,cookie)).shares.length,1)
 await call(view+'/evidence/'+otherTest.id,undefined,404,cookie)
 await call(view+'/evidence/'+shared.id+'/observations/'+crypto.randomUUID(),undefined,404,cookie)
 await call('/api/tests/'+test.id+'/revisions',{criteria:JSON.stringify([{attribute:'private',op:'equals',value:false}]),reason:'Later criteria'})
 const after=await call(view+'/evidence/'+shared.id,undefined,200,cookie)
 assert.equal(after.shares[0].revision,'1');assert.equal(after.shares[0].record.criteria[0].value,true,'selected revision is retained')
 await call(base+'/shares/'+policy.id+'/unshare',{reason:'Policy withdrawn'},403,cookie)
 await call(base+'/shares/'+policy.id+'/unshare',{reason:'Policy withdrawn'})
 await call(view+'/evidence/'+policy.id,undefined,404,cookie)
 assert.equal((await call(view+'/evidence',undefined,200,cookie)).shares.length,2)
 const again=await call(base+'/shares',{kind:'policy',subject_id:draft.policy,reason:'Explicit fresh grant'},201)
 await app.db.prepare(`CREATE TRIGGER sharing_race AFTER INSERT ON product_audit WHEN NEW.action='audit.auditor.viewed' BEGIN UPDATE audit_evidence_shares SET unshared_at=NEW.at,unshared_by='race',unshare_reason='Concurrent owner withdrawal' WHERE id='${again.id}'; END`).run()
 try{await call(view+'/evidence/'+again.id,undefined,404,cookie)}finally{await app.db.prepare('DROP TRIGGER sharing_race').run()}
 const events=(await call('/api/audit?action=audit.evidence')).entries.filter(v=>v.subject===e.id)
 assert.ok(events.some(v=>v.action==='audit.evidence.unshared'&&v.reason==='Policy withdrawn'));assert.ok(events.some(v=>v.action==='audit.evidence.previewed'))
 const expected=await call(base+'/evidence'),archive=await app.fetch('/api/archive/export');assert.equal(archive.status,200,await archive.clone().text())
 await target.signin()
 const restored=await target.fetch('/api/archive/restore',{method:'POST',headers:{origin:target.origin,'content-type':'application'+'/'+'octet-stream','x-evidence-confirm':'restore','x-evidence-erasure-history':'unverified acknowledged'},body:await archive.arrayBuffer()});assert.equal(restored.status,200,await restored.clone().text())
 assert.deepEqual(await(await target.fetch(base+'/evidence')).json(),expected)
 const settings=await(await target.fetch('/api/audit-engagements/'+restricted.id+'/evidence')).json();assert.deepEqual([settings.detail_level,settings.hidden_attributes],['Restricted',['email']])
 assert.ok((await target.db.prepare('SELECT revoked_at FROM audit_grants').all()).results.every(g=>g.revoked_at))
 await call(base+'/auditors/'+grant.id+'/revoke',{reason:'Review ended'})
 await call(view+'/evidence',undefined,404,cookie);await call(view+'/evidence/'+sharedControl.id,undefined,404,cookie)
 }finally{await app.close();await target.close()}
}
