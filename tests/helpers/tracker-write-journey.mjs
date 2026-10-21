// WORK-001 C: one owner HTTP flow per provider, with fakes only at its network
// boundary. The same D1/auth/sync/re-test paths run as the application uses.
import assert from 'node:assert/strict'
import { configs } from './tracker-matrix.mjs'
import { assertNativeFieldsWrite } from './native-fields-journey.mjs'
const agentTokens=new WeakMap()
const mutation=c=>!['GET','HEAD'].includes(c.method)&&(!['linear','monday'].includes(c.provider)||c.body?.query?.includes('mutation'))
export async function trackerWriteJourney({provider,app,owner,get,remote,ticket,destination,edge,person,config}) {
 const path='/api/tickets/'+ticket.id+'/fields',write=configs[provider].write
 const mapping={...config,assignees:person.email+' = '+write.assignee+'\nlena@northstar.test = '+write.otherAssignee,statuses:'open = '+write.open+'\nworking = '+write.working+'\ndone = '+write.done}
 await owner('/api/trackers/'+destination.id+'/mapping',mapping,200)
 const original={closed:remote.closed,status:remote.status,assignee:remote.assignee},initial=await get(path)
 const snapshot=r=>({status_id:r.remote.status_id,assignee_ids:r.remote.assignee_ids===null?null:[...r.remote.assignee_ids].sort()})
 assert.equal(initial.snapshot,JSON.stringify(snapshot(initial)),provider+' canonical identity snapshot')
 assert.deepEqual(snapshot(initial),edge.fieldState(provider,remote),provider+' native read identities')
 const detail=()=>get('/api/remediation/'+initial.ticket.obligation_id)
 const before=await detail()
 const request={snapshot:initial.snapshot,assignee:'lena@northstar.test',status:'working',reason:'Owner assigns the mapped responder and working state.'}
 // Private field endpoints must refuse absent owner authority and foreign origin
 // before reaching any provider. Agent tokens have no owner session authority.
 if(!agentTokens.has(app))agentTokens.set(app,(await owner('/api/api-tokens',{name:'Tracker field agent authority check',scopes:['read'],expires_at:'2027-04-01'})).token)
 const beforeRefused=edge.fieldCalls.length
 for(const [headers,status] of [[{cookie:''},401],[{cookie:'',authorization:'Bearer '+agentTokens.get(app)},403],[{origin:'https://outside.example.test'},403]]) {
  const r=await app.fetch(path,{method:'POST',headers:{origin:app.origin,'content-type':'application/json',...headers},body:JSON.stringify(request)})
  assert.equal(r.status,status,provider+' field authority refusal '+await r.text())
 }
 assert.equal(edge.fieldCalls.length,beforeRefused,'authority refusal must happen before provider access')
 await owner(path,{...request,assignee:'unmapped@northstar.test'},400)
 await owner(path,{...request,status:'unmapped-state'},400)
 assert.equal(edge.fieldCalls.length,beforeRefused,'unmapped identities must be refused before provider access')
 const start=edge.fieldCalls.length
 await owner(path,request,200)
 assertNativeFieldsWrite({provider,calls:edge.fieldCalls.slice(start),assignee:write.otherAssignee,status:write.working})
 let readback=await get(path)
 assert.deepEqual(snapshot(readback),{status_id:write.working,assignee_ids:[write.otherAssignee]},provider+' confirms mapped native identities')
 const observed=await detail()
 assert.equal(observed.obligation.state,'open','an edited tracker field cannot verify a failed control')
 assert.deepEqual(observed.observations,before.observations,'working/assignee writes do not fabricate a control observation')
 const page=await app.fetch('/app/remediation/'+initial.ticket.obligation_id)
 assert.equal(page.status,200)
 assert.match(await page.text(),/Owner assigns the mapped responder/)
 if(provider==='vector') {
  const unchanged=edge.fieldState(provider,remote)
  edge.state.unconfirmedFields=provider
  try {await owner(path,{snapshot:readback.snapshot,assignee:person.email,status:'done',reason:'Provider acknowledgement requires native readback confirmation.'},502)}
  finally {edge.state.unconfirmedFields=null}
  assert.deepEqual(edge.fieldState(provider,remote),unchanged,'unconfirmed provider response did not change native identities')
  const uncertain=await detail()
  assert.equal(uncertain.tickets.find(t=>t.id===ticket.id).sync_state,'field write uncertain')
  assert.match(uncertain.tickets.find(t=>t.id===ticket.id).sync_error,/did not confirm/)
  assert.deepEqual(uncertain.observations,observed.observations,'unconfirmed closure must not claim a control observation')
 }
 // The owner closing a tracker still runs the actual failed control again.
 await owner(path,{snapshot:readback.snapshot,status:'done',reason:'Owner closes the tracker; Evidence must re-test the failed control.'},200)
 const pending=await detail()
 assert.equal(pending.tickets.find(t=>t.id===ticket.id).remote_closed,1,provider+' remote close observed')
 assert.equal(pending.obligation.state,'awaiting verification',provider+' closure awaits an actual re-test')
 assert.equal((await app.tick()).outcome,'ok')
 const closed=await detail()
 assert.equal(closed.obligation.state,'open',provider+' tracker closure must never verify a failed control')
 assert.equal(closed.observations[0].result,'fail')
 assert.equal(closed.observations[0].run_trigger,'retest')
 readback=await get(path)
 await owner(path,{snapshot:readback.snapshot,status:'working',assignee:person.email,reason:'Owner reopens failed work.'},200)
 const stale=await get(path)
 // Another tracker user edits both native fields after the displayed snapshot.
 remote.closed=true;remote.assignee='Lena Ortiz'
 const current=edge.fieldState(provider,remote),intended={assignee:write.assignee,status:write.working}
 const callCount=edge.fieldCalls.length,reason='Preserve both values when the remote changes after my read.'
 const {details:refusal}=await owner(path,{snapshot:stale.snapshot,assignee:person.email,status:'working',reason},409)
 assert.deepEqual(edge.fieldState(provider,remote),current,provider+' conflict preserves remote fields')
 assert.equal(edge.fieldCalls.slice(callCount).filter(mutation).length,0,provider+' conflict must emit no provider mutations')
 assert.deepEqual(JSON.parse(refusal.tracker),current,'conflict preserves both remote field values')
 assert.deepEqual(JSON.parse(refusal.evidence),intended,'conflict preserves both requested native values')
 assert.ok(refusal.at&&Number.isFinite(Date.parse(refusal.at)),'conflict preserves its time')
 const history=await (await app.fetch('/app/remediation/'+initial.ticket.obligation_id)).text()
 const escaped=value=>value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;')
 for(const value of [JSON.stringify(current),JSON.stringify(intended),reason,refusal.at.slice(0,16).replace('T',' ')])assert.ok(history.includes(escaped(value)),provider+' conflict history preserves '+value)
 // Restore through the same public owner door so the remaining provider
 // synchronization, callbacks, archive and credential journeys retain baseline.
 const fresh=await get(path)
 await owner(path,{snapshot:fresh.snapshot,status:original.closed?'done':'open',assignee:person.email,reason:'Restore initial tracker fields after the owner write journey.'},200)
 assert.equal(remote.closed,original.closed)
 assert.equal(remote.assignee,original.assignee)
 await owner('/api/trackers/'+destination.id+'/mapping',config,200)
}
