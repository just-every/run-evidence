import type { Bindings } from '../../auth.server'
import { ExecutionScope, ExecutionStopped, EXECUTION_TIMEOUT_MS } from './execution'

export const LEASE_MINUTES = 15
export interface StepOutcome { id: string; step: string; scheduled_at: string; lease_until: string; finished_at: string | null; outcome: string; processed_count: number | null; detail: string }
// Each step claims before invoking product work. A lost completion write leaves
// its claim running until reconciliation; it can never be mistaken for success.
export async function runStep(env: Bindings, name: string, now: Date, work: (scopedEnv: Bindings) => Promise<number>, deadline = Date.now() + EXECUTION_TIMEOUT_MS) {
 const at = now.toISOString(), id = crypto.randomUUID()
 await env.DB.prepare("UPDATE operation_steps SET outcome='unknown',finished_at=?,detail='Execution interrupted or lease expired; inspect the underlying records before retrying effects.' WHERE outcome='running' AND lease_until<=?").bind(at, at).run()
 const claim = await env.DB.prepare("INSERT INTO operation_steps(id,step,scheduled_at,lease_until,outcome,detail) VALUES(?,?,?,?,'running','') ON CONFLICT DO NOTHING").bind(id, name, at, new Date(now.getTime() + LEASE_MINUTES * 60000).toISOString()).run()
 if (!claim.meta.changes) return 'already running'
 let count: number
 try { count = await new ExecutionScope(env, id, deadline).run(work) }
 catch (error) {
  // Exception messages from providers and storage may contain secrets. Only
  // this fixed description crosses the durable/public owner boundary.
  const uncertain = error instanceof ExecutionStopped
  const saved = await env.DB.prepare('UPDATE operation_steps SET outcome=?,finished_at=?,detail=? WHERE id=? AND outcome=\'running\'').bind(uncertain ? 'unknown' : 'failed', at, uncertain ? 'Execution stopped or its claim was lost. Effects already submitted may have completed; inspect underlying records before retrying.' : 'Step failed; inspect its collection, ticket or delivery records. No completeness is claimed.', id).run()
  return !saved.meta.changes || uncertain ? 'unknown' : 'failed'
 }
 // Do not catch a storage failure here: the caller must see failure and the
 // retained running claim becomes Unknown on the next tick after its lease.
 const saved = await env.DB.prepare("UPDATE operation_steps SET outcome='succeeded',finished_at=?,processed_count=? WHERE id=? AND outcome='running'").bind(at, count, id).run()
 return saved.meta.changes ? count : 'unknown'
}
// The delivery id already deduplicates sends. Never resend a provider call
// whose answer was lost on restart; move its expired pending row to uncertain
// for the existing owner-resolution door. Bound reconciliation to 100 per tick.
export async function reconcileDeliveries(env: Bindings, now: Date) {
 const before = new Date(now.getTime() - LEASE_MINUTES * 60000).toISOString()
 const rows = (await env.DB.prepare("SELECT id FROM followups WHERE state='pending' AND created_at<=? ORDER BY created_at,id LIMIT 100").bind(before).all<{id: string}>()).results
 let count = 0
 for (const row of rows) {
  const result = await env.DB.batch([
   env.DB.prepare("INSERT INTO product_audit(id,actor_kind,actor_id,actor_name,action,subject,outcome,detail,at) SELECT ?,'system','system','Evidence scheduled recovery','followup.sent',?,'uncertain','Interrupted delivery; provider acceptance is unknown. No automatic resend.',? WHERE EXISTS(SELECT 1 FROM followups WHERE id=? AND state='pending')").bind(crypto.randomUUID(), 'followup:' + row.id, now.toISOString(), row.id),
   env.DB.prepare("UPDATE followups SET state='uncertain',detail='Interrupted delivery; the provider may or may not have accepted it. No automatic resend.',attempted_at=? WHERE id=? AND state='pending'").bind(now.toISOString(), row.id),
  ])
  count += result[1].meta.changes
 }
 return count
}
export async function operationOutcomes(env: Bindings) {
 const rows = (await env.DB.prepare('SELECT * FROM operation_steps ORDER BY scheduled_at DESC,rowid DESC LIMIT 101').all<StepOutcome>()).results
 return { steps: rows.slice(0,100), more: rows.length > 100, lease_minutes: LEASE_MINUTES, custody: 'Execution history is included in complete custody archives; restoration never replays attempts.' }
}
