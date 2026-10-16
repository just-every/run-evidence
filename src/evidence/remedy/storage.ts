import type { Bindings } from '../../auth.server'
import { Refusal } from '../upload'
import { auditStatement, type Actor } from '../door'
import { sendFollowup } from '../followup'
import type { Observation, TestRow } from '../tests/storage'
// REMEDY-001/002. Each failing item gets one durable obligation with its own SLA
// clock from its first failing observation. Only a later passing observation
// from the item's source closes it; a ticket or a person marking it done does not.
export const defaultSla: Record<string, number> = { critical: 15, high: 30, medium: 60, low: 90 }
export const DAY = 86400000
export interface Obligation { id: string; test_id: string; resource_id: string; severity: string; category: string; state: 'open' | 'awaiting verification' | 'verified' | 'risk accepted'; clock_started_at: string; sla_days: number; sla_policy_id: string | null; opened_observation_id: string; owner_person_id: string | null; next_action: string; target_date: string | null; accepted_until: string | null; accepted_by: string | null; closed_at: string | null; verified_observation_id: string | null; cycles: number }
const system = { id: 'system', name: 'Evidence' }
export async function slaFor(env: Bindings, category: string, severity: string, at: Date) {
 const policy = await env.DB.prepare('SELECT id,days FROM sla_policies WHERE category=? AND severity=? AND effective_at<=? ORDER BY effective_at DESC,rowid DESC LIMIT 1').bind(category, severity, at.toISOString()).first<{ id: string; days: number }>()
 return policy ? { days: policy.days, id: policy.id } : { days: defaultSla[severity] ?? 30, id: null }
}
const event = (env: Bindings, obligation: string, kind: string, actor: Actor, at: string, body = '', observation: string | null = null) => env.DB.prepare('INSERT INTO obligation_events(id,obligation_id,kind,actor_id,actor_name,body,observation_id,at) VALUES(?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(), obligation, kind, actor.id, actor.name, body, observation, at)

// Statements that move obligations after a run's observations are appended.
export async function remediationStatements(env: Bindings, test: TestRow, observations: Observation[], now: Date) {
 const statements: D1PreparedStatement[] = [], at = now.toISOString()
 if (!observations.length) return statements
 const existing = new Map((await env.DB.prepare('SELECT * FROM obligations WHERE test_id=?').bind(test.id).all<Obligation>()).results.map(o => [o.resource_id, o]))
 const sla = await slaFor(env, test.category, test.severity, now)
 for (const o of observations) {
  const ob = existing.get(o.resource_id), label = o.source_kind === 'source-reported' ? 'source-reported data' : 'a fresh source read'
  if (o.result === 'fail') {
   if (!ob) {
    const id = crypto.randomUUID()
    statements.push(env.DB.prepare("INSERT INTO obligations(id,test_id,resource_id,severity,category,state,clock_started_at,sla_days,sla_policy_id,opened_observation_id) VALUES(?,?,?,?,?,'open',?,?,?,?)").bind(id, test.id, o.resource_id, test.severity, test.category, at, sla.days, sla.id, o.id), event(env, id, 'opened', system, at, o.reason, o.id))
   } else if (ob.state === 'verified') {
    statements.push(env.DB.prepare("UPDATE obligations SET state='open',clock_started_at=?,sla_days=?,sla_policy_id=?,closed_at=NULL,verified_observation_id=NULL,accepted_until=NULL,accepted_by=NULL,cycles=cycles+1 WHERE id=?").bind(at, sla.days, sla.id, ob.id), event(env, ob.id, 'reopened', system, at, 'Failed again after a verified fix: ' + o.reason, o.id))
   } else if (ob.state === 'awaiting verification') {
    statements.push(env.DB.prepare("UPDATE obligations SET state='open' WHERE id=?").bind(ob.id), event(env, ob.id, 'retest failed', system, at, 'Work was marked done but the re-test still fails; the obligation stays open and its SLA clock keeps running. ' + o.reason, o.id))
   } else if (ob.state === 'risk accepted' && ob.accepted_until && ob.accepted_until <= at) {
    statements.push(env.DB.prepare("UPDATE obligations SET state='open',accepted_until=NULL WHERE id=?").bind(ob.id), event(env, ob.id, 'acceptance expired', system, at, 'Risk acceptance expired while the item still fails.', o.id))
   }
  } else if (o.result === 'pass' && ob && ob.state !== 'verified') {
   statements.push(env.DB.prepare("UPDATE obligations SET state='verified',closed_at=?,verified_observation_id=? WHERE id=?").bind(at, o.id, ob.id), event(env, ob.id, 'verified', system, at, 'Passed on ' + label + '.', o.id))
  }
 }
 return statements
}
export async function requireObligation(env: Bindings, id: string) { const row = await env.DB.prepare('SELECT * FROM obligations WHERE id=?').bind(id).first<Obligation>(); if (!row) throw new Refusal('Obligation not found.', 404); return row }
export async function assign(env: Bindings, actor: Actor, id: string, owner: string, nextAction: string, target: string | null, now: Date) {
 await requireObligation(env, id); const at = now.toISOString()
 await env.DB.batch([env.DB.prepare('UPDATE obligations SET owner_person_id=?,next_action=?,target_date=? WHERE id=?').bind(owner, nextAction, target, id), event(env, id, 'assigned', actor, at, nextAction + (target ? ` (target ${target})` : '')), auditStatement(env, actor, 'remediation.assigned', 'obligation:' + id, now)])
}
export async function note(env: Bindings, actor: Actor, id: string, kind: 'comment' | 'change attached', body: string, now: Date) {
 await requireObligation(env, id)
 await env.DB.batch([event(env, id, kind, actor, now.toISOString(), body), auditStatement(env, actor, 'remediation.' + kind.replace(' ', '-'), 'obligation:' + id, now)])
}
// Marking work done never closes the obligation: it waits for a re-test.
export async function markDone(env: Bindings, actor: Actor, id: string, body: string, now: Date) {
 const row = await requireObligation(env, id), at = now.toISOString()
 if (row.state !== 'open') throw new Refusal('Only open work can be marked done.', 409)
 await env.DB.batch([
  env.DB.prepare("UPDATE obligations SET state='awaiting verification' WHERE id=? AND state='open'").bind(id),
  event(env, id, 'marked done', actor, at, body || 'Marked done; awaiting an independent re-test.'),
  env.DB.prepare('INSERT INTO retests(id,obligation_id,reason,queued_at) VALUES(?,?,?,?) ON CONFLICT DO NOTHING').bind(crypto.randomUUID(), id, 'Linked work closed in Evidence', at),
  auditStatement(env, actor, 'remediation.marked-done', 'obligation:' + id, now),
 ])
}
export async function queueRetest(env: Bindings, actor: Actor, id: string, reason: string, now: Date) {
 await requireObligation(env, id); const at = now.toISOString()
 await env.DB.batch([env.DB.prepare('INSERT INTO retests(id,obligation_id,reason,queued_at) VALUES(?,?,?,?) ON CONFLICT DO NOTHING').bind(crypto.randomUUID(), id, reason, at), event(env, id, 're-test requested', actor, at, reason)])
}
export async function acceptRisk(env: Bindings, actor: Actor, id: string, rationale: string, until: string, now: Date) {
 const row = await requireObligation(env, id), at = now.toISOString()
 if (row.state === 'verified') throw new Refusal('Verified work needs no acceptance.', 409)
 if (!(Date.parse(until) > now.getTime())) throw new Refusal('A risk acceptance needs a future expiry.')
 const expiry = new Date(Date.parse(until)).toISOString()
 await env.DB.batch([
  env.DB.prepare("UPDATE obligations SET state='risk accepted',accepted_until=?,accepted_by=? WHERE id=?").bind(expiry, actor.name, id),
  event(env, id, 'risk accepted', actor, at, `${rationale} (approved by ${actor.name} until ${expiry})`),
  auditStatement(env, actor, 'remediation.risk-accepted', 'obligation:' + id, now, 'succeeded', 'until ' + expiry),
 ])
}
// Paused time: approved, expiring exceptions overlapping the running clock.
export function slaStatus(o: Obligation, exceptions: { test_id: string; resource_id: string | null; approved_at: string; expires_at: string; revoked_at: string | null }[], now: Date) {
 const start = Date.parse(o.clock_started_at), end = o.closed_at ? Date.parse(o.closed_at) : now.getTime()
 const paused = exceptions.filter(e => e.test_id === o.test_id && (e.resource_id === null || e.resource_id === o.resource_id)).reduce((sum, e) => {
  const from = Math.max(start, Date.parse(e.approved_at)), to = Math.min(end, Date.parse(e.revoked_at ?? e.expires_at), Date.parse(e.expires_at))
  return sum + Math.max(0, to - from)
 }, 0)
 const due = start + o.sla_days * DAY + paused, pausedNow = exceptions.some(e => e.test_id === o.test_id && (e.resource_id === null || e.resource_id === o.resource_id) && !e.revoked_at && Date.parse(e.approved_at) <= now.getTime() && Date.parse(e.expires_at) > now.getTime())
 const status = o.state === 'verified' ? (end <= due ? 'resolved within SLA' : 'resolved after SLA') : now.getTime() >= due ? 'SLA missed' : now.getTime() >= due - Math.max(DAY, o.sla_days * DAY * 0.2) ? 'approaching' : 'within SLA'
 return { due: new Date(due).toISOString(), status, paused: pausedNow, pausedMs: paused, hoursToRemediate: o.closed_at ? Math.round((end - start) / 3600000) : null }
}
export const allExceptions = async (env: Bindings) => (await env.DB.prepare('SELECT test_id,resource_id,approved_at,expires_at,revoked_at FROM test_exceptions').all<{ test_id: string; resource_id: string | null; approved_at: string; expires_at: string; revoked_at: string | null }>()).results
export interface QueueRow extends Obligation { test_name: string; catalogue_id: string | null; resource_name: string; resource_type: string; source_kind: string; owner_name: string | null; owner_email: string | null }
export async function obligations(env: Bindings, now: Date) {
 const rows = (await env.DB.prepare('SELECT o.*,t.name AS test_name,t.catalogue_id,r.display_name AS resource_name,r.type AS resource_type,r.source_kind,p.name AS owner_name,p.email AS owner_email FROM obligations o JOIN tests t ON t.id=o.test_id JOIN resources r ON r.id=o.resource_id LEFT JOIN people p ON p.id=o.owner_person_id ORDER BY o.clock_started_at,o.id').all<QueueRow>()).results
 const exceptions = await allExceptions(env)
 return rows.map(o => ({ ...o, sla: slaStatus(o, exceptions, now) }))
}
export const obligationEvents = async (env: Bindings, id: string) => (await env.DB.prepare('SELECT kind,actor_name,body,observation_id,at FROM obligation_events WHERE obligation_id=? ORDER BY at,rowid').bind(id).all<{ kind: string; actor_name: string; body: string; observation_id: string | null; at: string }>()).results
// Automatic re-tests: queued by closed work, run within one scheduler tick.
export async function runRetests(env: Bindings, now: Date, run: (testId: string, resourceId: string) => Promise<{ run: string }>) {
 const { results } = await env.DB.prepare('SELECT q.id,o.test_id,o.resource_id FROM retests q JOIN obligations o ON o.id=q.obligation_id WHERE q.done_at IS NULL ORDER BY q.queued_at LIMIT 50').all<{ id: string; test_id: string; resource_id: string }>()
 for (const item of results) {
  const outcome = await run(item.test_id, item.resource_id)
  await env.DB.prepare('UPDATE retests SET run_id=?,done_at=? WHERE id=? AND done_at IS NULL').bind(outcome.run, now.toISOString(), item.id).run()
 }
 return results.length
}
// Expired acceptances reopen; approaching and missed SLAs escalate by email once per cycle.
export async function escalate(env: Bindings, now: Date) {
 const at = now.toISOString()
 for (const o of (await env.DB.prepare("SELECT id FROM obligations WHERE state='risk accepted' AND accepted_until<=?").bind(at).all<{ id: string }>()).results)
  await env.DB.batch([env.DB.prepare("UPDATE obligations SET state='open',accepted_until=NULL WHERE id=? AND state='risk accepted'").bind(o.id), event(env, o.id, 'acceptance expired', system, at, 'Risk acceptance expired; the obligation is open again.')])
 let sent = 0
 for (const o of await obligations(env, now)) {
  if (o.state === 'verified' || o.state === 'risk accepted' || !['approaching', 'SLA missed'].includes(o.sla.status)) continue
  const kind = o.sla.status === 'SLA missed' ? 'sla-missed' : 'sla-approaching'
  const result = await sendFollowup(env, { kind, subject: o.id, cycle: String(o.cycles), recipient: o.owner_email ?? env.OWNER_EMAIL, title: `${o.sla.status === 'SLA missed' ? 'SLA missed' : 'SLA approaching'}: ${o.test_name} on ${o.resource_name}`, text: `${o.test_name} fails on ${o.resource_name}. Remediate by ${o.sla.due.slice(0, 10)} (${o.sla.status}).\n\nOpen the obligation in Evidence: ${env.AUTH_ORIGIN}/app/remediation/${o.id}\n\nA sent reminder is not proof that anyone acted; only a passing re-test closes this.` }, now)
  if (result !== 'duplicate') { sent++; await event(env, o.id, 'escalated', system, at, `${kind} email to ${o.owner_email ? 'the assigned owner' : 'the installation owner'}: ${result}`).run() }
 }
 return sent
}
