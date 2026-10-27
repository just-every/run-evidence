import assert from 'node:assert/strict'
import {runtime} from './runtime.mjs'
import {githubFixture} from './github-fixture.mjs'
import {collectionScheduleBrowser} from './collection-schedule-browser.mjs'
export async function githubMembersJourney(){
 const {github,outbound}=githubFixture(),app=await runtime({outbound}),target=await runtime()
 const get=async path=>{const r=await app.fetch(path);assert.equal(r.status,200,await r.clone().text());return r.json()}
 const post=async(path,body,status=200)=>{const r=await app.fetch(path,{method:'POST',headers:{origin:app.origin,'content-type':'application/json'},body:JSON.stringify(body)});assert.equal(r.status,status,await r.clone().text());return r.json()}
 const at=async time=>{github.clock=time;await app.clock(time)},root='/orgs/northstar/members',a={id:10,login:'former',type:'User'},b={id:11,login:'current',type:'User'}
 try{
  await app.signin();await at('2026-10-11T12:00:00Z')
  const former=await post('/api/people',{name:'Former Person',email:'former@northstar.test',kind:'employee'},201),current=await post('/api/people',{name:'Current Person',email:'current@northstar.test',kind:'employee'},201)
  const c=await post('/api/connections',{account:'northstar',token:'synthetic-evidence-1'},201),path='/api/connections/'+c.id
  github.overrides.set(root+'?per_page=100&role=all',{body:[a,b]});github.overrides.set(root+'?per_page=100&role=admin',{body:[b]});github.overrides.set(root+'?per_page=100&filter=2fa_disabled&role=all',{body:[a]})
  await post(path+'/collect',{},201)
  let accounts=(await get('/api/identities')).accounts
  assert.equal(accounts.length,2);assert.ok(accounts.every(a=>a.match===null),'a login never auto-matches or creates a person')
  assert.deepEqual(accounts.map(a=>[a.name,a.admin,a.mfa]),[['current',true,true],['former',false,false]])
  assert.equal((await get('/api/people')).people.length,2)
  const departure=async()=>{const test=(await get('/api/tests')).tests.find(t=>t.catalogue_id==='github.departed-members');return (await get('/api/tests/'+test.id)).latest[0]}
  assert.equal((await departure()).result,'unknown')
  for(const [login,person]of [['former',former],['current',current]])await post('/api/identities/'+accounts.find(a=>a.name===login).id+'/match',{decision:'approved',person_id:person.id,reason:'Reviewed named source account'})
  const before=(await app.db.prepare("SELECT COUNT(*) AS n FROM oa_operators WHERE role='owner'").first()).n
  await post('/api/people/'+former.id+'/depart',{reason:'Departure recorded by owner'})
  await at('2026-10-11T13:00:00Z');await app.tick()
  assert.equal((await departure()).result,'fail');assert.deepEqual(JSON.parse((await departure()).actual_json),{departed_members:1})
  const failing=(await get(path)).runs[0]
  const inventory=await get('/api/inventory');assert.ok(JSON.stringify(inventory).includes('Former Person'));assert.ok(JSON.stringify(inventory).includes('GitHub northstar'))
  assert.equal((await app.db.prepare("SELECT COUNT(*) AS n FROM oa_operators WHERE role='owner'").first()).n,before,'matching grants no authorization')
  // Denied membership retains the account denominator and an unknown result.
  github.overrides.set(root+'?per_page=100&role=all',{status:403,body:{message:'Resource not accessible'}})
  await at('2026-10-11T14:00:00Z');await app.tick()
  assert.equal((await departure()).result,'unknown');assert.equal((await get('/api/identities')).accounts.length,2)
  assert.equal((await get(path)).runs[0].outcome,'partial')
  // An actual fresh source removal is retained beside the earlier access failure.
  github.overrides.set(root+'?per_page=100&role=all',{body:[b]});github.overrides.set(root+'?per_page=100&filter=2fa_disabled&role=all',{body:[]})
  await at('2026-10-11T15:10:00Z');await app.tick()
  assert.equal((await departure()).result,'pass');assert.deepEqual((await get(path)).runs.find(r=>r.id===failing.id),failing)
  const removed=await app.db.prepare("SELECT * FROM resources WHERE unique_id=?").bind('github:'+c.id+':10').first();assert.ok(removed.removed_at)
  assert.ok((await app.db.prepare("SELECT change FROM resource_versions WHERE resource_id=?").bind(removed.id).all()).results.some(r=>r.change==='removed'))
  assert.equal((await get('/api/people')).people.length,2)
  const bytes=Buffer.from(await(await app.fetch('/api/archive/export')).arrayBuffer());await target.signin()
  const restored=await target.fetch('/api/archive/restore',{method:'POST',headers:{origin:target.origin,'content-type':'application/octet-stream','x-evidence-confirm':'restore','x-evidence-erasure-history':'unverified acknowledged'},body:bytes});assert.equal(restored.status,200,await restored.clone().text())
  for(const table of ['people','people_departures','identity_matches','resources','resource_versions'])assert.deepEqual((await target.db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()).results,(await app.db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()).results,table)
  await collectionScheduleBrowser(app,[(await get(path)).connection],{suffix:'-members',extraScreens:[{path:'/app/identities',heading:'Directory accounts',key:'identities',text:['current','GitHub northstar']},{path:'/app/inventory',heading:'Inventory',key:'inventory',text:['Former Person']}]})
 }finally{await app.close();await target.close()}
}
