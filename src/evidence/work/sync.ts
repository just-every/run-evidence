import type { Bindings } from '../../auth.server'
import { Refusal } from '../upload'
import { auditStatement, type Actor } from '../door'
import { obligations, requireObligation, type QueueRow } from '../remedy/storage'
import { catalogueEntry } from '../tests/catalogue'
import { testControls, type Severity } from '../tests/storage'
import { TrackerFailure, type Remote, type TicketRef } from './client'
import { adapters, reference, requireDestination, requireTicket, secretOf, type DestinationRow, type TicketRow } from './storage'
// WORK-001 synchronization. Every inbound change is read back from the tracker
// itself (webhooks only say "look now"), compared with what Evidence last saw
// and recorded once, so a replayed event never changes anything twice.
const SYNC_INTERVAL = 10 * 60000
const system = { id: 'system', name: 'Evidence tracker sync', kind: 'system' as const }
type Row = QueueRow & { sla: { due: string; status: string } }
const ticketEvent = (env: Bindings, ticket: string, kind: string, trigger: string, at: string, detail = '', remote: string | null = null, local: string | null = null) => env.DB.prepare('INSERT INTO ticket_events(id,ticket_id,kind,remote_value,local_value,detail,trigger,at) VALUES(?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(), ticket, kind, remote, local, detail.slice(0, 2000), trigger, at)
const obligationEvent = (env: Bindings, obligation: string, kind: string, actor: { id: string; name: string }, at: string, body: string) => env.DB.prepare('INSERT INTO obligation_events(id,obligation_id,kind,actor_id,actor_name,body,observation_id,at) VALUES(?,?,?,?,?,?,NULL,?)').bind(crypto.randomUUID(), obligation, kind, actor.id, actor.name, body.slice(0, 2000), at)
export const localDue = (o: Pick<Row, 'target_date' | 'sla'>) => o.target_date ?? o.sla.due.slice(0, 10)
const refOf = (t: TicketRow): TicketRef => ({ remote_id: t.remote_id!, remote_key: t.remote_key! })
async function obligationRow(env: Bindings, id: string, now: Date) { const row = (await obligations(env, now)).find(o => o.id === id); if (!row) throw new Refusal('Obligation not found.', 404); return row as Row }
function draftFor(env: Bindings, o: Row, destination: DestinationRow, controls: { name: string; library_id: string | null }[]) {
 const mapping = reference(destination).mapping, entry = o.catalogue_id ? catalogueEntry(o.catalogue_id) : undefined, guide = entry ? Object.entries(entry.remediation)[0] : undefined
 const description = [
  'Evidence remediation obligation. Closing this ticket starts a re-test; only a passing re-test of the real source closes the obligation.',
  `Failing test: ${o.test_name}\nAffected item: ${o.resource_name} (${o.resource_type}, ${o.source_kind})\nSeverity: ${o.category} · ${o.severity}\nRemediate by: ${localDue(o)} (${o.sla.status})\nControls: ${controls.map(c => c.library_id ?? c.name).join(', ') || 'none'}`,
  `Obligation: ${env.AUTH_ORIGIN}/app/remediation/${o.id}\nTest results: ${env.AUTH_ORIGIN}/app/tests/${o.test_id}`,
  ...(guide ? [`How to remediate (${guide[0]}): ${guide[1].console}`] : []),
 ].join('\n\n')
 return { title: `Evidence: ${o.test_name} — ${o.resource_name}`.slice(0, 250), description, priority: mapping.priorities[o.severity as Severity], due: localDue(o), labels: mapping.labels, assignee: o.owner_email ? mapping.assignees[o.owner_email.toLowerCase()] ?? null : null }
}
// Create one ticket per obligation and destination. The row is claimed before
// the tracker call; a lost answer stays "creation uncertain" for the owner.
export async function createTicket(env: Bindings, actor: Actor, obligationId: string, destinationId: string, now: Date) {
 const destination = await requireDestination(env, destinationId), o = await obligationRow(env, obligationId, now), at = now.toISOString()
 if (destination.status !== 'active') throw new Refusal('Reconnect this destination before creating tickets in it.', 409)
 if (o.state === 'verified') throw new Refusal('Verified work needs no ticket.', 409)
 const existing = await env.DB.prepare('SELECT * FROM tickets WHERE obligation_id=? AND destination_id=?').bind(obligationId, destinationId).first<TicketRow>()
 if (existing && !['mapping failed', 'creation uncertain', 'authorization lost'].includes(existing.sync_state)) throw new Refusal('This obligation already has a ticket in that destination.', 409)
 if (existing && existing.remote_id) throw new Refusal('This obligation already has a ticket in that destination.', 409)
 const id = existing?.id ?? crypto.randomUUID()
 const claimed = existing
  ? await env.DB.prepare("UPDATE tickets SET sync_state='creating',sync_error='',last_attempt_at=? WHERE id=? AND sync_state=?").bind(at, id, existing.sync_state).run()
  : await env.DB.prepare("INSERT INTO tickets(id,obligation_id,destination_id,created_at,created_name,sync_state,last_attempt_at) VALUES(?,?,?,?,?,'creating',?) ON CONFLICT DO NOTHING").bind(id, obligationId, destinationId, at, actor.name, at).run()
 if (!claimed.meta.changes) throw new Refusal('A ticket is already being created here.', 409)
 const draft = draftFor(env, o, destination, await testControls(env, o.test_id)), adapter = adapters[destination.provider]
 try {
  const created = await adapter.create(reference(destination), await secretOf(env, destination), draft)
  await env.DB.batch([
   env.DB.prepare("UPDATE tickets SET remote_id=?,remote_key=?,remote_url=?,sync_state='linked',sync_error='',remote_due=?,synced_due=?,last_synced_at=? WHERE id=?").bind(created.id, created.key, created.url, adapter.supportsDue ? draft.due : null, draft.due, at, id),
   ticketEvent(env, id, 'created', 'owner', at, `${adapter.name} ${created.key} by ${actor.name}`, created.key),
   obligationEvent(env, obligationId, 'ticket created', actor, at, `${adapter.name} ${created.key}: ${created.url}`),
   env.DB.prepare('UPDATE tracker_destinations SET last_success_at=?,last_error=? WHERE id=?').bind(at, '', destinationId),
   auditStatement(env, actor, 'ticket.created', 'obligation:' + obligationId, now, 'succeeded', `${destination.provider} ${created.key}`),
  ])
  return { id, key: created.key, url: created.url }
 } catch (error) {
  if (!(error instanceof TrackerFailure)) throw error
  const state = error.kind === 'invalid' ? 'mapping failed' : error.kind === 'unauthorized' ? 'authorization lost' : 'creation uncertain'
  await env.DB.batch([
   env.DB.prepare('UPDATE tickets SET sync_state=?,sync_error=? WHERE id=?').bind(state, error.message, id),
   ticketEvent(env, id, state, 'owner', at, error.message),
   obligationEvent(env, obligationId, 'ticket ' + state, actor, at, error.message),
   ...(error.kind === 'unauthorized' ? [env.DB.prepare("UPDATE tracker_destinations SET status='needs reconnect',last_error=? WHERE id=?").bind(error.message, destinationId)] : []),
   auditStatement(env, actor, 'ticket.created', 'obligation:' + obligationId, now, state === 'creation uncertain' ? 'uncertain' : 'failed', error.message),
  ])
  throw new Refusal(`${adapter.name}: ${error.message}${state === 'creation uncertain' ? ' Check the tracker before creating again: the ticket may exist.' : ''}`, error.kind === 'invalid' ? 400 : 502)
 }
}
// A sync failure changes state once; repeated failures of the same kind stay quiet.
async function failure(env: Bindings, t: TicketRow, destination: DestinationRow, error: TrackerFailure, trigger: string, at: string) {
 const state = error.kind === 'unauthorized' ? 'authorization lost' : error.kind === 'not found' ? 'remote deleted' : 'sync failed'
 const statements = [env.DB.prepare('UPDATE tickets SET sync_state=?,sync_error=?,last_attempt_at=? WHERE id=?').bind(state, error.message, at, t.id)]
 if (t.sync_state !== state) statements.push(ticketEvent(env, t.id, state, trigger, at, error.message), obligationEvent(env, t.obligation_id, 'ticket ' + state, system, at, `${adapters[destination.provider].name} ${t.remote_key}: ${error.message}`))
 if (error.kind === 'unauthorized' && destination.status === 'active') statements.push(env.DB.prepare("UPDATE tracker_destinations SET status='needs reconnect',last_error=? WHERE id=?").bind(error.message, destination.id))
 await env.DB.batch(statements)
 return state
}
export async function syncTicket(env: Bindings, ticket: TicketRow, trigger: string, now: Date, row?: Row) {
 const destination = await requireDestination(env, ticket.destination_id), adapter = adapters[destination.provider], at = now.toISOString()
 if (!ticket.remote_id || !ticket.remote_key) return ticket.sync_state
 if (destination.status !== 'active') return failure(env, ticket, destination, new TrackerFailure('unauthorized', 0, `The destination is ${destination.status}; reconnect it to resume sync.`), trigger, at)
 const o = row ?? await obligationRow(env, ticket.obligation_id, now)
 let remote: Remote
 try { remote = await adapter.read(reference(destination), await secretOf(env, destination), refOf(ticket)) }
 catch (error) { if (error instanceof TrackerFailure) return failure(env, ticket, destination, error, trigger, at); throw error }
 const statements: D1PreparedStatement[] = [], name = `${adapter.name} ${ticket.remote_key}`
 let state = ticket.sync_state === 'conflict' ? 'conflict' : 'linked', syncedDue = ticket.synced_due
 if (['authorization lost', 'remote deleted', 'sync failed'].includes(ticket.sync_state)) statements.push(ticketEvent(env, ticket.id, 'sync recovered', trigger, at, `Read ${name} again`))
 if (remote.status !== ticket.remote_status) statements.push(ticketEvent(env, ticket.id, 'status', trigger, at, '', remote.status, ticket.remote_status || null))
 if ((remote.assignee ?? null) !== (ticket.remote_assignee ?? null)) statements.push(ticketEvent(env, ticket.id, 'assignee', trigger, at, '', remote.assignee, ticket.remote_assignee), obligationEvent(env, ticket.obligation_id, 'tracker assignee', system, at, `${name} assignee: ${remote.assignee ?? 'unassigned'}`))
 // Closing the ticket is linked work closing: the obligation waits for a re-test.
 if (remote.closed && !ticket.remote_closed) {
  statements.push(ticketEvent(env, ticket.id, 'closed in tracker', trigger, at, 'Re-test queued; closing a ticket is never a verified fix', remote.status),
   obligationEvent(env, ticket.obligation_id, 'closed in tracker', system, at, `${name} closed (${remote.status}). A re-test is queued; only a passing re-test closes this obligation.`),
   env.DB.prepare("INSERT INTO retests(id,obligation_id,reason,queued_at) SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM obligations WHERE id=? AND state!='verified') ON CONFLICT DO NOTHING").bind(crypto.randomUUID(), ticket.obligation_id, `${name} closed in the tracker`, at, ticket.obligation_id),
   env.DB.prepare("UPDATE obligations SET state='awaiting verification' WHERE id=? AND state='open'").bind(ticket.obligation_id))
 } else if (!remote.closed && ticket.remote_closed) statements.push(ticketEvent(env, ticket.id, 'reopened in tracker', trigger, at, '', remote.status), obligationEvent(env, ticket.obligation_id, 'reopened in tracker', system, at, `${name} reopened (${remote.status})`))
 // Due date: Evidence owns it. Push local changes; show tracker edits as conflicts.
 // Whole-test tickets carry the earliest item deadline, written by the ticket automation.
 if (adapter.supportsDue && !ticket.group_id) {
  const local = localDue(o), remoteChanged = remote.due !== ticket.synced_due, localChanged = local !== ticket.synced_due
  if (remote.due === local) { syncedDue = local; if (state === 'conflict') { state = 'linked'; statements.push(ticketEvent(env, ticket.id, 'conflict cleared', trigger, at, 'Both sides now agree', remote.due, local)) } }
  else if (remoteChanged) {
   if (state !== 'conflict' || ticket.remote_due !== remote.due) statements.push(ticketEvent(env, ticket.id, 'conflict', trigger, at, localChanged ? 'The due date changed on both sides; neither value was overwritten' : 'The tracker changed the due date Evidence owns; it was not overwritten', remote.due, local), obligationEvent(env, ticket.obligation_id, 'ticket conflict', system, at, `${name} due date: tracker ${remote.due ?? 'none'}, Evidence ${local}. Choose which to keep.`))
   state = 'conflict'
  } else if (localChanged) {
   try { await adapter.setDue(reference(destination), await secretOf(env, destination), refOf(ticket), local); statements.push(ticketEvent(env, ticket.id, 'due date written', trigger, at, '', local, local)); syncedDue = local; remote.due = local }
   catch (error) { if (error instanceof TrackerFailure) return failure(env, ticket, destination, error, trigger, at); throw error }
  }
 }
 const mirrored = new Set((await env.DB.prepare('SELECT remote_comment_id FROM ticket_comments WHERE ticket_id=?').bind(ticket.id).all<{ remote_comment_id: string }>()).results.map(c => c.remote_comment_id))
 for (const c of remote.comments.filter(c => !mirrored.has(c.id))) statements.push(env.DB.prepare("INSERT INTO ticket_comments(ticket_id,remote_comment_id,direction,at) VALUES(?,?,'in',?) ON CONFLICT DO NOTHING").bind(ticket.id, c.id, at), obligationEvent(env, ticket.obligation_id, 'tracker comment', { id: 'tracker', name: `${c.author} in ${adapter.name}` }, at, adapter.commentText ? c.body : `Commented in ${name} at ${c.at} (${adapter.name}'s API does not expose comment text)`))
 statements.push(env.DB.prepare('UPDATE tickets SET sync_state=?,sync_error=?,remote_status=?,remote_closed=?,remote_assignee=?,remote_due=?,synced_due=?,last_synced_at=?,last_attempt_at=? WHERE id=?').bind(state, '', remote.status, remote.closed ? 1 : 0, remote.assignee, remote.due, syncedDue, at, at, ticket.id),
  env.DB.prepare('UPDATE tracker_destinations SET last_success_at=?,last_error=? WHERE id=?').bind(at, '', destination.id))
 await env.DB.batch(statements)
 return state
}
// Polling: every linked ticket is read at least every ten minutes, so tracker
// changes reach Evidence within one 5-minute scheduler tick of that.
export async function syncDue(env: Bindings, now: Date, limit = 50) {
 const due = (await env.DB.prepare("SELECT * FROM tickets WHERE remote_id IS NOT NULL AND (last_attempt_at IS NULL OR last_attempt_at<=?) ORDER BY last_attempt_at LIMIT ?").bind(new Date(now.getTime() - SYNC_INTERVAL + 60000).toISOString(), limit).all<TicketRow>()).results
 if (!due.length) return 0
 const rows = new Map((await obligations(env, now)).map(o => [o.id, o as Row]))
 for (const t of due) await syncTicket(env, t, 'poll', now, rows.get(t.obligation_id))
 return due.length
}
// Evidence comments travel to every linked ticket; a failed post stays visible.
export async function mirrorComment(env: Bindings, obligationId: string, actor: Actor, body: string, now: Date) {
 const linked = (await env.DB.prepare("SELECT * FROM tickets WHERE obligation_id=? AND remote_id IS NOT NULL AND sync_state NOT IN ('remote deleted','authorization lost')").bind(obligationId).all<TicketRow>()).results, at = now.toISOString()
 for (const t of linked) {
  const destination = await requireDestination(env, t.destination_id)
  if (destination.status !== 'active') continue
  try {
   const remoteId = await adapters[destination.provider].comment(reference(destination), await secretOf(env, destination), refOf(t), `${actor.name} in Evidence: ${body}`)
   await env.DB.batch([env.DB.prepare("INSERT INTO ticket_comments(ticket_id,remote_comment_id,direction,at) VALUES(?,?,'out',?) ON CONFLICT DO NOTHING").bind(t.id, remoteId, at), ticketEvent(env, t.id, 'comment posted', 'owner', at, body)])
  } catch (error) { if (error instanceof TrackerFailure) await failure(env, t, destination, error, 'owner', at); else throw error }
 }
}
// The owner settles a due-date conflict by choosing one side; the other is written.
export async function resolveConflict(env: Bindings, actor: Actor, ticketId: string, keep: 'evidence' | 'tracker', now: Date) {
 const t = await requireTicket(env, ticketId), destination = await requireDestination(env, t.destination_id), at = now.toISOString()
 if (t.sync_state !== 'conflict') throw new Refusal('This ticket has no conflict to resolve.', 409)
 const o = await obligationRow(env, t.obligation_id, now), local = localDue(o)
 if (keep === 'evidence') {
  try { await adapters[destination.provider].setDue(reference(destination), await secretOf(env, destination), refOf(t), local) }
  catch (error) { if (error instanceof TrackerFailure) { await failure(env, t, destination, error, 'owner', at); throw new Refusal(error.message, 502) } throw error }
  await env.DB.batch([env.DB.prepare("UPDATE tickets SET sync_state='linked',remote_due=?,synced_due=? WHERE id=?").bind(local, local, t.id), ticketEvent(env, t.id, 'conflict resolved', 'owner', at, `${actor.name} kept the Evidence due date`, t.remote_due, local), auditStatement(env, actor, 'ticket.conflict-resolved', 'obligation:' + t.obligation_id, now, 'succeeded', 'kept Evidence value')])
 } else {
  await requireObligation(env, t.obligation_id)
  await env.DB.batch([env.DB.prepare('UPDATE obligations SET target_date=? WHERE id=?').bind(t.remote_due, t.obligation_id), env.DB.prepare("UPDATE tickets SET sync_state='linked',synced_due=? WHERE id=?").bind(t.remote_due, t.id), ticketEvent(env, t.id, 'conflict resolved', 'owner', at, `${actor.name} kept the tracker due date`, t.remote_due, local), obligationEvent(env, t.obligation_id, 'assigned', actor, at, `Target date set to ${t.remote_due ?? 'none'} from the tracker`), auditStatement(env, actor, 'ticket.conflict-resolved', 'obligation:' + t.obligation_id, now, 'succeeded', 'kept tracker value')])
 }
}
