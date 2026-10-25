import type { Bindings } from '../../auth.server'
import { auditStatement, oneOf, text, type Actor, type Input } from '../door'
import { requireCapability } from '../archive/capabilities'
import { day, validDate } from '../model'
import { Refusal } from '../upload'
import { categories, flag, requireUpdate, settings, type Change, type Update } from './model'
import { flushTrustDeliveries, mailReady } from './delivery'
export async function draftUpdate(env:Bindings,actor:Actor,input:Input,now:Date) {
 const category=text(input,'category',80)
 if(!(await categories(env)).some(c=>c.slug===category))throw new Refusal('Choose a listed update category.')
 const id=crypto.randomUUID(),title=text(input,'title',200),body=text(input,'body',20000),visibility=oneOf(input,'visibility',['public','customers'] as const)
 await env.DB.batch([env.DB.prepare('INSERT INTO trust_updates(id,category,title,body,visibility,drafted_by,drafted_name,drafted_at) VALUES(?,?,?,?,?,?,?,?)').bind(id,category,title,body,visibility,actor.id,actor.name,now.toISOString()),auditStatement(env,actor,'trust.update-drafted',id,now)])
 return requireUpdate(env,id)
}
export async function subprocessorList(env:Bindings,now:Date) {
 const changes=(await env.DB.prepare('SELECT s.* FROM trust_subprocessor_changes s JOIN trust_updates u ON u.id=s.update_id WHERE u.published_at IS NOT NULL AND u.approved_at IS NOT NULL ORDER BY s.effective_on,u.published_at,s.created_at,s.rowid').all<Change>()).results
 const active=new Map<string,Change>(),pending:Change[]=[]
 for(const change of changes) {
  if(change.effective_on>day(now)){pending.push(change);continue}
  if(change.action==='remove')active.delete(change.subprocessor_id);else active.set(change.subprocessor_id,change)
 }
 // Public payloads carry only the owner-written list and notice, never subscriber or raw source records.
 const safe=(c:Change)=>({id:c.subprocessor_id,notice_id:c.update_id,action:c.action,name:c.name,purpose:c.purpose,data_categories:c.data_categories,location:c.location,effective_on:c.effective_on})
 return {active:[...active.values()].map(c=>({...safe(c),state:'active' as const})),pending:pending.map(c=>({...safe(c),state:'pending' as const}))}
}
export async function draftSubprocessor(env:Bindings,actor:Actor,input:Input,now:Date) {
 const action=oneOf(input,'action',['add','change','remove'] as const),rules=await settings(env),effective=text(input,'effective_on',10),earliest=day(new Date(now.getTime()+rules.notice_days*86400000))
 if(!validDate(effective)||effective<earliest)throw new Refusal(`Effective date must be on or after ${earliest} to allow ${rules.notice_days} days' notice.`)
 let subprocessor=action==='add'?crypto.randomUUID():text(input,'subprocessor_id',36)
 const current=(await subprocessorList(env,now)).active.find(c=>c.id===subprocessor)
 if(action!=='add'&&!current)throw new Refusal('Choose an active subprocessor to change or remove.')
 if(await env.DB.prepare('SELECT 1 FROM trust_subprocessor_changes c JOIN trust_updates u ON u.id=c.update_id WHERE c.subprocessor_id=? AND (u.published_at IS NULL OR c.effective_on>?)').bind(subprocessor,day(now)).first())throw new Refusal('This subprocessor already has a draft or pending change.',409)
 const name=text(input,'name',200),purpose=text(input,'purpose',2000),data=text(input,'data_categories',2000),location=text(input,'location',1000),id=crypto.randomUUID(),updateId=crypto.randomUUID(),at=now.toISOString()
 const title=`Subprocessor ${action}: ${name}`,body=`${name}\nChange: ${action}\nPurpose: ${purpose}\nData categories: ${data}\nLocation: ${location}\nEffective date: ${effective}\nNotice period: ${rules.notice_days} days.`
 await env.DB.batch([
  env.DB.prepare("INSERT INTO trust_updates(id,category,title,body,visibility,drafted_by,drafted_name,drafted_at) VALUES(?,'subprocessors',?,?,'public',?,?,?)").bind(updateId,title,body,actor.id,actor.name,at),
  env.DB.prepare('INSERT INTO trust_subprocessor_changes(id,update_id,subprocessor_id,action,name,purpose,data_categories,location,effective_on,notice_days,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind(id,updateId,subprocessor,action,name,purpose,data,location,effective,rules.notice_days,at),
  auditStatement(env,actor,'trust.subprocessor-drafted',updateId,now,'succeeded',action+' '+name),
 ])
 return {update:await requireUpdate(env,updateId),change:await env.DB.prepare('SELECT * FROM trust_subprocessor_changes WHERE id=?').bind(id).first<Change>()}
}
async function noticeTiming(env:Bindings,id:string,now:Date) {
 const notice=await env.DB.prepare('SELECT * FROM trust_subprocessor_changes WHERE update_id=?').bind(id).first<Change>()
 if(notice&&notice.effective_on<day(new Date(now.getTime()+notice.notice_days*86400000)))throw new Refusal(`The effective date no longer allows ${notice.notice_days} days' advance notice. Draft a new notice with a later effective date.`,409)
 return notice
}
export async function approveUpdate(env:Bindings,actor:Actor,id:string,input:Input,now:Date) {
 const row=await requireUpdate(env,id)
 if(row.approved_at){const priorNotice=await env.DB.prepare('SELECT 1 FROM trust_subprocessor_changes WHERE update_id=?').bind(id).first();return priorNotice&&!row.published_at?publishUpdate(env,actor,id,{notify:'on'},now):row}
 const notice=await noticeTiming(env,id,now),notify=!!notice||flag(input.notify)
 if(notify)await mailReady(env)
 if(notice)await requireCapability(env,'shares')
 await env.DB.batch([
  env.DB.prepare('UPDATE trust_updates SET approved_by=?,approved_name=?,approved_at=?,notification_approved=? WHERE id=? AND approved_at IS NULL').bind(actor.id,actor.name,now.toISOString(),notify?1:0,id),
  auditStatement(env,actor,'trust.update-approved',id,now,'succeeded',notify?'Publication and category notification approved':'Publication approved; notification not authorized'),
 ])
 // DPA notices are sent when approved; ordinary updates keep a separate publication door.
 return notice?publishUpdate(env,actor,id,{notify:'on'},now):requireUpdate(env,id)
}
export async function publishUpdate(env:Bindings,actor:Actor,id:string,input:Input,now:Date) {
 await requireCapability(env,'shares')
 const row=await requireUpdate(env,id)
 if(!row.approved_at)throw new Refusal('A named owner must approve this draft before publication.',409)
 if(row.published_at)return row
 const notice=await noticeTiming(env,id,now),notify=!!notice||flag(input.notify)
 if(notify&&!row.notification_approved)throw new Refusal('The owner did not approve a notification for this update.',409)
 if(notify)await mailReady(env)
 const at=now.toISOString(),statements=[env.DB.prepare('UPDATE trust_updates SET published_at=?,notification_started_at=? WHERE id=? AND published_at IS NULL').bind(at,notify?at:null,id)]
 if(notify)statements.push(env.DB.prepare(`INSERT INTO trust_deliveries(id,update_id,subscriber_id,kind,recipient,state,detail,provider,queued_at)
 SELECT lower(hex(randomblob(16))),?,s.id,'update',s.email,'pending','Owner-approved notification queued',?,?
 FROM trust_subscribers s JOIN trust_subscriptions t ON t.subscriber_id=s.id
 WHERE s.unsubscribed_at IS NULL AND t.category=? AND t.state='active' AND t.confirmed_at IS NOT NULL
 AND (?='public' OR EXISTS(SELECT 1 FROM trust_customer_grants g JOIN trust_grant_records r ON r.grant_id=g.id WHERE g.subscriber_id=s.id AND g.revoked_at IS NULL AND g.expires_at>? AND r.update_id=? AND r.can_read=1))
 ON CONFLICT(update_id,subscriber_id) DO NOTHING`).bind(id,env.MAIL_PROVIDER??'',at,row.category,row.visibility,at,id))
 statements.push(auditStatement(env,actor,'trust.update-published',id,now,'succeeded',notify?'Owner-approved notification queued':'Published without email notification'))
 await env.DB.batch(statements)
 if(notify)await flushTrustDeliveries(env,now,id)
 return requireUpdate(env,id)
}
export async function updateExport(env:Bindings,id:string) {
 const update=await requireUpdate(env,id),[notice,deliveries]=await Promise.all([
  env.DB.prepare('SELECT * FROM trust_subprocessor_changes WHERE update_id=?').bind(id).first<Change>(),
  env.DB.prepare('SELECT * FROM trust_deliveries WHERE update_id=? ORDER BY queued_at,id').bind(id).all(),
 ])
 const events=(await env.DB.prepare('SELECT e.* FROM trust_delivery_events e JOIN trust_deliveries d ON d.id=e.delivery_id WHERE d.update_id=? ORDER BY e.occurred_at,e.id').bind(id).all()).results
 const submissions=(await env.DB.prepare('SELECT * FROM trust_submissions WHERE update_id=? ORDER BY submitted_at,id').bind(id).all<import('./grants').Submission>()).results
 return {update,notice,deliveries:deliveries.results,delivery_events:events,submissions}
}
