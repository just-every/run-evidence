import type { Bindings } from '../../auth.server'
import { agentColumns, exportAgentArchive, validateAgentExtension, restoreAgentStatements, type AgentArchive } from '../agent/archive'
import { importInventory, validateImportInventory, restoreImportStatements, importTableColumns, type ImportInventory } from '../import/archive'
import { fail, type Manifest, type Row } from './format'

export interface Extensions { agent: AgentArchive; imports: ImportInventory }
export const extensionTables = [...Object.keys(agentColumns), ...Object.keys(importTableColumns)]
type Store = Pick<Bindings, 'DB' | 'EXHIBITS'>
export async function inventoryExtensions(env: Store): Promise<Extensions> {
 return { agent: await exportAgentArchive(env as Bindings), imports: await importInventory(env as Bindings) }
}
export async function validateExtensions(manifest: Manifest) {
 if (manifest.version === 1) return
 const value = manifest.extensions
 if (!value || Object.keys(value).sort().join(',') !== 'agent,imports') fail('Invalid archive extensions.')
 await validateAgentExtension(value.agent, manifest.rows)
 try { validateImportInventory(value.imports) } catch { fail('Invalid retained import custody.') }
 const allRows: Row[][] = [...Object.values(manifest.rows), ...Object.values(value.agent.rows), ...Object.values(value.imports.rows)]
 if (allRows.reduce((sum, rows) => sum + rows.length, 0) > 20000) fail('Archive metadata exceeds 20,000 rows.')
 // Imported native facts must agree with their retained import additions.
 for (const row of value.imports.rows.import_additions) {
  const fact = JSON.parse(row.value_json)
  if (row.kind === 'control') {
   const control = manifest.rows.controls.find(r => r.id === row.id)
   const requirement = manifest.rows.requirements.find(r => r.id === fact.requirement_id)
   if (!control || !requirement || control.name !== fact.name || control.group_name !== fact.group || requirement.control_id !== control.id || requirement.name !== fact.proof || requirement.cadence !== fact.cadence) fail('Import control custody contradicts native records.')
  } else {
   const receipt = manifest.rows.receipts.find(r => r.id === row.id)
   const exhibit = manifest.rows.exhibits.find(r => r.id === fact.exhibit_id)
   if (!receipt || !exhibit || receipt.origin !== 'imported' || receipt.sha256 !== fact.sha256 || receipt.requirement_id !== fact.requirement_id || receipt.exhibit_id !== exhibit.id || exhibit.object_key !== fact.object_key || exhibit.size !== fact.size) fail('Import receipt custody contradicts native records.')
  }
 }
}
export function extensionStatements(env: Store, manifest: Manifest) {
 if (!manifest.extensions) return []
 return [
  ...restoreAgentStatements(env as Bindings, manifest.extensions.agent),
  ...restoreImportStatements(manifest.extensions.imports).map(s => env.DB.prepare(s.sql).bind(...(s.params ?? []))),
 ]
}
export function archiveFiles(manifest: Manifest) {
 return [
  ...manifest.files.map(file => ({ ...file, object_key: String(manifest.rows.exhibits.find(r => r.id === file.exhibit_id)!.object_key) })),
  ...(manifest.extensions?.imports.files ?? []).map(file => ({ ...file, ...(!file.available ? { reason: 'Original import ZIP is missing or changed.' } : {}) })),
 ]
}
