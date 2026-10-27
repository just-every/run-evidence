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
// Submitted receipts and explicit owner classifications share the same hold
// predicate during preview and inside the atomic confirmation guard.
const holdScope = "((h.kind=? AND h.subject_id=?) OR h.kind='business' OR (?='exhibit' AND h.kind='engagement' AND EXISTS(SELECT 1 FROM audit_submissions s JOIN audit_requests q ON q.id=s.request_id JOIN receipts r ON r.id=s.receipt_id WHERE q.engagement_id=h.subject_id AND r.exhibit_id=?)) OR (?='exhibit' AND EXISTS(SELECT 1 FROM privacy_exhibit_scopes s WHERE s.exhibit_id=? AND s.kind=h.kind AND s.subject_id=h.subject_id)))"
export async function privacy(env:Bindings,now:Date) {
 return {classifications:(await env.DB.prepare('SELECT * FROM privacy_exhibit_scopes ORDER BY classified_at,kind,subject_id').all()).results,holds:(await env.DB.prepare('SELECT * FROM privacy_holds ORDER BY created_at,rowid').all<HoldReview>()).results.map(h=>({...h,review_state:h.released_at?'released':h.review_on<now.toISOString().slice(0,10)?'overdue':'active'})),requests:(await env.DB.prepare('SELECT * FROM privacy_requests ORDER BY requested_at DESC,rowid DESC').all<Erasure>()).results}
}
export async function requestOf(env:Bindings,id:string) { const row=await env.DB.prepare('SELECT * FROM privacy_requests WHERE id=?').bind(id).first<Erasure>();if(!row)throw new Refusal('Erasure request not found.',404);return row }
async function snapshot(env:Bindings,kind:string,subject:string):Promise<any> {
 const hold_history=(await env.DB.prepare(`SELECT h.* FROM privacy_holds h WHERE ${holdScope} ORDER BY h.id`).bind(kind,subject,kind,subject,kind,subject).all()).results
 const classifications=kind==='exhibit'?(await env.DB.prepare('SELECT * FROM privacy_exhibit_scopes WHERE exhibit_id=? ORDER BY kind,subject_id').bind(subject).all()).results:[]
 const holds=hold_history.filter((h:any)=>!h.released_at)
 if(kind!=='exhibit')return entitySnapshot(env,kind,subject,holds,hold_history)
 const row=await env.DB.prepare('SELECT e.id,e.object_key,e.size,r.id AS receipt_id,r.origin,r.requirement_id,r.sha256 FROM exhibits e JOIN receipts r ON r.exhibit_id=e.id WHERE e.id=?').bind(subject).first<any>()
 if(!row)throw new Refusal('Exhibit not found.',404)
 const imported=!!await env.DB.prepare("SELECT 1 FROM import_additions WHERE kind='receipt' AND id=?").bind(row.receipt_id).first()
 // A wider source archive may contain this exhibit plus other records. Do not
 // claim it erased until that original can be retired by the import workflow.
 const linked=(await env.DB.prepare('SELECT f.id,f.closed_at FROM review_folders f JOIN review_folder_controls fc ON fc.folder_id=f.id JOIN requirements q ON q.control_id=fc.control_id WHERE q.id=? ORDER BY f.id').bind(row.requirement_id).all()).results
 const promiseLinked=!!await env.DB.prepare("SELECT 1 FROM promise_dependencies WHERE json_extract(source_json,'$.kind')='exhibit' AND json_extract(source_json,'$.source_id')=? UNION ALL SELECT 1 FROM questionnaire_sources WHERE kind='exhibit' AND source_id=? LIMIT 1").bind(row.receipt_id,row.receipt_id).first()
 const erased=!!await env.DB.prepare('SELECT 1 FROM privacy_erased_exhibits WHERE exhibit_id=?').bind(subject).first()
 return {kind,subject,holds,hold_history,classifications,supported:!imported&&!erased&&!promiseLinked,promise_linked:promiseLinked,remaining:promiseLinked?'Customer-promise derivatives require classified erasure under ERASE-001. This exhibit is not standalone; no erasure is available.':'',imported,erased,exhibit:row,folders:linked,actions:{R2:1,D1_fields:2,live_shares:linked.filter((f:any)=>!f.closed_at).length},retained:'Opaque receipt IDs, digest, size, dates and attribution remain. External downloads and offline archives cannot be recalled. Request deletion from their custodians. No model index or provider-side copy is created by this upload door.'}
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
 if(row.state==='complete'||row.state==='partial')return row
 if(row.kind!=='exhibit')return executeEntity(env,row,actor,now)
 const original=JSON.parse(row.snapshot_json)
 if(!original.supported)throw new Refusal('This scope is not yet supported. No erasure is claimed.',409)
 const current=await snapshot(env,row.kind,row.subject_id)
 if(current.promise_linked)throw new Refusal('The exhibit is no longer standalone. Review its customer-promise dependencies; no erasure is claimed.',409)
 if(current.holds.length)throw new Refusal('A legal hold prevents erasure. Inspect its reason, authorizer and review date.',409,current.holds)
 if(row.state==='preview') {
  if(await sha(new TextEncoder().encode(JSON.stringify(current)))!==row.snapshot_hash)throw new Refusal('The subject or holds changed. Create and review a new preview.',409)
  const statements=[
   env.DB.prepare(`INSERT INTO privacy_guard(singleton,allowed) SELECT 1,CASE WHEN EXISTS(SELECT 1 FROM privacy_requests WHERE id=? AND state='preview') AND (SELECT json_group_array(json_object('id',id,'closed_at',closed_at)) FROM (SELECT f.id,f.closed_at FROM review_folders f JOIN review_folder_controls fc ON fc.folder_id=f.id JOIN requirements q ON q.control_id=fc.control_id WHERE q.id=? ORDER BY f.id))=? AND (SELECT count(*) FROM privacy_exhibit_scopes WHERE exhibit_id=?)=? AND (SELECT count(*) FROM privacy_holds h WHERE ${holdScope})=? AND NOT EXISTS(SELECT 1 FROM promise_dependencies WHERE json_extract(source_json,'$.kind')='exhibit' AND json_extract(source_json,'$.source_id')=?) AND NOT EXISTS(SELECT 1 FROM questionnaire_sources WHERE kind='exhibit' AND source_id=?) AND NOT EXISTS(SELECT 1 FROM privacy_holds h WHERE h.released_at IS NULL AND ${holdScope}) THEN 1 ELSE 0 END`).bind(id,original.exhibit.requirement_id,JSON.stringify(original.folders),row.subject_id,original.classifications.length,row.kind,row.subject_id,row.kind,row.subject_id,row.kind,row.subject_id,original.hold_history.length,original.exhibit.receipt_id,original.exhibit.receipt_id,row.kind,row.subject_id,row.kind,row.subject_id,row.kind,row.subject_id),
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
 try {
  await env.DB.batch([
   env.DB.prepare("INSERT INTO privacy_guard(singleton,allowed) SELECT 1,CASE WHEN EXISTS(SELECT 1 FROM privacy_requests WHERE id=? AND state='pending') THEN 1 ELSE 0 END").bind(id),
   env.DB.prepare("UPDATE privacy_requests SET state='complete',completed_at=?,counts_json=? WHERE id=? AND state='pending'").bind(now.toISOString(),JSON.stringify(original.actions),id),
   auditStatement(env,actor,'privacy.completed','privacy:'+id,now,'succeeded','R2 absence verified; receipt tombstone retained',{reason:row.reason,revision:row.snapshot_hash}),
   env.DB.prepare('DELETE FROM privacy_guard'),
  ])
 }catch(error){const latest=await requestOf(env,id);if(latest.state==='complete')return latest;throw error}
 return requestOf(env,id)
}

// Owner classification assigns custody, never a new read or deletion permission.
export async function classify(env:Bindings,input:Input,actor:Actor,now:Date) {
 const kind=oneOf(input,'kind',['person','vendor','engagement'] as const),subject=text(input,'subject_id',128),exhibit=text(input,'exhibit_id',128),reason=text(input,'reason',500)
 const table={person:'people',vendor:'vendors',engagement:'audit_engagements'}[kind]
 if(!await env.DB.prepare(`SELECT 1 FROM ${table} WHERE id=?`).bind(subject).first())throw new Refusal('Classification subject not found.',404)
 if(!await env.DB.prepare('SELECT 1 FROM exhibits WHERE id=?').bind(exhibit).first())throw new Refusal('Exhibit not found.',404)
 if(await env.DB.prepare('SELECT 1 FROM privacy_erased_exhibits WHERE exhibit_id=?').bind(exhibit).first())throw new Refusal('Confirmed erasure cannot acquire a new classification.',409)
 if(await env.DB.prepare('SELECT 1 FROM privacy_exhibit_scopes WHERE exhibit_id=? AND kind=? AND subject_id=?').bind(exhibit,kind,subject).first())throw new Refusal('This classification is already retained.',409)
 await env.DB.batch([
  env.DB.prepare('INSERT INTO privacy_exhibit_scopes(exhibit_id,kind,subject_id,reason,classified_by,classified_name,classified_at) VALUES(?,?,?,?,?,?,?)').bind(exhibit,kind,subject,reason,actor.id,actor.name,now.toISOString()),
  auditStatement(env,actor,'privacy.classified','exhibit:'+exhibit,now,'succeeded',kind+':'+subject,{reason}),
 ])
 return {exhibit_id:exhibit,kind,subject_id:subject}
}

// Entity batches deliberately report partial: this door erases classified native
// exhibits, while the remaining entity records still require their own erasure.
async function entitySnapshot(env:Bindings,kind:string,subject:string,holds:any[],hold_history:any[]):Promise<any> {
 const table:Record<string,string>={person:'people',vendor:'vendors',engagement:'audit_engagements'}
 const exists=kind==='business'||!!await env.DB.prepare(`SELECT 1 FROM ${table[kind]} WHERE id=?`).bind(subject).first()
 const selected=(await env.DB.prepare(`SELECT e.id FROM exhibits e WHERE NOT EXISTS(SELECT 1 FROM privacy_erased_exhibits x WHERE x.exhibit_id=e.id) AND (?='business' OR EXISTS(SELECT 1 FROM privacy_exhibit_scopes s WHERE s.exhibit_id=e.id AND s.kind=? AND s.subject_id=?) OR (?='engagement' AND EXISTS(SELECT 1 FROM audit_submissions a JOIN audit_requests q ON q.id=a.request_id JOIN receipts r ON r.id=a.receipt_id WHERE r.exhibit_id=e.id AND q.engagement_id=?))) ORDER BY e.id LIMIT 51`).bind(kind,kind,subject,kind,subject).all<{id:string}>()).results
 const items=[]
 for(const e of selected.slice(0,50))items.push(await snapshot(env,'exhibit',e.id))
 const unclassified=kind==='business'?(await env.DB.prepare('SELECT e.id FROM exhibits e WHERE NOT EXISTS(SELECT 1 FROM privacy_erased_exhibits x WHERE x.exhibit_id=e.id) AND NOT EXISTS(SELECT 1 FROM privacy_exhibit_scopes s WHERE s.exhibit_id=e.id) AND NOT EXISTS(SELECT 1 FROM audit_submissions a JOIN receipts r ON r.id=a.receipt_id WHERE r.exhibit_id=e.id) ORDER BY e.id LIMIT 51').all<{id:string}>()).results:[]
 const retained=items.filter(p=>p.holds.length).map(p=>({exhibit_id:p.subject,holds:p.holds}))
 const deletions=items.filter(p=>!p.holds.length&&p.supported)
 const unsupported=items.filter(p=>!p.holds.length&&!p.supported).map(p=>({exhibit_id:p.subject,reason:p.remaining||'Imported exhibit requires linked-import retirement.'}))
 return {kind,subject,holds,hold_history,items,retained,unsupported,unclassified:unclassified.map(e=>e.id),supported:exists&&selected.length>0&&selected.length<=50&&!unclassified.length&&!unsupported.length,deletions:deletions.map(p=>p.subject),remaining:'Only the listed classified native exhibits can be erased. Entity profiles, other related records, imported originals, mirrored comments and actor anonymization remain unimplemented. This request can never claim whole-entity completion.',limit:selected.length>50?'More than 50 exhibits: no batch can execute.':''}
}
async function executeEntity(env:Bindings,row:Erasure,actor:Actor,now:Date) {
 const original=JSON.parse(row.snapshot_json)
 if(!original.supported)throw new Refusal('Unclassified, imported, unsupported or oversized scope. No entity batch is admitted.',409)
 if(row.state==='preview') {
  // The portable generation fences changes during snapshot reads and admission,
  // including a new classification, submission, legal hold or share grant.
  const generation=await env.DB.prepare('SELECT generation FROM portable_state WHERE singleton=1').first<{generation:number}>()
  const current=await snapshot(env,row.kind,row.subject_id)
  if(await sha(new TextEncoder().encode(JSON.stringify(current)))!==row.snapshot_hash)throw new Refusal('The subject or holds changed. Create and review a new preview.',409)
  const children=[]
  for(const plan of original.items.filter((p:any)=>original.deletions.includes(p.subject))) {
   const body=JSON.stringify(plan)
   children.push({id:crypto.randomUUID(),plan,body,hash:await sha(new TextEncoder().encode(body))})
  }
  const statements=[env.DB.prepare("INSERT INTO privacy_guard(singleton,allowed) SELECT 1,CASE WHEN EXISTS(SELECT 1 FROM privacy_requests WHERE id=? AND state='preview') AND EXISTS(SELECT 1 FROM portable_state WHERE singleton=1 AND generation=?) THEN 1 ELSE 0 END").bind(row.id,generation?.generation??-1),env.DB.prepare("UPDATE privacy_requests SET state='pending',confirmed_at=?,counts_json=? WHERE id=? AND state='preview'").bind(now.toISOString(),JSON.stringify({child_requests:children.map(c=>c.id)}),row.id)]
  // Admit every child and tombstone in the same transaction before deleting any
  // object. A failed audit or race rolls back the entire batch admission.
  for(const child of children) {
   const p=child.plan
   statements.push(
    env.DB.prepare("INSERT INTO privacy_requests(id,kind,subject_id,snapshot_json,snapshot_hash,reason,requested_by,requested_name,requested_at,state,confirmed_at) VALUES(?,'exhibit',?,?,?,?,?,?,?,'pending',?)").bind(child.id,p.subject,child.body,child.hash,row.reason,actor.id,actor.name,now.toISOString(),now.toISOString()),
    env.DB.prepare('INSERT INTO privacy_erased_exhibits(exhibit_id,request_id,recorded_at) VALUES(?,?,?)').bind(p.subject,child.id,now.toISOString()),
    env.DB.prepare("INSERT INTO portable_journal(lineage,sequence,recorded_at,receipt) SELECT lineage,COALESCE((SELECT max(sequence) FROM portable_journal WHERE lineage=portable_state.lineage),0)+1,?,? FROM portable_state WHERE singleton=1").bind(now.toISOString(),child.id),
    env.DB.prepare("UPDATE review_folders SET closed_at=? WHERE closed_at IS NULL AND id IN (SELECT f.id FROM review_folders f JOIN review_folder_controls fc ON fc.folder_id=f.id JOIN requirements q ON q.control_id=fc.control_id WHERE q.id=?)").bind(now.toISOString(),p.exhibit.requirement_id),
    env.DB.prepare("UPDATE exhibits SET filename='Erased exhibit',media_type=('application'||'/'||'octet-stream') WHERE id=?").bind(p.subject),
    env.DB.prepare("UPDATE receipts SET source='Erased exhibit' WHERE exhibit_id=?").bind(p.subject),
    auditStatement(env,actor,'privacy.confirmed','privacy:'+child.id,now,'succeeded','Entity batch '+row.id,{reason:row.reason,revision:child.hash}),
   )
  }
  statements.push(auditStatement(env,actor,'privacy.confirmed','privacy:'+row.id,now,'succeeded','Classified exhibits only; entity erasure remains partial',{reason:row.reason,revision:row.snapshot_hash}),env.DB.prepare('DELETE FROM privacy_guard'))
  await env.DB.batch(statements)
  row=await requestOf(env,row.id)
 }
 const children=JSON.parse(row.counts_json).child_requests as string[]
 const counts={R2:0,D1_fields:0,live_shares:0}
 let pending=false
 const folders=new Set<string>()
 for(const id of children) {
  let child=await requestOf(env,id)
  child=await execute(env,id,{confirm:'ERASE',snapshot_hash:child.snapshot_hash},actor,now)
  if(child.state!=='complete')pending=true
  else {const p=JSON.parse(child.snapshot_json);counts.R2++;counts.D1_fields+=2;for(const f of p.folders)if(!f.closed_at)folders.add(f.id)}
 }
 if(pending)return requestOf(env,row.id)
 counts.live_shares=folders.size
 try {
  await env.DB.batch([
   env.DB.prepare("INSERT INTO privacy_guard(singleton,allowed) SELECT 1,CASE WHEN EXISTS(SELECT 1 FROM privacy_requests WHERE id=? AND state='pending') THEN 1 ELSE 0 END").bind(row.id),
   env.DB.prepare("UPDATE privacy_requests SET state='partial',counts_json=? WHERE id=? AND state='pending'").bind(JSON.stringify({...counts,child_requests:children,retained:original.retained,remaining:original.remaining}),row.id),
   auditStatement(env,actor,'privacy.partially-erased','privacy:'+row.id,now,'succeeded','Classified exhibit storage absence verified; entity records remain',{reason:row.reason,revision:row.snapshot_hash}),
   env.DB.prepare('DELETE FROM privacy_guard'),
  ])
 }catch(error){const latest=await requestOf(env,row.id);if(latest.state==='partial')return latest;throw error}
 return requestOf(env,row.id)
}
