import { Refusal } from '../../upload'
import type { Json } from '../base/types'
import { parseJson, pick, problem, text, type Spec } from './check'
import { Rows } from './rows'
// Vanta Manage and Auditor API responses, one JSON file per page, as the documented envelope
// {"results":{"data":[...],"pageInfo":{...}}} (https://developer.vanta.com/api-reference/). Required fields,
// nullability and enums below are read from that reference (22 Oct 2026); the API has no access-review,
// answer-library or run-by-run test history resource.
const TASKS = ['COMPLETE', 'DUE_SOON', 'NONE', 'OFFBOARDING_COMPLETE', 'OFFBOARDING_DUE_SOON', 'OFFBOARDING_OVERDUE', 'OVERDUE', 'PAUSED']
const person: Spec = { id: 's', userId: 's?', emailAddress: 's', employment: 'o', leaveInfo: 'o?', groupIds: 'a', name: 'o', sources: 'o', tasksSummary: 'o' }
const employment: Spec = { status: ['UPCOMING', 'CURRENT', 'ON_LEAVE', 'INACTIVE', 'FORMER'], startDate: 'd', jobTitle: 's?', endDate: 'd?' }
const vendor: Spec = { id: 's', name: 's', websiteUrl: 's?', status: ['MANAGED', 'ARCHIVED', 'IN_PROCUREMENT'], inherentRiskLevel: ['CRITICAL', 'HIGH', 'LOW', 'MEDIUM', 'UNSCORED'], residualRiskLevel: ['CRITICAL', 'HIGH', 'LOW', 'MEDIUM', 'UNSCORED'], riskAttributeIds: 'a', authDetails: 'o', contractStartDate: 'd?', contractRenewalDate: 'd?', contractTerminationDate: 'd?', nextSecurityReviewDueDate: 'd?', lastSecurityReviewCompletionDate: 'd?' }
const test: Spec = { id: 's', name: 's', lastTestRunDate: 'd', latestFlipDate: 'd?', description: 's', failureDescription: 's', remediationDescription: 's', version: 'o', category: 's', integrations: 'a', status: ['OK', 'DEACTIVATED', 'NEEDS_ATTENTION', 'IN_PROGRESS', 'INVALID', 'NOT_APPLICABLE'], deactivatedStatusInfo: 'o', remediationStatusInfo: 'o', owner: 'o?' }
const entity: Spec = { id: 's', entityStatus: ['FAILING', 'DEACTIVATED'], displayName: 's', responseType: 's', deactivatedReason: 's?', lastUpdatedDate: 'd', createdDate: 'd' }
const policy: Spec = { id: 's', name: 's', description: 's', status: ['OK', 'NEEDS_REMEDIATION'], approvedAtDate: 'd?', latestVersion: 'o', latestApprovedVersion: 'o?' }
const control: Spec = { id: 's', externalId: 's?', name: 's', description: 's', source: ['Vanta', 'Custom'], domains: 'a', owner: 'o?', customFields: 'a', creationDate: 'd?', modificationDate: 'd?' }
const framework: Spec = { id: 's', displayName: 's', shorthandName: 's', description: 's', numControlsCompleted: 'n', numControlsTotal: 'n', numDocumentsPassing: 'n', numDocumentsTotal: 'n', numTestsPassing: 'n', numTestsTotal: 'n' }
const risk: Spec = { riskId: 's', description: 's', detailedDescription: 's?', likelihood: 'i?', impact: 'i?', residualLikelihood: 'i?', residualImpact: 'i?', categories: 'a', ciaCategories: 'a', treatment: ['Mitigate', 'Transfer', 'Avoid', 'Accept', null], owner: 's?', note: 's?', isArchived: 'b', reviewStatus: ['APPROVED', 'DRAFT', 'NOT_REVIEWED', 'AWAITING_SUBMISSION', 'PENDING_APPROVAL', 'REQUESTED_CHANGES'], requiredApprovers: 'a', type: ['Risk Scenario', 'Enterprise Risk'], identificationDate: 'd' }
const audit: Spec = { id: 's', customerOrganizationName: 's', auditStartDate: 'd', auditEndDate: 'd', displayName: 's', completionDate: 'd?', auditFocus: ['EXTERNAL', 'INTERNAL'], segments: 'a' }
const request: Spec = { id: 's', uniqueId: 's', linkedControlIds: 'a', approvalStatus: ['NEEDS_EVIDENCE', 'READY_FOR_AUDIT', 'AUDITOR_APPROVED', 'AUDITOR_FLAGGED'], cadence: ['ANNUALLY', 'BIANNUALLY', 'MONTHLY', 'QUARTERLY', null], description: 's?', dueDate: 'd?', requestType: ['POINT_IN_TIME', 'POPULATION', 'SAMPLE'], title: 's', creationDate: 'd', modificationDate: 'd', deletionDate: 'd?' }
const evidence: Spec = { id: 's', externalId: 's', status: ['Accepted', 'Flagged', 'Initialized', 'NA', 'Not ready for audit', 'Ready for audit'], name: 's', creationDate: 'd', statusUpdatedDate: 'd', evidenceType: ['Evidence Request', 'Policy', 'Test'], evidenceId: 's', relatedControls: 'a' }
const document: Spec = { id: 's', ownerId: 's?', category: 's', description: 's', isSensitive: 'b', title: 's', uploadStatus: ['Needs document', 'Needs update', 'Not relevant', 'OK'], uploadStatusDate: 'd?', url: 's?' }
const upload: Spec = { id: 's', fileName: 's?', title: 's', description: 's?', mimeType: 's', uploadedBy: 'o?', creationDate: 'd', updatedDate: 'd', deletionDate: 'd?', effectiveDate: 'd?', url: 's' }
type Page = { data: Record<string, unknown>[]; more: boolean }
function page(path: string, bytes: Uint8Array): Page {
 const json = parseJson(path, bytes) as any, r = json?.results, info = r?.pageInfo
 if (!r || !Array.isArray(r.data) || !info || typeof info.hasNextPage !== 'boolean' || !('endCursor' in info) || !('startCursor' in info) || !('hasPreviousPage' in info)) throw new Refusal(path + ' is not a Vanta API page: expected results.data and results.pageInfo.')
 if (r.data.length > 1000) throw new Refusal(path + ' holds more than 1,000 records.')
 return { data: r.data, more: info.hasNextPage }
}
const FILES = /^vanta\/(.+)\/page-(\d+)\.json$/
export function parseVanta(rows: Rows) {
 const pages = new Map<string, { path: string; page: Page }[]>()
 for (const [path, bytes] of rows.files) {
  const m = FILES.exec(path); if (!m) continue
  const list = pages.get(m[1]) ?? []; list.push({ path, page: page(path, bytes) }); pages.set(m[1], list)
 }
 for (const [dir, list] of pages) { list.sort((a, b) => a.path.localeCompare(b.path, 'en', { numeric: true })); if (list.at(-1)!.page.more) rows.warnings.push('vanta/' + dir + ' ends with hasNextPage=true: the export stops before the last page.') }
 const each = (re: RegExp, fn: (m: RegExpExecArray, record: Record<string, unknown>, path: string, index: number) => void) => { for (const [dir, list] of pages) { const m = re.exec(dir); if (m) for (const { path, page } of list) page.data.forEach((record, i) => fn(m, record, path, i)) } }
 const ref = (path: string, i: number) => path + '#' + i
 const idOf = (r: Record<string, unknown>, key = 'id') => typeof r[key] === 'string' && r[key] ? r[key] as string : 'row-' + Math.abs(hash(JSON.stringify(r)))
 const bad = (cls: any, type: string, r: Record<string, unknown>, path: string, i: number, spec: Spec, key = 'id') => { const p = problem(r, spec); if (p) { rows.refuse(cls, type, idOf(r, key), ref(path, i), 'Not a valid Vanta ' + type + ': ' + p + '.'); return true } return false }
 // People and identity (attestations are the accepted-policy lists of each person's tasks).
 each(/^people$/, (_, r, path, i) => {
  if (bad('people', 'person', r, path, i, person)) return
  const e = r.employment as Record<string, unknown>, ep = problem(e, employment), n = r.name as Record<string, unknown>
  if (ep || typeof n.display !== 'string' || !String(r.emailAddress).includes('@')) { rows.refuse('people', 'person', r.id as string, ref(path, i), 'Not a valid Vanta person: ' + (ep ?? 'name or email is unusable') + '.'); return }
  const t = r.tasksSummary as any
  rows.add('people', 'person', r.id as string, ref(path, i), { display_name: n.display, email: r.emailAddress, employment_status: e.status, start_date: e.startDate, end_date: e.endDate, job_title: e.jobTitle, on_leave: r.leaveInfo as Json, group_ids: r.groupIds as Json, task_status: t?.status ?? null, task_completion_date: t?.completionDate ?? null } as Json)
  for (const a of t?.details?.acceptPolicies?.acceptedPolicies ?? []) rows.add('policies', 'attestation', r.id + ':' + text(a?.name), ref(path, i), { person_id: r.id, person_email: r.emailAddress, policy_name: text(a?.name), accepted: true, task_completion_date: t.details.acceptPolicies.completionDate ?? null } as Json)
  for (const a of t?.details?.acceptPolicies?.unacceptedPolicies ?? []) rows.add('policies', 'attestation', r.id + ':' + text(a?.name), ref(path, i), { person_id: r.id, person_email: r.emailAddress, policy_name: text(a?.name), accepted: false, task_completion_date: null } as Json)
 })
 each(/^vendors$/, (_, r, path, i) => { if (!bad('vendors', 'vendor', r, path, i, vendor)) rows.add('vendors', 'vendor', r.id as string, ref(path, i), pick(r, ['name', 'websiteUrl', 'status', 'inherentRiskLevel', 'residualRiskLevel', 'servicesProvided', 'contractStartDate', 'contractRenewalDate', 'contractTerminationDate', 'nextSecurityReviewDueDate', 'lastSecurityReviewCompletionDate', 'securityOwnerUserId', 'businessOwnerUserId', 'latestDecision']) ) })
 each(/^risk-scenarios$/, (_, r, path, i) => { if (!bad('risks', 'risk', r, path, i, risk, 'riskId')) rows.add('risks', 'risk', r.riskId as string, ref(path, i), pick(r, ['description', 'detailedDescription', 'likelihood', 'impact', 'residualLikelihood', 'residualImpact', 'categories', 'ciaCategories', 'treatment', 'owner', 'note', 'isArchived', 'reviewStatus', 'type', 'identificationDate'])) })
 each(/^policies$/, (_, r, path, i) => { if (!bad('policies', 'policy', r, path, i, policy)) rows.add('policies', 'policy', r.id as string, ref(path, i), pick(r, ['name', 'description', 'status', 'approvedAtDate', 'latestVersion', 'latestApprovedVersion'])) })
 // Frameworks, controls and their mappings.
 each(/^frameworks$/, (_, r, path, i) => { if (!bad('frameworks_controls', 'framework', r, path, i, framework)) rows.add('frameworks_controls', 'framework', r.id as string, ref(path, i), pick(r, ['displayName', 'shorthandName', 'description', 'status', 'numControlsTotal', 'numControlsCompleted', 'numTestsTotal', 'numTestsPassing'])) })
 each(/^controls$/, (_, r, path, i) => { if (!bad('frameworks_controls', 'control', r, path, i, control)) rows.add('frameworks_controls', 'control', r.id as string, ref(path, i), pick(r, ['externalId', 'name', 'description', 'source', 'domains', 'owner', 'creationDate', 'modificationDate', 'implementationDetails'])) })
 const mapped = (left: string, right: string, rightClass: ClassIdAlias, rightType: string, spec: Spec) => (m: RegExpExecArray, r: Record<string, unknown>, path: string, i: number) => {
  const id = m[1] + '>' + idOf(r)
  if (problem(r, spec)) rows.refuse('frameworks_controls', 'mapping', id, ref(path, i), 'Mapped ' + rightType + ' is not a valid Vanta record.')
  else rows.add('frameworks_controls', 'mapping', id, ref(path, i), { [left + '_id']: m[1], [right + '_id']: r.id as string, relation: left + '-' + right } as Json)
 }
 each(/^frameworks\/([^/]+)\/controls$/, mapped('framework', 'control', 'frameworks_controls', 'control', control))
 each(/^controls\/([^/]+)\/tests$/, mapped('control', 'test', 'test_history', 'test', test))
 each(/^controls\/([^/]+)\/documents$/, mapped('control', 'document', 'exhibits', 'document', document))
 // Test history: the latest run state Vanta exposes, and the failing or deactivated entities with first-detected dates.
 each(/^tests$/, (_, r, path, i) => { if (!bad('test_history', 'test', r, path, i, test)) rows.add('test_history', 'test', r.id as string, ref(path, i), pick(r, ['name', 'category', 'status', 'lastTestRunDate', 'latestFlipDate', 'version', 'integrations', 'remediationStatusInfo', 'deactivatedStatusInfo', 'owner', 'description', 'failureDescription'])) })
 each(/^tests\/([^/]+)\/entities$/, (m, r, path, i) => { if (!bad('test_history', 'entity', r, path, i, entity)) rows.add('test_history', 'entity', m[1] + '/' + r.id, ref(path, i), { test_id: m[1], ...(pick(r, ['entityStatus', 'displayName', 'responseType', 'deactivatedReason', 'lastUpdatedDate', 'createdDate']) as object) } as Json) })
 // Audits (periods are provenance), information requests and audit evidence.
 each(/^audits$/, (_, r, path, i) => { if (!bad('audit_requests', 'audit', r, path, i, audit)) rows.add('audit_requests', 'audit', r.id as string, ref(path, i), pick(r, ['customerOrganizationName', 'displayName', 'auditStartDate', 'auditEndDate', 'completionDate', 'auditFocus', 'auditView', 'segments'])) })
 each(/^audits\/([^/]+)\/information-requests$/, (m, r, path, i) => { if (!bad('audit_requests', 'information_request', r, path, i, request)) rows.add('audit_requests', 'information_request', m[1] + '/' + r.id, ref(path, i), { audit_id: m[1], ...(pick(r, ['uniqueId', 'title', 'description', 'requestType', 'approvalStatus', 'cadence', 'dueDate', 'linkedControlIds', 'creationDate', 'modificationDate', 'deletionDate', 'ownerAssignment']) as object) } as Json) })
 each(/^audits\/([^/]+)\/evidence$/, (m, r, path, i) => { if (!bad('audit_requests', 'audit_evidence', r, path, i, evidence)) rows.add('audit_requests', 'audit_evidence', m[1] + '/' + r.id, ref(path, i), { audit_id: m[1], ...(pick(r, ['externalId', 'name', 'status', 'evidenceType', 'evidenceId', 'relatedControls', 'creationDate', 'statusUpdatedDate', 'deletionDate']) as object) } as Json) })
 // Exhibits: documents, and the uploaded files whose bytes are in the ZIP at documents/<id>/files/<upload id>.
 const withUploads = new Set<string>()
 each(/^documents\/([^/]+)\/uploads$/, (m, r, path, i) => {
  if (problem(r, upload)) { rows.refuse('exhibits', 'upload', m[1] + '/' + idOf(r), ref(path, i), 'Not a valid Vanta uploaded file: ' + problem(r, upload) + '.'); return }
  withUploads.add(m[1])
  const id = m[1] + '/' + r.id, fields = pick(r, ['fileName', 'title', 'description', 'mimeType', 'uploadedBy', 'creationDate', 'updatedDate', 'deletionDate', 'effectiveDate']) as object
  if (r.deletionDate) { rows.add('exhibits', 'upload', id, ref(path, i), { document_id: m[1], ...fields } as Json, 'unsupported', 'Deleted in Vanta before this export; Evidence does not restore deleted evidence.'); return }
  const file = rows.bytes('vanta/documents/' + m[1] + '/files/' + r.id, (r.fileName as string | null) ?? String(r.title))
  if (!file) rows.add('exhibits', 'upload', id, ref(path, i), { document_id: m[1], ...fields } as Json, 'refused', 'The file bytes are not in the ZIP (vanta/documents/' + m[1] + '/files/' + r.id + '); download them with Vanta\'s "Download file for document" and add them.')
  else rows.add('exhibits', 'upload', id, ref(path, i), { document_id: m[1], ...fields } as Json, 'admit', undefined, file)
 })
 each(/^documents$/, (_, r, path, i) => {
  if (bad('exhibits', 'document', r, path, i, document)) return
  const fields = pick(r, ['title', 'category', 'description', 'uploadStatus', 'uploadStatusDate', 'isSensitive'])
  if (r.uploadStatus === 'Needs document' && !withUploads.has(r.id as string)) rows.add('exhibits', 'document', r.id as string, ref(path, i), fields, 'unsupported', 'Vanta holds no file for this document (uploadStatus Needs document); there is nothing to carry over.')
  else rows.add('exhibits', 'document', r.id as string, ref(path, i), fields)
 })
 // Cross-references that cannot resolve inside the export are refused, never guessed.
 for (const row of rows.rows) {
  if (row.type === 'mapping' && row.verdict === 'admit') {
   const f = row.fields as Record<string, string>
   const sides: [string | undefined, string, string][] = [[f.framework_id, 'frameworks_controls', 'framework'], [f.control_id, 'frameworks_controls', 'control'], [f.test_id, 'test_history', 'test'], [f.document_id, 'exhibits', 'document']]
   for (const [id, cls, type] of sides) if (id && !rows.has(cls as any, type, id)) { row.verdict = 'refused'; row.reason = 'Mapping refers to ' + type + ' ' + id + ', which is not in this export.' }
  }
  if (row.type === 'entity' && row.verdict === 'admit' && !rows.has('test_history', 'test', (row.fields as any).test_id)) { row.verdict = 'refused'; row.reason = 'Entity belongs to test ' + (row.fields as any).test_id + ', which is not in this export.' }
 }
 rows.absent.push(
  { class: 'frameworks_controls', what: 'Per-requirement mappings (framework requirement ids): the Vanta controls list carries none', route: 'Create a framework controls export in Vanta (API "Create framework controls export") and add the requirement ids, or map requirements in Evidence.' },
  { class: 'test_history', what: 'Run-by-run test results: Vanta returns only the latest run date and flip date per test', route: 'Keep Vanta\'s own test export as an original exhibit; fresh observations begin when the source is connected here.' },
  { class: 'policies', what: 'Policy version history, approvers and policy files (documents are links into Vanta)', route: 'Download the approved policy files from Vanta and upload them under Policies; approvals are recorded here by a named approver.' },
  { class: 'access_reviews', what: 'Access-review decisions: the Vanta API has no access-review resource', route: 'Export the review evidence from Vanta and attach it as an original exhibit, or run the review in Evidence.' },
  { class: 'trust_answers', what: 'Trust Center content and the answer library: not in the Manage Vanta or Auditor API reference', route: 'Export the answers from Vanta Questionnaire Automation as a workbook and upload it under Questionnaires; answers arrive labeled imported and unverified.' },
 )
}
type ClassIdAlias = import('./classes').ClassId
function hash(s: string) { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0; return h }
