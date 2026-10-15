import type { Cadence, Gap, Origin } from '../model'
export interface Folder {
 id: string; reviewer_label: string; period_from: string; period_to: string
 expires_at: string; created_at: string; closed_at: string | null
}
export interface Grant extends Folder { token_hash: string | null }
export interface FolderInput { reviewer_label: string; period_from: string; period_to: string; expires_at: string; control_ids: string[] }
export type ReviewAction = 'page' | 'list' | 'receipt' | 'download' | 'unknown'
export interface ReviewReceipt {
 id: string; requirement_id: string; exhibit_id: string; origin: Origin; source: string
 covered_from: string; covered_to: string; added_at: string; sha256: string
 filename: string; size: number; media_type: string; available: boolean
 superseded: boolean; supersedes: string | null
}
export interface ReviewRequirement {
 id: string; control_id: string; control_name: string; group_name: string
 name: string; cadence: Cadence; gap: Gap; period_from: string; period_to: string
 receipts: ReviewReceipt[]
}
export interface ReviewData {
 folder: Pick<Folder, 'reviewer_label' | 'period_from' | 'period_to' | 'expires_at'>
 selected: string; requirements: ReviewRequirement[]
}
export interface ReviewEvent { id: string; folder_id: string | null; exhibit_id: string | null; action: ReviewAction; outcome: 'allowed' | 'refused'; occurred_at: string }
