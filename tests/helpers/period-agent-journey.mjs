import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'

// Re-sign the transport and snapshot so refusal must validate the cited door,
// rather than merely detecting an old digest. This is adversarial archive input.
function alteredCitationArchive(bytes) {
 const source=Buffer.from(bytes),magic=Buffer.from('EVIDENCE-ARCHIVE\n'),frames=[magic],hash=createHash('sha256'),changed=new Map()
 let at=magic.length
 while(at<source.length) {
  const size=source.readUInt32BE(at);at+=4
  const frame=JSON.parse(source.subarray(at,at+size));at+=size
  if(frame.type==='rows'&&frame.table==='period_investigations')for(const row of frame.rows) {
   const snapshot=JSON.parse(row.snapshot_json),citation=snapshot.findings.flatMap(f=>f.citations)[0]
   assert.ok(citation);citation.href='javascript:globalThis.archiveCitationExecuted=true'
   row.snapshot_json=JSON.stringify(snapshot);row.snapshot_hash=createHash('sha256').update(row.snapshot_json).digest('hex');changed.set(row.id,row.snapshot_hash)
  }
  if(frame.type==='rows'&&frame.table==='period_investigation_decisions')for(const row of frame.rows)row.snapshot_hash=changed.get(row.investigation_id)??row.snapshot_hash
  if(frame.type==='end')frame.sha256=hash.digest('hex')
  const body=Buffer.from(JSON.stringify(frame)),prefix=Buffer.alloc(4);prefix.writeUInt32BE(body.length)
  frames.push(prefix,body)
  if(frame.type!=='end')hash.update(prefix).update(body)
 }
 assert.ok(changed.size)
 return Buffer.concat(frames)
}

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
 const neverObserved=await put('/v1/resources/period_unobserved',{resources:[{uniqueId:'unobserved-vault',displayName:'Unobserved vault',attributes:{secure:true}}]})
 await post('/api/controls/'+control+'/scope',{asset:neverObserved.results[0].id,action:'added',reason:'Declared vault needs its own observation'})
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
 assert.ok(snapshot.findings.some(r=>r.kind==='unobserved-scoped-asset'))
 const conflict=snapshot.findings.find(r=>r.kind==='contradictory-sources');assert.ok(conflict)
 const conflicted=conflict.citations.filter(c=>c.kind==='observation').map(c=>snapshot.observations.find(o=>o.id===c.id))
 assert.equal(new Set(conflicted.map(o=>o.source_ref)).size,2)
 for(const o of snapshot.observations)assert.ok(o.observed_at.startsWith('2026-10-')&&o.source_kind==='source-reported'&&o.control_snapshot_json&&o.test_revision_id)
 for(const c of snapshot.changes)assert.ok(c.source_ref&&c.at&&c.attributes_json)
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
 // The public citation door must reject inherited names before preparing SQL.
 {
  const door='/api/controls/'+control+'/investigation-source'
  const unknown=await app.fetch(door+'?kind=unknown-source&id=x')
  assert.equal(unknown.status,404,'Unknown citation kind is refused')
  const expected=await unknown.text(),results=[]
  for(const kind of ['constructor','__proto__']) {
   const response=await app.fetch(door+'?'+new URLSearchParams({kind,id:'x'}))
   results.push({kind,status:response.status,body:await response.text()})
  }
  const post=kind=>app.fetch(door+'?'+new URLSearchParams({kind,id:'x'}),{method:'POST',headers:{origin:app.origin,'content-type':'application/json'},body:JSON.stringify({kind,id:'x'})})
  const unknownPost=await post('unknown-source')
  assert.equal(unknownPost.status,405,'Citation door retains its GET-only method contract')
  const expectedPost=await unknownPost.text(),postStatuses=[]
  for(const kind of ['constructor','__proto__']) {
   const response=await post(kind),body=await response.text()
   postStatuses.push(kind+'='+response.status)
   assert.equal(response.status,405,'Inherited names cannot enter the GET-only door via POST')
   assert.ok(body===expectedPost,'POST refusal contains only the unknown-name method answer')
  }
  console.log('Citation inherited-name POST statuses: '+postStatuses.join(', '))
  console.log('Citation inherited-name GET statuses: '+results.map(r=>r.kind+'='+r.status).join(', '))
  for(const result of results) {
   assert.equal(result.status,404,'Inherited citation kind is refused like an unknown kind')
   assert.ok(result.body===expected,'Refusal contains only the unknown-kind answer')
   for(const key of ['SESSION_SECRET','SETUP_TOKEN','MAIL_API_KEY','RER_DEV_KEY'])assert.ok(!result.body.includes(app.harnessState().settings[key]),'Refusal contains no binding value')
   assert.ok(!/SESSION_SECRET|SETUP_TOKEN|MAIL_API_KEY|RER_DEV_KEY|EXHIBITS|DB/.test(result.body),'Refusal contains no environment content')
  }
  const citation=snapshot.findings.flatMap(f=>f.citations)[0]
  assert.ok(citation,'A registered source is available')
  const response=await app.fetch(citation.href)
  assert.equal(response.status,200,'Registered citation still works')
  const source=await response.json()
  assert.ok(source.id===citation.id||source.run_id===citation.id,'Registered citation returns the cited source')
  console.log('Citation registered-name GET status: '+response.status)
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
 // An exception requires its separate owner approval; recording a review never approves one.
 const exceptionPath='/api/tests/'+f.tests[0]+'/exceptions',exception={reason:'Owner-approved time-limited mitigation after independent review',expires_at:'2026-10-20T12:00:00Z'}
 assert.equal((await app.fetch(exceptionPath,{method:'POST',headers:{cookie:'',origin:app.origin,'content-type':'application/json'},body:JSON.stringify(exception)})).status,401)
 await post(exceptionPath,exception,201)
 assert.equal((await get('/api/tests/'+f.tests[0])).exceptions.length,1)
 assert.deepEqual(await get('/api/controls/'+control+'/report?from=2026-10-12&to=2026-10-14'),before,'Owner exception approval preserves the original evaluated facts')
 const {runtime}=await import('./runtime.mjs'),destination=await runtime()
 try {
  await destination.signin()
  const exported=await app.fetch('/api/archive/export');assert.equal(exported.status,200)
  const bytes=await exported.arrayBuffer()
  const hostile=await destination.fetch('/api/archive/restore',{method:'POST',headers:{origin:destination.origin,'content-type':'application/octet-stream','x-evidence-confirm':'restore','x-evidence-erasure-history':'unverified acknowledged'},body:alteredCitationArchive(bytes)})
  assert.equal(hostile.status,400,'AGENT-002 restored citations must use their exact owner source door')
  assert.equal((await destination.fetch(base)).status,404,'Refused citation archive admits no investigation')
  const restored=await destination.fetch('/api/archive/restore',{method:'POST',headers:{origin:destination.origin,'content-type':'application/octet-stream','x-evidence-confirm':'restore','x-evidence-erasure-history':'unverified acknowledged'},body:bytes})
  assert.equal(restored.status,200,await restored.clone().text())
  const retained=await destination.fetch(base);assert.equal(retained.status,200)
  assert.deepEqual(await retained.json(),rejected)
  for(const finding of snapshot.findings)for(const citation of finding.citations)assert.equal((await destination.fetch(citation.href)).status,200)
 } finally {await destination.close()}
 return {...f,investigation:rejected}
}
