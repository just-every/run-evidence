process.env.RER_SERVER_JOURNEY='1'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { createHmac } from 'node:crypto'
import { runtime } from './helpers/runtime.mjs'
import { trackerFixture, configs } from './helpers/tracker-fixture.mjs'
const require=createRequire(import.meta.url),dependency=createRequire(require.resolve('wrangler/package.json'))
const {unstable_splitSqlQuery}=dependency('wrangler')
const edge=trackerFixture(),app=await runtime({outbound:edge.outbound,migrationThrough:'0046'})
const owner=async(path,body,status=201)=>{const r=await app.fetch(path,{method:'POST',headers:{origin:app.origin,'content-type':'application/json'},body:JSON.stringify(body)});const s=await r.text();assert.equal(r.status,status,path+' '+s);return s?JSON.parse(s):null}
const get=async path=>{const r=await app.fetch(path);assert.equal(r.status,200,path);return r.json()}
const at=async time=>{edge.state.clock=new Date(time).toISOString();await app.clock(edge.state.clock)}
const v1=async(token,method,path,body)=>{const r=await app.fetch(path,{method,headers:{cookie:'',authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify(body)});const text=await r.text();assert.ok([200,201].includes(r.status),text);return JSON.parse(text)}
const hook=(id,body,headers={})=>app.fetch('/hooks/trackers/'+id,{method:'POST',headers:{cookie:'','content-type':'application/json',...headers},body})
const sign=(secret,body)=>createHmac('sha256',secret).update(body).digest('hex')
let passed=0
const scenario=async(name,fn)=>{await fn();passed++;console.log('PASS WORK-001: '+name)}
try {
 await app.signin()
 const push=await owner('/api/api-tokens',{name:'Source',scopes:['resource-push','test-write','read'],expires_at:'2027-04-01'})
 await scenario('provider-admission migration preserves existing destinations, sealed credentials, linked tickets and foreign keys',async()=>{
  const d=await owner('/api/trackers',{provider:'asana',project:'1200',token:edge.keys.asana})
  await v1(push.token,'PUT','/v1/resource-types/legacy',{schema:{fields:{secure:'boolean'}}})
  await v1(push.token,'PUT','/v1/resources/legacy',{resources:[{uniqueId:'old',displayName:'Existing service',attributes:{secure:false}}]})
  const t=await v1(push.token,'POST','/v1/tests',{name:'Existing test',resourceType:'legacy',criteria:[{attribute:'secure',op:'equals',value:true}],cadence:'daily',category:'identity',severity:'high',controls:['AC-05']})
  const o=(await get('/api/remediation')).open.find(o=>o.test_id===t.id)
  const ticket=await owner(`/api/remediation/${o.id}/tickets`,{destination_id:d.id})
  await owner(`/api/remediation/${o.id}/comments`,{body:'Preserve this existing link.'})
  const tables=['tracker_destinations','tickets','ticket_events','ticket_comments'],before={}
  for(const table of tables)before[table]=(await app.db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()).results
  const sql=await readFile('migrations/core/0047_trackers.sql','utf8')
  await app.db.batch(unstable_splitSqlQuery(sql).map(sql=>app.db.prepare(sql)))
  for(const table of tables)assert.deepEqual((await app.db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()).results,before[table],table)
  assert.deepEqual((await app.db.prepare('PRAGMA foreign_key_check').all()).results,[])
  await at(edge.state.clock)
  await owner('/api/tickets/'+ticket.id+'/sync',{},200)
  assert.equal((await get('/api/trackers/'+d.id)).tickets[0].remote_key,ticket.key)
 })
 const person=await owner('/api/people',{name:'Dana Lee',email:'dana@northstar.test',kind:'employee'})
 for(const [provider,c] of Object.entries(configs)) {
  await scenario(`${provider}: authorized project, mapped create, duplicate refusal, source links, two-way comments, status/assignee polling, replay, conflicts, closure re-test and visible failures`,async()=>{
   const countBefore=[...edge.issues.values()].filter(i=>i.provider===provider).length
   const connect={provider,api_base:c.base,project:c.project,account:c.account??'',token:edge.keys[provider],hook_secret:'tracker-signing-secret',assignees:'dana@northstar.test = '+(provider==='shortcut'?'u1':'1')}
   await owner('/api/trackers',{...connect,token:'wrong'},400)
   const dest=await owner('/api/trackers',connect)
   const type='work_'+provider.replaceAll('-','_')
   await v1(push.token,'PUT','/v1/resource-types/'+type,{schema:{fields:{secure:'boolean'}}})
   await v1(push.token,'PUT','/v1/resources/'+type,{resources:['a','b'].map(uniqueId=>({uniqueId,displayName:provider+' '+uniqueId,attributes:{secure:false}}))})
   const test=await v1(push.token,'POST','/v1/tests',{name:provider+' security',resourceType:type,criteria:[{attribute:'secure',op:'equals',value:true}],cadence:'daily',category:'identity',severity:'high',controls:['AC-05']})
   const items=(await get('/api/remediation')).open.filter(o=>o.test_id===test.id)
   assert.equal(items.length,2)
   const ob=items.find(o=>o.resource_name===provider+' a'),other=items.find(o=>o.resource_name===provider+' b')
   await owner(`/api/remediation/${ob.id}/assign`,{owner_person_id:person.id,next_action:'Remediate',target_date:'2026-12-01'},200)
   if(provider==='monday')edge.state.rejectComments=true
   const ticket=await owner(`/api/remediation/${ob.id}/tickets`,{destination_id:dest.id})
   if(provider==='monday')edge.state.rejectComments=false
   await owner(`/api/remediation/${ob.id}/tickets`,{destination_id:dest.id},409)
   const row=(await get('/api/remediation/'+ob.id)).tickets.find(t=>t.id===ticket.id),remote=edge.find(provider,row.remote_id)
   assert.ok(remote,provider);if(provider==='monday')assert.equal(remote.comments.length,0,'item creation must not depend on a second update call');assert.equal([...edge.issues.values()].filter(i=>i.provider===provider).length,countBefore+1)
   assert.match(remote.description,new RegExp('/app/remediation/'+ob.id));assert.match(remote.description,/AC-05/);assert.match(remote.description,/2026-12-01/)
   if(provider!=='asana')assert.equal(remote.priority,c.priority,provider)
   if(!c.textDue)assert.equal(remote.due,'2026-12-01')
   assert.equal(remote.assignee,'Dana Lee')
   await owner(`/api/remediation/${ob.id}/comments`,{body:'Fixing the source.'})
   assert.ok(remote.comments.some(c=>/Evidence owner in Evidence: Fixing the source/.test(c.body)))
   remote.comments.push({id:'remote-note',author:'Dana Lee',body:'Source fix in progress.',at:edge.state.clock})
   if(provider==='freshservice')remote.comments.push({id:'requester-note',author:'Requester',body:'Requester question.',at:edge.state.clock})
   remote.assignee='Lena Ortiz';remote.status=provider==='monday'?'Working':'In Progress'
   const started=Date.parse(edge.state.clock)
   await at(started+10*60000);await app.tick()
   const detail=()=>get('/api/remediation/'+ob.id)
   let view=await detail(),r=view.tickets.find(t=>t.id===ticket.id)
   assert.equal(r.remote_assignee,'Lena Ortiz',provider);assert.ok(r.remote_status)
   assert.ok(Date.parse(r.last_synced_at)-started<=15*60000)
   assert.equal(view.events.filter(e=>e.kind==='tracker comment'&&e.body==='Source fix in progress.').length,1)
   if(provider==='freshservice')assert.ok(view.events.some(e=>e.kind==='tracker comment'&&e.body==='Requester question.'&&e.actor_name.includes('Freshservice user 99')))
   assert.equal(view.events.filter(e=>e.kind==='tracker comment'&&/Fixing the source/.test(e.body)).length,0)
   const events=async()=> (await detail()).events
   const before=await events()
   if(['gitlab','clickup'].includes(provider)) {
    const body=JSON.stringify(provider==='gitlab'?{object_kind:'issue',project:{id:42},object_attributes:{iid:Number(row.remote_id)}}:{webhook_id:'wh-1',task_id:row.remote_id,event:'taskUpdated',history_items:[{id:'evt-1'}]})
    const headers=provider==='gitlab'?{'x-gitlab-token':'tracker-signing-secret','x-gitlab-event-uuid':'evt-1'}:{'x-signature':sign('tracker-signing-secret',body)}
    assert.equal((await hook(dest.id,body,{})).status,401)
    assert.equal((await hook(dest.id,body,headers)).status,202)
    const count=await events();assert.equal((await hook(dest.id,body,headers)).status,200);assert.deepEqual(await events(),count)
   } else {await owner('/api/tickets/'+ticket.id+'/sync',{},200);await owner('/api/tickets/'+ticket.id+'/sync',{},200)}
   assert.deepEqual(await events(),before,'identical read caused duplicate state change')
   if(!c.textDue) {
    remote.due='2026-12-02'
    await owner(`/api/remediation/${ob.id}/assign`,{owner_person_id:person.id,next_action:'Remediate',target_date:'2026-12-03'},200)
    await owner('/api/tickets/'+ticket.id+'/sync',{},200)
    view=await detail();r=view.tickets.find(t=>t.id===ticket.id)
    assert.equal(r.sync_state,'conflict');assert.equal(r.remote_due,'2026-12-02');assert.equal(remote.due,'2026-12-02')
    const conflict=view.events.findLast(e=>e.kind==='ticket conflict');assert.match(conflict.body,/tracker 2026-12-02, Evidence 2026-12-03/);assert.ok(conflict.at)
    await owner('/api/tickets/'+ticket.id+'/resolve',{keep:'evidence'},200);assert.equal(remote.due,'2026-12-03')
   }
   const prior=await detail(),untouched=await get('/api/remediation/'+other.id),closed=Date.parse(edge.state.clock)
   remote.closed=true
   await at(closed+10*60000);await app.tick()
   view=await detail();assert.equal(view.tickets.find(t=>t.id===ticket.id).remote_closed,1);assert.equal(view.obligation.state,'open');assert.equal(view.observations[0].result,'fail');assert.equal(view.observations[0].run_trigger,'retest')
   assert.ok(Date.parse(view.observations[0].observed_at)-closed<=15*60000)
   assert.equal(view.obligation.clock_started_at,prior.obligation.clock_started_at);assert.equal(view.obligation.sla.due,prior.obligation.sla.due)
   assert.deepEqual((await get('/api/remediation/'+other.id)).observations,untouched.observations)
   remote.deleted=true;await owner('/api/tickets/'+ticket.id+'/sync',{},200)
   assert.equal((await detail()).tickets.find(t=>t.id===ticket.id).sync_state,'remote deleted')
   remote.deleted=false
   edge.keys[provider]+='-rotated';await owner('/api/tickets/'+ticket.id+'/sync',{},200)
   assert.equal((await detail()).tickets.find(t=>t.id===ticket.id).sync_state,'authorization lost')
   assert.equal((await get('/api/trackers/'+dest.id)).destination.status,'needs reconnect')
   await owner('/api/trackers/'+dest.id+'/rotate',{token:edge.keys[provider]},200)
   await owner('/api/tickets/'+ticket.id+'/sync',{},200)
   assert.equal((await detail()).tickets.find(t=>t.id===ticket.id).sync_state,'linked')
   edge.state.rejectCreate=provider
   await owner(`/api/remediation/${other.id}/tickets`,{destination_id:dest.id},400)
   const failed=(await get('/api/remediation/'+other.id)).tickets.find(t=>t.destination_id===dest.id)
   assert.equal(failed.sync_state,'mapping failed');assert.match(failed.sync_error,/mapping/i)
   assert.equal([...edge.issues.values()].filter(i=>i.provider===provider).length,countBefore+1)
   edge.state.rejectCreate=null
   const second=await owner(`/api/remediation/${other.id}/tickets`,{destination_id:dest.id})
   assert.equal(second.id,failed.id);assert.equal([...edge.issues.values()].filter(i=>i.provider===provider).length,countBefore+2)
   // WORK-002 / REMEDY-002 inheritance: whole-test tickets carry both
   // item deadlines, re-test each item and reopen naming only the failed item.
   const groupType=type+'_group',resources=['fixed','still_bad'].map(uniqueId=>({uniqueId,displayName:provider+' '+uniqueId,attributes:{secure:false}}))
   await v1(push.token,'PUT','/v1/resource-types/'+groupType,{schema:{fields:{secure:'boolean'}}})
   await v1(push.token,'PUT','/v1/resources/'+groupType,{resources})
   const groupTest=await v1(push.token,'POST','/v1/tests',{name:provider+' grouped',resourceType:groupType,criteria:[{attribute:'secure',op:'equals',value:true}],cadence:'daily',category:'identity',severity:'high',controls:['AC-05']})
   await owner(`/api/tests/${groupTest.id}/ticket-settings`,{destination_id:dest.id,granularity:'test',auto_create:'on',follow_up:'reopen'},200)
   const group=await owner(`/api/tests/${groupTest.id}/tickets`,{});assert.equal(group.items,2)
   const groupItems=(await get('/api/remediation')).open.filter(o=>o.test_id===groupTest.id)
   const linked=(await get('/api/remediation/'+groupItems[0].id)).tickets[0],groupRemote=edge.find(provider,linked.remote_id)
   for(const item of groupItems)assert.ok(groupRemote.description.includes(item.resource_name+': remediate by '+item.sla.due.slice(0,10)))
   resources[0].attributes.secure=true;await v1(push.token,'PUT','/v1/resources/'+groupType,{resources})
   groupRemote.closed=true;const closedAt=Date.parse(edge.state.clock)
   await at(closedAt+10*60000);await app.tick()
   assert.equal(groupRemote.closed,false,provider+' whole-test ticket was not reopened: '+(await get('/api/trackers/'+dest.id)).destination.last_error)
   assert.match(groupRemote.comments.at(-1).body,/Re-test still fails for:/)
   assert.ok(groupRemote.comments.at(-1).body.includes(provider+' still_bad'));assert.ok(!groupRemote.comments.at(-1).body.includes(provider+' fixed'))
   const groupView=await get('/api/tests/'+groupTest.id)
   assert.equal(groupView.runs.filter(r=>r.trigger==='retest').length,1)
   assert.equal(groupView.runs.find(r=>r.trigger==='retest').population,2)
   const states=await Promise.all(groupItems.map(o=>get('/api/remediation/'+o.id)))
   for(const view of states){assert.equal(view.obligation.state,view.obligation.resource_name===provider+' fixed'?'verified':'open');assert.equal(view.observations[0].run_trigger,'retest')}
   const publicData=JSON.stringify(await get('/api/trackers'))+JSON.stringify(await detail())
   assert.ok(!publicData.includes(edge.keys[provider]));assert.ok(!publicData.includes('tracker-signing-secret'))
   if(provider==='asana') {
    edge.state.handshake=async(target,secret)=>{const u=new URL(target);return app.fetch(u.pathname+u.search,{method:'POST',headers:{cookie:'','x-hook-secret':secret},body:''})}
    assert.equal((await app.fetch(`/api/trackers/${dest.id}/asana-webhook`,{method:'POST',headers:{cookie:'',origin:app.origin,'content-type':'application/json'},body:'{}'})).status,401)
    assert.equal((await hook(dest.id,'',{'x-hook-secret':'attacker'})).status,401)
    await owner('/api/trackers/'+dest.id+'/asana-webhook',{},201)
    assert.equal((await hook(dest.id,'',{'x-hook-secret':'replacement'})).status,401)
    remote.closed=false;remote.assignee='Dana Lee'
    const payload=JSON.stringify({events:[{resource:{gid:remote.id,resource_type:'task'},action:'changed',created_at:edge.state.clock}]})
    assert.equal((await hook(dest.id,payload,{'x-hook-signature':'0'.repeat(64)})).status,401)
    const headers={'x-hook-signature':sign('asana-provider-secret',payload)}
    assert.equal((await hook(dest.id,payload,headers)).status,202)
    assert.equal((await detail()).tickets.find(t=>t.id===ticket.id).remote_assignee,'Dana Lee')
    const before=await events();assert.equal((await hook(dest.id,payload,headers)).status,200);assert.deepEqual(await events(),before)
    await owner('/api/trackers/'+dest.id+'/asana-webhook',{},409)
    const unregistered=await owner('/api/trackers',{provider:'asana',project:'1200',token:edge.keys.asana})
    edge.state.rejectRegistration=true
    await owner('/api/trackers/'+unregistered.id+'/asana-webhook',{},502)
    assert.equal((await get('/api/trackers/'+unregistered.id)).destination.has_webhook_secret,false)
    edge.state.rejectRegistration=false
    await owner('/api/trackers/'+unregistered.id+'/asana-webhook',{},201)
    const batch=JSON.stringify({events:[{resource:{gid:remote.id,resource_type:'task'},action:'changed'},{resource:{gid:linked.remote_id,resource_type:'task'},action:'changed'}]})
    assert.equal((await hook(dest.id,batch,{'x-hook-signature':sign('asana-provider-secret',batch)})).status,202)
    remote.comments.push({id:'asana-story',author:'Dana Lee',body:'Asana parent-task comment.',at:edge.state.clock})
    const story=JSON.stringify({events:[{resource:{gid:'asana-story',resource_type:'story'},parent:{gid:remote.id,resource_type:'task'},action:'added'}]})
    assert.equal((await hook(dest.id,story,{'x-hook-signature':sign('asana-provider-secret',story)})).status,202)
    assert.equal((await detail()).events.filter(e=>e.kind==='tracker comment'&&e.body==='Asana parent-task comment.').length,1)
    const heartbeat=JSON.stringify({events:[]})
    assert.equal((await hook(dest.id,heartbeat,{'x-hook-signature':sign('asana-provider-secret',heartbeat)})).status,202)

   }
  })
 }
 await scenario('all new providers and Asana signatures restore inactive without credentials or replayed source operations',async()=>{
  const response=await app.fetch('/api/archive/export');assert.equal(response.status,200)
  const bytes=Buffer.from(await response.arrayBuffer())
  for(const secret of [...Object.values(edge.keys),'tracker-signing-secret','asana-provider-secret'])assert.ok(!bytes.includes(secret))
  const target=await runtime({outbound:edge.outbound})
  try {
   await target.signin()
   const r=await target.fetch('/api/archive/restore',{method:'POST',headers:{origin:target.origin,'content-type':'application/octet-stream','x-evidence-confirm':'restore','x-evidence-erasure-history':'unverified acknowledged'},body:bytes})
   assert.equal(r.status,200,await r.clone().text())
   for(const table of ['tickets','ticket_events','ticket_comments','tracker_deliveries','ticket_groups'])assert.deepEqual((await target.db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()).results,(await app.db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()).results,table)
   const destinations=(await target.db.prepare('SELECT provider,status,secret_ciphertext,hook_ciphertext FROM tracker_destinations').all()).results
   for(const d of destinations){assert.equal(d.status,'inactive after restore');assert.equal(d.secret_ciphertext,null);assert.equal(d.hook_ciphertext,null)}
   for(const p of Object.keys(configs))assert.ok(destinations.some(d=>d.provider===p))
   const calls=edge.calls.length;await target.tick();assert.equal(edge.calls.length,calls)
  } finally {await target.close()}
 })
 console.log(`${passed} WORK-001 tracker journeys passed.`)
} finally {await app.close()}
