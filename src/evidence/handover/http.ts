import { done, json, ownerRoutes, readInput, uuid, type Route } from '../door'
import { people } from '../program/people'
import { bulkHandover, flagged, handoverHistory, reassign, saveWindow, windowDays } from './storage'
import { handoverPage } from './view'
const id = `(${uuid})`
const both = (path: string) => new RegExp(`^/(?:app|api)${path}$`)
// LIFECYCLE-002 owner doors: what departed people still hold, one-by-one and
// bulk reassignment with a reason, and the owner-set handover window.
export function handoverHandler(clock: () => Date) {
 const routes: Route[] = [
  { method: 'GET', pattern: both('/handover'), run: async c => {
   const person = c.url.searchParams.get('person') || undefined, items = await flagged(c.env, c.now, person), history = await handoverHistory(c.env, person), window_days = await windowDays(c.env)
   if (c.isApi) return json({ window_days, items, history })
   const current = (await c.env.DB.prepare('SELECT p.id,p.name,p.email,p.kind,p.created_at FROM people p WHERE NOT EXISTS(SELECT 1 FROM people_departures d WHERE d.person_id=p.id) ORDER BY p.name,p.id').all<Awaited<ReturnType<typeof people>>[number]>()).results
   return handoverPage(items, history, current, window_days, person ?? '', c.actor.name)
  } },
  { method: 'POST', pattern: both('/handover/reassign'), run: async c => { const input = await readInput(c.request); return done(c, '/app/handover?person=' + encodeURIComponent(String(input.person_id ?? '')), await reassign(c.env, c.actor, input, c.now)) } },
  { method: 'POST', pattern: both(`/people/${id}/handover`), run: async (c, m) => done(c, '/app/handover?person=' + m[1], await bulkHandover(c.env, c.actor, m[1], await readInput(c.request), c.now)) },
  { method: 'POST', pattern: both('/handover/settings'), run: async c => { await saveWindow(c.env, c.actor, await readInput(c.request), c.now); return done(c, '/app/handover', { saved: true }) } },
 ]
 return ownerRoutes(routes, clock)
}
