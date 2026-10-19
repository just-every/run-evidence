import { json } from '../door'
import type { Inventory } from './storage'

const cell = (value: unknown) => {
 const plain = value === null || value === undefined ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value)
 // Keep spreadsheet applications from interpreting source-controlled text as formulas.
 return '"' + (/^[=+@\-\t\r]/.test(plain) ? "'" + plain : plain).replaceAll('"', '""') + '"'
}
export function scopeExport(snapshot: Inventory, format: 'json' | 'csv') {
 const filename = 'inventory-scope.' + format
 if (format === 'json') {
  const response = json({ format: 'evidence-inventory-scope', version: 1, ...snapshot })
  response.headers.set('content-disposition', `attachment; filename="${filename}"`)
  return response
 }
 // Each original row gets a CSV row, even when its source member is grouped,
 // excluded, retired, or absent from the latest uploaded population.
 const header = ['source_key', 'canonical_key', 'kind', 'source_type', 'source_ref', 'source_label', 'source_id', 'name', 'provenance', 'owner_person_id', 'criticality', 'scope', 'lifecycle', 'last_observation', 'collection_state', 'collection_problem', 'latest', 'person_id', 'source_row_index', 'source_member_rows', 'source_row', 'source_history', 'decisions', 'grouping', 'counts', 'all_history']
 let firstRow = true
 const rows: unknown[][] = snapshot.records.flatMap(r => r.source_rows.map((original, i) => {
  // Full history is carried once; per-source history is carried on its first row.
  const globalHistory = firstRow ? snapshot.history : null
  firstRow = false
  return [r.source_key, r.canonical_key, r.kind, r.source_type, r.source_ref, r.source_label, r.source_id, r.name, r.provenance, r.owner_person_id, r.criticality, r.scope, r.lifecycle, r.last_observation, r.collection_state, r.collection_problem, r.latest, r.person_id, i + 1, r.source_rows.length, original, i === 0 ? r.source_history : null, i === 0 ? r.history.decisions : null, i === 0 ? r.history.grouping : null, snapshot.counts, globalHistory]
 }))
 // Keep the complete global journal once; each member also carries its own history.
 if (rows.length) rows[0][25] = snapshot.history
 // An empty inventory still carries reconciliation and decision history.
 if (!rows.length) rows.push([...Array(24).fill(''), snapshot.counts, snapshot.history])
 return new Response([header, ...rows].map(row => row.map(cell).join(',')).join('\r\n') + '\r\n', { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="${filename}"`, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } })
}
