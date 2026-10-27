import type { Bindings } from '../../auth.server'
import { auditStatement, type Actor } from '../door'
import { tokenDigest } from '../review/storage'
import { Refusal } from '../upload'
import { investigatePeriod } from './period-analysis'
export interface InvestigationRow { id:string; control_id:string; period_from:string; period_to:string; snapshot_json:string; snapshot_hash:string; created_by:string; created_name:string; created_at:string }
export interface InvestigationDecision { investigation_id:string; action:'reviewed'|'rejected'; snapshot_hash:string; reason:string; actor_id:string; actor_name:string; decided_at:string }
export async function investigation(env:Bindings,id:string) {
 const row=await env.DB.prepare('SELECT * FROM period_investigations WHERE id=?').bind(id).first<InvestigationRow>()
 if(!row) throw new Refusal('Investigation not found.',404)
 return {...row,snapshot:JSON.parse(row.snapshot_json) as Awaited<ReturnType<typeof investigatePeriod>>,decision:await env.DB.prepare('SELECT * FROM period_investigation_decisions WHERE investigation_id=?').bind(id).first<InvestigationDecision>()}
}
export async function prepareInvestigation(env:Bindings,control:string,from:string,to:string,actor:Actor,now:Date) {
 const snapshot=await investigatePeriod(env,control,from,to,now),snapshotJSON=JSON.stringify(snapshot)
 if(new TextEncoder().encode(snapshotJSON).length>512*1024) throw new Refusal('Investigation exceeds 512 KiB. Select a shorter audit period; no partial investigation was saved.',413)
 const id=crypto.randomUUID(),hash=await tokenDigest(snapshotJSON)
 await env.DB.batch([
  env.DB.prepare('INSERT INTO period_investigations(id,control_id,period_from,period_to,snapshot_json,snapshot_hash,created_by,created_name,created_at) VALUES(?,?,?,?,?,?,?,?,?)').bind(id,control,from,to,snapshotJSON,hash,actor.id,actor.name,now.toISOString()),
  auditStatement(env,actor,'agent.period-prepared','investigation:'+id,now,'succeeded','Prepare-only period correlation',{revision:hash}),
 ])
 return investigation(env,id)
}
export async function decideInvestigation(env:Bindings,id:string,hash:string,action:'reviewed'|'rejected',reason:string,actor:Actor,now:Date) {
 const row=await investigation(env,id)
 if(row.snapshot_hash!==hash) throw new Refusal('Review the exact investigation fingerprint.',409)
 if(row.decision) throw new Refusal('This investigation already has a decision.',409)
 try {
  await env.DB.batch([
   env.DB.prepare('INSERT INTO period_investigation_decisions(investigation_id,action,snapshot_hash,reason,actor_id,actor_name,decided_at) VALUES(?,?,?,?,?,?,?)').bind(id,action,hash,reason,actor.id,actor.name,now.toISOString()),
   auditStatement(env,actor,'agent.period-'+action,'investigation:'+id,now,'succeeded','Findings decision only; no exception, mapping or observation changed.',{reason,revision:hash}),
  ])
 } catch(error) {if((await investigation(env,id)).decision)throw new Refusal('This investigation already has a decision.',409);throw error}
 return investigation(env,id)
}
export type Investigation=Awaited<ReturnType<typeof investigation>>
