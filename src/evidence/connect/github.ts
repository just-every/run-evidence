import { scopedFetch } from '../ops/execution'
import { natural, protectionFields, record } from './github-schema'
// Read-only GitHub REST client for collection. Every call is a GET; nothing in
// this file can write to GitHub. Unreadable fields are null, never a pass.
export const connectorRevision = 'github-2'
export const readPermissions = ['Metadata: read', 'Administration: read (branch protection)', 'Dependabot alerts: read', 'Secret scanning alerts: read', 'Organization members: read (two-factor requirement)']
export class Throttled extends Error { constructor(public resetAt: number) { super('GitHub rate limit reached') } }
export class Unauthorized extends Error {}
interface Reply { status: number; body: unknown; message: string; next: string | null; scopes: string | null }
export function githubClient(base: string, token: string, now: () => number) {
 async function get(path: string): Promise<Reply> {
  const response = await scopedFetch(path.startsWith('http') ? path : base + path, { headers: { authorization: 'Bearer ' + token, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28', 'user-agent': 'evidence-collector' } })
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
  while (url && pages < limit) { const reply = await get(url); if (reply.status !== 200 || !Array.isArray(reply.body)) return { items: null, status: reply.status, complete: false, reason: reply.status === 200 ? 'schema drift: expected an array' : `GitHub answered ${reply.status}` }; items.push(...reply.body as Record<string, unknown>[]); url = reply.next; pages++ }
  return { items, status: 200, complete: !url, reason: url ? 'pagination incomplete: page limit reached' : '' }
 }
 return { get, all }
}
export type Client = ReturnType<typeof githubClient>
export async function readOrganization(client: Client, org: string) {
 const reply = await client.get('/orgs/' + encodeURIComponent(org))
 if (reply.status !== 200) return { readable: false as const, status: reply.status, scopes: reply.scopes }
 if (!record(reply.body)) return { readable: false as const, status: 200, scopes: reply.scopes, reason: 'schema drift: expected an organization object' }
 const body = reply.body, gaps = []
 if (typeof body.login !== 'string' || !body.login) gaps.push('schema drift: organization login')
 if (typeof body.two_factor_requirement_enabled !== 'boolean') gaps.push('schema drift: organization two-factor requirement')
 return { readable: true as const, scopes: reply.scopes, gaps, attributes: { login: typeof body.login === 'string' ? body.login : org, two_factor_requirement_enabled: typeof body.two_factor_requirement_enabled === 'boolean' ? body.two_factor_requirement_enabled : null } }
}
export async function listRepositories(client: Client, org: string) {
 const listed = await client.all(`/orgs/${encodeURIComponent(org)}/repos?per_page=100&type=all`)
 return listed.items && listed.complete && listed.items.every(r => record(r) && typeof r.full_name === 'string' && /^[^/\s]+\/[^/\s]+$/.test(r.full_name)) ? { complete: true, names: listed.items.map(r => String(r.full_name)) } : null
}
// One repository's evidence classes. A 403 or a 404 other than "not protected"
// is an unreadable class (null); the repository itself unreadable is reported.
export async function readRepository(client: Client, fullName: string) {
 const path = '/repos/' + fullName.split('/').map(encodeURIComponent).join('/')
 const repo = await client.get(path)
 if (repo.status !== 200) return { readable: false as const, reason: repo.status === 404 ? 'Repository not found or access revoked' : `GitHub answered ${repo.status}` }
 if (!record(repo.body)) return { readable: false as const, reason: 'schema drift: expected a repository object' }
 const body = repo.body, gaps: string[] = [], branch = typeof body.default_branch === 'string' && body.default_branch ? body.default_branch : null
 const attributes: Record<string, unknown> = { private: typeof body.private === 'boolean' ? body.private : null, archived: typeof body.archived === 'boolean' ? body.archived : null, default_branch: branch, branch_protection: null, required_reviews: null, required_status_checks: null, enforce_admins: null, open_critical_dependabot_alerts: null, open_secret_scanning_alerts: null }
 for (const field of ['private', 'archived', 'default_branch']) if (attributes[field] === null) gaps.push('schema drift: repository ' + field)
 if (branch) {
  const protection = await client.get(`${path}/branches/${encodeURIComponent(branch)}/protection`)
  if (protection.status === 200) {
   const parsed = protectionFields(protection.body)
   Object.assign(attributes, parsed.attributes); gaps.push(...parsed.gaps)
  } else if (protection.status === 404 && /not protected/i.test(protection.message)) { attributes.branch_protection = false; attributes.required_reviews = 0; attributes.required_status_checks = 0; attributes.enforce_admins = false }
  else gaps.push(`branch protection unreadable: GitHub answered ${protection.status}`)
 }
 const count = async (url: string, label: string) => {
  const listed = await client.all(url, 10)
  if (!listed.items || !listed.complete) { gaps.push(`${label}: ${listed.reason}`); return null }
  if (!listed.items.every(item => record(item) && natural(item.number) && item.number > 0)) { gaps.push(`schema drift: ${label} alert entries`); return null }
  return listed.items.length
 }
 attributes.open_critical_dependabot_alerts = await count(`${path}/dependabot/alerts?state=open&severity=critical&per_page=100`, 'Dependabot')
 attributes.open_secret_scanning_alerts = await count(`${path}/secret-scanning/alerts?state=open&per_page=100`, 'secret scanning')
 return { readable: true as const, attributes, gaps }
}
