import assert from 'node:assert/strict'
import { runtime } from './runtime.mjs'
import { githubFixture } from './github-fixture.mjs'
import { collectionScheduleBrowser } from './collection-schedule-browser.mjs'
// The provider's documented metadata envelopes at the network edge; D1,
// collection, scheduling, owner authorization and archive restore are real.
export async function githubHistoryJourney(){
 const {github,outbound}=githubFixture(),app=await runtime({outbound}),target=await runtime()
 const get=async path=>{const r=await app.fetch(path);assert.equal(r.status,200,await r.clone().text());return r.json()}
 const post=async(path,body,status=200)=>{const r=await app.fetch(path,{method:'POST',headers:{origin:app.origin,'content-type':'application/json'},body:JSON.stringify(body)});assert.equal(r.status,status,await r.clone().text());return r.json()}
 const at=async time=>{github.clock=time;await app.clock(time)}
 const head='a'.repeat(40),merge='b'.repeat(40),other='c'.repeat(40),root='/repos/northstar/web'
 try{
  await app.signin();await at('2026-10-11T12:00:00Z')
  const c=await post('/api/connections',{account:'northstar',token:'synthetic-evidence-1'},201),path='/api/connections/'+c.id
  await post(path+'/repositories',{repositories:['northstar/web']})
  await post('/api/programs',{framework:'soc2',name:'Source changes in October',legal_entity:'Northstar',report_type:'Type II',audit_from:'2026-10-01',audit_to:'2026-10-31'},201)
  const pull={number:14,merged_at:'2026-10-10T16:00:00Z',head:{sha:head},base:{ref:'main'},merge_commit_sha:merge,body:'synthetic-evidence-private-pr-body',unexpected_secret:'synthetic-evidence-unexpected-secret'}
  github.overrides.set(root+'/pulls',{body:[pull]})
  const reviews=root+'/pulls/14/reviews?per_page=100',page2=reviews+'&page=2'
  github.overrides.set(reviews,{body:[{id:1,user:{id:1,login:'reviewer'},state:'APPROVED',commit_id:other,submitted_at:'2026-10-09T10:00:00Z'}],headers:{link:`<https://api.github.com${page2}>; rel="next"`}})
  github.overrides.set(page2,{body:[{id:2,user:{id:1,login:'reviewer'},state:'CHANGES_REQUESTED',commit_id:head,submitted_at:'2026-10-10T15:00:00Z'}]})
  const checks=root+'/commits/'+head+'/check-runs'
  github.overrides.set(checks,{body:{total_count:1,check_runs:[{name:'ci',head_sha:head,status:'completed',conclusion:'failure',completed_at:'2026-10-10T15:30:00Z',output:{text:'synthetic-evidence-private-check-output'}}]}})
  github.overrides.set(root+'/commits/'+head+'/status',{body:{sha:head,state:'failure',statuses:[{context:'security',state:'failure',created_at:'2026-10-10T15:45:00Z',description:'synthetic-evidence-private-status-description'}]}})
  github.overrides.set(root+'/deployments',{body:[{id:7,sha:merge,environment:'production',production_environment:true,created_at:'2026-10-10T16:30:00Z',payload:{secret:'synthetic-evidence-private-deployment-payload'}},{id:8,sha:other,environment:'staging',production_environment:false,created_at:'2026-10-10T16:45:00Z'}]})
  for(const id of [7,8])github.overrides.set(root+'/deployments/'+id+'/statuses',{body:[{state:id===7?'success':'failure',created_at:'2026-10-10T17:00:00Z'}]})
  await post(path+'/collect',{},201)
  let runs=(await get(path)).runs,original=runs[0],cov=JSON.parse(original.coverage_json),h=cov.code_history['northstar/web']
  assert.equal(original.outcome,'complete');assert.equal(h.changes[0].source_revision,head);assert.equal(h.changes[0].merge_revision,merge)
  assert.deepEqual(h.changes[0].reviews.map(r=>[r.state,r.commit]),[['APPROVED',other],['CHANGES_REQUESTED',head]])
  assert.equal(h.changes[0].checks[0].conclusion,'failure');assert.equal(h.changes[0].statuses[0].state,'failure')
  assert.deepEqual(h.deployments.map(d=>d.change_numbers),[[14],[]]);assert.equal(h.deployments[1].statuses[0].state,'failure')
  for(const marker of ['private-pr-body','unexpected-secret','private-check-output','private-status-description','private-deployment-payload'])assert.ok(!JSON.stringify(cov).includes(marker),marker)
  assert.ok(cov.context.audit_periods.some(p=>p.audit_from==='2026-10-01'))
  // A fresh source answer changes only its new snapshot, not the old failure.
  github.overrides.set(checks,{body:{check_runs:[{name:'ci',head_sha:other,status:'completed',conclusion:'success',completed_at:'2026-10-11T11:00:00Z'}]}})
  await at('2026-10-11T13:00:00Z');await app.tick()
  runs=(await get(path)).runs
  assert.equal(runs[0].outcome,'partial');assert.equal(JSON.parse(runs[0].coverage_json).code_history['northstar/web'].changes[0].checks,null)
  assert.match(runs[0].coverage_json,/does not match the reviewed source revision/);assert.deepEqual(runs.find(r=>r.id===original.id),original)
  // Pause page two, restart real storage and retry precisely the saved cursor.
  github.overrides.set(checks,{body:{check_runs:[]}})
  github.overrides.set(page2,{status:429,body:{message:'rate limited'},headers:{'x-ratelimit-reset':String(Date.parse('2026-10-11T14:15:00Z')/1000)}})
  await at('2026-10-11T14:05:00Z');await app.tick()
  const paused=(await get(path)).runs[0];assert.equal(paused.outcome,'throttled');assert.ok(JSON.parse(paused.coverage_json).resume_pages.pending)
  const firstReads=github.requests.filter(p=>p===reviews).length,secondReads=github.requests.filter(p=>p===page2).length
  github.overrides.set(page2,{body:[]})
  await at('2026-10-11T14:20:00Z');await post(path+'/collect',{},201)
  assert.equal(github.requests.filter(p=>p===reviews).length,firstReads,'completed review page is not replayed')
  assert.equal(github.requests.filter(p=>p===page2).length,secondReads+1)
  assert.deepEqual((await get(path)).runs.find(r=>r.id===paused.id),paused)
  // A hostile continuation never receives the credential.
  github.overrides.set(reviews,{body:[],headers:{link:'<https://foreign.example.test/reviews>; rel="next"'}})
  await at('2026-10-11T15:30:00Z');await post(path+'/collect',{},201)
  const unsafe=(await get(path)).runs[0];assert.equal(unsafe.outcome,'partial');assert.match(unsafe.coverage_json,/unsafe history continuation/)
  const report=await get(path+'/report?from=2026-10-01&to=2026-10-31');assert.ok(report.attempts.some(r=>r.id===original.id))
  assert.ok(github.methods.every(m=>m==='GET'))
  const bytes=Buffer.from(await(await app.fetch('/api/archive/export')).arrayBuffer());await target.signin()
  const restore=await target.fetch('/api/archive/restore',{method:'POST',headers:{origin:target.origin,'content-type':'application/octet-stream','x-evidence-confirm':'restore','x-evidence-erasure-history':'unverified acknowledged'},body:bytes})
  assert.equal(restore.status,200,await restore.clone().text());assert.deepEqual(await target.db.prepare('SELECT coverage_json FROM collection_runs WHERE id=?').bind(original.id).first(),{coverage_json:original.coverage_json})
  assert.equal((await target.db.prepare('SELECT status FROM connections WHERE id=?').bind(c.id).first()).status,'inactive after restore')
  await collectionScheduleBrowser(app,[(await get(path)).connection],{suffix:'-code-history',expandHistory:true,reportExpected:['Change #14','Deployment 7']})
 }finally{await app.close();await target.close()}
}
