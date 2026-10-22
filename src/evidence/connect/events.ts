import type { Bindings } from '../../auth.server'
import { auditStatement, list, text, type Actor, type Input } from '../door'
import { digest } from '../api/tokens'
import { capabilityAllowed } from '../archive/capabilities'
import { Refusal } from '../upload'
import { requireConnection } from './storage'
import { sourceEvent } from './event-context'
// An event is an authenticated hint to read the existing authorized source.
// Its payload never supplies evidence. No token may trigger a connection until
// its owner explicitly grants that token, on that connection, with a reason.
export async function grantEvents(env: Bindings, actor: Actor, id: string, input: Input, now: Date) {
 const connection = await requireConnection(env,id)
 if (connection.provider === 'private-git') throw new Refusal('Private Git uses its installed local collector.',409)
 const tokens = list(input,'event_tokens',100), reason = text(input,'reason',500)
 for (const token of tokens) {
  const allowed = await env.DB.prepare("SELECT 1 FROM api_tokens WHERE id=? AND token_hash IS NOT NULL AND revoked_at IS NULL AND expires_at>? AND EXISTS(SELECT 1 FROM json_each(scopes) WHERE value='resource-push')").bind(token,now.toISOString()).first()
  if (!allowed) throw new Refusal('Choose active resource-push tokens from the API token list.')
 }
 const config = {...JSON.parse(connection.config_json),event_token_ids:tokens}
 await env.DB.batch([env.DB.prepare('UPDATE connections SET config_json=? WHERE id=?').bind(JSON.stringify(config),id),auditStatement(env,actor,'connection.event-permissions','connection:'+id,now,'succeeded',JSON.stringify({token_ids:tokens}),{reason})])
 return {token_ids:tokens}
}
export async function queueEvent(env: Bindings, id: string, token: {id:string;name:string}, input: Record<string,unknown>, now: Date) {
 const connection = await requireConnection(env,id)
 const allowed = JSON.parse(connection.config_json).event_token_ids as unknown
 if (connection.provider === 'private-git' || connection.status !== 'active' || !await capabilityAllowed(env,'collections',id) || !Array.isArray(allowed) || !allowed.includes(token.id)) throw new Refusal('This token has no source-event grant for this active connection.',403)
 if (typeof input.event_id !== 'string' || !input.event_id.trim() || input.event_id.length > 200) throw new Refusal('Supply an opaque source event_id of at most 200 characters.')
 let reported: string | null = null
 if (input.reported_at !== undefined) {
  if (typeof input.reported_at !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(input.reported_at) || !Number.isFinite(Date.parse(input.reported_at)) || Date.parse(input.reported_at)>now.getTime()+300000) throw new Refusal('reported_at must be a source-reported timestamp, at most five minutes ahead of this collector.')
  reported=new Date(input.reported_at).toISOString()
 }
 const hash=await digest(token.id+':'+input.event_id), receipt=crypto.randomUUID(), subject='connection:'+id
 const detail=JSON.stringify({event_hash:hash,token_id:token.id,reported_at:reported})
 // One conditional insert is atomic in D1, including concurrent duplicates.
 await env.DB.prepare("INSERT INTO product_audit(id,actor_kind,actor_id,actor_name,action,subject,outcome,detail,at) SELECT ?,'token',?,?,'collection.event-queued',?,'succeeded',?,? WHERE NOT EXISTS(SELECT 1 FROM product_audit WHERE action='collection.event-queued' AND subject=? AND json_extract(detail,'$.event_hash')=?)").bind(receipt,token.id,'API token '+token.name,subject,detail,now.toISOString(),subject,hash).run()
 const row=await env.DB.prepare("SELECT id FROM product_audit WHERE action='collection.event-queued' AND subject=? AND json_extract(detail,'$.event_hash')=?").bind(subject,hash).first<{id:string}>()
 return {receipt:row!.id,state:'queued',meaning:'Hint accepted; only a later authorized source read can establish observed evidence.'}
}
export async function eventHistory(env: Bindings,id:string) {
 return (await env.DB.prepare("SELECT q.id,q.at AS received_at,json_extract(q.detail,'$.reported_at') AS reported_at,COALESCE((SELECT json_extract(r.detail,'$.outcome') FROM product_audit r WHERE r.action='collection.event-finished' AND json_extract(r.detail,'$.event_id')=q.id ORDER BY r.rowid DESC LIMIT 1),'pending; authority checked at dispatch') AS outcome FROM product_audit q WHERE q.action='collection.event-queued' AND q.subject=? ORDER BY q.at DESC,q.rowid DESC LIMIT 100").bind('connection:'+id).all()).results
}
type Collector=(env:Bindings,id:string,now:Date)=>Promise<{run:string|null;outcome:string}>
export async function collectEvents(env:Bindings,now:Date,collect:Collector) {
 const queue=(await env.DB.prepare("SELECT q.id,q.subject,q.detail,q.at FROM product_audit q JOIN connections c ON q.subject='connection:'||c.id JOIN api_tokens t ON t.id=json_extract(q.detail,'$.token_id') WHERE q.action='collection.event-queued' AND c.status='active' AND t.token_hash IS NOT NULL AND t.revoked_at IS NULL AND t.expires_at>? AND (c.next_attempt_at IS NULL OR c.next_attempt_at<=?) AND EXISTS(SELECT 1 FROM json_each(c.config_json,'$.event_token_ids') WHERE value=t.id) AND NOT EXISTS(SELECT 1 FROM product_audit r WHERE r.action='collection.event-finished' AND json_extract(r.detail,'$.event_id')=q.id) ORDER BY q.at,q.rowid LIMIT 50").bind(now.toISOString(),now.toISOString()).all<{id:string;subject:string;detail:string;at:string}>()).results
 let processed=0
 for (const event of queue) {
  const connection=await requireConnection(env,event.subject.slice('connection:'.length)), input=JSON.parse(event.detail) as {token_id:string;reported_at:string|null}
  const token=await env.DB.prepare('SELECT 1 FROM api_tokens WHERE id=? AND token_hash IS NOT NULL AND revoked_at IS NULL AND expires_at>?').bind(input.token_id,now.toISOString()).first()
  if (!token || connection.status !== 'active' || !JSON.parse(connection.config_json).event_token_ids?.includes(input.token_id) || !await capabilityAllowed(env,'collections',connection.id) || connection.next_attempt_at && connection.next_attempt_at>now.toISOString()) continue
  const prior=await env.DB.prepare("SELECT id AS run,outcome,error_code FROM collection_runs WHERE connection_id=? AND json_extract(coverage_json,'$.source_event.id')=? AND finished_at IS NOT NULL ORDER BY rowid DESC LIMIT 1").bind(connection.id,event.id).first<{run:string;outcome:string;error_code:string}>()
  // Reconcile a crash after the source read committed and before its queue
  // disposition. The earlier actual read is never repeated or relabeled.
  const result=prior && prior.outcome!=='throttled' && prior.error_code!=='interrupted' ? prior : await sourceEvent.run({id:event.id,received_at:event.at,reported_at:input.reported_at},()=>collect(env,connection.id,now))
  if (!result.run || result.outcome==='already running') continue
  if (result.outcome !== 'throttled') await auditStatement(env,{id:'system',name:'Evidence collector',kind:'system'},'collection.event-finished',event.subject,now,'succeeded',JSON.stringify({event_id:event.id,run:result.run,outcome:result.outcome})).run()
  processed++
  if (processed>=10) break
 }
 return processed
}
