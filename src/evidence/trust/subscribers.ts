import type { Bindings } from '../../auth.server'
import { auditStatement, text, type Actor, type Input } from '../door'
import { Refusal } from '../upload'
import { requireCapability } from '../archive/capabilities'
import { confirmationMail, mailReady } from './delivery'
import { consent, credential, emailOf, issueCredential, requireSubscriber, selectedCategories, settings, subscriberFor, visitor, type Subscription } from './model'
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
 await requireCapability(env,'shares')
 const rules=await settings(env)
 if(!rules.public_enabled||!rules.confirmations_enabled)throw new Refusal('Subscriptions are unavailable.',409)
 const link=await credential(env,'confirmation',token,now)
 if(!link)throw new Refusal('Confirmation link is invalid or expired.',404)
 const subscriber=await requireSubscriber(env,link.subject_id)
 if(link.used_at){if(subscriber.unsubscribed_at)throw new Refusal('This request has ended. Subscribe again to choose your categories.',409);return {confirmed:true}}
 const at=now.toISOString()
 // The consent insert claims only live pending categories inside the atomic
 // batch. Withdrawal before this claim cannot be overwritten by a stale read.
 const [claimed]=await env.DB.batch([
  env.DB.prepare("INSERT INTO trust_consent_events(id,subscriber_id,category,action,source,reason,actor_id,actor_name,at) SELECT lower(hex(randomblob(16))),t.subscriber_id,t.category,'confirmed','double-opt-in','Email confirmation completed',?,?,? FROM trust_subscriptions t JOIN trust_credentials c ON c.id=t.confirmation_id WHERE t.subscriber_id=? AND t.state='pending' AND c.id=? AND c.used_at IS NULL").bind(visitor.id,visitor.name,at,link.subject_id,link.id),
  env.DB.prepare('UPDATE trust_credentials SET used_at=? WHERE id=? AND used_at IS NULL AND changes()>0').bind(at,link.id),
  env.DB.prepare('UPDATE trust_subscribers SET unsubscribed_at=NULL WHERE id=? AND changes()=1').bind(link.subject_id),
  env.DB.prepare("UPDATE trust_subscriptions SET state='active',confirmed_at=?,updated_at=?,confirmation_id=NULL WHERE subscriber_id=? AND state='pending' AND confirmation_id=? AND changes()=1").bind(at,at,link.subject_id,link.id),
 ])
 if(!claimed.meta.changes)throw new Refusal('This request has ended. Subscribe again to choose your categories.',409)
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
export async function subscriberExport(env:Bindings) {
 const [subscribers,subscriptions,history]=await Promise.all([
  env.DB.prepare('SELECT * FROM trust_subscribers ORDER BY created_at,id').all(),
  env.DB.prepare('SELECT * FROM trust_subscriptions ORDER BY subscriber_id,category').all(),
  env.DB.prepare('SELECT * FROM trust_consent_events ORDER BY at,rowid').all(),
 ])
 return {subscribers:subscribers.results,subscriptions:subscriptions.results,history:history.results}
}
