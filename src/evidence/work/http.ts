import { done, json, oneOf, ownerRoutes, readInput, text, uuid, type Route } from '../door'
import { connectDestination, destinations, requireDestination, requireTicket, revokeDestination, rotateDestination, safeDestination, updateMapping, type TicketRow } from './storage'
import { createTicket, resolveConflict, syncTicket } from './sync'
import { trackerPage, trackersPage } from './view'
import { createForTest, saveSettings } from './granularity'
const id = `(${uuid})`
const both = (path: string) => new RegExp(`^/(?:app|api)${path}$`)
export function workHandler(clock: () => Date) {
 const routes: Route[] = [
  { method: 'GET', pattern: both('/trackers'), run: async c => { const rows = await destinations(c.env), defaults = await c.env.DB.prepare('SELECT destination_id,granularity,auto_create,follow_up FROM ticket_defaults WHERE singleton=1').first<{ destination_id: string | null; granularity: string; auto_create: number; follow_up: string }>(); return c.isApi ? json({ destinations: rows.map(safeDestination), defaults }) : trackersPage(rows, null, c.actor.name, defaults) } },
  { method: 'POST', pattern: both('/trackers'), run: async c => {
   const created = await connectDestination(c.env, c.actor, await readInput(c.request), c.now)
   return c.isApi ? json(created, 201) : trackersPage(await destinations(c.env), created.webhook, c.actor.name)
  } },
  { method: 'GET', pattern: both(`/trackers/${id}`), run: async (c, m) => {
   const row = await requireDestination(c.env, m[1])
   const tickets = (await c.env.DB.prepare('SELECT k.*,r.display_name AS resource_name,t.name AS test_name FROM tickets k JOIN obligations o ON o.id=k.obligation_id JOIN resources r ON r.id=o.resource_id JOIN tests t ON t.id=o.test_id WHERE k.destination_id=? ORDER BY k.created_at DESC LIMIT 200').bind(row.id).all<TicketRow & { resource_name: string; test_name: string }>()).results
   return c.isApi ? json({ destination: safeDestination(row), tickets }) : trackerPage(row, tickets, c.actor.name)
  } },
  { method: 'POST', pattern: both(`/trackers/${id}/mapping`), run: async (c, m) => { await updateMapping(c.env, c.actor, m[1], await readInput(c.request), c.now); return done(c, '/app/trackers/' + m[1], { saved: true }) } },
  { method: 'POST', pattern: both(`/trackers/${id}/rotate`), run: async (c, m) => { await rotateDestination(c.env, c.actor, m[1], await readInput(c.request), c.now); return done(c, '/app/trackers/' + m[1], { rotated: true }) } },
  { method: 'POST', pattern: both(`/trackers/${id}/revoke`), run: async (c, m) => { await revokeDestination(c.env, c.actor, m[1], c.now); return done(c, '/app/trackers/' + m[1], { revoked: true }) } },
  { method: 'POST', pattern: both(`/remediation/${id}/tickets`), run: async (c, m) => { const created = await createTicket(c.env, c.actor, m[1], text(await readInput(c.request), 'destination_id', 36), c.now); return done(c, '/app/remediation/' + m[1] + '#tickets-title', created, 201) } },
  { method: 'POST', pattern: both(`/tests/${id}/ticket-settings`), run: async (c, m) => { await saveSettings(c.env, c.actor, m[1], await readInput(c.request), c.now); return done(c, '/app/tests/' + m[1] + '#test-tickets', { saved: true }) } },
  { method: 'POST', pattern: both('/tickets/defaults'), run: async c => { await saveSettings(c.env, c.actor, null, await readInput(c.request), c.now); return done(c, '/app/trackers', { saved: true }) } },
  { method: 'POST', pattern: both(`/tests/${id}/tickets`), run: async (c, m) => done(c, '/app/tests/' + m[1] + '#test-tickets', await createForTest(c.env, c.actor, m[1], c.now), 201) },
  { method: 'POST', pattern: both(`/tickets/${id}/sync`), run: async (c, m) => { const t = await requireTicket(c.env, m[1]); const state = await syncTicket(c.env, t, 'owner', c.now); return done(c, '/app/remediation/' + t.obligation_id + '#tickets-title', { state }) } },
  { method: 'POST', pattern: both(`/tickets/${id}/resolve`), run: async (c, m) => { const t = await requireTicket(c.env, m[1]); await resolveConflict(c.env, c.actor, m[1], oneOf(await readInput(c.request), 'keep', ['evidence', 'tracker'] as const), c.now); return done(c, '/app/remediation/' + t.obligation_id + '#tickets-title', { resolved: true }) } },
 ]
 return ownerRoutes(routes, clock)
}
