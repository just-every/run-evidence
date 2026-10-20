import { Refusal } from '../upload'
import { validDate } from '../model'
import { auditStatement, done, json, oneOf, ownerRoutes, readInput, text, uuid, type Route } from '../door'
import { people, requirePerson } from '../program/people'
import { catalogueEntry } from '../tests/catalogue'
import { categories, severities } from '../tests/storage'
import { acceptRisk, assign, markDone, note, obligationEvents, obligations, queueRetest, requireObligation } from './storage'
import { obligationPage, queuePage } from './view'
import { destinations, ticketEvents, ticketsOf } from '../work/storage'
import { mirrorComment } from '../work/sync'
import { ticketPanel } from '../work/view'
import { followupPanel } from '../followup/view'
const id = `(${uuid})`
const both = (path: string) => new RegExp(`^/(?:app|api)${path}$`)
export function remedyHandler(clock: () => Date) {
 const routes: Route[] = [
  { method: 'GET', pattern: both('/remediation'), run: async c => {
   const q = Object.fromEntries(['state', 'sla', 'owner', 'category', 'from', 'to', 'tracker_assignee', 'tracker_status'].map(k => [k, c.url.searchParams.get(k) ?? '']))
   // WORK-002: each item's linked tickets, filterable by tracker assignee and status.
   const linked = (await c.env.DB.prepare('SELECT k.obligation_id,k.remote_key,k.remote_url,k.remote_status,k.remote_assignee,k.sync_state,k.last_synced_at,k.group_id,d.label FROM tickets k JOIN tracker_destinations d ON d.id=k.destination_id WHERE k.remote_id IS NOT NULL').all<{ obligation_id: string; remote_key: string; remote_url: string; remote_status: string; remote_assignee: string | null; sync_state: string; last_synced_at: string | null; group_id: string | null; label: string }>()).results
   const all = (await obligations(c.env, c.now)).map(o => ({ ...o, tickets: linked.filter(k => k.obligation_id === o.id).map(k => ({ ...k, stale: !k.last_synced_at || c.now.getTime() - Date.parse(k.last_synced_at) > 15 * 60000 })) }))
   const like = (value: string | null | undefined, wanted: string) => !wanted || (value ?? '').toLowerCase().includes(wanted.toLowerCase())
   const matches = (o: typeof all[number]) => (!q.owner || o.owner_person_id === q.owner) && (!q.category || o.category === q.category) && (!q.tracker_assignee || o.tickets.some(k => like(k.remote_assignee, q.tracker_assignee))) && (!q.tracker_status || o.tickets.some(k => like(k.remote_status, q.tracker_status)))
   const open = all.filter(o => o.state !== 'verified' && matches(o) && (!q.state || o.state === q.state) && (!q.sla || o.sla.status === q.sla))
   const resolved = all.filter(o => o.state === 'verified' && matches(o) && (!q.from || (o.closed_at ?? '') >= q.from) && (!q.to || (o.closed_at ?? '') <= q.to + 'T23:59:59.999Z'))
   const policies = (await c.env.DB.prepare('SELECT category,severity,days,effective_at,actor_name FROM sla_policies ORDER BY effective_at DESC').all<{ category: string; severity: string; days: number; effective_at: string; actor_name: string }>()).results
   return c.isApi ? json({ open, resolved, policies }) : queuePage(open, resolved, await people(c.env), q, policies, c.actor.name)
  } },
  { method: 'POST', pattern: both('/remediation/sla'), run: async c => {
   const input = await readInput(c.request), category = oneOf(input, 'category', categories), severity = oneOf(input, 'severity', severities), days = Number(input.days)
   if (!Number.isInteger(days) || days < 1 || days > 365) throw new Refusal('Days must be a whole number from 1 to 365.')
   await c.env.DB.batch([c.env.DB.prepare('INSERT INTO sla_policies(id,category,severity,days,effective_at,actor_id,actor_name) VALUES(?,?,?,?,?,?,?)').bind(crypto.randomUUID(), category, severity, days, c.now.toISOString(), c.actor.id, c.actor.name), auditStatement(c.env, c.actor, 'sla.policy-set', `sla:${category}:${severity}`, c.now, 'succeeded', `${days} days`)])
   return done(c, '/app/remediation#sla-title', { category, severity, days }, 201)
  } },
  { method: 'GET', pattern: both(`/remediation/${id}`), run: async (c, m) => {
   const row = (await obligations(c.env, c.now)).find(o => o.id === m[1]); if (!row) throw new Refusal('Obligation not found.', 404)
   const events = await obligationEvents(c.env, row.id)
   const observations = (await c.env.DB.prepare('SELECT o.result,o.reason,o.expected_json,o.actual_json,o.observed_at,o.revision,l.library_revision,o.source_kind,r.trigger AS run_trigger FROM observations o JOIN test_runs r ON r.id=o.run_id JOIN run_library_revisions l ON l.run_id=r.id WHERE o.test_id=? AND o.resource_id=? ORDER BY o.observed_at DESC,o.rowid DESC LIMIT 200').bind(row.test_id, row.resource_id).all<{ result: string; reason: string; expected_json: string; actual_json: string; observed_at: string; revision: number; library_revision: number; source_kind: string; run_trigger: string }>()).results
   const controls = (await c.env.DB.prepare('SELECT c.id,c.name,l.library_id FROM test_controls t JOIN controls c ON c.id=t.control_id LEFT JOIN library_adoptions l ON l.control_id=c.id WHERE t.test_id=? ORDER BY c.name').bind(row.test_id).all<{ id: string; name: string; library_id: string | null }>()).results
   const tickets = await ticketsOf(c.env, row.id), stale = (t: { last_synced_at: string | null; remote_id: string | null }) => !!t.remote_id && (!t.last_synced_at || c.now.getTime() - Date.parse(t.last_synced_at) > 15 * 60000)
   if (c.isApi) return json({ obligation: row, controls, events, observations, tickets: tickets.map(t => ({ ...t, stale: stale(t) })), followups: (await c.env.DB.prepare('SELECT kind,cycle_key,recipient,channel,state,detail,created_at FROM followups WHERE subject_id=? ORDER BY created_at,rowid').bind(row.id).all()).results, paused: !!await c.env.DB.prepare('SELECT 1 FROM followup_pauses WHERE subject_id=? AND resumed_at IS NULL').bind(row.id).first() })
   const ticketHistory = new Map(await Promise.all(tickets.map(async t => [t.id, await ticketEvents(c.env, t.id)] as const)))
   const paused = await c.env.DB.prepare('SELECT reason,paused_by,paused_at FROM followup_pauses WHERE subject_id=? AND resumed_at IS NULL').bind(row.id).first<{ reason: string; paused_by: string; paused_at: string }>()
   const deliveries = (await c.env.DB.prepare('SELECT kind,recipient,channel,state,detail,created_at FROM followups WHERE subject_id=? ORDER BY created_at DESC,rowid DESC LIMIT 50').bind(row.id).all<{ kind: string; recipient: string; channel: string; state: string; detail: string; created_at: string }>()).results
   return obligationPage(row, controls, events, observations, row.catalogue_id ? catalogueEntry(row.catalogue_id) : undefined, await people(c.env), ticketPanel(row.id, tickets, ticketHistory, await destinations(c.env), stale) + followupPanel(row.id, paused, deliveries), c.actor.name)
  } },
  { method: 'POST', pattern: both(`/remediation/${id}/assign`), run: async (c, m) => { const input = await readInput(c.request); const owner = await requirePerson(c.env, input.owner_person_id, 'owner'); const target = typeof input.target_date === 'string' && input.target_date ? input.target_date : null
   if (target && !validDate(target)) throw new Refusal('The target date must be a real date.')
   await assign(c.env, c.actor, m[1], owner.id, text(input, 'next_action', 500, true), target, c.now); return done(c, '/app/remediation/' + m[1], { assigned: true }) } },
  { method: 'POST', pattern: both(`/remediation/${id}/comments`), run: async (c, m) => { const body = text(await readInput(c.request), 'body', 2000); await note(c.env, c.actor, m[1], 'comment', body, c.now); await mirrorComment(c.env, m[1], c.actor, body, c.now); return done(c, '/app/remediation/' + m[1], { commented: true }, 201) } },
  { method: 'POST', pattern: both(`/remediation/${id}/changes`), run: async (c, m) => { await note(c.env, c.actor, m[1], 'change attached', text(await readInput(c.request), 'body', 1000), c.now); return done(c, '/app/remediation/' + m[1], { attached: true }, 201) } },
  { method: 'POST', pattern: both(`/remediation/${id}/done`), run: async (c, m) => { await markDone(c.env, c.actor, m[1], text(await readInput(c.request), 'body', 1000, true), c.now); return done(c, '/app/remediation/' + m[1], { state: 'awaiting verification' }) } },
  { method: 'POST', pattern: both(`/remediation/${id}/retest`), run: async (c, m) => { await requireObligation(c.env, m[1]); await queueRetest(c.env, c.actor, m[1], 'Requested by ' + c.actor.name, c.now); return done(c, '/app/remediation/' + m[1], { queued: true }, 202) } },
  { method: 'POST', pattern: both(`/remediation/${id}/accept`), run: async (c, m) => { const input = await readInput(c.request); const until = text(input, 'until', 40); await acceptRisk(c.env, c.actor, m[1], text(input, 'rationale', 1000), until.endsWith('Z') ? until : until + 'Z', c.now); return done(c, '/app/remediation/' + m[1], { state: 'risk accepted' }) } },
 ]
 return ownerRoutes(routes, clock)
}
