import { sourceReadTime } from '../connect/pages'
import type { Bindings } from '../../auth.server'
import { Refusal } from '../upload'
import { auditStatement, text, type Actor, type Input } from '../door'
import { seal, unseal } from '../connect/custody'
import { backoffUpdate, reconnectUpdate, startRun } from '../connect/runs'
import type { Connection } from '../connect/storage'
import { upsertResources, type ResourceSchema } from '../resources'
import { catalogueStatements } from '../tests/storage'
import { runForType } from '../tests/engine'
import { DirectoryFailure, type Directory } from './directory'
import { okta } from './okta'
import { google } from './google'
import { entra } from './entra'
import { jumpcloud } from './jumpcloud'
// IDENTITY-001: directory connections, hourly reads and identity matching.
export const directories: Record<string, Directory> = { okta, google, entra, jumpcloud }
export const isDirectory = (provider: string) => Object.hasOwn(directories, provider)
const DAY = 86400000
export const schema: ResourceSchema = { fields: { email: 'string', status: 'string', population: 'string', active: 'boolean', admin: 'boolean', roles: 'string', groups: 'string', mfa_enrolled: 'boolean', last_sign_in: 'string', mfa_ok: 'boolean', admin_mfa_ok: 'boolean', guest_admin: 'boolean', inactive_days: 'number', readable: 'boolean' }, required: [] }
export const directoryConfig = (c: Pick<Connection, 'config_json'>): Record<string, string> => { try { return JSON.parse(c.config_json) } catch { return {} } }
function parseConfig(directory: Directory, input: Input) {
 const config: Record<string, string> = {}
 for (const f of directory.fields) {
  const value = text(input, f.key, 200, !f.required).toLowerCase()
  if (value && !f.pattern.test(value)) throw new Refusal(`Check the ${f.label.toLowerCase()}.`)
  if (value) config[f.key] = value
 }
 return config
}
async function check(directory: Directory, config: Record<string, string>, secret: string, now: Date) {
 try { return await directory.verify(config, secret, now) }
 catch (error) { if (error instanceof DirectoryFailure) throw new Refusal(`${directory.name}: ${error.message}.`, error.kind === 'throttled' ? 429 : 400); throw error }
}
export async function connectDirectory(env: Bindings, actor: Actor, input: Input, now: Date) {
 const provider = String(input.provider), directory = directories[provider], secret = text(input, 'secret', 8000), config = parseConfig(directory, input)
 const verified = await check(directory, config, secret, now), account = config.domain ?? config.tenant_id ?? config.org_id ?? verified.account
 if (await env.DB.prepare("SELECT 1 FROM connections WHERE provider=? AND account=? AND status!='revoked'").bind(provider, account).first()) throw new Refusal('This directory is already connected; rotate or revoke that connection.', 409)
 const id = crypto.randomUUID(), sealed = await seal(env, secret, id)
 await env.DB.batch([
  env.DB.prepare("INSERT INTO connections(id,provider,label,account,api_base,secret_ciphertext,secret_iv,granted_scopes,status,created_by,created_name,created_at,config_json) VALUES(?,?,?,?,?,?,?,?,'active',?,?,?,?)").bind(id, provider, text(input, 'label', 120, true) || `${directory.name} ${verified.account}`, account, provider, sealed.ciphertext, sealed.iv, JSON.stringify(directory.permissions), actor.id, actor.name, now.toISOString(), JSON.stringify(config)),
  auditStatement(env, actor, 'connection.authorized', 'connection:' + id, now, 'succeeded', `${provider} ${account}`),
  ...await catalogueStatements(env, provider, actor, now),
 ])
 return { id, account }
}
export async function rotateDirectory(env: Bindings, actor: Actor, row: Connection, input: Input, now: Date) {
 const secret = text(input, 'secret', 8000); await check(directories[row.provider], directoryConfig(row), secret, now)
 const sealed = await seal(env, secret, row.id)
 await env.DB.batch([env.DB.prepare("UPDATE connections SET secret_ciphertext=?,secret_iv=?,status='active',rotated_at=?,revoked_at=NULL,last_error='',backoff_seconds=0,next_attempt_at=NULL WHERE id=?").bind(sealed.ciphertext, sealed.iv, now.toISOString(), row.id), auditStatement(env, actor, row.status === 'active' ? 'connection.rotated' : 'connection.reconnected', 'connection:' + row.id, now)])
}
export async function runDirectoryCollection(env: Bindings, connection: Connection, trigger: 'schedule' | 'manual', now: Date) {
 const directory = directories[connection.provider], started = await startRun(env, connection, connection.provider + '-2', trigger, now)
 if (!started) return { run: null, outcome: 'already running' }
 const { finish } = started, at = now.toISOString()
 if (connection.status !== 'active' || !connection.secret_ciphertext || !connection.secret_iv) return finish('failed', {}, 'connection is ' + connection.status)
 let secret: string
 try { secret = await unseal(env, connection.secret_ciphertext, connection.secret_iv, connection.id) } catch { return finish('failed', {}, 'credential unreadable under this installation key', reconnectUpdate(env, connection, 'Stored credential cannot be decrypted; reconnect.', now)) }
 let read
 try { read = await directory.read(directoryConfig(connection), secret, now) }
 catch (error) {
  if (!(error instanceof DirectoryFailure)) throw error
  if (error.kind === 'throttled') return finish('throttled', {}, error.message, backoffUpdate(env, connection, now.getTime() + 60000, directory.name, now))
  if (error.kind === 'unauthorized') return finish('failed', {}, error.message, reconnectUpdate(env, connection, `${error.message}; reconnect with a new credential.`, now))
  // Nothing read: known accounts are rewritten unread, so their tests are unknown, not carried forward.
  const known = (await env.DB.prepare('SELECT unique_id,display_name FROM resources WHERE type=? AND source_ref=? AND removed_at IS NULL').bind('identity.account', 'directory:' + connection.id).all<{ unique_id: string; display_name: string }>()).results
  await upsertResources(env, 'identity.account', schema, known.map(k => ({ uniqueId: k.unique_id, displayName: k.display_name, attributes: { readable: false } })), { kind: 'source-observed', ref: 'directory:' + connection.id, label: `${directory.name} ${connection.account}` }, false, now)
  await runForType(env, 'identity.account', now)
  return finish('failed', { gaps: [error.message] }, error.message, env.DB.prepare('UPDATE connections SET last_attempt_at=?,last_error=? WHERE id=?').bind(at, error.message, connection.id))
 }
 const items = read.accounts.map(a => {
  const active = a.status === 'active', since = a.lastSignIn ?? a.created
  return { uniqueId: `${connection.provider}:${connection.id}:${a.id}`, displayName: `${a.name} <${a.email}>`, attributes: {
   email: a.email.toLowerCase(), status: a.status, population: a.population, active, admin: a.admin, roles: a.roles.join(', '), groups: a.groups === null ? null : a.groups.join(', '), mfa_enrolled: a.mfa, last_sign_in: a.lastSignIn, readable: true,
   mfa_ok: !active ? true : a.mfa, admin_mfa_ok: !active || a.admin === false ? true : a.admin === null || a.mfa === null ? null : a.mfa,
   guest_admin: a.admin === null ? null : a.population === 'guest' && a.admin, inactive_days: !active ? 0 : directory.exposes.signIn && since ? Math.floor((now.getTime() - Date.parse(since)) / DAY) : null,
  } }
 })
 const source = { kind: 'source-observed' as const, ref: 'directory:' + connection.id, label: `${directory.name} ${connection.account} via ${connection.label}` }
 const written = await upsertResources(env, 'identity.account', schema, items, source, read.complete ? 'source' : false, now)
 const fresh = written.results.filter(r => r.id && r.outcome !== 'removed' && r.outcome !== 'rejected').map(r => r.id!)
 // An account Evidence could not store is a gap, never a silent omission.
 for (const r of written.results.filter(r => r.outcome === 'rejected')) read.gaps.push(`account ${r.uniqueId} not stored: ${(r.reasons ?? []).join('; ')}`)
 if (fresh.length) await env.DB.prepare('UPDATE resources SET observed_at=? WHERE id IN (SELECT value FROM json_each(?))').bind(sourceReadTime(now), JSON.stringify(fresh)).run()
 await proposeMatches(env, now)
 const outcome = read.gaps.length ? 'partial' : 'complete'
 const result = await finish(outcome, { accounts: read.accounts.length, populations: Object.fromEntries(['person', 'contractor', 'guest', 'service'].map(p => [p, read.accounts.filter(a => a.population === p).length])), suspended: read.accounts.filter(a => a.status !== 'active').length, gaps: read.gaps }, '', env.DB.prepare('UPDATE connections SET last_attempt_at=?,last_success_at=?,next_attempt_at=NULL,backoff_seconds=0,last_error=? WHERE id=?').bind(at, at, read.gaps.join('; '), connection.id))
 await runForType(env, 'identity.account', now)
 return result
}
// Each directory account with an email that belongs to exactly one person is
// proposed for that person; an owner decides. Decisions are never re-proposed.
export async function proposeMatches(env: Bindings, now: Date) {
 const { results } = await env.DB.prepare("SELECT r.id,p.id AS person FROM resources r JOIN people p ON p.email=lower(json_extract(r.attributes_json,'$.email')) WHERE r.type='identity.account' AND r.removed_at IS NULL AND NOT EXISTS(SELECT 1 FROM identity_matches m WHERE m.resource_id=r.id)").all<{ id: string; person: string }>()
 if (results.length) await env.DB.batch(results.map(r => env.DB.prepare("INSERT INTO identity_matches(resource_id,person_id,state,basis,proposed_at) VALUES(?,?,'proposed','same email',?) ON CONFLICT DO NOTHING").bind(r.id, r.person, now.toISOString())))
 return results.length
}
export async function decideMatch(env: Bindings, actor: Actor, resource: string, input: Input, now: Date) {
 const decision = String(input.decision)
 if (!['approved', 'rejected'].includes(decision)) throw new Refusal('Approve or reject the match.')
 const row = await env.DB.prepare("SELECT id FROM resources WHERE id=? AND type='identity.account'").bind(resource).first()
 if (!row) throw new Refusal('Directory account not found.', 404)
 const person = typeof input.person_id === 'string' && input.person_id ? input.person_id : null
 if (person && !await env.DB.prepare('SELECT 1 FROM people WHERE id=?').bind(person).first()) throw new Refusal('Choose a person from People.')
 const existing = await env.DB.prepare('SELECT person_id FROM identity_matches WHERE resource_id=?').bind(resource).first<{ person_id: string | null }>()
 const chosen = decision === 'approved' ? person ?? existing?.person_id ?? null : existing?.person_id ?? person
 if (decision === 'approved' && !chosen) throw new Refusal('Choose the person this account belongs to.')
 await env.DB.batch([
  env.DB.prepare("INSERT INTO identity_matches(resource_id,person_id,state,basis,proposed_at,decided_by,decided_at,reason) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(resource_id) DO UPDATE SET person_id=excluded.person_id,state=excluded.state,basis=CASE WHEN identity_matches.person_id IS excluded.person_id THEN identity_matches.basis ELSE 'owner choice' END,decided_by=excluded.decided_by,decided_at=excluded.decided_at,reason=excluded.reason").bind(resource, chosen, decision, 'owner choice', now.toISOString(), actor.name, now.toISOString(), text(input, 'reason', 500, true)),
  auditStatement(env, actor, 'identity.match-' + decision, 'resource:' + resource, now, 'succeeded', chosen ?? ''),
 ])
}
