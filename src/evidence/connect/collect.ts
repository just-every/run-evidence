import type { Bindings } from '../../auth.server'
import { auditStatement } from '../door'
import { upsertResources, type ResourceSchema } from '../resources'
import { runForType } from '../tests/engine'
import { unseal } from './custody'
import { connectorRevision, githubClient, readOrganization, readRepository, Throttled, Unauthorized } from './github'
import type { Connection } from './storage'
// COLLECTION-001: one durable run per connection at a time, with coverage,
// connector revision, timestamps and a terminal outcome. Only a successful
// authorized read issues source-observed facts; unread items become gaps.
const repositorySchema: ResourceSchema = { fields: { private: 'boolean', archived: 'boolean', default_branch: 'string', branch_protection: 'boolean', required_reviews: 'number', required_status_checks: 'number', enforce_admins: 'boolean', open_critical_dependabot_alerts: 'number', open_secret_scanning_alerts: 'number', readable: 'boolean' }, required: [] }
const organizationSchema: ResourceSchema = { fields: { login: 'string', two_factor_requirement_enabled: 'boolean', readable: 'boolean' }, required: [] }
const HOUR = 3600000, MAX_BACKOFF = 3600
export async function runCollection(env: Bindings, connection: Connection, trigger: 'schedule' | 'manual', now: Date) {
 const run = crypto.randomUUID(), at = now.toISOString(), system = { id: 'system', name: 'Evidence collector', kind: 'system' as const }
 // An earlier run that never finished (a crash or restart) is closed as failed, not resumed silently.
 await env.DB.prepare("UPDATE collection_runs SET finished_at=?,outcome='failed',error_code='interrupted' WHERE connection_id=? AND finished_at IS NULL AND started_at<?").bind(at, connection.id, new Date(now.getTime() - 15 * 60000).toISOString()).run()
 const claimed = await env.DB.prepare("INSERT INTO collection_runs(id,connection_id,trigger,connector_revision,started_at) VALUES(?,?,?,?,?) ON CONFLICT DO NOTHING").bind(run, connection.id, trigger, connectorRevision, at).run()
 if (!claimed.meta.changes) return { run: null, outcome: 'already running' }
 const finish = async (outcome: 'complete' | 'partial' | 'failed' | 'throttled', coverage: Record<string, unknown>, error = '', connectionUpdate?: D1PreparedStatement) => {
  await env.DB.batch([
   env.DB.prepare('UPDATE collection_runs SET finished_at=?,outcome=?,coverage_json=?,error_code=? WHERE id=?').bind(now.toISOString(), outcome, JSON.stringify(coverage), error, run),
   ...(connectionUpdate ? [connectionUpdate] : []),
   auditStatement(env, system, 'collection.' + outcome, 'connection:' + connection.id, now, outcome === 'failed' ? 'failed' : 'succeeded', error),
  ])
  return { run, outcome }
 }
 if (connection.status !== 'active' || !connection.secret_ciphertext || !connection.secret_iv) return finish('failed', {}, 'connection is ' + connection.status)
 let token: string
 try { token = await unseal(env, connection.secret_ciphertext, connection.secret_iv, connection.id) }
 catch { return finish('failed', {}, 'credential unreadable under this installation key', env.DB.prepare("UPDATE connections SET status='needs reconnect',last_attempt_at=?,last_error=? WHERE id=?").bind(at, 'Stored credential cannot be decrypted; reconnect.', connection.id)) }
 const client = githubClient(connection.api_base, token, () => now.getTime())
 const selected = (await env.DB.prepare('SELECT full_name FROM connection_repositories WHERE connection_id=? AND selected=1 ORDER BY full_name').bind(connection.id).all<{ full_name: string }>()).results.map(r => r.full_name)
 const coverage: { organization: string; repositories_selected: number; repositories_read: string[]; unreadable: { repository: string; reason: string }[] } = { organization: 'unread', repositories_selected: selected.length, repositories_read: [], unreadable: [] }
 const source = { kind: 'source-observed' as const, ref: 'github:' + connection.id, label: `GitHub ${connection.account} via ${connection.label}` }
 const repos: { uniqueId: string; displayName: string; attributes: Record<string, unknown> }[] = []
 let organization: { uniqueId: string; displayName: string; attributes: Record<string, unknown> } | null = null
 try {
  const org = await readOrganization(client, connection.account)
  organization = { uniqueId: connection.account, displayName: connection.account + ' (organization)', attributes: org.readable ? { ...org.attributes, readable: true } : { login: connection.account, two_factor_requirement_enabled: null, readable: false } }
  coverage.organization = org.readable ? 'read' : `unreadable (${org.status})`
  for (const name of selected) {
   const read = await readRepository(client, name)
   if (read.readable) { repos.push({ uniqueId: name, displayName: name, attributes: { ...read.attributes, readable: true } }); coverage.repositories_read.push(name) }
   else { coverage.unreadable.push({ repository: name, reason: read.reason }); repos.push({ uniqueId: name, displayName: name, attributes: { readable: false } }) }
  }
 } catch (error) {
  if (error instanceof Throttled) {
   const backoff = Math.min(MAX_BACKOFF, Math.max(60, connection.backoff_seconds * 2 || 60)), next = new Date(Math.max(error.resetAt, now.getTime() + backoff * 1000)).toISOString()
   return finish('throttled', coverage, 'rate limited until ' + new Date(error.resetAt).toISOString(), env.DB.prepare('UPDATE connections SET last_attempt_at=?,next_attempt_at=?,backoff_seconds=?,last_error=? WHERE id=?').bind(at, next, backoff, 'GitHub rate limit; next attempt ' + next, connection.id))
  }
  if (error instanceof Unauthorized) return finish('failed', coverage, 'credential rejected by GitHub', env.DB.prepare("UPDATE connections SET status='needs reconnect',last_attempt_at=?,last_error=? WHERE id=?").bind(at, 'GitHub rejected the credential (revoked or expired); reconnect with a new one.', connection.id))
  return finish('failed', coverage, 'transport failure', env.DB.prepare('UPDATE connections SET last_attempt_at=?,last_error=? WHERE id=?').bind(at, 'GitHub could not be reached.', connection.id))
 }
 // Unread repositories stay in the denominator with readable=false: their tests are unknown.
 await upsertResources(env, 'github.organization', organizationSchema, organization ? [organization] : [], source, false, now)
 const written = await upsertResources(env, 'github.repository', repositorySchema, repos, source, true, now)
 const fresh = written.results.filter(r => r.id && r.outcome !== 'removed' && coverage.repositories_read.includes(r.uniqueId)).map(r => r.id!)
 await env.DB.batch([
  ...(coverage.organization === 'read' ? [env.DB.prepare("UPDATE resources SET observed_at=? WHERE type='github.organization' AND unique_id=?").bind(at, connection.account)] : []),
  ...(fresh.length ? [env.DB.prepare('UPDATE resources SET observed_at=? WHERE id IN (SELECT value FROM json_each(?))').bind(at, JSON.stringify(fresh))] : []),
 ])
 const outcome = coverage.unreadable.length || coverage.organization !== 'read' ? 'partial' : 'complete'
 const result = await finish(outcome, coverage, '', env.DB.prepare("UPDATE connections SET last_attempt_at=?,last_success_at=?,next_attempt_at=NULL,backoff_seconds=0,last_error=? WHERE id=?").bind(at, at, outcome === 'partial' ? `${coverage.unreadable.length} repositories unreadable` : '', connection.id))
 await runForType(env, 'github.repository', now)
 await runForType(env, 'github.organization', now)
 return result
}
// Hourly collection per active connection, honoring throttling backoff.
export async function collectDue(env: Bindings, now: Date) {
 const { results } = await env.DB.prepare("SELECT * FROM connections WHERE status='active' AND (next_attempt_at IS NULL OR next_attempt_at<=?) AND (last_attempt_at IS NULL OR last_attempt_at<=?)").bind(now.toISOString(), new Date(now.getTime() - HOUR + 5 * 60000).toISOString()).all<Connection>()
 for (const connection of results) await runCollection(env, connection, 'schedule', now)
 return results.length
}
