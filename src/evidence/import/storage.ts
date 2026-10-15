import type { Bindings } from '../../auth.server'
import { Refusal } from '../upload'
import { canonicalJson, sha256 } from './base/provenance/identity'
import { createD1ImportJob, planD1Import, readD1ImportJob } from './base/d1/jobs'
import { applyD1ImportBatches } from './base/d1/apply'
import { undoD1Import, rollbackD1Import } from './base/d1/reverse'
import { importContext } from './context'
import { importInputs } from './plan'
import { parseArchive } from './manifest'
import type { Mapping, ReceiptValue, Review } from './types'
type Session={id:string;operatorId:string;operator:{displayName:string}}
export const reviews=async(env:Bindings)=>(await env.DB.prepare('SELECT * FROM import_reviews ORDER BY staged_at DESC,id').all<Review>()).results
export async function reviewById(env:Bindings,id:string,actor:string){const row=await env.DB.prepare('SELECT * FROM import_reviews WHERE id=?').bind(id).first<Review>();if(!row)throw new Refusal('Import not found.',404);if(row.actor_id!==actor)throw new Refusal('This import belongs to another owner identity and is retained as history.',403);return row}
export async function stage(env:Bindings,bytes:Uint8Array,session:Session,now:Date){
 const parsed=parseArchive(bytes),id=crypto.randomUUID(),object_key='import-sources/'+id
 const written=await env.EXHIBITS.put(object_key,bytes,{onlyIf:{etagDoesNotMatch:'*'},httpMetadata:{contentType:'application/octet-stream'}})
 if(!written)throw new Refusal('Source key conflict.',409)
 const stored=await env.EXHIBITS.get(object_key)
 if(!stored||sha256(new Uint8Array(await stored.arrayBuffer()))!==parsed.summary.archive_sha256)throw new Refusal('Could not verify retained ZIP.',503)
 await env.DB.prepare('INSERT INTO import_reviews(id,actor_id,actor_name,staged_at,object_key,archive_sha256,archive_size,summary_json) VALUES(?,?,?,?,?,?,?,?)').bind(id,session.operatorId,session.operator.displayName,now.toISOString(),object_key,parsed.summary.archive_sha256,bytes.length,canonicalJson(parsed.summary)).run()
 return reviewById(env,id,session.operatorId)
}
export async function readSource(env:Bindings,review:Review){
 const object=await env.EXHIBITS.get(review.object_key)
 if(!object)throw new Refusal('Retained source ZIP is unavailable. Import cannot continue.',410)
 const bytes=new Uint8Array(await object.arrayBuffer())
 if(bytes.length!==review.archive_size||sha256(bytes)!==review.archive_sha256)throw new Refusal('Retained ZIP integrity mismatch.',409)
 return parseArchive(bytes)
}
export async function preparePlan(env:Bindings,review:Review,mapping:Mapping[],session:Session){
 const parsed=await readSource(env,review),inputs=importInputs(review,parsed,mapping)
 return planD1Import(inputs.source,inputs.mapping,importContext(env,review,session))
}
export async function saveMapping(env:Bindings,review:Review,mapping:Mapping[],session:Session){
 if(review.approved_at)throw new Refusal('Approved mappings are immutable.',409)
 const plan=await preparePlan(env,review,mapping,session)
 const result=await env.DB.prepare('UPDATE import_reviews SET mapping_json=?,fingerprint=? WHERE id=? AND approved_at IS NULL').bind(canonicalJson(mapping),plan.fingerprint,review.id).run()
 if(!result.meta.changes)throw new Refusal('Import already approved.',409)
 return{review:await reviewById(env,review.id,session.operatorId),counts:plan.counts,diagnostics:plan.diagnostics}
}
export async function commit(env:Bindings,review:Review,fingerprint:string,session:Session,now:Date){
 if(!review.mapping_json||!review.fingerprint||review.fingerprint!==fingerprint)throw new Refusal('Review the current mapping and submit its exact fingerprint.',409)
 const plan=await preparePlan(env,review,JSON.parse(review.mapping_json),session)
 if(plan.fingerprint!==fingerprint)throw new Refusal('Import plan changed. Review it again.',409)
 // Write immutable R2 additions first. A failed DB publication can leave retained
 // unlinked bytes, never a receipt referring to unverified content.
 const parsed=await readSource(env,review)
 for(const entry of plan.entries)for(const effect of entry.effects)if(effect.targetKind==='receipt'){
  const v=effect.value as unknown as ReceiptValue,bytes=parsed.files.get(v.source_path)!
  await env.EXHIBITS.put(v.object_key,bytes,{onlyIf:{etagDoesNotMatch:'*'},httpMetadata:{contentType:'application/octet-stream'}})
  const stored=await env.EXHIBITS.get(v.object_key)
  if(!stored)throw new Refusal('Imported evidence bytes unavailable.',503)
  const actual=new Uint8Array(await stored.arrayBuffer());if(actual.length!==v.size||sha256(actual)!==v.sha256)throw new Refusal('Imported evidence digest mismatch.',409)
 }
 const approved=await env.DB.prepare('UPDATE import_reviews SET approved_at=COALESCE(approved_at,?) WHERE id=? AND fingerprint=? AND mapping_json=?').bind(now.toISOString(),review.id,fingerprint,review.mapping_json).run()
 if(!approved.meta.changes)throw new Refusal('Mapping changed before approval. Review it again.',409)
 const context=importContext(env,review,session,fingerprint),job=await createD1ImportJob(plan,context)
 await env.DB.prepare('UPDATE import_reviews SET job_id=? WHERE id=? AND (job_id IS NULL OR job_id=?)').bind(job.id,review.id,job.id).run()
 return applyD1ImportBatches(job.id,importContext(env,review,session,fingerprint))
}
export async function jobAction(env:Bindings,review:Review,session:Session,action:'read'|'resume'|'undo'){
 if(!review.job_id||!review.approved_at)throw new Refusal('No approved job for this import.',409)
 const context=importContext(env,review,session),job=await readD1ImportJob(review.job_id,context)
 if(action==='read')return job
 if(action==='undo')return ['completed','undoing','undone'].includes(job.state)?undoD1Import(job.id,importContext(env,review,session)):rollbackD1Import(job.id,importContext(env,review,session))
 if(['undoing','undone'].includes(job.state))return undoD1Import(job.id,importContext(env,review,session))
 if(['rolling_back','rolled_back'].includes(job.state))return rollbackD1Import(job.id,importContext(env,review,session))
 return applyD1ImportBatches(job.id,importContext(env,review,session))
}
