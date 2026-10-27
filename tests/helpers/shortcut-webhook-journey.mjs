// WORK-001: Shortcut v1 network-edge payloads from
// https://developer.shortcut.com/api/webhook/v1 . HTTP doors admit signed
// multi-story batches once; only fresh tracker reads can change state.
import assert from 'node:assert/strict'
import { createHmac, randomUUID } from 'node:crypto'
export async function shortcutWebhookJourney({ app, edge, dest, ticket, linked, remote, detail }) {
 const post=(body,signature)=>app.fetch('/hooks/trackers/'+dest.id,{method:'POST',headers:{cookie:'','content-type':'application/json',...(signature?{'payload-signature':signature}:{})},body})
 const sign=body=>createHmac('sha256','tracker-signing-secret').update(body).digest('hex')
 const group=edge.find('shortcut',linked.remote_id)
 remote.assignee='Dana Lee';group.assignee='Lena Ortiz'
 remote.comments.push({id:'shortcut-batch-comment',author:'Dana Lee',body:'Webhook read-back comment.',at:edge.state.clock})
 const body=JSON.stringify({id:randomUUID(),version:'v1',changed_at:edge.state.clock,actions:[{id:Number(remote.id),entity_type:'story',action:'update',changes:{owner_ids:{adds:['u1']}}},{id:Number(group.id),entity_type:'story',action:'update'},{id:Number(remote.id),entity_type:'story',action:'update'},{id:999,entity_type:'epic',action:'update'}]})
 const before=(await detail()).events,calls=edge.calls.length
 assert.equal((await post(body)).status,401)
 assert.equal((await post(body,'0'.repeat(64))).status,401)
 assert.equal((await post(body+' ',sign(body))).status,401)
 assert.deepEqual((await detail()).events,before);assert.equal(edge.calls.length,calls)
 assert.equal((await post(body,sign(body))).status,202)
 const view=await detail()
 assert.equal(view.tickets.find(t=>t.id===ticket.id).remote_assignee,'Dana Lee')
 assert.equal(view.events.filter(e=>e.kind==='tracker comment'&&e.body==='Webhook read-back comment.').length,1)
 const tracker=await (await app.fetch('/api/trackers/'+dest.id)).json()
 assert.equal(tracker.tickets.find(t=>t.remote_id===linked.remote_id).remote_assignee,'Lena Ortiz')
 const after=edge.calls.length
 assert.equal((await post(body,sign(body))).status,200)
 assert.equal(edge.calls.length,after);assert.deepEqual((await detail()).events,view.events)
 assert.equal(edge.calls.slice(calls).filter(c=>c.path==='/stories/'+remote.id).length,1,'repeated story action was read twice')
 const unrelated=JSON.stringify({id:randomUUID(),version:'v1',actions:[{id:999,entity_type:'epic',action:'update'}]})
 assert.equal((await post(unrelated,sign(unrelated))).status,202);assert.equal(edge.calls.length,after)
 const malformed=JSON.stringify({id:'invalid',actions:[]})
 assert.equal((await post(malformed,sign(malformed))).status,401)
 console.log('PASS WORK-001: Shortcut exact-byte signature, multi-story batch without primary_id, read-back, comments, replay and unrelated-event isolation')
}
