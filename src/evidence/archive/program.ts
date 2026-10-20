import { frameworkFiles, validateFrameworkFiles } from './frameworks'
import { populationFiles, retestFiles, validatePopulationFiles, validateRetestFiles, type PopulationFile } from './populations'
import { retainDefaultMethod } from '../risk/method-default'
import type { Bindings } from '../../auth.server'
import { fail, MAX_METADATA, type Row } from './format'
// Archive version 3 carries every program-domain table, in foreign-key order.
// Credentials never travel: token digests and connection secrets are left out,
// so restored API tokens cannot authenticate and restored connections stay
// inactive until an owner reconnects them. Rate counters are transient.
export const programColumns = {
 people:['id','name','email','kind','created_at','created_by','role'],
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
 followups:['id','kind','subject_id','cycle_key','recipient','state','detail','created_at','attempted_at','channel'],
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
 connections:['id','provider','label','account','api_base','granted_scopes','status','created_by','created_name','created_at','rotated_at','revoked_at','last_success_at','last_attempt_at','next_attempt_at','backoff_seconds','last_error','config_json'],
 connection_repositories:['connection_id','full_name','selected'],
 collection_runs:['id','connection_id','trigger','connector_revision','started_at','finished_at','outcome','coverage_json','error_code'],
 risk_methods:['id','revision','scale','likelihood_labels','impact_labels','formula','matrix_json','thresholds_json','actor_name','at','likelihood_definitions','impact_definitions'],
 vendors:['id','name','owner_person_id','data_access','criticality','review_due','created_at','updated_at'],
 risk_imports:['id','filename','sha256','admitted','refused','actor_name','at'],
 risks:['id','title','scenario','library_id','origin','import_id','source_label','owner_person_id','assets','treatment','review_due','created_at','updated_at','library_revision'],
 risk_assessments:['id','risk_id','kind','method_revision','likelihood','impact','score','level','likelihood_label','impact_label','notes','actor_name','at'],
 risk_links:['risk_id','kind','target','added_at'],
 risk_treatments:['id','risk_id','title','owner_person_id','due_date','verification_test_id','status','evidence','updated_at'],
 risk_acceptances:['id','risk_id','assessment_id','rationale','approver_name','approved_by','approved_at','expires_at','escalated_at'],
 policies:['id','title','owner_person_id','created_at','updated_at','template_id'],
 policy_revisions:['id','policy_id','version','body','body_sha256','status','drafted_by','drafted_at','decided_by','decided_at','decision_note','approved_sha256','published_at','effective_date','review_due'],
 tracker_destinations:['id','provider','label','api_base','account','project','project_name','mapping_json','hook_audience','status','created_by','created_name','created_at','rotated_at','revoked_at','last_success_at','last_error'],
 tickets:['id','obligation_id','destination_id','remote_id','remote_key','remote_url','created_at','created_name','sync_state','sync_error','remote_status','remote_closed','remote_assignee','remote_due','synced_due','last_synced_at','last_attempt_at','group_id'],
 ticket_events:['id','ticket_id','kind','remote_value','local_value','detail','trigger','at'],
 ticket_comments:['ticket_id','remote_comment_id','direction','at'],
 tracker_deliveries:['destination_id','delivery_id','ticket_ref','outcome','received_at'],
 readiness_snapshots:['program_id','day','totals_json','taken_at'],
 followup_settings:['singleton','timezone','calendar_enabled','business_days','holidays','quiet_start','quiet_end','digest_enabled','digest_day','digest_time','repeat_days','escalate_after_days','escalation_person_id','updated_by','updated_at'],
 followup_channels:['id','kind','label','account','target','status','created_by','created_name','created_at','rotated_at','revoked_at','last_success_at','last_error'],
 notify_preferences:['person_id','via','all_clear','updated_by','updated_at'],
 followup_pauses:['id','subject_id','reason','paused_by','paused_at','resumed_by','resumed_at'],
 identity_matches:['resource_id','person_id','state','basis','proposed_at','decided_by','decided_at','reason'],
 policy_assignments:['id','policy_id','revision_id','person_id','assigned_by','assigned_at','due_date','state','closed_at'],
 policy_acknowledgments:['id','assignment_id','person_id','operator_id','operator_email','revision_id','version','body_sha256','acknowledged_at'],
 policy_exceptions:['id','policy_id','person_id','reason','approved_by','approved_at','expires_at'],
 people_departures:['person_id','departed_at','recorded_by','reason','access_outcome'],
 review_schedules:['id','subject_kind','subject_id','cadence','anchor','fiscal_start_month','window_start','program_id','reminder_lead_days','owner_person_id','effective_from','actor_id','actor_name','reason'],
 review_completions:['id','subject_kind','subject_id','completed_on','notes','recorded_by','recorded_at'],
 review_overrides:['id','subject_kind','subject_id','cycle_due','due_date','reason','actor_name','at'],
 population_uploads:['id','kind','source_system','as_of','refresh_days','filename','sha256','size','object_key','mapping_json','uploaded_by','uploaded_name','uploaded_at','row_count','previous_id'],
 population_rows:['id','upload_id','row_number','row_key','attributes_json'],
 population_matches:['row_id','person_id','state','basis','candidates_json','decided_by','decided_at'],
 access_reviews:['id','name','cadence','period_from','period_to','due_date','sources_json','reviewers_json','created_by','created_name','created_at','completed_at','previous_id'],
 access_review_items:['id','review_id','source','source_label','provenance','subject_ref','account_key','display_name','attributes_json','reviewer_person_id','supplemental','added_at'],
 access_decisions:['id','item_id','decision','reason','decided_by_person','decided_by_name','decided_by_email','at'],
 access_delegations:['item_id','to_person_id','reason','by_name','at'],
 access_revocations:['item_id','state','requested_at','checked_at','verified_at','evidence'],
 training_adoptions:['course_id','revision','adopted_by','adopted_at'],
 training_campaigns:['id','name','course_id','kind','audience','due_days','interval_months','created_by','created_name','created_at'],
 training_schedule_changes:['id','campaign_id','due_days','interval_months','reason','actor_name','at'],
 training_assignments:['id','campaign_id','course_id','revision','person_id','cycle','assigned_at','due_date','state','completed_at','completion_id'],
 training_attempts:['id','person_id','course_id','revision','answers_json','score','passed','operator_email','at'],
 internal_courses:['id','title','description','counts_as','approved_by','approved_at'],
 training_completions:['id','person_id','course_id','course_title','revision','source','provenance','score','attempt_id','external_ref','recorded_by','completed_at','recorded_at'],
 ticket_settings:['test_id','destination_id','granularity','auto_create','follow_up','updated_by','updated_at'],
 ticket_defaults:['singleton','destination_id','granularity','auto_create','follow_up','updated_by','updated_at'],
 ticket_groups:['id','test_id','destination_id','remote_id','remote_key','remote_url','created_at','created_name','state','item_list','handled_close_at','due_written'],
 handover_events:['id','person_id','kind','item_id','role','label','to_person_id','reason','bulk','actor_id','actor_name','at'],
 handover_settings:['singleton','window_days','updated_by','updated_at'],
 vuln_imports:['id','requirement_id','receipt_id','tester','report_date','report_filename','report_sha256','table_filename','table_sha256','mapping_json','admitted','refused','imported_by','imported_name','imported_at'],
 vuln_findings:['id','import_id','row_number','title','severity','asset','resource_id','description','cve','cwe','tester','report_date','recommended_fix','sla_days','sla_policy_id','due_date','state','marked_fixed_at','closed_at','closure_basis','closed_by'],
 vuln_documents:['id','finding_id','filename','sha256','size','object_key','uploaded_by','uploaded_name','uploaded_at','decision','decided_by','decided_name','decided_at','decision_note'],
 vuln_events:['id','finding_id','kind','body','document_id','actor_id','actor_name','at'],
 control_revisions:['id','control_id','revision','name','group_name','applicability','test_intent','evaluation_criteria','actor_id','actor_name','reason','effective_at'],
 requirement_revisions:['id','requirement_id','revision','name','actor_id','actor_name','reason','effective_at'],
 run_control_definitions:['run_id','control_id','control_revision','snapshot_json'],
 custom_frameworks:['id','name','revision','created_at'],
 custom_framework_requirements:['id','framework_id','ref','title','description','section','removed_at','created_at'],
 custom_framework_revisions:['id','framework_id','revision','snapshot_json','diff_json','actor_id','actor_name','at','reason','object_key','filename','size','media_type','sha256'],
 custom_framework_mappings:['id','requirement_id','control_id','decision','origin','actor_id','actor_name','at','reason','framework_revision'],
 inventory_decisions:['id','source_key','canonical_key','revision','owner_person_id','criticality','scope','lifecycle','reason','actor_id','actor_name','at'],
 inventory_group_events:['id','operation_id','source_key','canonical_key','previous_canonical_key','revision','action','reason','actor_id','actor_name','at'],
} as const
// LIBRARY-001 tables, carried by the v10 portable archive only. Archives that
// predate them restore their runs as evaluated under library revision 1.
export const libraryColumns = {
 library_acceptances:['id','revision','from_revision','changes_json','actor_id','actor_name','reason','at'],
 run_library_revisions:['run_id','library_revision'],
} as const
export const libraryTables = Object.keys(libraryColumns)
export const backfillRunLibraryRevisions = (env: Pick<Bindings, 'DB'>) => env.DB.prepare('INSERT INTO run_library_revisions(run_id,library_revision) SELECT id,1 FROM test_runs WHERE id NOT IN (SELECT run_id FROM run_library_revisions)')
export type ProgramTable = keyof typeof programColumns
export const programTables = Object.keys(programColumns) as ProgramTable[]
// Tables first carried by archive version 4; a version 3 archive lists none of them.
const addedInVersion4 = new Set<ProgramTable>(['tracker_destinations', 'tickets', 'ticket_events', 'ticket_comments', 'tracker_deliveries', 'readiness_snapshots', 'followup_settings', 'followup_channels', 'notify_preferences', 'followup_pauses', 'identity_matches', 'policy_assignments', 'policy_acknowledgments', 'policy_exceptions', 'people_departures', 'review_schedules', 'review_completions', 'review_overrides', 'population_uploads', 'population_rows', 'population_matches', 'access_reviews', 'access_review_items', 'access_decisions', 'access_delegations', 'access_revocations', 'training_adoptions', 'training_campaigns', 'training_schedule_changes', 'training_assignments', 'training_attempts', 'internal_courses', 'training_completions', 'ticket_settings', 'ticket_defaults', 'ticket_groups'])
// Columns first carried by version 4 in tables that version 3 already listed, with the value older rows restore with.
const addedColumns: Partial<Record<ProgramTable, Record<string, string | null>>> = { followups: { channel: 'email' }, connections: { config_json: '{}' }, policies: { template_id: null }, people: { role: null }, tickets: { group_id: null } }
const addedInVersion5: Partial<Record<ProgramTable, Record<string, string | null>>> = { risk_methods: { likelihood_definitions: '[]', impact_definitions: '[]' }, risks: { library_revision: null } }
const columnsOf = (table: ProgramTable, version: number) => programColumns[table].filter(c => (version >= 4 || !Object.hasOwn(addedColumns[table] ?? {}, c)) && (version >= 5 || !Object.hasOwn(addedInVersion5[table] ?? {}, c)))
// Tables first carried by archive version 7 (LIFECYCLE-002 handover history and window).
const addedInVersion7 = new Set<ProgramTable>(['handover_events', 'handover_settings'])
// Tables first carried by archive version 8 (VULN-002 penetration-test findings and retest letters).
const addedInVersion8 = new Set<ProgramTable>(['vuln_imports', 'vuln_findings', 'vuln_documents', 'vuln_events'])
const addedInVersion9 = new Set<ProgramTable>(['control_revisions', 'requirement_revisions', 'run_control_definitions', 'custom_frameworks', 'custom_framework_requirements', 'custom_framework_revisions', 'custom_framework_mappings'])
const tablesOf = (version: number) => programTables.filter(t => !['inventory_decisions','inventory_group_events'].includes(t) && (version >= 4 || !addedInVersion4.has(t)) && (version >= 7 || !addedInVersion7.has(t)) && (version >= 8 || !addedInVersion8.has(t)) && (version >= 9 || !addedInVersion9.has(t)))
export interface ProgramArchive { rows: Record<ProgramTable, Row[]>; files?: PopulationFile[] }
export async function exportProgramArchive(env: Pick<Bindings, 'DB' | 'EXHIBITS'>): Promise<ProgramArchive> {
 const results = await env.DB.batch(programTables.map(t => env.DB.prepare(`SELECT ${programColumns[t].join(',')} FROM ${t} ORDER BY rowid LIMIT 20001`)))
 const rows = Object.fromEntries(programTables.map((t, i) => [t, results[i].results as Row[]])) as ProgramArchive['rows']
 return { rows, files: [...await populationFiles(env, rows.population_uploads), ...await retestFiles(env, rows.vuln_documents), ...await frameworkFiles(env, rows.custom_framework_revisions)] }
}
export const programRowCount = (value: ProgramArchive) => Object.values(value.rows).reduce((sum, rows) => sum + rows.length, 0)
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
export function validateProgramExtension(value: unknown, version: number): asserts value is ProgramArchive {
 const expected = tablesOf(version)
 if (!object(value) || Object.keys(value).sort().join() !== (version >= 6 ? 'files,rows' : 'rows') || !object(value.rows) || Object.keys(value.rows).length !== expected.length || expected.some(t => !Array.isArray((value.rows as Record<string, unknown>)[t]))) fail('Invalid program archive extension: every program table must be listed exactly.')
 let count = 0
 for (const table of expected) for (const row of (value.rows as Record<string, unknown[]>)[table]) {
  const columns = columnsOf(table, version)
  if (++count > 20000 || !object(row) || Object.keys(row).length !== columns.length || columns.some(c => !Object.hasOwn(row, c))) fail(`Invalid ${table} row in the program archive.`)
  for (const [column, field] of Object.entries(row)) {
   // A retained report includes its whole source denominator; it shares the
   // existing complete-manifest bound rather than an ordinary text-field cap.
   const bound = table === 'readiness_snapshots' && column === 'totals_json' ? MAX_METADATA : 262144
   if (!(field === null || (typeof field === 'number' && Number.isFinite(field)) || (typeof field === 'string' && field.length <= bound))) fail(`Invalid ${table} field in the program archive.`)
  }
 }
 if (version >= 6) {
  const files = Array.isArray(value.files) ? value.files as { path?: unknown }[] : null, framework = (f: {path?:unknown}) => typeof f?.path === 'string' && f.path.startsWith('framework-originals/'), retest = (f: { path?: unknown }) => typeof f?.path === 'string' && f.path.startsWith('vulns/')
  validatePopulationFiles(files?.filter(f => !retest(f) && !framework(f)), (value.rows as ProgramArchive['rows']).population_uploads)
  validateRetestFiles(files?.filter(retest), version >= 8 ? (value.rows as ProgramArchive['rows']).vuln_documents : [])
  validateFrameworkFiles(files?.filter(framework), version >= 9 ? (value.rows as ProgramArchive['rows']).custom_framework_revisions : [])
 }
}
// Restored grants hold no authority: tokens lack digests, and connections and
// ticket destinations and Slack or Teams channels wait without credentials
// until an owner reconnects them.
export function restoreProgramStatements(env: Pick<Bindings, 'DB'>, value: ProgramArchive, version: number) {
 const legacyDefault = version < 5 && !(value.rows.risk_methods ?? []).length && (value.rows.risk_assessments ?? []).some(a => a.method_revision === 1)
 return [...(legacyDefault ? [retainDefaultMethod(env, false)] : []), ...programTables.flatMap(table => (value.rows[table] ?? []).map(row => {
  const columns = [...programColumns[table]], values = columns.map(c => (table === 'connections' || table === 'tracker_destinations' || table === 'followup_channels') && c === 'status' ? 'inactive after restore' : table === 'connections' && c === 'next_attempt_at' ? null : Object.hasOwn(row, c) ? row[c] : addedColumns[table]?.[c] ?? addedInVersion5[table]?.[c] ?? null)
  return env.DB.prepare(`INSERT INTO ${table}(${columns.join(',')}) VALUES(${columns.map(() => '?').join(',')})`).bind(...values)
 })), backfillRunLibraryRevisions(env)]
}
