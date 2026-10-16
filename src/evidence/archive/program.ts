import type { Bindings } from '../../auth.server'
import { fail, type Row } from './format'
// Archive version 3 carries every program-domain table, in foreign-key order.
// Credentials never travel: token digests and connection secrets are left out,
// so restored API tokens cannot authenticate and restored connections stay
// inactive until an owner reconnects them. Rate counters are transient.
export const programColumns = {
 people:['id','name','email','kind','created_at','created_by'],
 programs:['id','framework','edition','name','legal_entity','report_type','categories','products','teams','regions','systems','audit_from','audit_to','assessor','lead_person_id','milestones','created_at','updated_at'],
 program_revisions:['id','program_id','revision','snapshot_json','actor_id','actor_name','reason','at'],
 program_applicability:['id','program_id','ref','state','rationale','actor_id','actor_name','decided_at'],
 program_reviews:['id','program_id','reviewer','notes','snapshot_hash','recorded_by','recorded_name','at'],
 edition_changes:['id','program_id','from_edition','to_edition','diff_json','proposed_by','proposed_name','proposed_at','decision','decided_by','decided_name','decided_at','reason'],
 program_editions:['id','program_id','edition','effective_at','change_id'],
 library_adoptions:['control_id','library_id','library_revision','adopted_at'],
 control_mappings:['id','control_id','framework','edition','ref','added_by','added_name','added_at','reason','removed_by','removed_name','removed_at','removal_reason'],
 control_owners:['id','control_id','owner_person_id','contributors','due_date','actor_id','actor_name','reason','at'],
 control_scope:['id','control_id','asset','action','reason','effective_at','actor_id','actor_name'],
 requirement_schedules:['id','requirement_id','cadence','anchor','fiscal_start_month','window_start','program_id','reminder_lead_days','owner_person_id','effective_from','actor_id','actor_name','reason'],
 receipt_effective_dates:['receipt_id','effective_date'],
 renewal_overrides:['id','requirement_id','cycle_due','due_date','reason','actor_id','actor_name','at'],
 followups:['id','kind','subject_id','cycle_key','recipient','state','detail','created_at','attempted_at'],
 product_audit:['id','actor_kind','actor_id','actor_name','action','subject','outcome','detail','at'],
 resource_types:['type','schema_json','declared_by','declared_at'],
 resources:['id','type','unique_id','display_name','source_kind','source_ref','source_label','attributes_json','attributes_hash','first_seen_at','updated_at','removed_at','observed_at'],
 resource_versions:['id','resource_id','change','attributes_json','source_ref','at'],
 tests:['id','catalogue_id','name','resource_type','criteria_json','cadence','category','severity','origin','defined_by','revision','enabled','created_at'],
 test_controls:['test_id','control_id'],
 test_revisions:['id','test_id','revision','criteria_json','excluded_json','cadence','actor','reason','at'],
 test_runs:['id','test_id','revision','trigger','started_at','finished_at','outcome','population','passed','failed','unknown','not_applicable'],
 observations:['id','run_id','test_id','revision','resource_id','result','expected_json','actual_json','reason','source_kind','source_ref','observed_at','exception_id','interval_from'],
 test_exceptions:['id','test_id','resource_id','reason','approved_by','approved_name','approved_at','expires_at','revoked_at'],
 sla_policies:['id','category','severity','days','effective_at','actor_id','actor_name'],
 obligations:['id','test_id','resource_id','severity','category','state','clock_started_at','sla_days','sla_policy_id','opened_observation_id','owner_person_id','next_action','target_date','accepted_until','accepted_by','closed_at','verified_observation_id','cycles'],
 obligation_events:['id','obligation_id','kind','actor_id','actor_name','body','observation_id','at'],
 retests:['id','obligation_id','reason','queued_at','run_id','done_at'],
 api_tokens:['id','name','scopes','created_by','created_name','created_at','expires_at','revoked_at','revoked_by'],
 api_calls:['id','token_id','method','route','status','at'],
 api_evidence:['receipt_id','token_id','token_name','owner_name'],
 connections:['id','provider','label','account','api_base','granted_scopes','status','created_by','created_name','created_at','rotated_at','revoked_at','last_success_at','last_attempt_at','next_attempt_at','backoff_seconds','last_error'],
 connection_repositories:['connection_id','full_name','selected'],
 collection_runs:['id','connection_id','trigger','connector_revision','started_at','finished_at','outcome','coverage_json','error_code'],
 risk_methods:['id','revision','scale','likelihood_labels','impact_labels','formula','matrix_json','thresholds_json','actor_name','at'],
 vendors:['id','name','owner_person_id','data_access','criticality','review_due','created_at','updated_at'],
 risk_imports:['id','filename','sha256','admitted','refused','actor_name','at'],
 risks:['id','title','scenario','library_id','origin','import_id','source_label','owner_person_id','assets','treatment','review_due','created_at','updated_at'],
 risk_assessments:['id','risk_id','kind','method_revision','likelihood','impact','score','level','likelihood_label','impact_label','notes','actor_name','at'],
 risk_links:['risk_id','kind','target','added_at'],
 risk_treatments:['id','risk_id','title','owner_person_id','due_date','verification_test_id','status','evidence','updated_at'],
 risk_acceptances:['id','risk_id','assessment_id','rationale','approver_name','approved_by','approved_at','expires_at','escalated_at'],
 policies:['id','title','owner_person_id','created_at','updated_at'],
 policy_revisions:['id','policy_id','version','body','body_sha256','status','drafted_by','drafted_at','decided_by','decided_at','decision_note','approved_sha256','published_at','effective_date','review_due'],
 tracker_destinations:['id','provider','label','api_base','account','project','project_name','mapping_json','hook_audience','status','created_by','created_name','created_at','rotated_at','revoked_at','last_success_at','last_error'],
 tickets:['id','obligation_id','destination_id','remote_id','remote_key','remote_url','created_at','created_name','sync_state','sync_error','remote_status','remote_closed','remote_assignee','remote_due','synced_due','last_synced_at','last_attempt_at'],
 ticket_events:['id','ticket_id','kind','remote_value','local_value','detail','trigger','at'],
 ticket_comments:['ticket_id','remote_comment_id','direction','at'],
 tracker_deliveries:['destination_id','delivery_id','ticket_ref','outcome','received_at'],
 readiness_snapshots:['program_id','day','totals_json','taken_at'],
} as const
export type ProgramTable = keyof typeof programColumns
export const programTables = Object.keys(programColumns) as ProgramTable[]
// Tables first carried by archive version 4; a version 3 archive lists none of them.
const addedInVersion4 = new Set<ProgramTable>(['tracker_destinations', 'tickets', 'ticket_events', 'ticket_comments', 'tracker_deliveries', 'readiness_snapshots'])
const tablesOf = (version: number) => programTables.filter(t => version >= 4 || !addedInVersion4.has(t))
export interface ProgramArchive { rows: Record<ProgramTable, Row[]> }
export async function exportProgramArchive(env: Pick<Bindings, 'DB'>): Promise<ProgramArchive> {
 const results = await env.DB.batch(programTables.map(t => env.DB.prepare(`SELECT ${programColumns[t].join(',')} FROM ${t} ORDER BY rowid LIMIT 20001`)))
 return { rows: Object.fromEntries(programTables.map((t, i) => [t, results[i].results as Row[]])) as ProgramArchive['rows'] }
}
export const programRowCount = (value: ProgramArchive) => Object.values(value.rows).reduce((sum, rows) => sum + rows.length, 0)
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
export function validateProgramExtension(value: unknown, version: number): asserts value is ProgramArchive {
 const expected = tablesOf(version)
 if (!object(value) || Object.keys(value).join() !== 'rows' || !object(value.rows) || Object.keys(value.rows).length !== expected.length || expected.some(t => !Array.isArray((value.rows as Record<string, unknown>)[t]))) fail('Invalid program archive extension: every program table must be listed exactly.')
 let count = 0
 for (const table of expected) for (const row of (value.rows as Record<string, unknown[]>)[table]) {
  if (++count > 20000 || !object(row) || Object.keys(row).length !== programColumns[table].length || programColumns[table].some(c => !Object.hasOwn(row, c))) fail(`Invalid ${table} row in the program archive.`)
  for (const field of Object.values(row)) if (!(field === null || (typeof field === 'number' && Number.isFinite(field)) || (typeof field === 'string' && field.length <= 262144))) fail(`Invalid ${table} field in the program archive.`)
 }
}
// Restored grants hold no authority: tokens lack digests, and connections and
// ticket destinations wait without credentials until an owner reconnects them.
export function restoreProgramStatements(env: Pick<Bindings, 'DB'>, value: ProgramArchive) {
 return programTables.flatMap(table => (value.rows[table] ?? []).map(row => {
  const columns = [...programColumns[table]], values = columns.map(c => (table === 'connections' || table === 'tracker_destinations') && c === 'status' ? 'inactive after restore' : table === 'connections' && c === 'next_attempt_at' ? null : row[c])
  return env.DB.prepare(`INSERT INTO ${table}(${columns.join(',')}) VALUES(${columns.map(() => '?').join(',')})`).bind(...values)
 }))
}
