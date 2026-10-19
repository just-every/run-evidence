import type { Inventory } from './storage'

// Existing consumers keep their People/account/device projection. Source and
// canonical records above it include removed rows and all original assertions.
export function compatibility(snapshot: Inventory) {
 const current = snapshot.records.filter(r => r.latest && r.collection_state !== 'removed')
 const personName = (id: string | null) => snapshot.records.find(p => p.source_type === 'people' && p.person_id === id)?.name ?? null
 const accounts = current.filter(r => r.kind === 'account').map(r => ({
  source_key: r.source_key, canonical_key: r.canonical_key, person_id: r.person_id,
  provenance: r.provenance, source: r.source_label, key: String(r.attributes.row_key ?? r.attributes.email ?? r.source_id), name: r.name, status: String(r.attributes.status ?? '—'), person: personName(r.person_id), observed: r.last_observation, tests: r.provenance === 'manually-asserted' ? 'unknown: needs a source read' : r.collection_state === 'observed' ? 'source read recorded; see Tests for cadence-specific results' : 'unknown: needs a fresh source read', ...(r.provenance === 'manually-asserted' ? { state: String(r.attributes.state) } : {}),
 }))
 const devices = current.filter(r => r.kind === 'device').map(r => ({
  source_key: r.source_key, canonical_key: r.canonical_key, person_id: r.person_id,
  provenance: r.provenance, source: r.source_label, serial: String(r.attributes.serial ?? r.attributes.row_key ?? r.source_id), owner: personName(r.person_id), encrypted: r.attributes.encrypted ?? null, observed: r.last_observation, tests: r.provenance === 'manually-asserted' ? 'unknown: needs a source read' : r.collection_state === 'observed' ? 'source read recorded; see Tests for cadence-specific results' : 'unknown: needs a fresh source read', ...(r.provenance === 'manually-asserted' ? { state: String(r.attributes.state) } : {}),
 }))
 const people = snapshot.records.filter(r => r.source_type === 'people').map(p => ({
  id: p.person_id, name: p.name, email: String(p.attributes.email), kind: String(p.attributes.kind),
  directory: current.filter(r => r.source_type === 'identity.account' && r.person_id === p.person_id).map(r => r.source_label),
  manual: current.filter(r => r.provenance === 'manually-asserted' && r.person_id === p.person_id).map(r => `${r.source_label} ${r.source_type.slice('population.'.length)} (manual, uploaded ${r.last_observation?.slice(0, 10)})`),
  account_status: accounts.some(a => a.person_id === p.person_id) ? 'account found' : 'no account found',
 }))
 return { people, accounts, devices, unmatched: { accounts: accounts.filter(a => !a.person_id).length, devices: devices.filter(d => !d.person_id).length } }
}
