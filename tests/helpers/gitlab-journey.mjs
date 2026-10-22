import assert from 'node:assert/strict'
import {runtime} from './runtime.mjs'
import {gitlabFixture} from './gitlab-fixture.mjs'
import {collectionScheduleBrowser} from './collection-schedule-browser.mjs'
import {collectionScheduleJourney} from './collection-schedule-journey.mjs'
async function context(){
 const fixture=gitlabFixture(),app=await runtime({outbound:fixture.outbound})
 const get=async path=>{const r=await app.fetch(path);assert.equal(r.status,200,await r.clone().text());return r.json()}
 const post=async(path,body,status=200)=>{const r=await app.fetch(path,{method:'POST',headers:{origin:app.origin,'content-type':'application/json'},body:JSON.stringify(body)});assert.equal(r.status,status,await r.clone().text());return r.json()}
 const at=time=>app.clock(time);await app.signin();await at('2026-10-11T12:00:00Z')
 return {...fixture,app,get,post,at}
}
export async function gitlabScopeJourney(){
 const {app,edge,get,post,at}=await context()
 try{
  await post('/api/connections',{provider:'gitlab',account:'northstar',token:'synthetic-evidence-99'},400)
  assert.equal((await get('/api/connections')).connections.length,0)
  const c=await post('/api/connections',{provider:'gitlab',account:'northstar',token:edge.token},201),path='/api/connections/'+c.id
  assert.deepEqual(c.repositories,['northstar/web','northstar/site']);await post(path+'/repositories',{repositories:c.repositories})
  await post(path+'/collect',{},201)
  const test=async id=>(await get('/api/tests')).tests.find(t=>t.catalogue_id==='gitlab.'+id),results=async id=>(await get('/api/tests/'+(await test(id)).id)).latest
  for(const id of ['branch-protection','required-review','repository-private'])assert.deepEqual((await results(id)).map(r=>r.result),['fail','pass'])
  assert.deepEqual((await results('org-two-factor')).map(r=>r.result),['pass'])
  assert.ok((await get('/api/tests')).catalogue.find(t=>t.id==='gitlab.secret-alerts').manualRequirement)
  const raw=JSON.stringify(await get(path));assert.ok(!raw.includes(edge.token));assert.ok(!raw.includes('private-runner-field'))
  edge.projects['northstar/site'].private=true;edge.projects['northstar/site'].protected=true;edge.projects['northstar/site'].reviews=1
  await at('2026-10-11T13:00:00Z');await app.tick()
  for(const id of ['branch-protection','required-review','repository-private'])assert.ok((await results(id)).every(r=>r.result==='pass'))
  edge.hidden.add('northstar/web');await at('2026-10-11T14:00:00Z');await app.tick()
  assert.deepEqual((await results('repository-private')).map(r=>[r.resource_id,r.result]).map(([,r])=>r),['pass','unknown'])
  assert.equal((await get(path)).runs[0].outcome,'partial');assert.equal((await get('/api/inventory')).records.filter(r=>r.source_type==='gitlab.repository').length,2)
  edge.hidden.clear();edge.token='synthetic-evidence-2'
  await at('2026-10-11T15:00:00Z');await app.tick();assert.equal((await get(path)).connection.status,'needs reconnect')
  await post(path+'/rotate',{token:'synthetic-evidence-1'},400);await post(path+'/rotate',{token:edge.token})
  assert.equal((await post(path+'/collect',{},201)).outcome,'complete')
  await post(path+'/revoke',{});assert.equal((await get(path)).connection.status,'revoked');assert.equal((await app.db.prepare('SELECT secret_ciphertext FROM connections WHERE id=?').bind(c.id).first()).secret_ciphertext,null)
  assert.ok(edge.requests.every(r=>r.method==='GET'))
 }finally{await app.close()}
}
export async function gitlabHistoryJourney(){
 const {app,edge,get,post,at,head,merge}=await context(),target=await runtime()
 try{
  const c=await post('/api/connections',{provider:'gitlab',account:'northstar',token:edge.token},201),path='/api/connections/'+c.id
  await post(path+'/repositories',{repositories:['northstar/web']})
  await post('/api/programs',{framework:'soc2',name:'GitLab source period',legal_entity:'Northstar',report_type:'Type II',audit_from:'2026-10-01',audit_to:'2026-10-31'},201)
  await post(path+'/collect',{},201)
  const original=(await get(path)).runs[0],cov=JSON.parse(original.coverage_json),h=cov.code_history['northstar/web']
  assert.equal(original.outcome,'complete');assert.equal(h.changes[0].source_revision,head);assert.equal(h.changes[0].merge_revision,merge)
  assert.deepEqual(h.changes[0].reviews,[],'approved=true with no rules is not an invented human approval')
  assert.equal(h.changes[0].checks[0].conclusion,'failed');assert.equal(h.changes[0].checks[0].revision,head)
  assert.deepEqual(h.deployments[0].change_numbers,[31]);assert.equal(h.deployments[0].production,null,'environment name alone does not establish production tier')
  assert.ok(cov.context.audit_periods.some(p=>p.audit_from==='2026-10-01'))
  assert.ok((await get('/api/inventory')).records.some(r=>r.source_type==='gitlab.dependency'&&r.name==='openai'&&r.attributes.source_revision===null))
  for(const marker of ['private-project-description','private-runner-field','private-change-description','private-package-field'])assert.ok(!JSON.stringify(cov).includes(marker))
  edge.overrides.set('/projects/northstar/web/merge_requests/31',{body:{sha:head,head_pipeline:{sha:'c'.repeat(40),status:'success',finished_at:'2026-10-11T13:00:00Z'}}})
  await at('2026-10-11T13:10:00Z');await app.tick()
  const broken=(await get(path)).runs[0];assert.equal(broken.outcome,'partial');assert.match(broken.coverage_json,/source revision mismatch/)
  assert.equal(JSON.parse(broken.coverage_json).code_history['northstar/web'].changes[0].checks,null)
  assert.deepEqual((await get(path)).runs.find(r=>r.id===original.id),original)
  const bytes=Buffer.from(await(await app.fetch('/api/archive/export')).arrayBuffer());await target.signin()
  const restored=await target.fetch('/api/archive/restore',{method:'POST',headers:{origin:target.origin,'content-type':'application/octet-stream','x-evidence-confirm':'restore','x-evidence-erasure-history':'unverified acknowledged'},body:bytes});assert.equal(restored.status,200,await restored.clone().text())
  for(const table of ['collection_runs','resources','resource_versions','test_runs','observations'])assert.deepEqual((await target.db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()).results,(await app.db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()).results,table)
  assert.equal((await target.db.prepare('SELECT status FROM connections WHERE id=?').bind(c.id).first()).status,'inactive after restore')
  await collectionScheduleBrowser(app,[(await get(path)).connection],{suffix:'-history',reportExpected:['Change #31','Deployment 8','GitLab source metadata'],extraScreens:[{path:'/app/connections',heading:'Connect GitLab',key:'setup',text:['Provider costs in USD','GitLab read-only app token']},{path:'/app/inventory',heading:'Inventory',key:'inventory',text:['openai']}]})
 }finally{await app.close();await target.close()}
}
export async function gitlabPagingJourney(){
 const {app,edge,get,post,at}=await context()
 try{
  const c=await post('/api/connections',{provider:'gitlab',account:'northstar',token:edge.token},201),path='/api/connections/'+c.id
  await post(path+'/repositories',{repositories:['northstar/web']})
  const first='/projects/northstar/web/protected_branches?per_page=100',second=first+'&page=2'
  edge.overrides.set(first,{body:[{id:9,name:'main'}],headers:{'x-next-page':'2'}});edge.overrides.set(second,{status:429,body:{message:'Too Many Requests'},headers:{'retry-after':'60'}})
  await post(path+'/collect',{},201)
  const paused=(await get(path)).runs[0];assert.equal(paused.outcome,'throttled');assert.ok(JSON.parse(paused.coverage_json).resume_pages.pending)
  const requests=()=>edge.requests.filter(r=>decodeURIComponent(r.path.replace('/api/v4',''))===first).length,count=requests()
  edge.overrides.set(second,{body:[]});await at('2026-10-11T12:20:00Z');await post(path+'/collect',{},201)
  assert.equal(requests(),count,'restart resumes only the saved protection page');assert.equal((await get(path)).runs[0].outcome,'complete');assert.deepEqual((await get(path)).runs.find(r=>r.id===paused.id),paused)
  edge.overrides.set(first,{body:[],headers:{link:'<https://gitlab.com/api/v4/projects/northstar%2Fweb/protected_branches?per_page=100&page=2&search=omit>; rel="next"'}})
  await at('2026-10-11T13:30:00Z');await post(path+'/collect',{},201)
  assert.equal((await get(path)).runs[0].outcome,'partial');assert.match((await get(path)).runs[0].coverage_json,/unsafe source continuation/)
  assert.ok(!edge.requests.some(r=>r.path.includes('search=omit')))
  edge.overrides.clear()
  await collectionScheduleJourney(app,at)
 }finally{await app.close()}
}
