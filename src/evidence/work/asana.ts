import { call, dateOnly, TrackerFailure, type Adapter } from './client'
// Asana REST API 1.0 with a personal access token. Tasks have no native
// priority, so priority travels as a tag-free line in the notes. This round
// reads Asana by polling within the 15-minute sync interval.
const label = 'Asana'
const headers = (token: string) => ({ authorization: 'Bearer ' + token, accept: 'application/json', 'content-type': 'application/json' })
const data = <T>(reply: { body: Record<string, unknown> }) => reply.body.data as T
export const asana: Adapter = {
 name: 'Asana', credential: 'An Asana personal access token (My settings → Apps → Developer apps)', permissions: 'Read and write tasks and comments in the chosen project',
 projectLabel: 'Project GID', baseLabel: 'Asana API', defaultBase: 'https://app.asana.com/api/1.0',
 supportsDue: true, commentText: true, webhook: 'polling every 10 minutes',
 defaultPriorities: { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low' },
 async verify(base, token, _account, project) {
  if (!/^\d{1,30}$/.test(project)) throw new TrackerFailure('invalid', 400, 'Give the Asana project GID (the number in the project URL).')
  const me = data<{ name: string; email?: string }>(await call(`${base}/users/me`, { headers: headers(token), label }))
  const found = data<{ name: string }>(await call(`${base}/projects/${project}?opt_fields=name`, { headers: headers(token), label }))
  return { account: me.email ?? me.name, projectName: found.name }
 },
 async create(d, token, draft) {
  const body = { data: { name: draft.title, notes: `${draft.description}\n\nPriority: ${draft.priority}`, projects: [d.project], ...(draft.due ? { due_on: draft.due } : {}), ...(draft.assignee ? { assignee: draft.assignee } : {}) } }
  const created = data<{ gid: string; permalink_url?: string }>(await call(`${d.api_base}/tasks?opt_fields=gid,permalink_url`, { method: 'POST', headers: headers(token), body: JSON.stringify(body), label }))
  return { id: created.gid, key: created.gid, url: created.permalink_url ?? `https://app.asana.com/0/${d.project}/${created.gid}` }
 },
 async read(d, token, t) {
  const task = data<{ completed?: boolean; assignee?: { name?: string } | null; due_on?: string | null }>(await call(`${d.api_base}/tasks/${encodeURIComponent(t.remote_id)}?opt_fields=completed,assignee.name,due_on`, { headers: headers(token), label }))
  const stories = data<{ gid: string; resource_subtype?: string; text?: string; created_at: string; created_by?: { name?: string } | null }[]>(await call(`${d.api_base}/tasks/${encodeURIComponent(t.remote_id)}/stories?opt_fields=resource_subtype,text,created_at,created_by.name`, { headers: headers(token), label }))
  return { status: task.completed ? 'completed' : 'incomplete', closed: task.completed === true, assignee: task.assignee?.name ?? null, due: dateOnly(task.due_on), comments: stories.filter(s => s.resource_subtype === 'comment_added').map(s => ({ id: s.gid, author: s.created_by?.name ?? 'Asana user', body: String(s.text ?? ''), at: s.created_at })) }
 },
 async comment(d, token, t, body) { return data<{ gid: string }>(await call(`${d.api_base}/tasks/${encodeURIComponent(t.remote_id)}/stories`, { method: 'POST', headers: headers(token), body: JSON.stringify({ data: { text: body } }), label })).gid },
 async reopen(d, token, t) { await call(`${d.api_base}/tasks/${encodeURIComponent(t.remote_id)}`, { method: 'PUT', headers: headers(token), body: JSON.stringify({ data: { completed: false } }), label }) },
 async setDue(d, token, t, due) { await call(`${d.api_base}/tasks/${encodeURIComponent(t.remote_id)}`, { method: 'PUT', headers: headers(token), body: JSON.stringify({ data: { due_on: due } }), label }) },
}
