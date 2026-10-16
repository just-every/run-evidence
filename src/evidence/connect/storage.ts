import type { Bindings } from '../../auth.server'
import { Refusal } from '../upload'
import { auditStatement, list, text, type Actor, type Input } from '../door'
import { catalogueStatements } from '../tests/storage'
import { seal } from './custody'
import { githubClient, listRepositories, readOrganization, Throttled, Unauthorized } from './github'
export interface Connection { id: string; provider: 'github'; label: string; account: string; api_base: string; secret_ciphertext: string | null; secret_iv: string | null; granted_scopes: string; status: 'active' | 'revoked' | 'needs reconnect' | 'inactive after restore'; created_by: string; created_name: string; created_at: string; rotated_at: string | null; revoked_at: string | null; last_success_at: string | null; last_attempt_at: string | null; next_attempt_at: string | null; backoff_seconds: number; last_error: string }
export const connections = async (env: Bindings) => (await env.DB.prepare('SELECT * FROM connections ORDER BY created_at').all<Connection>()).results
export async function requireConnection(env: Bindings, id: string) { const row = await env.DB.prepare('SELECT * FROM connections WHERE id=?').bind(id).first<Connection>(); if (!row) throw new Refusal('Connection not found.', 404); return row }
// GitHub Enterprise Server is supported by its /api/v3 base; only HTTPS hosts.
function apiBase(value: unknown) {
 if (typeof value !== 'string' || !value.trim()) return 'https://api.github.com'
 let url: URL
 try { url = new URL(value.trim()) } catch { throw new Refusal('The API base must be an https URL.') }
 if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) throw new Refusal('The API base must be a plain https URL.')
 // Collection reads only public provider hosts: no IP literals or local names.
 if (/^\[|^\d+\.\d+\.\d+\.\d+$/.test(url.hostname) || !url.hostname.includes('.') || /\.(local|internal|localhost|lan|home)$/i.test(url.hostname)) throw new Refusal('The API base must be a public host name.')
 return url.origin + url.pathname.replace(/\/+$/, '')
}
// Check a credential against the real provider before it is kept.
async function verify(base: string, org: string, token: string, now: Date) {
 const client = githubClient(base, token, () => now.getTime())
 try {
  const organization = await readOrganization(client, org)
  if (!organization.readable) throw new Refusal(organization.status === 404 ? `The organization ${org} is not visible to this credential.` : `GitHub answered ${organization.status} for the organization.`)
  const repos = await listRepositories(client, org)
  if (!repos) throw new Refusal('This credential cannot list the organization\'s repositories (needs Metadata: read).')
  return { scopes: organization.scopes, repos: repos.names }
 } catch (error) {
  if (error instanceof Unauthorized) throw new Refusal('GitHub rejected the credential.')
  if (error instanceof Throttled) throw new Refusal('GitHub is rate limiting this credential; try again after ' + new Date(error.resetAt).toISOString() + '.', 429)
  throw error
 }
}
export async function connectGithub(env: Bindings, actor: Actor, input: Input, now: Date) {
 const org = text(input, 'account', 100), token = text(input, 'token', 400), label = text(input, 'label', 120, true) || 'GitHub ' + org, base = apiBase(input.api_base)
 if (!/^[A-Za-z0-9-]{1,39}$/.test(org)) throw new Refusal('Name the GitHub organization login.')
 if (await env.DB.prepare("SELECT 1 FROM connections WHERE provider='github' AND account=? AND api_base=? AND status!='revoked'").bind(org, base).first()) throw new Refusal('This organization is already connected; rotate or revoke that connection.', 409)
 const checked = await verify(base, org, token, now), id = crypto.randomUUID(), sealed = await seal(env, token, id), at = now.toISOString()
 await env.DB.batch([
  env.DB.prepare("INSERT INTO connections(id,provider,label,account,api_base,secret_ciphertext,secret_iv,granted_scopes,status,created_by,created_name,created_at) VALUES(?,'github',?,?,?,?,?,?,'active',?,?,?)").bind(id, label, org, base, sealed.ciphertext, sealed.iv, JSON.stringify(checked.scopes === null ? ['fine-grained token: permissions checked on each read'] : checked.scopes.split(',').map(s => s.trim()).filter(Boolean)), actor.id, actor.name, at),
  ...checked.repos.map(name => env.DB.prepare('INSERT INTO connection_repositories(connection_id,full_name,selected) VALUES(?,?,0)').bind(id, name)),
  auditStatement(env, actor, 'connection.authorized', 'connection:' + id, now, 'succeeded', `github ${org}`),
  ...await catalogueStatements(env, 'github', actor, now),
 ])
 return { id, repositories: checked.repos }
}
// Rotation replaces the credential after a fresh provider check; it also
// reconnects a revoked or broken connection with new authority only.
export async function rotateCredential(env: Bindings, actor: Actor, id: string, input: Input, now: Date) {
 const row = await requireConnection(env, id), token = text(input, 'token', 400)
 const checked = await verify(row.api_base, row.account, token, now), sealed = await seal(env, token, id)
 await env.DB.batch([
  env.DB.prepare("UPDATE connections SET secret_ciphertext=?,secret_iv=?,status='active',rotated_at=?,revoked_at=NULL,last_error='',backoff_seconds=0,next_attempt_at=NULL WHERE id=?").bind(sealed.ciphertext, sealed.iv, now.toISOString(), id),
  ...checked.repos.map(name => env.DB.prepare('INSERT OR IGNORE INTO connection_repositories(connection_id,full_name,selected) VALUES(?,?,0)').bind(id, name)),
  auditStatement(env, actor, row.status === 'active' ? 'connection.rotated' : 'connection.reconnected', 'connection:' + id, now),
 ])
}
// Revocation destroys the stored credential; nothing can resurrect it.
export async function revokeConnection(env: Bindings, actor: Actor, id: string, now: Date) {
 await requireConnection(env, id)
 await env.DB.batch([env.DB.prepare("UPDATE connections SET status='revoked',secret_ciphertext=NULL,secret_iv=NULL,revoked_at=? WHERE id=?").bind(now.toISOString(), id), auditStatement(env, actor, 'connection.revoked', 'connection:' + id, now)])
}
export async function selectRepositories(env: Bindings, actor: Actor, id: string, input: Input, now: Date) {
 await requireConnection(env, id)
 const chosen = list(input, 'repositories', 500), known = new Set((await env.DB.prepare('SELECT full_name FROM connection_repositories WHERE connection_id=?').bind(id).all<{ full_name: string }>()).results.map(r => r.full_name))
 if (chosen.some(r => !known.has(r))) throw new Refusal('Choose repositories this connection listed.')
 await env.DB.batch([
  env.DB.prepare('UPDATE connection_repositories SET selected=0 WHERE connection_id=?').bind(id),
  ...chosen.map(r => env.DB.prepare('UPDATE connection_repositories SET selected=1 WHERE connection_id=? AND full_name=?').bind(id, r)),
  auditStatement(env, actor, 'connection.scope', 'connection:' + id, now, 'succeeded', chosen.join(', ').slice(0, 400)),
 ])
}
export const repositories = async (env: Bindings, id: string) => (await env.DB.prepare('SELECT full_name,selected FROM connection_repositories WHERE connection_id=? ORDER BY full_name').bind(id).all<{ full_name: string; selected: number }>()).results
export const runs = async (env: Bindings, id: string) => (await env.DB.prepare('SELECT * FROM collection_runs WHERE connection_id=? ORDER BY started_at DESC LIMIT 100').bind(id).all<{ id: string; trigger: string; connector_revision: string; started_at: string; finished_at: string | null; outcome: string | null; coverage_json: string; error_code: string }>()).results
