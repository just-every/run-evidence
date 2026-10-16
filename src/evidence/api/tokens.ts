import type { Bindings } from '../../auth.server'
import { Refusal } from '../upload'
import { auditStatement, list, text, type Actor, type Input } from '../door'
// API-001 tokens: scoped, expiring, revocable and bound to this installation.
// Only a SHA-256 digest is stored; the token is shown once at issue. No scope
// approves, publishes or changes roles.
export const scopes = ['read', 'resource-push', 'evidence-push', 'test-write', 'risk-push'] as const
export type Scope = typeof scopes[number]
export interface ApiToken { id: string; name: string; scopes: string; created_by: string; created_name: string; created_at: string; expires_at: string; revoked_at: string | null; revoked_by: string | null }
const hex = (bytes: ArrayBuffer | Uint8Array) => Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('')
export const digest = async (value: string) => hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))
export const installationTag = async (env: Bindings) => (await digest('evidence-installation:' + env.AUTH_ORIGIN)).slice(0, 10)
export async function issueApiToken(env: Bindings, actor: Actor, input: Input, now: Date) {
 const name = text(input, 'name', 120), granted = list(input, 'scopes', scopes.length)
 if (!granted.length || granted.some(s => !(scopes as readonly string[]).includes(s))) throw new Refusal(`Choose scopes from ${scopes.join(', ')}.`)
 const expiresInput = text(input, 'expires_at', 40), expires = Date.parse(expiresInput.length === 10 ? expiresInput + 'T00:00:00Z' : expiresInput.endsWith('Z') ? expiresInput : expiresInput + 'Z')
 if (!Number.isFinite(expires) || expires <= now.getTime() || expires > now.getTime() + 366 * 86400000) throw new Refusal('Tokens expire within a year; choose a future expiry.')
 const random = new Uint8Array(32); crypto.getRandomValues(random)
 const token = `evd_${await installationTag(env)}_${btoa(String.fromCharCode(...random)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`
 const id = crypto.randomUUID()
 await env.DB.batch([
  env.DB.prepare('INSERT INTO api_tokens(id,name,scopes,token_hash,created_by,created_name,created_at,expires_at) VALUES(?,?,?,?,?,?,?,?)').bind(id, name, JSON.stringify(granted), await digest(token), actor.id, actor.name, now.toISOString(), new Date(expires).toISOString()),
  auditStatement(env, actor, 'api.token-issued', 'api-token:' + id, now, 'succeeded', `${name}: ${granted.join(' ')}`),
 ])
 return { token, grant: { id, name, scopes: granted, expires_at: new Date(expires).toISOString() } }
}
export async function revokeApiToken(env: Bindings, actor: Actor, id: string, now: Date) {
 const changed = await env.DB.prepare('UPDATE api_tokens SET revoked_at=?,revoked_by=? WHERE id=? AND revoked_at IS NULL').bind(now.toISOString(), actor.id, id).run()
 if (!changed.meta.changes) throw new Refusal('Active token not found.', 404)
 await auditStatement(env, actor, 'api.token-revoked', 'api-token:' + id, now).run()
}
export const apiTokens = async (env: Bindings) => (await env.DB.prepare('SELECT id,name,scopes,created_by,created_name,created_at,expires_at,revoked_at,revoked_by FROM api_tokens ORDER BY created_at DESC').all<ApiToken>()).results
export type Authenticated = { ok: true; token: ApiToken; scopes: Scope[] } | { ok: false; status: 401; error: string }
export async function authenticate(env: Bindings, header: string | null, now: Date): Promise<Authenticated> {
 const match = /^Bearer (evd_([a-f0-9]{10})_[A-Za-z0-9_-]{43})$/.exec(header ?? '')
 if (!match) return { ok: false, status: 401, error: 'Send an Evidence API token as a Bearer token.' }
 if (match[2] !== await installationTag(env)) return { ok: false, status: 401, error: 'This token belongs to another Evidence installation.' }
 const token = await env.DB.prepare('SELECT id,name,scopes,created_by,created_name,created_at,expires_at,revoked_at,revoked_by FROM api_tokens WHERE token_hash=?').bind(await digest(match[1])).first<ApiToken>()
 if (!token || token.revoked_at || Date.parse(token.expires_at) <= now.getTime()) return { ok: false, status: 401, error: 'The token is unknown, revoked or expired.' }
 return { ok: true, token, scopes: JSON.parse(token.scopes) }
}
