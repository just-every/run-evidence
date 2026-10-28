import assert from 'node:assert/strict'

// One scoped privacy actor can work on the owner's named entity, never on
// another subject or the whole business. All grants travel through AUTH-001.
export async function privacyAuthorityJourney(app) {
 const ownerPost=async(path,body,status=200)=>{
  const r=await app.fetch(path,{method:'POST',headers:{origin:app.origin,'content-type':'application'+'/'+'json'},body:JSON.stringify(body)})
  assert.equal(r.status,status,path+' '+await r.clone().text());return r.json()
 }
 const email='synthetic-evidence-privacy-legal'+'@'+'example.test'
 await ownerPost('/api/roles/invitations',{email,display_name:'Privacy legal reviewer'},202)
 const token=new URL(app.messages.at(-1).html.match(/href="([^"]*\/auth\/confirm\?token=[^"]+)"/)[1].replaceAll('&amp;','&'),app.origin).searchParams.get('token')
 const signed=await app.fetch('/auth/confirm',{method:'POST',headers:{cookie:'',origin:app.origin,'content-type':'application'+'/'+'json'},body:JSON.stringify({token})})
 assert.equal(signed.status,303)
 const cookie=signed.headers.getSetCookie().map(x=>x.split(';')[0]).join('; ')
 const delegated=async(path,body,status=200)=>{
  const r=await app.fetch(path,{method:body?'POST':'GET',headers:{cookie,origin:app.origin,'content-type':'application'+'/'+'json'},...(body?{body:JSON.stringify(body)}:{})})
  assert.equal(r.status,status,path+' '+await r.clone().text())
  return r.json()
 }
 const person=await ownerPost('/api/people',{name:'synthetic-evidence-authorized-person',email:'synthetic-evidence-authorized'+'@'+'example.test',kind:'employee'},201)
 const other=await ownerPost('/api/people',{name:'synthetic-evidence-other-person',email:'synthetic-evidence-unrelated'+'@'+'example.test',kind:'employee'},201)
 const makeExhibit=async(label,subject)=>{
  const c=await app.fetch('/app/controls',{method:'POST',headers:{origin:app.origin,'content-type':'application'+'/'+'x-www-form-urlencoded'},body:new URLSearchParams({name:'Privacy authority '+label,group:'Data',proof:'Classified original',cadence:'monthly'})})
  assert.equal(c.status,303)
  const form=new FormData()
  for(const [k,v]of Object.entries({source:'synthetic-evidence-'+label,covered_from:'2026-10-11',covered_to:'2026-10-11'}))form.set(k,v)
  form.set('file',new File(['synthetic-evidence-authority-'+label],'synthetic-evidence-'+label+'.txt'))
  const r=await app.fetch(c.headers.get('location')+'/uploads',{method:'POST',headers:{origin:app.origin},body:form});assert.equal(r.status,303)
  const receipt=await (await app.fetch(r.headers.get('location').replace('/app/','/api/'))).json()
  await ownerPost('/api/privacy/classifications',{kind:'person',subject_id:subject,exhibit_id:receipt.exhibit_id,reason:'Owner classified original'},201)
  return receipt
 }
 const own=await makeExhibit('permitted',person.id),foreign=await makeExhibit('forbidden',other.id)
 const foreignRequest=await ownerPost('/api/privacy/requests',{kind:'person',subject_id:other.id,reason:'Unrelated privacy request'},201)
 const foreignHold=await ownerPost('/api/privacy/holds',{kind:'person',subject_id:other.id,reason:'Unrelated private hold',review_on:'2027-01-01'},201)
 await delegated('/api/privacy',undefined,403)
 const business=await ownerPost('/api/roles/grants',{email,role:'compliance_manager',scope_kind:'business',reason:'Ordinary program authority'},201)
 await delegated('/api/privacy',undefined,403)
 const grant=await ownerPost('/api/roles/grants',{email,role:'compliance_manager',scope_kind:'area',scope_ref:'privacy:person:'+person.id,reason:'Owner authorizes scoped privacy work'},201)
 const list=await delegated('/api/privacy')
 assert.deepEqual(list.holds,[])
 assert.deepEqual(list.requests,[])
 assert.deepEqual(list.classifications.map(c=>c.exhibit_id),[own.exhibit_id])
 for(const prefix of ['/api','/app']) {
  const response=await app.fetch(prefix+'/privacy',{headers:{cookie}})
  assert.equal(response.status,200)
  assert.ok(!(await response.text()).includes('Unrelated private hold'))
  const get=await app.fetch(prefix+'/privacy/requests/'+foreignRequest.id,{headers:{cookie}})
  assert.equal(get.status,403)
  for(const [tail,body]of [
   ['/requests',{kind:'business',reason:'Cannot erase business'}],
   ['/requests',{kind:'person',subject_id:other.id,reason:'Cannot erase unrelated subject'}],
   ['/requests',{kind:'exhibit',subject_id:foreign.exhibit_id,reason:'Cannot erase unrelated original'}],
   ['/requests/'+foreignRequest.id+'/confirm',{snapshot_hash:foreignRequest.snapshot_hash,confirm:'ERASE'}],
   ['/holds',{kind:'person',subject_id:other.id,reason:'Cannot hold unrelated subject',review_on:'2027-01-01'}],
   ['/holds/'+foreignHold.id+'/release',{reason:'Cannot release another scope'}],
   ['/classifications',{kind:'person',subject_id:person.id,exhibit_id:foreign.exhibit_id,reason:'Cannot expand own authority by classifying'}],
  ]) {
   const r=await app.fetch(prefix+'/privacy'+tail,{method:'POST',headers:{cookie,origin:app.origin,'content-type':'application'+'/'+'json'},body:JSON.stringify(body)})
   assert.equal(r.status,403,prefix+tail)
  }
 }
 // A privacy grant cannot grant itself broader authority or read other areas.
 await delegated('/api/roles/grants',{email,role:'compliance_manager',scope_kind:'area',scope_ref:'privacy:business',reason:'Refuse self expansion'},403)
 const hold=await delegated('/api/privacy/holds',{kind:'person',subject_id:person.id,reason:'Scoped counsel retention',review_on:'2027-01-01'},201)
 const preview=()=>delegated('/api/privacy/requests',{kind:'person',subject_id:person.id,reason:'Scoped exhibit erasure'},201)
 const held=await preview()
 assert.equal(JSON.parse(held.snapshot_json).held_items[0].holds[0].authorized_by,(await app.db.prepare('SELECT id FROM oa_operators WHERE email=?').bind(email).first()).id)
 await delegated('/api/privacy/requests/'+held.id+'/confirm',{snapshot_hash:held.snapshot_hash,confirm:'ERASE'},409)
 await delegated('/api/privacy/holds/'+hold.id+'/release',{reason:'Scoped counsel released retention'})
 const reviewed=await preview()
 await ownerPost('/api/roles/grants/'+grant.id+'/revoke',{reason:'Owner withdraws privacy authority'})
 await delegated('/api/privacy/requests/'+reviewed.id+'/confirm',{snapshot_hash:reviewed.snapshot_hash,confirm:'ERASE'},403)
 assert.equal(await (await (await app.mf.getR2Bucket('EXHIBITS')).get(own.object_key)).text(),'synthetic-evidence-authority-permitted')
 const renewed=await ownerPost('/api/roles/grants',{email,role:'compliance_manager',scope_kind:'area',scope_ref:'privacy:person:'+person.id,reason:'Owner restores limited privacy authority'},201)
 await app.setSettings({HARNESS_R2_DELETE_FAILURE:'true'})
 const pending=await delegated('/api/privacy/requests/'+reviewed.id+'/confirm',{snapshot_hash:reviewed.snapshot_hash,confirm:'ERASE'})
 assert.equal(pending.state,'pending')
 await ownerPost('/api/roles/grants/'+renewed.id+'/revoke',{reason:'Owner withdraws authority during provider interruption'})
 await delegated('/api/privacy/requests/'+reviewed.id+'/confirm',{snapshot_hash:reviewed.snapshot_hash,confirm:'ERASE'},403)
 await app.setSettings({HARNESS_R2_DELETE_FAILURE:undefined})
 const final=await ownerPost('/api/privacy/requests/'+reviewed.id+'/confirm',{snapshot_hash:reviewed.snapshot_hash,confirm:'ERASE'})
 assert.equal(final.state,'partial')
 assert.equal((await app.fetch('/api/receipts/'+own.id+'/download')).status,410)
 assert.equal((await app.fetch('/api/receipts/'+foreign.id+'/download')).status,200)
 const audit=(await (await app.fetch('/api/audit')).json()).entries
 assert.ok(audit.some(a=>a.action==='privacy.hold-released'&&a.subject==='hold:'+hold.id&&a.actor_name.includes('Privacy legal reviewer')&&a.reason==='Scoped counsel released retention'))
 for(const kind of ['vendor','engagement','exhibit','business']) {
  const allowed=await makeExhibit('scope-'+kind,person.id)
  const subject=kind==='vendor'?(await ownerPost('/api/vendors',{name:'synthetic-evidence-private-vendor',criticality:'low'},201)).id
   :kind==='engagement'?(await ownerPost('/api/audit-engagements',{name:'synthetic-evidence-private-engagement',period_from:'2026-10-11',period_to:'2026-10-11',control_ids:[(await (await app.fetch('/api/desk')).json()).requirements.find(q=>q.id===allowed.requirement_id).control_id]},201)).id
   :kind==='exhibit'?allowed.exhibit_id:'business'
  if(kind==='vendor')await ownerPost('/api/privacy/classifications',{kind,subject_id:subject,exhibit_id:allowed.exhibit_id,reason:'Owner selected a vendor privacy record'},201)
  const ref=kind==='business'?'privacy:business':'privacy:'+kind+':'+subject
  const area=await ownerPost('/api/roles/grants',{email,role:'compliance_manager',scope_kind:'area',scope_ref:ref,reason:'Owner selects the exact privacy scope'},201)
  const list=await delegated('/api/privacy')
  if(kind!=='business')assert.ok(!list.requests.some(r=>r.id===foreignRequest.id),'the scoped list excludes unrelated requests')
  const ownPreview=await delegated('/api/privacy/requests',{kind,subject_id:subject,reason:'Review authorized '+kind+' scope'},201)
  assert.equal(JSON.parse(ownPreview.snapshot_json).supported,true,kind)
  // Engagement scope follows its native control and submission relationships;
  // the other entity scopes follow explicit retained classifications.
  const original=await delegated('/api/privacy/requests',{kind:'exhibit',subject_id:allowed.exhibit_id,reason:'Review an original inside the selected scope'},201)
  assert.equal(JSON.parse(original.snapshot_json).subject,allowed.exhibit_id)
  if(kind!=='business') {
   await delegated('/api/privacy/requests/'+foreignRequest.id,undefined,403)
   await delegated('/api/privacy/requests',{kind:'person',subject_id:other.id,reason:'Do not cross the selected scope'},403)
  }
  const retained=await delegated('/api/privacy/holds',{kind,subject_id:subject,reason:'Scoped legal retention',review_on:'2027-01-01'},201)
  await delegated('/api/privacy/holds/'+retained.id+'/release',{reason:'Scoped legal release'})
  await ownerPost('/api/roles/grants/'+area.id+'/revoke',{reason:'Finish selected privacy scope'})
  await delegated('/api/privacy',undefined,403)
 }
 await ownerPost('/api/roles/grants/'+business.id+'/revoke',{reason:'End program review'})
 console.log('PASS ERASE-001: scoped privacy allow and deny, attributed hold release, immediate revoke and owner-controlled scope')
}
