// WORK-001. Fakes are only the provider network edge shared with trackers.mjs.
// Each event prompts an authorized source read; payload state is never trusted.
// Azure: https://learn.microsoft.com/en-us/azure/devops/service-hooks/events
// monday: https://developer.monday.com/api-reference/reference/webhooks
// Freshservice: https://support.freshservice.com/support/solutions/articles/157143-using-webhooks-with-the-workflow-automator
// YouTrack: https://www.jetbrains.com/help/youtrack/cloud/webhook-triggers.html
import assert from 'node:assert/strict'
import { createHmac, randomUUID } from 'node:crypto'
import { configs } from './tracker-fixture.mjs'
const supported=new Set(['azure-boards','monday','freshservice','youtrack'])
const secret='tracker-signing-secret'
const jwt=(claims,key=secret,header={alg:'HS256',typ:'JWT'})=>{
 const body=Buffer.from(JSON.stringify(header)).toString('base64url')+'.'+Buffer.from(JSON.stringify(claims)).toString('base64url')
 return body+'.'+createHmac('sha256',key).update(body).digest('base64url')
}
export async function providerWebhookJourney({app,edge,provider,dest,ticket,remote,detail,owner}) {
 if(!supported.has(provider))return
 const c=configs[provider],callback=app.origin+'/hooks/trackers/'+dest.id
 let sequence=0
 const packet=({ref=remote.id,project=c.project}={})=>{
  const id=randomUUID(),at=new Date(Date.parse(edge.state.clock)+ ++sequence).toISOString()
  if(provider==='azure-boards')return {id,eventType:'workitem.updated',publisherId:'tfs',resource:{id:Number(ref),rev:2,fields:{'System.TeamProject':project,'System.State':'Done','System.AssignedTo':'Payload attacker'}},resourceContainers:{collection:{baseUrl:c.base+'/'}}}
  if(provider==='monday')return {event:{boardId:Number(project),pulseId:Number(ref),type:'update_column_value',triggerUuid:id,triggerTime:at,columnId:'status1',value:{label:{text:'Done'}}}}
  if(provider==='freshservice')return {ticket_id:ref,group_id:project,event:'Ticket is updated',updated_at:at,status:5,assignee:'Payload attacker'}
  return {event:'issueUpdated',timestamp:at,id:ref,numberInProject:Number(ref),project:{id:project},changedFields:[{name:'State',value:'Fixed'},{name:'Assignee',value:'Payload attacker'}]}
 }
 const headers=(key=secret,overrides={})=>provider==='monday'?{authorization:jwt({aud:callback,iat:Math.floor(Date.parse(edge.state.clock)/1000),exp:Math.floor(Date.parse(edge.state.clock)/1000)+300,...overrides},key)}:provider==='youtrack'?{'x-youtrack-token':key}:{authorization:'Basic '+Buffer.from('evidence:'+key).toString('base64')}
 const post=(body,auth={},id=dest.id)=>app.fetch('/hooks/trackers/'+id,{method:'POST',headers:{cookie:'','content-type':'application/json',...auth},body:typeof body==='string'?body:JSON.stringify(body)})
 const current=async()=> (await detail()).tickets.find(t=>t.id===ticket.id)
 const before=await detail(),calls=edge.calls.length,body=packet()
 assert.equal((await post(body)).status,401)
 assert.equal((await post(body,headers('wrong'))).status,401)
 assert.equal((await post('null',headers())).status,401)
 assert.equal((await post('{',headers())).status,401)
 assert.equal(edge.calls.length,calls)
 assert.deepEqual((await detail()).events,before.events)
 if(provider==='monday') {
  const challenge=await post({challenge:'monday-verification'})
  assert.equal(challenge.status,200);assert.deepEqual(await challenge.json(),{challenge:'monday-verification'})
  assert.equal((await post(body,headers(secret,{aud:callback+'/other'}))).status,401)
  assert.equal((await post(body,headers(secret,{exp:Math.floor(Date.parse(edge.state.clock)/1000)-1}))).status,401)
  assert.equal((await post(body,{authorization:jwt({aud:callback,exp:Math.floor(Date.parse(edge.state.clock)/1000)+300},secret,{alg:'none'})})).status,401)
  assert.equal(edge.calls.length,calls)
 }
 remote.closed=false;remote.assignee='Dana Lee';remote.status=provider==='monday'?'Working':'In Progress'
 remote.comments.push({id:'native-webhook-'+provider,author:'Dana Lee',body:'Source read after '+provider+' webhook.',at:edge.state.clock})
 const response=await post(body,headers())
 assert.equal(response.status,202,await response.text())
 let view=await detail(),row=await current()
 assert.equal(row.remote_assignee,'Dana Lee');assert.equal(row.remote_closed,0)
 assert.equal(row.remote_status,provider==='monday'?'Working':provider==='freshservice'?'2':'In Progress')
 assert.equal(view.events.filter(e=>e.kind==='tracker comment'&&e.body==='Source read after '+provider+' webhook.').length,1)
 assert.ok(!view.events.some(e=>e.body.includes('Payload attacker')))
 const after=edge.calls.length,events=view.events
 remote.assignee='Lena Ortiz'
 const duplicate=await post(body,headers())
 assert.equal(duplicate.status,200);assert.deepEqual(await duplicate.json(),{duplicate:true})
 assert.equal(edge.calls.length,after);assert.deepEqual((await detail()).events,events)
 assert.equal((await current()).remote_assignee,'Dana Lee','replay must not read a later source state')
 assert.equal((await post(packet(),headers())).status,202)
 assert.equal((await current()).remote_assignee,'Lena Ortiz','a distinct source event must be admitted')
 const isolatedCalls=edge.calls.length,isolatedEvents=(await detail()).events
 const wrongScope=await post(packet({project:provider==='azure-boards'?'DifferentProject':provider==='youtrack'?'0-999':'999'}),headers())
 assert.equal(wrongScope.status,202);assert.deepEqual(await wrongScope.json(),{linked:false})
 const unlinked=await post(packet({ref:'999999999'}),headers())
 assert.equal(unlinked.status,202);assert.deepEqual(await unlinked.json(),{linked:false})
 assert.equal(edge.calls.length,isolatedCalls);assert.deepEqual((await detail()).events,isolatedEvents)
 if(owner) {
  const other=await owner('/api/trackers',{provider,api_base:c.base,project:c.project,account:c.account??'',token:edge.keys[provider],hook_secret:secret,due_field:'Custom.RemediationDue'})
  const isolationCalls=edge.calls.length
  const foreign=await post(body,headers(),other.id)
  assert.equal(foreign.status,provider==='monday'?401:202)
  if(provider!=='monday')assert.deepEqual(await foreign.json(),{linked:false})
  assert.equal(edge.calls.length,isolationCalls,'a destination cannot synchronize another destination’s link')
  assert.deepEqual((await detail()).events,isolatedEvents)
 }
 // Azure's update shape carries an update record id separately from workItemId.
 if(provider==='azure-boards') {
  const revision=packet();revision.resource={id:999999,workItemId:Number(remote.id),revision:{fields:{'System.TeamProject':c.project}}}
  remote.assignee='Dana Lee'
  assert.equal((await post(revision,headers())).status,202)
  assert.equal((await current()).remote_assignee,'Dana Lee')
 }
 console.log('PASS WORK-001: '+provider+' native authentication, source state/comment read-back, replay, distinct events and project/destination isolation')
}
