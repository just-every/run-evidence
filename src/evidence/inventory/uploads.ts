import type { Bindings } from '../../auth.server'
import { uploads, rows } from '../population/storage'
import { defaults, sourceKey, type SourceRecord } from './model'

// Exact row keys identify successive assertions by the same named source.
// This does not match or group rows from different sources or people by email.
export async function populationSources(env: Bindings, now: Date): Promise<SourceRecord[]> {
 const list = await uploads(env, now)
 const loaded = await Promise.all(list.map(async upload => ({ upload, rows: await rows(env, upload.id) })))
 const latestUploads = new Map<string, string>(), records = new Map<string, SourceRecord>()
 for (const { upload: u, rows: sourceRows } of loaded) {
  const source = sourceKey('population-source', u.kind, u.source_system)
  if (!latestUploads.has(source)) latestUploads.set(source, u.id)
  for (const r of sourceRows) {
   const key = sourceKey('population', u.kind, u.source_system, r.row_key)
   const original = { ...r, upload: { ...u } }, prior = records.get(key)
   if (prior) { prior.source_rows.push(original); continue }
   const latest = latestUploads.get(source) === u.id
   records.set(key, { ...defaults(), source_key: key, canonical_key: key, kind: u.kind === 'roster' ? 'person' : u.kind === 'accounts' ? 'account' : 'device', source_type: 'population.' + u.kind, source_ref: u.source_system, source_label: u.source_system, source_id: r.id, name: String(r.attributes.name ?? r.attributes.hostname ?? r.row_key), provenance: 'manually-asserted', last_observation: u.uploaded_at, collection_state: latest ? u.state : 'removed from latest upload', collection_problem: null, latest, person_id: r.match?.state === 'approved' ? r.match.person_id : null, attributes: { ...r.attributes, row_key: r.row_key, upload_id: u.id, as_of: u.as_of, state: u.state }, source_rows: [original], source_history: [] })
  }
 }
 return [...records.values()]
}
