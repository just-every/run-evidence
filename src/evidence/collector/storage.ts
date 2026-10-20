import { capabilityAllowed } from '../archive/capabilities'
import type { Bindings } from '../../auth.server'
import { auditStatement, text, type Actor, type Input } from '../door'
import { digest } from '../api/tokens'
import { Refusal } from '../upload'
import { requireConnection, type Connection } from '../connect/storage'
import { revision, resourceType, schema } from './profile'
import { declareType } from '../resources'
export const provider = 'private-git'
const tokenValue = () => 'evc_' + btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
export async function registerCollector(env: Bindings, actor: Actor, input: Input, now: Date) {
 if (input.reviewed !== 'yes') throw new Refusal('Review the installed fixed-function collector and its declared data before registration.')
 const label = text(input, 'label', 120)
 if (!/^[\x21-\x7e][\x20-\x7e]{0,119}$/.test(label)) throw new Refusal('Use a printable repository label.')
 const id = crypto.randomUUID(), token = tokenValue(), at = now.toISOString()
 await declareType(env, resourceType, schema, 'reviewed collector ' + revision, now)
 await env.DB.batch([
  env.DB.prepare("INSERT INTO connections(id,provider,label,account,api_base,granted_scopes,status,created_by,created_name,created_at,collector_token_hash,config_json) VALUES(?,?,?,?,?,?,'active',?,?,?,?,?)").bind(id, provider, label, label, env.AUTH_ORIGIN, JSON.stringify(['local Git metadata: read only', 'one registered repository label']), actor.id, actor.name, at, await digest(token), JSON.stringify({ revision, reviewed_by: actor.name, reviewed_at: at })),
  auditStatement(env, actor, 'collector.registered', 'connection:' + id, now, 'succeeded', revision, { revision }),
 ])
 return { id, token }
}
export async function rotateCollector(env: Bindings, actor: Actor, id: string, now: Date) {
 const row = await requireConnection(env, id)
 if (row.provider !== provider) throw new Refusal('Private collector not found.', 404)
 const token = tokenValue()
 await env.DB.batch([
  env.DB.prepare("UPDATE connections SET collector_token_hash=?,status='active',rotated_at=?,revoked_at=NULL,last_error='' WHERE id=?").bind(await digest(token), now.toISOString(), id),
  auditStatement(env, actor, 'collector.rotated', 'connection:' + id, now),
 ])
 return { id, token }
}
export async function authenticateCollector(env: Bindings, id: string, authorization: string | null): Promise<Connection | null> {
 if (!await capabilityAllowed(env,'collections',id)) return null
 const match = /^Bearer (evc_[A-Za-z0-9_-]{43})$/.exec(authorization ?? '')
 if (!match) return null
 return env.DB.prepare("SELECT * FROM connections WHERE id=? AND provider=? AND status='active' AND collector_token_hash=?").bind(id, provider, await digest(match[1])).first<Connection>()
}
