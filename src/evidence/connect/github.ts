import { scopedFetch } from '../ops/execution'
import { natural, protectionFields, record } from './github-schema'
// Read-only GitHub REST client for collection. Every call is a GET; nothing in
// this file can write to GitHub. Unreadable fields are null, never a pass.
export const connectorRevision = 'github-2'
export const readPermissions = ['Metadata: read', 'Administration: read (branch protection)', 'Dependabot alerts: read', 'Secret scanning alerts: read', 'Organization members: read (two-factor requirement)']
export class Throttled extends Error { constructor(public resetAt: number) { super('GitHub rate limit reached') } }
export class Unauthorized extends Error {}
interface Reply { status: number; body: unknown; message: string; next: string | null; scopes: string | null }
export interface AlertCursor { numbers: number[]; next: string | null; complete: boolean; seen: string[] }
export interface AlertProgress { load(path: string): AlertCursor | undefined; save(path: string, cursor: AlertCursor | null): Promise<boolean> }
export function githubClient(base: string, token: string, now: () => number, progress?: AlertProgress) {
 async function get(path: string): Promise<Reply> {
  const response = await scopedFetch(path.startsWith('http') ? path : base + path, { headers: { authorization: 'Bearer ' + token, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28', 'user-agent': 'evidence-collector' } })
  const remaining = response.headers.get('x-ratelimit-remaining'), reset = Number(response.headers.get('x-ratelimit-reset') ?? 0) * 1000
  if (response.status === 429 || (response.status === 403 && remaining === '0')) throw new Throttled(reset > now() ? reset : now() + 60000)
  if (response.status === 401) throw new Unauthorized('GitHub rejected the credential')
  let body: unknown = null
  try { body = await response.json() } catch { body = null }
  const link = response.headers.get('link') ?? '', next = /<([^>]+)>;\s*rel="next"/.exec(link)?.[1] ?? null
  return { status: response.status, body, message: body && typeof body === 'object' && 'message' in body ? String((body as { message: unknown }).message) : '', next, scopes: response.headers.get('x-oauth-scopes') }
 }
 async function all(path: string, limit = 20) {
  const tracked = !!progress && /\/(dependabot|secret-scanning)\/alerts\?/.test(path), saved = tracked ? progress!.load(path) : undefined
  const items: Record<string, unknown>[] = saved ? saved.numbers.map(number => ({ number })) : []
  if (saved?.complete) return { items, status: 200, complete: true, reason: '' }
  const seen = new Set(saved?.seen ?? []), endpoint = new URL(base + path)
  let url: string | null = saved?.next ?? path, pages = 0
  const invalid = async (reason: string, status = 200) => { if (tracked) await progress!.save(path,null); return { items: null, status, complete: false, reason } }
  while (url && pages < limit) {
   let target: URL
   try { target = new URL(url.startsWith('http') ? url : base + url) } catch { return invalid('pagination incomplete: invalid continuation') }
   if (target.origin !== endpoint.origin || target.pathname !== endpoint.pathname || target.username || target.password || target.hash || seen.has(target.href)) return invalid('pagination incomplete: unsafe or repeated continuation')
   const snapshot = (next: string | null, complete: boolean): AlertCursor => ({ numbers: items.map(i => Number(i.number)), next, complete, seen: [...seen] })
   // Persist the next request before the network edge. A lost response resumes
   // that page; completed earlier pages are not requested or counted again.
   if (tracked && !await progress!.save(path,snapshot(target.href,false))) return invalid('pagination incomplete: durable cursor exceeds 64 KiB; narrow repository scope')
   const reply = await get(target.href)
   if (reply.status !== 200 || !Array.isArray(reply.body)) return invalid(reply.status === 200 ? 'schema drift: expected an array' : `GitHub answered ${reply.status}`, reply.status)
   if (tracked && !reply.body.every(i => record(i) && natural(i.number) && i.number > 0)) return invalid('schema drift: alert entries')
   if (tracked) {
    const numbers = new Set(items.map(i => i.number))
    for (const item of reply.body as {number:number}[]) if (!numbers.has(item.number)) { items.push({number:item.number}); numbers.add(item.number) }
   } else items.push(...reply.body as Record<string, unknown>[])
   seen.add(target.href); url = reply.next; pages++
   if (tracked && !await progress!.save(path,snapshot(url,!url))) return invalid('pagination incomplete: durable cursor exceeds 64 KiB; narrow repository scope')
  }
  return { items, status: 200, complete: !url, reason: url ? 'pagination incomplete: page limit reached; durable cursor retained' : '' }
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
