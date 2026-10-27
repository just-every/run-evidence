import type { Bindings } from '../../auth.server'
import { verifyWebhook } from './mail-verifier.mjs'
import { auditStatement, oneOf, text, type Actor, type Input } from '../door'
import { seal, unseal } from '../connect/custody'
import { Refusal, boundedBody } from '../upload'
import { tokenDigest } from '../review/storage'
import type { Delivery } from './model'
interface Webhook { provider:'resend'|'sendgrid';secret_ciphertext:string;secret_iv:string }
export async function configureWebhook(env:Bindings,actor:Actor,input:Input,now:Date) {
 const provider=oneOf(input,'provider',['resend','sendgrid'] as const),key=text(input,'key',500)
 if(provider==='resend'&&!/^whsec_[A-Za-z0-9+/]+={0,2}$/.test(key))throw new Refusal('Provide the Resend Svix webhook signing key.')
 if(provider==='sendgrid'&&!/^[A-Za-z0-9+/]+={0,2}$/.test(key))throw new Refusal('Provide the SendGrid base64 P-256 public verification key.')
 const sealed=await seal(env,key,'trust-webhook-'+provider)
 await env.DB.batch([
  env.DB.prepare('INSERT INTO trust_mail_webhooks(provider,secret_ciphertext,secret_iv,updated_by,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(provider) DO UPDATE SET secret_ciphertext=excluded.secret_ciphertext,secret_iv=excluded.secret_iv,updated_by=excluded.updated_by,updated_at=excluded.updated_at').bind(provider,sealed.ciphertext,sealed.iv,actor.id,now.toISOString()),
  auditStatement(env,actor,'trust.mail-webhook-configured',provider,now),
 ])
 return {provider,url:env.AUTH_ORIGIN+'/trust/mail/events/'+provider}
}
const statuses:Record<string,Delivery['state']|null>={'email.sent':'pending','email.delivery_delayed':'pending','email.delivered':'delivered','email.bounced':'bounced','email.failed':'failed','email.suppressed':'failed','email.complained':'failed','email.opened':null,'email.clicked':null,processed:'pending',deferred:'pending',delivered:'delivered',bounce:'bounced',dropped:'failed',spamreport:'failed',open:null,click:null,unsubscribe:null,group_unsubscribe:null,group_resubscribe:null}
interface Event { id:string;message:string;delivery:string|null;recipients:string[];state:Delivery['state'];type:string;at:number;fingerprint:string }
const bounded=(value:unknown,max=1024)=>typeof value==='string'&&value.length>0&&value.length<=max&&!/[\x00-\x1f\x7f]/.test(value)
export async function deliveryWebhook(env:Bindings,request:Request,provider:'resend'|'sendgrid',now:Date) {
 const config=await env.DB.prepare('SELECT * FROM trust_mail_webhooks WHERE provider=?').bind(provider).first<Webhook>()
 if(!config)throw new Refusal('Webhook is not configured.',401)
 const raw=await boundedBody(request,1024*1024),key=await unseal(env,config.secret_ciphertext,config.secret_iv,'trust-webhook-'+provider)
 if(!await verifyWebhook({provider,rawBody:raw,headers:request.headers,key,now:now.getTime()}))throw new Refusal('Invalid delivery-event signature.',401)
 let payload:unknown
 try{payload=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw))}catch{throw new Refusal('Invalid delivery event.')}
 const source=provider==='sendgrid'?payload:[payload]
 if(!Array.isArray(source)||!source.length||source.length>100)throw new Refusal('Send at most 100 delivery events.')
 const events:Event[]=[]
 for(const item of source) {
  if(!item||typeof item!=='object'||Array.isArray(item))throw new Refusal('Invalid delivery event.')
  const e=item as Record<string,any>,type=provider==='resend'?e.type:e.event
  if(!Object.hasOwn(statuses,type))throw new Refusal('Unsupported delivery event.')
  const state=statuses[type]
  if(!state)continue
  const id=provider==='resend'?request.headers.get('svix-id'):e.sg_event_id,message=provider==='resend'?e.data?.email_id:e.sg_message_id,
   recipients=provider==='resend'?e.data?.to:[e.email],at=provider==='resend'?Date.parse(e.created_at):e.timestamp*1000,
   delivery=provider==='sendgrid'&&typeof e.rer_delivery_id==='string'?e.rer_delivery_id:null
  if(!bounded(id)||!bounded(message)||!Array.isArray(recipients)||!recipients.length||recipients.length>100||recipients.some(v=>!bounded(v,254)||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v))||!Number.isSafeInteger(at)||at<0||at>now.getTime()+300000)throw new Refusal('Invalid delivery-event identity, recipient or time.')
  events.push({id:id!,message,recipients,state,type,at,delivery,fingerprint:await tokenDigest(JSON.stringify(item))})
 }
 const statements:D1PreparedStatement[]=[]
 let matched=0
 for(const event of events)for(const recipient of event.recipients) {
  const row=event.delivery?await env.DB.prepare('SELECT * FROM trust_deliveries WHERE provider=? AND id=? AND recipient=? AND attempted_at IS NOT NULL').bind(provider,event.delivery.replace(/^evidence-trust-/,''),recipient.toLowerCase()).first<Delivery>():await env.DB.prepare('SELECT * FROM trust_deliveries WHERE provider=? AND provider_message_id=? AND recipient=? AND attempted_at IS NOT NULL').bind(provider,event.message,recipient.toLowerCase()).first<Delivery>()
  if(!row)continue
  const receipt=crypto.randomUUID();matched++
  statements.push(
   env.DB.prepare('INSERT INTO trust_delivery_events(id,delivery_id,provider,event_id,fingerprint,state,detail,occurred_at,received_at) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(provider,event_id,delivery_id) DO UPDATE SET conflict=1 WHERE fingerprint<>excluded.fingerprint').bind(receipt,row.id,provider,event.id,event.fingerprint,event.state,'Verified provider event: '+event.type,event.at,now.toISOString()),
   env.DB.prepare("UPDATE trust_deliveries SET state=?,detail=?,provider_event_at=?,outcome_at=?,provider_message_id=COALESCE(provider_message_id,?) WHERE id=? AND EXISTS(SELECT 1 FROM trust_delivery_events WHERE id=?) AND (provider_event_at IS NULL OR provider_event_at<=?) AND (state<>'bounced' OR ?='bounced') AND (?<>'pending' OR state='pending')").bind(event.state,'Verified provider event: '+event.type,event.at,now.toISOString(),event.message,row.id,receipt,event.at,event.state,event.state),
  )
 }
 if(statements.length)try{await env.DB.batch(statements)}catch{throw new Refusal('Delivery event could not be recorded; a conflicting event identity or storage failure requires investigation.',409)}
 return {accepted:true,matched}
}
