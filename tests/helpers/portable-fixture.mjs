import { createHash } from 'node:crypto'
import { fixture as drataFixture } from '../fixtures/drata/fixture.mjs'

const digest = bytes => createHash('sha256').update(bytes).digest('hex')

// Populate the product only through its real owner, member and scoped API doors.
// Tokens stay in this closure. Returned expectations contain no live grants.
export async function portableFixture(app, { large = true } = {}) {
 const ids = {}, files = [], representative = {}, counts = {}
 async function request(path, { method = 'GET', body, token, anonymous = false, status = 200 } = {}) {
  const form = body instanceof FormData || body instanceof URLSearchParams
  const response = await app.fetch(path, {
   method, headers: {
    ...(anonymous ? { cookie: '' } : {}),
    ...(token ? { cookie: '', authorization: 'Bearer ' + token } : {}),
    ...(method !== 'GET' ? { origin: app.origin } : {}),
    ...(body !== undefined && !form ? { 'content-type': 'application/json' } : {}),
   }, ...(body !== undefined ? { body: form ? body : JSON.stringify(body) } : {}),
  })
  if (response.status !== status) throw Error(`Portable fixture ${method} ${path.replace(/\/review\/[^/]+/, '/review/[redacted]')}: expected ${status}, received ${response.status}`)
  return response
 }
 const get = async path => (await request(path)).json()
 const post = async (path, body, status = 201) => (await request(path, { method: 'POST', body, status })).json()
 const api = async (method, path, body, status = 200) => (await request(path, { method, body, token: credential.token, status })).json()
 const upload = async (path, bytes, name, fields = {}, status = 201) => {
  const form = new FormData()
  for (const [key, value] of Object.entries(fields)) form.set(key, String(value))
  form.set('file', new File([bytes], name, { type: 'application/octet-stream' }))
  return request(path, { method: 'POST', body: form, status })
 }
 ids.ownerPerson = (await post('/api/people', { name: 'Evidence owner', email: 'owner@example.test', kind: 'employee', role: 'engineering' })).id
 ids.person = (await post('/api/people', { name: 'Morgan Lane', email: 'morgan@portable.test', kind: 'employee', role: 'engineering' })).id
 ids.program = (await post('/api/programs', { framework: 'soc2', name: 'Portable SaaS SOC 2', legal_entity: 'Portable Systems Inc', report_type: 'Type II', audit_from: '2026-07-01', audit_to: '2027-06-30' })).id

 const created = await request('/app/controls', { method: 'POST', body: new URLSearchParams({ name: 'Service access review', group: 'Access', proof: 'Signed quarterly review', cadence: 'quarterly' }), status: 303 })
 ids.requirement = created.headers.get('location').split('/').at(-1)
 const requirement = (await get('/api/desk')).requirements.find(r => r.id === ids.requirement)
 ids.control = requirement.control_id
 await post(`/api/controls/${ids.control}/revisions`, { revision: '1', name: 'Production service access review', group: 'Access', applicability: 'Production services', test_intent: 'Service administrators require MFA', evaluation_criteria: 'Review every production administrator quarterly', reason: 'Document production scope' }, 200)
 await post(`/api/requirements/${ids.requirement}/revisions`, { name: 'Signed production administrator review', reason: 'Clarify required sign-off' }, 200)
 await post(`/api/controls/${ids.control}/owners`, { owner_person_id: ids.person, reason: 'Platform accountability', due_date: '2026-12-31' }, 200)
 await post(`/api/controls/${ids.control}/mappings`, { framework: 'soc2', edition: 'tsc-2017-pof-2022', ref: 'CC6.1', reason: 'Access review supports logical access' })

 // A retained original framework file, its revision and a separate mapping decision.
 const frameworkBytes = Buffer.from('id,title,description,section,control_ids\r\nCUSTOM-1,Review privileged access,Quarterly signed review,Access,\r\n')
 const frameworkFields = { name: 'Customer security addendum' }
 const frameworkPlan = await (await upload('/api/frameworks/import', frameworkBytes, 'addendum.csv', frameworkFields, 200)).json()
 const framework = await (await upload('/api/frameworks/import', frameworkBytes, 'addendum.csv', { ...frameworkFields, confirm: 'yes', review_hash: frameworkPlan.review_hash })).json()
 ids.framework = framework.id
 const frameworkDetail = await get(`/api/frameworks/${ids.framework}`)
 ids.frameworkRequirement = frameworkDetail.requirements[0].id
 await post(`/api/frameworks/${ids.framework}/requirements/${ids.frameworkRequirement}/mappings`, { control_id: ids.control, decision: 'mapped', reason: 'Owner reviewed shared obligation' }, 200)
 representative.framework = await get(`/api/frameworks/${ids.framework}/export`)
 files.push({ kind: 'framework', url: `/api/frameworks/${ids.framework}/revisions/1/file`, size: frameworkBytes.length, sha256: digest(frameworkBytes) })

 const credential = await post('/api/api-tokens', { name: 'Portable service inventory', scopes: ['resource-push', 'test-write', 'read'], expires_at: '2027-04-01' })
 ids.apiToken = credential.grant.id
 const schema = { fields: { mfa_enforced: 'boolean', owner: 'string', tier: 'number' }, required: ['mfa_enforced'] }
 await api('PUT', '/v1/resource-types/portable_service', { schema })
 await api('PUT', '/v1/resources/portable_service', { resources: [{ uniqueId: 'billing', displayName: 'Billing production service', attributes: { mfa_enforced: false, owner: 'platform', tier: 1 } }, { uniqueId: 'search', displayName: 'Search production service', attributes: { mfa_enforced: true, owner: 'platform', tier: 2 } }] })
 const test = await api('POST', '/v1/tests', { name: 'Production services enforce MFA', resourceType: 'portable_service', criteria: [{ attribute: 'mfa_enforced', op: 'equals', value: true }], cadence: 'hourly', category: 'identity', severity: 'high', controls: [ids.control] }, 201)
 ids.test = test.id
 const failure = (await get(`/api/tests/${ids.test}`)).latest.find(r => r.result === 'fail')
 ids.resource = failure.resource_id
 ids.obligation = failure.obligation
 await post(`/api/remediation/${ids.obligation}/assign`, { owner_person_id: ids.person, next_action: 'Require MFA for billing administrators', target_date: '2026-10-25' }, 200)
 await post(`/api/remediation/${ids.obligation}/comments`, { body: 'Owner reviewed the original failing observation' })
 representative.test = await get(`/api/tests/${ids.test}`)
 representative.remediation = await get(`/api/remediation/${ids.obligation}`)

 ids.vendor = (await post('/api/vendors', { name: 'Portable hosting supplier', owner_person_id: ids.person, criticality: 'high', data_access: 'Production encrypted backups', review_due: '2027-01-31' })).id
 ids.risk = (await post('/api/risks', { title: 'Privileged service account takeover', scenario: 'Billing administrators currently lack MFA', likelihood: '4', impact: '4', treatment: 'mitigate', owner_person_id: ids.person, controls: ids.control, assets: ids.resource, review_due: '2026-12-31' })).id
 await post(`/api/risks/${ids.risk}/links`, { kind: 'vendor', target: ids.vendor })
 representative.risk = await get(`/api/risks/${ids.risk}`)

 const policy = await post('/api/policies', { title: 'Portable access control policy', owner_person_id: ids.person, body: 'Production administrators use MFA. Platform owners review access quarterly and retain signed evidence.' })
 ids.policy = policy.policy; ids.policyRevision = policy.revision
 const revision = await get(`/api/policies/${policy.policy}/revisions/${policy.revision}`)
 await post(`/api/policies/${policy.policy}/revisions/${policy.revision}/decision`, { decision: 'approved', body_sha256: revision.body_sha256, note: 'Reviewed against current production scope' }, 200)
 await post(`/api/policies/${policy.policy}/revisions/${policy.revision}/publish`, { effective_date: '2026-10-11' }, 200)
 await post('/api/attestations/assign', { policy_id: policy.policy, audience: 'everyone', due_date: '2026-11-01' })
 ids.assignment = (await get('/api/attestations')).assignments.find(a => a.person_id === ids.ownerPerson).id
 await post(`/api/me/assignments/${ids.assignment}/acknowledge`, { body_sha256: revision.body_sha256 }, 200)
 representative.policy = await get(`/api/policies/${policy.policy}/revisions/${policy.revision}`)
 representative.attestations = await get('/api/attestations')
 await post('/api/training/courses/security-awareness/adopt', {}, 200)
 ids.campaign = (await post('/api/training/campaigns', { name: 'Annual security awareness', course_id: 'security-awareness', kind: 'recurring', audience: 'everyone', due_days: '30', interval_months: '12' })).id
 ids.internalCourse = (await post('/api/training/internal', { title: 'Security workshop', description: 'Live awareness workshop with recorded attendance', counts_as: 'security-awareness' })).id
 await post(`/api/training/internal/${ids.internalCourse}/completions`, { person_id: ids.person, completed_on: '2026-10-11' })
 const course = await get('/api/me/training/security-awareness')
 await post('/api/me/training/security-awareness/attempts', { answers: course.quiz.map(() => 0) })
 representative.training = await get('/api/training/export')

 const populationDefinitions = [
  ['roster', 'Manual personnel register', 'email,name,employment_type,start_date\r\nmorgan@portable.test,Morgan Lane,W-2,2025-01-01\r\n'],
  ['accounts', 'Manual design application', 'account_id,name,role,status,email\r\nDESIGN-1,Morgan Lane,admin,active,morgan@portable.test\r\n'],
  ['devices', 'Manual endpoint register', 'serial,owner_email,hostname,encrypted\r\nPORT-001,morgan@portable.test,morgan-laptop,yes\r\n'],
 ]
 ids.populations = []
 for (const [kind, source_system, csv] of populationDefinitions) {
  const fields = { kind, source_system, as_of: '2026-10-11', refresh_days: '30' }, bytes = Buffer.from(csv)
  const dry = await (await upload('/api/populations', bytes, `${kind}.csv`, fields, 200)).json()
  const admitted = await (await upload('/api/populations', bytes, `${kind}.csv`, { ...fields, confirm: 'yes', sha256: dry.sha256 })).json()
  ids.populations.push(admitted.id)
  const detail = await get(`/api/populations/${admitted.id}`)
  for (const row of detail.rows) await post(`/api/populations/rows/${row.id}/match`, { person_id: ids.person, decision: 'approved' }, 200)
  files.push({ kind: 'population', object_key: `populations/${admitted.id}`, url: `/app/populations/${admitted.id}/file`, size: bytes.length, sha256: digest(bytes) })
 }
 const source = 'list:Manual design application'
 ids.accessReview = (await post('/api/access-reviews', { name: 'Quarterly design access review', cadence: 'quarterly', period_from: '2026-10-01', period_to: '2026-12-31', due_date: '2026-11-01', sources: [source], ['reviewer_' + source]: ids.ownerPerson })).id
 const access = await get(`/api/access-reviews/${ids.accessReview}`)
 ids.accessItem = access.items[0].id
 await post(`/api/me/access/${ids.accessItem}`, { decision: 'retain', reason: 'Platform owner still requires design access' }, 200)
 representative.access = await get(`/api/access-reviews/${ids.accessReview}/export`)

 // Every original remains separate. Only one at-most-9-MiB byte array lives
 // in this loop; metadata expectations never retain uploaded byte buffers.
 ids.receipts = []
 const count = large ? 8 : 2, size = large ? 9 * 1024 * 1024 : 1024
 for (let i = 0; i < count; i++) {
  const bytes = Buffer.alloc(size, 31 + i)
  bytes.write(`Portable retained exhibit ${i}\n`, 0, 'utf8')
  const response = await upload(`/app/requirements/${ids.requirement}/uploads`, bytes, `review-${i}.txt`, { source: `Signed access review part ${i}`, covered_from: '2026-10-01', covered_to: '2026-12-31', ...(i === 1 ? { supersedes: ids.receipts[0] } : {}) }, 303)
  const receipt = await get(response.headers.get('location').replace('/app/', '/api/'))
  ids.receipts.push(receipt.id)
  files.push({ kind: 'exhibit', id: receipt.id, object_key: receipt.object_key, url: `/api/receipts/${receipt.id}/download`, size: bytes.length, sha256: digest(bytes) })
 }
 counts.originalExhibitBytes = count * size

 const importedBytes = await drataFixture()
 const imported = await (await upload('/api/import/drata', importedBytes, 'historical-drata.zip')).json()
 ids.importReview = imported.review.id
 const mapping = imported.summary.controls.map((control, index) => ({ source_id: control.id, action: 'create', name: `Historical imported control ${index + 1}`, proof: 'Historical source evidence', group: index ? 'People' : 'Access', cadence: 'monthly', covered_from: '2026-09-01', covered_to: '2026-09-30' }))
 const plan = await post(`/api/import/${ids.importReview}/mapping`, { mapping }, 200)
 let job = (await post(`/api/import/${ids.importReview}/commit`, { approve: 'commit', fingerprint: plan.review.fingerprint }, 200)).job
 for (let i = 0; job.state === 'applying' && i < 20; i++) job = (await post(`/api/import/${ids.importReview}/resume`, {}, 200)).job
 if (job.state !== 'completed') throw Error('Portable fixture import did not complete')
 ids.importJob = job.id
 files.push({ kind: 'import', object_key: `import-sources/${ids.importReview}`, url: `/api/import/${ids.importReview}/source`, size: importedBytes.length, sha256: digest(importedBytes) })
 representative.import = await get(`/api/import/${ids.importReview}`)

 const agentCredential = await post('/api/agent/tokens', { label: 'Portable prepare-only agent', expires_at: '2026-11-01T00:00:00Z' })
 ids.agentToken = agentCredential.grant.id
 const folderInput = { reviewer_label: 'Portable audit reviewer', period_from: '2026-10-01', period_to: '2026-12-31', expires_at: '2026-11-01T00:00:00Z', control_ids: [ids.control] }
 const prepared = await (await request('/api/agent/prepare-folder', { method: 'POST', token: agentCredential.token, body: folderInput, status: 201 })).json()
 ids.proposal = prepared.proposal.id
 const approval = await post(`/api/agent/proposals/${ids.proposal}/approve`, { snapshot_hash: prepared.proposal.snapshot_hash })
 ids.agentDecision = approval.decision.id
 const reviewPath = new URL(approval.review_url).pathname
 // Read and refusal events, then terminal close. Bearer URLs stay local here.
 await (await request(reviewPath + '/exhibits', { anonymous: true })).arrayBuffer()
 await request(reviewPath + '/receipts/00000000-0000-0000-0000-000000000000', { anonymous: true, status: 404 })
 ids.folder = approval.decision.folder_id
 await post(`/api/folders/${ids.folder}/close`, {}, 200)
 representative.agent = await get(`/api/agent/proposals/${ids.proposal}`)

 // Keep the large inventory on a different type: populating it must not
 // create twenty thousand observations on every bounded push request.
 const resourceType = 'portable_inventory', resourceCount = large ? 20200 : 12
 await api('PUT', `/v1/resource-types/${resourceType}`, { schema })
 const resourceSamples = []
 for (let start = 0; start < resourceCount; start += 200) {
  const resources = Array.from({ length: Math.min(200, resourceCount - start) }, (_, offset) => {
   const index = start + offset
   return { uniqueId: `portable-${String(index).padStart(5, '0')}`, displayName: `Production service ${index}`, attributes: { mfa_enforced: true, owner: 'platform', tier: index % 3 } }
  })
  const pushed = await api('PUT', `/v1/resources/${resourceType}`, { resources })
  if (pushed.created !== resources.length || pushed.rejected) throw Error('Portable fixture inventory batch was not admitted completely')
  if (!start || start + resources.length === resourceCount) resourceSamples.push(...pushed.results.map((r, index) => ({ ...resources[index], id: r.id })))
 }
 representative.resources = [resourceSamples[0], resourceSamples.at(-1)]
 counts.largeResources = resourceCount
 counts.people = 2
 counts.manualPopulations = 3
 counts.uploadedExhibits = count
 return { ids, counts, files, representative, resourceType, resourceCount, tokenIds: [ids.apiToken, ids.agentToken] }
}
