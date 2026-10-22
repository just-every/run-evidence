import assert from 'node:assert/strict'
import {gunzipSync} from 'node:zlib'
import {runtime} from './runtime.mjs'
import {githubFixture} from './github-fixture.mjs'
import {collectionScheduleBrowser} from './collection-schedule-browser.mjs'
export async function githubFindingsJourney(){
 const {github,outbound}=githubFixture(),app=await runtime({outbound}),target=await runtime()
 const get=async path=>{const r=await app.fetch(path);assert.equal(r.status,200,await r.clone().text());return r.json()}
 const post=async(path,body,status=200)=>{const r=await app.fetch(path,{method:'POST',headers:{origin:app.origin,'content-type':'application/json'},body:JSON.stringify(body)});assert.equal(r.status,status,await r.clone().text());return r.json()}
 const at=async time=>{github.clock=time;await app.clock(time)},dep='/repos/northstar/web/dependabot/alerts?per_page=100',sec='/repos/northstar/web/secret-scanning/alerts?per_page=100&hide_secret=true'
 const dependency={number:31,state:'open',created_at:'2026-10-10T10:00:00Z',updated_at:'2026-10-11T10:00:00Z',fixed_at:null,security_advisory:{ghsa_id:'GHSA-2345-6789-abcd',cve_id:'CVE-2026-12345',severity:'high',summary:'synthetic-evidence-private-advisory'},dependency:{package:{name:'openai',ecosystem:'pip'},manifest_path:'requirements.txt',scope:'runtime'}}
 const secret={number:42,state:'open',created_at:'2026-10-10T11:00:00Z',updated_at:'2026-10-11T11:00:00Z',resolved_at:null,secret_type:'generic_private_key',secret:'synthetic-evidence-901',resolution_comment:'synthetic-evidence-private-comment',locations_url:'https://synthetic-evidence-private.example.test/location'}
 try{
  const cookie=await app.signin();await at('2026-10-11T12:00:00Z')
  const c=await post('/api/connections',{account:'northstar',token:'synthetic-evidence-1'},201),path='/api/connections/'+c.id
  await post(path+'/repositories',{repositories:['northstar/web']});github.overrides.set(dep,{body:[dependency]});github.overrides.set(sec,{body:[secret]});await post(path+'/collect',{},201)
  const original=(await get(path)).runs[0]
  let rows=(await get('/api/vulnerabilities/source-findings')).findings
  assert.equal(rows.length,2);assert.ok(rows.every(r=>r.source_ref==='github-findings:'+c.id&&r.readable&&r.current_state==='open'))
  assert.equal(rows.find(r=>r.kind==='dependabot').cve,'CVE-2026-12345');assert.equal(rows.find(r=>r.kind==='secret-scanning').severity,null,'secret severity is not invented')
  assert.equal((await get('/api/vulnerabilities')).findings.length,0,'source alerts never enter manual retest closure')
  app.setCookie('');assert.equal((await app.fetch('/api/vulnerabilities/source-findings')).status,401);app.setCookie(cookie)
  for(const marker of ['synthetic-evidence-901','synthetic-evidence-private-comment','synthetic-evidence-private-advisory','synthetic-evidence-private.example']){
   const records=(await app.db.prepare("SELECT * FROM resources WHERE type='code.finding'").all()).results
   assert.ok(!JSON.stringify(records).includes(marker));assert.ok(!JSON.stringify((await get('/api/audit')).entries).includes(marker))
   for(const r of (await get(path)).runs){const snapshot=JSON.parse(r.coverage_json).resume_pages;if(snapshot?.data)assert.ok(!gunzipSync(Buffer.from(snapshot.data,'base64')).toString().includes(marker),'normalized before durable cursor')}
  }
  github.overrides.set(dep,{body:[{...dependency,state:'fixed',fixed_at:'2026-10-11T13:00:00Z',updated_at:'2026-10-11T13:00:00Z'}]})
  await at('2026-10-11T13:10:00Z');await app.tick();rows=(await get('/api/vulnerabilities/source-findings')).findings
  const fixed=rows.find(r=>r.kind==='dependabot');assert.equal(fixed.current_state,'fixed');assert.match(fixed.verification,/no independent retest/);assert.equal((await get('/api/vulnerabilities')).findings.length,0)
  assert.ok((await get('/api/inventory')).records.some(r=>r.source_type==='code.finding'&&r.source_history.length>=2))
  github.throttleUntil=Date.parse('2026-10-11T13:30:00Z');await at('2026-10-11T13:15:00Z');await post(path+'/collect',{},201)
  assert.ok((await get('/api/vulnerabilities/source-findings')).findings.every(r=>r.current_state==='unknown'),'a failed whole-source attempt withdraws current finding coverage')
  github.throttleUntil=0;await at('2026-10-11T13:35:00Z');await post(path+'/collect',{},201)
  github.overrides.set(dep,{body:[{...dependency,number:32},{...dependency,number:'not a source number'}]})
  await at('2026-10-11T14:45:00Z');await app.tick();rows=(await get('/api/vulnerabilities/source-findings')).findings
  assert.equal(rows.length,2,'malformed source class admits no earlier valid subset');assert.equal(rows.find(r=>r.kind==='dependabot').current_state,'unknown');assert.match((await get(path)).runs[0].coverage_json,/schema drift: finding identity/)
  github.overrides.set(dep,{body:[]});await at('2026-10-11T15:55:00Z');await app.tick()
  assert.equal((await get('/api/vulnerabilities/source-findings')).findings.find(r=>r.kind==='dependabot').current_state,'unknown','absence cannot verify closure')
  github.overrides.set(dep,{body:[dependency]});await at('2026-10-11T17:05:00Z');await app.tick();assert.deepEqual((await get(path)).runs.find(r=>r.id===original.id),original)
  const bytes=Buffer.from(await(await app.fetch('/api/archive/export')).arrayBuffer());await target.signin();await target.clock('2026-10-11T17:05:00Z')
  const restored=await target.fetch('/api/archive/restore',{method:'POST',headers:{origin:target.origin,'content-type':'application/octet-stream','x-evidence-confirm':'restore','x-evidence-erasure-history':'unverified acknowledged'},body:bytes});assert.equal(restored.status,200,await restored.clone().text())
  for(const table of ['resources','resource_versions','collection_runs'])assert.deepEqual((await target.db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()).results,(await app.db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()).results)
  const inactive=await(await target.fetch('/api/vulnerabilities/source-findings')).json();assert.equal(inactive.findings.length,2);assert.ok(inactive.findings.every(r=>r.current_state==='unknown'&&!r.readable))
  await collectionScheduleBrowser(app,[(await get(path)).connection],{suffix:'-source-findings',extraScreens:[{path:'/app/vulnerabilities',heading:'Vulnerabilities',key:'source-findings',text:['Source findings','CVE-2026-12345','secret-scanning #42']}]})
  await post(path+'/revoke',{});assert.ok((await get('/api/vulnerabilities/source-findings')).findings.every(r=>r.current_state==='unknown'))
  assert.ok(github.methods.every(m=>m==='GET'))
 }finally{await app.close();await target.close()}
}
