import { tailoringJourney } from './helpers/tailoring-journey.mjs'
import { interpretationJourney } from './helpers/interpret-journey.mjs'
import { answerJourney } from './helpers/answer-journey.mjs'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { periodAgentJourney } from './helpers/period-agent-journey.mjs'
import { runtime } from './helpers/runtime.mjs'
const app=await runtime()
let active='',passed=0,ownerCookie='',credential,control,proposal,receipt
const scenario=async(name,run)=>{active=name;await run();passed++}
const owner=(path,body)=>app.fetch(path,{method:'POST',headers:{origin:app.origin,'content-type':'application/json'},body:JSON.stringify(body)})
const agent=(path,body,token=credential?.token,extra={})=>app.fetch(path,{method:body===undefined?'GET':'POST',headers:{cookie:'',authorization:'Bearer '+token,...(body===undefined?{}:{'content-type':'application/json'}),...extra},...(body===undefined?{}:{body:JSON.stringify(body)})})
const refusedAudit = async (path, call, actor) => {
 const subject = `${actor.method ?? 'POST'} ${path}`
 const entries = async () => (await (await app.fetch('/api/audit?action=door.refused&outcome=refused')).json()).entries.filter(e=>e.subject===subject)
 const before = await entries()
 const response = await call(), body = await response.clone().json()
 assert.ok(response.status >= 400 && response.status < 500)
 const after = await entries()
 assert.equal(after.length,before.length+1,'one attributable refusal is retained')
 const matches = e=>e.actor_kind===actor.kind && e.actor_name===actor.name && e.reason===body.error
 const matching = after.filter(matches)
 assert.equal(matching.length,before.filter(matches).length+1,'the audit names the credential or owner and refusal reason')
 assert.ok(matching.every(e=>e.source==='product' && e.outcome==='refused' && Number.isFinite(Date.parse(e.at))))
 if(actor.id) assert.ok(matching.some(e=>e.revision==='agent-token:'+actor.id),'credential identity is visible without its secret')
 const text=JSON.stringify(after)
 assert.ok(!text.includes(credential.token) && !text.includes(createHash('sha256').update(credential.token).digest('hex')))
 return response
}
const refusedAgent = (path, body, extra={}) => refusedAudit(path,()=>agent(path,body,undefined,extra),{kind:'token',name:credential.grant.label,id:credential.grant.id,method:body===undefined?'GET':'POST'})
const input=extra=>({reviewer_label:'Audit agent proposal',period_from:'2026-10-11',period_to:'2026-10-11',expires_at:'2026-10-20T12:00:00Z',control_ids:[control.control_id],...extra})
const prepare=async(extra={})=>{const r=await agent('/api/agent/prepare-folder',input(extra));assert.equal(r.status,201);return (await r.json()).proposal}
const upload=async()=>{
 const form=new FormData();for(const [k,v] of Object.entries({source:'Observed manually',covered_from:'2026-10-11',covered_to:'2026-10-11'}))form.set(k,v)
 form.set('file',new File(['Real retained evidence bytes'],'proof.txt',{type:'text/plain'}))
 const r=await app.fetch('/app/requirements/'+control.id+'/uploads',{method:'POST',headers:{origin:app.origin},body:form});assert.equal(r.status,303)
 return (await app.fetch(r.headers.get('location').replace('/app/','/api/'))).json()
}
try {
 await scenario('Only owner sessions grant access and bearer access has no owner authority',async()=>{
  assert.equal((await app.fetch('/app/agent')).status,401)
  assert.equal((await owner('/api/agent/tokens',{label:'Build agent',expires_at:'2026-10-20T00:00:00Z'})).status,401)
  ownerCookie=await app.signin()
  const created=await owner('/api/agent/tokens',{label:'Build agent',expires_at:'2026-10-20T00:00:00Z'});assert.equal(created.status,201);credential=await created.json()
  const stored=await app.db.prepare('SELECT * FROM agent_tokens WHERE id=?').bind(credential.grant.id).first()
  assert.equal(stored.token_hash,createHash('sha256').update(credential.token).digest('hex'))
  assert.ok(!JSON.stringify(stored).includes(credential.token))
  const listing=await (await app.fetch('/api/agent')).text();assert.ok(!listing.includes(credential.token));assert.ok(!listing.includes(stored.token_hash))
  assert.equal((await refusedAgent('/api/agent/tokens',{label:'Escalation'},{cookie:ownerCookie,origin:app.origin})).status,403)
  for(const path of ['/api/folders','/app/folders'])assert.equal((await refusedAgent(path,{},{cookie:ownerCookie,origin:app.origin})).status,403)
  assert.equal((await refusedAgent('/api/archive/export',undefined,{cookie:ownerCookie})).status,403)
  assert.equal((await app.fetch('/api/agent',{headers:{origin:'https://foreign.test'}})).status,403)
 })
 await scenario('Agent inspection reports missing then verified and unavailable bytes without private storage fields',async()=>{
  const r=await app.fetch('/app/controls',{method:'POST',headers:{origin:app.origin,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({name:'Agent audit control',group:'Access',proof:'Access review proof',cadence:'daily'})});assert.equal(r.status,303)
  control=(await (await app.fetch('/api/desk')).json()).requirements.find(row=>r.headers.get('location').endsWith(row.id))
  let desk=await (await agent('/api/agent/desk')).json();assert.equal(desk.requirements.find(row=>row.id===control.id).gap,'missing')
  receipt=await upload();desk=await (await agent('/api/agent/desk')).json();assert.equal(desk.requirements.find(row=>row.id===control.id).gap,'covered')
  const text=JSON.stringify(desk);for(const value of [receipt.object_key,receipt.added_by,'object_key','added_by_name','token_hash'])assert.ok(!text.includes(value))
  await (await app.mf.getR2Bucket('EXHIBITS')).delete(receipt.object_key)
  desk=await (await agent('/api/agent/desk')).json();assert.equal(desk.requirements.find(row=>row.id===control.id).gap,'unavailable bytes')
  await (await app.mf.getR2Bucket('EXHIBITS')).put(receipt.object_key,'Real retained evidence bytes')
 })
 await scenario('AGENT-001 and LOG-001: prepare a scoped proposal, approve its exact snapshot or reject it, and retain the scoped decision and audit',async()=>{
  {
  const before=(await (await app.fetch('/api/folders')).json()).folders.length
  proposal=await prepare()
  assert.equal(proposal.snapshot.requirements.length,1);assert.equal(proposal.snapshot.requirements[0].control_id,control.control_id)
  assert.equal(proposal.snapshot.requirements[0].gap,'covered');assert.equal(proposal.snapshot.requirements[0].receipts[0].id,receipt.id)
  assert.equal((await (await app.fetch('/api/folders')).json()).folders.length,before)
  const digest=createHash('sha256').update(JSON.stringify({input:proposal.input,snapshot:proposal.snapshot})).digest('hex');assert.equal(proposal.snapshot_hash,digest)
  assert.equal((await agent('/api/agent/prepare-folder',input({control_ids:['unknown']}))).status,400)
  const html=await (await app.fetch('/app/agent/proposals/'+proposal.id)).text();assert.ok(html.includes(proposal.snapshot_hash))
  await (await app.mf.getR2Bucket('EXHIBITS')).delete(receipt.object_key)
  const retained=await (await app.fetch('/api/agent/proposals/'+proposal.id)).json();assert.equal(retained.proposal.snapshot.requirements[0].gap,'covered')
  assert.equal((await owner('/api/agent/proposals/'+proposal.id+'/approve',{snapshot_hash:proposal.snapshot_hash})).status,409)
  proposal=await prepare()
  }
  {
  const path='/api/agent/proposals/'+proposal.id+'/approve'
  for(const extra of [{},{cookie:ownerCookie,origin:app.origin}])assert.equal((await refusedAgent(path,{snapshot_hash:proposal.snapshot_hash},extra)).status,403)
  assert.equal((await owner(path,{snapshot_hash:'0'.repeat(64)})).status,409)
  const count=async()=>Number((await app.db.prepare('SELECT COUNT(*) AS n FROM review_folders').first()).n),before=await count()
  const answers=await Promise.all([owner(path,{snapshot_hash:proposal.snapshot_hash}),owner(path,{snapshot_hash:proposal.snapshot_hash})]);assert.deepEqual(answers.map(r=>r.status).sort(),[201,409]);assert.equal(await count(),before+1)
  const approved=await answers.find(r=>r.status===201).json();assert.equal(approved.decision.actor_name,'Evidence owner');assert.equal(approved.decision.snapshot_hash,proposal.snapshot_hash)
  const decided=(await (await app.fetch('/api/audit?action=agent.proposal-approved')).json()).entries.filter(e=>e.subject==='proposal:'+proposal.id)
  assert.deepEqual(decided.map(e=>[e.actor_name,e.outcome,e.revision]),[['Evidence owner','succeeded','snapshot '+proposal.snapshot_hash.slice(0,16)]])
  const viewer=await app.fetch(new URL(approved.review_url).pathname+'/exhibits',{headers:{cookie:''}});assert.equal(viewer.status,200);assert.equal((await viewer.json()).requirements[0].gap,'unavailable bytes')
  const persisted=await (await app.fetch('/api/agent/proposals/'+proposal.id)).text();assert.ok(!persisted.includes(approved.review_url));assert.ok(!persisted.includes(new URL(approved.review_url).pathname.split('/').at(-1)))
  await assert.rejects(app.db.prepare('UPDATE agent_proposals SET snapshot_hash=? WHERE id=?').bind('a'.repeat(64),proposal.id).run(),/immutable_agent_proposal/)
  await assert.rejects(app.db.prepare('DELETE FROM agent_decisions WHERE proposal_id=?').bind(proposal.id).run(),/retained_agent_decision/)
  }
  {
  const rejected=await prepare();assert.equal((await owner('/api/agent/proposals/'+rejected.id+'/reject',{snapshot_hash:rejected.snapshot_hash})).status,200)
  assert.equal((await owner('/api/agent/proposals/'+rejected.id+'/approve',{snapshot_hash:rejected.snapshot_hash})).status,409)
  const other=await (await owner('/api/agent/tokens',{label:'Another agent',expires_at:'2026-10-20T00:00:00Z'})).json()
  const list=await (await agent('/api/agent/proposals',undefined,other.token)).json();assert.deepEqual(list.proposals,[])
  assert.equal((await agent('/api/agent/proposals/'+proposal.id,undefined,other.token)).status,403)
  }
 })
 await scenario('New in-scope receipts make preparation stale and require a new owner review',async()=>{
  const stale=await prepare(), before=(await (await app.fetch('/api/folders')).json()).folders.length
  await upload()
  const stalePath='/api/agent/proposals/'+stale.id+'/approve'
  const refused=await refusedAudit(stalePath,()=>owner(stalePath,{snapshot_hash:stale.snapshot_hash}),{kind:'owner',name:'Evidence owner'})
  assert.equal(refused.status,409)
  assert.equal((await (await app.fetch('/api/folders')).json()).folders.length,before)
  assert.equal((await (await app.fetch('/api/agent/proposals/'+stale.id)).json()).proposal.decision,null)
  const fresh=await prepare();assert.notEqual(fresh.snapshot_hash,stale.snapshot_hash)
  const approval=await owner('/api/agent/proposals/'+fresh.id+'/approve',{snapshot_hash:fresh.snapshot_hash});assert.equal(approval.status,201)
  const approved=await approval.json()
  await upload()
  const live=await (await app.fetch(new URL(approved.review_url).pathname+'/exhibits',{headers:{cookie:''}})).json()
  assert.equal(live.requirements[0].receipts.length,fresh.snapshot.requirements[0].receipts.length+1)
 })
 await scenario('Revocation and exact expiry stop inspection and preparation',async()=>{
  const revokePath='/api/agent/tokens/'+credential.grant.id+'/revoke';assert.equal((await owner(revokePath,{})).status,200)
  for(const [path,body] of [['/api/agent/desk',undefined],['/api/agent/proposals',undefined],['/api/agent/prepare-folder',input()]])assert.equal((await agent(path,body)).status,401)
  const expiring=await (await owner('/api/agent/tokens',{label:'Short access',expires_at:'2026-10-11T12:01:00Z'})).json()
  assert.equal((await agent('/api/agent/desk',undefined,expiring.token)).status,200)
  await app.clock('2026-10-11T12:01:00Z');assert.equal((await agent('/api/agent/desk',undefined,expiring.token)).status,401)
  await assert.rejects(app.db.prepare('UPDATE agent_tokens SET revoked_at=NULL,revoked_by=NULL WHERE id=?').bind(credential.grant.id).run(),/immutable_agent_token/)
 })
 await scenario('PORTABLE-001 / Public archive round trip retains exact proposals and decisions while closing folders and disabling credentials',async()=>{
  const issued=await owner('/api/agent/tokens',{label:'Portable agent history',expires_at:'2026-10-20T00:00:00Z'});assert.equal(issued.status,201)
  const portable=await issued.json()
  assert.equal((await agent('/api/agent/desk',undefined,portable.token)).status,200)
  const before=await (await app.fetch('/api/agent')).json()
  assert.ok(before.proposals.some(row=>row.decision?.action==='approved'))
  assert.ok(before.proposals.some(row=>row.decision?.action==='rejected'))
  const exported=await app.fetch('/api/archive/export');assert.equal(exported.status,200)
  const bytes=Buffer.from(await exported.arrayBuffer()),metadata=await (await app.fetch('/api/archive/manifest')).text()
  for(const secret of [credential.token,portable.token]) {
   const hash=createHash('sha256').update(secret).digest('hex')
   assert.ok(!bytes.includes(Buffer.from(secret)));assert.ok(!bytes.includes(Buffer.from(hash)))
   assert.ok(!metadata.includes(secret));assert.ok(!metadata.includes(hash))
  }
  assert.ok(!metadata.includes('token_hash'))
  const destination=await runtime()
  try {
   await destination.signin()
   const restored=await destination.fetch('/api/archive/restore',{method:'POST',headers:{origin:destination.origin,'content-type':'application/octet-stream','x-evidence-confirm':'restore', 'x-evidence-erasure-history':'unverified acknowledged'},body:bytes})
   assert.equal(restored.status,200)
   const after=await (await destination.fetch('/api/agent')).json()
   assert.deepEqual(after.proposals,before.proposals)
   assert.deepEqual(after.tokens.map(({credential_present,...row})=>row),before.tokens.map(({credential_present,...row})=>row))
   assert.ok(after.tokens.every(row=>!row.credential_present))
   const folders=(await (await destination.fetch('/api/folders')).json()).folders
   assert.ok(folders.length>0);assert.ok(folders.every(folder=>folder.closed_at))
   for(const row of after.proposals.filter(row=>row.decision?.action==='approved')) {
    const folder=folders.find(folder=>folder.id===row.decision.folder_id);assert.ok(folder)
    assert.deepEqual(folder.control_ids.slice().sort(),row.input.control_ids.slice().sort())
   }
   assert.equal((await destination.fetch('/api/agent/desk',{headers:{cookie:'',authorization:'Bearer '+portable.token}})).status,401)
   assert.equal((await agent('/api/agent/desk',undefined,portable.token)).status,200)
  } finally {await destination.close()}
 })
 await scenario('AGENT-002 / cited period correlation, earlier violations, missing windows, contradictions, unobserved assets, exact rejection and PORTABLE-001 restore',async()=>{await periodAgentJourney(app)})
 console.log(`${passed} agent public-door scenarios passed with native owner sessions and real D1/R2.`)
} catch(error) {
 console.error('FAIL agent scenario: '+active)
 // Assertions can contain secrets; emit stack locations only.
 console.error(String(error.stack||'').split('\n').filter(line=>/^\s+at /.test(line)).join('\n'));process.exitCode=1
} finally {await app.close()}

if(!process.exitCode)await answerJourney()

if(!process.exitCode)await tailoringJourney()
if(!process.exitCode)await interpretationJourney()
