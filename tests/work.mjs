// Remediation tickets in Vector, Jira Cloud, Linear, GitHub Issues and Asana
// through the owner's doors, signed tracker webhooks and the Cron Trigger. The
// trackers are the only fakes: network-edge stand-ins answering each tracker's
// documented API shapes, keeping their own issues, comments and credentials.
process.env.RER_SERVER_JOURNEY = '1'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { runtime } from './helpers/runtime.mjs'
const VECTOR = 'https://vector.example.com', JIRA = 'https://northstar.atlassian.net', TEAM = '01K0000000000000000000TEAM'
const tracker = { clock: '2026-10-11T12:00:00Z', tokens: { vector: 'vec_token', jira: 'jira_token', linear: 'lin_key', github: 'ghp_issues', asana: 'asana_pat' }, issues: new Map(), calls: [] }
const reply = (status, body) => new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
let sequence = 0
const issue = (provider, fields) => { const n = ++sequence, item = { provider, n, status: 'open', closed: false, assignee: null, due: null, comments: [], version: 1, ...fields }; tracker.issues.set(provider + ':' + item.id, item); return item }
const find = (provider, id) => tracker.issues.get(provider + ':' + id)
async function fakeTrackers(request) {
 const url = new URL(request.url), auth = request.headers.get('authorization') ?? '', body = ['POST', 'PUT', 'PATCH'].includes(request.method) ? await request.json() : null
 tracker.calls.push(`${request.method} ${url.origin}${url.pathname}`)
 if (url.origin === VECTOR) {
  if (auth !== 'Bearer ' + tracker.tokens.vector) return reply(401, { error: 'invalid_token' })
  if (url.pathname === '/api/v1/metadata') return reply(200, { workspace: { name: 'Northstar' }, teams: [{ id: TEAM, name: 'Platform' }] })
  if (url.pathname === '/api/v1/issues' && request.method === 'POST') { const id = 'FLW-' + (sequence + 1), i = issue('vector', { id, title: body.title, description: body.description, priority: body.priority, due: body.dueDate, status: 'Backlog (backlog)' }); return reply(201, { id: 'ulid' + i.n, identifier: id, version: 1 }) }
  const m = /^\/api\/v1\/issues\/(FLW-\d+)(\/comments)?$/.exec(url.pathname), i = m && find('vector', m[1])
  if (!i || i.deleted) return reply(404, { error: 'issue_not_found' })
  if (m[2]) { const id = 'cmt' + (++sequence); i.comments.push({ id, author: 'Evidence API', body: body.body, at: tracker.clock }); return reply(201, { id }) }
  if (request.method === 'PATCH') { if (body.expectedVersion !== i.version) return reply(409, { error: 'stale_version' }); i.due = body.dueDate; i.version++; return reply(200, {}) }
  const [name, category] = /^(.*) \((\w+)\)$/.exec(i.status).slice(1)
  return reply(200, { identifier: i.id, version: i.version, status: { name, category }, assignee: i.assignee ? { name: i.assignee } : null, dueDate: i.due, activity: i.comments.map((c, k) => ({ id: 'act' + k, kind: 'comment.created', at: c.at, actor: c.author, nextValue: { id: c.id } })) })
 }
 if (url.origin === JIRA) {
  if (auth !== 'Basic ' + Buffer.from('it@northstar.test:' + tracker.tokens.jira).toString('base64')) return reply(401, { errorMessages: ['Unauthorized'] })
  if (url.pathname === '/rest/api/3/myself') return reply(200, { displayName: 'IT', emailAddress: 'it@northstar.test' })
  if (url.pathname === '/rest/api/3/project/SEC') return reply(200, { key: 'SEC', name: 'Security' })
  if (url.pathname === '/rest/api/3/issue' && request.method === 'POST') {
   if (!['Highest', 'High', 'Medium', 'Low'].includes(body.fields.priority?.name)) return reply(400, { errorMessages: [], errors: { priority: 'Specify the Priority (id or name) in the string format' } })
   const key = 'SEC-' + (sequence + 1), i = issue('jira', { id: key, title: body.fields.summary, description: JSON.stringify(body.fields.description), due: body.fields.duedate ?? null, status: 'To Do', labels: body.fields.labels }); return reply(201, { id: String(1000 + i.n), key })
  }
  const m = /^\/rest\/api\/3\/issue\/(SEC-\d+)(\/comment|\/transitions)?$/.exec(url.pathname), i = m && find('jira', m[1])
  if (!i || i.deleted) return reply(404, { errorMessages: ['Issue does not exist'] })
  if (m[2] === '/transitions') { if (request.method === 'POST') { i.closed = false; i.status = 'To Do'; return reply(204) } return reply(200, { transitions: [{ id: '11', to: { statusCategory: { key: 'new' } } }, { id: '31', to: { statusCategory: { key: 'done' } } }] }) }
  if (m[2] && request.method === 'POST') { const id = String(++sequence); i.comments.push({ id, author: 'IT', body: body.body.content.map(p => p.content.map(t => t.text ?? '\n').join('')).join('\n'), at: tracker.clock }); return reply(201, { id }) }
  if (m[2]) return reply(200, { comments: i.comments.map(c => ({ id: c.id, author: { displayName: c.author }, body: { type: 'doc', version: 1, content: [{ type: 'paragraph', content: [{ type: 'text', text: c.body }] }] }, created: c.at })) })
  if (request.method === 'PUT') { i.due = body.fields.duedate; return reply(204) }
  return reply(200, { key: i.id, fields: { status: { name: i.status, statusCategory: { key: i.closed ? 'done' : 'new' } }, assignee: i.assignee ? { displayName: i.assignee } : null, duedate: i.due } })
 }
 if (url.origin === 'https://api.linear.app') {
  if (auth !== tracker.tokens.linear) return reply(400, { errors: [{ message: 'Authentication required, not authenticated', extensions: { type: 'authentication error' } }] })
  const q = body.query, v = body.variables
  if (q.includes('viewer')) return reply(200, { data: { viewer: { name: 'IT', organization: { name: 'Northstar' } }, team: v.team === 'team-lin' ? { id: 'team-lin', name: 'Platform' } : null } })
  if (q.includes('issueCreate')) { const i = issue('linear', { id: 'lin-' + (sequence + 1), key: 'PLA-' + (sequence + 1), title: v.input.title, due: v.input.dueDate ?? null, status: 'Todo (unstarted)', priority: v.input.priority }); return reply(200, { data: { issueCreate: { success: true, issue: { id: i.id, identifier: i.key, url: 'https://linear.app/northstar/issue/' + i.key } } } }) }
  if (q.includes('commentCreate')) { const i = find('linear', v.input.issueId), id = 'lc-' + (++sequence); i.comments.push({ id, author: 'IT', body: v.input.body, at: tracker.clock }); return reply(200, { data: { commentCreate: { success: true, comment: { id } } } }) }
  if (q.includes('issueUpdate')) { find('linear', v.id).due = v.input.dueDate; return reply(200, { data: { issueUpdate: { success: true } } }) }
  const i = find('linear', v.id)
  if (!i || i.deleted) return reply(200, { data: null, errors: [{ message: 'Entity not found: Issue', extensions: { type: 'invalid input', code: 'ENTITY_NOT_FOUND' } }] })
  const [name, type] = /^(.*) \((\w+)\)$/.exec(i.status).slice(1)
  return reply(200, { data: { issue: { id: i.id, identifier: i.key, url: '', dueDate: i.due, state: { name, type }, assignee: i.assignee ? { name: i.assignee } : null, comments: { nodes: i.comments.map(c => ({ id: c.id, body: c.body, createdAt: c.at, user: { name: c.author } })) } } } })
 }
 if (url.origin === 'https://api.github.com') {
  if (auth !== 'Bearer ' + tracker.tokens.github) return reply(401, { message: 'Bad credentials' })
  if (url.pathname === '/repos/northstar/web') return reply(200, { full_name: 'northstar/web', has_issues: true, owner: { login: 'northstar' } })
  if (url.pathname === '/repos/northstar/web/issues' && request.method === 'POST') { const i = issue('github', { id: String(sequence + 1), title: body.title, body: body.body, labels: body.labels }); return reply(201, { number: Number(i.id), html_url: 'https://github.example.com/northstar/web/issues/' + i.id }) }
  const m = /^\/repos\/northstar\/web\/issues\/(\d+)(\/comments)?$/.exec(url.pathname), i = m && find('github', m[1])
  if (!i || i.deleted) return reply(i?.deleted ? 410 : 404, { message: 'Not Found' })
  if (m[2] && request.method === 'POST') { const id = ++sequence; i.comments.push({ id: String(id), author: 'evidence-bot', body: body.body, at: tracker.clock }); return reply(201, { id }) }
  if (m[2]) return reply(200, i.comments.map(c => ({ id: Number(c.id), user: { login: c.author }, body: c.body, created_at: c.at })))
  if (request.method === 'PATCH') { if (body.state) i.closed = body.state === 'closed'; return reply(200, {}) }
  return reply(200, { number: Number(i.id), state: i.closed ? 'closed' : 'open', state_reason: i.closed ? 'completed' : null, assignee: i.assignee ? { login: i.assignee } : null })
 }
 if (url.origin === 'https://app.asana.com') {
  if (auth !== 'Bearer ' + tracker.tokens.asana) return reply(401, { errors: [{ message: 'Not Authorized' }] })
  const path = url.pathname.replace('/api/1.0', '')
  if (path === '/users/me') return reply(200, { data: { name: 'IT', email: 'it@northstar.test' } })
  if (path === '/projects/1200') return reply(200, { data: { gid: '1200', name: 'Security work' } })
  if (path === '/tasks' && request.method === 'POST') { const i = issue('asana', { id: String(5000 + sequence + 1), title: body.data.name, due: body.data.due_on ?? null }); return reply(201, { data: { gid: i.id, permalink_url: 'https://app.asana.com/0/1200/' + i.id } }) }
  const m = /^\/tasks\/(\d+)(\/stories)?$/.exec(path), i = m && find('asana', m[1])
  if (!i || i.deleted) return reply(404, { errors: [{ message: 'Unknown object' }] })
  if (m[2] && request.method === 'POST') { const gid = String(9000 + (++sequence)); i.comments.push({ id: gid, author: 'IT', body: body.data.text, at: tracker.clock }); return reply(201, { data: { gid } }) }
  if (m[2]) return reply(200, { data: [{ gid: '1', resource_subtype: 'added_to_project', text: 'added', created_at: tracker.clock }, ...i.comments.map(c => ({ gid: c.id, resource_subtype: 'comment_added', text: c.body, created_at: c.at, created_by: { name: c.author } }))] })
  if (request.method === 'PUT') { if (Object.hasOwn(body.data, 'due_on')) i.due = body.data.due_on; if (Object.hasOwn(body.data, 'completed')) i.closed = body.data.completed; return reply(200, { data: {} }) }
  return reply(200, { data: { gid: i.id, completed: i.closed, assignee: i.assignee ? { name: i.assignee } : null, due_on: i.due } })
 }
 return null
}
const app = await runtime({ outbound: fakeTrackers })
let passed = 0
const scenario = async (name, fn) => { await fn(); passed++; console.log('PASS ' + name) }
const owner = async (path, body, status = 201) => { const r = await app.fetch(path, { method: 'POST', headers: { origin: app.origin, 'content-type': 'application/json' }, body: JSON.stringify(body) }); const text = await r.text(); assert.equal(r.status, status, path + ' ' + text); return text ? JSON.parse(text) : null }
const get = async path => { const r = await app.fetch(path); assert.equal(r.status, 200, path); return r.json() }
const at = async time => { tracker.clock = time; await app.clock(time) }
const v1 = (token, method, path, body) => app.fetch(path, { method, headers: { cookie: '', authorization: 'Bearer ' + token, 'content-type': 'application/json' }, body: JSON.stringify(body) })
const hook = (id, body, headers) => app.fetch('/hooks/trackers/' + id, { method: 'POST', headers: { cookie: '', 'content-type': 'application/json', ...headers }, body })
const sign = (secret, body) => createHmac('sha256', secret).update(body).digest('hex')
const obligationOf = async name => (await get('/api/remediation')).open.find(o => o.resource_name === name) ?? (await get('/api/remediation')).resolved.find(o => o.resource_name === name)
const detail = async id => get('/api/remediation/' + id)
const services = broken => Array.from({ length: 4 }, (_, i) => ({ uniqueId: 'svc-' + (i + 1), displayName: 'Service svc-' + (i + 1), attributes: { mfa_enforced: !broken.includes('svc-' + (i + 1)) } }))
const dest = {}
let push, ob2, ob3
try {
 await scenario('Each tracker is kept only after a real read of its project; credentials stay sealed and webhook secrets are shown once', async () => {
  await app.signin()
  push = await owner('/api/api-tokens', { name: 'Inventory', scopes: ['resource-push', 'test-write', 'read'], expires_at: '2027-04-01' })
  assert.equal((await v1(push.token, 'PUT', '/v1/resource-types/internal_service', { schema: { fields: { mfa_enforced: 'boolean' } } })).status, 200)
  assert.equal((await v1(push.token, 'PUT', '/v1/resources/internal_service', { resources: services(['svc-2', 'svc-3']) })).status, 200)
  assert.equal((await v1(push.token, 'POST', '/v1/tests', { name: 'Services enforce MFA', resourceType: 'internal_service', criteria: [{ attribute: 'mfa_enforced', op: 'equals', value: true }], cadence: 'hourly', category: 'identity', severity: 'high', controls: ['AC-05'] })).status, 201)
  ob2 = (await obligationOf('Service svc-2')).id; ob3 = (await obligationOf('Service svc-3')).id
  await owner('/api/trackers', { provider: 'jira', api_base: 'https://jira.example.com', account: 'it@northstar.test', project: 'SEC', token: tracker.tokens.jira }, 400)
  await owner('/api/trackers', { provider: 'jira', api_base: JIRA, account: 'it@northstar.test', project: 'SEC', token: 'wrong' }, 400)
  await owner('/api/trackers', { provider: 'vector', api_base: VECTOR, project: 'not-a-team', token: tracker.tokens.vector }, 400)
  assert.equal((await app.db.prepare('SELECT COUNT(*) AS n FROM tracker_destinations').first()).n, 0)
  const vectorKey = 'ab'.repeat(32)
  dest.vector = await owner('/api/trackers', { provider: 'vector', api_base: VECTOR, project: TEAM, token: tracker.tokens.vector, hook_secret: vectorKey, hook_audience: 'ws-1 dst-1' }); dest.vector.key = vectorKey
  dest.jira = await owner('/api/trackers', { provider: 'jira', api_base: JIRA, account: 'it@northstar.test', project: 'SEC', token: tracker.tokens.jira })
  dest.linear = await owner('/api/trackers', { provider: 'linear', project: 'team-lin', token: tracker.tokens.linear, hook_secret: 'linear-signing-secret' })
  dest.github = await owner('/api/trackers', { provider: 'github', project: 'northstar/web', token: tracker.tokens.github })
  dest.asana = await owner('/api/trackers', { provider: 'asana', project: '1200', token: tracker.tokens.asana })
  assert.match(dest.jira.webhook.secret, /^[0-9a-f]{64}$/); assert.match(dest.github.webhook.secret, /^[0-9a-f]{64}$/); assert.equal(dest.linear.webhook.secret, null)
  const listed = JSON.stringify(await get('/api/trackers')) + JSON.stringify(await get('/api/trackers/' + dest.jira.id)) + await (await app.fetch('/app/trackers/' + dest.jira.id)).text() + JSON.stringify((await app.db.prepare('SELECT * FROM product_audit').all()).results)
  for (const secret of [...Object.values(tracker.tokens), dest.jira.webhook.secret, dest.github.webhook.secret, 'linear-signing-secret', vectorKey]) assert.ok(!listed.includes(secret), 'secret leaked')
  const stored = await app.db.prepare("SELECT secret_ciphertext FROM tracker_destinations WHERE provider='jira'").first()
  assert.ok(stored.secret_ciphertext && !stored.secret_ciphertext.includes(tracker.tokens.jira))
  assert.match(await (await app.fetch('/app/trackers/' + dest.jira.id)).text(), /Due date.*Evidence owns it/s)
 })
 await scenario('BOUNDARY-001 / LOG-001 / A failed control opens one audited, linked Vector ticket with source links; tracker assignee and status arrive by signed webhook, and a replay changes nothing', async () => {
  const created = await owner(`/api/remediation/${ob2}/tickets`, { destination_id: dest.vector.id })
  await owner(`/api/remediation/${ob2}/tickets`, { destination_id: dest.vector.id }, 409)
  const remote = find('vector', created.key)
  assert.match(remote.description, new RegExp(`/app/remediation/${ob2}`)); assert.equal(remote.priority, 'high'); assert.match(remote.due, /^\d{4}-\d{2}-\d{2}$/)
  remote.assignee = 'Dana Lee'; remote.status = 'In Progress (started)'
  const body = JSON.stringify({ identifier: created.key, version: 2, title: remote.title, status: 'started', updatedAt: tracker.clock })
  const ts = String(Math.floor(Date.parse(tracker.clock) / 1000)), headers = { 'webhook-id': 'evt-1', 'webhook-tenant': 'ws-1', 'webhook-destination': 'dst-1', 'webhook-event': 'issue.updated', 'webhook-timestamp': ts }
  const signature = createHmac('sha256', Buffer.from(dest.vector.key, 'hex')).update(JSON.stringify(['integrations.webhook.v1', 'ws-1', 'dst-1', 'issue.updated', 'evt-1', ts, body])).digest('hex')
  assert.equal((await hook(dest.vector.id, body, { ...headers, 'webhook-signature': 'v1=' + '0'.repeat(64) })).status, 401)
  assert.equal((await hook(dest.vector.id, body, { ...headers, 'webhook-signature': 'v1=' + signature })).status, 202)
  const events = async () => (await app.db.prepare('SELECT COUNT(*) AS n FROM ticket_events').first()).n, before = await events()
  const replay = await hook(dest.vector.id, body, { ...headers, 'webhook-signature': 'v1=' + signature })
  assert.equal(replay.status, 200); assert.deepEqual(await replay.json(), { duplicate: true }); assert.equal(await events(), before)
  assert.equal((await hook('00000000-0000-4000-8000-000000000000', body, headers)).status, 404)
  const ticket = (await detail(ob2)).tickets[0]
  assert.deepEqual([ticket.remote_key, ticket.remote_assignee, ticket.remote_status, ticket.sync_state, ticket.stale], [created.key, 'Dana Lee', 'In Progress (started)', 'linked', false])
  assert.equal([...tracker.issues.values()].filter(i => i.provider === 'vector').length, 1)
  assert.ok((await detail(ob2)).events.some(e => e.kind === 'tracker assignee' && /Dana Lee/.test(e.body)))
  const writes = (await get('/api/audit?action=ticket.created')).entries.filter(e => e.subject === 'obligation:' + ob2)
  assert.deepEqual(writes.map(e => [e.actor_name, e.outcome, e.detail]), [['Evidence owner', 'succeeded', 'vector ' + created.key]])
 })
 await scenario('REMEDY-002: Closing Vector, Jira, GitHub Issues and Asana tickets automatically re-tests within 15 minutes; failure keeps the original item clock', async () => {
  const jira = await owner(`/api/remediation/${ob2}/tickets`, { destination_id: dest.jira.id }), github = await owner(`/api/remediation/${ob2}/tickets`, { destination_id: dest.github.id }), asana = await owner(`/api/remediation/${ob2}/tickets`, { destination_id: dest.asana.id })
  assert.deepEqual(find('jira', jira.key).labels, ['evidence', 'compliance']); assert.ok(find('github', github.url.split('/').pop()).labels.includes('priority: high'))
  const original = (await detail(ob2)).obligation
  const retests = async () => (await get('/api/tests/' + original.test_id)).runs.filter(r => r.trigger === 'retest')
  for (const [provider, closeIt] of [['jira', async () => {
   const i = find('jira', jira.key); i.closed = true; i.status = 'Done'
   const body = JSON.stringify({ webhookEvent: 'jira:issue_updated', issue: { key: jira.key } })
   assert.equal((await hook(dest.jira.id, body, { 'x-hub-signature': 'sha256=' + sign(dest.jira.webhook.secret, body), 'x-atlassian-webhook-identifier': 'jira-1' })).status, 202)
  }], ['github', async () => {
   const number = github.url.split('/').pop(); find('github', number).closed = true
   const body = JSON.stringify({ action: 'closed', issue: { number: Number(number) }, repository: { full_name: 'northstar/web' } })
   assert.equal((await hook(dest.github.id, body, { 'x-hub-signature-256': 'sha256=' + sign(dest.github.webhook.secret, 'tampered' + body), 'x-github-delivery': 'gh-1' })).status, 401)
   assert.equal((await hook(dest.github.id, body, { 'x-hub-signature-256': 'sha256=' + sign(dest.github.webhook.secret, body), 'x-github-delivery': 'gh-1' })).status, 202)
  }], ['vector', async () => {
   find('vector', (await detail(ob2)).tickets.find(t => t.destination_id === dest.vector.id).remote_key).status = 'Done (completed)'
   await at('2026-10-11T12:10:00Z')
  }], ['asana', async () => { find('asana', asana.key).closed = true; await at('2026-10-11T12:25:00Z') }]]) {
   const before = await retests(), closedAt = Date.parse(tracker.clock)
   const untouched = (await detail(ob3)).observations
   await closeIt()
   assert.equal((await detail(ob2)).obligation.state, ['asana', 'vector'].includes(provider) ? 'open' : 'awaiting verification', provider)
   await app.tick()
   const runs = await retests(), started = runs.find(r => !before.some(old => old.id === r.id))
   assert.equal(runs.length, before.length + 1, provider)
   assert.ok(started && Date.parse(started.started_at) >= closedAt && Date.parse(started.started_at) - closedAt <= 15 * 60000, provider + ' re-test deadline')
   const now = await detail(ob2)
   assert.equal(now.obligation.state, 'open', provider); assert.equal(now.observations[0].run_trigger, 'retest')
   assert.equal(now.observations[0].result, 'fail', provider)
   assert.deepEqual([now.obligation.clock_started_at, now.obligation.sla.due, now.obligation.sla_policy_id, now.obligation.cycles], [original.clock_started_at, original.sla.due, original.sla_policy_id, original.cycles], provider)
   assert.deepEqual((await detail(ob3)).observations, untouched, provider + ' re-tested an unrelated item')
   assert.ok(now.events.some(e => e.kind === 'closed in tracker' && /re-test is queued/.test(e.body)), provider)
  }
  const kinds = (await detail(ob2)).events.map(e => e.kind)
  assert.equal(kinds.filter(k => k === 'retest failed').length, 4); assert.ok(!kinds.includes('verified'))
 })
 await scenario('REMEDY-002: Linear closure automatically re-tests its item within 15 minutes and keeps the clock; comments, due conflicts and refused mappings remain visible', async () => {
  const lin = await owner(`/api/remediation/${ob3}/tickets`, { destination_id: dest.linear.id })
  await owner(`/api/remediation/${ob3}/comments`, { body: 'Rotating the service account today.' })
  const remote = [...tracker.issues.values()].find(i => i.provider === 'linear' && i.key === lin.key)
  assert.match(remote.comments[0].body, /Evidence owner in Evidence: Rotating the service account today\./)
  remote.comments.push({ id: 'lc-ext', author: 'Dana Lee', body: 'Blocked on vendor access.', at: tracker.clock })
  remote.due = '2026-12-01'
  const original = (await detail(ob3)).obligation, closedAt = Date.parse(tracker.clock)
  remote.status = 'Done (completed)'
  await owner(`/api/remediation/${ob3}/assign`, { owner_person_id: (await owner('/api/people', { name: 'Ana Ruiz', email: 'ana@northstar.test', kind: 'employee' })).id, next_action: 'Rotate', target_date: '2026-10-30' }, 200)
  await at('2026-10-11T12:40:00Z'); await app.tick()
  const view = await detail(ob3), ticket = view.tickets.find(t => t.destination_id === dest.linear.id)
  assert.equal(view.obligation.state, 'open')
  assert.equal(view.observations[0].run_trigger, 'retest'); assert.equal(view.observations[0].result, 'fail')
  assert.ok(Date.parse(view.observations[0].observed_at) - closedAt <= 15 * 60000)
  assert.deepEqual([view.obligation.clock_started_at, view.obligation.sla.due, view.obligation.sla_policy_id, view.obligation.cycles], [original.clock_started_at, original.sla.due, original.sla_policy_id, original.cycles])
  assert.equal(ticket.sync_state, 'conflict'); assert.equal(ticket.remote_due, '2026-12-01')
  assert.ok(view.events.some(e => e.kind === 'tracker comment' && e.body === 'Blocked on vendor access.' && /Dana Lee in Linear/.test(e.actor_name)))
  assert.ok(!view.events.some(e => e.kind === 'tracker comment' && /Rotating/.test(e.body)), 'own comment mirrored back')
  assert.match(view.events.find(e => e.kind === 'ticket conflict').body, /tracker 2026-12-01, Evidence 2026-10-30/)
  assert.equal(remote.due, '2026-12-01')
  await owner(`/api/tickets/${ticket.id}/resolve`, { keep: 'evidence' }, 200)
  assert.equal(remote.due, '2026-10-30'); assert.equal((await detail(ob3)).tickets.find(t => t.id === ticket.id).sync_state, 'linked')
  await owner(`/api/trackers/${dest.jira.id}/mapping`, { labels: 'evidence', priority_high: 'Urgent' }, 200)
  await owner(`/api/remediation/${ob3}/tickets`, { destination_id: dest.jira.id }, 400)
  const failed = (await detail(ob3)).tickets.find(t => t.destination_id === dest.jira.id)
  assert.equal(failed.sync_state, 'mapping failed'); assert.match(failed.sync_error, /priority: Specify the Priority/)
  await owner(`/api/trackers/${dest.jira.id}/mapping`, { labels: 'evidence', priority_high: 'High' }, 200)
  await owner(`/api/remediation/${ob3}/tickets`, { destination_id: dest.jira.id })
  assert.equal((await detail(ob3)).tickets.find(t => t.destination_id === dest.jira.id).sync_state, 'linked')
 })
 await scenario('REMEDY-002: A source change verifies closure automatically within 15 minutes; revoked grants and deleted tickets remain visible', async () => {
  tracker.tokens.linear = 'rotated-elsewhere'
  const github = (await detail(ob2)).tickets.find(t => t.destination_id === dest.github.id); find('github', github.remote_id).deleted = true
  await at('2026-10-11T12:55:00Z'); await app.tick()
  const lin = (await detail(ob3)).tickets.find(t => t.destination_id === dest.linear.id)
  assert.equal(lin.sync_state, 'authorization lost'); assert.equal((await get('/api/trackers/' + dest.linear.id)).destination.status, 'needs reconnect')
  assert.equal((await detail(ob2)).tickets.find(t => t.id === github.id).sync_state, 'remote deleted')
  assert.ok((await detail(ob2)).events.some(e => e.kind === 'ticket remote deleted'))
  assert.equal((await detail(ob2)).obligation.state, 'open')
  const original = (await detail(ob2)).obligation, changedAt = Date.parse(tracker.clock)
  assert.equal((await v1(push.token, 'PUT', '/v1/resources/internal_service', { resources: services(['svc-3']) })).status, 200)
  const verified = await detail(ob2)
  assert.equal(verified.obligation.state, 'verified')
  assert.equal(verified.observations[0].run_trigger, 'source-change'); assert.equal(verified.observations[0].result, 'pass')
  assert.ok(Date.parse(verified.obligation.closed_at) >= changedAt && Date.parse(verified.obligation.closed_at) - changedAt <= 15 * 60000)
  assert.deepEqual([verified.obligation.clock_started_at, verified.obligation.sla.due, verified.obligation.cycles], [original.clock_started_at, original.sla.due, original.cycles])
  assert.ok(verified.observations.some(o => o.result === 'fail' && o.run_trigger === 'retest'))
  await at('2026-10-11T13:00:00Z'); await app.tick()
  assert.equal((await detail(ob2)).obligation.state, 'verified'); assert.equal((await detail(ob3)).obligation.state, 'open')
  tracker.tokens.linear = 'lin_key2'
  await owner(`/api/trackers/${dest.linear.id}/rotate`, { token: 'lin_key2' }, 200)
  await owner(`/api/tickets/${lin.id}/sync`, {}, 200)
  assert.equal((await detail(ob3)).tickets.find(t => t.id === lin.id).sync_state, 'linked')
 })
 await scenario('REMEDY-002 / WORK-002: Every current tracker gives each item its due date and re-tests only its own item within 15 minutes while both original clocks keep running', async () => {
  for (const provider of ['vector', 'jira', 'linear', 'github', 'asana']) {
   const type = 'endpoint_' + provider, name = uniqueId => `Endpoint ${provider} ${uniqueId}`
   const resources = ['e1', 'e2'].map(uniqueId => ({ uniqueId, displayName: name(uniqueId), attributes: { patched: false } }))
   assert.equal((await v1(push.token, 'PUT', '/v1/resource-types/' + type, { schema: { fields: { patched: 'boolean' } } })).status, 200)
   assert.equal((await v1(push.token, 'PUT', '/v1/resources/' + type, { resources })).status, 200)
   const response = await v1(push.token, 'POST', '/v1/tests', { name: `${provider} endpoints are patched`, resourceType: type, criteria: [{ attribute: 'patched', op: 'equals', value: true }], cadence: 'daily', category: 'device', severity: 'medium', controls: ['OPS-04'] })
   assert.equal(response.status, 201); const test = await response.json()
   await owner(`/api/tests/${test.id}/ticket-settings`, { destination_id: dest[provider].id, granularity: 'item', auto_create: 'on', follow_up: 'reopen' }, 200)
   await at(new Date(Date.parse(tracker.clock) + 60 * 60000).toISOString()); await app.tick()
   const items = (await get('/api/remediation')).open.filter(o => o.test_id === test.id)
   assert.equal(items.length, 2); assert.ok(items.every(o => o.tickets.length === 1), provider)
   const remotes = await Promise.all(items.map(async o => {
    const ticket = (await detail(o.id)).tickets[0]
    return [...tracker.issues.values()].find(i => i.provider === provider && (i.id === ticket.remote_id || (i.key ?? i.id) === ticket.remote_key))
   }))
   const [first, second] = remotes
   assert.ok(first && second, provider); assert.notEqual(first.id, second.id)
   for (const [index, remote] of remotes.entries()) {
    if (provider === 'github') assert.ok(remote.body.includes(items[index].sla.due.slice(0, 10)), 'GitHub issue omits its item deadline')
    else assert.equal(remote.due, items[index].sla.due.slice(0, 10), provider)
   }
   first.assignee = 'Lena ' + provider
   first.status = ['vector', 'linear'].includes(provider) ? 'In Progress (started)' : 'In Progress'
   await at(new Date(Date.parse(tracker.clock) + 15 * 60000).toISOString()); await app.tick()
   const page = await get('/api/tests/' + test.id), ticket = page.latest.find(o => o.display_name === name('e1')).tickets[0]
   assert.equal(ticket.remote_assignee, first.assignee, provider)
   const filter = `tracker_assignee=${encodeURIComponent(first.assignee)}`
   assert.deepEqual((await get('/api/remediation?' + filter)).open.map(o => o.resource_name), [name('e1')])
   assert.deepEqual((await get('/api/remediation?' + filter + '&tracker_status=' + encodeURIComponent(ticket.remote_status))).open.map(o => o.resource_name), [name('e1')])
   const before = await Promise.all(items.map(o => detail(o.id))), closedAt = Date.parse(tracker.clock)
   first.closed = true; first.status = ['vector', 'linear'].includes(provider) ? 'Done (completed)' : 'Done'
   await at(new Date(closedAt + 15 * 60000).toISOString()); await app.tick()
   const after = await Promise.all(items.map(o => detail(o.id)))
   assert.equal(after[0].obligation.state, 'open', provider)
   assert.equal(after[0].observations.length, before[0].observations.length + 1, provider)
   assert.equal(after[0].observations[0].run_trigger, 'retest'); assert.equal(after[0].observations[0].result, 'fail')
   assert.ok(Date.parse(after[0].observations[0].observed_at) >= closedAt && Date.parse(after[0].observations[0].observed_at) - closedAt <= 15 * 60000)
   assert.deepEqual(after[1].observations, before[1].observations, provider + ' re-tested the other item')
   for (const [index, view] of after.entries()) assert.deepEqual([view.obligation.clock_started_at, view.obligation.sla.due, view.obligation.sla_policy_id, view.obligation.cycles], [items[index].clock_started_at, items[index].sla.due, items[index].sla_policy_id, items[index].cycles], provider)
   const run = (await get('/api/tests/' + test.id)).runs.find(r => r.trigger === 'retest')
   assert.equal(run.population, 1); assert.equal(run.failed, 1)
   // A later source event fixes only e2; e1's failed-ticket clock survives.
   resources[1].attributes.patched = true
   const changedAt = Date.parse(tracker.clock)
   assert.equal((await v1(push.token, 'PUT', '/v1/resources/' + type, { resources })).status, 200)
   const fixed = await detail(items[1].id), stillOpen = await detail(items[0].id)
   assert.equal(fixed.obligation.state, 'verified'); assert.equal(fixed.observations[0].run_trigger, 'source-change')
   assert.equal(fixed.observations[0].result, 'pass')
   assert.ok(Date.parse(fixed.obligation.closed_at) >= changedAt && Date.parse(fixed.obligation.closed_at) - changedAt <= 15 * 60000)
   assert.equal(stillOpen.obligation.state, 'open')
   assert.equal(stillOpen.obligation.clock_started_at, items[0].clock_started_at); assert.equal(stillOpen.obligation.sla.due, items[0].sla.due)
   second.closed = true; second.status = ['vector', 'linear'].includes(provider) ? 'Done (completed)' : 'Done'
   await at(new Date(Date.parse(tracker.clock) + 15 * 60000).toISOString()); await app.tick()
   assert.equal((await detail(items[1].id)).obligation.state, 'verified')
   assert.equal((await detail(items[0].id)).obligation.state, 'open')
  }
 })
 await scenario('REMEDY-002 / WORK-002: A whole-test ticket lists every item with its deadline; closing it with one item fixed re-tests all, closes only the fixed one and reopens the ticket naming the rest', async () => {
  assert.equal((await v1(push.token, 'PUT', '/v1/resource-types/bucket', { schema: { fields: { private: 'boolean' } } })).status, 200)
  assert.equal((await v1(push.token, 'PUT', '/v1/resources/bucket', { resources: ['b1', 'b2', 'b3'].map(u => ({ uniqueId: u, displayName: 'Bucket ' + u, attributes: { private: false } })) })).status, 200)
  const test = await (await v1(push.token, 'POST', '/v1/tests', { name: 'Buckets are private', resourceType: 'bucket', criteria: [{ attribute: 'private', op: 'equals', value: true }], cadence: 'daily', category: 'cloud', severity: 'high', controls: ['DAT-08'] })).json()
  await owner(`/api/tests/${test.id}/ticket-settings`, { destination_id: dest.github.id, granularity: 'test', follow_up: 'reopen' }, 200)
  assert.equal((await get('/api/tests/' + test.id)).tickets.waiting, 3)
  const created = await owner(`/api/tests/${test.id}/tickets`, {})
  assert.equal(created.items, 3)
  const remote = find('github', created.url.split('/').pop())
  for (const b of ['b1', 'b2', 'b3']) assert.match(remote.body, new RegExp(`Bucket ${b}: remediate by \\d{4}-\\d{2}-\\d{2}`))
  assert.equal((await get('/api/tests/' + test.id)).tickets.waiting, 0)
  assert.equal((await v1(push.token, 'PUT', '/v1/resources/bucket', { resources: ['b1', 'b2', 'b3', 'b4'].map(u => ({ uniqueId: u, displayName: 'Bucket ' + u, attributes: { private: u === 'b1' ? true : false } })) })).status, 200)
  await owner(`/api/tests/${test.id}/tickets`, {})
  assert.match(remote.comments.at(-1).body, /New failing items:\n- Bucket b4/)
  const members = [...(await get('/api/remediation')).open, ...(await get('/api/remediation')).resolved].filter(o => o.test_id === test.id)
  const before = await Promise.all(members.map(o => detail(o.id))), closedAt = Date.parse(tracker.clock)
  remote.closed = true
  await at(new Date(Date.parse(tracker.clock) + 15 * 60000).toISOString()); await app.tick()
  for (const prior of before) {
   const retested = await detail(prior.obligation.id)
   assert.equal(retested.observations.length, prior.observations.length + 1, prior.obligation.resource_name)
   assert.equal(retested.observations[0].run_trigger, 'retest', 'whole-test closure must re-test every listed item, including a previously passing item')
   assert.ok(Date.parse(retested.observations[0].observed_at) >= closedAt && Date.parse(retested.observations[0].observed_at) - closedAt <= 15 * 60000)
   assert.equal(retested.obligation.clock_started_at, prior.obligation.clock_started_at)
   assert.equal(retested.obligation.sla.due, prior.obligation.sla.due)
  }
  const states = Object.fromEntries((await get('/api/remediation')).open.concat((await get('/api/remediation')).resolved).filter(o => o.test_id === test.id).map(o => [o.resource_name, o.state]))
  assert.deepEqual(states, { 'Bucket b1': 'verified', 'Bucket b2': 'open', 'Bucket b3': 'open', 'Bucket b4': 'open' })
  assert.equal(remote.closed, false)
  const notice = remote.comments.at(-1).body
  assert.match(notice, /Re-test still fails for:/); assert.match(notice, /Bucket b2/); assert.match(notice, /Bucket b4/); assert.ok(!/Bucket b1/.test(notice))
  const group = (await get('/api/tests/' + test.id)).tickets.groups[0]
  assert.equal(group.state, 'open'); assert.equal(group.item_list.split(',').length, 4)
 })
 await scenario('PORTABLE-001 / Tickets and their sync history travel in the archive; restored destinations hold no credentials', async () => {
  const exported = Buffer.from(await (await app.fetch('/api/archive/export')).arrayBuffer())
  for (const secret of [...Object.values(tracker.tokens), dest.jira.webhook.secret]) assert.ok(!exported.includes(secret))
  const target = await runtime(); await target.signin()
  const restored = await target.fetch('/api/archive/restore', { method: 'POST', headers: { origin: target.origin, 'content-type': 'application/octet-stream', 'x-evidence-confirm': 'restore', 'x-evidence-erasure-history':'unverified acknowledged' }, body: exported })
  assert.equal(restored.status, 200, await restored.clone().text())
  for (const table of ['tickets', 'ticket_events', 'ticket_comments', 'tracker_deliveries']) assert.deepEqual((await target.db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()).results, (await app.db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()).results, table)
  assert.deepEqual([...new Set((await target.db.prepare('SELECT status,secret_ciphertext,hook_ciphertext FROM tracker_destinations').all()).results.map(r => JSON.stringify(r)))], [JSON.stringify({ status: 'inactive after restore', secret_ciphertext: null, hook_ciphertext: null })])
  const calls = tracker.calls.length; await target.tick(); assert.equal(tracker.calls.length, calls)
  await target.close()
 })
 console.log(`${passed} remediation ticket public-door scenarios passed; trackers are faked only at the network edge.`)
} finally { await app.close() }
