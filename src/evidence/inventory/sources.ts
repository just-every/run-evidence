import type { Bindings } from '../../auth.server'
import type { Person } from '../program/people'
import type { Resource } from '../resources'
import { sourceKey, defaults, type SourceRecord } from './model'
import { populationSources } from './uploads'

interface ResourceRow extends Resource { person_id: string | null; match_state: string | null }
interface Connection { id: string; status: string; last_error: string; last_success_at: string | null }
interface Vendor { id: string; name: string; owner_person_id: string | null; criticality: SourceRecord['criticality']; created_at: string; updated_at: string; data_access: string; review_due: string | null }
const resourceKind = (type: string) => type === 'identity.account' ? 'account' : /(^|\.)device($|\.)/.test(type) ? 'device' : type

export async function collectSources(env: Bindings, now: Date): Promise<SourceRecord[]> {
 const [folks, resources, vendors, connections, versions, populations, departures] = await Promise.all([
  env.DB.prepare('SELECT * FROM people ORDER BY name,id').all<Person & {role:string|null;created_by:string}>().then(r => r.results),
  env.DB.prepare('SELECT r.*,m.person_id,m.state AS match_state FROM resources r LEFT JOIN identity_matches m ON m.resource_id=r.id ORDER BY r.type,r.source_ref,r.unique_id,r.id').all<ResourceRow>(),
  env.DB.prepare('SELECT * FROM vendors ORDER BY name,id').all<Vendor>(),
  env.DB.prepare('SELECT id,status,last_error,last_success_at FROM connections').all<Connection>(),
  env.DB.prepare('SELECT id,resource_id,change,attributes_json,source_ref,at FROM resource_versions ORDER BY resource_id,at,id').all<Record<string, unknown>>(),
  populationSources(env, now),
  env.DB.prepare('SELECT person_id,departed_at,recorded_by,reason,access_outcome FROM people_departures').all<{person_id:string;departed_at:string;recorded_by:string;reason:string;access_outcome:string}>(),
 ])
 const historyByResource = new Map<string, Record<string, unknown>[]>()
 for (const version of versions.results) {
  const id = String(version.resource_id)
  const history = historyByResource.get(id) ?? []
  history.push(version)
  historyByResource.set(id, history)
 }
 const result: SourceRecord[] = folks.map(p => {
  const key = sourceKey('person', p.id), departure = departures.results.find(d => d.person_id === p.id)
  return { ...defaults(), source_key: key, canonical_key: key, kind: 'person', source_type: 'people', source_ref: 'people', source_label: 'People', source_id: p.id, name: p.name, provenance: 'owner-recorded', last_observation: p.created_at, collection_state: departure ? 'departed' : 'owner-recorded', collection_problem: null, latest: true, person_id: p.id, attributes: { email: p.email, kind: p.kind, role: p.role, departed_at: departure?.departed_at ?? null }, source_rows: [{ ...p }], source_history: departure ? [{...departure}] : [] }
 })
 for (const r of resources.results) {
  const key = sourceKey('resource', r.source_kind, r.source_ref, r.type, r.unique_id)
  // Connection prefixes are provenance supplied by collectors; never infer an owner.
  const connection = connections.results.find(c => r.source_ref === c.id || r.source_ref.endsWith(':' + c.id))
  const attributes = JSON.parse(r.attributes_json) as Record<string, unknown>
  const problem = attributes.readable === false ? 'Source record was unreadable.' : connection?.last_error || (connection && connection.status !== 'active' ? connection.status : null)
  const unread = !r.observed_at || attributes.readable === false || Object.values(attributes).every(v => v === null) || !!(connection && connection.status !== 'active')
  // The daily source-read window used by the existing test engine is 37 hours.
  // This status is descriptive only; individual tests retain their own cadence.
  const stale = !!r.observed_at && now.getTime() - Date.parse(r.observed_at) > 37 * 3600000
  const state = r.removed_at ? 'removed' : r.source_kind === 'source-observed' ? unread ? 'unread' : 'observed' : 'source-reported'
  const { person_id, match_state, ...source } = r
  result.push({ ...defaults(), source_key: key, canonical_key: key, kind: resourceKind(r.type), source_type: r.type, source_ref: r.source_ref, source_label: r.source_label, source_id: r.id, name: r.display_name, provenance: r.source_kind, last_observation: r.source_kind === 'source-reported' ? r.updated_at : r.observed_at, collection_state: state, collection_problem: problem, latest: true, person_id: match_state === 'approved' ? person_id : null, attributes, source_rows: [{ ...source, match_state, person_id }], source_history: historyByResource.get(r.id) ?? [] })
 }
 for (const v of vendors.results) {
  const key = sourceKey('vendor', v.id)
  result.push({ ...defaults(), owner_person_id: v.owner_person_id, criticality: v.criticality, source_key: key, canonical_key: key, kind: 'vendor', source_type: 'vendors', source_ref: 'vendors', source_label: 'Vendors', source_id: v.id, name: v.name, provenance: 'owner-recorded', last_observation: v.updated_at, collection_state: 'owner-recorded', collection_problem: null, latest: true, person_id: null, attributes: { data_access: v.data_access, review_due: v.review_due }, source_rows: [{ ...v }], source_history: [] })
 }
 return [...result, ...populations]
}
