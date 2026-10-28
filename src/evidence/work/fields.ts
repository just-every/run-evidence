import type { Bindings } from '../../auth.server'
import { auditStatement, text, type Actor, type Input } from '../door'
import { Refusal } from '../upload'
import { TrackerFieldConflict, TrackerFailure, type Remote, type FieldChanges } from './client'
import { adapters, mappingOf, reference, requireDestination, requireTicket, secretOf } from './storage'
import { syncTicket } from './sync'

// WORK-003: a human edits explicit provider mappings against a fresh identity
// snapshot. Display names never establish identity or authorize a tracker write.
export const fieldSnapshot = (remote: Pick<Remote, 'status_id' | 'assignee_ids'>) => JSON.stringify({ status_id: remote.status_id, assignee_ids: remote.assignee_ids === null ? null : [...remote.assignee_ids].sort() })
const targetRef = (ticket: Awaited<ReturnType<typeof requireTicket>>) => {
 if (!ticket.remote_id || !ticket.remote_key) throw new Refusal('Create a linked tracker ticket first.', 409)
 return { remote_id: ticket.remote_id, remote_key: ticket.remote_key }
}
export async function readFields(env: Bindings, ticketId: string) {
 const ticket = await requireTicket(env, ticketId), destination = await requireDestination(env, ticket.destination_id)
 if (destination.status !== 'active') throw new Refusal('Reconnect this destination before editing its tracker fields.', 409)
 try {
  const remote = await adapters[destination.provider].read(reference(destination), await secretOf(env, destination), targetRef(ticket))
  return { ticket, remote, snapshot: fieldSnapshot(remote), mapping: mappingOf(destination), destination }
 } catch (error) { if (error instanceof TrackerFailure) throw new Refusal(error.message, 502); throw error }
}
function expectedSnapshot(input: Input) {
 try {
  const parsed = JSON.parse(text(input, 'snapshot', 10000))
  if (!parsed || !Object.hasOwn(parsed, 'status_id') || !Object.hasOwn(parsed, 'assignee_ids') || (parsed.status_id !== null && typeof parsed.status_id !== 'string') || (parsed.assignee_ids !== null && (!Array.isArray(parsed.assignee_ids) || parsed.assignee_ids.some((id: unknown) => typeof id !== 'string')))) throw Error()
  return parsed as { status_id: string | null; assignee_ids: string[] | null }
 } catch { throw new Refusal('Read the tracker fields again before editing them.') }
}
async function conflict(env: Bindings, actor: Actor, ticketId: string, remote: Pick<Remote, 'status_id' | 'assignee_ids'>, expected: unknown, fields: FieldChanges, reason: string, now: Date): Promise<never> {
 const at=now.toISOString()
   const current = fieldSnapshot(remote), intended = JSON.stringify(fields)
   await env.DB.batch([
    env.DB.prepare("UPDATE tickets SET sync_state='field conflict',sync_error=?,last_attempt_at=? WHERE id=?").bind('Tracker fields changed after the displayed snapshot. Read again and explicitly choose the new change.', at, ticketId),
    env.DB.prepare("INSERT INTO ticket_events(id,ticket_id,kind,remote_value,local_value,detail,trigger,at) VALUES(?,?,'field conflict',?,?,?,'owner',?)").bind(crypto.randomUUID(), ticketId, current, intended, `Expected ${JSON.stringify(expected)}; ${reason}`, at),
    auditStatement(env, actor, 'ticket.fields', 'ticket:' + ticketId, now, 'refused', 'Read-before-write conflict; no fields written.', { reason, revision: JSON.stringify(expected) }),
   ])
 throw new Refusal('Tracker fields changed. Both values and the conflict time are in Sync history; read again before choosing a new change.', 409, { tracker: current, evidence: intended, at })
}
export async function writeFields(env: Bindings, actor: Actor, ticketId: string, input: Input, now: Date) {
 const expected = expectedSnapshot(input), reason = text(input, 'reason', 1000), at = now.toISOString()
 const ticket = await requireTicket(env, ticketId), destination = await requireDestination(env, ticket.destination_id), mapping = mappingOf(destination)
 if (destination.status !== 'active') throw new Refusal('Reconnect this destination before editing its tracker fields.', 409)
 const fields: FieldChanges = {}
 const assignee = text(input, 'assignee', 254, true), status = text(input, 'status', 100, true)
 if (assignee) {
  const mapped = mapping.assignees[assignee.toLowerCase()]
  if (!mapped) throw new Refusal('Choose an explicitly mapped tracker assignee.')
  fields.assignee = mapped
 }
 if (status) {
  const mapped = mapping.statuses?.[status]
  if (!Object.hasOwn(mapping.statuses ?? {}, status) || typeof mapped !== 'string' || !mapped) throw new Refusal('Choose an explicitly mapped tracker status.')
  fields.status = mapped
 }
 if (!Object.keys(fields).length) throw new Refusal('Choose a mapped assignee or status to change.')
 if (fields.assignee !== undefined && expected.assignee_ids === null || fields.status !== undefined && expected.status_id === null) throw new Refusal('The tracker omitted field identities; no write is allowed. Read it again.', 409)
 const claimed = await env.DB.prepare("UPDATE tickets SET sync_state='writing fields',last_attempt_at=? WHERE id=? AND sync_state!='writing fields'").bind(at,ticketId).run()
 if (!claimed.meta.changes) throw new Refusal('A tracker field write is already in progress. Read the tracker before trying again.', 409)
 const adapter = adapters[destination.provider], ref = targetRef(ticket)
 let submitted = false
 try {
  const secret = await secretOf(env, destination), remote = await adapter.read(reference(destination), secret, ref)
  const assigneeChanged = fields.assignee !== undefined && (remote.assignee_ids === null || JSON.stringify([...remote.assignee_ids].sort()) !== JSON.stringify([...(expected.assignee_ids ?? [])].sort()))
  const statusChanged = fields.status !== undefined && (remote.status_id === null || remote.status_id !== expected.status_id)
  if (assigneeChanged || statusChanged) return conflict(env,actor,ticketId,remote,expected,fields,reason,now)
  submitted = true
  await adapter.setFields(reference(destination), secret, ref, fields, remote)
  const observed = await adapter.read(reference(destination), secret, ref)
  if (fields.status !== undefined && observed.status_id !== fields.status || fields.assignee !== undefined && (observed.assignee_ids === null || JSON.stringify([...observed.assignee_ids].sort()) !== JSON.stringify(fields.assignee === null ? [] : [fields.assignee]))) throw new TrackerFailure('unavailable', 0, 'The tracker did not confirm the requested field identities. Inspect it before trying again.')
  await env.DB.batch([
   env.DB.prepare("UPDATE tickets SET sync_state='linked',sync_error='' WHERE id=?").bind(ticketId),
   env.DB.prepare("INSERT INTO ticket_events(id,ticket_id,kind,remote_value,local_value,detail,trigger,at) VALUES(?,?,'fields written',?,?,?,'owner',?)").bind(crypto.randomUUID(), ticketId, fieldSnapshot(observed), JSON.stringify(fields), `${actor.name}: ${reason}`, at),
   auditStatement(env, actor, 'ticket.fields', 'ticket:' + ticketId, now, 'succeeded', JSON.stringify(fields), { reason, revision: fieldSnapshot(observed) }),
  ])
  await syncTicket(env, await requireTicket(env, ticketId), 'owner field write', now)
  return { written: true, remote: observed }
 } catch (error) {
  if (error instanceof TrackerFieldConflict) return conflict(env,actor,ticketId,error.current,expected,fields,reason,now)
  if (error instanceof Refusal) {
   if (error.status !== 409 || !error.details) await env.DB.prepare('UPDATE tickets SET sync_state=? WHERE id=? AND sync_state=\'writing fields\'').bind(ticket.sync_state,ticketId).run()
   throw error
  }
  const message = error instanceof TrackerFailure ? error.message : 'Tracker field write failed; inspect the tracker before trying again.'
  const uncertain = submitted
  await env.DB.batch([
   env.DB.prepare('UPDATE tickets SET sync_state=?,sync_error=?,last_attempt_at=? WHERE id=?').bind(uncertain ? 'field write uncertain' : 'field write failed', message, at, ticketId),
   auditStatement(env, actor, 'ticket.fields', 'ticket:' + ticketId, now, uncertain ? 'uncertain' : 'failed', message, { reason }),
  ])
  throw new Refusal(message, 502)
 }
}
