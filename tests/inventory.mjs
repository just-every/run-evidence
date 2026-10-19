process.env.RER_SERVER_JOURNEY='1'
import assert from 'node:assert/strict'
import {runtime} from './helpers/runtime.mjs'
import {preInventoryArchive} from './helpers/portable-format.mjs'
import {inventoryFixture} from './helpers/inventory-fixture.mjs'
const app=await runtime()
let passed=0
const scenario=async(name,fn)=>{await fn();passed++;console.log('PASS '+name)}
const post=async(path,body,status=201)=>{const r=await app.fetch(path,{method:'POST',headers:{origin:app.origin,'content-type':'application/json'},body:JSON.stringify(body)});assert.equal(r.status,status,path+' '+await r.clone().text());return r.json()}
const get=async(path,status=200)=>{const r=await app.fetch(path);assert.equal(r.status,status,path);return r.json()}
const put=async(token,path,body,method='PUT',status=200)=>{const r=await app.fetch(path,{method,headers:{cookie:'',authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify(body)});assert.equal(r.status,status,path+' '+await r.clone().text());return r.json()}
const population=async(kind,source,csv)=>{
 const form=()=>{const f=new FormData();for(const [k,v] of Object.entries({kind,source_system:source,as_of:'2026-10-11',refresh_days:'30'}))f.set(k,v);f.set('file',new File([csv],kind+'.csv'));return f}
 const send=async(f,status)=>{const r=await app.fetch('/api/populations',{method:'POST',headers:{origin:app.origin},body:f});assert.equal(r.status,status,await r.clone().text());return r.json()}
 const dry=await send(form(),200),f=form();f.set('confirm','yes');f.set('sha256',dry.sha256);return send(f,201)
}
let fixture
try {
 await app.signin()
 await scenario('INVENTORY-001: reviewed grouping retains every source row, explicit metadata grants no account or test exclusion, and scope exports reconcile',async()=>{
  fixture=await inventoryFixture({get,post,put,population})
  const initial=await get('/api/inventory')
  assert.equal(initial.people.find(p=>p.id===fixture.unmatched.id).account_status,'no account found')
  assert.equal(initial.people.find(p=>p.id===fixture.person.id).account_status,'account found')
  assert.equal(initial.people.find(p=>p.id===fixture.unmatched.id).manual.length,0,'same name never implies a match')
  assert.equal(initial.unmatched.accounts,1)
  assert.equal(initial.unmatched.devices,1)
  const prior=preInventoryArchive(Buffer.from(await (await app.fetch('/api/archive/export')).arrayBuffer())),oldTarget=await runtime({ownerEmail:'prior-receiver@northstar.test'})
  try {await oldTarget.signin();const response=await oldTarget.fetch('/api/archive/restore',{method:'POST',headers:{origin:oldTarget.origin,'content-type':'application/octet-stream','x-evidence-confirm':'restore','x-evidence-erasure-history':'unverified acknowledged'},body:prior});assert.equal(response.status,200,await response.clone().text());const older=await (await oldTarget.fetch('/api/inventory')).json();assert.deepEqual(older.records,initial.records,'PORTABLE-001 restores the published earlier v10 registry with empty inventory decisions')}finally{await oldTarget.close()}

  for(const kind of ['people','vendors','inventory_service','population.roster','population.accounts','population.devices'])assert.ok(initial.records.some(r=>r.source_type===kind),kind)
  assert.equal(new Set(initial.records.map(r=>r.source_key)).size,initial.records.length)
  assert.equal(initial.counts.source_rows,initial.records.reduce((n,r)=>n+r.source_rows.length,0))
  const devices=initial.records.filter(r=>r.kind==='device'), keys=devices.map(r=>r.source_key)
  assert.equal(devices.length,2);assert.equal(new Set(devices.map(r=>r.canonical_key)).size,2,'matching serials never auto-group')
  await post('/api/inventory/groups',{action:'group',source_keys:keys,reason:'Owner compared both retained device-list rows'})
  const grouped=await get('/api/inventory')
  assert.equal(grouped.counts.records,initial.counts.records);assert.equal(grouped.counts.source_rows,initial.counts.source_rows);assert.equal(grouped.counts.canonical,initial.counts.canonical-1)
  assert.equal(new Set(grouped.records.filter(r=>keys.includes(r.source_key)).map(r=>r.canonical_key)).size,1)
  assert.equal(grouped.records.filter(r=>keys.includes(r.source_key)).reduce((n,r)=>n+r.source_rows.length,0),2)
  const personKeys=initial.records.filter(r=>r.source_type==='people').map(r=>r.source_key)
  await post('/api/inventory/groups',{action:'group',source_keys:personKeys,reason:'Reviewed reporting group; preserve both distinct People identities'})
  assert.equal((await get('/api/people')).people.length,2)
  assert.equal((await get('/api/inventory')).people.find(p=>p.id===fixture.unmatched.id).account_status,'no account found')
  const resource=initial.records.find(r=>r.source_id===fixture.resource.id),before=await get('/api/tests/'+fixture.test.id)
  await post('/api/inventory/decisions',{source_key:resource.source_key,owner_person_id:fixture.unmatched.id,criticality:'critical',scope:'excluded',lifecycle:'retired',reason:'Owner retains this out-of-scope service and its test history'})
  const decision=await get('/api/inventory/record?source_key='+encodeURIComponent(resource.source_key))
  assert.equal(decision.record.owner_person_id,fixture.unmatched.id);assert.equal(decision.record.criticality,'critical');assert.equal(decision.record.scope,'excluded');assert.equal(decision.record.lifecycle,'retired');assert.equal(decision.record.history.decisions.length,1)
  const after=await get('/api/tests/'+fixture.test.id)
  assert.deepEqual(after.latest,before.latest,'inventory scope and retirement never remove test subjects or rewrite failures')
  assert.equal((await get('/api/inventory')).people.find(p=>p.id===fixture.unmatched.id).account_status,'no account found')
  assert.equal(app.messages.filter(m=>m.to?.includes('morgan-unmatched@northstar.test')).length,0,'ownership never invites a login')
  const foreign=await app.fetch('/api/inventory/decisions',{method:'POST',headers:{origin:'https://foreign.test','content-type':'application/json'},body:JSON.stringify({source_key:resource.source_key})});assert.equal(foreign.status,403)
  const tokenOnly=await app.fetch('/api/inventory/decisions',{method:'POST',headers:{origin:app.origin,cookie:'',authorization:'Bearer '+fixture.credential.token,'content-type':'application/json'},body:JSON.stringify({source_key:resource.source_key})});assert.equal(tokenOnly.status,403,'an inventory token grants no owner decision authority')
  await post('/api/inventory/decisions',{source_key:'unknown',reason:'Unknown identity'},404)
  await post('/api/inventory/groups',{action:'group',source_keys:[keys[0],resource.source_key],reason:'Not the same kind'},400)
  const snapshot=await get('/api/inventory'),exported=await get('/api/inventory/export')
  assert.deepEqual(exported.counts,snapshot.counts);assert.deepEqual(exported.records,snapshot.records);assert.deepEqual(exported.history,snapshot.history)
  const csv=await app.fetch('/api/inventory/export?format=csv');assert.equal(csv.status,200);const text=await csv.text();for(const r of snapshot.records)assert.ok(text.includes(r.source_id));assert.match(text,/excluded/);assert.match(text,/retired/);assert.match(text,/Owner compared/)
  await post('/api/inventory/groups',{action:'ungroup',source_keys:[keys[1]],reason:'Owner separated the second device source after review'})
  await population('devices','Operations device register','serial,hostname,owner_email,encrypted\r\nSAME-SERIAL,morgan-laptop-reissued,morgan@northstar.test,yes\r\n')
  const separated=await get('/api/inventory');assert.equal(new Set(separated.records.filter(r=>keys.includes(r.source_key)).map(r=>r.canonical_key)).size,2)
  assert.equal(separated.records.find(r=>r.source_key===keys.find(k=>k.includes('Operations device register'))).source_rows.length,2,'earlier immutable upload row remains alongside its replacement')
  await app.clock('2026-10-11T13:00:00Z');assert.deepEqual((await get('/api/inventory')).history,separated.history,'review history survives Worker restart')
  const archive=await app.fetch('/api/archive/export');assert.equal(archive.status,200);const bytes=await archive.arrayBuffer(),target=await runtime({ownerEmail:'receiver@northstar.test'})
  try {await target.signin();await target.clock('2026-10-11T13:00:00Z');const restored=await target.fetch('/api/archive/restore',{method:'POST',headers:{origin:target.origin,'content-type':'application/octet-stream','x-evidence-confirm':'restore','x-evidence-erasure-history':'unverified acknowledged'},body:bytes});assert.equal(restored.status,200,await restored.clone().text());const recovered=await (await target.fetch('/api/inventory')).json();assert.deepEqual(recovered.records,separated.records);assert.deepEqual(recovered.history,separated.history);assert.deepEqual(recovered.counts,separated.counts)}finally{await target.close()}
 })
 await scenario('INVENTORY-001: the same People identities drive policy, role training and access populations; departure preserves history and leaves future campaigns',async()=>{
  const {person,unmatched,accounts}=fixture
  const policy=await post('/api/policies',{title:'Engineering production access',body:'Engineers use individual accounts and review production access quarterly.'})
  const revision=await get(`/api/policies/${policy.policy}/revisions/${policy.revision}`)
  await post(`/api/policies/${policy.policy}/revisions/${policy.revision}/decision`,{decision:'approved',body_sha256:revision.body_sha256},200)
  await post(`/api/policies/${policy.policy}/revisions/${policy.revision}/publish`,{},200)
  assert.deepEqual(await post('/api/attestations/assign',{policy_id:policy.policy,audience:'selected',people:[person.id],due_date:'2026-11-01'}),{assigned:1})
  await post('/api/training/courses/security-awareness/adopt',{},200)
  const campaign=await post('/api/training/campaigns',{name:'Engineering security training',course_id:'security-awareness',kind:'recurring',audience:'engineering',due_days:'30',interval_months:'12'})
  assert.equal((await get('/api/training')).assignments.filter(a=>a.campaign==='Engineering security training').length,2)
  const access=await post('/api/access-reviews',{name:'Design application review',cadence:'one-off',period_from:'2026-10-01',period_to:'2026-12-31',due_date:'2026-11-01',sources:['list:Design application'],'reviewer_list:Design application':unmatched.id})
  const review=await get('/api/access-reviews/'+access.id);assert.equal(review.items.length,2);assert.deepEqual(review.items.map(i=>i.account_key).sort(),(await get('/api/populations/'+accounts.id)).rows.map(r=>r.row_key).sort())
  const beforePeople=(await get('/api/people')).people
  const departure=await post('/api/people/'+person.id+'/depart',{reason:'Employment ended; handover requested'},200);assert.match(departure.outcome,/no Evidence sign-in account/)
  const departedRecord=(await get('/api/inventory')).records.find(r=>r.source_type==='people'&&r.source_id===person.id);assert.equal(departedRecord.collection_state,'departed');assert.ok(departedRecord.source_history.some(row=>row.reason==='Employment ended; handover requested'))
  const attest=await get('/api/attestations');assert.ok(attest.assignments.some(a=>a.person_id===person.id&&a.state==='departed'))
  const next=await post('/api/training/campaigns',{name:'Next engineering training',course_id:'security-awareness',kind:'recurring',audience:'engineering',due_days:'30',interval_months:'12'})
  const training=await get('/api/training');assert.equal(training.assignments.filter(a=>a.campaign==='Next engineering training').length,1);assert.equal(training.assignments.find(a=>a.campaign==='Next engineering training').email,'morgan-unmatched@northstar.test');assert.ok(training.assignments.some(a=>a.email==='morgan@northstar.test'&&a.state==='departed'))
  assert.equal((await get('/api/people')).people.length,beforePeople.length)
  const after=await get('/api/access-reviews/'+access.id);assert.deepEqual(after.items,review.items,'earlier access population remains frozen')
  console.log('INVENTORY-001 consumer campaigns',Boolean(campaign.id&&next.id&&accounts.id))
 })
 console.log(`${passed} INVENTORY-001 public-door scenarios passed.`)
}finally{await app.close()}
