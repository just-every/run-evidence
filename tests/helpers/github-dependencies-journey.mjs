import { codeManifestsJourney } from './code-manifests-journey.mjs'
import assert from 'node:assert/strict'
import {runtime} from './runtime.mjs'
import {githubFixture} from './github-fixture.mjs'
import {collectionScheduleBrowser} from './collection-schedule-browser.mjs'
export async function githubDependenciesJourney(){
 const {github,outbound}=githubFixture(),app=await runtime({outbound}),target=await runtime()
 const get=async path=>{const r=await app.fetch(path);assert.equal(r.status,200,await r.clone().text());return r.json()}
 const post=async(path,body,status=200)=>{const r=await app.fetch(path,{method:'POST',headers:{origin:app.origin,'content-type':'application/json'},body:JSON.stringify(body)});assert.equal(r.status,status,await r.clone().text());return r.json()}
 const at=async time=>{github.clock=time;await app.clock(time)},endpoint='/repos/northstar/web/dependency-graph/sbom'
 const graph={sbom:{spdxVersion:'SPDX-2.3',creationInfo:{created:'2026-10-10T18:00:00Z'},packages:[{SPDXID:'SPDXRef-openai',name:'openai',versionInfo:'6.0.0',downloadLocation:'https://synthetic-evidence-private.example.test/package',annotations:[{comment:'synthetic-evidence-private-annotation'}]},{SPDXID:'SPDXRef-react',name:'react',versionInfo:'19.2.8'}]}}
 try{
  await app.signin();await at('2026-10-11T12:00:00Z')
  const c=await post('/api/connections',{account:'northstar',token:'synthetic-evidence-1'},201),path='/api/connections/'+c.id
  await post(path+'/repositories',{repositories:['northstar/web']});github.overrides.set(endpoint,{body:graph})
  await post(path+'/collect',{},201)
  const first=(await get(path)).runs[0],history=JSON.parse(first.coverage_json).code_history['northstar/web']
  assert.equal(first.outcome,'complete');assert.deepEqual(history.dependencies.packages.map(p=>p.name),['openai','react'])
  let inventory=await get('/api/inventory'),records=inventory.records.filter(r=>r.source_type==='github.dependency')
  assert.equal(records.length,2);assert.ok(records.every(r=>r.provenance==='source-observed'&&r.attributes.source_revision===null))
  assert.ok(records.some(r=>r.name==='openai'&&r.attributes.version==='6.0.0'));assert.ok(!JSON.stringify(records).includes('private.example'))
  assert.ok(!JSON.stringify(history).includes('private-annotation'));assert.match(history.dependencies.note,/not retained original manifest files/)
  // Loss of read permission retains the original package identities as unknown.
  github.overrides.set(endpoint,{status:403,body:{message:'Resource not accessible'}})
  await at('2026-10-11T13:00:00Z');await app.tick()
  records=(await get('/api/inventory')).records.filter(r=>r.source_type==='github.dependency');assert.equal(records.length,2);assert.ok(records.every(r=>r.attributes.readable===false))
  assert.match((await get(path)).runs[0].coverage_json,/dependency graph unreadable/)
  // A malformed package list cannot admit a partial dependency set.
  github.overrides.set(endpoint,{body:{...graph,sbom:{...graph.sbom,packages:[graph.sbom.packages[0],{name:'bad package',SPDXID:'SPDXRef-bad',versionInfo:'https://synthetic-evidence-private.example.test'}]}}})
  await at('2026-10-11T14:00:00Z');await app.tick();assert.equal((await get(path)).runs[0].outcome,'partial')
  assert.ok((await get('/api/inventory')).records.filter(r=>r.source_type==='github.dependency').every(r=>r.attributes.readable===false))
  github.overrides.set(endpoint,{body:{sbom:{...graph.sbom,packages:[{...graph.sbom.packages[0],versionInfo:'6.1.0'}]}}})
  await at('2026-10-11T15:10:00Z');await app.tick()
  records=(await get('/api/inventory')).records.filter(r=>r.source_type==='github.dependency')
  assert.ok(records.some(r=>r.name==='react'&&r.collection_state==='removed'));assert.ok(records.some(r=>r.name==='openai'&&r.attributes.version==='6.1.0'))
  assert.deepEqual((await get(path)).runs.find(r=>r.id===first.id),first)
  const bytes=Buffer.from(await(await app.fetch('/api/archive/export')).arrayBuffer());await target.signin()
  const restored=await target.fetch('/api/archive/restore',{method:'POST',headers:{origin:target.origin,'content-type':'application/octet-stream','x-evidence-confirm':'restore','x-evidence-erasure-history':'unverified acknowledged'},body:bytes});assert.equal(restored.status,200,await restored.clone().text())
  for(const table of ['resources','resource_versions'])assert.deepEqual((await target.db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()).results,(await app.db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()).results)
  await collectionScheduleBrowser(app,[(await get(path)).connection],{suffix:'-dependencies',reportExpected:['openai','GitHub-generated SPDX'],extraScreens:[{path:'/app/inventory',heading:'Inventory',key:'inventory',text:['openai','react']}]})
 }finally{await app.close();await target.close()}
 await codeManifestsJourney()
}
