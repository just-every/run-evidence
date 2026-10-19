import type { Bindings } from '../../auth.server'
import { libraryControl } from '../library'
import { Refusal } from '../upload'
export interface Framework { id: string; name: string; revision: number; created_at: string }
export interface FrameworkRequirement { id: string; framework_id: string; ref: string; title: string; description: string; section: string; removed_at: string | null; created_at: string; mappings: string[] }
export interface Mapping { id: string; requirement_id: string; control_id: string; decision: 'mapped' | 'unmapped'; origin: 'manual' | 'import'; actor_id: string; actor_name: string; at: string; reason: string; framework_revision: number }
export interface Revision { id: string; framework_id: string; revision: number; snapshot_json: string; diff_json: string; actor_id: string; actor_name: string; at: string; reason: string; object_key: string | null; filename: string | null; size: number | null; media_type: string | null; sha256: string | null }
export interface Definition { ref: string; title: string; description: string; section: string; control_ids: string[] }
export interface Difference { added: string[]; changed: string[]; removed: string[] }
export const hash = async (value: Uint8Array | string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', (typeof value === 'string' ? new TextEncoder().encode(value) : new Uint8Array(value)).buffer)), b => b.toString(16).padStart(2, '0')).join('')
export const controlIds = (value: string) => [...new Set(value.split(/[,;\n]/).map(x => x.trim()).filter(Boolean))].sort()
export async function knownControls(env: Bindings) { return new Set((await env.DB.prepare('SELECT id FROM controls').all<{ id: string }>()).results.map(c => c.id)) }
export const knownControl = (id: string, known: Set<string>) => known.has(id) || !!libraryControl(id)
export function validateDefinition(row: Definition, known: Set<string>) {
 const reasons: string[] = []
 if (!row.ref || row.ref.length > 120) reasons.push('Requirement ID is required (at most 120 characters).')
 if (!row.title || row.title.length > 300) reasons.push('Title is required (at most 300 characters).')
 if (row.description.length > 10000) reasons.push('Description exceeds 10,000 characters.')
 if (row.section.length > 300) reasons.push('Section exceeds 300 characters.')
 if (row.control_ids.length > 50) reasons.push('Map at most 50 controls per requirement.')
 for (const id of row.control_ids) if (!knownControl(id, known)) reasons.push('Unknown control ID: ' + id)
 return reasons
}
export function requireValid(row: Definition, known: Set<string>) { const errors = validateDefinition(row, known); if (errors.length) throw new Refusal(errors.join(' ')) }
