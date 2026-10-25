// Explicit held-key journey. Never runs in Verify and never persists a credential.
import assert from 'node:assert/strict'
import {runtime} from '../helpers/runtime.mjs'
const {MAIL_API_KEY,MAIL_FROM,TEST_MAIL_TO,QA_INBOX_RECEIPT_TOKEN}=process.env
if(!MAIL_API_KEY||!MAIL_FROM||!TEST_MAIL_TO||!QA_INBOX_RECEIPT_TOKEN)throw Error('Required held mail configuration is absent')
const started=new Date().toISOString(),tag='Evidence live '+crypto.randomUUID(),accepted=[]
async function provider(request){
 assert.equal(request.url,'https://api.sendgrid.com/v3/mail/send')
 const body=await request.clone().json(),recipients=body.personalizations.flatMap(p=>[...(p.to??[]),...(p.cc??[]),...(p.bcc??[])])
 assert.equal(recipients.length,1);assert.equal(recipients[0].email,TEST_MAIL_TO,'only the controlled inbox may receive mail')
 const response=await fetch(request.url,{method:request.method,headers:request.headers,body:await request.text()})
 assert.equal(response.status,202,'SendGrid must accept the actual message')
 accepted.push({subject:body.subject,id:response.headers.get('x-message-id'),body})
 return new Response(null,{status:response.status,headers:response.headers})
}
async function receipt(subject,contains){
 const url=new URL('https://rer-qa-inbox.runeditrun.workers.dev/receipts')
 for(const [k,v] of Object.entries({to:TEST_MAIL_TO,subject,since:started,limit:'50'}))url.searchParams.set(k,v)
 for(let attempt=0;attempt<24;attempt++){
  const response=await fetch(url,{headers:{authorization:'Bearer '+QA_INBOX_RECEIPT_TOKEN}})
  assert.equal(response.status,200,'QA inbox must be readable')
  const found=(await response.json()).receipts.find(r=>!contains||r.excerpt.includes(contains))
  if(found){
   assert.equal(found.auth.dmarc,'pass','receiver must authenticate the mail')
   const raw=await fetch('https://rer-qa-inbox.runeditrun.workers.dev'+found.rawUrl,{headers:{authorization:'Bearer '+QA_INBOX_RECEIPT_TOKEN}})
   assert.equal(raw.status,200)
   return {row:found,raw:await raw.text()}
  }
  await new Promise(resolve=>setTimeout(resolve,5000))
 }
 throw Error('QA inbox receipt did not arrive for the requested message')
}
const app=await runtime({origin:'https://127.0.0.1:8787',ownerEmail:TEST_MAIL_TO,settings:{MAIL_PROVIDER:'sendgrid',MAIL_API_KEY,MAIL_FROM},outbound:provider})
const post=async(path,body,{visitor=false,status=200}={})=>{
 const response=await app.fetch(path,{method:'POST',headers:{origin:app.origin,'content-type':'application'+'/'+'json',...(visitor?{cookie:''}:{})},body:JSON.stringify(body)})
 assert.equal(response.status,status,'HTTP door '+path)
 return response
}
try{
 await app.clock(started)
 await post('/auth/bootstrap',{token:app.harnessState().settings.SETUP_TOKEN,displayName:'Evidence controlled mailbox owner'},{status:303})
 await post('/auth/magic-link',{email:TEST_MAIL_TO},{status:202})
 const authMail=accepted.at(-1),authReceipt=await receipt(authMail.subject)
 // Use the delivered mail, with MIME quoted-printable folding removed, in memory.
 const decoded=authReceipt.raw.replace(/=\r?\n/g,'').replace(/=3D/g,'=').replaceAll('&amp;','&')
 const authToken=decoded.match(/\/auth\/confirm\?token=([A-Za-z0-9_-]+)/)?.[1]
 assert.ok(authToken,'received sign-in mail contains its confirmation link')
 const confirmed=await post('/auth/confirm',{token:authToken},{status:303})
 app.setCookie(confirmed.headers.getSetCookie().map(x=>x.split(';')[0]).join('; '))
 await post('/setup',{confirm:'yes'},{status:303})
 await post('/api/trust/settings',{postal_address:'80 Test Street, Brisbane QLD 4000, Australia',notice_days:30,public_enabled:true,confirmations_enabled:true})
 await post('/trust/subscribe',{email:TEST_MAIL_TO,categories:['subprocessors']},{visitor:true,status:202})
 const confirmation=accepted.at(-1),subscription=await receipt(confirmation.subject)
 const raw=subscription.raw.replace(/=\r?\n/g,'').replace(/=3D/g,'=')
 const token=raw.match(/\/trust\/confirm\/([a-f0-9]{64})/)?.[1]
 assert.ok(token,'delivered double opt-in mail contains its confirmation')
 assert.ok(raw.includes('80 Test Street'));assert.match(raw,/List-Unsubscribe-Post: List-Unsubscribe=One-Click/i)
 await post('/trust/confirm/'+token,{},{visitor:true})
 const effective=new Date(Date.parse(started)+31*86400000).toISOString().slice(0,10)
 const draft=await(await post('/api/trust/subprocessors',{action:'add',name:tag,purpose:'Controlled delivery acceptance',data_categories:'Synthetic compliance receipt',location:'Australia',effective_on:effective},{status:201})).json()
 await post('/api/trust/updates/'+draft.update.id+'/approve',{})
 const notice=accepted.at(-1),delivered=await receipt(notice.subject,tag)
 assert.ok(delivered.raw.replace(/=\r?\n/g,'').includes(tag))
 const evidence=await(await app.fetch('/api/trust/updates/'+draft.update.id+'/export')).json()
 assert.equal(evidence.deliveries.length,1);assert.equal(evidence.deliveries[0].provider_message_id,notice.id)
 assert.equal(evidence.deliveries[0].state,'pending','inbox delivery does not invent a signed provider event')
 const overview=await(await app.fetch('/api/trust')).json(),confirmationDelivery=overview.deliveries.find(d=>d.kind==='confirmation')
 assert.equal(confirmationDelivery.provider_message_id,confirmation.id)
 for(const [kind,send,inbox] of [['confirmation',confirmation,subscription],['subprocessor notice',notice,delivered]]){
  console.log(JSON.stringify({kind,provider:'sendgrid',providerMessageId:send.id,receiptId:inbox.row.id,receivedAt:inbox.row.receivedAt,messageId:inbox.row.messageId,auth:{spf:inbox.row.auth.spf,dkim:inbox.row.auth.dkim,dmarc:inbox.row.auth.dmarc}}))
 }
 console.log('PASS actual SendGrid double opt-in and approved subprocessor notice delivered to the controlled QA inbox; no live webhook configured')
}finally{await app.close()}
