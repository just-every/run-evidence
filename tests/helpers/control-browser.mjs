import assert from 'node:assert/strict'
export async function controlBrowserJourney(page,origin,width,capture) {
 const request=page.context().request
 const post=async(path,data,status=200)=>{const r=await request.post(origin+path,{headers:{origin},data});assert.equal(r.status(),status,path+' '+await r.text());return r.json()}
 await page.goto(origin+'/app')
 await page.getByLabel('Control in plain words').fill(`Production access review ${width}`)
 await page.getByLabel('Named proof',{exact:true}).fill('Dated production access review')
 await page.getByLabel('Group',{exact:true}).selectOption('Access')
 await page.getByLabel('Cadence',{exact:true}).selectOption('quarterly')
 await page.getByRole('button',{name:'Add control',exact:true}).click();await page.waitForURL('**/app/requirements/*')
 const requirement=page.url().split('/').at(-1),desk=await(await request.get(origin+'/api/desk')).json(),control=desk.requirements.find(q=>q.id===requirement).control_id
 await capture(page,`${width}-control-requirement`)
 await page.goto(origin+'/app/controls/'+control)
 const edit=()=>page.locator(`form[action="/app/controls/${control}/revisions"]`)
 await edit().getByLabel('Applicability').fill('Production services handling customer data')
 await edit().getByLabel('Test intent').fill('Every production service requires MFA')
 await edit().getByLabel('Evaluation criteria').fill('mfa_enforced equals true')
 await edit().getByLabel('Reason').fill('Document production-access assurance')
 await edit().getByRole('button').click();await page.waitForURL('**/app/controls/'+control)
 for(const [name,cadence] of [['Independent reviewer sign-off','semi-annual'],['Access removal sample','annual']]){
  const add=page.locator(`form[action="/app/controls/${control}/requirements"]`)
  await add.getByLabel('Named proof').fill(name);await add.getByLabel('Cadence').selectOption(cadence)
  await add.getByRole('button').click();await page.waitForURL('**/app/requirements/*')
  await page.goto(origin+'/app/controls/'+control)
 }
 const grant=await post('/api/api-tokens',{name:`Production inventory ${width}`,scopes:['resource-push'],expires_at:new Date(Date.now()+86400000*30).toISOString().slice(0,10)},201)
 const type='control_browser_'+width,put=async(path,data)=>{const r=await request.put(origin+path,{headers:{authorization:'Bearer '+grant.token},data});assert.equal(r.status(),200,await r.text())}
 await put('/v1/resource-types/'+type,{schema:{fields:{mfa_enforced:'boolean'},required:['mfa_enforced']}})
 await put('/v1/resources/'+type,{resources:[{uniqueId:'production-console',displayName:'Production console',attributes:{mfa_enforced:false}}]})
 const test=(await post('/api/tests',{name:'Production console MFA',resourceType:type,criteria:JSON.stringify([{attribute:'mfa_enforced',op:'equals',value:true}]),cadence:'hourly',category:'identity',severity:'high',controls:[control]},201)).id
 await post(`/api/tests/${test}/run`,{})
 await edit().getByLabel('Test intent').fill('Track staged production MFA rollout')
 await edit().getByLabel('Evaluation criteria').fill('Explicit temporary migration criterion; preserve earlier failure')
 await edit().getByLabel('Reason').fill('Owner-reviewed revision after failed observation')
 await edit().getByRole('button').click();await page.waitForURL('**/app/controls/'+control)
 await post(`/api/tests/${test}/revisions`,{criteria:JSON.stringify([{attribute:'mfa_enforced',op:'equals',value:false}]),reason:'Explicit migration criterion'})
 await post(`/api/tests/${test}/run`,{})
 await page.reload();await capture(page,`${width}-control-definition`)
 const today=new Date().toISOString().slice(0,10)
 const reportPath=`/app/controls/${control}/report?from=${today}&to=${today}`
 const report=await(await request.get(origin+reportPath.replace('/app/','/api/'))).json()
 assert.deepEqual(report.evaluated.map(o=>o.result),['fail','pass'])
 await page.goto(origin+reportPath)
 for(const summary of await page.locator('main summary').all())await summary.click()
 await capture(page,`${width}-control-historical-report`)
 await page.goto(origin+'/app');await capture(page,`${width}-control-desk`)
 await page.goto(origin+'/app/programs');await capture(page,`${width}-control-programs`)
 return {control,requirement,test}
}
