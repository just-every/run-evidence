import { Refusal } from '../../upload'
import type { Json } from '../base/types'
import { parseJson, pick, problem, type Spec } from './check'
import type { ClassId } from './classes'
import { Rows } from './rows'
// Secureframe API list responses (https://api.secureframe.com/docs, dated version 2023-10-18), one JSON file per page:
// {"data":[{"id","type","attributes","relationships","links"}],"meta":{"total"}}. The reference marks no attribute
// required, so each resource needs only its identity attribute; enums are the documented ones. The API has no
// audit-request resource, no run-by-run test history, no per-person policy acceptance and no evidence file download.
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const specs: Record<string, Spec> = {
 controls: { key: 's', name: 's' }, frameworks: { key: 's', title: 's' }, framework_requirements: { key: 's', name: 's' },
 tests: { key: 's', title: 's', test_type: ['upload', 'integration', 'platform'], pass: 'b' }, users: { email: 's', name: 's', employee_type: ['contractor', 'employee', 'non_employee', 'auditor'] },
 'tprm/vendors': { name: 's', vendor_status: ['accepted', 'rejected', 'pending'] }, risks: { description: 's', status: 's' }, policies: { name: 's', status: 's' },
 evidences: { evidence_type: 's' }, tasks: { title: 's', taskable_type: ['CompanyTest', 'CompanyRisk', 'UserAccessReviewAccount', 'VendorRiskDetail'] },
 knowledge_base_questions: { content: 's' }, knowledge_base_answers: { content: 's', type: ['KnowledgeBaseAnswerFreeForm', 'KnowledgeBaseAnswerYesOrNo', 'KnowledgeBaseAnswerTrueOrFalse'] },
 trust_center_requests: { company_name: 's', email: 's', document_security: ['clickwrap', 'external', 'waived'] },
}
type Row = { id: string; attributes: Record<string, unknown>; relationships?: unknown }
function page(path: string, bytes: Uint8Array): Row[] {
 const json = parseJson(path, bytes) as any
 if (!json || !Array.isArray(json.data) || json.data.length > 1000) throw new Refusal(path + ' is not a Secureframe API page: expected a data array.')
 return json.data
}
const FILES = /^secureframe\/(.+)\/page-(\d+)\.json$/
export function parseSecureframe(rows: Rows) {
 const pages = new Map<string, { path: string; data: Row[] }[]>()
 for (const [path, bytes] of rows.files) {
  const m = FILES.exec(path); if (!m) continue
  if (!Object.hasOwn(specs, m[1])) { rows.warnings.push(path + ' is not a Secureframe resource Evidence reads; retained in the ZIP only.'); continue }
  const list = pages.get(m[1]) ?? []; list.push({ path, data: page(path, bytes) }); pages.set(m[1], list)
 }
 const each = (dir: string, cls: ClassId, type: string, fields: string[], fn?: (row: Row, ref: string) => void) => {
  for (const { path, data } of (pages.get(dir) ?? []).sort((a, b) => a.path.localeCompare(b.path, 'en', { numeric: true }))) data.forEach((row, i) => {
   const ref = path + '#' + i, id = row && typeof row.id === 'string' ? row.id : ''
   if (!uuid.test(id) || !row.attributes || typeof row.attributes !== 'object') { rows.refuse(cls, type, id || 'row-' + ref, ref, 'Not a valid Secureframe ' + type + ': it has no uuid id and attributes object.'); return }
   const p = problem(row.attributes, specs[dir]); if (p) { rows.refuse(cls, type, id, ref, 'Not a valid Secureframe ' + type + ': ' + p + '.'); return }
   if (fn) fn(row, ref); else rows.add(cls, type, id, ref, pick(row.attributes, fields))
  })
 }
 each('frameworks', 'frameworks_controls', 'framework', ['key', 'title', 'description', 'applicable_controls_count', 'applicable_framework_requirements_count', 'discarded_at', 'created_at', 'updated_at'])
 each('framework_requirements', 'frameworks_controls', 'requirement', ['key', 'name', 'description', 'framework_id', 'enabled', 'health_status', 'created_at', 'updated_at'])
 each('controls', 'frameworks_controls', 'control', ['key', 'name', 'description', 'owner_name', 'enabled', 'custom', 'health_status', 'implementation_status', 'implementation_date', 'framework_keys', 'created_at', 'updated_at'], (row, ref) => {
  const a = row.attributes
  rows.add('frameworks_controls', 'control', row.id, ref, pick(a, ['key', 'name', 'description', 'owner_name', 'enabled', 'custom', 'health_status', 'implementation_status', 'implementation_date', 'framework_keys', 'created_at', 'updated_at']))
  for (const requirement of Array.isArray(a.framework_requirement_keys) ? a.framework_requirement_keys : []) rows.add('frameworks_controls', 'mapping', a.key + '>' + requirement, ref, { control_key: a.key, requirement_key: requirement, relation: 'control-requirement' } as Json)
 })
 each('tests', 'test_history', 'test', ['key', 'title', 'description', 'health_status', 'pass', 'test_type', 'last_evaluated', 'last_passed_at', 'first_failed_at', 'next_due_date', 'control_keys', 'framework_keys', 'created_at', 'updated_at'], (row, ref) => {
  const a = row.attributes
  rows.add('test_history', 'test', row.id, ref, pick(a, ['key', 'title', 'description', 'health_status', 'pass', 'test_type', 'last_evaluated', 'last_passed_at', 'first_failed_at', 'next_due_date', 'control_keys', 'framework_keys', 'created_at', 'updated_at']))
  for (const control of Array.isArray(a.control_keys) ? a.control_keys : []) rows.add('frameworks_controls', 'mapping', control + '>test:' + a.key, ref, { control_key: control, test_key: a.key, relation: 'control-test' } as Json)
 })
 each('users', 'people', 'person', ['name', 'email', 'employee_type', 'title', 'start_date', 'end_date', 'active', 'personnel_status', 'role', 'access_role', 'manager_name', 'created_at', 'updated_at'])
 each('tprm/vendors', 'vendors', 'vendor', ['name', 'website', 'vendor_status', 'risk_level', 'services_provided', 'data_collected', 'authentication_type', 'two_factor_enabled', 'last_reviewed_at', 'archived', 'archived_at', 'created_at', 'updated_at'])
 each('risks', 'risks', 'risk', ['custom_risk_id', 'description', 'status', 'treatment', 'categories', 'cia', 'owner_id', 'responsible_team', 'notes', 'source', 'created_at', 'updated_at'])
 each('policies', 'policies', 'policy', ['name', 'status', 'published_at', 'acceptances_count', 'eligible_company_users_count', 'acceptance_rate', 'acceptance_status', 'framework_names', 'owner_id', 'parent_policy_id', 'created_at', 'updated_at'])
 each('tasks', 'access_reviews', 'task', ['title', 'category', 'task_type', 'task_subtype', 'taskable_type', 'taskable_id', 'owner_id', 'due_at', 'completed_at', 'dismissed_at', 'overdue', 'created_at'], (row, ref) => {
  const fields = pick(row.attributes, ['title', 'category', 'task_type', 'task_subtype', 'taskable_type', 'taskable_id', 'owner_id', 'due_at', 'completed_at', 'dismissed_at', 'overdue', 'created_at'])
  if (row.attributes.taskable_type === 'UserAccessReviewAccount') rows.add('access_reviews', 'task', row.id, ref, fields)
  else rows.add('access_reviews', 'task', row.id, ref, fields, 'unsupported', 'A ' + row.attributes.taskable_type + ' remediation task, not an access-review item; Evidence follows remediation in its own obligations and trackers.')
 })
 each('knowledge_base_questions', 'trust_answers', 'question', ['content', 'review_frequency', 'reviewed_at', 'manual_review_requested', 'created_at', 'updated_at'])
 each('knowledge_base_answers', 'trust_answers', 'answer', ['content', 'type', 'primary_answer', 'created_at', 'updated_at'])
 each('trust_center_requests', 'trust_answers', 'trust_request', ['company_name', 'requester_name', 'job_title', 'email', 'reason', 'document_security', 'resources', 'reviewed', 'created_at'])
 each('evidences', 'exhibits', 'evidence', ['evidence_type', 'accepted', 'activity_completion', 'document_id', 'evidenceable_type', 'evidenceable_id', 'created_at', 'updated_at'], (row, ref) => {
  const fields = pick(row.attributes, ['evidence_type', 'accepted', 'activity_completion', 'document_id', 'evidenceable_type', 'evidenceable_id', 'created_at', 'updated_at']), file = rows.bytes('secureframe/files/' + row.id, row.id)
  if (file) rows.add('exhibits', 'evidence', row.id, ref, fields, 'admit', undefined, file)
  else rows.add('exhibits', 'evidence', row.id, ref, fields, 'unsupported', 'Secureframe\'s API returns evidence metadata only, with no file download; add the bytes at secureframe/files/' + row.id + ' from Secureframe\'s evidence download.')
 })
 // Requirement and control keys that do not resolve inside the export are refused, never guessed.
 const keys = (type: string) => new Set(rows.rows.filter(r => r.type === type && r.verdict === 'admit').map(r => (r.fields as any).key))
 const requirements = keys('requirement'), controls = keys('control'), tests = keys('test')
 for (const row of rows.rows) if (row.type === 'mapping' && row.verdict === 'admit') {
  const f = row.fields as Record<string, string>
  if (f.requirement_key && !requirements.has(f.requirement_key)) { row.verdict = 'refused'; row.reason = 'Mapping refers to requirement ' + f.requirement_key + ', which is not in this export.' }
  if (f.test_key && !tests.has(f.test_key)) { row.verdict = 'refused'; row.reason = 'Mapping refers to test ' + f.test_key + ', which is not in this export.' }
  if (f.control_key && !controls.has(f.control_key)) { row.verdict = 'refused'; row.reason = 'Mapping refers to control ' + f.control_key + ', which is not in this export.' }
 }
 rows.absent.push(
  { class: 'test_history', what: 'Run-by-run test results: Secureframe returns the latest evaluation, last pass and first failure per test', route: 'Run a Secureframe test export (API "test exports") and keep it as an original exhibit; fresh observations begin when the source is connected here.' },
  { class: 'policies', what: 'Policy version history, approvals and per-person acceptances (counts only)', route: 'Download the published policies from Secureframe and upload them under Policies; staff attest here.' },
  { class: 'access_reviews', what: 'Access-review outcomes (keep or revoke): tasks record that a review item was completed, not its decision', route: 'Export the review results from Secureframe and attach them as an original exhibit, or run the review in Evidence.' },
  { class: 'audit_requests', what: 'Audit requests: the Secureframe API has no audit or request-list resource', route: 'Export the request list from the Secureframe audit hub and recreate the requests under Reviews.' },
 )
}
