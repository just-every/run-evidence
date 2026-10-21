// WORK-001: owner mapping, native deadline writes, visible conflict and recovery.
import assert from 'node:assert/strict'
export async function azureDeadlineBrowser({page,app,edge,cookie,destination,width,capture}) {
 const post=async(path,body,token)=>{
  const response=await app.fetch(path,{method:'POST',headers:{cookie:token?'':cookie,origin:app.origin,'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},body:JSON.stringify(body)})
  assert.ok([200,201].includes(response.status),await response.clone().text());return response.json()
 }
 const v1=async(token,method,path,body)=>{const r=await app.fetch(path,{method,headers:{cookie:'',authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify(body)});assert.ok([200,201].includes(r.status));return r.json()}
 const submit=async name=>{await Promise.all([page.waitForNavigation(),page.getByRole('button',{name,exact:true}).click()])}
 await page.getByLabel('Azure Boards due-date field reference').fill('Custom.RemediationDue')
 await submit('Save mapping')
 assert.equal(await page.getByLabel('Azure Boards due-date field reference').inputValue(),'Custom.RemediationDue')
 await capture('azure-mapping-saved')
 const push=await post('/api/api-tokens',{name:'Browser source '+width,scopes:['resource-push','test-write'],expires_at:'2027-04-01'})
 const type='azure_browser_'+width
 await v1(push.token,'PUT','/v1/resource-types/'+type,{schema:{fields:{secure:'boolean'}}})
 await v1(push.token,'PUT','/v1/resources/'+type,{resources:[{uniqueId:'billing',displayName:'Billing production service',attributes:{secure:false}}]})
 const test=await v1(push.token,'POST','/v1/tests',{name:'Billing service access is restricted',resourceType:type,criteria:[{attribute:'secure',op:'equals',value:true}],cadence:'daily',category:'identity',severity:'high',controls:['AC-05']})
 const queue=await (await app.fetch('/api/remediation',{headers:{cookie}})).json(),ob=queue.open.find(o=>o.test_id===test.id)
 const detail=async()=>{const r=await app.fetch('/api/remediation/'+ob.id,{headers:{cookie}});assert.equal(r.status,200);return r.json()}
 await page.goto(new URL('/app/remediation/'+ob.id,page.url()).href)
 await page.getByLabel('Target date',{exact:true}).fill('2026-12-01');await submit('Assign')
 await page.getByLabel('Destination',{exact:true}).selectOption(destination.id);await submit('Create linked ticket')
 const ticket=(await detail()).tickets[0],remote=edge.find('azure-boards',ticket.remote_id)
 assert.equal(remote.due,'2026-12-01')
 await page.getByLabel('Target date',{exact:true}).fill('2026-12-03');await submit('Assign')
 await submit('Read now');assert.equal(remote.due,'2026-12-03')
 await capture('azure-native-date-updated')
 remote.due='2026-12-04'
 await page.getByLabel('Target date',{exact:true}).fill('2026-12-05');await submit('Assign');await submit('Read now')
 const conflict=await detail();assert.equal(conflict.tickets[0].sync_state,'conflict');assert.equal(conflict.tickets[0].remote_due,'2026-12-04')
 assert.ok(await page.getByRole('button',{name:'Resolve conflict',exact:true}).isVisible())
 await capture('azure-date-conflict')
 await page.getByLabel('Keep which due date').selectOption('evidence');await submit('Resolve conflict')
 assert.equal(remote.due,'2026-12-05');assert.equal((await detail()).tickets[0].sync_state,'linked')
 assert.equal(await page.getByRole('button',{name:'Resolve conflict',exact:true}).count(),0)
 await capture('azure-date-resolved')
 console.log(`PASS WORK-001: Azure mapping save, native deadline change, conflict and owner resolution at ${width}`)
}
