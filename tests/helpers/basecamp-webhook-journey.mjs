// WORK-001: Basecamp official webhook schema, faked only at the network edge.
import assert from 'node:assert/strict'
export async function basecampWebhookJourney({app,edge,dest,ticket,remote,detail,owner,get,at,tick,cookie}) {
 const path='/api/trackers/'+dest.id+'/basecamp-webhook'
 const request=(p,body={},headers={})=>app.fetch(p,{method:'POST',headers:{cookie:'',origin:app.origin,'content-type':'application/json',...headers},body:JSON.stringify(body)})
 const before=edge.calls.length
 assert.equal((await request(path)).status,401)
 assert.equal(edge.calls.length,before)
 assert.equal((await request(path,{}, {cookie,origin:'https://foreign.example.test'})).status,403)
 await owner(path,{},201)
 const registration=[...edge.state.basecampHooks.values()].at(-1),url=new URL(registration.payload_url),secret=url.searchParams.get('secret'),callback=url.pathname+url.search
 assert.equal(secret.length,64)
 const sealed=await app.db.prepare('SELECT hook_ciphertext,hook_iv,hook_audience FROM tracker_destinations WHERE id=?').bind(dest.id).first()
 assert.ok(sealed.hook_ciphertext&&!sealed.hook_ciphertext.includes(secret)&&sealed.hook_iv)
 await owner(path,{},409)
 const payload=(id,record={})=>({id,kind:'todo_assignment_changed',created_at:edge.state.clock,recording:{id:Number(remote.id),type:'Todo',bucket:{id:200},url:`https://3.basecampapi.com/100/buckets/200/todos/${remote.id}.json`,...record}})
 let calls=edge.calls.length
 assert.equal((await request(url.pathname,payload(900))).status,401)
 assert.equal((await request(url.pathname+'?secret='+'0'.repeat(64),payload(900))).status,401)
 assert.equal((await request(callback+'&secret='+secret,payload(900))).status,401)
 assert.equal((await request(callback,payload(900,{bucket:{id:999}}))).status,401)
 assert.equal((await request(callback,payload(900,{url:`https://3.basecampapi.com/999/buckets/200/todos/${remote.id}.json`}))).status,401)
 assert.equal(edge.calls.length,calls)
 remote.closed=false;remote.assignee='Dana Lee'
 assert.equal((await request(callback,payload('9007199254741210'))).status,202)
 assert.equal((await detail()).tickets.find(t=>t.id===ticket.id).remote_assignee,'Dana Lee')
 const admitted=await detail();calls=edge.calls.length;remote.assignee='Lena Ortiz'
 assert.equal((await request(callback,payload('9007199254741210'))).status,200)
 assert.equal(edge.calls.length,calls);assert.deepEqual((await detail()).events,admitted.events)
 // Decimal event identities beyond JS safe integers retain their exact spelling.
 const raw=JSON.stringify(payload('9007199254741211')).replace('"9007199254741211"','9007199254741211')
 assert.equal((await app.fetch(callback,{method:'POST',headers:{cookie:'','content-type':'application/json'},body:raw})).status,202)
 assert.equal((await detail()).tickets.find(t=>t.id===ticket.id).remote_assignee,'Lena Ortiz')
 remote.comments.push({id:'basecamp-note',author:'Dana Lee',body:'Basecamp callback comment text.',at:edge.state.clock})
 const comment=payload(902,{id:9902,type:'Comment',url:'https://3.basecampapi.com/100/buckets/200/comments/9902.json',parent:{id:Number(remote.id),type:'Todo',url:`https://3.basecampapi.com/100/buckets/200/todos/${remote.id}.json`}})
 assert.equal((await request(callback,comment)).status,202)
 assert.equal((await detail()).events.filter(e=>e.kind==='tracker comment'&&e.body==='Basecamp callback comment text.').length,1)
 // Provider closure is only a fresh read and queued test, never proof of a fix.
 remote.closed=true
 assert.equal((await request(callback,payload(903))).status,202)
 await tick()
 assert.equal((await detail()).obligation.state,'open')
 assert.ok((await detail()).observations.some(o=>o.run_trigger==='retest'&&o.result==='fail'))
 const checks=()=>edge.calls.filter(c=>c.provider==='basecamp'&&c.path===`/100/webhooks/${registration.id}.json`).length
 const start=Date.parse(edge.state.clock),initial=checks()
 await at(start+59*60000);await tick();assert.equal(checks(),initial)
 await at(start+60*60000);await tick();assert.equal(checks(),initial+1)
 // Provider's automatic deactivation is visible and removes callback authority.
 registration.active=false
 await at(start+120*60000);await tick();assert.equal(checks(),initial+2)
 const d=(await get('/api/trackers/'+dest.id)).destination
 assert.equal(d.has_webhook_secret,false);assert.equal(d.status,'active');assert.equal(d.hook_audience,'basecamp-disabled')
 const page=await app.fetch('/app/trackers/'+dest.id);assert.match(await page.text(),/Deactivated, changed or unavailable/)
 assert.equal((await request(callback,payload(904))).status,404)
 // Polling continues after deactivation and reflects new source state.
 remote.assignee='Dana Lee';await at(start+130*60000);await tick()
 assert.equal((await detail()).tickets.find(t=>t.id===ticket.id).remote_assignee,'Dana Lee')
 edge.state.rejectBasecampRegistration=true
 const failure=await request(path,{}, {cookie});assert.equal(failure.status,502)
 assert.ok(!(await failure.text()).includes('?secret='))
 edge.state.rejectBasecampRegistration=false
 await owner(path,{},201)
 const next=[...edge.state.basecampHooks.values()].at(-1),nextSecret=new URL(next.payload_url).searchParams.get('secret')
 assert.notEqual(nextSecret,secret)
 assert.equal((await request(callback,payload(905))).status,401)
 // A credential and callback for another destination cannot admit this event.
 const second=await owner('/api/trackers',{provider:'basecamp',project:'100/200/300',token:edge.keys.basecamp})
 await owner('/api/trackers/'+second.id+'/basecamp-webhook',{},201)
 const secondUrl=new URL([...edge.state.basecampHooks.values()].at(-1).payload_url)
 assert.notEqual(secondUrl.searchParams.get('secret'),nextSecret)
 assert.equal((await request(secondUrl.pathname+'?secret='+nextSecret,payload(908))).status,401)
 await owner('/api/trackers/'+second.id+'/revoke',{},200)
 assert.equal((await request(secondUrl.pathname+secondUrl.search,payload(909))).status,404)
 // Restart keeps sealed authority and replay history; no registration is replayed.
 await app.clock(edge.state.clock)
 const nextUrl=new URL(next.payload_url)
 assert.equal((await request(nextUrl.pathname+nextUrl.search,payload(906))).status,202)
 assert.equal((await request(nextUrl.pathname+nextUrl.search,payload(906))).status,200)
 const publicBytes=JSON.stringify(await get('/api/trackers'))+JSON.stringify(await detail())+await (await app.fetch('/app/trackers/'+dest.id)).text()+await (await app.fetch('/api/audit/export?format=json')).text()
 for(const value of [secret,nextSecret,registration.payload_url,next.payload_url])assert.ok(!publicBytes.includes(value))
 console.log('PASS WORK-001: Basecamp registered sealed secret address, account/project boundaries, todo/comment readback, event replay, closure retest, hourly deactivation, polling backstop, failed registration, restart and secret exclusion')
}
