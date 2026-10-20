import { auditStatement, json, ownerRoutes, type Route } from '../door'
import { auditCsv, auditFilter, auditTrail } from './storage'
import { auditPage } from './view'

const file = (body: string, type: string, name: string) => new Response(body, { headers: { 'content-type': type + '; charset=utf-8', 'content-disposition': `attachment; filename="${name}"`, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } })
export function auditHandler(clock: () => Date) {
 const routes: Route[] = [
  { method: 'GET', pattern: /^\/(?:app|api)\/audit$/, run: async c => {
   const filter = auditFilter(c.url.searchParams), rows = await auditTrail(c.env, filter)
   return c.isApi ? json({ filter, entries: rows }) : auditPage(rows, filter, c.actor.name)
  } },
  // The export is itself recorded before its rows are read, so it lists itself.
  { method: 'GET', pattern: /^\/(?:app\/audit\/export\.csv|api\/audit\/export)$/, run: async c => {
   const filter = auditFilter(c.url.searchParams), csv = c.url.pathname.endsWith('.csv')
   await auditStatement(c.env, c.actor, 'audit.exported', 'audit', c.now, 'succeeded', csv ? 'csv' : 'json').run()
   const rows = await auditTrail(c.env, filter), stamp = c.now.toISOString().slice(0, 10)
   return csv ? file(auditCsv(rows), 'text/csv', `audit-${stamp}.csv`) : file(JSON.stringify({ format: 'evidence-audit', version: 1, exported_at: c.now.toISOString(), filter, entries: rows }, null, 1), 'application/json', `audit-${stamp}.json`)
  } },
 ]
 return ownerRoutes(routes, clock)
}
