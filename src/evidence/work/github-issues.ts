import { call, TrackerFailure, type Adapter } from './client'
// GitHub Issues under a separate issue-write token: collection credentials
// (CONNECT-001) never hold Issues write. GitHub issues have no due date field,
// so the remediation deadline is written into the issue body and labels carry
// priority.
const label = 'GitHub Issues'
const headers = (token: string) => ({ authorization: 'Bearer ' + token, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28', 'user-agent': 'evidence-remediation', 'content-type': 'application/json' })
const repoPath = (d: { api_base: string; project: string }) => `${d.api_base}/repos/${d.project.split('/').map(encodeURIComponent).join('/')}`
export const githubIssues: Adapter = {
 name: 'GitHub Issues', credential: 'A fine-grained GitHub token for the repository below with Issues: read and write (and Metadata: read)', permissions: 'Issues: read and write; Metadata: read',
 projectLabel: 'Repository (owner/name)', baseLabel: 'GitHub API (GitHub Enterprise Server only)', defaultBase: 'https://api.github.com',
 supportsDue: false, commentText: true, webhook: 'GitHub repository webhook with a secret (X-Hub-Signature-256), events Issues and Issue comments',
 defaultPriorities: { critical: 'priority: critical', high: 'priority: high', medium: 'priority: medium', low: 'priority: low' },
 async verify(base, token, _account, project) {
  if (!/^[A-Za-z0-9-]{1,39}\/[A-Za-z0-9._-]{1,100}$/.test(project)) throw new TrackerFailure('invalid', 400, 'Name the repository as owner/name.')
  const repo = (await call(repoPath({ api_base: base, project }), { headers: headers(token), label })).body as { full_name?: string; has_issues?: boolean; owner?: { login?: string } }
  if (repo.has_issues === false) throw new TrackerFailure('invalid', 400, 'Issues are turned off for that repository.')
  return { account: String(repo.owner?.login ?? project.split('/')[0]), projectName: String(repo.full_name ?? project) }
 },
 async create(d, token, draft) {
  const body = { title: draft.title, body: draft.description + (draft.due ? `\n\nRemediate by ${draft.due} (Evidence SLA).` : ''), labels: [...draft.labels, ...(draft.priority ? [draft.priority] : [])], ...(draft.assignee ? { assignees: [draft.assignee] } : {}) }
  const created = (await call(`${repoPath(d)}/issues`, { method: 'POST', headers: headers(token), body: JSON.stringify(body), label })).body as { number: number; html_url: string }
  return { id: String(created.number), key: `${d.project}#${created.number}`, url: created.html_url }
 },
 async read(d, token, t) {
  const issue = (await call(`${repoPath(d)}/issues/${encodeURIComponent(t.remote_id)}`, { headers: headers(token), label })).body as { state?: string; state_reason?: string | null; assignee?: { login?: string } | null }
  const comments = (await call(`${repoPath(d)}/issues/${encodeURIComponent(t.remote_id)}/comments?per_page=100`, { headers: headers(token), label })).body as unknown
  if (!Array.isArray(comments)) throw new TrackerFailure('unavailable', 200, 'GitHub returned no comment list.')
  return { status: issue.state === 'closed' ? `closed (${issue.state_reason ?? 'completed'})` : 'open', closed: issue.state === 'closed', assignee: issue.assignee?.login ?? null, due: null, comments: comments.map((c: { id: number; user?: { login?: string }; body?: string; created_at: string }) => ({ id: String(c.id), author: c.user?.login ?? 'GitHub user', body: String(c.body ?? ''), at: c.created_at })) }
 },
 async comment(d, token, t, body) { return String(((await call(`${repoPath(d)}/issues/${encodeURIComponent(t.remote_id)}/comments`, { method: 'POST', headers: headers(token), body: JSON.stringify({ body }), label })).body as { id: number }).id) },
 async setDue() { throw new TrackerFailure('invalid', 400, 'GitHub issues have no due date field.') },
 async reopen(d, token, t) { await call(`${repoPath(d)}/issues/${encodeURIComponent(t.remote_id)}`, { method: 'PATCH', headers: headers(token), body: JSON.stringify({ state: 'open' }), label }) },
}
