import {runForConnection} from '../tests/engine'
import {collectionReceiptTime} from './clock'
import { attachPages, pageContext, pageSnapshot, sourceReadTime } from './pages'
import { sourceEvent } from './event-context'
import { collectionContext } from './run-context'
import { collectionMinutes } from './interval'
import type { Bindings } from '../../auth.server'
import { auditStatement } from '../door'
import type { Connection } from './storage'
// COLLECTION-001 run bookkeeping shared by every connector: an interrupted run
// is closed as failed (never resumed silently), one run per connection holds
// the claim. Initial metadata survives early failures and interruption; every run ends with a terminal outcome and its coverage.
export type RunOutcome = 'complete' | 'partial' | 'failed' | 'throttled'
export async function startRun(env: Bindings, connection: Connection, revision: string, trigger: 'schedule' | 'manual', now: Date, metadata: Record<string, unknown> = {}) {
 metadata = { ...metadata, ...(sourceEvent.getStore() ? {source_event:sourceEvent.getStore()} : {}), interval_minutes: collectionMinutes(connection), context: pageContext() ?? await collectionContext(env, connection), source_event_at: null, attempt_started_at: now.toISOString(), source_read_started_at: null, received_at: null, cursor: null }
 const run = crypto.randomUUID(), at = now.toISOString(), system = { id: 'system', name: 'Evidence collector', kind: 'system' as const }
 await env.DB.prepare("UPDATE collection_runs SET finished_at=?,outcome='failed',error_code='interrupted' WHERE connection_id=? AND finished_at IS NULL AND started_at<?").bind(at, connection.id, new Date(now.getTime() - 15 * 60000).toISOString()).run()
 const claimed = await env.DB.prepare('INSERT INTO collection_runs(id,connection_id,trigger,connector_revision,started_at,coverage_json) VALUES(?,?,?,?,?,?) ON CONFLICT DO NOTHING').bind(run, connection.id, trigger, revision, at, JSON.stringify(metadata)).run()
 if (!claimed.meta.changes) return null
 attachPages(async()=>{
  const patch=JSON.stringify({resume_pages:await pageSnapshot()})
  const saved=await env.DB.prepare('UPDATE collection_runs SET coverage_json=json_patch(coverage_json,?) WHERE id=? AND finished_at IS NULL AND length(json_patch(coverage_json,?))<=250000').bind(patch,run,patch).run()
  if(!saved.meta.changes)throw Error('Durable cursor exceeds the portable metadata bound')
 })
 const finish = async (outcome: RunOutcome, coverage: Record<string, unknown>, error = '', connectionUpdate?: D1PreparedStatement) => {
  const completed=collectionReceiptTime(now),received=completed.toISOString()
  let retained:Record<string,unknown>={ ...metadata, ...coverage, ...(pageContext()?{resume_pages:await pageSnapshot()}:{}), source_read_started_at: outcome === 'complete' || outcome === 'partial' ? coverage.source_read_started_at ?? sourceReadTime(now) : null, received_at: coverage.received_at ?? received }
  if(JSON.stringify(retained).length>250000){
   delete retained.resume_pages;delete retained.resume;delete retained.code_history;retained.cursor=null
   retained.gaps=[...(Array.isArray(retained.gaps)?retained.gaps:[]),'Collection metadata exceeds the portable row bound; detailed history and continuation unavailable. Reduce source scope and read again.']
   if(JSON.stringify(retained).length>250000)retained={...metadata,gaps:['Collection coverage exceeds the portable row bound; detailed coverage unavailable. Reduce source scope and read again.'],received_at:received}
   if(outcome==='complete')outcome='partial'
  }
  await env.DB.batch([
   env.DB.prepare('UPDATE collection_runs SET finished_at=?,outcome=?,coverage_json=?,error_code=? WHERE id=?').bind(received, outcome, JSON.stringify(retained), error, run),
   ...(connectionUpdate ? [connectionUpdate] : []),
   auditStatement(env, system, 'collection.' + outcome, 'connection:' + connection.id, completed, outcome === 'failed' ? 'failed' : 'succeeded', error),
  ])
  if(connectionUpdate){const live=await env.DB.prepare('SELECT status FROM connections WHERE id=?').bind(connection.id).first<{status:string}>();if(live?.status!=='active')await runForConnection(env,connection.id,completed)}
  return { run, outcome }
 }
 const checkpoint = async (coverage: Record<string, unknown>) => { const value=JSON.stringify({ ...metadata, ...coverage });if(value.length>250000)throw Error('Durable cursor exceeds the portable metadata bound');await env.DB.prepare('UPDATE collection_runs SET coverage_json=? WHERE id=? AND finished_at IS NULL').bind(value,run).run() }
 return { run, finish, checkpoint, context: metadata.context }
}
// Throttling backs off exponentially within an hour; a refused credential needs reconnecting.
export const MAX_BACKOFF = 3600
export function backoffUpdate(env: Bindings, connection: Connection, resetAt: number, label: string, now: Date) {
 const backoff = Math.min(MAX_BACKOFF, Math.max(60, connection.backoff_seconds * 2 || 60)), next = new Date(Math.max(resetAt, now.getTime() + backoff * 1000)).toISOString()
 return env.DB.prepare('UPDATE connections SET last_attempt_at=?,next_attempt_at=?,backoff_seconds=?,last_error=? WHERE id=?').bind(now.toISOString(), next, backoff, `${label} rate limit; next attempt ${next}`, connection.id)
}
export const reconnectUpdate = (env: Bindings, connection: Connection, message: string, now: Date) => env.DB.prepare("UPDATE connections SET status='needs reconnect',last_attempt_at=?,last_error=? WHERE id=?").bind(now.toISOString(), message, connection.id)
