// Applied migration 0010; inert custody inventory for the product archive.
export const importTableColumns = {
 "ik_jobs": [
  "id",
  "destination",
  "namespace",
  "mapping_version",
  "principal_id",
  "fingerprint",
  "operation_key",
  "plan_json",
  "state",
  "checkpoint",
  "total",
  "fence",
  "lease_token",
  "lease_expires",
  "error",
  "reversal_policy",
  "reversal_policy_hash",
  "reversal_cursor",
  "reversal_hash"
 ],
 "ik_original_sets": [
  "job_id",
  "version"
 ],
 "ik_originals": [
  "job_id",
  "kind",
  "original_key",
  "name",
  "sha256",
  "size",
  "bytes"
 ],
 "ik_sources": [
  "identity",
  "source_hash",
  "mapping_version",
  "effects_hash",
  "job_id"
 ],
 "ik_provenance": [
  "id",
  "job_id",
  "ordinal",
  "effect_ordinal",
  "source_identity",
  "destination",
  "target_kind",
  "target_id",
  "reversed",
  "record_json"
 ],
 "ik_stages": [
  "job_id",
  "fence",
  "effect_id",
  "sha256",
  "bytes"
 ],
 "ik_batches": [
  "job_id",
  "action",
  "position",
  "end_position",
  "fence"
 ],
 "ik_targets": [
  "destination",
  "kind",
  "id",
  "revision",
  "value_json",
  "attachment_json"
 ],
 "ik_d1_plan_chunks": [
  "job_id",
  "ordinal",
  "body"
 ],
 "ik_d1_original_chunks": [
  "job_id",
  "kind",
  "original_key",
  "ordinal",
  "bytes"
 ],
 "ik_d1_history": [
  "id",
  "job_id",
  "ordinal",
  "effect_ordinal",
  "source_identity",
  "destination",
  "target_kind",
  "target_id",
  "reversed",
  "record_json",
  "successor_id"
 ],
 "ik_d1_entries": [
  "job_id",
  "ordinal",
  "source_identity",
  "owner_job_id",
  "effects_hash"
 ],
 "ik_d1_assertions": [
  "ok"
 ],
 "ik_d1_creation_plans": [
  "job_id",
  "ordinal",
  "body",
  "released"
 ],
 "ik_d1_reversal_reports": [
  "job_id",
  "effect_id",
  "position",
  "record_json"
 ],
 "ik_d1_streams": [
  "id",
  "destination",
  "namespace",
  "mapping_version",
  "principal_id",
  "fingerprint",
  "operation_key",
  "total",
  "layout_hash",
  "state"
 ],
 "ik_d1_stream_pages": [
  "stream_id",
  "ordinal",
  "job_id",
  "total",
  "erased_records"
 ],
 "ik_d1_erased_sources": [
  "destination",
  "identity"
 ],
 "ik_d1_erased_targets": [
  "destination",
  "identity"
 ],
 "ik_d1_indexed_jobs": [
  "job_id",
  "fingerprint"
 ],
 "ik_d1_plan_index": [
  "job_id",
  "ordinal",
  "source_identity",
  "target_identity"
 ],
 "ik_d1_stream_origins": [
  "job_id",
  "stream_id",
  "ordinal",
  "page_total",
  "job_operation_key",
  "parent_destination",
  "parent_namespace",
  "parent_mapping_version",
  "parent_principal_id",
  "parent_fingerprint",
  "parent_operation_key",
  "parent_total",
  "parent_layout_hash"
 ],
 "ik_d1_stream_revisions": [
  "stream_id",
  "destination",
  "namespace",
  "mapping_version",
  "principal_id",
  "fingerprint",
  "operation_key",
  "total",
  "layout_hash",
  "layout_revision",
  "progress_revision"
 ],
 "ik_d1_publication_fences": [
  "stream_id",
  "job_id"
 ],
 "ik_d1_staging": [
  "id",
  "generation",
  "destination",
  "namespace",
  "mapping_version",
  "principal_id",
  "fingerprint",
  "operation_key",
  "total",
  "pages",
  "layout_hash",
  "reversal_policy",
  "revision",
  "registered_revision",
  "sealed_revision"
 ],
 "ik_d1_staging_pages": [
  "stage_id",
  "ordinal",
  "job_id",
  "total",
  "fingerprint",
  "plan_json",
  "body_hash",
  "body_size",
  "chunks",
  "identities",
  "index_hash",
  "policy_hash",
  "inline_plan"
 ],
 "ik_d1_staging_chunks": [
  "stage_id",
  "page_ordinal",
  "ordinal",
  "body",
  "body_hash",
  "body_size"
 ],
 "ik_d1_staging_index": [
  "stage_id",
  "page_ordinal",
  "ordinal",
  "source_identity",
  "target_identity"
 ],
 "ik_d1_staging_originals": [
  "stage_id",
  "original_key",
  "name",
  "sha256",
  "size"
 ],
 "ik_d1_custody_revisions": [
  "job_id",
  "revision",
  "seal"
 ],
 "ik_d1_native_staging": [
  "id",
  "generation",
  "destination",
  "namespace",
  "mapping_version",
  "principal_id",
  "job_id",
  "fingerprint",
  "job_fence",
  "action",
  "values_count",
  "chunks_count",
  "identities",
  "revision",
  "registered_revision",
  "sealed_revision"
 ],
 "ik_d1_native_staging_index": [
  "stage_id",
  "ordinal",
  "source_identity",
  "target_identity"
 ],
 "ik_d1_native_staging_values": [
  "stage_id",
  "value_ordinal",
  "ordinal",
  "body",
  "body_hash",
  "body_size",
  "value_chunks"
 ],
 "ik_d1_custody_states": [
  "job_id",
  "revision"
 ],
 "ik_d1_reversal_fences": [
  "job_id",
  "action",
  "fence",
  "state_revision",
  "erased_records",
  "reused"
 ],
 "ik_d1_preparation_receipts": [
  "stage_id",
  "generation",
  "codec_id",
  "header_hash",
  "header_size",
  "header_chunks"
 ],
 "ik_d1_staging_headers": [
  "stage_id",
  "ordinal",
  "body",
  "body_hash",
  "body_size"
 ],
 "ik_d1_retirements": [
  "id",
  "kind",
  "destination",
  "receipt_id",
  "retired_at"
 ],
 "ik_d1_erasure_journal": [
  "id",
  "destination",
  "recorded_at",
  "records_erased",
  "jobs_retired",
  "streams_retired",
  "stores_json"
 ],
 "ik_d1_erasure_tally": [
  "receipt_id",
  "store",
  "image"
 ],
 "import_reviews": [
  "id",
  "actor_id",
  "actor_name",
  "staged_at",
  "object_key",
  "archive_sha256",
  "archive_size",
  "summary_json",
  "mapping_json",
  "fingerprint",
  "job_id",
  "approved_at"
 ],
 "import_additions": [
  "kind",
  "id",
  "review_id",
  "value_json"
 ],
 "import_active": [
  "kind",
  "id",
  "revision",
  "value_json"
 ]
} as const

export { importRestoreTriggers } from './schema'
