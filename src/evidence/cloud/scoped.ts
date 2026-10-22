import { scopedFetch } from '../ops/execution'
import type { Bindings } from '../../auth.server'
import { Refusal } from '../upload'
import { auditStatement, text, type Actor, type Input } from '../door'
import { seal, unseal } from '../connect/custody'
import { backoffUpdate, reconnectUpdate, startRun } from '../connect/runs'
import type { Connection } from '../connect/storage'
import { upsertResources, type ResourceSchema } from '../resources'
import { catalogueStatements } from '../tests/storage'
import { runForType } from '../tests/engine'
// CLOUD-001 for clouds organized in scopes (Google Cloud projects, Azure
// subscriptions). Every scope the credential can list is read class by class;
// a denied class is a gap that turns that scope's known resources unknown, and
// a scope never disappears from the denominator because a read failed.
export class CloudFailure extends Error { constructor(public kind: 'unauthorized' | 'denied' | 'throttled' | 'unavailable' | 'disabled', message: string) { super(message) } }
export interface Item { uniqueId: string; displayName: string; attributes: Record<string, unknown> }
export interface Scope { id: string; name: string }
export interface ScopedCloud {
 name: string; scopeLabel: string; credential: string; permissions: string[]; revision: string
 fields: { key: string; label: string; required: boolean; pattern: RegExp }[]
 scopeType: string; types: Record<string, ResourceSchema>
 authorize(config: Record<string, string>, secret: string, now: Date): Promise<string>
 account(config: Record<string, string>, secret: string): string
 discover(token: string, config: Record<string, string>): Promise<{ scopes: Scope[]; complete: boolean }>
 classes: { name: string; types: string[]; read(token: string, scope: Scope, now: Date): Promise<Record<string, Item[]>> }[]
}
// A provider HTTP read: 401 lost credential, 403 denied or API disabled, 429 throttled.
export async function cloudCall(url: string, token: string, label: string, init: RequestInit = {}) {
 let response: Response
 try { response = await scopedFetch(url, { ...init, headers: { authorization: 'Bearer ' + token, accept: 'application/json', ...(init.body ? { 'content-type': 'application/json' } : {}) }, redirect: 'manual', signal: AbortSignal.timeout(20000) }) } catch { throw new CloudFailure('unavailable', `${label} could not be reached`) }
 const body: unknown = await response.json().catch(() => null)
 const errorBody = body && typeof body === 'object' ? body as Record<string, unknown> : {}
 if (response.status === 401) throw new CloudFailure('unauthorized', `${label} rejected the credential`)
 if (response.status === 403) { const detail = JSON.stringify(errorBody.error ?? ''); throw new CloudFailure(/accessNotConfigured|SERVICE_DISABLED|MissingSubscriptionRegistration/.test(detail) ? 'disabled' : 'denied', `${label} refused the read (403)`) }
 if (response.status === 429) throw new CloudFailure('throttled', `${label} is rate limiting this credential`)
 if (response.status === 404) return null
 if (response.status !== 200) throw new CloudFailure('unavailable', `${label} answered ${response.status}`)
 if (!body || typeof body !== 'object' || Array.isArray(body)) throw new CloudFailure('unavailable', `${label} schema drift: expected a JSON object`)
 return body as Record<string, unknown>
}
export const scopedConfig = (c: Pick<Connection, 'config_json'>): Record<string, string> => { try { return JSON.parse(c.config_json) } catch { return {} } }
function parseConfig(cloud: ScopedCloud, input: Input) {
 const config: Record<string, string> = {}
 for (const f of cloud.fields) { const value = text(input, f.key, 200, !f.required).toLowerCase(); if (value && !f.pattern.test(value)) throw new Refusal(`Check the ${f.label.toLowerCase()}.`); if (value) config[f.key] = value }
 return config
}
async function check(cloud: ScopedCloud, config: Record<string, string>, secret: string, now: Date) {
 try { const token = await cloud.authorize(config, secret, now); return await cloud.discover(token, config) }
 catch (error) { if (error instanceof CloudFailure) throw new Refusal(`${cloud.name}: ${error.message}.`, error.kind === 'throttled' ? 429 : 400); throw error }
}
export async function connectScoped(env: Bindings, actor: Actor, provider: string, cloud: ScopedCloud, input: Input, now: Date) {
 const secret = text(input, 'secret', 8000), config = parseConfig(cloud, input)
 let account: string
 try { account = cloud.account(config, secret) } catch (error) { if (error instanceof CloudFailure) throw new Refusal(error.message); throw error }
 const found = await check(cloud, config, secret, now)
 if (!found.scopes.length) throw new Refusal(`This credential cannot list any ${cloud.scopeLabel}.`)
 if (await env.DB.prepare("SELECT 1 FROM connections WHERE provider=? AND account=? AND status!='revoked'").bind(provider, account).first()) throw new Refusal('This account is already connected; rotate or revoke that connection.', 409)
 const id = crypto.randomUUID(), sealed = await seal(env, secret, id)
 await env.DB.batch([
  env.DB.prepare("INSERT INTO connections(id,provider,label,account,api_base,secret_ciphertext,secret_iv,granted_scopes,status,created_by,created_name,created_at,config_json) VALUES(?,?,?,?,?,?,?,?,'active',?,?,?,?)").bind(id, provider, text(input, 'label', 120, true) || `${cloud.name} ${account}`, account, provider, sealed.ciphertext, sealed.iv, JSON.stringify(cloud.permissions), actor.id, actor.name, now.toISOString(), JSON.stringify(config)),
  auditStatement(env, actor, 'connection.authorized', 'connection:' + id, now, 'succeeded', `${provider} ${account}: ${found.scopes.length} ${cloud.scopeLabel}`),
  ...await catalogueStatements(env, provider, actor, now),
 ])
 return { id, account, scopes: found.scopes.map(s => s.id) }
}
export async function rotateScoped(env: Bindings, actor: Actor, cloud: ScopedCloud, row: Connection, input: Input, now: Date) {
 const secret = text(input, 'secret', 8000), config = scopedConfig(row)
 let account: string
 try { account = cloud.account(config, secret) } catch (error) { if (error instanceof CloudFailure) throw new Refusal(error.message); throw error }
 if (account !== row.account) throw new Refusal(`This credential belongs to ${account}, not ${row.account}.`, 409)
 await check(cloud, config, secret, now)
 const sealed = await seal(env, secret, row.id)
 await env.DB.batch([env.DB.prepare("UPDATE connections SET secret_ciphertext=?,secret_iv=?,status='active',rotated_at=?,revoked_at=NULL,last_error='',backoff_seconds=0,next_attempt_at=NULL WHERE id=?").bind(sealed.ciphertext, sealed.iv, now.toISOString(), row.id), auditStatement(env, actor, row.status === 'active' ? 'connection.rotated' : 'connection.reconnected', 'connection:' + row.id, now)])
}
export async function runScopedCollection(env: Bindings, connection: Connection, cloud: ScopedCloud, trigger: 'schedule' | 'manual', now: Date) {
 const started = await startRun(env, connection, cloud.revision, trigger, now)
 if (!started) return { run: null, outcome: 'already running' }
 const { finish } = started, at = now.toISOString(), source = { kind: 'source-observed' as const, ref: `${connection.provider}:${connection.id}`, label: `${cloud.name} ${connection.account} via ${connection.label}` }
 if (connection.status !== 'active' || !connection.secret_ciphertext || !connection.secret_iv) return finish('failed', {}, 'connection is ' + connection.status)
 let secret: string
 try { secret = await unseal(env, connection.secret_ciphertext, connection.secret_iv, connection.id) } catch { return finish('failed', {}, 'credential unreadable under this installation key', reconnectUpdate(env, connection, 'Stored credential cannot be decrypted; reconnect.', now)) }
 const out = new Map<string, Map<string, Item>>(Object.keys(cloud.types).map(t => [t, new Map()])), unread = new Map<string, Set<string>>(Object.keys(cloud.types).map(t => [t, new Set()]))
 const coverage: { accounts: { id: string; name: string; read: boolean; reason: string }[]; gaps: { account: string; class: string; region: string; reason: string }[]; notes: string[] } = { accounts: [], gaps: [], notes: [] }
 // Items with the same identity from several classes merge their attributes.
 const put = (type: string, item: Item) => { const prior = out.get(type)!.get(item.uniqueId); out.get(type)!.set(item.uniqueId, prior ? { ...prior, attributes: { ...prior.attributes, ...item.attributes } } : item) }
 let scopes: Scope[]
 try {
  const token = await cloud.authorize(scopedConfig(connection), secret, now)
  const found = await cloud.discover(token, scopedConfig(connection))
  // Scopes seen before but not listed now stay in the denominator as unread.
  const known = (await env.DB.prepare('SELECT unique_id,display_name FROM resources WHERE type=? AND source_ref=? AND removed_at IS NULL').bind(cloud.scopeType, source.ref).all<{ unique_id: string; display_name: string }>()).results
  scopes = [...found.scopes, ...known.filter(k => !found.scopes.some(s => s.id === k.unique_id)).map(k => ({ id: k.unique_id, name: k.display_name, lost: true }))].slice(0, 100)
  for (const scope of scopes) {
   let readAny = false
   if ((scope as Scope & { lost?: boolean }).lost) { coverage.gaps.push({ account: scope.id, class: cloud.scopeLabel, region: 'all', reason: 'no longer listed for this credential' }); for (const t of Object.keys(cloud.types)) unread.get(t)!.add(scope.id); put(cloud.scopeType, { uniqueId: scope.id, displayName: scope.name, attributes: { readable: false } }); coverage.accounts.push({ id: scope.id, name: scope.name, read: false, reason: 'no longer listed' }); continue }
   for (const c of cloud.classes) {
    try { const items = await c.read(token, scope, now); for (const [type, list] of Object.entries(items)) for (const item of list) put(type, item); readAny = true }
    catch (error) {
     if (!(error instanceof CloudFailure) || error.kind === 'unauthorized' || error.kind === 'throttled') throw error
     if (error.kind === 'disabled') { coverage.notes.push(`${scope.id}: ${c.name} API not enabled, so none are in use`); readAny = true; continue }
     coverage.gaps.push({ account: scope.id, class: c.name, region: 'all', reason: error.message }); for (const t of c.types) unread.get(t)!.add(scope.id)
    }
   }
   put(cloud.scopeType, { uniqueId: scope.id, displayName: scope.name, attributes: { readable: readAny } })
   coverage.accounts.push({ id: scope.id, name: scope.name, read: readAny, reason: readAny ? '' : 'every class was refused' })
  }
 } catch (error) {
  if (error instanceof CloudFailure && error.kind === 'throttled') return finish('throttled', coverage, error.message, backoffUpdate(env, connection, now.getTime() + 60000, cloud.name, now))
  if (error instanceof CloudFailure && error.kind === 'unauthorized') return finish('failed', coverage, error.message, reconnectUpdate(env, connection, `${error.message}; reconnect with a new credential.`, now))
  if (error instanceof CloudFailure) return finish('failed', coverage, error.message, env.DB.prepare('UPDATE connections SET last_attempt_at=?,last_error=? WHERE id=?').bind(at, error.message, connection.id))
  throw error
 }
 // Known resources of an unread class in a scope are rewritten unread; they are not stamped as observed.
 const placeholders = new Set<string>()
 for (const [type, scopeIds] of unread) {
  if (type === cloud.scopeType) continue
  for (const scopeId of scopeIds) {
   const known = (await env.DB.prepare("SELECT unique_id,display_name FROM resources WHERE type=? AND source_ref=? AND removed_at IS NULL AND substr(unique_id,1,length(?)+1)=?||'/'").bind(type, source.ref, scopeId, scopeId).all<{ unique_id: string; display_name: string }>()).results
   for (const r of known) if (!out.get(type)!.has(r.unique_id)) { placeholders.add(type + ' ' + r.unique_id); put(type, { uniqueId: r.unique_id, displayName: r.display_name, attributes: {} }) }
  }
 }
 const fresh: string[] = []
 for (const [type, schema] of Object.entries(cloud.types)) {
  const items = [...out.get(type)!.values()].map(i => ({ ...i, attributes: Object.fromEntries(Object.keys(schema.fields).map(f => [f, i.attributes[f] ?? null])) }))
  const written = await upsertResources(env, type, schema, items, source, unread.get(type)!.size ? false : 'source', now)
  for (const r of written.results.filter(r => r.outcome === 'rejected')) coverage.gaps.push({ account: '', class: type, region: '', reason: `${r.uniqueId} not stored: ${(r.reasons ?? []).join('; ')}` })
  fresh.push(...written.results.filter(r => r.id && r.outcome !== 'removed' && r.outcome !== 'rejected' && !placeholders.has(type + ' ' + r.uniqueId)).map(r => r.id!))
 }
 if (fresh.length) await env.DB.prepare('UPDATE resources SET observed_at=? WHERE id IN (SELECT value FROM json_each(?))').bind(at, JSON.stringify(fresh)).run()
 const anyRead = coverage.accounts.some(a => a.read), outcome = !anyRead ? 'failed' : coverage.gaps.length ? 'partial' : 'complete'
 const result = await finish(outcome, coverage, anyRead ? '' : `no ${cloud.scopeLabel} readable`, anyRead
  ? env.DB.prepare('UPDATE connections SET last_attempt_at=?,last_success_at=?,next_attempt_at=NULL,backoff_seconds=0,last_error=? WHERE id=?').bind(at, at, outcome === 'partial' ? `${coverage.gaps.length} gaps` : '', connection.id)
  : env.DB.prepare('UPDATE connections SET last_attempt_at=?,last_error=? WHERE id=?').bind(at, `No ${cloud.scopeLabel} was readable.`, connection.id))
 for (const type of Object.keys(cloud.types)) await runForType(env, type, now)
 return result
}
