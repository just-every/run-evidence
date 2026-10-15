import type { FolderInput, ReviewData } from '../review/types'
export interface Actor { id:string; displayName:string }
export interface AgentToken {
 id:string; label:string; created_by:string; created_by_name:string; created_at:string
 expires_at:string; revoked_at:string|null; revoked_by:string|null
}
export interface TokenGrant extends AgentToken { token_hash:string|null }
export interface Decision {
 id:string; proposal_id:string; action:'approved'|'rejected'; actor_id:string; actor_name:string
 decided_at:string; snapshot_hash:string; folder_id:string|null
}
export interface ProposalRow { id:string; token_id:string; created_at:string; input_json:string; snapshot_json:string; snapshot_hash:string }
export interface Proposal { id:string; token_id:string; created_at:string; input:FolderInput; snapshot:ReviewData; snapshot_hash:string; decision:Decision|null }
