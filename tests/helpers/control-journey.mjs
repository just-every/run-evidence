import assert from 'node:assert/strict'
export async function controlJourney(app) {
 const get=async path=>{const r=await app.fetch(path);assert.equal(r.status,200,path+' '+await r.clone().text());return r.json()}
 const post=async(path,body,status=200)=>{const r=await app.fetch(path,{method:'POST',headers:{origin:app.origin,'content-type':'application/json'},body:JSON.stringify(body)});assert.equal(r.status,status,path+' '+await r.clone().text());return r.json()}
 await app.clock('2026-10-13T12:00:00Z')
 const created=await app.fetch('/app/controls',{method:'POST',headers:{origin:app.origin,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({name:'Production access is reviewed',group:'Access',proof:'Dated access review',cadence:'quarterly'})})
 assert.equal(created.status,303)
 const requirement=created.headers.get('location').split('/').at(-1)
 const control=(await get('/api/desk')).requirements.find(q=>q.id===requirement).control_id
 const base={name:'Production access is reviewed',group:'Access',applicability:'Production services handling customer data',test_intent:'Every production service requires MFA',evaluation_criteria:'mfa_enforced equals true',reason:'Record exact production intent'}
 await post(`/api/controls/${control}/revisions`,{...base,revision:1})
 const second=await post(`/api/controls/${control}/requirements`,{name:'Reviewer sign-off',cadence:'semi-annual'},201)
 const third=await post(`/api/controls/${control}/requirements`,{name:'Access removal sample',cadence:'annual'},201)
 assert.equal((await get(`/api/controls/${control}`)).requirements.length,3)
 await post(`/api/requirements/${third.id}/schedule`,{cadence:'annual',anchor:'fiscal-year',fiscal_start_month:'7',reason:'Fiscal review cycle'})
 await post(`/api/requirements/${second.id}/schedule`,{cadence:'semi-annual',anchor:'audit-window',window_start:'2026-02-01',reason:'Audit half year'})
 const grant=await post('/api/api-tokens',{name:'CONTROL-001 source-reported test resource',scopes:['resource-push'],expires_at:'2027-04-01'},201)
 const put=async(path,body)=>{const r=await app.fetch(path,{method:'PUT',headers:{cookie:'',authorization:'Bearer '+grant.token,'content-type':'application/json'},body:JSON.stringify(body)});assert.equal(r.status,200,await r.clone().text());return r.json()}
 await put('/v1/resource-types/control_service',{schema:{fields:{mfa_enforced:'boolean'},required:['mfa_enforced']}})
 await put('/v1/resources/control_service',{resources:[{uniqueId:'production-console',displayName:'Production console',attributes:{mfa_enforced:false}}]})
 const test=(await post('/api/tests',{name:'Production console MFA',resourceType:'control_service',criteria:JSON.stringify([{attribute:'mfa_enforced',op:'equals',value:true}]),cadence:'hourly',category:'identity',severity:'high',controls:[control]},201)).id
 await post(`/api/tests/${test}/run`,{})
 const before=await get(`/api/controls/${control}/report?from=2026-10-13&to=2026-10-14`)
 assert.equal(before.evaluated[0].result,'fail');assert.equal(before.evaluated[0].control_revision,2)
 const old=before.evaluated[0]
 await app.clock('2026-10-14T12:00:00Z')
 await post(`/api/controls/${control}/revisions`,{...base,revision:2,name:'Production access has staged rollout',test_intent:'Track staged production MFA rollout',evaluation_criteria:'mfa_enforced equals false during recorded migration',reason:'Reviewed after the failed observation'})
 await post(`/api/requirements/${second.id}/revisions`,{name:'Independent reviewer sign-off',reason:'Clarify reviewer independence'})
 await post(`/api/tests/${test}/revisions`,{criteria:JSON.stringify([{attribute:'mfa_enforced',op:'equals',value:false}]),reason:'Temporary explicit migration criterion'})
 await post(`/api/tests/${test}/run`,{})
 await post(`/api/controls/${control}/mappings`,{framework:'soc2',edition:'tsc-2017-pof-2022',ref:'CC6.1',reason:'Custom production-access mapping'},201)
 const report=await get(`/api/controls/${control}/report?from=2026-10-13&to=2026-10-14`)
 assert.deepEqual(report.evaluated.map(o=>o.result),['fail','pass'])
 assert.deepEqual(report.evaluated[0],old)
 const snapshots=report.evaluated.map(o=>JSON.parse(o.snapshot_json))
 assert.equal(snapshots[0].definition.test_intent,base.test_intent)
 assert.equal(snapshots[1].definition.test_intent,'Track staged production MFA rollout')
 assert.equal(snapshots[0].requirements.find(q=>q.id===second.id).name,'Reviewer sign-off')
 assert.equal(snapshots[1].requirements.find(q=>q.id===second.id).name,'Independent reviewer sign-off')
 assert.equal(snapshots[1].requirements.find(q=>q.id===third.id).schedule.fiscal_start_month,7)
 assert.equal(JSON.parse(report.evaluated[0].expected_json)[0].value,true)
 assert.equal(JSON.parse(report.evaluated[1].expected_json)[0].value,false)
 const prior=(await get('/api/desk?date=2026-10-13')).requirements.find(q=>q.id===second.id)
 assert.equal(prior.name,'Reviewer sign-off');assert.equal(prior.control_name,'Production access is reviewed')
 const exported=await get(`/api/controls/${control}/export`)
 assert.equal(exported.mappings.custom.find(m=>m.ref==='CC6.1').framework,'soc2')
 assert.equal(exported.revisions.length,3)
 assert.equal((await app.fetch(`/app/controls/${control}`)).status,200)
 const html=await (await app.fetch(`/app/controls/${control}/report?from=2026-10-13&to=2026-10-14`)).text()
 assert.ok(html.includes(base.test_intent)&&html.includes('Track staged production MFA rollout'))
 assert.equal((await app.fetch(`/api/controls/${control}/revisions`,{method:'POST',headers:{origin:app.origin,cookie:'','content-type':'application/json'},body:JSON.stringify({...base,revision:3})})).status,401)
 assert.equal((await app.fetch(`/api/controls/${control}/requirements`,{method:'POST',headers:{origin:'https://foreign.test','content-type':'application/json'},body:JSON.stringify({name:'forged',cadence:'daily'})})).status,403)
 return {control,requirement,test}
}
export async function controlArchiveJourney(app) {
 const {runtime}=await import('./runtime.mjs'), target=await runtime()
 try {
  await target.signin()
  const sourceResponse=await app.fetch('/api/archive/manifest');assert.equal(sourceResponse.status,200,await sourceResponse.clone().text())
  const source=(await sourceResponse.json()).manifest,tables=['control_revisions','requirement_revisions','run_control_definitions','custom_frameworks','custom_framework_requirements','custom_framework_revisions','custom_framework_mappings']
  for(const table of tables)assert.ok(source.extensions.program.rows[table].length,'CONTROL-001 populated archive includes '+table)
  const archive=await app.fetch('/api/archive/export');assert.equal(archive.status,200,await archive.clone().text());const bytes=await archive.arrayBuffer()
  const restored=await target.fetch('/api/archive/restore',{method:'POST',headers:{origin:target.origin,'content-type':'application/octet-stream','x-evidence-confirm':'restore'},body:bytes})
  assert.equal(restored.status,200,await restored.clone().text())
  const after=(await(await target.fetch('/api/archive/manifest')).json()).manifest
  for(const table of tables)assert.deepEqual(after.extensions.program.rows[table],source.extensions.program.rows[table],'CONTROL-001 archive round trip '+table)
  for(const row of source.extensions.program.rows.custom_framework_revisions.filter(r=>r.object_key)){
   const path=`/api/frameworks/${row.framework_id}/revisions/${row.revision}/file`
   const original=await app.fetch(path),received=await target.fetch(path);assert.equal(received.status,original.status);assert.deepEqual(Buffer.from(await received.arrayBuffer()),Buffer.from(await original.arrayBuffer()))
  }
 } finally {await target.close()}
}
