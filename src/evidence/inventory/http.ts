import { done, json, ownerRoutes, readInput, type Route } from '../door'
import { people } from '../program/people'
import { Refusal } from '../upload'
import { inventory, requireRecord, decide, group } from './storage'
import { compatibility } from './compatibility'
import { inventoryPage, detailPage, recordUrl } from './view'
import { scopeExport } from './export'

const both = (path: string) => new RegExp(`^/(?:app|api)/inventory${path}$`)
export function inventoryHandler(clock: () => Date) {
 const routes: Route[] = [
  { method: 'GET', pattern: both(''), run: async c => {
   const snapshot = await inventory(c.env, c.now)
   return c.isApi ? json({ ...snapshot, ...compatibility(snapshot) }) : inventoryPage(snapshot, c.actor.name)
  } },
  { method: 'GET', pattern: both('/record'), run: async c => {
   const snapshot = await inventory(c.env, c.now), record = requireRecord(snapshot, c.url.searchParams.get('source_key') ?? '')
   return c.isApi ? json({ record, canonical: snapshot.canonical.find(g => g.canonical_key === record.canonical_key), members: snapshot.records.filter(r => r.canonical_key === record.canonical_key) }) : detailPage(snapshot, record, await people(c.env), c.actor.name)
  } },
  { method: 'GET', pattern: both('/export'), run: async c => {
   const format = c.url.searchParams.get('format') ?? 'json'
   if (format !== 'json' && format !== 'csv') throw new Refusal('Choose JSON or CSV export.')
   return scopeExport(await inventory(c.env, c.now), format)
  } },
  { method: 'POST', pattern: both('/decisions'), run: async c => {
   const decision = await decide(c.env, c.actor, await readInput(c.request), c.now)
   return done(c, recordUrl(decision.source_key), { decision }, 201)
  } },
  { method: 'POST', pattern: both('/groups'), run: async c => {
   const result = await group(c.env, c.actor, await readInput(c.request), c.now)
   return done(c, '/app/inventory', result, 201)
  } },
 ]
 return ownerRoutes(routes.map(route => ({...route,errorReturn:'/app/inventory'})), clock)
}
