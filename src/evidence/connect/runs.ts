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
 metadata = { ...metadata, interval_minutes: collectionMinutes(connection), context: await collectionContext(env, connection), source_event_at: null, attempt_started_at: now.toISOString(), source_read_started_at: null, received_at: null, cursor: null }
 const run = crypto.randomUUID(), at = now.toISOString(), system = { id: 'system', name: 'Evidence collector', kind: 'system' as const }
 await env.DB.prepare("UPDATE collection_runs SET finished_at=?,outcome='failed',error_code='interrupted' WHERE connection_id=? AND finished_at IS NULL AND started_at<=?").bind(at, connection.id, new Date(now.getTime() - 15 * 60000).toISOString()).run()
 const claimed = await env.DB.prepare('INSERT INTO collection_runs(id,connection_id,trigger,connector_revision,started_at,coverage_json) VALUES(?,?,?,?,?,?) ON CONFLICT DO NOTHING').bind(run, connection.id, trigger, revision, at, JSON.stringify(metadata)).run()
 if (!claimed.meta.changes) return null
 const finish = async (outcome: RunOutcome, coverage: Record<string, unknown>, error = '', connectionUpdate?: D1PreparedStatement) => {
  await env.DB.batch([
   env.DB.prepare('UPDATE collection_runs SET finished_at=?,outcome=?,coverage_json=?,error_code=? WHERE id=?').bind(now.toISOString(), outcome, JSON.stringify({ ...metadata, ...coverage, source_read_started_at: outcome === 'complete' || outcome === 'partial' ? coverage.source_read_started_at ?? at : null, received_at: now.toISOString() }), error, run),
   ...(connectionUpdate ? [connectionUpdate] : []),
   auditStatement(env, system, 'collection.' + outcome, 'connection:' + connection.id, now, outcome === 'failed' ? 'failed' : 'succeeded', error),
  ])
  return { run, outcome }
 }
 const checkpoint = async (coverage: Record<string, unknown>) => { await env.DB.prepare('UPDATE collection_runs SET coverage_json=? WHERE id=? AND finished_at IS NULL').bind(JSON.stringify({ ...metadata, ...coverage }),run).run() }
 return { run, finish, checkpoint }
}
// Throttling backs off exponentially within an hour; a refused credential needs reconnecting.
export const MAX_BACKOFF = 3600
export function backoffUpdate(env: Bindings, connection: Connection, resetAt: number, label: string, now: Date) {
 const backoff = Math.min(MAX_BACKOFF, Math.max(60, connection.backoff_seconds * 2 || 60)), next = new Date(Math.max(resetAt, now.getTime() + backoff * 1000)).toISOString()
 return env.DB.prepare('UPDATE connections SET last_attempt_at=?,next_attempt_at=?,backoff_seconds=?,last_error=? WHERE id=?').bind(now.toISOString(), next, backoff, `${label} rate limit; next attempt ${next}`, connection.id)
}
export const reconnectUpdate = (env: Bindings, connection: Connection, message: string, now: Date) => env.DB.prepare("UPDATE connections SET status='needs reconnect',last_attempt_at=?,last_error=? WHERE id=?").bind(now.toISOString(), message, connection.id)
