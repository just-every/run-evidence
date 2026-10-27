import assert from 'node:assert/strict'
import {runtime} from './runtime.mjs'
import {azuredevopsFixture} from './azuredevops-fixture.mjs'
import {collectionScheduleBrowser} from './collection-schedule-browser.mjs'
import {collectionScheduleJourney} from './collection-schedule-journey.mjs'
async function context(){
 const fixture=azuredevopsFixture(),app=await runtime({outbound:fixture.outbound})
 const get=async path=>{const r=await app.fetch(path);assert.equal(r.status,200,await r.clone().text());return r.json()}
 const post=async(path,body,status=200)=>{const r=await app.fetch(path,{method:'POST',headers:{origin:app.origin,'content-type':'application/json'},body:JSON.stringify(body)});assert.equal(r.status,status,await r.clone().text());return r.json()}
 const at=time=>app.clock(time);await app.signin();await at('2026-10-11T12:00:00Z');return {...fixture,app,get,post,at}
}
export async function azuredevopsScopeJourney(){
 const {app,edge,get,post,at,web,site,id,page}=await context()
 try{
  await post('/api/connections',{provider:'azuredevops',account:'northstar',token:'synthetic-evidence-99'},400)
  const c=await post('/api/connections',{provider:'azuredevops',account:'northstar',token:edge.token},201),path='/api/connections/'+c.id
  await post(path+'/repositories',{repositories:[web,site]});await post(path+'/collect',{},201)
  const results=async key=>{const t=(await get('/api/tests')).tests.find(t=>t.catalogue_id==='azuredevops.'+key);return (await get('/api/tests/'+t.id)).latest}
  for(const key of ['branch-protection','required-review','required-checks','repository-private'])assert.deepEqual((await results(key)).map(r=>r.result).sort(),['fail','pass'])
  const known=await app.db.prepare('SELECT attributes_json FROM resources WHERE unique_id=? AND type=?').bind(web,'azuredevops.repository').first();assert.deepEqual([JSON.parse(known.attributes_json).required_reviews,JSON.parse(known.attributes_json).required_status_checks],[2,1],'disabled, nonblocking and foreign-scope rules do not inflate protection')
  assert.ok(!edge.requests.some(r=>r.path.includes('/repositories/'+id(5)+'/')),'unselected repository content is never requested')
  assert.ok((await get('/api/tests')).catalogue.find(t=>t.id==='azuredevops.mfa-policy').manualRequirement)
  edge.repos[site].private=true;edge.repos[site].protected=true;await at('2026-10-11T13:00:00Z');await app.tick();assert.ok((await results('repository-private')).every(r=>r.result==='pass'))
  edge.hidden.add(web);await at('2026-10-11T14:00:00Z');await app.tick();assert.ok((await results('repository-private')).some(r=>r.result==='unknown'));assert.equal((await get('/api/inventory')).records.filter(r=>r.source_type==='azuredevops.repository').length,2)
  edge.hidden.clear();edge.token='synthetic-evidence-2';await at('2026-10-11T15:00:00Z');await app.tick();assert.equal((await get(path)).connection.status,'needs reconnect');await post(path+'/rotate',{token:edge.token})
  const person=await post('/api/people',{name:'Azure Former',email:'former@northstar.test',kind:'employee'},201)
  edge.overrides.set('vssps.dev.azure.com/_apis/graph/users',{body:page([{subjectKind:'user',descriptor:'aad.synthetic-evidence-80',displayName:'Former Subject',mailAddress:'former@northstar.test',origin:'aad',metaType:'member'}])})
  await at('2026-10-11T16:10:00Z');await post(path+'/collect',{},201)
  const account=(await get('/api/identities')).accounts.find(a=>a.name==='Former Subject');assert.deepEqual([account.status,account.mfa,account.admin,account.match],['unknown',null,null,null])
  await post('/api/identities/'+account.id+'/match',{person_id:person.id,decision:'approved',reason:'Reviewed source subject identity'});await post('/api/people/'+person.id+'/depart',{reason:'Owner-recorded departure'})
  await at('2026-10-11T17:20:00Z');await app.tick();assert.equal((await results('departed-members'))[0].result,'fail')
  edge.overrides.set('vssps.dev.azure.com/_apis/graph/users',{body:page([])});await at('2026-10-11T18:30:00Z');await app.tick();assert.equal((await results('departed-members'))[0].result,'pass')
  assert.equal((await get('/api/people')).people.length,1)
  await post(path+'/revoke',{});assert.equal((await app.db.prepare('SELECT secret_ciphertext FROM connections WHERE id=?').bind(c.id).first()).secret_ciphertext,null)
  assert.ok(edge.requests.every(r=>r.method==='GET'))
 }finally{await app.close()}
}
export async function azuredevopsHistoryJourney(){
 const {app,edge,get,post,at,web,id,head,merge}=await context(),target=await runtime()
 try{
  const c=await post('/api/connections',{provider:'azuredevops',account:'northstar',token:edge.token},201),path='/api/connections/'+c.id
  await post(path+'/repositories',{repositories:[web]});await post('/api/programs',{framework:'soc2',name:'Azure source period',legal_entity:'Northstar',report_type:'Type II',audit_from:'2026-10-01',audit_to:'2026-10-31'},201);await post(path+'/collect',{},201)
  const original=(await get(path)).runs[0],h=JSON.parse(original.coverage_json).code_history[web]
  assert.equal(h.label,'Engineering/Web');assert.equal(h.changes[0].source_revision,head);assert.equal(h.changes[0].merge_revision,merge);assert.deepEqual(h.changes[0].reviews.map(r=>r.state),['APPROVED','REJECTED']);assert.ok(h.changes[0].reviews.every(r=>r.commit===null&&r.submitted_at===null))
  assert.equal(h.changes[0].checks[0].conclusion,'failed');assert.deepEqual(h.deployments.map(d=>d.change_numbers),[[19]]);assert.equal(h.deployments[0].pipeline_identity,'build:101');assert.equal(h.deployments[0].pipeline_state,'failed');assert.equal(h.deployments[0].current_state,'succeeded');assert.equal(h.deployments[0].statuses,null)
  for(const marker of ['private-repo-description','private-change-description','private-check-description','private-release-variable','private-release-description','private-build-parameters','private-script'])assert.ok(!JSON.stringify(h).includes(marker))
  assert.ok(!h.deployments.some(d=>d.pipeline_identity==='build:102'))
  const packages=(await get('/api/inventory')).records.filter(r=>r.source_type==='azuredevops.dependency');assert.equal(packages[0].attributes.source_revision,head)
  const key=h.deployments[0].environment_key;await post(path+'/production-environments',{source_run:original.id,production_environments:[key],reason:'Owner classifies observed production environment'})
  await at('2026-10-11T13:10:00Z');await post(path+'/collect',{},201)
  assert.equal(JSON.parse((await get(path)).runs[0].coverage_json).code_history[web].deployments[0].production,true);assert.deepEqual((await get(path)).runs.find(r=>r.id===original.id),original)
  const bytes=Buffer.from(await(await app.fetch('/api/archive/export')).arrayBuffer());await target.signin();const restored=await target.fetch('/api/archive/restore',{method:'POST',headers:{origin:target.origin,'content-type':'application/octet-stream','x-evidence-confirm':'restore','x-evidence-erasure-history':'unverified acknowledged'},body:bytes});assert.equal(restored.status,200,await restored.clone().text())
  for(const table of ['resources','resource_versions','collection_runs','test_runs','observations'])assert.deepEqual((await target.db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()).results,(await app.db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()).results,table)
  assert.equal((await target.db.prepare('SELECT status FROM connections WHERE id=?').bind(c.id).first()).status,'inactive after restore')
  await collectionScheduleBrowser(app,[(await get(path)).connection],{suffix:'-history',productionReview:true,reportExpected:['Change #19','Deployment 21','Azure DevOps source metadata'],extraScreens:[{path:'/app/connections',heading:'Connect Azure DevOps',key:'setup',text:['read-only PAT','project policy/release metadata']},{path:'/app/inventory',heading:'Inventory',key:'inventory',text:['openai']}]})
 }finally{await app.close();await target.close()}
}
export async function azuredevopsPagingJourney(){
 const {app,edge,get,post,at,web,page}=await context()
 try{
  const c=await post('/api/connections',{provider:'azuredevops',account:'northstar',token:edge.token},201),path='/api/connections/'+c.id;await post(path+'/repositories',{repositories:[web]})
  const first='/_apis/graph/users?api-version=7.1-preview.1',second=first+'&continuationToken=synthetic-evidence-page-2'
  edge.overrides.set('vssps.dev.azure.com'+first,{body:page([{subjectKind:'user',descriptor:'aad.synthetic-evidence-1',displayName:'First Subject'}]),headers:{'x-ms-continuationtoken':'synthetic-evidence-page-2'}})
  edge.overrides.set('vssps.dev.azure.com'+second,{status:429,body:{message:'Rate limited'},headers:{'retry-after':'60'}})
  await post(path+'/collect',{},201);const paused=(await get(path)).runs[0];assert.equal(paused.outcome,'throttled');const count=edge.requests.filter(r=>r.host==='vssps.dev.azure.com'&&r.path==='/northstar'+first).length
  edge.overrides.set('vssps.dev.azure.com'+second,{body:page([])});await at('2026-10-11T12:20:00Z');await post(path+'/collect',{},201);assert.equal(edge.requests.filter(r=>r.host==='vssps.dev.azure.com'&&r.path==='/northstar'+first).length,count);assert.deepEqual((await get(path)).runs.find(r=>r.id===paused.id),paused)
  edge.overrides.clear();edge.overrides.set('vssps.dev.azure.com'+first,{body:{count:1,value:'not an array'}});await at('2026-10-11T13:30:00Z');await post(path+'/collect',{},201);assert.match((await get(path)).runs[0].coverage_json,/paginated source envelope/)
  assert.equal((await get('/api/identities')).accounts.length,1,'schema loss never erases a known subject')
  edge.overrides.clear();await collectionScheduleJourney(app,at)
 }finally{await app.close()}
}
