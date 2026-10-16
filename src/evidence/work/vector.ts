import { call, dateOnly, TrackerFailure, type Adapter } from './client'
// Vector's scoped native API (docs/API.md in just-every/run-vector): a bearer
// token with issues:read, issues:write, comments:write and metadata:read.
// Vector exposes comment activity but not comment text through this API.
const headers = (token: string) => ({ authorization: 'Bearer ' + token, accept: 'application/json', 'content-type': 'application/json' })
const label = 'Vector'
const issuePath = (base: string, key: string) => `${base}/api/v1/issues/${encodeURIComponent(key)}`
async function issue(base: string, token: string, key: string) { return (await call(issuePath(base, key), { headers: headers(token), label })).body }
export const vector: Adapter = {
 name: 'Vector', credential: 'A Vector API token from Settings → Integrations → API tokens', permissions: 'issues:read, issues:write, comments:write, metadata:read',
 projectLabel: 'Team ID (from Vector metadata)', baseLabel: 'Vector address', defaultBase: '',
 supportsDue: true, commentText: false, webhook: 'Vector outbound webhook (Base signed format, issue.created/updated/completed)',
 defaultPriorities: { critical: 'urgent', high: 'high', medium: 'medium', low: 'low' },
 async verify(base, token, _account, project) {
  if (!base) throw new TrackerFailure('invalid', 400, 'Give the Vector address, for example https://vector.example.com.')
  const meta = (await call(`${base}/api/v1/metadata`, { headers: headers(token), label })).body as { workspace?: { name?: string }; teams?: { id: string; name: string }[] }
  const team = meta.teams?.find(t => t.id === project)
  if (!team) throw new TrackerFailure('invalid', 400, 'That team is not visible to this Vector token.')
  return { account: String(meta.workspace?.name ?? 'Vector workspace'), projectName: team.name }
 },
 async create(d, token, draft) {
  const body = { title: draft.title, teamId: d.project, description: draft.description, priority: draft.priority, dueDate: draft.due, ...(draft.assignee ? { assigneeOperatorId: draft.assignee } : {}) }
  const created = (await call(`${d.api_base}/api/v1/issues`, { method: 'POST', headers: headers(token), body: JSON.stringify(body), label })).body as { id: string; identifier: string }
  return { id: created.identifier, key: created.identifier, url: `${d.api_base}/app/issues/${created.identifier}` }
 },
 async read(d, token, t) {
  const i = await issue(d.api_base, token, t.remote_key) as { status?: { name?: string; category?: string }; assignee?: { name?: string } | null; dueDate?: string | null; activity?: { id: string; kind: string; at: string; actor: string | null; nextValue?: { id?: string } | null }[] }
  const category = String(i.status?.category ?? '')
  return {
   status: `${i.status?.name ?? category} (${category})`, closed: category === 'completed' || category === 'canceled', assignee: i.assignee?.name ?? null, due: dateOnly(i.dueDate),
   comments: (i.activity ?? []).filter(a => a.kind === 'comment.created').map(a => ({ id: String(a.nextValue?.id ?? a.id), author: a.actor ?? 'Vector', body: '', at: a.at })),
  }
 },
 async comment(d, token, t, body) { return String(((await call(`${issuePath(d.api_base, t.remote_key)}/comments`, { method: 'POST', headers: headers(token), body: JSON.stringify({ body }), label })).body as { id: string }).id) },
 async reopen(d, token, t) {
  const meta = (await call(`${d.api_base}/api/v1/metadata`, { headers: headers(token), label })).body as { teams?: { id: string; statuses?: { id: string; category: string }[] }[] }
  const open = meta.teams?.find(x => x.id === d.project)?.statuses?.find(s => s.category === 'unstarted' || s.category === 'backlog')
  if (!open) throw new TrackerFailure('invalid', 400, 'The Vector team has no open status to reopen into.')
  const current = await issue(d.api_base, token, t.remote_key) as { version: number }
  await call(issuePath(d.api_base, t.remote_key), { method: 'PATCH', headers: headers(token), body: JSON.stringify({ expectedVersion: current.version, statusId: open.id }), label })
 },
 // Vector refuses stale writes: read the current version, then change only the due date.
 async setDue(d, token, t, due) {
  const current = await issue(d.api_base, token, t.remote_key) as { version: number }
  await call(issuePath(d.api_base, t.remote_key), { method: 'PATCH', headers: headers(token), body: JSON.stringify({ expectedVersion: current.version, dueDate: due }), label })
 },
}
