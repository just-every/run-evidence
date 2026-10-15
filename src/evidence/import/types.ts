import type { ParsedArchive } from './manifest'
export interface Review { id:string; actor_id:string; actor_name:string; staged_at:string; object_key:string; archive_sha256:string; archive_size:number; summary_json:string; mapping_json:string|null; fingerprint:string|null; job_id:string|null; approved_at:string|null }
export interface Mapping { source_id:string; action:'create'|'existing'|'skip'; requirement_id?:string; name?:string; group?:string; proof?:string; cadence?:string; covered_from?:string; covered_to?:string }
export type Summary=ParsedArchive['summary']
export interface ControlValue { review_id:string; control_id:string; requirement_id:string; name:string; group:string; proof:string; cadence:string; created_at:string }
export interface ReceiptValue { review_id:string; receipt_id:string; requirement_id:string; exhibit_id:string; object_key:string; filename:string; size:number; sha256:string; source:string; covered_from:string; covered_to:string; added_by:string; added_by_name:string; added_at:string; source_collected_at:string|null; source_exported_at:string|null; source_id:string; source_path:string; archive_sha256:string }
