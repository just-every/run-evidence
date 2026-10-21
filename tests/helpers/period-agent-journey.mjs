import assert from 'node:assert/strict'
export async function periodAgentFixture(app) {
 const get=async p=>{const r=await app.fetch(p);assert.equal(r.status,200,await r.clone().text());return r.json()}
 const post=async(p,b,status=200)=>{const r=await app.fetch(p,{method:'POST',headers:{origin:app.origin,'content-type':'application/json'},body:JSON.stringify(b)});assert.equal(r.status,status,await r.clone().text());return r.json()}
 await app.clock('2026-10-12T12:00:00Z')
 const created=await app.fetch('/app/controls',{method:'POST',headers:{origin:app.origin,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({name:'Northstar production safeguards',group:'Access',proof:'Period safeguard review',cadence:'daily'})})
 assert.equal(created.status,303)
 const requirement=created.headers.get('location').split('/').at(-1),control=(await get('/api/desk')).requirements.find(r=>r.id===requirement).control_id
 const token=await post('/api/api-tokens',{name:'Northstar authorized source feed',scopes:['resource-push'],expires_at:'2027-01-01'},201)
 const put=async(p,b)=>{const r=await app.fetch(p,{method:'PUT',headers:{cookie:'',authorization:'Bearer '+token.token,'content-type':'application/json'},body:JSON.stringify(b)});assert.equal(r.status,200,await r.clone().text());return r.json()}
 const types=['period_cloud','period_identity','period_deploy'],tests=[],resources=[]
 for(const [i,type] of types.entries()) {
  await put('/v1/resource-types/'+type,{schema:{fields:{secure:'boolean'},required:['secure']}})
  const pushed=await put('/v1/resources/'+type,{resources:[{uniqueId:'northstar-'+i,displayName:['Production configuration','Privileged identity','Production deployment'][i],attributes:{secure:false}}]})
  resources.push(pushed.results[0].id)
  tests.push((await post('/api/tests',{name:['Cloud configuration assurance','Identity privilege assurance','Deployment merge review'][i],resourceType:type,criteria:JSON.stringify([{attribute:'secure',op:'equals',value:true}]),cadence:'hourly',category:['cloud','identity','code'][i],severity:'high',controls:[control]},201)).id)
  await post('/api/tests/'+tests[i]+'/run',{})
 }
 await post('/api/controls/'+control+'/scope',{asset:'missing-production-asset',action:'added',reason:'Production scope includes an asset with no source feed'})
 await app.clock('2026-10-14T12:00:00Z')
 for(const [i,type] of types.entries()) await put('/v1/resources/'+type,{resources:[{uniqueId:'northstar-'+i,displayName:['Production configuration','Privileged identity','Production deployment'][i],attributes:{secure:true}}]})
 const definition={name:'Northstar production safeguards',group:'Access',applicability:'Production services',test_intent:'Require production safeguards',evaluation_criteria:'Every declared safeguard is true',reason:'Clarify prospective control meaning',revision:1}
 await post('/api/controls/'+control+'/revisions',definition)
 // Two authorized reports disagree at the same evaluation timestamp. Both originals remain.
 const alternate=await post('/api/api-tokens',{name:'Northstar second authorized identity feed',scopes:['resource-push'],expires_at:'2027-01-01'},201)
 const conflict=await app.fetch('/v1/resources/'+types[1],{method:'PUT',headers:{cookie:'',authorization:'Bearer '+alternate.token,'content-type':'application/json'},body:JSON.stringify({resources:[{uniqueId:'northstar-1',displayName:'Privileged identity',attributes:{secure:false}}]})})
 assert.equal(conflict.status,200)
 await put('/v1/resources/'+types[1],{resources:[{uniqueId:'northstar-1',displayName:'Privileged identity',attributes:{secure:true}}]})
 await put('/v1/resource-types/period_unobserved',{schema:{fields:{secure:'boolean'},required:[]}})
 await put('/v1/resources/period_unobserved',{resources:[{uniqueId:'unobserved-vault',displayName:'Unobserved vault',attributes:{secure:true}}]})
 const unobserved=(await post('/api/tests',{name:'Vault evidence not collected yet',resourceType:'period_unobserved',criteria:JSON.stringify([{attribute:'secure',op:'equals',value:true}]),cadence:'hourly',category:'cloud',severity:'high',controls:[control]},201)).id
 await put('/v1/resource-types/period_unknown',{schema:{fields:{secure:'boolean'},required:[]}})
 await put('/v1/resources/period_unknown',{resources:[{uniqueId:'unknown-monitor',displayName:'Monitor omitted safeguard field',attributes:{}}]})
 const unknown=(await post('/api/tests',{name:'Unknown monitor evidence',resourceType:'period_unknown',criteria:JSON.stringify([{attribute:'secure',op:'equals',value:true}]),cadence:'hourly',category:'cloud',severity:'high',controls:[control]},201)).id
 await post('/api/tests/'+unknown+'/run',{})
 const program=(await post('/api/programs',{framework:'soc2',name:'Northstar SOC 2 period',legal_entity:'Northstar',report_type:'Type II',audit_from:'2026-10-12',audit_to:'2026-10-14'},201)).id
 await post('/api/programs/'+program+'/reviews',{reviewer:'Northstar independent assessor',notes:'Original period review retained',snapshot_hash:'a'.repeat(64)})
 const investigate=()=>post('/api/controls/'+control+'/investigate',{from:'2026-10-12',to:'2026-10-14'},201)
 return {control,tests,resources,get,post,investigate,program,unobserved,unknown}
}
export async function periodAgentJourney(app) {
 const f=await periodAgentFixture(app),{control,get,post}=f
 const before=await get('/api/controls/'+control+'/report?from=2026-10-12&to=2026-10-14')
 const auditReview=(await get('/api/programs/'+f.program)).history.reviews
 const original=await get('/api/controls/'+control+'/export')
 const investigation=await f.investigate(),snapshot=investigation.snapshot
 assert.equal(snapshot.control_id,control)
 assert.ok(snapshot.observations.length>=7)
 assert.ok(snapshot.changes.length>=6)
 assert.ok(snapshot.definitions.length>=2)
 assert.ok(snapshot.findings.some(r=>r.kind==='earlier-failure-latest-pass'))
 assert.ok(snapshot.findings.some(r=>r.kind==='missing-window'))
 assert.ok(snapshot.findings.some(r=>r.kind==='unknown'&&r.test_id===f.unknown))
 assert.ok(snapshot.findings.some(r=>r.kind==='unobserved-population'&&r.test_id===f.unobserved))
 const text=JSON.stringify(snapshot.findings)
 assert.match(text,/fail/i);assert.match(text,/missing|unknown/i);assert.match(text,/contradict/i);assert.match(text,/unobserved|unmatched/i)
 for(const id of f.tests) {
  const observed=snapshot.observations.filter(o=>o.test_id===id)
  assert.ok(observed.some(o=>o.result==='fail'))
  assert.ok(observed.some(o=>o.result==='pass'))
  assert.ok(snapshot.findings.some(f=>f.test_id===id&&f.proposed_exception))
 }
 let followed=0
 for(const finding of snapshot.findings)for(const citation of finding.citations) {
  const source=await get(citation.href)
  assert.ok(source.id===citation.id||source.run_id===citation.id)
  if(citation.kind==='observation')assert.ok(source.source_ref&&source.observed_at&&source.expected_json&&source.actual_json)
  followed++
 }
 assert.ok(followed>=3)
 const base='/api/controls/'+control+'/investigations/'+investigation.id
 assert.equal((await app.fetch(base+'/decision',{method:'POST',headers:{cookie:'',origin:app.origin,'content-type':'application/json'},body:JSON.stringify({})})).status,401)
 assert.equal((await app.fetch(base+'/decision',{method:'POST',headers:{origin:'https://foreign.test','content-type':'application/json'},body:'{}'})).status,403)
 assert.equal((await app.fetch(base+'/decision',{method:'POST',headers:{origin:app.origin,'content-type':'application/json'},body:JSON.stringify({snapshot_hash:'0'.repeat(64),action:'rejected',reason:'Wrong snapshot'})})).status,409)
 const rejected=await post(base+'/decision',{snapshot_hash:investigation.snapshot_hash,action:'rejected',reason:'Reject suggested exception; retain the original violation and unknown interval'})
 assert.equal(rejected.decision.action,'rejected')
 assert.deepEqual(rejected.snapshot,snapshot)
 const after=await get('/api/controls/'+control+'/report?from=2026-10-12&to=2026-10-14')
 assert.deepEqual((await get('/api/programs/'+f.program)).history.reviews,auditReview,'Auditor decisions are untouched')
 assert.deepEqual(after,before,'Rejecting a finding changes no observation, definition or scope')
 assert.deepEqual(await get('/api/controls/'+control+'/export'),original,'No mapping or control meaning changes')
 for(const id of f.tests)assert.deepEqual((await get('/api/tests/'+id)).exceptions,[])
 assert.equal((await get('/api/audit?action=agent.period-rejected')).entries.filter(e=>e.subject==='investigation:'+investigation.id).length,1)
 const replay=await app.fetch(base+'/decision',{method:'POST',headers:{origin:app.origin,'content-type':'application/json'},body:JSON.stringify({snapshot_hash:investigation.snapshot_hash,action:'reviewed',reason:'Replay'})});assert.equal(replay.status,409)
 const {runtime}=await import('./runtime.mjs'),destination=await runtime()
 try {
  await destination.signin()
  const exported=await app.fetch('/api/archive/export');assert.equal(exported.status,200)
  const restored=await destination.fetch('/api/archive/restore',{method:'POST',headers:{origin:destination.origin,'content-type':'application/octet-stream','x-evidence-confirm':'restore','x-evidence-erasure-history':'unverified acknowledged'},body:await exported.arrayBuffer()})
  assert.equal(restored.status,200,await restored.clone().text())
  const retained=await destination.fetch(base);assert.equal(retained.status,200)
  assert.deepEqual(await retained.json(),rejected)
  for(const finding of snapshot.findings)for(const citation of finding.citations)assert.equal((await destination.fetch(citation.href)).status,200)
 } finally {await destination.close()}
 return {...f,investigation:rejected}
}
