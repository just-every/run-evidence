import type { Bindings } from '../../auth.server'
import { Refusal } from '../upload'
import { auditStatement, oneOf, type Actor, type Input } from '../door'
import { obligations } from '../remedy/storage'
import { requireTest } from '../tests/storage'
import { TrackerFailure } from './client'
import { adapters, reference, requireDestination, secretOf } from './storage'
import { createTicket, localDue } from './sync'
// WORK-002: per test, failures become one ticket per item or one ticket for the
// whole test, created automatically or proposed for one click. A whole-test
// ticket lists every item with its deadline and takes the earliest deadline;
// closing it re-tests every item, and items still failing reopen it with a
// comment naming them (or open a follow-up ticket, if the owner chose that).
export interface Settings { destination_id: string; granularity: 'item' | 'test'; auto_create: number; follow_up: 'reopen' | 'new' }
const system = { id: 'system', name: 'Evidence ticket automation', kind: 'system' as const }
type Row = Awaited<ReturnType<typeof obligations>>[number]
export async function settingsFor(env: Bindings, testId: string): Promise<(Settings & { inherited: boolean }) | null> {
 const own = await env.DB.prepare('SELECT destination_id,granularity,auto_create,follow_up FROM ticket_settings WHERE test_id=?').bind(testId).first<Settings>()
 if (own) return { ...own, inherited: false }
 const fallback = await env.DB.prepare('SELECT destination_id,granularity,auto_create,follow_up FROM ticket_defaults WHERE singleton=1 AND destination_id IS NOT NULL').first<Settings>()
 return fallback ? { ...fallback, inherited: true } : null
}
function parse(input: Input) {
 const granularity = oneOf(input, 'granularity', ['item', 'test'] as const), follow_up = oneOf(input, 'follow_up', ['reopen', 'new'] as const)
 return { granularity, follow_up, auto_create: input.auto_create === 'on' || input.auto_create === 'true' || input.auto_create === '1' ? 1 : 0 }
}
// A change applies to items that fail afterwards; tickets already linked stay as they are.
export async function saveSettings(env: Bindings, actor: Actor, testId: string | null, input: Input, now: Date) {
 const destination = await requireDestination(env, String(input.destination_id ?? '')), s = parse(input), at = now.toISOString()
 if (testId) { await requireTest(env, testId); await env.DB.batch([env.DB.prepare('INSERT INTO ticket_settings(test_id,destination_id,granularity,auto_create,follow_up,updated_by,updated_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(test_id) DO UPDATE SET destination_id=excluded.destination_id,granularity=excluded.granularity,auto_create=excluded.auto_create,follow_up=excluded.follow_up,updated_by=excluded.updated_by,updated_at=excluded.updated_at').bind(testId, destination.id, s.granularity, s.auto_create, s.follow_up, actor.name, at), auditStatement(env, actor, 'tickets.settings', 'test:' + testId, now, 'succeeded', `${s.granularity}${s.auto_create ? ', automatic' : ''} in ${destination.label}`)]) }
 else await env.DB.batch([env.DB.prepare('INSERT INTO ticket_defaults(singleton,destination_id,granularity,auto_create,follow_up,updated_by,updated_at) VALUES(1,?,?,?,?,?,?) ON CONFLICT(singleton) DO UPDATE SET destination_id=excluded.destination_id,granularity=excluded.granularity,auto_create=excluded.auto_create,follow_up=excluded.follow_up,updated_by=excluded.updated_by,updated_at=excluded.updated_at').bind(destination.id, s.granularity, s.auto_create, s.follow_up, actor.name, at), auditStatement(env, actor, 'tickets.defaults', 'tickets', now, 'succeeded', s.granularity)])
}
// Open items of a test with no ticket in the destination yet.
async function unticketed(env: Bindings, testId: string, destination: string, now: Date) {
 const linked = new Set((await env.DB.prepare('SELECT obligation_id FROM tickets WHERE destination_id=? AND remote_id IS NOT NULL').bind(destination).all<{ obligation_id: string }>()).results.map(r => r.obligation_id))
 return (await obligations(env, now)).filter(o => o.test_id === testId && o.state !== 'verified' && !linked.has(o.id))
}
const listOf = (env: Bindings, items: Row[]) => items.map(o => `- ${o.resource_name}: remediate by ${localDue(o)} (${o.sla.status}) ${env.AUTH_ORIGIN}/app/remediation/${o.id}`).join('\n')
async function linkRows(env: Bindings, group: { id: string; destination_id: string; remote_id: string; remote_key: string; remote_url: string }, items: Row[], actor: string, at: string) {
 await env.DB.batch(items.flatMap(o => [
  env.DB.prepare("INSERT INTO tickets(id,obligation_id,destination_id,remote_id,remote_key,remote_url,created_at,created_name,sync_state,last_synced_at,last_attempt_at,group_id) VALUES(?,?,?,?,?,?,?,?,'linked',?,?,?) ON CONFLICT(obligation_id,destination_id) DO NOTHING").bind(crypto.randomUUID(), o.id, group.destination_id, group.remote_id, group.remote_key, group.remote_url, at, actor, at, at, group.id),
  env.DB.prepare("INSERT INTO obligation_events(id,obligation_id,kind,actor_id,actor_name,body,observation_id,at) VALUES(?,?,'ticket created',?,?,?,NULL,?)").bind(crypto.randomUUID(), o.id, 'system', actor, `Whole-test ticket ${group.remote_key}: ${group.remote_url}`, at),
 ]))
}
async function createGroup(env: Bindings, actor: Actor, testId: string, destinationId: string, items: Row[], now: Date, moveFrom: string | null = null) {
 const destination = await requireDestination(env, destinationId), adapter = adapters[destination.provider], test = await requireTest(env, testId), at = now.toISOString(), mapping = reference(destination).mapping
 const due = items.map(o => localDue(o)).sort()[0], severity = items.map(o => o.severity).sort((a, b) => ['critical', 'high', 'medium', 'low'].indexOf(a) - ['critical', 'high', 'medium', 'low'].indexOf(b))[0] as keyof typeof mapping.priorities
 const draft = { title: `Evidence: ${test.name} — ${items.length} failing item${items.length === 1 ? '' : 's'}`.slice(0, 250), description: `Evidence remediation for a whole test. Closing this ticket re-tests every item; items still failing reopen it.\n\nTest: ${env.AUTH_ORIGIN}/app/tests/${test.id}\n\nItems and deadlines:\n${listOf(env, items)}`, priority: mapping.priorities[severity], due, labels: mapping.labels, assignee: null }
 const created = await adapter.create(reference(destination), await secretOf(env, destination), draft)
 const id = crypto.randomUUID()
 await env.DB.batch([env.DB.prepare("INSERT INTO ticket_groups(id,test_id,destination_id,remote_id,remote_key,remote_url,created_at,created_name,state,item_list,due_written) VALUES(?,?,?,?,?,?,?,?,'open',?,?)").bind(id, testId, destinationId, created.id, created.key, created.url, at, actor.name, items.map(o => o.id).join(','), adapter.supportsDue ? due : null), auditStatement(env, actor, 'ticket.group-created', 'test:' + testId, now, 'succeeded', `${destination.provider} ${created.key}`)])
 // A follow-up ticket takes over the still-failing items' rows, keeping their history.
 if (moveFrom) await env.DB.prepare("UPDATE tickets SET remote_id=?,remote_key=?,remote_url=?,group_id=?,remote_closed=0,remote_status='',remote_assignee=NULL WHERE group_id=? AND obligation_id IN (SELECT value FROM json_each(?))").bind(created.id, created.key, created.url, id, moveFrom, JSON.stringify(items.map(o => o.id))).run()
 else await linkRows(env, { id, destination_id: destinationId, remote_id: created.id, remote_key: created.key, remote_url: created.url }, items, actor.name, at)
 return { id, key: created.key, url: created.url, items: items.length }
}
// One click (or automation): create the tickets this test's settings call for.
export async function createForTest(env: Bindings, actor: Actor, testId: string, now: Date) {
 const s = await settingsFor(env, testId)
 if (!s) throw new Refusal('Choose a ticket destination for this test first.', 409)
 const items = await unticketed(env, testId, s.destination_id, now)
 if (!items.length) return { created: 0 }
 if (s.granularity === 'item') { for (const o of items) await createTicket(env, actor, o.id, s.destination_id, now); return { created: items.length } }
 const open = await env.DB.prepare("SELECT * FROM ticket_groups WHERE test_id=? AND destination_id=? AND state='open' ORDER BY created_at DESC LIMIT 1").bind(testId, s.destination_id).first<{ id: string }>()
 if (open) return { created: 0, added: (await addToGroup(env, open.id, items, now)) }
 return { created: 1, ...(await createGroup(env, actor, testId, s.destination_id, items, now)) }
}
// Newly failing items join the open whole-test ticket as a comment with the updated list.
async function addToGroup(env: Bindings, groupId: string, items: Row[], now: Date) {
 const g = await env.DB.prepare('SELECT * FROM ticket_groups WHERE id=?').bind(groupId).first<{ id: string; destination_id: string; remote_id: string; remote_key: string; remote_url: string; item_list: string }>()
 if (!g || !items.length) return 0
 const destination = await requireDestination(env, g.destination_id), at = now.toISOString()
 await adapters[destination.provider].comment(reference(destination), await secretOf(env, destination), { remote_id: g.remote_id, remote_key: g.remote_key }, `New failing items:\n${listOf(env, items)}`)
 await linkRows(env, g, items, system.name, at)
 await env.DB.prepare('UPDATE ticket_groups SET item_list=? WHERE id=?').bind([...g.item_list.split(',').filter(Boolean), ...items.map(o => o.id)].join(','), g.id).run()
 return items.length
}
// Scheduler step after re-tests: automatic creation, whole-test due dates, and follow-through after closing.
export async function ticketAutomation(env: Bindings, now: Date) {
 let count = 0
 const tests = (await env.DB.prepare('SELECT DISTINCT o.test_id FROM obligations o WHERE o.state!=\'verified\'').all<{ test_id: string }>()).results
 for (const { test_id } of tests) {
  const s = await settingsFor(env, test_id)
  if (!s?.auto_create) continue
  try { const r = await createForTest(env, system, test_id, now); count += (r.created ?? 0) + ((r as { added?: number }).added ?? 0) }
  catch (error) { if (!(error instanceof Refusal || error instanceof TrackerFailure)) throw error }
 }
 const rows = await obligations(env, now)
 for (const g of (await env.DB.prepare("SELECT * FROM ticket_groups WHERE state='open'").all<{ id: string; test_id: string; destination_id: string; remote_id: string; remote_key: string; handled_close_at: string | null; due_written: string | null }>()).results) {
  const destination = await requireDestination(env, g.destination_id), adapter = adapters[destination.provider], ref = { remote_id: g.remote_id, remote_key: g.remote_key }
  if (destination.status !== 'active') continue
  const members = (await env.DB.prepare('SELECT obligation_id,remote_closed,last_synced_at FROM tickets WHERE group_id=?').bind(g.id).all<{ obligation_id: string; remote_closed: number; last_synced_at: string | null }>()).results
  const items = members.map(m => rows.find(o => o.id === m.obligation_id)).filter((o): o is Row => !!o), open = items.filter(o => o.state !== 'verified')
  try {
   // The whole-test ticket's due date is the earliest open item's deadline.
   const due = open.map(o => localDue(o)).sort()[0] ?? null
   if (adapter.supportsDue && due && due !== g.due_written) { await adapter.setDue(reference(destination), await secretOf(env, destination), ref, due); await env.DB.prepare('UPDATE ticket_groups SET due_written=? WHERE id=?').bind(due, g.id).run() }
   const closed = members.length > 0 && members.every(m => m.remote_closed), pending = await env.DB.prepare(`SELECT 1 FROM retests WHERE done_at IS NULL AND obligation_id IN (SELECT obligation_id FROM tickets WHERE group_id=?)`).bind(g.id).first()
   if (!closed || pending) continue
   const closedAt = members.map(m => m.last_synced_at ?? '').sort().at(-1) ?? ''
   if (g.handled_close_at && g.handled_close_at >= closedAt) continue
   if (!open.length) { await env.DB.prepare("UPDATE ticket_groups SET state='resolved',handled_close_at=? WHERE id=?").bind(now.toISOString(), g.id).run(); continue }
   const s = await settingsFor(env, g.test_id)
   if (s?.follow_up === 'new') {
    await env.DB.prepare("UPDATE ticket_groups SET state='followed up',handled_close_at=? WHERE id=?").bind(now.toISOString(), g.id).run()
    await createGroup(env, system, g.test_id, g.destination_id, open, now, g.id)
   } else {
    await adapter.reopen(reference(destination), await secretOf(env, destination), ref)
    await adapter.comment(reference(destination), await secretOf(env, destination), ref, `Re-test still fails for:\n${listOf(env, open)}\n\nThis ticket was reopened by Evidence; items that passed are closed.`)
    await env.DB.prepare('UPDATE ticket_groups SET handled_close_at=? WHERE id=?').bind(now.toISOString(), g.id).run()
   }
   count++
  } catch (error) { if (!(error instanceof TrackerFailure)) throw error; await env.DB.prepare("UPDATE tracker_destinations SET last_error=? WHERE id=?").bind(error.message, destination.id).run() }
 }
 return count
}
// The test page's ticket panel: settings, items waiting for a ticket, and whole-test tickets.
export async function ticketPanel(env: Bindings, testId: string, now: Date) {
 const s = await settingsFor(env, testId), destinations = (await env.DB.prepare("SELECT id,label FROM tracker_destinations WHERE status='active' ORDER BY created_at").all<{ id: string; label: string }>()).results
 const waiting = s ? (await unticketed(env, testId, s.destination_id, now)).length : 0
 const groups = (await env.DB.prepare('SELECT g.*,d.label FROM ticket_groups g JOIN tracker_destinations d ON d.id=g.destination_id WHERE g.test_id=? ORDER BY g.created_at DESC').bind(testId).all<{ id: string; remote_key: string; remote_url: string; state: string; item_list: string; label: string; due_written: string | null }>()).results
 return { settings: s, destinations, waiting, groups }
}
