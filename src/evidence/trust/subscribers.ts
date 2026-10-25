import type { Bindings } from '../../auth.server'
import { auditStatement, text, type Actor, type Input } from '../door'
import { requireCapability } from '../archive/capabilities'
import { Refusal } from '../upload'
import { confirmationMail, mailReady } from './delivery'
import { consent, credential, emailOf, flag, issueCredential, requireSubscriber, selectedCategories, settings, subscriberFor, visitor, type CustomerGrant, type Subscription } from './model'
export async function subscribe(env:Bindings,input:Input,now:Date) {
 const rules=await settings(env)
 if(!rules.public_enabled||!rules.confirmations_enabled)throw new Refusal('Subscriptions are unavailable.',409)
 await mailReady(env)
 const email=emailOf(input),chosen=await selectedCategories(env,input),subscriber=await subscriberFor(env,email,now)
 const prior=(await env.DB.prepare('SELECT * FROM trust_subscriptions WHERE subscriber_id=?').bind(subscriber.id).all<Subscription>()).results
 const requested=chosen.filter(c=>!prior.some(p=>p.category===c&&p.state==='active')||!!subscriber.unsubscribed_at)
 if(!requested.length)return {requested:true}
 // A live request is not reissued by repeated public form submissions.
 const pending=await env.DB.prepare("SELECT 1 FROM trust_credentials WHERE kind='confirmation' AND subject_id=? AND used_at IS NULL AND expires_at>?").bind(subscriber.id,now.toISOString()).first()
 if(pending)return {requested:true}
 const link=await issueCredential(env,'confirmation',subscriber.id,now,new Date(now.getTime()+72*3600000).toISOString())
 await env.DB.batch(requested.flatMap(category=>[
  env.DB.prepare("INSERT INTO trust_subscriptions(subscriber_id,category,state,source,reason,confirmation_id,updated_at) VALUES(?,?,'pending','double-opt-in','Visitor requested confirmation',?,?) ON CONFLICT(subscriber_id,category) DO UPDATE SET state='pending',source='double-opt-in',reason=excluded.reason,confirmation_id=excluded.confirmation_id,confirmed_at=NULL,updated_at=excluded.updated_at").bind(subscriber.id,category,link.id,now.toISOString()),
  consent(env,subscriber.id,category,'requested','double-opt-in','Visitor requested confirmation',visitor,now),
 ]))
 await confirmationMail(env,subscriber.id,email,link.token,now)
 return {requested:true}
}
export async function confirm(env:Bindings,token:string,now:Date) {
 const link=await credential(env,'confirmation',token,now)
 if(!link)throw new Refusal('Confirmation link is invalid or expired.',404)
 if(link.used_at)return {confirmed:true}
 const pending=(await env.DB.prepare("SELECT category FROM trust_subscriptions WHERE subscriber_id=? AND state='pending' AND confirmation_id=?").bind(link.subject_id,link.id).all<{category:string}>()).results
 if(!pending.length)throw new Refusal('This request has ended. Subscribe again to choose your categories.',409)
 const at=now.toISOString()
 await env.DB.batch([
  env.DB.prepare('UPDATE trust_credentials SET used_at=? WHERE id=? AND used_at IS NULL').bind(at,link.id),
  env.DB.prepare('UPDATE trust_subscribers SET unsubscribed_at=NULL WHERE id=?').bind(link.subject_id),
  env.DB.prepare("UPDATE trust_subscriptions SET state='active',confirmed_at=?,updated_at=?,confirmation_id=NULL WHERE subscriber_id=? AND state='pending' AND confirmation_id=?").bind(at,at,link.subject_id,link.id),
  ...pending.map(p=>consent(env,link.subject_id,p.category,'confirmed','double-opt-in','Email confirmation completed',visitor,now)),
 ])
 return {confirmed:true}
}
export async function unsubscribe(env:Bindings,token:string,now:Date) {
 const link=await credential(env,'unsubscribe',token,now)
 if(!link)throw new Refusal('Unsubscribe link not found.',404)
 const subscriber=await requireSubscriber(env,link.subject_id)
 if(subscriber.unsubscribed_at)return {unsubscribed:true}
 const at=now.toISOString()
 await env.DB.batch([
  env.DB.prepare('UPDATE trust_subscribers SET unsubscribed_at=? WHERE id=?').bind(at,subscriber.id),
  env.DB.prepare("UPDATE trust_subscriptions SET state='unsubscribed',confirmation_id=NULL,updated_at=? WHERE subscriber_id=?").bind(at,subscriber.id),
  env.DB.prepare("UPDATE trust_credentials SET used_at=? WHERE subject_id=? AND kind='confirmation' AND used_at IS NULL").bind(at,subscriber.id),
  consent(env,subscriber.id,null,'unsubscribed','one-click','Unsubscribe from all trust updates',visitor,now),
 ])
 return {unsubscribed:true}
}
export async function addSubscriptions(env:Bindings,actor:Actor,input:Input,now:Date,source:'owner-added'|'customer-grant'='owner-added') {
 const reason=text(input,'reason',1000),email=emailOf(input),chosen=await selectedCategories(env,input),subscriber=await subscriberFor(env,email,now)
 if(subscriber.unsubscribed_at)throw new Refusal('This address unsubscribed. Only a new double opt-in may reactivate it.',409)
 const at=now.toISOString()
 await env.DB.batch(chosen.flatMap(category=>[
  env.DB.prepare("INSERT INTO trust_subscriptions(subscriber_id,category,state,source,reason,confirmed_at,updated_at) VALUES(?,?,'active',?,?,?,?) ON CONFLICT(subscriber_id,category) DO UPDATE SET state='active',source=excluded.source,reason=excluded.reason,confirmation_id=NULL,confirmed_at=excluded.confirmed_at,updated_at=excluded.updated_at").bind(subscriber.id,category,source,reason,at,at),
  consent(env,subscriber.id,category,'subscribed',source,reason,actor,now),
  auditStatement(env,actor,'trust.subscriber-added',subscriber.id,now,'succeeded',source,{reason}),
 ]))
 return {subscriber,subscriptions:(await env.DB.prepare('SELECT * FROM trust_subscriptions WHERE subscriber_id=?').bind(subscriber.id).all<Subscription>()).results}
}
export async function grantCustomer(env:Bindings,actor:Actor,input:Input,now:Date) {
 await requireCapability(env,'shares')
 const reason=text(input,'reason',1000),email=emailOf(input),raw=text(input,'expires_at',30),date=new Date(raw.length===10?raw+'T23:59:59.999Z':raw)
 if(!Number.isFinite(date.getTime())||date.getTime()<=now.getTime())throw new Refusal('Give a future customer-grant expiry date.')
 const expires=date.toISOString(),subscriber=await subscriberFor(env,email,now),id=crypto.randomUUID(),at=now.toISOString()
 await env.DB.batch([
  env.DB.prepare('INSERT INTO trust_customer_grants(id,subscriber_id,reason,approved_by,approved_name,approved_at,expires_at) VALUES(?,?,?,?,?,?,?)').bind(id,subscriber.id,reason,actor.id,actor.name,at,expires),
  auditStatement(env,actor,'trust.customer-approved',id,now,'succeeded','Explicit customer-only feed grant',{reason}),
 ])
 if(flag(input.subscribe_subprocessors)&&!subscriber.unsubscribed_at)await addSubscriptions(env,actor,{email,categories:['subprocessors'],reason},now,'customer-grant')
 const issued=await issueCredential(env,'customer',id,now,expires)
 return {id,subscriber_id:subscriber.id,expires_at:expires,url:env.AUTH_ORIGIN+'/trust/customer/'+issued.token}
}
export async function revokeCustomer(env:Bindings,actor:Actor,id:string,now:Date) {
 const row=await env.DB.prepare('SELECT * FROM trust_customer_grants WHERE id=?').bind(id).first<CustomerGrant>()
 if(!row)throw new Refusal('Customer grant not found.',404)
 await env.DB.batch([env.DB.prepare('UPDATE trust_customer_grants SET revoked_at=?,revoked_by=? WHERE id=? AND revoked_at IS NULL').bind(now.toISOString(),actor.id,id),auditStatement(env,actor,'trust.customer-revoked',id,now)])
 return {revoked:true}
}
export async function customerAccess(env:Bindings,token:string,now:Date) {
 await requireCapability(env,'shares')
 const link=await credential(env,'customer',token,now)
 if(!link)return null
 return env.DB.prepare('SELECT * FROM trust_customer_grants WHERE id=? AND revoked_at IS NULL AND expires_at>?').bind(link.subject_id,now.toISOString()).first<CustomerGrant>()
}
export async function subscriberExport(env:Bindings) {
 const [subscribers,subscriptions,history]=await Promise.all([
  env.DB.prepare('SELECT * FROM trust_subscribers ORDER BY created_at,id').all(),
  env.DB.prepare('SELECT * FROM trust_subscriptions ORDER BY subscriber_id,category').all(),
  env.DB.prepare('SELECT * FROM trust_consent_events ORDER BY at,rowid').all(),
 ])
 return {subscribers:subscribers.results,subscriptions:subscriptions.results,history:history.results}
}
