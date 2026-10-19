import type { Bindings } from '../auth.server'
import { Refusal } from './upload'
// Resources are what tests evaluate. Pushed records are source-reported by a
// named token; connector reads are source-observed. Each change appends a
// version, and a full sync marks absent resources removed, never deleted.
export type FieldType = 'string' | 'number' | 'boolean'
export interface ResourceSchema { fields: Record<string, FieldType>; required: string[] }
export interface Resource { id: string; type: string; unique_id: string; display_name: string; source_kind: 'source-reported' | 'source-observed'; source_ref: string; source_label: string; attributes_json: string; attributes_hash: string; first_seen_at: string; updated_at: string; removed_at: string | null; observed_at: string | null }
export interface Source { kind: Resource['source_kind']; ref: string; label: string }
export interface ItemResult { uniqueId: string; outcome: 'created' | 'updated' | 'unchanged' | 'restored' | 'rejected' | 'removed'; reasons?: string[]; id?: string }
export const MAX_ITEMS = 200
export const apiType = (type: string) => /^[a-z][a-z0-9_]{1,62}$/.test(type)
export function parseSchema(value: unknown): ResourceSchema {
 const schema = typeof value === 'string' ? (() => { try { return JSON.parse(value) } catch { return null } })() : value
 if (!schema || typeof schema !== 'object' || !schema.fields || typeof schema.fields !== 'object' || Array.isArray(schema.fields)) throw new Refusal('A schema needs a fields object of name to string, number or boolean.')
 const fields = Object.entries(schema.fields)
 if (!fields.length || fields.length > 50 || fields.some(([name, type]) => !/^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(name) || !['string', 'number', 'boolean'].includes(String(type)))) throw new Refusal('Declare one to fifty fields, each string, number or boolean.')
 const required = Array.isArray(schema.required) ? schema.required.map(String) : []
 if (required.some((r: string) => !Object.hasOwn(schema.fields, r))) throw new Refusal('Required fields must be declared fields.')
 return { fields: schema.fields, required }
}
const canonical = (value: Record<string, unknown>) => JSON.stringify(Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))))
const digest = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), b => b.toString(16).padStart(2, '0')).join('')
export const resourceType = (env: Bindings, type: string) => env.DB.prepare('SELECT type,schema_json FROM resource_types WHERE type=?').bind(type).first<{ type: string; schema_json: string }>()
export async function declareType(env: Bindings, type: string, schema: ResourceSchema, by: string, now: Date) {
 const existing = await resourceType(env, type)
 if (existing && existing.schema_json !== JSON.stringify(schema)) {
  const prior = parseSchema(existing.schema_json)
  if (Object.entries(prior.fields).some(([name, kind]) => schema.fields[name] !== kind)) throw new Refusal('A declared field cannot be removed or change type; declare a new resource type.', 409)
 }
 await env.DB.prepare('INSERT INTO resource_types(type,schema_json,declared_by,declared_at) VALUES(?,?,?,?) ON CONFLICT(type) DO UPDATE SET schema_json=excluded.schema_json').bind(type, JSON.stringify(schema), by, now.toISOString()).run()
}
function validate(schema: ResourceSchema, item: unknown): { uniqueId: string; displayName: string; attributes: Record<string, unknown> } | { uniqueId: string; reasons: string[] } {
 const value = item && typeof item === 'object' && !Array.isArray(item) ? item as Record<string, unknown> : {}
 const uniqueId = typeof value.uniqueId === 'string' ? value.uniqueId : '', reasons: string[] = []
 if (!/^[\x21-\x7e]{1,200}$/.test(uniqueId)) reasons.push('uniqueId must be 1-200 printable characters')
 const attributes = value.attributes && typeof value.attributes === 'object' && !Array.isArray(value.attributes) ? value.attributes as Record<string, unknown> : null
 if (!attributes) reasons.push('attributes must be an object')
 else {
  for (const [name, attribute] of Object.entries(attributes)) {
   if (!Object.hasOwn(schema.fields, name)) reasons.push(`${name} is not a declared field`)
   else if (attribute !== null && typeof attribute !== schema.fields[name]) reasons.push(`${name} must be ${schema.fields[name]}`)
   else if (typeof attribute === 'string' && attribute.length > 2000) reasons.push(`${name} is longer than 2000 characters`)
  }
  for (const name of schema.required) if (attributes[name] === undefined || attributes[name] === null) reasons.push(`${name} is required`)
 }
 const displayName = typeof value.displayName === 'string' && value.displayName.trim() ? value.displayName.trim().slice(0, 200) : uniqueId
 return reasons.length ? { uniqueId: uniqueId || '(missing)', reasons } : { uniqueId, displayName, attributes: attributes! }
}
// Idempotent upsert of one batch. Identical attributes change nothing, not even
// the update time; a full sync marks every absent resource of the type removed.
// fullSync 'source' removes only resources this same source wrote (a collector's own account).
export async function upsertResources(env: Bindings, type: string, schema: ResourceSchema, items: unknown[], source: Source, fullSync: boolean | 'source', now: Date) {
 if (items.length > MAX_ITEMS) throw new Refusal(`Push at most ${MAX_ITEMS} resources per request.`, 413)
 const at = now.toISOString(), results: ItemResult[] = [], statements: D1PreparedStatement[] = [], changed: string[] = []
 const existing = new Map((await env.DB.prepare('SELECT * FROM resources WHERE type=?').bind(type).all<Resource>()).results.map(r => [r.unique_id, r]))
 const seen = new Set<string>()
 for (const item of items) {
  const checked = validate(schema, item)
  if ('reasons' in checked) { results.push({ uniqueId: checked.uniqueId, outcome: 'rejected', reasons: checked.reasons }); continue }
  if (seen.has(checked.uniqueId)) { results.push({ uniqueId: checked.uniqueId, outcome: 'rejected', reasons: ['uniqueId repeats within this request'] }); continue }
  seen.add(checked.uniqueId)
  const attributes = canonical(checked.attributes), hash = await digest(attributes), prior = existing.get(checked.uniqueId)
  if (prior && prior.source_kind !== source.kind) { results.push({ uniqueId: checked.uniqueId, outcome: 'rejected', reasons: [`this resource is ${prior.source_kind} and cannot be replaced by ${source.kind} data`] }); continue }
  if (prior && prior.attributes_hash === hash && !prior.removed_at && prior.display_name === checked.displayName) { results.push({ uniqueId: checked.uniqueId, outcome: 'unchanged', id: prior.id }); continue }
  const id = prior?.id ?? crypto.randomUUID(), outcome = !prior ? 'created' : prior.removed_at ? 'restored' : 'updated'
  statements.push(prior
   ? env.DB.prepare('UPDATE resources SET display_name=?,source_ref=?,source_label=?,attributes_json=?,attributes_hash=?,updated_at=?,removed_at=NULL WHERE id=?').bind(checked.displayName, source.ref, source.label, attributes, hash, at, id)
   : env.DB.prepare('INSERT INTO resources(id,type,unique_id,display_name,source_kind,source_ref,source_label,attributes_json,attributes_hash,first_seen_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind(id, type, checked.uniqueId, checked.displayName, source.kind, source.ref, source.label, attributes, hash, at, at),
   env.DB.prepare('INSERT INTO resource_versions(id,resource_id,change,attributes_json,source_ref,at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(), id, outcome, attributes, source.ref, at))
  results.push({ uniqueId: checked.uniqueId, outcome, id }); changed.push(id)
 }
 if (fullSync) for (const prior of existing.values()) if (!seen.has(prior.unique_id) && !prior.removed_at && prior.source_kind === source.kind && (fullSync === true || prior.source_ref === source.ref)) {
  statements.push(env.DB.prepare('UPDATE resources SET removed_at=?,updated_at=? WHERE id=? AND removed_at IS NULL').bind(at, at, prior.id), env.DB.prepare('INSERT INTO resource_versions(id,resource_id,change,attributes_json,source_ref,at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(), prior.id, 'removed', prior.attributes_json, source.ref, at))
  results.push({ uniqueId: prior.unique_id, outcome: 'removed', id: prior.id }); changed.push(prior.id)
 }
 if (statements.length) await env.DB.batch(statements)
 return { results, changed }
}
export async function removeResource(env: Bindings, type: string, uniqueId: string, source: Source, now: Date) {
 const prior = await env.DB.prepare('SELECT * FROM resources WHERE type=? AND unique_id=?').bind(type, uniqueId).first<Resource>()
 if (!prior || prior.source_kind !== source.kind) throw new Refusal('Resource not found.', 404)
 if (prior.removed_at) return prior
 const at = now.toISOString()
 await env.DB.batch([env.DB.prepare('UPDATE resources SET removed_at=?,updated_at=? WHERE id=?').bind(at, at, prior.id), env.DB.prepare('INSERT INTO resource_versions(id,resource_id,change,attributes_json,source_ref,at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(), prior.id, 'removed', prior.attributes_json, source.ref, at)])
 return { ...prior, removed_at: at }
}
export const resourceHistory = async (env: Bindings, id: string) => (await env.DB.prepare('SELECT change,attributes_json,source_ref,at FROM resource_versions WHERE resource_id=? ORDER BY at,rowid').bind(id).all<{ change: string; attributes_json: string; source_ref: string; at: string }>()).results

// Internal registers publish a complete population, which may exceed one API
// request. Retire absent rows only after all bounded batches were admitted.
export async function upsertRegister(env: Bindings, type: string, schema: ResourceSchema, items: {uniqueId:string}[], source: Source, now: Date) {
 const results: ItemResult[] = [], changed: string[] = []
 for (let start = 0; start < items.length; start += MAX_ITEMS) {
  const batch = await upsertResources(env, type, schema, items.slice(start, start + MAX_ITEMS), source, false, now)
  results.push(...batch.results); changed.push(...batch.changed)
  if (batch.results.some(r => r.outcome === 'rejected')) throw new Refusal('The internal register population could not be admitted completely.', 503)
 }
 const seen = new Set(items.map(i => i.uniqueId))
 const previous = (await env.DB.prepare('SELECT unique_id,id FROM resources WHERE type=? AND source_kind=? AND source_ref=? AND removed_at IS NULL').bind(type, source.kind, source.ref).all<{unique_id:string; id:string}>()).results
 for (const old of previous) if (!seen.has(old.unique_id)) {
  await removeResource(env, type, old.unique_id, source, now)
  results.push({uniqueId:old.unique_id,id:old.id,outcome:'removed'}); changed.push(old.id)
 }
 return {results,changed}
}
