// TRUST-003 and TRUST-005 through public HTTP doors. Mail submission is the runtime's network
// edge; signed Resend events below represent the provider's delivery and bounce edge.
import assert from 'node:assert/strict'
import { createHmac,generateKeyPairSync,sign } from 'node:crypto'
import { runtime } from './runtime.mjs'

// Both providers run the same public flow. Only the external mail transport is
// controlled, including definitive rejection and an ambiguous provider outage.
export async function trustRuntime(provider='resend') {
 let app
 const edge=async request=>{
  const expected=provider==='sendgrid'?'https://api.sendgrid.com/v3/mail/send':'https://api.resend.com/emails'
  if(request.url!==expected)return
  const wire=await request.json(),message=provider==='sendgrid'?{to:wire.personalizations[0].to.map(r=>r.email),subject:wire.subject,text:wire.content.find(c=>c.type==='text'+'/'+'plain')?.value,html:wire.content.find(c=>c.type==='text'+'/'+'html')?.value,headers:wire.headers}:wire
  app.messages.push(message)
  if(message.subject==='Rejected notification proof')return Response.json({message:'Synthetic rejection'},{status:400})
  if(message.subject==='Uncertain notification proof')return new Response(null,{status:503})
  return provider==='sendgrid'?new Response(null,{status:202,headers:{'x-message-id':crypto.randomUUID()}}):Response.json({id:crypto.randomUUID()})
 }
 app=await runtime({origin:'https://127.0.0.1:8787',settings:{MAIL_PROVIDER:provider,MAIL_API_KEY:'synthetic-evidence-2'},...(provider==='resend'?{mailOutbound:edge}:{outbound:edge})})
 return app
}

export async function trustJourney(app,{browserProof}={}) {
 let now='2026-10-30T12:00:00.000Z',eventSequence=0
 const provider=app.harnessState().settings.MAIL_PROVIDER,pair=generateKeyPairSync('ec',{namedCurve:'prime256v1'})
 const signingMaterial='synthetic-evidence-1',key=provider==='sendgrid'?pair.publicKey.export({type:'spki',format:'der'}).toString('base64'):'whsec_'+Buffer.from(signingMaterial).toString('base64')
 const eventPath='/trust/mail/events/'+provider,signatureHeader=provider==='sendgrid'?'x-twilio-email-event-webhook-signature':'svix-signature'
 const owner=async(path,body,status=200)=>{
  const response=await app.fetch('/api/trust'+path,{method:'POST',headers:{origin:app.origin,'content-type':'application'+'/'+'json'},body:JSON.stringify(body)}),text=await response.text()
  assert.equal(response.status,status,path+' '+text)
  return JSON.parse(text)
 }
 const get=async path=>{const response=await app.fetch(path);assert.equal(response.status,200,path+' '+await response.clone().text());return response.json()}
 const visitor=async(path,body,status=200,extra={})=>{
  const response=await app.fetch(path,{method:body===undefined?'GET':'POST',headers:{cookie:'',origin:app.origin,accept:'application'+'/'+'json',...(body===undefined?{}:{'content-type':'application'+'/'+'json'}),...extra},body:body===undefined?undefined:JSON.stringify(body)}),text=await response.text()
  assert.equal(response.status,status,path+' '+text)
  return text?JSON.parse(text):null
 }
 const mailTo=email=>app.messages.filter(m=>m.to.includes(email))
 const subscribe=async email=>{
  await visitor('/trust/subscribe',{email,categories:['subprocessors','security']},202)
  const message=mailTo(email).at(-1)
  assert.ok(message,'confirmation mail must be submitted to the provider')
  assert.ok(message.text.includes('80 Test Street'),'every message carries the postal address')
  assert.equal(message.headers['List-Unsubscribe-Post'],'List-Unsubscribe=One-Click')
  const token=message.text.match(/\/trust\/confirm\/([a-f0-9]{64})/)[1]
  assert.equal((await app.fetch('/trust/confirm/'+token,{headers:{cookie:''}})).status,200)
  return {token,message}
 }
 const signedEvent=async(delivery,type,id='trust-event-'+ ++eventSequence)=>{
  const payload=provider==='sendgrid'?[{event:type==='email.bounced'?'bounce':'delivered',sg_event_id:id,sg_message_id:delivery.provider_message_id+'.provider-suffix',rer_delivery_id:'evidence-trust-'+delivery.id,email:delivery.recipient,timestamp:Date.parse(now)/1000}]:{type,created_at:now,data:{email_id:delivery.provider_message_id,to:[delivery.recipient]}},raw=JSON.stringify(payload),timestamp=String(Date.parse(now)/1000)
  const signature=createHmac('sha256',Buffer.from(signingMaterial)).update(id+'.'+timestamp+'.'+raw).digest('base64')
  const auth=provider==='sendgrid'?{'x-twilio-email-event-webhook-timestamp':timestamp,[signatureHeader]:sign('sha256',Buffer.from(timestamp+raw),pair.privateKey).toString('base64')}:{'svix-id':id,'svix-timestamp':timestamp,[signatureHeader]:'v1,'+signature}
  const init={method:'POST',headers:{cookie:'','content-type':'application'+'/'+'json',...auth},body:raw}
  return {init,response:await app.fetch(eventPath,init)}
 }
 await app.clock(now);const ownerCookie=await app.signin()
 assert.equal((await app.fetch('/api/trust',{headers:{cookie:''}})).status,401)
 assert.equal((await app.fetch('/api/trust/settings',{method:'POST',headers:{origin:'https://foreign.test','content-type':'application'+'/'+'json'},body:'{}'})).status,403)
 const initial=await get('/api/trust')
 assert.equal(initial.settings.public_enabled,0);assert.equal(initial.settings.confirmations_enabled,0)
 await visitor('/trust/subscribe',{email:'disabled@customer.test',categories:['security']},404)
 const disabledDraft=await owner('/updates',{category:'security',title:'Disabled publication',body:'Must not send before owner authorization.',visibility:'public'},201)
 await owner('/updates/'+disabledDraft.id+'/approve',{notify:true},409)
 await owner('/settings',{postal_address:'80 Test Street, Brisbane QLD 4000, Australia',notice_days:30,public_enabled:true,confirmations_enabled:true})
 await owner('/mail-webhooks',{provider,key})
 await owner('/categories',{name:'Assurance operations',slug:'assurance-operations'},201)
 const custom=await owner('/updates',{category:'assurance-operations',title:'Draft custom category update',body:'Owner-written assurance operations draft.',visibility:'public'},201)
 assert.equal(custom.category,'assurance-operations')
 assert.ok(!(await visitor('/trust/feed')).updates.some(u=>u.id===custom.id),'custom-category drafts remain private')
 if(browserProof)await browserProof(app,{cookie:'',stage:'subscription',screens:[],followLink:false,trustForms:true})
 const alice=await subscribe('alice@customer.test')
 if(browserProof)await browserProof(app,{cookie:'',stage:'confirmation',screens:[['opt-in','/trust/confirm/'+alice.token,'Confirm subscription']],followLink:false})
 await visitor('/trust/subscribe',{email:'unconfirmed@customer.test',categories:['subprocessors']},202)
 const pendingMessage=mailTo('unconfirmed@customer.test').at(-1),pendingToken=pendingMessage.text.match(/\/trust\/confirm\/([a-f0-9]{64})/)[1]
 const pendingMailCount=app.messages.length
 await visitor('/trust/subscribe',{email:'unconfirmed@customer.test',categories:['subprocessors']},202)
 assert.equal(app.messages.length,pendingMailCount,'repeated requests do not repeat a pending confirmation')
 await owner('/settings',{postal_address:'80 Test Street, Brisbane QLD 4000, Australia',notice_days:30,public_enabled:true,confirmations_enabled:false})
 await visitor('/trust/confirm/'+pendingToken,{},409)
 await visitor('/trust/subscribe',{email:'disabled@customer.test',categories:['security']},409)
 assert.equal(app.messages.length,pendingMailCount,'disabled authorization sends nothing')
 await owner('/settings',{postal_address:'80 Test Street, Brisbane QLD 4000, Australia',notice_days:30,public_enabled:true,confirmations_enabled:true})
 const before=(await get('/api/trust')).subscriptions.filter(s=>s.state==='active')
 assert.equal(before.length,0,'GET confirmation must not silently opt the mailbox in')
 await visitor('/trust/confirm/'+alice.token,{},200)
 const confirmedHistory=(await get('/api/trust/subscribers/export')).history
 await visitor('/trust/confirm/'+alice.token,{},200)
 assert.deepEqual((await get('/api/trust/subscribers/export')).history,confirmedHistory,'reused confirmation cannot add or change consent')
 const withdrawnPending=await subscribe('withdrawn-pending@customer.test')
 await visitor(new URL(withdrawnPending.message.headers['List-Unsubscribe'].slice(1,-1)).pathname,{},200)
 await visitor('/trust/confirm/'+withdrawnPending.token,{},409)
 await owner('/subscribers',{email:'bounce@customer.test',categories:['subprocessors','security']},400)
 await owner('/subscribers',{email:'bounce@customer.test',categories:['subprocessors','security'],reason:'Contractual DPA notice obligation'},201)
 const departing=await subscribe('departing@customer.test')
 await visitor('/trust/confirm/'+departing.token,{},200)
 const unsubscribePath=new URL(departing.message.headers['List-Unsubscribe'].slice(1,-1)).pathname
 // Mailbox-provider one-click POST deliberately has no Origin or owner session.
 const unsub=await app.fetch(unsubscribePath,{method:'POST',headers:{cookie:'','content-type':'application'+'/'+'x-www-form-urlencoded'},body:'List-Unsubscribe=One-Click'})
 assert.equal(unsub.status,200)
 await visitor('/trust/confirm/'+departing.token,{},409)
 assert.ok((await get('/api/trust')).subscribers.find(s=>s.email==='departing@customer.test').unsubscribed_at,'an old confirmation cannot undo withdrawal')
 await owner('/subscribers',{email:'departing@customer.test',categories:['subprocessors'],reason:'Cannot override withdrawal'},409)
 const baseline=app.messages.length
 const draft=await owner('/subprocessors',{action:'add',name:'Atlas Storage',purpose:'Encrypted document storage',data_categories:'Business contact details and uploaded compliance reports',location:'Australia',effective_on:'2026-11-29'},201)
 await owner('/updates/'+draft.update.id+'/publish',{notify:true},409)
 assert.equal(app.messages.length,baseline,'unapproved notice must send nothing')
 assert.equal((await visitor('/trust/subprocessors')).pending.length,0,'unapproved drafts stay private')
 await owner('/updates/'+draft.update.id+'/approve',{})
 let evidence=await get('/api/trust/updates/'+draft.update.id+'/export')
 assert.deepEqual(evidence.deliveries.map(d=>d.recipient).sort(),['alice@customer.test','bounce@customer.test'])
 assert.ok(evidence.deliveries.every(d=>d.state==='pending'&&d.accepted_at),'provider acceptance is pending delivery evidence')
 assert.equal(app.messages.length,baseline+2)
 for(const delivery of evidence.deliveries){
  const sent=mailTo(delivery.recipient).find(m=>m.subject===evidence.update.title)
  assert.ok(sent);assert.equal(sent.text.split('\n\n80 Test Street')[0],evidence.update.body+'\n\nCategory: '+evidence.update.category+'\nPublished: '+evidence.update.published_at+'\nTrust center: '+app.origin+'/trust')
  assert.equal(sent.headers['List-Unsubscribe-Post'],'List-Unsubscribe=One-Click')
 }
 await owner('/updates/'+draft.update.id+'/publish',{notify:true})
 assert.equal(app.messages.length,baseline+2,'repeated publication never resends')
 for(const delivery of evidence.deliveries) {
  const event=await signedEvent(delivery,delivery.recipient.startsWith('bounce@')?'email.bounced':'email.delivered')
  assert.equal(event.response.status,202,await event.response.text())
  assert.equal((await app.fetch(eventPath,event.init)).status,202,'repeated verified provider event is idempotent')
  const forged={...event.init,headers:{...event.init.headers,[signatureHeader]:(provider==='resend'?'v1,':'')+Buffer.alloc(32).toString('base64')}}
  assert.equal((await app.fetch(eventPath,forged)).status,401)
 }
 evidence=await get('/api/trust/updates/'+draft.update.id+'/export')
 assert.deepEqual(evidence.deliveries.map(d=>d.state).sort(),['bounced','delivered'])
 assert.equal(evidence.delivery_events.length,2)
 assert.ok(evidence.update.approved_by&&evidence.update.approved_name&&evidence.update.approved_at&&evidence.update.published_at&&evidence.update.notification_started_at)
 let list=await visitor('/trust/subprocessors')
 assert.equal(list.pending[0].name,'Atlas Storage');assert.equal(list.pending[0].effective_on,'2026-11-29');assert.equal(list.active.length,0)
 if(browserProof){await browserProof(app,{cookie:'',stage:'pending',screens:[['trust','/trust','Atlas Storage']],followLink:false});await browserProof(app,{cookie:ownerCookie,stage:'notice',screens:[['overview','/app/trust','Trust updates'],['notice','/app/trust/updates/'+draft.update.id,'Export notice, approval and delivery records']],followLink:false})}
 const beforeRestart=await get('/api/trust/updates/'+draft.update.id+'/export'),messagesBeforeRestart=app.messages.length
 await app.clock('2026-10-30T12:00:00.001Z')
 assert.deepEqual(await get('/api/trust/updates/'+draft.update.id+'/export'),beforeRestart,'worker restart preserves the notice and delivery outcomes')
 await owner('/deliveries/dispatch',{})
 assert.equal(app.messages.length,messagesBeforeRestart,'worker restart never replays accepted or terminal sends')
 const security=await owner('/updates',{category:'security',title:'Encryption review complete',body:'The owner approved this public assurance update.',visibility:'public'},201)
 await owner('/updates/'+security.id+'/approve',{})
 await owner('/updates/'+security.id+'/publish',{notify:true},409)
 await owner('/updates/'+security.id+'/publish',{})
 const restricted=await owner('/updates',{category:'security',title:'Customer assurance detail',body:'Approved-customer-only assurance statement.',visibility:'customers'},201)
 await owner('/updates/'+restricted.id+'/approve',{notify:true})
 await owner('/customers',{email:'scope@customer.test',expires_at:'2026-12-31',reason:'No implicit broad access'},400)
 await owner('/customers',{email:'scope@customer.test',expires_at:'2026-12-31',read_records:[restricted.id]},400)
 await owner('/customers',{email:'scope@customer.test',reason:'Expiry is mandatory',read_records:[restricted.id]},400)
 await owner('/customers',{email:'scope@customer.test',expires_at:'2026-12-31',reason:'Submit requires read',read_records:[security.id],submit_records:[restricted.id]},400)
 await owner('/customers',{email:'scope@customer.test',expires_at:'2026-12-31',reason:'No drafts',read_records:[custom.id]},409)
 const signedOutGrant=await app.fetch('/api/trust/customers',{method:'POST',headers:{cookie:'',origin:app.origin,'content-type':'application'+'/'+'json'},body:JSON.stringify({email:'scope@customer.test',reason:'No owner session',expires_at:'2026-12-31',read_records:[restricted.id]})});assert.equal(signedOutGrant.status,401)
 const invitation=await app.fetch('/auth/invite',{method:'POST',headers:{origin:app.origin,'content-type':'application'+'/'+'json'},body:JSON.stringify({email:'operator@customer.test',displayName:'Non-owner operator',role:'admin'})})
 assert.equal(invitation.status,202)
 const invitationToken=new URL(app.messages.at(-1).html.match(/href="([^"]*\/auth\/confirm\?token=[^"]+)"/)[1].replaceAll('&amp;','&'),app.origin).searchParams.get('token')
 const joined=await app.fetch('/auth/confirm',{method:'POST',headers:{cookie:'',origin:app.origin,'content-type':'application'+'/'+'json'},body:JSON.stringify({token:invitationToken})});assert.equal(joined.status,303)
 const operatorCookie=joined.headers.getSetCookie().map(x=>x.split(';')[0]).join('; ')
 const nonOwnerGrant=await app.fetch('/api/trust/customers',{method:'POST',headers:{cookie:operatorCookie,origin:app.origin,'content-type':'application'+'/'+'json'},body:JSON.stringify({email:'scope@customer.test',reason:'Admin is not owner',expires_at:'2026-12-31',read_records:[restricted.id]})});assert.equal(nonOwnerGrant.status,403)
 const customer=await owner('/customers',{email:'alice@customer.test',expires_at:'2026-12-31',reason:'Reviewed active customer contract',subscribe_subprocessors:true,read_records:[restricted.id],submit_records:[restricted.id]},201)
 const customerPath=new URL(customer.url).pathname
 const expiredRecipient=await owner('/customers',{email:'expired-recipient@customer.test',expires_at:'2026-10-30T12:00:01.000Z',reason:'Short reviewed scope',read_records:[restricted.id]},201)
 const differentCategory=await owner('/customers',{email:'different-category@customer.test',expires_at:'2026-12-31',reason:'Only privacy subscription',read_records:[restricted.id]},201)
 await owner('/subscribers',{email:differentCategory.email,categories:['privacy'],reason:'Privacy notices only'},201)
 const revokedRecipient=await owner('/customers',{email:'revoked-recipient@customer.test',expires_at:'2026-12-31',reason:'Reviewed scope then revoked',read_records:[restricted.id]},201)
 for(const email of ['expired-recipient@customer.test','revoked-recipient@customer.test'])await owner('/subscribers',{email,categories:['security'],reason:'Contractual security notices'},201)
 await owner('/customers/'+revokedRecipient.id+'/revoke',{})
 now='2026-10-30T12:00:02.000Z';await app.clock(now)
 await visitor(new URL(expiredRecipient.url).pathname+'/feed',undefined,404)
 await owner('/settings',{postal_address:'80 Test Street, Brisbane QLD 4000, Australia',notice_days:30,public_enabled:false,confirmations_enabled:false})
 const disabledCount=app.messages.length
 await visitor('/trust/confirm/'+pendingToken,{},409)
 await owner('/updates/'+restricted.id+'/publish',{notify:true},409)
 await owner('/deliveries/dispatch',{})
 assert.equal(app.messages.length,disabledCount,'disabled publication cannot dispatch customer mail')
 await owner('/settings',{postal_address:'80 Test Street, Brisbane QLD 4000, Australia',notice_days:30,public_enabled:true,confirmations_enabled:true})
 await owner('/updates/'+restricted.id+'/publish',{notify:true})
 const restrictedEvidence=await get('/api/trust/updates/'+restricted.id+'/export')
 assert.deepEqual(restrictedEvidence.deliveries.map(d=>d.recipient),['alice@customer.test'],'customer-only mail checks explicit customer grants')
 const publicFeed=await visitor('/trust/feed'),customerFeed=await visitor(customerPath+'/feed')
 assert.ok(publicFeed.updates.some(u=>u.id===security.id));assert.ok(!publicFeed.updates.some(u=>u.id===restricted.id))
 assert.ok(customerFeed.updates.some(u=>u.id===restricted.id))
 const other=await owner('/updates',{category:'security',title:'Other customer record',body:'A separate approved scope.',visibility:'customers'},201)
 await owner('/updates/'+other.id+'/approve',{notify:true});await owner('/updates/'+other.id+'/publish',{notify:true})
 assert.equal((await get('/api/trust/updates/'+other.id+'/export')).deliveries.length,0,'customer notifications also require the named record grant')
 assert.ok(!(await visitor(customerPath+'/feed')).updates.some(u=>u.id===other.id),'new restricted records never inherit an old grant')
 const readOnly=await owner('/customers',{email:'read-only@customer.test',reason:'Read only',expires_at:'2026-12-31',read_records:[restricted.id]},201),readOnlyPath=new URL(readOnly.url).pathname
 await visitor(readOnlyPath+'/updates/'+restricted.id+'/submissions',{body:'Cannot submit'},403)
 await visitor(customerPath+'/updates/'+other.id+'/submissions',{body:'Cannot cross scope'},403)
 await visitor(customerPath+'/updates/'+restricted.id+'/submissions',{body:'Foreign submission'},403,{origin:'https://foreign.test'})
 const submitted=await visitor(customerPath+'/updates/'+restricted.id+'/submissions',{body:'Please retain this assurance statement.'},201)
 assert.equal(submitted.update_id,restricted.id)
 assert.ok((await visitor(customerPath+'/feed')).submissions.some(s=>s.id===submitted.id))
 assert.deepEqual((await visitor(readOnlyPath+'/feed')).submissions,[],'one recipient never sees another grant submission')
 const afterSubmission=await get('/api/trust/updates/'+restricted.id+'/export')
 assert.equal(afterSubmission.submissions[0].body,submitted.body);assert.deepEqual(afterSubmission.update,restrictedEvidence.update,'submission never changes a published assurance statement')
 const grantOverview=await get('/api/trust')
 assert.ok(!JSON.stringify(grantOverview).includes(customer.url.split('/').at(-1)),'link is only in the creation response')
 const savedGrant=await app.db.prepare("SELECT token_hash FROM trust_credentials WHERE subject_id=? AND kind='customer'").bind(customer.id).first()
 assert.match(savedGrant.token_hash,/^[a-f0-9]{64}$/);assert.notEqual(savedGrant.token_hash,customer.url.split('/').at(-1))
 assert.equal((await app.fetch('/api/trust',{headers:{cookie:'',authorization:'Bearer '+customer.url.split('/').at(-1)}})).status,403,'customer capability never opens owner doors')
 if(browserProof){
  await browserProof(app,{cookie:'',stage:'customer',screens:[['customer-feed',customerPath,'Customer assurance detail']],followLink:false,customerSubmission:true})
  await browserProof(app,{cookie:'',stage:'customer-read-only',screens:[['customer-feed',readOnlyPath,'Customer assurance detail']],followLink:false})
  await browserProof(app,{cookie:ownerCookie,stage:'grant',screens:[['overview','/app/trust','Named record permissions'],['submissions','/app/trust/updates/'+restricted.id,'Customer submissions']],followLink:false,issueGrant:{id:restricted.id,expires:'2026-12-31'}})
 }
 await app.clock('2026-10-30T12:00:03.000Z')
 assert.ok((await visitor(customerPath+'/feed')).submissions.some(s=>s.id===submitted.id),'submission survives worker restart')
 const customerAudit=await app.db.prepare("SELECT * FROM product_audit WHERE actor_id=? ORDER BY at,rowid").bind(customer.id).all()
 assert.ok(customerAudit.results.some(r=>r.action==='trust.customer-read'&&r.outcome==='succeeded'))
 assert.ok(customerAudit.results.some(r=>r.action==='trust.customer-submit'&&r.outcome==='succeeded'&&r.subject===restricted.id))
 assert.ok(customerAudit.results.some(r=>r.action==='trust.customer-submit'&&r.outcome==='refused'&&r.subject===other.id))
 const publicHtml=await (await app.fetch('/trust',{headers:{cookie:''}})).text()
 assert.ok(!publicHtml.includes(restricted.title));assert.ok(!publicHtml.includes('owner@example.test'));assert.ok(!publicHtml.includes('bounce@customer.test'))
 await owner('/customers/'+customer.id+'/revoke',{})
 await visitor(customerPath+'/feed',undefined,404)
 await visitor(customerPath+'/updates/'+restricted.id+'/submissions',{body:'Revoked'},404)
 const consent=await get('/api/trust/subscribers/export')
 assert.ok(consent.history.some(h=>h.source==='double-opt-in'&&h.action==='confirmed'))
 assert.ok(consent.history.some(h=>h.source==='owner-added'&&h.reason==='Contractual DPA notice obligation'))
 assert.ok(consent.history.some(h=>h.action==='unsubscribed'))
 assert.ok(!JSON.stringify(consent).includes(alice.token),'exports never include bearer credentials')
 const expiring=await owner('/customers',{email:'expiry@customer.test',expires_at:'2026-11-28',reason:'Time-bounded approved customer',read_records:[restricted.id]},201)
 now='2026-11-29T00:00:00.000Z';await app.clock(now)
 await visitor('/trust/confirm/'+pendingToken,{},404)
 assert.equal((await get('/api/trust')).subscriptions.find(s=>s.confirmation_id&&s.state==='pending')?.state,'pending','expired requests never establish consent')
 await visitor(new URL(expiring.url).pathname+'/feed',undefined,404)
 list=await visitor('/trust/subprocessors')
 assert.equal(list.pending.length,0);assert.equal(list.active[0].name,'Atlas Storage')
 if(browserProof)await browserProof(app,{cookie:'',stage:'active',screens:[['trust','/trust','Atlas Storage']],followLink:false})
 // A later change and removal each keep their own dated notice and do not mutate past evidence.
 const change=await owner('/subprocessors',{action:'change',subprocessor_id:list.active[0].id,name:'Atlas Storage',purpose:'Regional encrypted storage',data_categories:'Uploaded compliance reports',location:'New Zealand',effective_on:'2026-12-29'},201)
 await owner('/updates/'+change.update.id+'/approve',{})
 list=await visitor('/trust/subprocessors');assert.equal(list.active[0].location,'Australia');assert.equal(list.pending[0].location,'New Zealand')
 now='2026-12-29T00:00:00.000Z';await app.clock(now)
 list=await visitor('/trust/subprocessors');assert.equal(list.active[0].location,'New Zealand')
 const remove=await owner('/subprocessors',{action:'remove',subprocessor_id:list.active[0].id,name:'Atlas Storage',purpose:'Contract ended',data_categories:'Uploaded compliance reports',location:'New Zealand',effective_on:'2027-01-28'},201)
 await owner('/updates/'+remove.update.id+'/approve',{})
 now='2027-01-28T00:00:00.000Z';await app.clock(now)
 assert.equal((await visitor('/trust/subprocessors')).active.length,0)
 // Failure outcomes must survive restart and cannot turn into duplicate sends.
 for(const [title,state]of [['Rejected notification proof','failed'],['Uncertain notification proof','uncertain']]){
  const failed=await owner('/updates',{category:'security',title,body:'Owner-approved provider outcome exercise.',visibility:'public'},201)
  await owner('/updates/'+failed.id+'/approve',{notify:true});await owner('/updates/'+failed.id+'/publish',{notify:true})
  const retained=await get('/api/trust/updates/'+failed.id+'/export')
  assert.ok(retained.deliveries.length>0);assert.ok(retained.deliveries.every(d=>d.state===state&&!d.provider_message_id))
  const count=app.messages.length
  await app.clock(now);await owner('/deliveries/dispatch',{});await owner('/updates/'+failed.id+'/publish',{notify:true})
  assert.equal(app.messages.length,count,'restart and repeated publication never replay '+state+' attempts')
  assert.deepEqual(await get('/api/trust/updates/'+failed.id+'/export'),retained)
 }
 const original=await get('/api/trust/updates/'+draft.update.id+'/export')
 assert.equal(original.notice.location,'Australia');assert.deepEqual(original.deliveries.map(d=>d.state).sort(),['bounced','delivered'])
 // The complete portable archive preserves approvals and per-recipient evidence,
 // while restored mail and shares stay off and bearer credentials cannot reopen a feed.
 const portableCustomer=await owner('/customers',{email:'portable@customer.test',expires_at:'2027-03-31',reason:'Portable grant evidence',read_records:[restricted.id],submit_records:[restricted.id]},201)
 const portableCustomerPath=new URL(portableCustomer.url).pathname
 const expectedSubmission=await get('/api/trust/updates/'+restricted.id+'/export')
 const expectedConsent=await get('/api/trust/subscribers/export'),expectedNotice=await get('/api/trust/updates/'+draft.update.id+'/export')
 const archiveResponse=await app.fetch('/api/archive/export');assert.equal(archiveResponse.status,200,await archiveResponse.clone().text())
 const archive=await archiveResponse.arrayBuffer(),target=await runtime({origin:'https://127.0.0.1:8788',ownerEmail:'restored@owner.test',settings:{MAIL_API_KEY:'synthetic-evidence-3'}})
 try {
  await target.clock(now);await target.signin()
  const restored=await target.fetch('/api/archive/restore',{method:'POST',headers:{origin:target.origin,'content-type':'application'+'/'+'octet-stream','x-evidence-confirm':'restore','x-evidence-erasure-history':'unverified acknowledged'},body:archive})
  assert.equal(restored.status,200,await restored.clone().text())
  assert.deepEqual(await(await target.fetch('/api/trust/subscribers/export')).json(),expectedConsent)
  assert.deepEqual(await(await target.fetch('/api/trust/updates/'+restricted.id+'/export')).json(),expectedSubmission)
  assert.deepEqual(await(await target.fetch('/api/trust/updates/'+draft.update.id+'/export')).json(),expectedNotice)
  const overview=await(await target.fetch('/api/trust')).json()
  assert.ok(overview.customer_grants.some(g=>g.id===customer.id&&g.revoked_at),'revoked grants retain their evidence')
  assert.ok(overview.customer_grants.some(g=>g.id===portableCustomer.id&&g.revoked_at),'restored active grant evidence is revoked')
  assert.deepEqual(overview.webhooks,[],'provider verification credentials are installation-local')
  assert.equal((await target.fetch('/trust/feed',{headers:{cookie:''}})).status,404,'restored publication requires owner reauthorization')
  const messages=target.messages.length
  const dispatch=await target.fetch('/api/trust/deliveries/dispatch',{method:'POST',headers:{origin:target.origin,'content-type':'application'+'/'+'json'},body:'{}'})
  assert.equal(dispatch.status,200);assert.equal(target.messages.length,messages,'restored sends are never replayed')
  const reauthorized=await target.fetch('/api/archive/reauthorize',{method:'POST',headers:{origin:target.origin,'content-type':'application'+'/'+'json'},body:JSON.stringify({capability:'shares',subject:'*'})});assert.equal(reauthorized.status,200)
  assert.equal((await target.fetch('/trust/feed',{headers:{cookie:''}})).status,200)
  assert.equal((await target.fetch(portableCustomerPath+'/feed',{headers:{cookie:''}})).status,404,'archived grant records cannot restore their bearer credentials')
  assert.equal((await target.fetch(customerPath+'/feed',{headers:{cookie:''}})).status,404,'revoked customer grants remain inaccessible')
  assert.equal((await target.fetch(unsubscribePath,{headers:{cookie:''}})).status,404,'subscriber bearer hashes are never archived')
 } finally { await target.close() }
 console.log('PASS TRUST-003 and TRUST-005: double opt-in, reasoned subscriptions, immediate unsubscribe, approved dated changes, signed delivery and bounce evidence, scoped publication and consent exports')
 return {noticeId:draft.update.id,customerOnlyId:restricted.id}
}
