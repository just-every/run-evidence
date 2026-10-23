import { assertFieldBaseline, nativeId, nativeIds, call, dateOnly, TrackerFailure, type Adapter, type RemoteComment } from './client'
import { namedIds } from './rest'
// Vector's scoped native API (docs/API.md in just-every/run-vector): a bearer
// token with issues:read, issues:write, comments:read, comments:write and metadata:read.
// Comment reads follow the published API-003 Comment schema and cursor protocol.
const headers = (token: string) => ({ authorization: 'Bearer ' + token, accept: 'application/json', 'content-type': 'application/json' })
const label = 'Vector'
const issuePath = (base: string, key: string) => `${base}/api/v1/issues/${encodeURIComponent(key)}`
async function issue(base: string, token: string, key: string) { return (await call(issuePath(base, key), { headers: headers(token), label })).body }

// Only the linked issue's authorized comments enter the obligation. A malformed,
// denied, changed or incomplete page fails the whole read; no partial mirror is
// committed. Cursors are opaque and filters remain identical on every page.
async function comments(base: string, token: string, key: string): Promise<RemoteComment[]> {
 const result: RemoteComment[] = [], cursors = new Set<string>(), ids = new Set<string>()
 let cursor: string | null = null, total: number | null = null
 do {
  const url = new URL(`${base}/api/v1/comments`)
  url.searchParams.set('issue', key); url.searchParams.set('limit', '100')
  if (cursor) url.searchParams.set('cursor', cursor)
  const page = (await call(url.href, { headers: headers(token), label })).body as { comments?: unknown[]; total?: number; nextCursor?: string | null }
  if (!page || !Array.isArray(page.comments) || !Number.isSafeInteger(page.total) || page.total! < 0 || (page.nextCursor !== null && (typeof page.nextCursor !== 'string' || !page.nextCursor))) throw new TrackerFailure('unavailable', 502, 'Vector comment page is incomplete or malformed.')
  if (total !== null && total !== page.total) throw new TrackerFailure('unavailable', 502, 'Vector comments changed during pagination; read again.')
  total = page.total!
  for (const raw of page.comments) {
   const c = raw as { id?: string; issueIdentifier?: string; body?: string; author?: { id?: string; displayName?: string }; createdAt?: string; editedAt?: string | null; url?: string; version?: number; maxBodyLength?: number; truncated?: boolean }
   let source: URL | undefined
   try { if (typeof c?.url === 'string') source = new URL(c.url) } catch { /* Refused below. */ }
   if (!c || typeof c.id !== 'string' || !c.id || ids.has(c.id) || c.issueIdentifier !== key || typeof c.body !== 'string' || c.body.length > 100000 || typeof c.author?.id !== 'string' || !c.author.id || typeof c.author.displayName !== 'string' || !c.author.displayName || typeof c.createdAt !== 'string' || !Number.isFinite(Date.parse(c.createdAt)) || (c.editedAt !== null && (typeof c.editedAt !== 'string' || !Number.isFinite(Date.parse(c.editedAt)))) || !Number.isSafeInteger(c.version) || c.version! < 0 || c.maxBodyLength !== 100000 || c.truncated !== false || !source || source.origin !== new URL(base).origin || source.protocol !== 'https:' || source.username || source.password) throw new TrackerFailure('unavailable', 502, 'Vector returned an incomplete, duplicate or foreign issue comment.')
   ids.add(c.id); result.push({ id: c.id, author: c.author.displayName, body: c.body, at: c.createdAt, url: source.href, truncated: c.truncated })
  }
  cursor = page.nextCursor!
  if (cursor) {
   if (cursors.has(cursor) || cursors.size >= 200 || page.comments.length === 0) throw new TrackerFailure('unavailable', 502, 'Vector comment pagination did not complete within the read bound.')
   cursors.add(cursor)
  }
 } while (cursor)
 if (result.length !== total) throw new TrackerFailure('unavailable', 502, 'Vector comment population is incomplete; read again.')
 return result
}
export const vector: Adapter = {
 name: 'Vector', credential: 'A Vector API token from Settings → Integrations → API tokens', permissions: 'issues:read, issues:write, comments:read, comments:write, metadata:read',
 projectLabel: 'Team ID (from Vector metadata)', baseLabel: 'Vector address', defaultBase: '',
 supportsDue: true, commentText: true, webhook: 'Vector outbound webhook (Base signed format, issue.created/updated/completed)',
 defaultPriorities: { critical: 'urgent', high: 'high', medium: 'medium', low: 'low' },
 fieldNotes: 'Priority, labels, assignee and due date are native fields. Configured label names must exist in workspace metadata.',
 async verify(base, token, _account, project) {
  if (!base) throw new TrackerFailure('invalid', 400, 'Give the Vector address, for example https://vector.example.com.')
  const meta = (await call(`${base}/api/v1/metadata`, { headers: headers(token), label })).body as { workspace?: { name?: string }; teams?: { id: string; name: string }[] }
  const team = meta.teams?.find(t => t.id === project)
  if (!team) throw new TrackerFailure('invalid', 400, 'That team is not visible to this Vector token.')
  return { account: String(meta.workspace?.name ?? 'Vector workspace'), projectName: team.name }
 },
 async create(d, token, draft) {
  const meta=(await call(`${d.api_base}/api/v1/metadata`,{headers:headers(token),label})).body as {labels?:{id:string;name:string}[]}
  if(!Array.isArray(meta?.labels))throw new TrackerFailure('unavailable',502,'Vector native label metadata is unavailable.')
  const body = { title: draft.title, teamId: d.project, description: draft.description, priority: draft.priority, labelIds:namedIds(meta.labels,draft.labels,label), dueDate: draft.due, ...(draft.assignee ? { assigneeOperatorId: draft.assignee } : {}) }
  const created = (await call(`${d.api_base}/api/v1/issues`, { method: 'POST', headers: headers(token), body: JSON.stringify(body), label })).body as { id: string; identifier: string }
  return { id: created.identifier, key: created.identifier, url: `${d.api_base}/app/issues/${created.identifier}` }
 },
 async read(d, token, t) {
  const i = await issue(d.api_base, token, t.remote_key) as { status?: { id?: string; name?: string; category?: string }; assignee?: { id?: string; name?: string } | null; dueDate?: string | null; activity?: { id: string; kind: string; at: string; actor: string | null; nextValue?: { id?: string } | null }[] }
  const category = String(i.status?.category ?? '')
  return {
   status_id: nativeId(i.status?.id), assignee_ids: i.assignee === null ? [] : nativeIds([i.assignee?.id]),
   status: `${i.status?.name ?? category} (${category})`, closed: category === 'completed' || category === 'canceled', assignee: i.assignee?.name ?? null, due: dateOnly(i.dueDate),
   comments: await comments(d.api_base, token, t.remote_key),
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
 // Vector refuses stale writes using the current native version.
 async setFields(d, token, t, fields, lastRead) {
  const current = await issue(d.api_base, token, t.remote_key) as { version?: number; status?: { id?: string }; assignee?: { id?: string } | null }
  assertFieldBaseline(lastRead, { status_id: nativeId(current.status?.id), assignee_ids: current.assignee === null ? [] : nativeIds([current.assignee?.id]) }, fields, label)
  if (!Number.isInteger(current.version)) throw new TrackerFailure('unavailable', 502, 'Vector did not return a write version.')
  await call(issuePath(d.api_base, t.remote_key), { method: 'PATCH', headers: headers(token), body: JSON.stringify({ expectedVersion: current.version, ...(fields.assignee !== undefined ? { assigneeOperatorId: fields.assignee } : {}), ...(fields.status !== undefined ? { statusId: fields.status } : {}) }), label })
 },
 // Change only the due date while retaining the native version guard.
 async setDue(d, token, t, due) {
  const current = await issue(d.api_base, token, t.remote_key) as { version: number }
  await call(issuePath(d.api_base, t.remote_key), { method: 'PATCH', headers: headers(token), body: JSON.stringify({ expectedVersion: current.version, dueDate: due }), label })
 },
}
