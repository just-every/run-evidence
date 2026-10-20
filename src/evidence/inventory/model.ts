export const criticalities = ['unknown', 'low', 'medium', 'high', 'critical'] as const
export const scopes = ['included', 'excluded'] as const
export const lifecycles = ['active', 'retired'] as const
export interface Metadata {
 owner_person_id: string | null
 criticality: typeof criticalities[number]
 scope: typeof scopes[number]
 lifecycle: typeof lifecycles[number]
}
export interface Decision extends Metadata {
 id: string; source_key: string; canonical_key: string; revision: number
 reason: string; actor_id: string; actor_name: string; at: string
}
export interface GroupEvent {
 id: string; operation_id: string; source_key: string; canonical_key: string
 previous_canonical_key: string; revision: number; action: 'group' | 'ungroup'
 reason: string; actor_id: string; actor_name: string; at: string
}
export interface SourceRecord extends Metadata {
 source_key: string; canonical_key: string; kind: string; source_type: string
 source_ref: string; source_label: string; source_id: string; name: string
 provenance: string; last_observation: string | null; collection_state: string
 collection_problem: string | null; latest: boolean; person_id: string | null
 attributes: Record<string, unknown>; source_rows: Record<string, unknown>[]
 source_history: Record<string, unknown>[]
}
export interface InventoryRecord extends SourceRecord {
 history: { decisions: Decision[]; grouping: GroupEvent[] }
}
// JSON tuples preserve source boundaries even when a source's IDs contain ':' or '|'.
export const sourceKey = (kind: string, ...identity: string[]) => JSON.stringify([kind, ...identity])
export const defaults = (): Metadata => ({ owner_person_id: null, criticality: 'unknown', scope: 'included', lifecycle: 'active' })
