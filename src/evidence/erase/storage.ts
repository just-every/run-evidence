import type { Bindings } from '../../auth.server'
import { auditStatement, text, oneOf, type Actor, type Input } from '../door'
import { sendFollowup, sent } from '../followup/send'
import { validDate } from '../model'
import { Refusal } from '../upload'
import { sha } from '../archive/format'
export const kinds = ['exhibit','person','vendor','engagement','business'] as const
export interface Erasure { id:string;kind:string;subject_id:string;snapshot_json:string;snapshot_hash:string;reason:string;requested_by:string;requested_name:string;requested_at:string;state:string;confirmed_at:string|null;completed_at:string|null;counts_json:string }
export interface HoldReview { id:string;kind:string;subject_id:string;reason:string;authorized_by:string;authorized_name:string;review_on:string;created_at:string;released_at:string|null }
export async function overdueHolds(env:Bindings,now:Date) {
 return (await env.DB.prepare('SELECT * FROM privacy_holds WHERE released_at IS NULL AND review_on<? ORDER BY review_on,id').bind(now.toISOString().slice(0,10)).all<HoldReview>()).results
}
export async function holdReviewReminders(env:Bindings,now:Date) {
 let count=0
 for(const h of await overdueHolds(env,now)) {
  // Resolve the attributed authorizer, never a fallback recipient. Restored
  // holds remain visible even if that identity is absent in this installation.
  const authorizer=await env.DB.prepare("SELECT email FROM oa_operators WHERE id=? AND status='active'").bind(h.authorized_by).first<{email:string}>()
  if(!authorizer)continue
  if(sent(await sendFollowup(env,{kind:'privacy-hold-review',subject:'privacy-hold:'+h.id,cycle:h.review_on,recipient:authorizer.email,title:'Legal hold review overdue',text:`Legal hold ${h.id} was due for review on ${h.review_on}. It remains active until an attributed person explicitly releases it with a reason. Review it in Privacy: ${env.AUTH_ORIGIN}/app/privacy`,link:env.AUTH_ORIGIN+'/app/privacy'},now)))count++
 }
 return count
}
// An engagement classifies its submitted receipts. Read the same predicate
// during preview and inside the atomic confirmation guard.
const holdScope = "((h.kind=? AND h.subject_id=?) OR h.kind='business' OR (?='exhibit' AND h.kind='engagement' AND EXISTS(SELECT 1 FROM audit_submissions s JOIN audit_requests q ON q.id=s.request_id JOIN receipts r ON r.id=s.receipt_id WHERE q.engagement_id=h.subject_id AND r.exhibit_id=?)))"
export async function privacy(env:Bindings,now:Date) {
 return {holds:(await env.DB.prepare('SELECT * FROM privacy_holds ORDER BY created_at,rowid').all<HoldReview>()).results.map(h=>({...h,review_state:h.released_at?'released':h.review_on<now.toISOString().slice(0,10)?'overdue':'active'})),requests:(await env.DB.prepare('SELECT * FROM privacy_requests ORDER BY requested_at DESC,rowid DESC').all<Erasure>()).results}
}
export async function requestOf(env:Bindings,id:string) { const row=await env.DB.prepare('SELECT * FROM privacy_requests WHERE id=?').bind(id).first<Erasure>();if(!row)throw new Refusal('Erasure request not found.',404);return row }
async function snapshot(env:Bindings,kind:string,subject:string) {
 const hold_history=(await env.DB.prepare(`SELECT h.* FROM privacy_holds h WHERE ${holdScope} ORDER BY h.id`).bind(kind,subject,kind,subject).all()).results
 const holds=hold_history.filter((h:any)=>!h.released_at)
 if(kind!=='exhibit')return {kind,subject,holds,hold_history,supported:false,remaining:'Entity relationships and provider-copy deletion are not yet classified. No deletion is available for this scope.'}
 const row=await env.DB.prepare('SELECT e.id,e.object_key,e.size,r.id AS receipt_id,r.origin,r.requirement_id,r.sha256 FROM exhibits e JOIN receipts r ON r.exhibit_id=e.id WHERE e.id=?').bind(subject).first<any>()
 if(!row)throw new Refusal('Exhibit not found.',404)
 const imported=!!await env.DB.prepare("SELECT 1 FROM import_additions WHERE kind='receipt' AND id=?").bind(row.receipt_id).first()
 // A wider source archive may contain this exhibit plus other records. Do not
 // claim it erased until that original can be retired by the import workflow.
 const linked=(await env.DB.prepare('SELECT f.id,f.closed_at FROM review_folders f JOIN review_folder_controls fc ON fc.folder_id=f.id JOIN requirements q ON q.control_id=fc.control_id WHERE q.id=? ORDER BY f.id').bind(row.requirement_id).all()).results
 const promiseLinked=!!await env.DB.prepare("SELECT 1 FROM promise_dependencies WHERE json_extract(source_json,'$.kind')='exhibit' AND json_extract(source_json,'$.source_id')=? UNION ALL SELECT 1 FROM questionnaire_sources WHERE kind='exhibit' AND source_id=? LIMIT 1").bind(row.receipt_id,row.receipt_id).first()
 const erased=!!await env.DB.prepare('SELECT 1 FROM privacy_erased_exhibits WHERE exhibit_id=?').bind(subject).first()
 return {kind,subject,holds,hold_history,supported:!imported&&!erased&&!promiseLinked,promise_linked:promiseLinked,remaining:promiseLinked?'Customer-promise derivatives require classified erasure under ERASE-001. This exhibit is not standalone; no erasure is available.':'',imported,erased,exhibit:row,folders:linked,actions:{R2:1,D1_fields:2,live_shares:linked.filter((f:any)=>!f.closed_at).length},retained:'Opaque receipt IDs, digest, size, dates and attribution remain. External downloads and offline archives cannot be recalled. Request deletion from their custodians. No model index or provider-side copy is created by this upload door.'}
}
export async function preview(env:Bindings,input:Input,actor:Actor,now:Date) {
 const kind=oneOf(input,'kind',kinds),subject=kind==='business'?'business':text(input,'subject_id',128),reason=text(input,'reason',500)
 const plan=await snapshot(env,kind,subject),body=JSON.stringify(plan),hash=await sha(new TextEncoder().encode(body)),id=crypto.randomUUID()
 await env.DB.batch([env.DB.prepare('INSERT INTO privacy_requests(id,kind,subject_id,snapshot_json,snapshot_hash,reason,requested_by,requested_name,requested_at) VALUES(?,?,?,?,?,?,?,?,?)').bind(id,kind,subject,body,hash,reason,actor.id,actor.name,now.toISOString()),auditStatement(env,actor,'privacy.previewed','privacy:'+id,now,'succeeded',kind,{reason,revision:hash})])
 return requestOf(env,id)
}
export async function hold(env:Bindings,input:Input,actor:Actor,now:Date) {
 const kind=oneOf(input,'kind',kinds),subject=kind==='business'?'business':text(input,'subject_id',128),reason=text(input,'reason',500),review=text(input,'review_on',10),id=crypto.randomUUID()
 if(!validDate(review)||review<now.toISOString().slice(0,10))throw new Refusal('Choose a current or future hold review date.')
 await env.DB.batch([env.DB.prepare('INSERT INTO privacy_holds(id,kind,subject_id,reason,authorized_by,authorized_name,review_on,created_at) VALUES(?,?,?,?,?,?,?,?)').bind(id,kind,subject,reason,actor.id,actor.name,review,now.toISOString()),auditStatement(env,actor,'privacy.hold-authorized','hold:'+id,now,'succeeded',kind,{reason})]);return {id}
}
export async function release(env:Bindings,id:string,input:Input,actor:Actor,now:Date) {
 const reason=text(input,'reason',500)
 if(!await env.DB.prepare('SELECT 1 FROM privacy_holds WHERE id=? AND released_at IS NULL').bind(id).first())throw new Refusal('Hold is absent or already released.',409)
 // Release and its attributed audit are one transaction. A failed audit must
 // leave the hold active, including when erasure is waiting for its release.
 await env.DB.batch([
  env.DB.prepare('INSERT INTO privacy_guard(singleton,allowed) SELECT 1,CASE WHEN EXISTS(SELECT 1 FROM privacy_holds WHERE id=? AND released_at IS NULL) THEN 1 ELSE 0 END').bind(id),
  env.DB.prepare('UPDATE privacy_holds SET released_at=?,released_by=?,release_reason=? WHERE id=? AND released_at IS NULL').bind(now.toISOString(),actor.id,reason,id),
  auditStatement(env,actor,'privacy.hold-released','hold:'+id,now,'succeeded','',{reason}),
  env.DB.prepare('DELETE FROM privacy_guard'),
 ])
}
export async function execute(env:Bindings,id:string,input:Input,actor:Actor,now:Date) {
 let row=await requestOf(env,id)
 if(input.confirm!=='ERASE'||input.snapshot_hash!==row.snapshot_hash)throw new Refusal('Type ERASE and confirm the exact preview fingerprint.',409)
 if(row.state==='complete')return row
 const original=JSON.parse(row.snapshot_json)
 if(!original.supported)throw new Refusal('This scope is not yet supported. No erasure is claimed.',409)
 const current=await snapshot(env,row.kind,row.subject_id)
 if(current.promise_linked)throw new Refusal('The exhibit is no longer standalone. Review its customer-promise dependencies; no erasure is claimed.',409)
 if(current.holds.length)throw new Refusal('A legal hold prevents erasure. Inspect its reason, authorizer and review date.',409,current.holds)
 if(row.state==='preview') {
  if(await sha(new TextEncoder().encode(JSON.stringify(current)))!==row.snapshot_hash)throw new Refusal('The subject or holds changed. Create and review a new preview.',409)
  const statements=[
   env.DB.prepare(`INSERT INTO privacy_guard(singleton,allowed) SELECT 1,CASE WHEN EXISTS(SELECT 1 FROM privacy_requests WHERE id=? AND state='preview') AND (SELECT json_group_array(json_object('id',id,'closed_at',closed_at)) FROM (SELECT f.id,f.closed_at FROM review_folders f JOIN review_folder_controls fc ON fc.folder_id=f.id JOIN requirements q ON q.control_id=fc.control_id WHERE q.id=? ORDER BY f.id))=? AND (SELECT count(*) FROM privacy_holds h WHERE ${holdScope})=? AND NOT EXISTS(SELECT 1 FROM promise_dependencies WHERE json_extract(source_json,'$.kind')='exhibit' AND json_extract(source_json,'$.source_id')=?) AND NOT EXISTS(SELECT 1 FROM questionnaire_sources WHERE kind='exhibit' AND source_id=?) AND NOT EXISTS(SELECT 1 FROM privacy_holds h WHERE h.released_at IS NULL AND ${holdScope}) THEN 1 ELSE 0 END`).bind(id,original.exhibit.requirement_id,JSON.stringify(original.folders),row.kind,row.subject_id,row.kind,row.subject_id,original.hold_history.length,original.exhibit.receipt_id,original.exhibit.receipt_id,row.kind,row.subject_id,row.kind,row.subject_id),
   // CAS plus the tombstone primary key serialize concurrent confirms. The
   // journal fences old exports before any irreversible R2 operation occurs.
   env.DB.prepare("UPDATE privacy_requests SET state='pending',confirmed_at=? WHERE id=? AND state='preview'").bind(now.toISOString(),id),
   env.DB.prepare('INSERT INTO privacy_erased_exhibits(exhibit_id,request_id,recorded_at) VALUES(?,?,?)').bind(row.subject_id,id,now.toISOString()),
   env.DB.prepare("INSERT INTO portable_journal(lineage,sequence,recorded_at,receipt) SELECT lineage,COALESCE((SELECT max(sequence) FROM portable_journal WHERE lineage=portable_state.lineage),0)+1,?,? FROM portable_state WHERE singleton=1").bind(now.toISOString(),id),
   env.DB.prepare("UPDATE review_folders SET closed_at=? WHERE closed_at IS NULL AND id IN (SELECT f.id FROM review_folders f JOIN review_folder_controls fc ON fc.folder_id=f.id JOIN requirements q ON q.control_id=fc.control_id WHERE q.id=?)").bind(now.toISOString(),original.exhibit.requirement_id),
   env.DB.prepare("UPDATE exhibits SET filename='Erased exhibit',media_type='application/octet-stream' WHERE id=?").bind(row.subject_id),
   env.DB.prepare("UPDATE receipts SET source='Erased exhibit' WHERE exhibit_id=?").bind(row.subject_id),
   auditStatement(env,actor,'privacy.confirmed','privacy:'+id,now,'succeeded','R2 deletion pending',{reason:row.reason,revision:row.snapshot_hash}),
  ]
  statements.push(env.DB.prepare('DELETE FROM privacy_guard'))
  await env.DB.batch(statements)
 }
 // Idempotent retry after a restart. Failed/uncertain storage work remains
 // pending; neither the receipt nor the UI claims completion prematurely.
 try {
  await env.EXHIBITS.delete(original.exhibit.object_key)
  if(await env.EXHIBITS.head(original.exhibit.object_key))return requestOf(env,id)
 } catch {return requestOf(env,id)}
 await env.DB.batch([env.DB.prepare("UPDATE privacy_requests SET state='complete',completed_at=?,counts_json=? WHERE id=? AND state='pending'").bind(now.toISOString(),JSON.stringify(original.actions),id),auditStatement(env,actor,'privacy.completed','privacy:'+id,now,'succeeded','R2 absence verified; receipt tombstone retained',{reason:row.reason,revision:row.snapshot_hash})])
 return requestOf(env,id)
}
