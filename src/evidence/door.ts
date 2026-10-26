import { problem } from './problem'
import { operatorAuth, runtimeBindings, type Bindings } from '../auth.server'
import { boundedBody, Refusal } from './upload'
import { headers, page, escape, signedOutPage } from './view'
import { authorize } from './authz/gate'
import type { Delegate } from './authz/roles'
export interface Actor { id: string; name: string }
export interface OwnerContext { env: Bindings; actor: Actor; now: Date; url: URL; request: Request; isApi: boolean; sessionId: string; delegate?: Delegate }
export interface Route { method: 'GET' | 'POST'; pattern: RegExp; errorReturn?: string; run: (context: OwnerContext, match: RegExpExecArray) => Promise<Response> }
export type Input = Record<string, string | string[]>
export const json = (data: unknown, status = 200) => Response.json(data, { status, headers })
export const redirect = (location: string) => new Response(null, { status: 303, headers: { ...headers, location } })
// Owner pages answer forms with a redirect; the same operation under /api answers JSON.
export const done = (context: OwnerContext, location: string, data: unknown, status = 200) => context.isApi ? json(data, status) : redirect(location)

// The owner door shared by program, test, remediation, risk and connection
// routes: exact origin and host, same-origin writes, a live owner session.
export function ownerRoutes(routes: Route[], clock: () => Date) {
 return async (request: Request, original: Bindings): Promise<Response | null> => {
  const url = new URL(request.url)
  const matched = routes.map(route => ({ route, match: route.pattern.exec(url.pathname) })).filter(x => x.match)
  if (!matched.length) return null
  const env = runtimeBindings(original), isApi = url.pathname.startsWith('/api/')
  if (url.origin !== env.AUTH_ORIGIN || (request.headers.has('host') && request.headers.get('host')?.toLowerCase() !== url.host.toLowerCase())) return json({ error: 'Invalid host.' }, 403)
  if (request.headers.get('sec-fetch-site') === 'cross-site' || (request.headers.has('origin') && request.headers.get('origin') !== env.AUTH_ORIGIN) || (!['GET','HEAD'].includes(request.method) && request.headers.get('origin') !== env.AUTH_ORIGIN)) return json({ error: 'Same-origin request required.' }, 403)
  const session = await operatorAuth(env).getSession(request)
  if (!session) return isApi ? json({ error: 'Owner sign-in required.' }, 401) : signedOutPage(request)
  const verdict = await authorize(env, session.operator, request.method === 'HEAD' ? 'GET' : request.method, url.pathname)
  if (!verdict.ok) return isApi ? json({ error: verdict.error }, verdict.status) : problem(verdict.error, verdict.status, '/me', true)
  const method = request.method === 'HEAD' ? 'GET' : request.method
  const hit = matched.find(x => x.route.method === method)
  if (!hit) return json({ error: 'Method not allowed.' }, 405)
  const context: OwnerContext = { env, sessionId: session.id, actor: verdict.actor, delegate: verdict.delegate, now: clock(), url, request, isApi }
  try { return await hit.route.run(context, hit.match!) }
  catch (error) {
   // LOG-001: a refused or failed owner write is recorded with its outcome,
   // naming the door (method and path, never the query or body).
   const record = (outcome: 'refused' | 'failed', detail: string) => method === 'GET' ? Promise.resolve() : auditStatement(env, context.actor, 'door.' + outcome, `${method} ${url.pathname}`, context.now, outcome, detail).run().then(() => undefined, failure => console.error('Evidence audit write failed', failure instanceof Error ? failure.message : ''))
   if (!(error instanceof Refusal)) { console.error('Evidence operation failed', error instanceof Error ? error.message : ''); await record('failed', 'Storage unavailable; no result is claimed.'); return json({ error: 'Storage unavailable; no result is claimed.' }, 503) }
   await record('refused', `${error.status}: ${error.message}`)
   return isApi ? json({ error: error.message, ...(error.details ? { details: error.details } : {}) }, error.status) : page('Could not save', `<p role="alert">${escape(error.message)}</p>${Array.isArray(error.details) ? `<ul>${error.details.map(d => `<li>${escape(typeof d === 'string' ? d : JSON.stringify(d))}</li>`).join('')}</ul>` : ''}<p><a href="${escape(hit.route.errorReturn ?? (request.headers.get('referer') && new URL(request.headers.get('referer')!).origin === env.AUTH_ORIGIN ? new URL(request.headers.get('referer')!).pathname : '/app'))}">Go back</a></p>`, error.status)
  }
 }
}

// One JSON object or one urlencoded form; repeated form keys become lists.
export async function readInput(request: Request, limit = 65536): Promise<Input> {
 const type = request.headers.get('content-type') ?? '', body = new TextDecoder().decode(await boundedBody(request, limit))
 if (type.startsWith('application/json')) {
  let value: unknown
  try { value = JSON.parse(body) } catch { throw new Refusal('Send one JSON object.') }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Refusal('Send one JSON object.')
  return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, Array.isArray(v) ? v.map(String) : typeof v === 'string' ? v : v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v)]))
 }
 if (!type.startsWith('application/x-www-form-urlencoded')) throw new Refusal('Use the form or JSON.')
 const out: Input = {}
 for (const [key, value] of new URLSearchParams(body)) { const k = key.replace(/\[\]$/, ''); const prior = out[k]; out[k] = prior === undefined ? (key.endsWith('[]') ? [value] : value) : [...(Array.isArray(prior) ? prior : [prior]), value] }
 return out
}
export const text = (input: Input, key: string, max = 300, optional = false) => {
 const value = input[key]
 if ((value === undefined || value === '') && optional) return ''
 if (typeof value !== 'string' || !value.trim() || value.trim().length > max) throw new Refusal(`Provide ${key.replaceAll('_', ' ')} (at most ${max} characters).`)
 return value.trim()
}
export const list = (input: Input, key: string, max = 50) => {
 const value = input[key], items = (Array.isArray(value) ? value : typeof value === 'string' ? value.split(/[\n,]/) : []).map(x => x.trim()).filter(Boolean)
 if (items.length > max || items.some(x => x.length > 200)) throw new Refusal(`List at most ${max} ${key.replaceAll('_', ' ')} of up to 200 characters.`)
 return [...new Set(items)]
}
export const oneOf = <T extends string>(input: Input, key: string, values: readonly T[]): T => {
 const value = input[key]
 if (typeof value !== 'string' || !(values as readonly string[]).includes(value)) throw new Refusal(`Choose a listed ${key.replaceAll('_', ' ')}.`)
 return value as T
}

// Permanent product action audit (LOG-001). Detail never carries credentials.
// The reason is the one the actor entered where the door asks for one; the
// revision is the subject's exact stored revision, version or edition that the
// action produced or acted on. Both stay empty where neither exists.
export interface AuditContext { reason?: string; revision?: string | number }
export function auditStatement(env: Bindings, actor: Actor & { kind?: 'owner' | 'token' | 'system' }, action: string, subject: string, at: Date, outcome: 'succeeded' | 'refused' | 'failed' | 'uncertain' = 'succeeded', detail = '', context: AuditContext = {}) {
 return env.DB.prepare('INSERT INTO product_audit(id,actor_kind,actor_id,actor_name,action,subject,outcome,detail,at,reason,revision) VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(), actor.kind ?? 'owner', actor.id, actor.name, action, subject, outcome, detail.slice(0, 500), at.toISOString(), (context.reason ?? '').slice(0, 1000), String(context.revision ?? '').slice(0, 100))
}
// Record only the admitted identity and door, never a credential, query or body.
export async function auditDoorRefusal(env: Bindings, actor: Actor & { kind?: 'owner' | 'token' }, request: Request, now: Date, status: number, reason: string) {
 const path = new URL(request.url).pathname.replace(/[a-f0-9]{64}/gi, '[credential]')
 try {
  await auditStatement(env, actor, 'door.refused', `${request.method} ${path}`, now, 'refused', `${status}: ${reason}`, { reason, ...(actor.kind === 'token' ? { revision: 'agent-token:' + actor.id } : {}) }).run()
 } catch {
  // Audit storage failure cannot turn a denied action into owner authority.
  console.error('Evidence refusal audit unavailable')
 }
}
// The outer owner-door guard runs before route admission. Resolve a recognized
// prepare-only credential there without treating it as an owner session.
export async function auditAgentOwnerRefusal(request: Request, original: Bindings, clock: () => Date) {
 const secret = /^Bearer ([a-f0-9]{64})$/.exec(request.headers.get('authorization') ?? '')?.[1]
 if (!secret) return
 try {
  const env = runtimeBindings(original)
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret))), n => n.toString(16).padStart(2, '0')).join('')
  const token = await env.DB.prepare('SELECT id,label FROM agent_tokens WHERE token_hash=?').bind(hash).first<{ id: string; label: string }>()
  if (token) await auditDoorRefusal(env, { id: token.id, name: token.label, kind: 'token' }, request, clock(), 403, 'Agent credentials cannot use owner doors.')
 } catch {
  console.error('Evidence credential refusal audit unavailable')
 }
}
export const parseList = (value: string): string[] => { try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed.map(String) : [] } catch { return [] } }
export const uuid = /[a-f0-9-]{36}/.source
