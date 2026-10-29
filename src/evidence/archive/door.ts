import type { Bindings } from '../../auth.server'

// Business settings retain their display values and history. Receiving fences,
// live policy, leases and consent authority belong to the installation only.
export const doorColumns = {
 bs_settings: ['singleton','rev','document','applied_at','stopped','owner_id'],
 bs_overrides: ['field','value','actor','changed_at'],
 bs_logo: ['singleton','sha256','type','bytes'],
 bs_team: ['email','operator_id','invite','state','business_id','business_role'],
 bs_audit: ['id','actor','action','field','changed_at'],
 agent_door_agents: ['id','name','specialist','sponsor','sponsor_name','revoked','window','requests'],
 agent_door_audit: ['sequence','id','at','agent','classes','row','evidence'],
 agent_door_calls: ['agent','key','digest','decision_id','created_at','state','outcome'],
 agent_door_approvals: ['id','state','saved','approvals','result','version'],
 agent_door_reviews: ['id','state','saved','marked_by','marked_at'],
 agent_door_events: ['sequence','id','uri','event'],
 agent_door_usage: ['decision_id','at','seed','specialist','agent','classes'],
} as const
export const doorTables = Object.keys(doorColumns)
export const doorLocal = {
 bs_assert: ['value'],
 agent_door_state: ['id','envelope','local_document','local_revision','local_paused','decision_lock','decision_until'],
} as const

// Historical outcomes stay intact. Pending decisions and saved undo/proof
// capabilities cannot become runnable after fresh credentials or policy arrive.
export function restoredDoorColumn(table: string, column: string): string | undefined {
 if (table === 'bs_settings' && column === 'stopped') return '1'
 if (table === 'bs_team' && column === 'operator_id') return 'NULL'
 if (table === 'bs_team' && column === 'invite') return '0'
 if (table === 'bs_team' && column === 'state') return "'inactive'"
 if (table === 'agent_door_agents' && column === 'revoked') return '1'
 if (table === 'agent_door_approvals' && column === 'state') return "CASE WHEN state IN ('pending','executing') THEN 'expired' ELSE state END"
 if (['agent_door_approvals','agent_door_reviews'].includes(table) && column === 'saved') return "json_remove(saved,'$.undo','$.principal.nativeProof','$.result.requestState')"
}

export function doorRestoreBarriers(env: Pick<Bindings, 'DB'>) {
 return [env.DB.prepare(`INSERT INTO agent_door_state(id,local_paused) VALUES(1,1)
  ON CONFLICT(id) DO UPDATE SET envelope=NULL,local_document=NULL,local_revision=0,
  local_paused=1,decision_lock=NULL,decision_until=NULL`)]
}
