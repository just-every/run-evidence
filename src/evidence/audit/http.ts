import { auditStatement, json, ownerRoutes, type Route } from '../door'
import type { Bindings } from '../../auth.server'
import { kinds } from '../program/documents/kinds'
import { auditCsv, auditFilter, auditTrail, type AuditEntry } from './storage'
import { auditPage } from './view'

// These names are a display projection. Recorded events and exports remain exact.
async function namedEntries(env: Bindings, rows: AuditEntry[]): Promise<AuditEntry[]> {
 const shown = rows.slice(0,500), refs = [...new Set(shown.flatMap(r=>[r.subject.split(':').at(-1)!,...(r.detail.match(/[a-f0-9]{8}-[a-f0-9-]{27,}|\b[a-f0-9]{32}\b/gi)??[])]))]
 const sources: Record<string,string> = {
  control:'SELECT id,name AS label FROM controls', requirement:'SELECT id,name AS label FROM requirements',
  person:'SELECT id,name AS label FROM people', policy:'SELECT id,title AS label FROM policies', vendor:'SELECT id,name AS label FROM vendors',
  program:'SELECT id,name AS label FROM programs', test:'SELECT id,name AS label FROM tests', risk:'SELECT id,title AS label FROM risks',
  receipt:'SELECT r.id,e.filename AS label FROM receipts r JOIN exhibits e ON e.id=r.exhibit_id', exhibit:'SELECT id,filename AS label FROM exhibits',
  folder:'SELECT id,reviewer_label AS label FROM review_folders', proposal:"SELECT id,json_extract(input_json,'$.reviewer_label') AS label FROM agent_proposals",
  connection:'SELECT id,label FROM connections', tracker:'SELECT id,label FROM tracker_destinations',
  'api-token':'SELECT id,name AS label FROM api_tokens', 'agent-token':'SELECT id,label FROM agent_tokens',
  'program-document':'SELECT id,kind AS label FROM program_documents', 'risk-import':'SELECT id,filename AS label FROM risk_imports',
  'vendor-template':'SELECT id,name AS label FROM vendor_templates', 'vendor-request':'SELECT id,label FROM vendor_requests',
  questionnaire:'SELECT id,name AS label FROM questionnaires',
  obligation:"SELECT o.id,t.name||' · '||r.display_name AS label FROM obligations o JOIN tests t ON t.id=o.test_id JOIN resources r ON r.id=o.resource_id",
  import:"SELECT id,json_extract(summary_json,'$.provider')||' import' AS label FROM import_reviews",
 }
 const needed = new Set(shown.map(r=>r.subject.includes(':')?r.subject.split(':')[0]:r.action.split('.')[0]))
 needed.add('person')
 const names = new Map<string,string>(), identifiers = new Map<string,string>()
 await Promise.all(Object.entries(sources).filter(([kind])=>needed.has(kind)).map(async([kind,sql])=>{
  const found = await env.DB.prepare(`SELECT * FROM (${sql}) WHERE id IN (SELECT value FROM json_each(?))`).bind(JSON.stringify(refs)).all<{id:string;label:string|null}>()
  for(const row of found.results) if(row.label){const label=kind==='program-document'?kinds[row.label]?.title??row.label.replaceAll('-',' '):row.label;names.set(kind+':'+row.id,label);identifiers.set(row.id,label)}
 }))
 const plain=(value:string)=>value.replace(/[a-f0-9]{8}-[a-f0-9-]{27,}|\b[a-f0-9]{32}\b/gi,id=>identifiers.get(id)??'record identifier retained in export')
 return rows.map(r=>{
  const kind=r.subject.includes(':')?r.subject.split(':')[0]:r.action.split('.')[0]
  const subject=names.get(r.subject)??names.get(kind+':'+r.subject)
  return {...r,subject:subject??plain(r.subject).replace(/^([a-z-]+):/,(_,prefix:string)=>prefix.replaceAll('-',' ')+': '),detail:plain(r.detail),reason:plain(r.reason),revision:plain(r.revision)}
 })
}
const file = (body: string, type: string, name: string) => new Response(body, { headers: { 'content-type': type + '; charset=utf-8', 'content-disposition': `attachment; filename="${name}"`, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } })
export function auditHandler(clock: () => Date) {
 const routes: Route[] = [
  { method: 'GET', pattern: /^\/(?:app|api)\/audit$/, run: async c => {
   const filter = auditFilter(c.url.searchParams), rows = await auditTrail(c.env, filter)
   return c.isApi ? json({ filter, entries: rows }) : auditPage(await namedEntries(c.env,rows), filter, c.actor.name)
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
