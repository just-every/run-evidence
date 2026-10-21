// WORK-001: the original signed callback paths share the all-destination matrix.
import assert from 'node:assert/strict'
import { createHmac, randomUUID } from 'node:crypto'
export async function originalWebhookJourney({app,edge,provider,dest,remote,detail}) {
 if(!['vector','jira','linear','github'].includes(provider))return
 const sign=(key,value)=>createHmac('sha256',key).update(value).digest('hex')
 let body,headers
 if(provider==='vector') {
  body=JSON.stringify({identifier:remote.id})
  const timestamp=String(Math.floor(Date.parse(edge.state.clock)/1000)),id=randomUUID()
  headers={'webhook-id':id,'webhook-tenant':'ws-1','webhook-destination':'dst-1','webhook-event':'issue.updated','webhook-timestamp':timestamp,'webhook-signature':'v1='+sign(Buffer.from('ab'.repeat(32),'hex'),JSON.stringify(['integrations.webhook.v1','ws-1','dst-1','issue.updated',id,timestamp,body]))}
 } else if(provider==='jira') {
  body=JSON.stringify({webhookEvent:'jira:issue_updated',issue:{key:remote.id}})
  headers={'x-atlassian-webhook-identifier':randomUUID(),'x-hub-signature':'sha256='+sign(dest.webhook.secret,body)}
 } else if(provider==='github') {
  body=JSON.stringify({action:'edited',repository:{full_name:'northstar/web'},issue:{number:Number(remote.id),state:'closed',assignee:{login:'payload-forgery'}}})
  headers={'x-github-delivery':randomUUID(),'x-hub-signature-256':'sha256='+sign(dest.webhook.secret,body)}
 } else {
  body=JSON.stringify({type:'Issue',webhookTimestamp:Date.parse(edge.state.clock),data:{id:remote.id}})
  headers={'linear-delivery':randomUUID(),'linear-signature':sign('tracker-signing-secret',body)}
 }
 const post=h=>app.fetch('/hooks/trackers/'+dest.id,{method:'POST',headers:{cookie:'','content-type':'application/json',...h},body})
 const before=edge.calls.length
 assert.equal((await post({})).status,401);assert.equal(edge.calls.length,before)
 remote.assignee='Dana Lee';remote.closed=false
 assert.equal((await post(headers)).status,202)
 const after=await detail(),calls=edge.calls.length
 assert.equal(after.tickets.find(t=>t.destination_id===dest.id).remote_assignee,'Dana Lee')
 remote.assignee='Lena Ortiz'
 const replay=await post(headers);assert.equal(replay.status,200);assert.deepEqual(await replay.json(),{duplicate:true})
 assert.equal(edge.calls.length,calls);assert.deepEqual((await detail()).events,after.events)
 assert.equal((await detail()).tickets.find(t=>t.destination_id===dest.id).remote_assignee,'Dana Lee')
 console.log('PASS WORK-001: '+provider+' signed callback read-back and exact replay without later source admission')
}
