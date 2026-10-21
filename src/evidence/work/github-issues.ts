import { call, TrackerFailure, type Adapter } from './client'
// GitHub Issues under a separate issue-write token: collection credentials
// (CONNECT-001) never hold Issues write. GitHub issues have no due date field,
// so the remediation deadline is written into the issue body and labels carry
// priority.
function bodyDue(body: string | null | undefined): string | null {
 const value = /^Evidence due date: (.*)$/m.exec(body ?? '')?.[1]
 if (!value || value === 'none') return null
 if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value + 'T00:00:00Z')) || new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) !== value) throw new TrackerFailure('unavailable', 502, 'GitHub issue has an invalid Evidence due date line; correct the date in the issue body.')
 return value
}
const label = 'GitHub Issues'
const headers = (token: string) => ({ authorization: 'Bearer ' + token, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28', 'user-agent': 'evidence-remediation', 'content-type': 'application/json' })
const repoPath = (d: { api_base: string; project: string }) => `${d.api_base}/repos/${d.project.split('/').map(encodeURIComponent).join('/')}`
export const githubIssues: Adapter = {
 name: 'GitHub Issues', credential: 'A fine-grained GitHub token for the repository below with Issues: read and write (and Metadata: read)', permissions: 'Issues: read and write; Metadata: read',
 projectLabel: 'Repository (owner/name)', baseLabel: 'GitHub API (GitHub Enterprise Server only)', defaultBase: 'https://api.github.com',
 supportsDue: true, commentText: true, webhook: 'GitHub repository webhook with a secret (X-Hub-Signature-256), events Issues and Issue comments',
 fieldNotes: 'GitHub Issues has no native due-date field. The editable Evidence due date line in the issue body is synchronized; removing it creates a visible conflict. Priority is a label.',
 defaultPriorities: { critical: 'priority: critical', high: 'priority: high', medium: 'priority: medium', low: 'priority: low' },
 async verify(base, token, _account, project) {
  if (!/^[A-Za-z0-9-]{1,39}\/[A-Za-z0-9._-]{1,100}$/.test(project)) throw new TrackerFailure('invalid', 400, 'Name the repository as owner/name.')
  const repo = (await call(repoPath({ api_base: base, project }), { headers: headers(token), label })).body as { full_name?: string; has_issues?: boolean; owner?: { login?: string } }
  if (repo.has_issues === false) throw new TrackerFailure('invalid', 400, 'Issues are turned off for that repository.')
  return { account: String(repo.owner?.login ?? project.split('/')[0]), projectName: String(repo.full_name ?? project) }
 },
 async create(d, token, draft) {
  const body = { title: draft.title, body: draft.description + `\n\nEvidence due date: ${draft.due ?? 'none'}`, labels: [...draft.labels, ...(draft.priority ? [draft.priority] : [])], ...(draft.assignee ? { assignees: [draft.assignee] } : {}) }
  const created = (await call(`${repoPath(d)}/issues`, { method: 'POST', headers: headers(token), body: JSON.stringify(body), label })).body as { number: number; html_url: string }
  return { id: String(created.number), key: `${d.project}#${created.number}`, url: created.html_url }
 },
 async read(d, token, t) {
  const issue = (await call(`${repoPath(d)}/issues/${encodeURIComponent(t.remote_id)}`, { headers: headers(token), label })).body as { state?: string; state_reason?: string | null; assignee?: { login?: string } | null; body?: string | null }
  const comments = (await call(`${repoPath(d)}/issues/${encodeURIComponent(t.remote_id)}/comments?per_page=100`, { headers: headers(token), label })).body as unknown
  if (!Array.isArray(comments)) throw new TrackerFailure('unavailable', 200, 'GitHub returned no comment list.')
  return { status: issue.state === 'closed' ? `closed (${issue.state_reason ?? 'completed'})` : 'open', closed: issue.state === 'closed', assignee: issue.assignee?.login ?? null, due: bodyDue(issue.body), comments: comments.map((c: { id: number; user?: { login?: string }; body?: string; created_at: string }) => ({ id: String(c.id), author: c.user?.login ?? 'GitHub user', body: String(c.body ?? ''), at: c.created_at })) }
 },
 async comment(d, token, t, body) { return String(((await call(`${repoPath(d)}/issues/${encodeURIComponent(t.remote_id)}/comments`, { method: 'POST', headers: headers(token), body: JSON.stringify({ body }), label })).body as { id: number }).id) },
 async setDue(d, token, t, due) {
  const url = `${repoPath(d)}/issues/${encodeURIComponent(t.remote_id)}`
  const issue = (await call(url, { headers: headers(token), label })).body as { body?: string | null }
  const original = issue.body ?? '', line = `Evidence due date: ${due ?? 'none'}`
  const body = /^Evidence due date:.*$/m.test(original) ? original.replace(/^Evidence due date:.*$/m, line) : original + `\n\n${line}`
  await call(url, { method: 'PATCH', headers: headers(token), body: JSON.stringify({ body }), label })
 },
 async reopen(d, token, t) { await call(`${repoPath(d)}/issues/${encodeURIComponent(t.remote_id)}`, { method: 'PATCH', headers: headers(token), body: JSON.stringify({ state: 'open' }), label }) },
}
