import { fail } from './format'
import { pages, staged, type Store } from './registry'

const object = (value: unknown): value is Record<string, any> => !!value && typeof value === 'object' && !Array.isArray(value)
function json(value: unknown) {
 if (typeof value !== 'string') fail('Invalid retained Business or agent door JSON.')
 try { return JSON.parse(value) } catch { fail('Invalid retained Business or agent door JSON.') }
}
export async function validateDoorRecords(env: Store, id: string) {
 const fields: Record<string, string[]> = {
  bs_settings: ['document'], bs_overrides: ['value'],
  agent_door_audit: ['classes','row','evidence'], agent_door_calls: ['outcome'],
  agent_door_approvals: ['saved','approvals','result'], agent_door_reviews: ['saved'],
  agent_door_events: ['event'], agent_door_usage: ['classes'],
 }
 for (const [table, columns] of Object.entries(fields)) for await (const rows of pages(env, table, staged(id, table))) for (const row of rows) {
  const values: Record<string, any> = {}
  for (const column of columns) {
   if (row[column] === null && ['document','evidence','outcome','result'].includes(column)) continue
   values[column] = json(row[column])
  }
  if (table === 'bs_settings' && row.document !== null && !object(values.document)) fail('Invalid retained Business settings document.')
  if (table === 'agent_door_audit' && (!Array.isArray(values.classes) || !object(values.row) || values.row.id !== row.id || values.row.agent?.id !== row.agent || values.row.at !== row.at || (row.evidence !== null && !object(values.evidence)))) fail('Invalid retained agent audit attribution.')
  if (table === 'agent_door_usage' && !Array.isArray(values.classes)) fail('Invalid retained agent usage.')
  if (table === 'agent_door_events' && !object(values.event)) fail('Invalid retained agent event.')
  if (table === 'agent_door_calls' && row.outcome !== null && !object(values.outcome)) fail('Invalid retained agent call outcome.')
  if (['agent_door_approvals','agent_door_reviews'].includes(table)) {
   const saved = values.saved
   if (!object(saved) || !object(saved.principal) || !object(saved.principal.person) || !object(saved.principal.agent) || typeof saved.principal.person.id !== 'string' || typeof saved.principal.agent.id !== 'string' || typeof saved.tool !== 'string' || !Array.isArray(saved.classes)) fail('Invalid retained agent decision.')
   if (table === 'agent_door_approvals' && (!Array.isArray(values.approvals) || (row.result !== null && !object(values.result)))) fail('Invalid retained agent approval outcome.')
  }
 }
}
