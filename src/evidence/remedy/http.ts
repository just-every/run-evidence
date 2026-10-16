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
const id = `(${uuid})`
const both = (path: string) => new RegExp(`^/(?:app|api)${path}$`)
export function remedyHandler(clock: () => Date) {
 const routes: Route[] = [
  { method: 'GET', pattern: both('/remediation'), run: async c => {
   const q = Object.fromEntries(['state', 'sla', 'owner', 'category', 'from', 'to'].map(k => [k, c.url.searchParams.get(k) ?? '']))
   const all = await obligations(c.env, c.now)
   const matches = (o: typeof all[number]) => (!q.owner || o.owner_person_id === q.owner) && (!q.category || o.category === q.category)
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
   const observations = (await c.env.DB.prepare('SELECT o.result,o.reason,o.observed_at,o.revision,o.source_kind,r.trigger AS run_trigger FROM observations o JOIN test_runs r ON r.id=o.run_id WHERE o.test_id=? AND o.resource_id=? ORDER BY o.observed_at DESC,o.rowid DESC LIMIT 200').bind(row.test_id, row.resource_id).all<{ result: string; reason: string; observed_at: string; revision: number; source_kind: string; run_trigger: string }>()).results
   const controls = (await c.env.DB.prepare('SELECT c.id,c.name,l.library_id FROM test_controls t JOIN controls c ON c.id=t.control_id LEFT JOIN library_adoptions l ON l.control_id=c.id WHERE t.test_id=? ORDER BY c.name').bind(row.test_id).all<{ id: string; name: string; library_id: string | null }>()).results
   const tickets = await ticketsOf(c.env, row.id), stale = (t: { last_synced_at: string | null; remote_id: string | null }) => !!t.remote_id && (!t.last_synced_at || c.now.getTime() - Date.parse(t.last_synced_at) > 15 * 60000)
   if (c.isApi) return json({ obligation: row, controls, events, observations, tickets: tickets.map(t => ({ ...t, stale: stale(t) })) })
   const ticketHistory = new Map(await Promise.all(tickets.map(async t => [t.id, await ticketEvents(c.env, t.id)] as const)))
   return obligationPage(row, controls, events, observations, row.catalogue_id ? catalogueEntry(row.catalogue_id) : undefined, await people(c.env), ticketPanel(row.id, tickets, ticketHistory, await destinations(c.env), stale), c.actor.name)
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
