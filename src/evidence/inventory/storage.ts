import type { Bindings } from '../../auth.server'
import { auditStatement, oneOf, text, type Actor, type Input } from '../door'
import { requirePerson } from '../program/people'
import { Refusal } from '../upload'
import { collectSources } from './sources'
import { criticalities, scopes, lifecycles, type Decision, type GroupEvent, type InventoryRecord } from './model'

export async function inventory(env: Bindings, now: Date) {
 const [sources, decisions, grouping] = await Promise.all([
  collectSources(env, now),
  env.DB.prepare('SELECT id,source_key,canonical_key,revision,owner_person_id,criticality,scope,lifecycle,reason,actor_id,actor_name,at FROM inventory_decisions ORDER BY source_key,revision').all<Decision>(),
  env.DB.prepare('SELECT id,operation_id,source_key,canonical_key,previous_canonical_key,revision,action,reason,actor_id,actor_name,at FROM inventory_group_events ORDER BY source_key,revision').all<GroupEvent>(),
 ])
 const decisionsBySource = new Map<string, Decision[]>(), groupsBySource = new Map<string, GroupEvent[]>()
 for (const decision of decisions.results) {
  const history = decisionsBySource.get(decision.source_key) ?? []
  history.push(decision); decisionsBySource.set(decision.source_key, history)
 }
 for (const event of grouping.results) {
  const history = groupsBySource.get(event.source_key) ?? []
  history.push(event); groupsBySource.set(event.source_key, history)
 }
 const records: InventoryRecord[] = sources.map(source => {
  const history = { decisions: decisionsBySource.get(source.source_key) ?? [], grouping: groupsBySource.get(source.source_key) ?? [] }
  const decision = history.decisions.at(-1), group = history.grouping.at(-1)
  return { ...source, ...(decision ? { owner_person_id: decision.owner_person_id, criticality: decision.criticality, scope: decision.scope, lifecycle: decision.lifecycle } : {}), canonical_key: group?.canonical_key ?? source.source_key, history }
 })
 const membersByCanonical = new Map<string, InventoryRecord[]>()
 for (const record of records) {
  const members = membersByCanonical.get(record.canonical_key) ?? []
  members.push(record); membersByCanonical.set(record.canonical_key, members)
 }
 const canonical = [...membersByCanonical].map(([key, members]) => {
  return { canonical_key: key, kind: members[0].kind, members: members.map(r => r.source_key), source_rows: members.reduce((n, r) => n + r.source_rows.length, 0), included: members.filter(r => r.scope === 'included').length, excluded: members.filter(r => r.scope === 'excluded').length, active: members.filter(r => r.lifecycle === 'active').length, retired: members.filter(r => r.lifecycle === 'retired').length }
 })
 return { records, canonical, counts: { source_rows: records.reduce((n, r) => n + r.source_rows.length, 0), records: records.length, canonical: canonical.length, included: records.filter(r => r.scope === 'included').length, excluded: records.filter(r => r.scope === 'excluded').length, active: records.filter(r => r.lifecycle === 'active').length, retired: records.filter(r => r.lifecycle === 'retired').length }, history: { decisions: decisions.results, grouping: grouping.results } }
}
export type Inventory = Awaited<ReturnType<typeof inventory>>
export function requireRecord(snapshot: Inventory, key: string) {
 const record = snapshot.records.find(r => r.source_key === key)
 if (!record) throw new Refusal('Choose a source record from Inventory.', 404)
 return record
}
export async function decide(env: Bindings, actor: Actor, input: Input, now: Date) {
 const snapshot = await inventory(env, now), source_key = text(input, 'source_key', 2400)
 const record = requireRecord(snapshot, source_key), owner_person_id = text(input, 'owner_person_id', 200, true) || null
 if (owner_person_id) await requirePerson(env, owner_person_id, 'record owner')
 const decision: Decision = { id: crypto.randomUUID(), source_key, canonical_key: record.canonical_key, revision: (record.history.decisions.at(-1)?.revision ?? 0) + 1, owner_person_id, criticality: oneOf(input, 'criticality', criticalities), scope: oneOf(input, 'scope', scopes), lifecycle: oneOf(input, 'lifecycle', lifecycles), reason: text(input, 'reason', 1000), actor_id: actor.id, actor_name: actor.name, at: now.toISOString() }
 await env.DB.batch([
  env.DB.prepare('INSERT INTO inventory_decisions(id,source_key,canonical_key,revision,owner_person_id,criticality,scope,lifecycle,reason,actor_id,actor_name,at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').bind(decision.id, source_key, decision.canonical_key, decision.revision, owner_person_id, decision.criticality, decision.scope, decision.lifecycle, decision.reason, actor.id, actor.name, decision.at),
  auditStatement(env, actor, 'inventory.metadata-decided', source_key, now, 'succeeded', decision.reason, { reason: decision.reason, revision: decision.revision }),
 ])
 return decision
}
function selectedKeys(input: Input) {
 const value = input.source_keys, keys = typeof value === 'string' ? [value] : value ?? []
 if (!keys.length || keys.length > 200 || keys.some(k => !k || k.length > 2400)) throw new Refusal('Select one to 200 source records explicitly.')
 return [...new Set(keys)]
}
export async function group(env: Bindings, actor: Actor, input: Input, now: Date) {
 const snapshot = await inventory(env, now), action = oneOf(input, 'action', ['group', 'ungroup'] as const)
 const keys = selectedKeys(input), selected = keys.map(key => requireRecord(snapshot, key)), reason = text(input, 'reason', 1000)
 if (action === 'group' && selected.length < 2) throw new Refusal('Select at least two source records to group.')
 if (new Set(selected.map(r => r.kind)).size !== 1) throw new Refusal('Only records of the same kind can be grouped. People and roster rows are one kind; accounts and devices are separate.')
 // Regrouping cannot pull in unselected members through a shared canonical key.
 if (action === 'group' && selected.some(r => snapshot.records.some(other => other.canonical_key === r.canonical_key && !keys.includes(other.source_key)))) throw new Refusal('Select every member of an existing group before regrouping it.', 409)
 if (action === 'ungroup' && selected.every(r => r.canonical_key === r.source_key)) throw new Refusal('The selected records are already separate.')
 const operation_id = crypto.randomUUID(), canonical_key = 'group:' + operation_id
 const events: GroupEvent[] = selected.map(r => ({ id: crypto.randomUUID(), operation_id, source_key: r.source_key, canonical_key: action === 'group' ? canonical_key : r.source_key, previous_canonical_key: r.canonical_key, revision: (r.history.grouping.at(-1)?.revision ?? 0) + 1, action, reason, actor_id: actor.id, actor_name: actor.name, at: now.toISOString() }))
 await env.DB.batch([
  ...events.map(e => env.DB.prepare('INSERT INTO inventory_group_events(id,operation_id,source_key,canonical_key,previous_canonical_key,revision,action,reason,actor_id,actor_name,at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind(e.id, e.operation_id, e.source_key, e.canonical_key, e.previous_canonical_key, e.revision, e.action, reason, actor.id, actor.name, e.at)),
  auditStatement(env, actor, 'inventory.' + action, operation_id, now, 'succeeded', reason, { reason }),
 ])
 return { operation_id, action, events }
}
