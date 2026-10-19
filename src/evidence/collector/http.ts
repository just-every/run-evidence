import { json, ownerRoutes, readInput, uuid, type Route } from '../door'
import { requireConnection, runs } from '../connect/storage'
import { collectorSetup, privateCollectorPage } from './view'
import { registerCollector, rotateCollector } from './storage'
const id = `(${uuid})`, both = (path: string) => new RegExp(`^/(?:app|api)${path}$`)
export function collectorOwnerHandler(clock: () => Date) {
 const routes: Route[] = [
  { method: 'GET', pattern: both('/collectors'), run: async c => collectorSetup(c.actor.name) },
  { method: 'POST', pattern: both('/collectors'), run: async c => {
   const issued = await registerCollector(c.env, c.actor, await readInput(c.request), c.now)
   return c.isApi ? json(issued, 201) : privateCollectorPage(await requireConnection(c.env, issued.id), [], c.actor.name, issued.token)
  } },
  { method: 'POST', pattern: both(`/collectors/${id}/rotate`), run: async (c, m) => {
   const issued = await rotateCollector(c.env, c.actor, m[1], c.now)
   return c.isApi ? json(issued) : privateCollectorPage(await requireConnection(c.env, issued.id), await runs(c.env, issued.id), c.actor.name, issued.token)
  } },
 ]
 return ownerRoutes(routes, clock)
}
