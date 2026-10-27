import assert from 'node:assert/strict'
import {runtime} from './runtime.mjs'

// Three independent source-reported tests exercise historical clocks through
// owner, source API and dedicated auditor HTTP doors, with a pinned clock.
export async function auditRemediationJourney(browserProof){
 const app=await runtime()
 const call=async(path,body,status=200,cookie)=>{
  const response=await app.fetch(path,{...(body===undefined?{}:{method:'POST',body:JSON.stringify(body)}),headers:{
   ...(body===undefined?{}:{origin:app.origin,'content-type':'application'+'/'+'json'}),...(cookie===undefined?{}:{cookie}),
  }})
  assert.equal(response.status,status,path+': '+await response.clone().text());return response.json()
 }
 try{
  await app.signin();await app.clock('2026-10-01T12:00:00Z')
  const created=await app.fetch('/app/controls',{method:'POST',headers:{origin:app.origin,'content-type':'application'+'/'+'x-www-form-urlencoded'},body:new URLSearchParams({name:'Auditor SLA control',group:'Access',proof:'Period remediation evidence',cadence:'daily'})});assert.equal(created.status,303)
  const requirement=(await call('/api/desk')).requirements.find(r=>r.id===created.headers.get('location').split('/').at(-1)),control=requirement.control_id
  await call('/api/remediation/sla',{category:'identity',severity:'high',days:2},201)
  await call('/api/remediation/sla',{category:'cloud',severity:'high',days:1},201)
  const token=await call('/api/api-tokens',{name:'Audit SLA source',scopes:['resource-push','read'],expires_at:'2026-11-01'},201)
  const source=async(path,body)=>{
   const response=await app.fetch(path,{method:'PUT',headers:{cookie:'',authorization:'Bearer '+token.token,'content-type':'application'+'/'+'json'},body:JSON.stringify(body)})
   assert.equal(response.status,200,path+': '+await response.clone().text());return response.json()
  }
  const make=async(name,index,ok)=>{
   const type='audit_remedy_'+name
   await source('/v1/resource-types/'+type,{schema:{fields:{ok:'boolean'}}})
   const push=value=>source('/v1/resources/'+type,{resources:[{uniqueId:'synthetic-evidence-'+index,attributes:{ok:value}}],fullSync:true})
   await push(ok)
   const test=await call('/api/tests',{name:'Historical '+name,resourceType:type,criteria:JSON.stringify([{attribute:'ok',op:'equals',value:true}]),cadence:'hourly',category:name==='mid'?'cloud':'identity',severity:'high',controls:[control]},201)
   await call('/api/tests/'+test.id+'/run',{})
   const detail=await call('/api/tests/'+test.id)
   return {...test,push,resource_id:detail.latest[0].resource_id,opening_observation:detail.latest[0].id}
  }
  const fixed=await make('fixed',2,false),carry=await make('carry',3,true),mid=await make('mid',4,true)
  await app.clock('2026-10-02T12:00:00Z');await fixed.push(true)
  await app.clock('2026-10-04T12:00:00Z');await carry.push(false)
  const before=(await call('/api/tests/'+carry.id)).latest[0].id
  await app.clock('2026-10-05T12:00:00Z')
  await call('/api/tests/'+carry.id+'/exceptions',{resource_id:carry.resource_id,reason:'Approved key delivery window',expires_at:'2026-10-07T12:00:00Z'},201)
  await app.clock('2026-10-06T00:00:00Z')
  const proof=new FormData();for(const [k,v]of Object.entries({source:'Manual remediation exhibit',covered_from:'2026-10-05',covered_to:'2026-10-08'}))proof.set(k,v)
  proof.set('file',new File(['Owner supplied remediation change record'],'remediation.txt',{type:'text'+'/'+'plain'}))
  assert.equal((await app.fetch('/app/requirements/'+requirement.id+'/uploads',{method:'POST',headers:{origin:app.origin},body:proof})).status,303)
  await call('/api/remediation/sla',{category:'identity',severity:'high',days:10},201)
  await app.clock('2026-10-06T06:00:00Z');await mid.push(false)
  await app.clock('2026-10-06T12:00:00Z')
  await call('/api/tests/'+carry.id+'/exceptions',{resource_id:carry.resource_id,reason:'Overlapping approved window',expires_at:'2026-10-07T00:00:00Z'},201)
  const obligation=(await call('/api/remediation')).open.find(o=>o.test_id===carry.id)
  await call('/api/remediation/'+obligation.id+'/changes',{body:'Recorded source configuration change'},201)
  await call('/api/remediation/'+obligation.id+'/done',{body:'Work marked done before verification'})
  await call('/api/tests/'+carry.id+'/run',{})
  assert.equal((await call('/api/remediation/'+obligation.id)).obligation.state,'open')
  await app.clock('2026-10-07T18:00:00Z');await carry.push(true)
  await app.clock('2026-10-08T12:00:00Z');await carry.push(false)
  await app.clock('2026-10-09T00:00:00Z')
  const engagement=await call('/api/audit-engagements',{name:'Historical SLA review',period_from:'2026-10-05',period_to:'2026-10-08',control_ids:[control],detail_level:'Restricted',hidden_attributes:['email']},201)
  const base='/api/audit-engagements/'+engagement.id,view='/api/auditor/'+engagement.id
  const shares=[]
  for(const test of [fixed,carry,mid])shares.push(await call(base+'/shares',{kind:'test',subject_id:test.id,reason:'Review exact period remediation'},201))
  await call(base+'/auditors',{name:'History auditor',email:'history-auditor@example.test',reason:'Review period remediation',expires_at:'2026-10-20T00:00:00Z'},201)
  const url=new URL(app.messages.at(-1).html.match(/href="([^"]*\/auth\/confirm\?token=[^"]+)"/)[1].replaceAll('&amp;','&'),app.origin)
  const confirmed=await app.fetch('/auth/confirm',{method:'POST',headers:{cookie:'',origin:app.origin,'content-type':'application'+'/'+'json'},body:JSON.stringify({token:url.searchParams.get('token')})})
  assert.equal(confirmed.status,303)
  const cookie=confirmed.headers.getSetCookie().map(v=>v.split(';')[0]).join('; ')
  const evidence=await call(view+'/evidence',undefined,200,cookie)
  assert.deepEqual(evidence,await call(base+'/evidence'),'owner and auditor use the same historical projection')
  const get=test=>evidence.shares.find(s=>s.subject_id===test.id)
  const fixedEvidence=get(fixed),carryEvidence=get(carry),midEvidence=get(mid)
  assert.ok(carryEvidence.exhibits.some(x=>x.filename==='remediation.txt'&&x.origin==='manually-asserted'&&x.sha256),'test evidence retains supporting exhibit provenance')
  assert.equal(fixedEvidence.remediation.length,0)
  assert.deepEqual(fixedEvidence.remediated_before_period.map(r=>[r.label,r.opened_at,r.verified_at]),[
   ['remediated before period','2026-10-01T12:00:00.000Z','2026-10-02T12:00:00.000Z'],
  ])
  assert.ok(!JSON.stringify(fixedEvidence).includes(fixed.opening_observation),'fixed-before-period records do not expose the old observation')
  assert.ok(!JSON.stringify(carryEvidence).includes(before),'carry-in history does not expose the opening observation')
  const item=carryEvidence.remediation[0]
  assert.equal(item.obligation_id,obligation.id)
  assert.equal(item.cycles.length,2)
  const [first,regression]=item.cycles
  assert.equal(first.from,'2026-10-05T00:00:00.000Z');assert.equal(first.carry_in,true)
  assert.equal(first.sla.days,2,'a later policy cannot rewrite the running cycle')
  assert.equal(first.sla.status,'resolved');assert.equal(first.sla.paused_hours,48,'overlapping exceptions pause only their union')
  assert.equal(first.sla.hours_to_remediate,78);assert.equal(first.sla.resolved_within_sla,true)
  assert.equal(regression.sla.days,10,'a verified pass resets the next failure to the new policy')
  assert.notEqual(first.sla.policy_id,regression.sla.policy_id)
  assert.equal(regression.sla.status,'within SLA');assert.equal(regression.sla.hours_to_remediate,null)
  assert.ok(first.events.some(e=>e.kind==='marked done'&&e.sla.status!=='resolved'))
  assert.ok(first.events.some(e=>e.kind==='retest failed'&&e.sla.days===2))
  assert.ok(first.events.some(e=>e.kind==='change attached'&&e.body==='Recorded source configuration change'))
  assert.ok(carryEvidence.exceptions.some(e=>e.approved_name==='Evidence owner'&&e.expires_at==='2026-10-07T12:00:00.000Z'))
  assert.ok(carryEvidence.exceptions.some(e=>e.reason==='Overlapping approved window'))
  assert.equal(midEvidence.remediation[0].cycles[0].sla.days,1)
  assert.equal(midEvidence.remediation[0].cycles[0].sla.status,'SLA missed')
  assert.equal(midEvidence.remediation[0].cycles[0].carry_in,false)
  assert.ok(midEvidence.observations.some(o=>o.result==='fail'))
  for(const selected of evidence.shares)for(const remediation of selected.remediation)for(const cycle of remediation.cycles){
   assert.ok(cycle.history.every(h=>h.at>='2026-10-05T00:00:00.000Z'&&h.at<='2026-10-09T00:00:00.000Z'))
   assert.ok(cycle.events.every(e=>e.at>='2026-10-05T00:00:00.000Z'&&e.at<'2026-10-09T00:00:00.000Z'))
  }
  if(browserProof)await browserProof(app,{cookie,stage:'historical-sla',screens:[['evidence','/auditor/'+engagement.id,'Remediated before period']],followLink:false})
  await app.clock('2026-10-10T12:00:00Z');await carry.push(true);await mid.push(true)
  await call('/api/remediation/'+obligation.id+'/comments',{body:'After-period private follow-up'},201)
  await call('/api/tests/'+carry.id+'/exceptions',{resource_id:carry.resource_id,reason:'After-period private approval',expires_at:'2026-10-12T12:00:00Z'},201)
  await call('/api/remediation/sla',{category:'identity',severity:'high',days:365},201)
  const after=await call(view+'/evidence',undefined,200,cookie)
  assert.deepEqual(after,evidence,'later closure, comments and policy changes never rewrite the period')
  assert.deepEqual((await call(view+'/pack',undefined,200,cookie)).shared_evidence,evidence)
 }finally{await app.close()}
}
