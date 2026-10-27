import { sourceIdentity } from '../base/provenance/identity'
import type { ImportJob } from '../base/types'
import type { Mapping } from '../types'
import type { Bindings } from '../../../auth.server'
import type { Review } from '../types'
import { classes } from './classes'
import type { ClassSummary } from './parse'
import type { RecordValue } from './plan'
export interface ImportedRecord extends Omit<RecordValue, 'review_id'> { id: string; review_id: string; active: boolean }
const kindClass: Record<string, string> = { control: 'frameworks_controls', receipt: 'exhibits' }
// Imported records read back from the immutable additions; `active` is the live link that undo removes.
export async function importedRecords(env: Bindings, filter: { review?: string; class?: string; activeOnly?: boolean } = {}): Promise<ImportedRecord[]> {
 const { results } = await env.DB.prepare("SELECT a.kind,a.id,a.review_id,a.value_json,(SELECT 1 FROM import_active x WHERE x.kind=a.kind AND x.id=a.id) AS active FROM import_additions a WHERE (?1 IS NULL OR a.review_id=?1) ORDER BY a.review_id,a.kind,a.id").bind(filter.review ?? null).all<{ kind: string; id: string; review_id: string; value_json: string; active: number | null }>()
 const out: ImportedRecord[] = []
 for (const r of results) {
  const value = JSON.parse(r.value_json), active = !!r.active
  const rec: ImportedRecord | null = r.kind === 'record' ? { ...value, id: r.id, active } : r.kind in kindClass ? { id: r.id, review_id: r.review_id, incumbent: 'Drata', class: kindClass[r.kind], type: r.kind === 'control' ? 'control' : 'evidence file', source_id: value.source_id ?? value.control_id, source_path: value.source_path ?? '', source_hash: '', exported_at: value.source_exported_at ?? null, received_at: value.added_at ?? value.created_at, origin: 'imported', verified: false, fields: value, file: r.kind === 'receipt' ? { path: value.source_path, size: value.size, sha256: value.sha256, name: value.filename } : null, identity: null, active } : null
  if (rec && (!filter.class || rec.class === filter.class) && (!filter.activeOnly || active)) out.push(rec)
 }
 return out
}
// Zero-effect mappings are still processed source decisions, not new controls.
export async function mappedExisting(env: Bindings, review: Review, job?: ImportJob) {
 if (!job || JSON.parse(review.summary_json).provider !== 'Drata' || !review.mapping_json) return 0
 const mapped = (JSON.parse(review.mapping_json) as Mapping[]).filter(m => m.action === 'existing')
 if (!mapped.length) return 0
 const done = new Set((await env.DB.prepare('SELECT source_identity FROM ik_d1_entries WHERE job_id=? AND ordinal<?').bind(job.id, job.checkpoint).all<{ source_identity: string }>()).results.map(r => r.source_identity))
 return mapped.filter(m => done.has(sourceIdentity(job.destination, job.namespace, 'control', m.source_id))).length
}
export interface Reconciled extends ClassSummary { active: number; unlinked: number; mapped_existing: number; pending: number; reconciled: boolean | null }
// Source, admitted, unsupported and refused per class; after approval the admitted figure is the retained
// additions and `active` the links still live (undo moves them to `unlinked`, never deleting the additions).
export function reconcile(review: Review, summary: { classes: ClassSummary[] }, records: ImportedRecord[], options: { mappedExisting?: number; pending?: boolean } = {}): Reconciled[] {
 return summary.classes.map(c => {
  const mine = records.filter(r => r.class === c.id), approved = !!review.approved_at && review.job_id
  const admitted = approved ? mine.length : c.admitted, active = mine.filter(r => r.active).length
  const mapped_existing = approved && c.id === 'frameworks_controls' ? options.mappedExisting ?? 0 : 0
  const unsupported = approved && !options.pending ? Math.max(0, c.source - admitted - mapped_existing - c.refused) : c.unsupported
  const pending = approved && options.pending ? Math.max(0, c.source - admitted - mapped_existing - c.refused - unsupported) : 0
  return { ...c, admitted, unsupported, mapped_existing, pending, active, unlinked: mine.length - active, reconciled: approved ? admitted + mapped_existing + unsupported + pending + c.refused === c.source : null }
 })
}
const csvCell = (v: unknown) => '"' + String(v ?? '').replace(/"/g, '""').replace(/^([=+\-@\t\r])/, "'$1") + '"'
export function recordsCsv(records: ImportedRecord[]) {
 const head = ['class', 'type', 'incumbent', 'source_id', 'source_path', 'exported_at', 'received_at', 'origin', 'verified', 'file_sha256', 'file_size', 'identity', 'active', 'fields']
 return [head.join(','), ...records.map(r => [r.class, r.type, r.incumbent, r.source_id, r.source_path, r.exported_at, r.received_at, r.origin, r.verified, r.file?.sha256, r.file?.size, r.identity ? r.identity.decision + ' ' + r.identity.id : '', r.active, JSON.stringify(r.fields)].map(csvCell).join(','))].join('\r\n') + '\r\n'
}
export const classLabel = (id: string) => classes.find(c => c.id === id)?.label ?? id
