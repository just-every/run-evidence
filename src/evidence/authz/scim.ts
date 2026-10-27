import type { Bindings } from '../../auth.server'
import { auditStatement } from '../door'
import { Refusal } from '../upload'
// AUTH-001: SCIM 2.0 provisioning. An identity provider pushes people with a
// scoped, expiring bearer token that opens this door and no other. Deprovisioning
// ends the account, its sessions and its roles at once.
const SCHEMA = 'urn:ietf:params:scim:schemas:core:2.0:User', LIST = 'urn:ietf:params:scim:api:messages:2.0:ListResponse', ERROR = 'urn:ietf:params:scim:api:messages:2.0:Error'
const headers = { 'content-type': 'application/scim+json', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }
const scim = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers })
const fail = (status: number, detail: string, scimType?: string) => scim({ schemas: [ERROR], status: String(status), detail, ...(scimType ? { scimType } : {}) }, status)
export const digest = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))).map(n => n.toString(16).padStart(2, '0')).join('')
interface Token { id: string; provider: string }
interface Row { id: string; external_id: string; user_name: string; email: string; display_name: string; active: number; created_at: string; updated_at: string }
const resource = (r: Row, origin: string) => ({ schemas: [SCHEMA], id: r.id, externalId: r.external_id, userName: r.user_name, displayName: r.display_name, name: { formatted: r.display_name }, emails: [{ value: r.email, primary: true }], active: !!r.active, meta: { resourceType: 'User', created: r.created_at, lastModified: r.updated_at, location: `${origin}/scim/v2/Users/${r.id}` } })

async function authenticate(env: Bindings, request: Request, now: Date): Promise<Token | null> {
 const match = /^Bearer ([A-Za-z0-9_-]{32,200})$/.exec(request.headers.get('authorization') ?? '')
 if (!match) return null
 const row = await env.DB.prepare('SELECT id,provider FROM scim_tokens WHERE token_sha256=? AND revoked_at IS NULL AND expires_at>?').bind(await digest(match[1]), now.toISOString()).first<Token>()
 if (row) await env.DB.prepare('UPDATE scim_tokens SET last_used_at=? WHERE id=?').bind(now.toISOString(), row.id).run()
 return row
}
const body = async (request: Request) => { try { const v = await request.json(); if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown> } catch { /* falls through */ } throw new Refusal('Send one SCIM JSON object.') }
const str = (v: unknown, max = 255) => typeof v === 'string' && v.trim() && v.length <= max ? v.trim() : ''
function email(input: Record<string, unknown>) {
 const emails = Array.isArray(input.emails) ? input.emails as { value?: unknown; primary?: unknown }[] : []
 const value = str(emails.find(e => e?.primary === true)?.value ?? emails[0]?.value ?? input.userName, 254).toLowerCase()
 if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) throw new Refusal('userName or a primary email must be a real address.')
 return value
}
const nameOf = (input: Record<string, unknown>, fallback: string) => {
 const n = (input.name ?? {}) as { formatted?: unknown; givenName?: unknown; familyName?: unknown }
 return str(input.displayName, 200) || str(n.formatted, 200) || [str(n.givenName, 100), str(n.familyName, 100)].filter(Boolean).join(' ') || fallback
}
const actorOf = (token: Token) => ({ id: 'scim:' + token.id, name: 'SCIM ' + token.provider, kind: 'token' as const })

async function provision(env: Bindings, token: Token, input: Record<string, unknown>, now: Date) {
 const address = email(input), external = str(input.externalId) || str(input.id) || address, display = nameOf(input, address), at = now.toISOString()
 if (await env.DB.prepare('SELECT 1 FROM scim_users WHERE provider=? AND (external_id=? OR user_name=?)').bind(token.provider, external, address).first()) throw new Refusal('That user is already provisioned.', 409)
 // Never take over an account that exists for another reason: the owner, an auditor or an invited person.
 if (await env.DB.prepare('SELECT 1 FROM oa_operators WHERE email=?').bind(address).first()) throw new Refusal('An account with that address already exists.', 409)
 const id = crypto.randomUUID(), operator = crypto.randomUUID(), person = (await env.DB.prepare('SELECT id FROM people WHERE email=?').bind(address).first<{ id: string }>())?.id ?? crypto.randomUUID()
 const known = await env.DB.prepare('SELECT 1 FROM people WHERE id=?').bind(person).first()
 await env.DB.batch([
  env.DB.prepare("INSERT INTO oa_operators(id,email,display_name,role,status,created_at) VALUES(?,?,?,'member','active',?)").bind(operator, address, display, now.getTime()),
  ...(known ? [] : [env.DB.prepare("INSERT INTO people(id,name,email,kind,created_at,created_by) VALUES(?,?,?,'employee',?,?)").bind(person, display, address, at, 'scim:' + token.id)]),
  env.DB.prepare('INSERT INTO scim_users(id,provider,external_id,user_name,email,display_name,active,operator_id,person_id,created_at,updated_at) VALUES(?,?,?,?,?,?,1,?,?,?,?)').bind(id, token.provider, external, address, address, display, operator, person, at, at),
  env.DB.prepare('INSERT INTO sso_subjects(provider,subject,email,scim_user_id) VALUES(?,?,?,?)').bind(token.provider, external, address, id),
  env.DB.prepare("INSERT INTO access_grants(id,email,role,scope_kind,scope_ref,source,granted_by,granted_name,reason,granted_at) VALUES(?,?,'contributor','business','','scim',?,?,?,?)").bind(crypto.randomUUID(), address, 'scim:' + token.id, 'SCIM ' + token.provider, 'Provisioned by SCIM', at),
  auditStatement(env, actorOf(token), 'scim.user.provisioned', 'scim-user:' + id, now, 'succeeded', `${token.provider} contributor`),
 ])
 return id
}
// Ends the account, its sessions, its provider subject and every role in one transaction.
async function deprovision(env: Bindings, token: Token, row: Row, now: Date) {
 const stamp = now.getTime(), at = now.toISOString()
 await env.DB.batch([
  env.DB.prepare("UPDATE oa_operators SET status='inactive',version=version+1 WHERE email=? AND role!='owner'").bind(row.email),
  env.DB.prepare("UPDATE oa_sessions SET revoked_at=? WHERE revoked_at IS NULL AND operator_id IN (SELECT id FROM oa_operators WHERE email=? AND role!='owner')").bind(stamp, row.email),
  env.DB.prepare("UPDATE access_grants SET revoked_at=?,revoked_by=?,revoke_reason='Deprovisioned by SCIM' WHERE email=? AND revoked_at IS NULL").bind(at, 'scim:' + token.id, row.email),
  env.DB.prepare('UPDATE scim_users SET active=0,updated_at=?,deprovisioned_at=COALESCE(deprovisioned_at,?) WHERE id=?').bind(at, at, row.id),
  auditStatement(env, actorOf(token), 'scim.user.deprovisioned', 'scim-user:' + row.id, now, 'succeeded', token.provider),
 ])
}
async function reactivate(env: Bindings, token: Token, row: Row, now: Date) {
 const at = now.toISOString()
 await env.DB.batch([
  env.DB.prepare("UPDATE oa_operators SET status='active',version=version+1 WHERE email=? AND role!='owner'").bind(row.email),
  env.DB.prepare("INSERT INTO access_grants(id,email,role,scope_kind,scope_ref,source,granted_by,granted_name,reason,granted_at) VALUES(?,?,'contributor','business','','scim',?,?,?,?)").bind(crypto.randomUUID(), row.email, 'scim:' + token.id, 'SCIM ' + token.provider, 'Reactivated by SCIM', at),
  env.DB.prepare('UPDATE scim_users SET active=1,updated_at=?,deprovisioned_at=NULL WHERE id=?').bind(at, row.id),
  auditStatement(env, actorOf(token), 'scim.user.reactivated', 'scim-user:' + row.id, now, 'succeeded', token.provider),
 ])
}
const find = (env: Bindings, token: Token, id: string) => env.DB.prepare('SELECT id,external_id,user_name,email,display_name,active,created_at,updated_at FROM scim_users WHERE id=? AND provider=?').bind(id, token.provider).first<Row>()

export function scimHandler(clock: () => Date) {
 return async (request: Request, env: Bindings): Promise<Response | null> => {
  const url = new URL(request.url), path = url.pathname.replace(/\/$/, '')
  if (!path.startsWith('/scim/v2')) return null
  if (url.origin !== env.AUTH_ORIGIN) return fail(403, 'Invalid host.')
  const now = clock(), token = await authenticate(env, request, now)
  if (!token) return fail(401, 'A valid SCIM token is required.')
  try {
   if (path === '/scim/v2/ServiceProviderConfig') return scim({ schemas: ['urn:ietf:params:scim:schemas:core:2.0:ServiceProviderConfig'], patch: { supported: true }, bulk: { supported: false }, filter: { supported: true, maxResults: 100 }, changePassword: { supported: false }, sort: { supported: false }, etag: { supported: false }, authenticationSchemes: [{ type: 'oauthbearertoken', name: 'Bearer token', description: 'A scoped, expiring token issued by the owner' }] })
   const one = /^\/scim\/v2\/Users\/([a-f0-9-]{36})$/.exec(path)
   if (path === '/scim/v2/Users' && request.method === 'GET') {
    const filter = /^userName eq "([^"]{1,254})"$/i.exec(url.searchParams.get('filter') ?? ''), start = Math.max(1, Number(url.searchParams.get('startIndex')) || 1), count = Math.min(100, Math.max(0, Number(url.searchParams.get('count')) || 100))
    const rows = (await env.DB.prepare('SELECT id,external_id,user_name,email,display_name,active,created_at,updated_at FROM scim_users WHERE provider=?' + (filter ? ' AND user_name=?' : '') + ' ORDER BY created_at,id').bind(token.provider, ...(filter ? [filter[1].toLowerCase()] : [])).all<Row>()).results
    return scim({ schemas: [LIST], totalResults: rows.length, startIndex: start, itemsPerPage: Math.min(count, Math.max(0, rows.length - start + 1)), Resources: rows.slice(start - 1, start - 1 + count).map(r => resource(r, env.AUTH_ORIGIN)) })
   }
   if (path === '/scim/v2/Users' && request.method === 'POST') {
    const id = await provision(env, token, await body(request), now)
    return scim(resource((await find(env, token, id))!, env.AUTH_ORIGIN), 201)
   }
   if (one) {
    const row = await find(env, token, one[1])
    if (!row) return fail(404, 'User not found.')
    if (request.method === 'GET') return scim(resource(row, env.AUTH_ORIGIN))
    if (request.method === 'DELETE') { await deprovision(env, token, row, now); return new Response(null, { status: 204, headers }) }
    if (request.method === 'PUT' || request.method === 'PATCH') {
     const input = await body(request)
     // PUT states the whole user; PATCH carries Operations that replace active or the name.
     const operations = request.method === 'PATCH' && Array.isArray(input.Operations) ? input.Operations as { op?: string; path?: string; value?: unknown }[] : []
     let active: boolean | undefined = request.method === 'PUT' && typeof input.active === 'boolean' ? input.active : undefined, display = request.method === 'PUT' ? nameOf(input, row.display_name) : row.display_name
     for (const op of operations) {
      if (String(op.op).toLowerCase() !== 'replace') continue
      const value = op.path ? { [op.path]: op.value } : (op.value ?? {}) as Record<string, unknown>
      if ('active' in value) active = value.active === true || value.active === 'true' ? true : value.active === false || value.active === 'false' ? false : active
      if ('displayName' in value && str(value.displayName, 200)) display = str(value.displayName, 200)
     }
     if (display !== row.display_name) await env.DB.batch([env.DB.prepare('UPDATE scim_users SET display_name=?,updated_at=? WHERE id=?').bind(display, now.toISOString(), row.id), env.DB.prepare('UPDATE oa_operators SET display_name=? WHERE email=? AND role!=\'owner\'').bind(display, row.email)])
     if (active === false && row.active) await deprovision(env, token, row, now)
     if (active === true && !row.active) await reactivate(env, token, row, now)
     return scim(resource((await find(env, token, row.id))!, env.AUTH_ORIGIN))
    }
   }
   return fail(404, 'Not found.')
  } catch (error) {
   if (error instanceof Refusal) return fail(error.status, error.message, error.status === 409 ? 'uniqueness' : 'invalidValue')
   console.error('SCIM operation failed')
   return fail(503, 'Provisioning is unavailable; nothing was changed.')
  }
 }
}
