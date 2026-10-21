import assert from 'node:assert/strict'
import { runtime } from './runtime.mjs'
export async function tailoringFixture(app,suffix='journey'){
 const post=async(path,body,status=201)=>{const r=await app.fetch(path,{method:'POST',headers:{origin:app.origin,'content-type':'application/json'},body:JSON.stringify(body)});assert.equal(r.status,status,path+' '+await r.clone().text());return r.json()},get=async path=>{const r=await app.fetch(path);assert.equal(r.status,200,path);return r.json()}
 const owner=await post('/api/people',{name:'Security and legal owner '+suffix,email:'reviewer-'+suffix+'@northstar.test',kind:'employee'})
 const program=await post('/api/programs',{framework:'soc2',name:'US customer commitments '+suffix,legal_entity:'Northstar Inc',report_type:'Type II',audit_from:'2026-01-01',audit_to:'2026-12-31'})
 const framework=await post('/api/frameworks',{name:'US customer security addendum '+suffix}),materialFramework=await post('/api/frameworks',{name:'Selected framework material '+suffix}),material=await post(`/api/frameworks/${materialFramework.id}/requirements`,{ref:'REG-AC',title:'Access-control requirements',description:'Accounts must have a named owner and approved access reviews.',section:'Access'})
 const q=[]
 for(const [i,description]of ['Effective 2026-01-01; review customer account access quarterly by 2026-12-31.','Encrypt production data exports and respond promptly to contract exceptions.','Provide reasonable customer security assurance.'].entries())q.push(await post(`/api/frameworks/${framework.id}/requirements`,{ref:'US-'+(i+1),title:'Customer security commitment '+(i+1),description,section:'Security'}))
 const c=await app.fetch('/app/controls',{method:'POST',headers:{origin:app.origin,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({name:'Customer access reviews and production export safeguards '+suffix,group:'Access',proof:'Customer safeguards',cadence:'quarterly'})});assert.equal(c.status,303)
 const control=(await get('/api/desk')).requirements.find(r=>c.headers.get('location').endsWith(r.id)).control_id
 const policy=await post('/api/policies',{title:'Customer access policy '+suffix,body:'Access reviews occur annually.'}),revision=await get(`/api/policies/${policy.policy}/revisions/${policy.revision}`)
 await post(`/api/policies/${policy.policy}/revisions/${policy.revision}/decision`,{decision:'approved',body_sha256:revision.body_sha256},200)
 const token=await post('/api/api-tokens',{name:'Authorized asset inventory '+suffix,scopes:['resource-push'],expires_at:'2027-01-01'})
 const put=async(path,body)=>{const r=await app.fetch(path,{method:'PUT',headers:{cookie:'',authorization:'Bearer '+token.token,'content-type':'application/json'},body:JSON.stringify(body)});assert.equal(r.status,200,path+' '+await r.clone().text());return r.json()}
 const type='tailoring_'+suffix.replace(/[^a-z0-9]/g,'_')
 await put('/v1/resource-types/'+type,{schema:{fields:{secure:'boolean',owner:'string'},required:['secure']}})
 const inventory=await put('/v1/resources/'+type,{resources:[{uniqueId:'synthetic-evidence-production',displayName:'Production customer service '+suffix,attributes:{secure:true,owner:'Platform'}}]}),resource=inventory.results[0].id
 const input={program_id:program.id,framework_id:framework.id,material_id:material.id,control_id:control,policy_revision_id:policy.revision,resource_ids:[resource],assumptions:'The selected production service is in scope; promptly means escalation for human review, without an invented deadline.',likelihood:'2',impact:'4'}
 return {post,get,put,input,owner,framework,material,program,requirements:q,policy,resource,type,control,token}
}
export async function tailoringJourney(){const app=await runtime();try{
 assert.equal((await app.fetch('/api/tailoring')).status,401)
 await app.signin();const f=await tailoringFixture(app)
 const proposals=[]
 for(const [i,q]of f.requirements.entries()){const input={...f.input,requirement_id:q.id};if(i===0)delete input.control_id;proposals.push(await f.post('/api/tailoring',input))}
 const snapshot=(await f.get('/api/tailoring/'+proposals[0].id)).snapshot
 assert.equal(snapshot.control_selection.mode,'source-based recommendation');assert.equal(snapshot.mapping.control_id,f.control)
 assert.equal(snapshot.citations[0].kind,'contract-promise');assert.equal(snapshot.citations[1].kind,'framework-requirement');assert.equal(snapshot.context.resources[0].id,f.resource);assert.equal(snapshot.deadline,'2026-12-31');assert.equal(snapshot.policy_diff.before,'Access reviews occur annually.');assert.ok(snapshot.conflicts.length);assert.ok(snapshot.policy_diff.after.includes('quarterly'))
 for(const c of snapshot.citations)assert.equal((await app.fetch(c.href)).status,200,'original clause citation resolves')
 const counts=async()=>({mappings:(await app.db.prepare('SELECT count(*) AS n FROM custom_framework_mappings WHERE requirement_id IN (SELECT id FROM custom_framework_requirements WHERE framework_id=?)').bind(f.framework.id).first()).n,risks:(await app.db.prepare('SELECT count(*) AS n FROM risks').first()).n,obligations:(await app.db.prepare('SELECT count(*) AS n FROM tailored_obligations').first()).n,policyDrafts:(await app.db.prepare("SELECT count(*) AS n FROM policy_revisions WHERE status='draft'").first()).n})
 assert.deepEqual(await counts(),{mappings:0,risks:0,obligations:0,policyDrafts:0},'preparation has no downstream changes')
 const decision=(p,extra={})=>({snapshot_hash:p.snapshot_hash,decision:'approved',approver_person_id:f.owner.id,reason:'Reviewed exact citations, inventory, policy diff, risk and mapping',...extra})
 await f.post(`/api/tailoring/${proposals[0].id}/decision`,decision(proposals[0],{snapshot_hash:'0'.repeat(64)}),409)
 const foreign=await app.fetch(`/api/tailoring/${proposals[0].id}/decision`,{method:'POST',headers:{origin:'https://foreign.test','content-type':'application/json'},body:JSON.stringify(decision(proposals[0]))});assert.equal(foreign.status,403)
 assert.equal((await app.fetch('/api/tailoring',{headers:{authorization:'Bearer '+f.token.token}})).status,403)
 const approved=await f.post(`/api/tailoring/${proposals[0].id}/decision`,decision(proposals[0]),200)
 const ambiguous=(await f.get('/api/tailoring/'+proposals[1].id)).snapshot;assert.equal(ambiguous.ambiguous,true);assert.equal(ambiguous.deadline,null)
 await f.post(`/api/tailoring/${proposals[1].id}/decision`,decision(proposals[1]),409)
 await f.post(`/api/tailoring/${proposals[1].id}/decision`,decision(proposals[1],{acknowledge_ambiguity:'yes'}),200)
 const beforeReject=await counts()
 await f.post(`/api/tailoring/${proposals[2].id}/decision`,decision(proposals[2],{decision:'rejected'}),200)
 assert.deepEqual(await counts(),beforeReject);assert.deepEqual(beforeReject,{mappings:2,risks:2,obligations:2,policyDrafts:2})
 const rows=(await f.get('/api/frameworks/'+f.framework.id)).requirements
 assert.deepEqual(rows.filter(q=>q.mappings.includes(f.control)).map(q=>q.ref).sort(),['US-1','US-2'])
 const policy=await f.get(`/api/policies/${f.policy.policy}/revisions/${approved.policy_revision_id}`);assert.equal(policy.status,'draft');assert.equal(policy.body,snapshot.policy_diff.after);assert.equal(policy.published_at,null);assert.equal(policy.drafted_by,'Evidence owner')
 const risk=await f.get('/api/risks/'+approved.risk_id);assert.ok(JSON.stringify(risk).includes(snapshot.citations[0].passage));assert.ok(JSON.stringify(risk).includes('2'));assert.equal(risk.risk.owner_person_id,null,'approval does not silently assign new work');assert.ok(risk.assessments.every(a=>a.actor_name==='Evidence owner'),'assessment actor is the signed-in owner; named reviewer remains separate')
 await f.post(`/api/tailoring/${proposals[0].id}/decision`,decision(proposals[0]),409)
 const stale=await f.post('/api/tailoring',{...f.input,requirement_id:f.requirements[2].id})
 await f.put('/v1/resources/'+f.type,{resources:[{uniqueId:'synthetic-evidence-production',displayName:'Production customer service changed',attributes:{secure:false,owner:'Platform'}}]})
 await f.post(`/api/tailoring/${stale.id}/decision`,decision(stale,{acknowledge_ambiguity:'yes'}),409)
 assert.deepEqual(await counts(),beforeReject,'stale approval changes nothing')
 await assert.rejects(app.db.prepare('UPDATE tailoring_proposals SET snapshot_hash=? WHERE id=?').bind('a'.repeat(64),stale.id).run(),/immutable_tailoring_proposal/)
 const archiveResponse=await app.fetch('/api/archive/export');assert.equal(archiveResponse.status,200,await archiveResponse.clone().text().catch(()=>''));const archive=Buffer.from(await archiveResponse.arrayBuffer()),dest=await runtime()
 try{await dest.signin();const r=await dest.fetch('/api/archive/restore',{method:'POST',headers:{origin:dest.origin,'content-type':'application/octet-stream','x-evidence-confirm':'restore','x-evidence-erasure-history':'unverified acknowledged'},body:archive});assert.equal(r.status,200,await r.clone().text());assert.deepEqual((await (await dest.fetch('/api/tailoring')).json()).proposals,(await f.get('/api/tailoring')).proposals);assert.deepEqual((await (await dest.fetch('/api/tailoring')).json()).obligations,(await f.get('/api/tailoring')).obligations)}finally{await dest.close()}
 console.log('PASS AGENT-006: cited customer/framework interpretation and inventory, policy/risk diffs, ambiguity, two exact individual mapping approvals and one rejection, stale/unauthorized refusal, atomic downstream records and archive parity')
}finally{await app.close()}}
