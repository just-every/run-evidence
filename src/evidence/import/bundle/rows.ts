import type { Json } from '../base/types'
import type { AbsentField, ClassId, SourceRow, Verdict } from './classes'
import { digest } from './check'
// Accumulates source rows for one export and enforces one source id per class and type.
export class Rows {
 rows: SourceRow[] = []
 warnings: string[] = []
 absent: AbsentField[] = []
 private seen = new Set<string>()
 constructor(readonly files: Map<string, Uint8Array>) {}
 add(cls: ClassId, type: string, id: string, path: string, fields: Json, verdict: Verdict = 'admit', reason?: string, file?: SourceRow['file']) {
  const key = cls + '\u0000' + type + '\u0000' + id
  if (this.seen.has(key)) { this.rows.push({ class: cls, type, id: id + '#duplicate-' + this.rows.length, path, fields: {}, verdict: 'refused', reason: 'Duplicate source id ' + id + ' in this export; the first record is kept.' }); return }
  this.seen.add(key)
  this.rows.push({ class: cls, type, id, path, fields, verdict, ...(reason ? { reason } : {}), ...(file ? { file } : {}) })
 }
 refuse(cls: ClassId, type: string, id: string, path: string, reason: string) { this.add(cls, type, id, path, {}, 'refused', reason) }
 has(cls: ClassId, type: string, id: string) { return this.seen.has(cls + '\u0000' + type + '\u0000' + id) }
 bytes(path: string, name: string): SourceRow['file'] | undefined {
  const b = this.files.get(path)
  return b ? { path, size: b.length, sha256: digest(b), name } : undefined
 }
}
