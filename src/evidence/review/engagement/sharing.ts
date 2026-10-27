import {sharedExhibits} from './exhibits'
import {sharedRemediation} from './remediation'
import {restrictProjection} from './restricted'
import {sharedIntervals} from './intervals'
import {sharedPopulation} from './population'
import {sharedRevisions} from './revisions'
import {sharedObservations} from './observations'
import type { Bindings } from '../../../auth.server'
import { auditStatement,text,type Actor,type Input } from '../../door'
import { Refusal } from '../../upload'
import { requireCapability } from '../../archive/capabilities'
import type { Engagement } from './storage'
const rows=async(env:Bindings,sql:string,...values:string[]) => (await env.DB.prepare(sql).bind(...values).all<Record<string,any>>()).results
export function reviewSettings(input:Input){
 const level=input.detail_level??'Full',hidden=input.hidden_attributes??[]
 if(!['Full','Restricted'].includes(String(level))||!Array.isArray(hidden)||hidden.length>50||hidden.some(v=>typeof v!=='string'||! /^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(v)))throw new Refusal('Choose Full or Restricted and up to fifty attribute names.')
 if(level==='Full'&&hidden.length)throw new Refusal('Hidden attributes require Restricted detail.')
 return {detail_level:String(level),hidden_attributes:[...new Set(hidden.map(v=>v.toLowerCase()))].sort()}
}
export async function settingsFor(env:Bindings,e:Engagement){
 const row=await env.DB.prepare('SELECT detail_level,hidden_attributes_json FROM audit_review_settings WHERE engagement_id=?').bind(e.id).first<{detail_level:string;hidden_attributes_json:string}>()
 return {detail_level:row?.detail_level??'Full',hidden_attributes:row?JSON.parse(row.hidden_attributes_json) as string[]:[]}
}
async function selectedSnapshot(env:Bindings,e:Engagement,kind:string,subject:string){
 const scope=async(control:string)=>!!await env.DB.prepare('SELECT 1 FROM audit_scope WHERE engagement_id=? AND control_id=?').bind(e.id,control).first()
 if(kind==='control'){
  if(!await scope(subject))throw new Refusal('Control is outside the engagement scope.',404)
  const row=await env.DB.prepare('SELECT id,name,group_name FROM controls WHERE id=?').bind(subject).first();if(row)return {revision:'selected',snapshot:row}
 }else if(kind==='test'){
  if(!await env.DB.prepare('SELECT 1 FROM test_controls t JOIN audit_scope s ON s.control_id=t.control_id WHERE s.engagement_id=? AND t.test_id=?').bind(e.id,subject).first())throw new Refusal('Test is outside the engagement scope.',404)
  const row=await env.DB.prepare('SELECT id,name,resource_type,criteria_json,cadence,revision,category,severity FROM tests WHERE id=?').bind(subject).first<{id:string;name:string;resource_type:string;criteria_json:string;cadence:string;revision:number;category:string;severity:string}>()
  if(row)return {revision:String(row.revision),snapshot:{id:row.id,name:row.name,resource_type:row.resource_type,criteria:JSON.parse(row.criteria_json),cadence:row.cadence,revision:row.revision,category:row.category,severity:row.severity}}
 }else if(kind==='policy'){
  const row=await env.DB.prepare("SELECT p.id,p.title,r.id AS revision_id,r.version,r.body,r.body_sha256,r.published_at,r.effective_date,r.review_due FROM policies p JOIN policy_revisions r ON r.policy_id=p.id WHERE p.id=? AND r.status='published'").bind(subject).first<{revision_id:string}>()
  if(row)return {revision:row.revision_id,snapshot:row}
 }else if(kind==='document'){
  const row=await env.DB.prepare('SELECT d.id,d.kind,r.id AS revision_id,r.revision,r.content_json,a.approved_at,a.effective_date,a.review_due FROM program_documents d JOIN program_document_revisions r ON r.document_id=d.id JOIN program_document_approvals a ON a.revision_id=r.id WHERE d.id=? ORDER BY r.revision DESC LIMIT 1').bind(subject).first<{revision_id:string;content_json:string}>()
  if(row)return {revision:row.revision_id,snapshot:{...row,content_json:undefined,content:JSON.parse(row.content_json)}}
 }else throw new Refusal('Choose control, test, policy or document.')
 throw new Refusal('Choose an existing shareable record; documents and policies must be approved.',404)
}
export async function shareEvidence(env:Bindings,e:Engagement,input:Input,actor:Actor,now:Date){
 await requireCapability(env,'shares')
 if(e.closed_at)throw new Refusal('Engagement is closed.',409)
 const kind=text(input,'kind'),subject=text(input,'subject_id'),reason=text(input,'reason',1000),selected=await selectedSnapshot(env,e,kind,subject),id=crypto.randomUUID()
 const statement=env.DB.prepare('INSERT INTO audit_evidence_shares(id,engagement_id,kind,subject_id,revision,snapshot_json,shared_by,shared_at,reason) SELECT ?,?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM audit_engagements WHERE id=? AND closed_at IS NULL) AND NOT EXISTS(SELECT 1 FROM audit_evidence_shares WHERE engagement_id=? AND kind=? AND subject_id=? AND unshared_at IS NULL)').bind(id,e.id,kind,subject,selected.revision,JSON.stringify(selected.snapshot),actor.id,now.toISOString(),reason,e.id,e.id,kind,subject)
 const log=env.DB.prepare("INSERT INTO product_audit(id,actor_kind,actor_id,actor_name,action,subject,outcome,detail,at,reason,revision) SELECT ?,'owner',?,?,'audit.evidence.shared',?,'succeeded','',?,?,? WHERE EXISTS(SELECT 1 FROM audit_evidence_shares WHERE id=?)").bind(crypto.randomUUID(),actor.id,actor.name,e.id,now.toISOString(),reason,selected.revision,id)
 const [result]=await env.DB.batch([statement,log]);if(!result.meta.changes)throw new Refusal('Engagement closed or record is already shared.',409)
 return {id,kind,subject_id:subject,revision:selected.revision}
}
export async function unshareEvidence(env:Bindings,e:Engagement,id:string,input:Input,actor:Actor,now:Date){
 const reason=text(input,'reason',1000)
 const [result]=await env.DB.batch([env.DB.prepare('UPDATE audit_evidence_shares SET unshared_at=?,unshared_by=?,unshare_reason=? WHERE id=? AND engagement_id=? AND unshared_at IS NULL').bind(now.toISOString(),actor.id,reason,id,e.id),env.DB.prepare("INSERT INTO product_audit(id,actor_kind,actor_id,actor_name,action,subject,outcome,detail,at,reason,revision) SELECT ?,'owner',?,?,'audit.evidence.unshared',?,'succeeded','',?,?,revision FROM audit_evidence_shares WHERE id=? AND engagement_id=? AND unshared_at=? AND unshared_by=? AND unshare_reason=? AND changes()=1").bind(crypto.randomUUID(),actor.id,actor.name,e.id,now.toISOString(),reason,id,e.id,now.toISOString(),actor.id,reason)])
 if(!result.meta.changes)throw new Refusal('Active share not found.',404)
 return {unshared:true}
}
export async function sharedEvidence(env:Bindings,e:Engagement,now:Date,id?:string){
 const shares=await rows(env,'SELECT id,kind,subject_id,revision,snapshot_json,shared_at FROM audit_evidence_shares WHERE engagement_id=? AND unshared_at IS NULL'+(id?' AND id=?':'')+' ORDER BY shared_at,id',e.id,...(id?[id]:[]))
 if(id&&!shares.length)throw new Refusal('Shared evidence not found.',404)
 const projected=await Promise.all(shares.map(async s=>{
  const population=s.kind==='test'?await sharedPopulation(env,e,s.subject_id):[]
  const observations=s.kind==='test'?(await sharedObservations(env,e,s.subject_id)).filter(o=>population.some(p=>p.resource_id===o.resource_id&&p.intervals.some(i=>i.from<=o.observed_at&&o.observed_at<i.to))):[]
  return {id:s.id,kind:s.kind,subject_id:s.subject_id,revision:s.revision,shared_at:s.shared_at,record:JSON.parse(s.snapshot_json),
   ...(s.kind==='test'?{population,exhibits:await sharedExhibits(env,e,s.subject_id),...await sharedRemediation(env,e,s.subject_id,population,now),intervals:await sharedIntervals(env,e,s.subject_id,population,now),...await sharedRevisions(env,e,s.subject_id)}:{}),observations,
   decisions:await rows(env,'SELECT id,revision,state,reason,actor_id,actor_name,at FROM audit_evidence_decisions WHERE share_id=? ORDER BY revision',s.id),
   replies:await rows(env,'SELECT id,decision_id,revision,body,actor_id,actor_name,at FROM audit_evidence_replies WHERE share_id=? ORDER BY revision',s.id)}
 }))
 const settings=await settingsFor(env,e)
 return restrictProjection({engagement:{id:e.id,name:e.name,period_from:e.period_from,period_to:e.period_to},...settings,shares:projected,coverage:'Selected definitions, period-bounded criteria and accepted library revision timelines, approved documents and in-period observations of explicitly shared tests. Historical population membership and attributes are retained; stale and unknown intervals are bounded by the product clock; Per-item SLA cycles, approved exceptions and linked remediation retain their period history; verified fixes before the period are separately labeled. Independent review decisions and owner replies are retained separately from requests.'},e.id,settings)
}
export async function previewEvidence(env:Bindings,e:Engagement,actor:Actor,now:Date,id?:string){await sharedEvidence(env,e,now,id);await auditStatement(env,actor,'audit.evidence.previewed',e.id,now).run();return sharedEvidence(env,e,now,id)}
