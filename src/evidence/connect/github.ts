// Read-only GitHub REST client for collection. Every call is a GET; nothing in
// this file can write to GitHub. Unreadable fields are null, never a pass.
export const connectorRevision = 'github-1'
export const readPermissions = ['Metadata: read', 'Administration: read (branch protection)', 'Dependabot alerts: read', 'Secret scanning alerts: read', 'Organization members: read (two-factor requirement)']
export class Throttled extends Error { constructor(public resetAt: number) { super('GitHub rate limit reached') } }
export class Unauthorized extends Error {}
interface Reply { status: number; body: unknown; message: string; next: string | null; scopes: string | null }
export function githubClient(base: string, token: string, now: () => number) {
 async function get(path: string): Promise<Reply> {
  const response = await fetch(path.startsWith('http') ? path : base + path, { headers: { authorization: 'Bearer ' + token, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28', 'user-agent': 'evidence-collector' } })
  const remaining = response.headers.get('x-ratelimit-remaining'), reset = Number(response.headers.get('x-ratelimit-reset') ?? 0) * 1000
  if (response.status === 429 || (response.status === 403 && remaining === '0')) throw new Throttled(reset > now() ? reset : now() + 60000)
  if (response.status === 401) throw new Unauthorized('GitHub rejected the credential')
  let body: unknown = null
  try { body = await response.json() } catch { body = null }
  const link = response.headers.get('link') ?? '', next = /<([^>]+)>;\s*rel="next"/.exec(link)?.[1] ?? null
  return { status: response.status, body, message: body && typeof body === 'object' && 'message' in body ? String((body as { message: unknown }).message) : '', next: next && next.startsWith(base) ? next : null, scopes: response.headers.get('x-oauth-scopes') }
 }
 async function all(path: string, limit = 20) {
  const items: Record<string, unknown>[] = []; let url: string | null = path, pages = 0
  while (url && pages < limit) { const reply = await get(url); if (reply.status !== 200 || !Array.isArray(reply.body)) return { items: null, status: reply.status, complete: false }; items.push(...reply.body as Record<string, unknown>[]); url = reply.next; pages++ }
  return { items, status: 200, complete: !url }
 }
 return { get, all }
}
export type Client = ReturnType<typeof githubClient>
export async function readOrganization(client: Client, org: string) {
 const reply = await client.get('/orgs/' + encodeURIComponent(org))
 if (reply.status !== 200) return { readable: false as const, status: reply.status, scopes: reply.scopes }
 const body = reply.body as Record<string, unknown>
 return { readable: true as const, scopes: reply.scopes, attributes: { login: String(body.login ?? org), two_factor_requirement_enabled: typeof body.two_factor_requirement_enabled === 'boolean' ? body.two_factor_requirement_enabled : null } }
}
export async function listRepositories(client: Client, org: string) {
 const listed = await client.all(`/orgs/${encodeURIComponent(org)}/repos?per_page=100&type=all`)
 return listed.items ? { complete: listed.complete, names: listed.items.map(r => String(r.full_name)) } : null
}
// One repository's evidence classes. A 403 or a 404 other than "not protected"
// is an unreadable class (null); the repository itself unreadable is reported.
export async function readRepository(client: Client, fullName: string) {
 const path = '/repos/' + fullName.split('/').map(encodeURIComponent).join('/')
 const repo = await client.get(path)
 if (repo.status !== 200) return { readable: false as const, reason: repo.status === 404 ? 'Repository not found or access revoked' : `GitHub answered ${repo.status}` }
 const body = repo.body as Record<string, unknown>, branch = String(body.default_branch ?? 'main')
 const attributes: Record<string, unknown> = { private: typeof body.private === 'boolean' ? body.private : null, archived: body.archived === true, default_branch: branch, branch_protection: null, required_reviews: null, required_status_checks: null, enforce_admins: null, open_critical_dependabot_alerts: null, open_secret_scanning_alerts: null }
 const protection = await client.get(`${path}/branches/${encodeURIComponent(branch)}/protection`)
 if (protection.status === 200) {
  const p = protection.body as { required_pull_request_reviews?: { required_approving_review_count?: number }; required_status_checks?: { contexts?: string[]; checks?: unknown[] }; enforce_admins?: { enabled?: boolean } }
  attributes.branch_protection = true
  attributes.required_reviews = p.required_pull_request_reviews ? p.required_pull_request_reviews.required_approving_review_count ?? 0 : 0
  attributes.required_status_checks = p.required_status_checks ? Math.max(p.required_status_checks.contexts?.length ?? 0, p.required_status_checks.checks?.length ?? 0) : 0
  attributes.enforce_admins = p.enforce_admins?.enabled ?? null
 } else if (protection.status === 404 && /not protected/i.test(protection.message)) { attributes.branch_protection = false; attributes.required_reviews = 0; attributes.required_status_checks = 0; attributes.enforce_admins = false }
 const count = async (url: string) => { const listed = await client.all(url, 10); return listed.items && listed.complete ? listed.items.length : null }
 attributes.open_critical_dependabot_alerts = await count(`${path}/dependabot/alerts?state=open&severity=critical&per_page=100`)
 attributes.open_secret_scanning_alerts = await count(`${path}/secret-scanning/alerts?state=open&per_page=100`)
 return { readable: true as const, attributes }
}
