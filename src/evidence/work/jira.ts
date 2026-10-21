import { nativeId, nativeIds, call, dateOnly, TrackerFailure, type Adapter } from './client'
// Jira Cloud REST API v3 with an Atlassian account email and API token (basic
// auth). Descriptions and comments are Atlassian Document Format.
const label = 'Jira Cloud'
const headers = (account: string, token: string) => ({ authorization: 'Basic ' + btoa(`${account}:${token}`), accept: 'application/json', 'content-type': 'application/json' })
const adf = (text: string) => ({ type: 'doc', version: 1, content: text.split(/\n{2,}/).map(block => ({ type: 'paragraph', content: block.split('\n').flatMap((line, i) => [...(i ? [{ type: 'hardBreak' }] : []), ...(line ? [{ type: 'text', text: line }] : [])]) })) })
// Plain text of an ADF node tree (comments read back from Jira).
const plain = (node: unknown): string => {
 if (!node || typeof node !== 'object') return ''
 const n = node as { type?: string; text?: string; content?: unknown[] }
 if (n.type === 'text') return n.text ?? ''
 if (n.type === 'hardBreak') return '\n'
 const inner = (n.content ?? []).map(plain).join('')
 return n.type === 'paragraph' ? inner + '\n' : inner
}
const issueUrl = (d: { api_base: string }, key: string) => `${d.api_base}/rest/api/3/issue/${encodeURIComponent(key)}`
export const jira: Adapter = {
 name: 'Jira Cloud', credential: 'An Atlassian API token for the account email below (id.atlassian.com → Security → API tokens)', permissions: 'Browse projects, Create issues, Edit issues, Add comments in the chosen project',
 projectLabel: 'Project key', baseLabel: 'Jira site (https://SITE.atlassian.net)', defaultBase: '',
 supportsDue: true, commentText: true, webhook: 'Jira Cloud webhook with a secret (X-Hub-Signature), events issue updated and comment created',
 defaultPriorities: { critical: 'Highest', high: 'High', medium: 'Medium', low: 'Low' },
 async verify(base, token, account, project) {
  if (!/^https:\/\/[a-z0-9-]+\.atlassian\.net$/i.test(base)) throw new TrackerFailure('invalid', 400, 'Give the Jira Cloud site, for example https://example.atlassian.net.')
  const me = (await call(`${base}/rest/api/3/myself`, { headers: headers(account, token), label })).body as { displayName?: string; emailAddress?: string }
  const found = (await call(`${base}/rest/api/3/project/${encodeURIComponent(project)}`, { headers: headers(account, token), label })).body as { name?: string }
  return { account: String(me.emailAddress ?? account), projectName: String(found.name ?? project) }
 },
 async create(d, token, draft) {
  const fields: Record<string, unknown> = { project: { key: d.project }, summary: draft.title, issuetype: { name: d.mapping.issue_type || 'Task' }, description: adf(draft.description), labels: draft.labels, priority: { name: draft.priority } }
  if (draft.due) fields.duedate = draft.due
  if (draft.assignee) fields.assignee = { accountId: draft.assignee }
  const created = (await call(`${d.api_base}/rest/api/3/issue`, { method: 'POST', headers: headers(d.account, token), body: JSON.stringify({ fields }), label })).body as { id: string; key: string }
  return { id: String(created.id), key: created.key, url: `${d.api_base}/browse/${created.key}` }
 },
 async read(d, token, t) {
  const issue = (await call(`${issueUrl(d, t.remote_key)}?fields=status,assignee,duedate`, { headers: headers(d.account, token), label })).body as { fields?: { status?: { id?: string; name?: string; statusCategory?: { key?: string } }; assignee?: { accountId?: string; displayName?: string } | null; duedate?: string | null } }
  const comments = (await call(`${issueUrl(d, t.remote_key)}/comment?orderBy=created&maxResults=100`, { headers: headers(d.account, token), label })).body as { comments?: { id: string; author?: { displayName?: string }; body?: unknown; created: string }[] }
  const status = issue.fields?.status
  return {
   status_id: nativeId(status?.id), assignee_ids: issue.fields?.assignee === null ? [] : issue.fields?.assignee ? nativeIds([issue.fields.assignee.accountId]) : null,
   status: String(status?.name ?? ''), closed: status?.statusCategory?.key === 'done', assignee: issue.fields?.assignee?.displayName ?? null, due: dateOnly(issue.fields?.duedate),
   comments: (comments.comments ?? []).map(c => ({ id: String(c.id), author: c.author?.displayName ?? 'Jira user', body: plain(c.body).trim(), at: c.created })),
  }
 },
 async comment(d, token, t, body) { return String(((await call(`${issueUrl(d, t.remote_key)}/comment`, { method: 'POST', headers: headers(d.account, token), body: JSON.stringify({ body: adf(body) }), label })).body as { id: string }).id) },
 async reopen(d, token, t) {
  const transitions = (await call(`${issueUrl(d, t.remote_key)}/transitions`, { headers: headers(d.account, token), label })).body as { transitions?: { id: string; to?: { statusCategory?: { key?: string } } }[] }
  const back = transitions.transitions?.find(x => x.to?.statusCategory?.key === 'new') ?? transitions.transitions?.find(x => x.to?.statusCategory?.key === 'indeterminate')
  if (!back) throw new TrackerFailure('invalid', 400, 'No Jira transition leads back to an open status.')
  await call(`${issueUrl(d, t.remote_key)}/transitions`, { method: 'POST', headers: headers(d.account, token), body: JSON.stringify({ transition: { id: back.id } }), label })
 },
 async setFields(d, token, t, fields) {
  // A mapped status is a destination status ID, never a guessed transition name.
  const values = fields.assignee === undefined ? {} : { assignee: fields.assignee === null ? null : { accountId: fields.assignee } }
  if (fields.status !== undefined) {
   const result = (await call(`${issueUrl(d, t.remote_key)}/transitions`, { headers: headers(d.account, token), label })).body as { transitions?: { id: string; to?: { id?: string } }[] }
   const transitions = result.transitions?.filter(x => x.to?.id === fields.status) ?? []
   if (transitions.length !== 1) throw new TrackerFailure('invalid', 400, 'Jira status mapping must lead through exactly one available transition.')
   await call(`${issueUrl(d, t.remote_key)}/transitions`, { method: 'POST', headers: headers(d.account, token), body: JSON.stringify({ transition: { id: transitions[0].id }, ...(fields.assignee !== undefined ? { fields: values } : {}) }), label })
  } else {
   await call(issueUrl(d, t.remote_key), { method: 'PUT', headers: headers(d.account, token), body: JSON.stringify({ fields: values }), label })
  }
 },
 async setDue(d, token, t, due) { await call(issueUrl(d, t.remote_key), { method: 'PUT', headers: headers(d.account, token), body: JSON.stringify({ fields: { duedate: due } }), label }) },
}
