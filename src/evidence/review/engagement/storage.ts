import { reviewSettings,settingsFor } from './sharing'
import type { Bindings } from '../../../auth.server'
import { auditStatement, text, type Actor, type Input } from '../../door'
import { validDate } from '../../model'
import { Refusal } from '../../upload'
import { activeControl } from '../../visibility'
import { receipt } from '../../storage'
import { projectReceipt } from '../storage'
import { requireCapability } from '../../archive/capabilities'
export interface Engagement {id:string;name:string;period_from:string;period_to:string;created_by:string;created_at:string;closed_at:string|null}
export interface AuditRequest {id:string;engagement_id:string;control_id:string;title:string;owner_person_id:string;due_date:string;created_by:string;created_at:string;closed_at:string|null}
export const rows=async<T=Record<string,any>>(env:Pick<Bindings,'DB'>,sql:string,...values:any[]) => (await env.DB.prepare(sql).bind(...values).all<T>()).results
export async function engagement(env:Bindings,id:string){const row=await env.DB.prepare('SELECT * FROM audit_engagements WHERE id=?').bind(id).first<Engagement>();if(!row)throw new Refusal('Engagement not found.',404);return row}
export async function requestOf(env:Bindings,e:string,id:string){const row=await env.DB.prepare('SELECT * FROM audit_requests WHERE id=? AND engagement_id=?').bind(id,e).first<AuditRequest>();if(!row)throw new Refusal('Request not found.',404);return row}
export async function authorized(env:Bindings,e:string,email:string,now:Date){return !!await env.DB.prepare('SELECT 1 FROM audit_grants g JOIN audit_engagements e ON e.id=g.engagement_id WHERE g.engagement_id=? AND g.email=? AND g.revoked_at IS NULL AND g.expires_at>? AND e.closed_at IS NULL').bind(e,email,now.toISOString()).first()}
export const auditIdentity=async(env:Bindings,email:string)=>!!await env.DB.prepare('SELECT 1 FROM audit_identities WHERE email=?').bind(email).first()
export async function createEngagement(env:Bindings,input:Input,actor:Actor,now:Date){
 const settings=reviewSettings(input)
 const name=text(input,'name',200),from=text(input,'period_from'),to=text(input,'period_to');if(!validDate(from)||!validDate(to)||from>to)throw new Refusal('Choose an inclusive UTC audit period.')
 const ids=Array.isArray(input.control_ids)?[...new Set(input.control_ids)]:[];if(!ids.length||ids.length>100)throw new Refusal('Choose 1 to 100 controls.')
 for(const id of ids)if(!await env.DB.prepare('SELECT 1 FROM controls c WHERE c.id=? AND '+activeControl('c')).bind(id).first())throw new Refusal('Choose existing controls.')
 const e:Engagement={id:crypto.randomUUID(),name,period_from:from,period_to:to,created_by:actor.id,created_at:now.toISOString(),closed_at:null}
 await env.DB.batch([env.DB.prepare('INSERT INTO audit_engagements(id,name,period_from,period_to,created_by,created_at) VALUES(?,?,?,?,?,?)').bind(e.id,name,from,to,actor.id,e.created_at),...ids.map(id=>env.DB.prepare('INSERT INTO audit_scope VALUES(?,?)').bind(e.id,id)),env.DB.prepare('INSERT INTO audit_review_settings VALUES(?,?,?)').bind(e.id,settings.detail_level,JSON.stringify(settings.hidden_attributes)),auditStatement(env,actor,'audit.engagement.created',e.id,now)])
 return e
}
export async function importRequests(env:Bindings,e:Engagement,input:Input,actor:Actor,now:Date){
 if(e.closed_at)throw new Refusal('Engagement is closed.',409)
 if((await settingsFor(env,e)).detail_level==='Restricted')throw new Refusal('Restricted request evidence projection is not yet available.',409)
 let list:any;try{list=JSON.parse(text(input,'requests',60000))}catch{throw new Refusal('Provide a JSON request list.')}
 if(!Array.isArray(list)||!list.length||list.length>100)throw new Refusal('Import 1 to 100 requests.')
 const statements:D1PreparedStatement[]=[],ids:string[]=[]
 for(const item of list){if(!item||typeof item!=='object')throw new Refusal('Invalid request.');const title=text(item,'title',500),control=text(item,'control_id'),person=text(item,'owner_person_id'),due=text(item,'due_date')
  if(!validDate(due))throw new Refusal('Provide a valid request due date.')
  if(!await env.DB.prepare('SELECT 1 FROM audit_scope WHERE engagement_id=? AND control_id=?').bind(e.id,control).first())throw new Refusal('Request control is outside the engagement scope.')
  if(!await env.DB.prepare('SELECT 1 FROM people p WHERE id=? AND NOT EXISTS(SELECT 1 FROM people_departures d WHERE d.person_id=p.id)').bind(person).first())throw new Refusal('Choose a current request owner from People.')
  const id=crypto.randomUUID();ids.push(id);statements.push(env.DB.prepare('INSERT INTO audit_requests(id,engagement_id,control_id,title,owner_person_id,due_date,created_by,created_at) SELECT ?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM audit_engagements WHERE id=? AND closed_at IS NULL)').bind(id,e.id,control,title,person,due,actor.id,now.toISOString(),e.id))
 }
 const result=await env.DB.batch([...statements,env.DB.prepare("INSERT INTO product_audit(id,actor_kind,actor_id,actor_name,action,subject,outcome,detail,at) SELECT ?,'owner',?,?,'audit.requests.imported',?,'succeeded',?,? WHERE EXISTS(SELECT 1 FROM audit_requests WHERE id=?)").bind(crypto.randomUUID(),actor.id,actor.name,e.id,`${ids.length} requests`,now.toISOString(),ids[0])])
 if(!result[0].meta.changes)throw new Refusal('Engagement is closed.',409)
 return {ids}
}
export async function scopedSubmissionReceipt(env:Bindings,e:Engagement,r:AuditRequest,id:string){
 const row=await receipt(env,id)
 if(!row||row.covered_from<e.period_from||row.covered_to>e.period_to||!await env.DB.prepare('SELECT 1 FROM requirements WHERE id=? AND control_id=?').bind(row.requirement_id,r.control_id).first())throw new Refusal('Receipt is outside this request and audit period.',404)
 return row
}
export async function submit(env:Bindings,e:Engagement,r:AuditRequest,input:Input,actor:Actor,now:Date){
 if(e.closed_at||r.closed_at)throw new Refusal('Request is closed.',409)
 const row=await scopedSubmissionReceipt(env,e,r,text(input,'receipt_id')),id=crypto.randomUUID()
 const result=await env.DB.batch([env.DB.prepare('INSERT INTO audit_submissions(id,request_id,receipt_id,revision,actor_id,actor_name,at) SELECT ?,?,?,COALESCE((SELECT MAX(revision) FROM audit_submissions WHERE request_id=?),0)+1,?,?,? WHERE EXISTS(SELECT 1 FROM audit_requests r JOIN audit_engagements e ON e.id=r.engagement_id WHERE r.id=? AND r.closed_at IS NULL AND e.closed_at IS NULL)').bind(id,r.id,row.id,r.id,actor.id,actor.name,now.toISOString(),r.id),env.DB.prepare("INSERT INTO product_audit(id,actor_kind,actor_id,actor_name,action,subject,outcome,detail,at,reason,revision) SELECT ?,'owner',?,?,'audit.request.submitted',?,'succeeded','',?,'',? WHERE EXISTS(SELECT 1 FROM audit_submissions WHERE id=?)").bind(crypto.randomUUID(),actor.id,actor.name,r.id,now.toISOString(),row.id,id)])
 if(!result[0].meta.changes)throw new Refusal('Request is closed.',409)
 return {id,receipt_id:row.id}
}
export async function projection(env:Bindings,e:Engagement){
 const requests=await rows<AuditRequest>(env,'SELECT * FROM audit_requests WHERE engagement_id=? ORDER BY created_at,id',e.id)
 const projected=[]
 for(const r of requests){
  const submissions=await rows(env,'SELECT id,receipt_id,revision,actor_name,at FROM audit_submissions WHERE request_id=? ORDER BY revision',r.id)
  const receipts=[];for(const s of submissions){const row=await scopedSubmissionReceipt(env,e,r,s.receipt_id);receipts.push({...s,receipt:projectReceipt(row,new Set())})}
  // Only observations mapped to this request control and observed within its period are disclosed.
  const observations=await rows(env,`SELECT o.id,o.test_id,o.revision,o.resource_id,o.result,o.reason,o.source_kind,o.source_ref,o.observed_at,
   c.provider AS source_connector,c.account AS source_account
   FROM observations o LEFT JOIN connections c ON o.source_kind='source-observed' AND (o.source_ref=c.id OR substr(o.source_ref,-length(c.id)-1)=':'||c.id)
   WHERE o.observed_at>=? AND o.observed_at<? AND EXISTS(SELECT 1 FROM test_controls tc WHERE tc.test_id=o.test_id AND tc.control_id=?) ORDER BY o.observed_at,o.id`,e.period_from+'T00:00:00.000Z',new Date(Date.parse(e.period_to+'T00:00:00Z')+86400000).toISOString(),r.control_id)
  const decisions=await rows(env,'SELECT id,submission_id,revision,state,reason,actor_id,actor_name,at FROM audit_decisions WHERE request_id=? ORDER BY revision',r.id)
  const exceptions=await rows(env,`SELECT x.id,x.test_id,x.resource_id,x.reason,x.approved_name,x.approved_at,x.expires_at,x.revoked_at FROM test_exceptions x WHERE x.approved_at<? AND x.expires_at>=? AND (x.revoked_at IS NULL OR x.revoked_at>=?) AND EXISTS(SELECT 1 FROM test_controls tc WHERE tc.test_id=x.test_id AND tc.control_id=?) ORDER BY x.approved_at,x.id`,new Date(Date.parse(e.period_to+'T00:00:00Z')+86400000).toISOString(),e.period_from+'T00:00:00.000Z',e.period_from+'T00:00:00.000Z',r.control_id)
  projected.push({...r,submissions:receipts,observations,exceptions,comments:await rows(env,'SELECT id,body,actor_id,actor_name,actor_role,at FROM audit_comments WHERE request_id=? ORDER BY at,id',r.id),decisions,state:r.closed_at?'closed':!submissions.length?'open':decisions.at(-1)?.submission_id===submissions.at(-1)?.id?decisions.at(-1)!.state:'submitted'})
 }
 return {engagement:e,scope:await rows(env,'SELECT control_id FROM audit_scope WHERE engagement_id=? ORDER BY control_id',e.id),requests:projected}
}
// Conditional writes fence revocation and close-out in the same database statement.
export async function auditorWrite(env:Bindings,e:Engagement,r:AuditRequest,input:Input,actor:Actor,email:string,now:Date,decision:boolean,sessionId:string){
 const id=crypto.randomUUID(),at=now.toISOString(),condition=`EXISTS(SELECT 1 FROM audit_grants g JOIN audit_engagements e ON e.id=g.engagement_id JOIN audit_requests r ON r.engagement_id=e.id WHERE g.email=? AND g.engagement_id=? AND g.revoked_at IS NULL AND g.expires_at>? AND e.closed_at IS NULL AND r.id=? AND r.closed_at IS NULL) AND EXISTS(SELECT 1 FROM oa_sessions s JOIN oa_operators o ON o.id=s.operator_id WHERE s.id=? AND s.revoked_at IS NULL AND s.expires_at>? AND o.status='active' AND o.version=s.operator_version AND o.email=?)`
 let statement:D1PreparedStatement
 if(decision){const state=text(input,'state'),reason=text(input,'reason',2000),submission=text(input,'submission_id');if(!['accepted','rejected','needs-more'].includes(state))throw new Refusal('Choose an auditor decision.')
  statement=env.DB.prepare(`INSERT INTO audit_decisions(id,request_id,submission_id,revision,state,reason,actor_id,actor_name,at) SELECT ?,?,?,COALESCE((SELECT MAX(revision) FROM audit_decisions WHERE request_id=?),0)+1,?,?,?,?,? WHERE ${condition} AND ?=(SELECT id FROM audit_submissions WHERE request_id=? ORDER BY revision DESC LIMIT 1)`).bind(id,r.id,submission,r.id,state,reason,actor.id,actor.name,at,email,e.id,at,r.id,sessionId,Date.now(),email,submission,r.id)
 }else statement=env.DB.prepare(`INSERT INTO audit_comments(id,request_id,body,actor_id,actor_name,actor_role,at) SELECT ?,?,?,?,?,'auditor',? WHERE ${condition}`).bind(id,r.id,text(input,'body',5000),actor.id,actor.name,at,email,e.id,at,r.id,sessionId,Date.now(),email)
 const log=env.DB.prepare(`INSERT INTO product_audit(id,actor_kind,actor_id,actor_name,action,subject,outcome,detail,at,reason,revision) SELECT ?,'system',?,?,?,?,'succeeded','Authenticated auditor',?,'',? WHERE EXISTS(SELECT 1 FROM ${decision?'audit_decisions':'audit_comments'} WHERE id=?)`).bind(crypto.randomUUID(),actor.id,actor.name,decision?'audit.auditor.decision':'audit.auditor.comment',r.id,at,id,id)
 const [result]=await env.DB.batch([statement,log]);if(!result.meta.changes)throw new Refusal('Access ended, request closed, or submission changed.',409)
 return {id}
}
export async function invite(env:Bindings,e:Engagement,input:Input,actor:Actor,now:Date,send:(email:string,name:string)=>Promise<unknown>){
 await requireCapability(env,'shares');await requireCapability(env,'mail')
 if(e.closed_at)throw new Refusal('Engagement is closed.',409)
 const email=text(input,'email',254).toLowerCase(),name=text(input,'name',100),reason=text(input,'reason',1000),expiry=text(input,'expires_at')
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!Number.isFinite(Date.parse(expiry))||Date.parse(expiry)<=now.getTime())throw new Refusal('Provide an email and a future expiry.')
 const existing=await env.DB.prepare('SELECT role,status FROM oa_operators WHERE email=?').bind(email).first<{role:string;status:string}>()
 if((existing&&!await auditIdentity(env,email))||existing?.role==='owner'||await env.DB.prepare('SELECT 1 FROM people WHERE lower(email)=?').bind(email).first())throw new Refusal('Use a dedicated auditor identity, separate from People and existing operators.',409)
 await env.DB.prepare('INSERT OR IGNORE INTO audit_identities(email,created_by,created_at) VALUES(?,?,?)').bind(email,actor.id,now.toISOString()).run()
 if(existing?.status!=='active')await send(email,name)
 const id=crypto.randomUUID()
 await env.DB.batch([env.DB.prepare('INSERT INTO audit_grants(id,engagement_id,email,expires_at,created_by,created_at,reason) VALUES(?,?,?,?,?,?,?)').bind(id,e.id,email,new Date(expiry).toISOString(),actor.id,now.toISOString(),reason),auditStatement(env,actor,'audit.auditor.invited',e.id,now,'succeeded','',{reason,revision:id})])
 return {id,email,expires_at:new Date(expiry).toISOString()}
}
