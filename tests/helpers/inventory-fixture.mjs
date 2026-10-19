// INVENTORY-001 public-door data shared by the HTTP and installed-browser journeys.
export async function inventoryFixture({get,post,put,population}) {
 const person = await post('/api/people', {name:'Morgan Lane',email:'morgan@northstar.test',kind:'employee',role:'engineering'})
 const unmatched = await post('/api/people', {name:'Morgan Lane',email:'morgan-unmatched@northstar.test',kind:'employee',role:'engineering'})
 const vendor = await post('/api/vendors', {name:'Northstar hosting supplier',owner_person_id:person.id,criticality:'high',data_access:'Encrypted production backups',review_due:'2027-01-01'})
 const credential = await post('/api/api-tokens', {name:'Reviewed service inventory',scopes:['resource-push','read','test-write'],expires_at:'2027-04-01'})
 const type='inventory_service'
 await put(credential.token,'/v1/resource-types/'+type,{schema:{fields:{encrypted:'boolean'},required:['encrypted']}})
 const pushed=await put(credential.token,'/v1/resources/'+type,{resources:[{uniqueId:'billing-prod',displayName:'Billing production service',attributes:{encrypted:false}}]})
 const test=await put(credential.token,'/v1/tests',{name:'Production service encryption',resourceType:type,criteria:[{attribute:'encrypted',op:'equals',value:true}],cadence:'hourly',category:'cloud',severity:'high'},'POST',201)
 const roster=await population('roster','HR operations','email,name,employment_type\r\nmorgan@northstar.test,Morgan Lane,W-2\r\n')
 const accounts=await population('accounts','Design application','account_id,email,name,status\r\nDESIGN-1,morgan@northstar.test,Morgan Lane,active\r\nUNMATCHED,unknown@northstar.test,External service,active\r\n')
 const devices=[]
 for(const source of ['Operations device register','Engineering device register']) devices.push(await population('devices',source,'serial,hostname,owner_email,encrypted\r\nSAME-SERIAL,morgan-laptop,morgan@northstar.test,yes\r\n'))
 for(const upload of [roster,accounts,devices[0]]) {
  const detail=await get('/api/populations/'+upload.id)
  await post('/api/populations/rows/'+detail.rows[0].id+'/match',{person_id:person.id,decision:'approved'},200)
 }
 return {person,unmatched,vendor,resource:pushed.results[0],test,roster,accounts,devices,credential,type}
}
