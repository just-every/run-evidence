import type { Bindings } from '../../auth.server'
import { auditStatement,type Actor } from '../door'
import { Refusal } from '../upload'
import { sha } from '../archive/format'
import type { Erasure } from './storage'

type Snapshot = (env:Bindings,kind:string,subject:string)=>Promise<any>
const digest = (value:unknown) => sha(new TextEncoder().encode(JSON.stringify(value)))
const partialGap = 'Only the listed classified exhibits are processed. Other entity records, linked imports, tracker text, actor anonymization and external provider copies are not erased. This is a partial entity erasure, never a completed entity deletion.'

// Use the same exhibit inventory and hold resolver as standalone erasure.
// Native engagement custody and explicit classifications are additive.
export async function entitySnapshot(env:Bindings,kind:string,subject:string,snapshot:Snapshot) {
 const ids = kind==='business'
  ? (await env.DB.prepare('SELECT e.id FROM exhibits e WHERE NOT EXISTS(SELECT 1 FROM privacy_erased_exhibits p WHERE p.exhibit_id=e.id) ORDER BY e.id').all<{id:string}>()).results
  : (await env.DB.prepare(`SELECT e.id FROM exhibits e WHERE NOT EXISTS(SELECT 1 FROM privacy_erased_exhibits p WHERE p.exhibit_id=e.id) AND
   (EXISTS(SELECT 1 FROM privacy_exhibit_scopes s WHERE s.exhibit_id=e.id AND s.kind=? AND s.subject_id=?) OR
    (?='engagement' AND EXISTS(SELECT 1 FROM privacy_exhibit_engagements s WHERE s.exhibit_id=e.id AND s.engagement_id=?))) ORDER BY e.id`).bind(kind,subject,kind,subject).all<{id:string}>()).results
 const items = []
 for(const {id} of ids)items.push(await snapshot(env,'exhibit',id))
 const held_items = items.filter(item=>item.holds.length).map(item=>({exhibit_id:item.subject,holds:item.holds}))
 const deletable = items.filter(item=>!item.holds.length)
 const folders = new Set(deletable.flatMap(item=>item.folders.filter((f:any)=>!f.closed_at).map((f:any)=>f.id)))
 // An unclassified imported original or derivative refuses the whole batch.
 // A hold is a disclosed retention decision, not a batch refusal.
 const supported = deletable.length>0 && items.every(item=>item.supported)
 return {kind,subject,items,held_items,supported,remaining:partialGap,
  actions:{R2:deletable.length,D1_fields:deletable.length*2,live_shares:folders.size,held_exhibits:held_items.length},
  retained:'Each held original remains available with its hold reason, authorizer and review date. External downloads and offline archives cannot be recalled; request deletion from their custodians.'}
}

export async function executeEntity(env:Bindings,row:Erasure,actor:Actor,now:Date,snapshot:Snapshot) {
 const original=JSON.parse(row.snapshot_json)
 if(!original.supported)throw new Refusal('This entity inventory cannot be executed. Review unclassified originals and dependencies.',409)
 const items=original.items.filter((item:any)=>!item.holds.length)
 if(row.state==='preview') {
  // A single generation barrier covers all relationships, holds, shares and
  // fingerprints read below. Any write during review or admission refuses.
  const generation=await env.DB.prepare('SELECT generation FROM portable_state WHERE singleton=1').first<{generation:number}>()
  const current=await snapshot(env,row.kind,row.subject_id)
  if(await digest(current)!==row.snapshot_hash)throw new Refusal('The entity inventory or holds changed. Create and review a new preview.',409)
  const statements=[
   env.DB.prepare(`INSERT INTO privacy_guard(singleton,allowed) SELECT 1,CASE WHEN
    (SELECT generation FROM portable_state WHERE singleton=1)=? AND
    EXISTS(SELECT 1 FROM privacy_requests WHERE id=? AND state='preview')
    THEN 1 ELSE 0 END`).bind(generation!.generation,row.id),
   env.DB.prepare("UPDATE privacy_requests SET state='pending',confirmed_at=? WHERE id=? AND state='preview'").bind(now.toISOString(),row.id),
   env.DB.prepare("INSERT INTO portable_journal(lineage,sequence,recorded_at,receipt) SELECT lineage,COALESCE((SELECT max(sequence) FROM portable_journal WHERE lineage=portable_state.lineage),0)+1,?,? FROM portable_state WHERE singleton=1").bind(now.toISOString(),row.id),
  ]
  for(const item of items)statements.push(
   env.DB.prepare('INSERT INTO privacy_erased_exhibits(exhibit_id,request_id,recorded_at) VALUES(?,?,?)').bind(item.subject,row.id,now.toISOString()),
   env.DB.prepare("UPDATE review_folders SET closed_at=? WHERE closed_at IS NULL AND id IN (SELECT f.id FROM review_folders f JOIN review_folder_controls fc ON fc.folder_id=f.id JOIN requirements q ON q.control_id=fc.control_id WHERE q.id=?)").bind(now.toISOString(),item.exhibit.requirement_id),
   env.DB.prepare("UPDATE exhibits SET filename='Erased exhibit',media_type='application"+"/octet-stream' WHERE id=?").bind(item.subject),
   env.DB.prepare("UPDATE receipts SET source='Erased exhibit' WHERE exhibit_id=?").bind(item.subject),
  )
  statements.push(auditStatement(env,actor,'privacy.confirmed','privacy:'+row.id,now,'succeeded','Classified exhibit deletion pending; other entity stores remain',{reason:row.reason,revision:row.snapshot_hash}),env.DB.prepare('DELETE FROM privacy_guard'))
  await env.DB.batch(statements)
 }
 // Every tombstone and the source journal precede irreversible storage work.
 // Retry all keys idempotently; a single uncertain deletion keeps the batch pending.
 try {
  for(const item of items) {
   await env.EXHIBITS.delete(item.exhibit.object_key)
   if(await env.EXHIBITS.head(item.exhibit.object_key))return request(env,row.id)
  }
 }catch{return request(env,row.id)}
 await env.DB.batch([
  env.DB.prepare("UPDATE privacy_requests SET state='partial',completed_at=?,counts_json=? WHERE id=? AND state='pending'").bind(now.toISOString(),JSON.stringify(original.actions),row.id),
  auditStatement(env,actor,'privacy.partial','privacy:'+row.id,now,'succeeded','Classified exhibit storage absence verified; other entity stores remain',{reason:row.reason,revision:row.snapshot_hash}),
 ])
 return request(env,row.id)
}
async function request(env:Bindings,id:string) {
 return (await env.DB.prepare('SELECT * FROM privacy_requests WHERE id=?').bind(id).first<Erasure>())!
}
