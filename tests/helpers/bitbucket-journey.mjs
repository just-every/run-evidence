import assert from 'node:assert/strict'
import {runtime} from './runtime.mjs'
import {bitbucketFixture} from './bitbucket-fixture.mjs'
import {collectionScheduleBrowser} from './collection-schedule-browser.mjs'
import {collectionScheduleJourney} from './collection-schedule-journey.mjs'
const consent={admin_read_consent:'yes',reason:'Approve dedicated provider admin grant for GET-only collection'}
async function context(){
 const fixture=bitbucketFixture(),app=await runtime({outbound:fixture.outbound})
 const get=async path=>{const r=await app.fetch(path);assert.equal(r.status,200,await r.clone().text());return r.json()}
 const post=async(path,body,status=200)=>{const r=await app.fetch(path,{method:'POST',headers:{origin:app.origin,'content-type':'application/json'},body:JSON.stringify(body)});assert.equal(r.status,status,await r.clone().text());return r.json()}
 const at=time=>app.clock(time);await app.signin();await at('2026-10-11T12:00:00Z');return {...fixture,app,get,post,at}
}
export async function bitbucketScopeJourney(){
 const {app,edge,get,post,at,id,page}=await context()
 try{
  const setup={provider:'bitbucket',account:'northstar',token:edge.token}
  await post('/api/connections',{...setup,reason:'No admin consent'},400);assert.equal(edge.requests.length,0,'no credential leaves the installation before consent')
  await post('/api/connections',{...setup,...consent,provider:'unsupported-provider'},400);assert.equal(edge.requests.length,0)
  const c=await post('/api/connections',{...setup,...consent},201),path='/api/connections/'+c.id
  await post(path+'/repositories',{repositories:c.repositories});await post(path+'/collect',{},201)
  const result=async key=>{const t=(await get('/api/tests')).tests.find(t=>t.catalogue_id==='bitbucket.'+key);return (await get('/api/tests/'+t.id)).latest}
  for(const key of ['branch-protection','required-review','required-checks','repository-private'])assert.deepEqual((await result(key)).map(r=>r.result),['fail','pass'])
  const catalogue=(await get('/api/tests')).catalogue;assert.ok(catalogue.find(t=>t.id==='bitbucket.mfa-policy').manualRequirement)
  assert.ok(!JSON.stringify(await get(path)).includes(edge.token))
  edge.repos['northstar/site'].private=true;edge.repos['northstar/site'].protected=true
  await at('2026-10-11T13:00:00Z');await app.tick();assert.ok((await result('repository-private')).every(r=>r.result==='pass'))
  edge.hidden.add('northstar/web');await at('2026-10-11T14:00:00Z');await app.tick();assert.deepEqual((await result('repository-private')).map(r=>r.result),['pass','unknown'])
  edge.hidden.clear();edge.token='synthetic-evidence-2';await at('2026-10-11T15:00:00Z');await app.tick();assert.equal((await get(path)).connection.status,'needs reconnect')
  await post(path+'/rotate',{token:edge.token},400);await post(path+'/rotate',{token:edge.token,...consent})
  const person=await post('/api/people',{name:'Bitbucket Former',email:'former@northstar.test',kind:'employee'},201)
  edge.overrides.set('/workspaces/northstar/permissions',{body:page([{permission:'owner',user:{uuid:id(50),display_name:'Former Member'},workspace:{uuid:edge.workspace}}])})
  await at('2026-10-11T16:10:00Z');await post(path+'/collect',{},201)
  const account=(await get('/api/identities')).accounts.find(a=>a.name==='Former Member');assert.equal(account.status,'unknown');assert.equal(account.mfa,null);assert.equal(account.population,'person');assert.equal(account.admin,true)
  assert.equal((await app.db.prepare('SELECT attributes_json FROM resources WHERE id=?').bind(account.id).first()).attributes_json.includes('"active":null'),true)
  await post('/api/identities/'+account.id+'/match',{person_id:person.id,decision:'approved',reason:'Reviewed named workspace member'})
  await post('/api/people/'+person.id+'/depart',{reason:'Owner-recorded departure'})
  await at('2026-10-11T17:20:00Z');await app.tick();assert.equal((await result('departed-members'))[0].result,'fail')
  edge.overrides.set('/workspaces/northstar/permissions',{body:page([])});await at('2026-10-11T18:30:00Z');await app.tick();assert.equal((await result('departed-members'))[0].result,'pass')
  assert.ok((await get('/api/audit')).entries.some(e=>e.action==='connection.authorized'&&e.reason===consent.reason))
  await post(path+'/revoke',{});assert.equal((await app.db.prepare('SELECT secret_ciphertext FROM connections WHERE id=?').bind(c.id).first()).secret_ciphertext,null)
  assert.ok(edge.requests.every(r=>r.method==='GET'))
 }finally{await app.close()}
}
export async function bitbucketHistoryJourney(){
 const {app,edge,get,post,at,id,head,merge}=await context(),target=await runtime()
 try{
  const c=await post('/api/connections',{provider:'bitbucket',account:'northstar',token:edge.token,...consent},201),path='/api/connections/'+c.id
  await post(path+'/repositories',{repositories:['northstar/web']});await post('/api/programs',{framework:'soc2',name:'Bitbucket source period',legal_entity:'Northstar',report_type:'Type II',audit_from:'2026-10-01',audit_to:'2026-10-31'},201)
  await post(path+'/collect',{},201)
  const original=(await get(path)).runs[0],h=JSON.parse(original.coverage_json).code_history['northstar/web']
  assert.equal(h.changes[0].merged_at,'2026-10-10T15:00:00.000100+00:00');assert.equal(h.changes[0].source_revision,head);assert.equal(h.changes[0].merge_revision,merge);assert.equal(h.changes[0].reviews[0].commit,null)
  assert.equal(h.changes[0].checks[0].conclusion,'FAILED');assert.deepEqual(h.deployments.map(d=>d.change_numbers),[[17],[]],'sub-millisecond ordering cannot fabricate a deployment-after-merge link')
  assert.equal(h.deployments[0].pipeline_uuid,id(40));assert.equal(h.deployments[0].pipeline_state,'COMPLETED: FAILED');assert.equal(h.deployments[0].current_state,'SUCCESSFUL','pipeline and deployment outcomes stay separate')
  assert.equal(h.deployments[0].production,null)
  for(const field of ['private-description','private-change-body','private-change-title','private-comment','private-check-description','private-pipeline-value','private-script'])assert.ok(!JSON.stringify(h).includes(field))
  const packages=(await get('/api/inventory')).records.filter(r=>r.source_type==='bitbucket.dependency');assert.equal(packages[0].name,'openai');assert.equal(packages[0].attributes.source_revision,head)
  const key=h.deployments[0].environment_key
  await post(path+'/production-environments',{source_run:original.id,production_environments:['unobserved'],reason:'Refuse an unobserved environment'},400)
  await post(path+'/production-environments',{source_run:original.id,production_environments:[key],reason:'Owner classifies observed production deployment environment'})
  await at('2026-10-11T13:10:00Z');await post(path+'/collect',{},201)
  const latest=(await get(path)).runs[0];assert.equal(JSON.parse(latest.coverage_json).code_history['northstar/web'].deployments[0].production,true);assert.deepEqual((await get(path)).runs.find(r=>r.id===original.id),original)
  await post(path+'/production-environments',{source_run:original.id,production_environments:[key],reason:'Stale source snapshot'},409)
  const bytes=Buffer.from(await(await app.fetch('/api/archive/export')).arrayBuffer());await target.signin()
  const restored=await target.fetch('/api/archive/restore',{method:'POST',headers:{origin:target.origin,'content-type':'application/octet-stream','x-evidence-confirm':'restore','x-evidence-erasure-history':'unverified acknowledged'},body:bytes});assert.equal(restored.status,200,await restored.clone().text())
  for(const table of ['collection_runs','resources','resource_versions','product_audit'])assert.deepEqual((await target.db.prepare(`SELECT * FROM ${table} ${table==='product_audit'?"WHERE action NOT LIKE 'auth.%'":''} ORDER BY rowid`).all()).results,(await app.db.prepare(`SELECT * FROM ${table} ${table==='product_audit'?"WHERE action NOT LIKE 'auth.%'":''} ORDER BY rowid`).all()).results,table)
  assert.equal((await target.db.prepare('SELECT status FROM connections WHERE id=?').bind(c.id).first()).status,'inactive after restore')
  await collectionScheduleBrowser(app,[(await get(path)).connection],{suffix:'-history',productionReview:true,reportExpected:['Change #17','Deployment '+id(21),'Bitbucket Cloud source metadata'],extraScreens:[{path:'/app/connections',heading:'Connect Bitbucket Cloud',key:'setup',text:['write-capable','Reason for this provider grant']},{path:'/app/inventory',heading:'Inventory',key:'inventory',text:['openai']}]})
 }finally{await app.close();await target.close()}
}
export async function bitbucketPagingJourney(){
 const {app,edge,get,post,at,page,base}=await context()
 try{
  const c=await post('/api/connections',{provider:'bitbucket',account:'northstar',token:edge.token,...consent},201),path='/api/connections/'+c.id
  await post(path+'/repositories',{repositories:['northstar/web']})
  const first='/repositories/northstar/web/branch-restrictions?pagelen=100',second=first+'&page=2'
  edge.overrides.set(first,{body:page([{id:1,kind:'push',branch_match_kind:'glob',pattern:'main'}],base+second)});edge.overrides.set(second,{status:429,body:{error:{message:'Rate limited'}},headers:{'retry-after':'60'}})
  await post(path+'/collect',{},201);const paused=(await get(path)).runs[0];assert.equal(paused.outcome,'throttled');const count=edge.requests.filter(r=>r.path==='/2.0'+first).length
  edge.overrides.set(second,{body:page([])});await at('2026-10-11T12:20:00Z');await post(path+'/collect',{},201);assert.equal(edge.requests.filter(r=>r.path==='/2.0'+first).length,count);assert.deepEqual((await get(path)).runs.find(r=>r.id===paused.id),paused)
  edge.overrides.set(first,{body:page([],base+second+'&kind=omit')});await at('2026-10-11T13:30:00Z');await post(path+'/collect',{},201);assert.match((await get(path)).runs[0].coverage_json,/unsafe source continuation/);assert.ok(!edge.requests.some(r=>r.path.includes('kind=omit')))
  edge.overrides.clear();await collectionScheduleJourney(app,at)
 }finally{await app.close()}
}
