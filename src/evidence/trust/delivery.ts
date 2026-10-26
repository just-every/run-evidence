import type { Bindings } from '../../auth.server'
import { operatorMail } from '../../mail.server.mjs'
import { requireCapability, capabilityAllowed } from '../archive/capabilities'
import { Refusal } from '../upload'
import { escape } from '../ui'
import { issueCredential, settings, type Delivery, type Update } from './model'
export async function mailReady(env:Bindings) {
 await requireCapability(env,'mail')
 const rules=await settings(env)
 if(!rules.public_enabled)throw new Refusal('The owner must enable trust publication before sending trust mail.',409)
 if(new URL(env.AUTH_ORIGIN).protocol!=='https:')throw new Refusal('Trust email requires the HTTPS application origin for one-click unsubscribe.',409)
 if(!rules.postal_address)throw new Refusal('Set the business postal address before sending trust mail.',409)
 if(!env.MAIL_FROM||!env.MAIL_API_KEY||!['resend','sendgrid'].includes(env.MAIL_PROVIDER??'')||env.RER_DEMO==='1'||!operatorMail(env))throw new Refusal('Configure the FOLLOWUP-001 Resend or SendGrid email provider before sending trust mail.',409)
 return rules
}
export async function sendMessage(env:Bindings,row:Delivery,title:string,body:string,now:Date) {
 const rules=await mailReady(env),sender=operatorMail(env)!
 const claimed=await env.DB.prepare("UPDATE trust_deliveries SET attempted_at=? WHERE id=? AND state='pending' AND attempted_at IS NULL").bind(now.toISOString(),row.id).run()
 if(!claimed.meta.changes)return
 const unsubscribe=await issueCredential(env,'unsubscribe',row.subscriber_id,now),url=env.AUTH_ORIGIN+'/trust/unsubscribe/'+unsubscribe.token
 const text=body+'\n\n'+rules.postal_address+'\nUnsubscribe from all trust updates: '+url
 let state='uncertain',detail='The provider did not return a definitive result; this delivery is never automatically resent.',providerId:string|null=null,accepted:string|null=null
 try {
  const result=await sender.send({deliveryId:'evidence-trust-'+row.id,from:env.MAIL_FROM!,to:[row.recipient],subject:title,text,html:'<p>'+escape(text).replace(/\n/g,'<br>')+'</p>',headers:{'List-Unsubscribe':`<${url}>`,'List-Unsubscribe-Post':'List-Unsubscribe=One-Click'}})
  providerId=result.providerMessageId
  if(result.status==='accepted'){state='pending';accepted=now.toISOString();detail='Provider accepted the message. Mailbox delivery is awaiting a verified delivery event.'}
  else if(result.status!=='uncertain'){state='failed';detail='Provider '+result.status+(result.code?' ('+result.code+')':'')+'.'}
 } catch { /* The durable claim remains uncertain; never repeat an ambiguous external effect. */ }
 await env.DB.prepare('UPDATE trust_deliveries SET state=?,detail=?,provider_message_id=?,accepted_at=?,outcome_at=? WHERE id=? AND provider_message_id IS NULL AND state=\'pending\'').bind(state,detail,providerId,accepted,now.toISOString(),row.id).run()
}
export async function confirmationMail(env:Bindings,subscriber:string,email:string,token:string,now:Date) {
 const id=crypto.randomUUID()
 await env.DB.prepare("INSERT INTO trust_deliveries(id,subscriber_id,kind,recipient,state,detail,provider,queued_at) VALUES(?,?,'confirmation',?,'pending','Confirmation requested',?,?)").bind(id,subscriber,email,env.MAIL_PROVIDER??'',now.toISOString()).run()
 const row=(await env.DB.prepare('SELECT * FROM trust_deliveries WHERE id=?').bind(id).first<Delivery>())!
 await sendMessage(env,row,'Confirm your trust-center subscription','Confirm the categories you requested: '+env.AUTH_ORIGIN+'/trust/confirm/'+token+'\nThis confirmation expires in 72 hours. If you did not request it, ignore this message.',now)
}
export async function eligible(env:Bindings,row:Delivery,update:Update,now:Date) {
 const sub=await env.DB.prepare("SELECT 1 FROM trust_subscribers s JOIN trust_subscriptions t ON t.subscriber_id=s.id WHERE s.id=? AND s.unsubscribed_at IS NULL AND t.category=? AND t.state='active' AND t.confirmed_at IS NOT NULL").bind(row.subscriber_id,update.category).first()
 if(!sub)return false
 return update.visibility==='public'||!!await env.DB.prepare('SELECT 1 FROM trust_customer_grants g JOIN trust_grant_records r ON r.grant_id=g.id WHERE g.subscriber_id=? AND g.revoked_at IS NULL AND g.expires_at>? AND r.update_id=? AND r.can_read=1').bind(row.subscriber_id,now.toISOString(),update.id).first()
}
export async function flushTrustDeliveries(env:Bindings,now:Date,updateId?:string) {
 if(!await capabilityAllowed(env,'mail')||!(await settings(env)).public_enabled)return 0
 // A worker interruption after an external send must never turn into a resend.
 await env.DB.prepare("UPDATE trust_deliveries SET state='uncertain',detail='Interrupted after the delivery was claimed; the provider outcome is unknown and it will not be resent.',outcome_at=? WHERE state='pending' AND attempted_at IS NOT NULL AND accepted_at IS NULL AND attempted_at<?").bind(now.toISOString(),new Date(now.getTime()-5*60000).toISOString()).run()
 const rows=(await env.DB.prepare("SELECT * FROM trust_deliveries WHERE kind='update' AND state='pending' AND attempted_at IS NULL"+(updateId?' AND update_id=?':'')+' ORDER BY queued_at,id LIMIT 25').bind(...(updateId?[updateId]:[])).all<Delivery>()).results
 if(!rows.length)return 0
 await mailReady(env)
 let processed=0
 for(const row of rows) {
  const update=await env.DB.prepare('SELECT * FROM trust_updates WHERE id=? AND published_at IS NOT NULL AND notification_approved=1').bind(row.update_id).first<Update>()
  if(!update||!await eligible(env,row,update,now)) {
   await env.DB.prepare("UPDATE trust_deliveries SET state='failed',detail='Suppressed: subscription or customer authority ended before dispatch.',outcome_at=? WHERE id=? AND attempted_at IS NULL").bind(now.toISOString(),row.id).run();continue
  }
  await sendMessage(env,row,update.title,update.body+'\n\nCategory: '+update.category+'\nPublished: '+update.published_at+'\nTrust center: '+env.AUTH_ORIGIN+'/trust',now);processed++
 }
 return processed
}
