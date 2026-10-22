import {runAzureDevops} from './azuredevops-collect'
import {runBitbucket} from './bitbucket-collect'
import {runGitlab} from './gitlab-collect'
import { collectGithubMembers } from './github-members'
import { readGithubHistory } from './github-history'
import { withPages } from './pages'
import { collectEvents } from './events'
import { requireConnection } from './storage'
import { digest } from '../api/tokens'
import type { AlertCursor } from './github'
import { collectionMinutes } from './interval'
import { capabilityAllowed } from '../archive/capabilities'
import { Refusal } from '../upload'
import type { Bindings } from '../../auth.server'
import { backoffUpdate, reconnectUpdate, startRun } from './runs'
import { runAwsCollection } from '../cloud/collect'
import { isDirectory, runDirectoryCollection } from '../identity/collect'
import { isScopedCloud, scopedClouds } from '../cloud/clouds'
import { runScopedCollection } from '../cloud/scoped'
import { runKnowBe4 } from '../training/knowbe4'
import { upsertResources, upsertRegister, type ResourceSchema } from '../resources'
import { runForType } from '../tests/engine'
import { unseal } from './custody'
import { connectorRevision, githubClient, readOrganization, readRepository, Throttled, Unauthorized } from './github'
import type { Connection } from './storage'
// COLLECTION-001: one durable run per connection at a time, with coverage,
// connector revision, timestamps and a terminal outcome. Only a successful
// authorized read issues source-observed facts; unread items become gaps.
const repositorySchema: ResourceSchema = { fields: { private: 'boolean', archived: 'boolean', default_branch: 'string', branch_protection: 'boolean', required_reviews: 'number', required_status_checks: 'number', enforce_admins: 'boolean', open_critical_dependabot_alerts: 'number', open_secret_scanning_alerts: 'number', readable: 'boolean' }, required: [] }
const organizationSchema: ResourceSchema = { fields: { login: 'string', two_factor_requirement_enabled: 'boolean', departed_members: 'number', readable: 'boolean' }, required: [] }
async function collectConnection(env: Bindings, connection: Connection, trigger: 'schedule' | 'manual', now: Date): Promise<{ run: string | null; outcome: string }> {
 if (!await capabilityAllowed(env,'collections',connection.id)) return {run:null,outcome:'inactive after restore'}
 if (connection.provider === 'private-git') throw new Refusal('Run the installed read-only collector on its private computer.', 409)
 if (connection.provider === 'azuredevops') return runAzureDevops(env,connection,trigger,now)
 if (connection.provider === 'bitbucket') return runBitbucket(env,connection,trigger,now)
 if (connection.provider === 'gitlab') return runGitlab(env,connection,trigger,now)
 if (connection.provider === 'aws') return runAwsCollection(env, connection, trigger, now)
 if (connection.provider === 'knowbe4') return runKnowBe4(env, connection, trigger, now)
 if (isDirectory(connection.provider)) return runDirectoryCollection(env, connection, trigger, now)
 if (isScopedCloud(connection.provider)) return runScopedCollection(env, connection, scopedClouds[connection.provider], trigger, now)
 const at = now.toISOString(), started = await startRun(env, connection, connectorRevision, trigger, now, { interval_minutes: collectionMinutes(connection), gaps: [] })
 if (!started) return { run: null, outcome: 'already running' }
 const { finish, checkpoint } = started
 if (connection.status !== 'active' || !connection.secret_ciphertext || !connection.secret_iv) return finish('failed', {}, 'connection is ' + connection.status)
 let token: string
 try { token = await unseal(env, connection.secret_ciphertext, connection.secret_iv, connection.id) }
 catch { return finish('failed', {}, 'credential unreadable under this installation key', reconnectUpdate(env, connection, 'Stored credential cannot be decrypted; reconnect.', now)) }
 const selected = (await env.DB.prepare('SELECT full_name FROM connection_repositories WHERE connection_id=? AND selected=1 ORDER BY full_name').bind(connection.id).all<{ full_name: string }>()).results.map(r => r.full_name)
 const coverage: { organization: string; repositories_selected: number; repositories_read: string[]; unreadable: { repository: string; reason: string }[]; gaps: { asset: string; reason: string }[]; interval_minutes: number; code_history:Record<string,unknown>; github_members?:unknown } = { organization: 'unread', repositories_selected: selected.length, repositories_read: [], unreadable: [], gaps: [], interval_minutes: collectionMinutes(connection), code_history:{} }
 const authority = await digest(JSON.stringify([connection.secret_ciphertext,connection.secret_iv,connection.rotated_at,connection.config_json,selected,connectorRevision,started.context]))
 type Resume = { authority: string; started_at: string; streams: Record<string,AlertCursor> }
 const previous = await env.DB.prepare('SELECT coverage_json FROM collection_runs WHERE connection_id=? AND id!=? ORDER BY started_at DESC,rowid DESC LIMIT 1').bind(connection.id,started.run).first<{coverage_json:string}>()
 const prior = previous ? JSON.parse(previous.coverage_json).resume as Resume | undefined : undefined
 const resumable = prior && prior.authority === authority && typeof prior.started_at === 'string' && now.getTime()-Date.parse(prior.started_at) >= 0 && now.getTime()-Date.parse(prior.started_at) <= 3600000 && prior.streams && Object.values(prior.streams).some(s => !s.complete)
 const resume: Resume = resumable ? prior : { authority, started_at: at, streams:{} }
 const tracked = coverage as typeof coverage & { resume: Resume; cursor: Record<string,string|null>; source_read_started_at: string }
 tracked.resume = resume; tracked.cursor = {}; tracked.source_read_started_at = resume.started_at
 const client = githubClient(connection.api_base,token,()=>now.getTime(),{
  load: path => resume.streams[path],
  async save(path,cursor) {
   const streams = {...resume.streams}; if (cursor) streams[path]=cursor; else delete streams[path]
   if (JSON.stringify(streams).length > 65536) return false
   resume.streams=streams; tracked.cursor=Object.fromEntries(Object.entries(streams).filter(([,s])=>!s.complete).map(([path,s])=>[path,s.next]))
   await checkpoint(tracked)
   return true
  },
 })
 const source = { kind: 'source-observed' as const, ref: 'github:' + connection.id, label: `GitHub ${connection.account} via ${connection.label}` }
 const dependencies:{uniqueId:string;displayName:string;attributes:Record<string,unknown>}[]=[]
 const dependencySource={kind:'source-observed' as const,ref:'github-dependencies:'+connection.id,label:`GitHub ${connection.account} dependency export via ${connection.label}`}
 let dependencyComplete=true
 const repos: { uniqueId: string; displayName: string; attributes: Record<string, unknown> }[] = []
 let organization: { uniqueId: string; displayName: string; attributes: Record<string, unknown> } | null = null
 try {
  const org = await readOrganization(client, connection.account)
  organization = { uniqueId: connection.account, displayName: connection.account + ' (organization)', attributes: org.readable ? { ...org.attributes, readable: true } : { login: connection.account, two_factor_requirement_enabled: null, readable: false } }
  coverage.organization = org.readable ? 'read' : `unreadable (${org.status})`
  coverage.gaps.push(...(org.readable ? org.gaps : [org.reason ?? `organization unreadable: GitHub answered ${org.status}`]).map(reason => ({ asset: connection.account, reason })))
  const members=await collectGithubMembers(env,connection,client,now)
  coverage.github_members=members
  coverage.gaps.push(...members.gaps.map(reason=>({asset:connection.account,reason})))
  organization.attributes.departed_members=members.departed_members
  for (const name of selected) {
   const read = await readRepository(client, name)
   if (read.readable) { coverage.gaps.push(...read.gaps.map(reason => ({ asset: name, reason }))); repos.push({ uniqueId: name, displayName: name, attributes: { ...read.attributes, readable: true } }); coverage.repositories_read.push(name)
    const history=await readGithubHistory(client,connection.api_base,name)
    if(new TextEncoder().encode(JSON.stringify({...coverage.code_history,[name]:history})).length<=80000)coverage.code_history[name]=history
    else history.gaps.push('total change history exceeds 80,000 bytes; repository history not retained')
    if(history.dependencies){for(const pkg of history.dependencies.packages)dependencies.push({uniqueId:await digest(name+':'+pkg.id),displayName:pkg.name,attributes:{repository:name,name:pkg.name,version:pkg.version,generated_at:history.dependencies.generated_at,source_revision:null,readable:true}})}else dependencyComplete=false
    coverage.gaps.push(...history.gaps.map(reason=>({asset:name,reason})))
   }
   else { dependencyComplete=false;coverage.gaps.push({ asset: name, reason: read.reason }); coverage.unreadable.push({ repository: name, reason: read.reason }); repos.push({ uniqueId: name, displayName: name, attributes: { readable: false } }) }
  }
 } catch (error) {
  if (error instanceof Throttled) {
   return finish('throttled', coverage, 'rate limited until ' + new Date(error.resetAt).toISOString(), backoffUpdate(env, connection, error.resetAt, 'GitHub', now))
  }
  if (error instanceof Unauthorized) return finish('failed', coverage, 'credential rejected by GitHub', reconnectUpdate(env, connection, 'GitHub rejected the credential (revoked or expired); reconnect with a new one.', now))
  return finish('failed', coverage, 'transport failure', env.DB.prepare('UPDATE connections SET last_attempt_at=?,last_error=? WHERE id=?').bind(at, 'GitHub could not be reached.', connection.id))
 }
 const dependencySchema:ResourceSchema={fields:{repository:'string',name:'string',version:'string',generated_at:'string',source_revision:'string',readable:'boolean'},required:[]}
 if(dependencyComplete)await upsertRegister(env,'github.dependency',dependencySchema,dependencies,dependencySource,now)
 else {
  const known=(await env.DB.prepare("SELECT unique_id,display_name FROM resources WHERE type='github.dependency' AND source_ref=? AND removed_at IS NULL").bind(dependencySource.ref).all<{unique_id:string;display_name:string}>()).results
  for(let i=0;i<known.length;i+=200)await upsertResources(env,'github.dependency',dependencySchema,known.slice(i,i+200).map(d=>({uniqueId:d.unique_id,displayName:d.display_name,attributes:{readable:false}})),dependencySource,false,now)
 }
 if(dependencyComplete)await env.DB.prepare("UPDATE resources SET observed_at=? WHERE type='github.dependency' AND source_ref=? AND removed_at IS NULL").bind(resume.started_at,dependencySource.ref).run()
 // Unread repositories stay in the denominator with readable=false: their tests are unknown.
 await upsertResources(env, 'github.organization', organizationSchema, organization ? [organization] : [], source, false, now)
 const written = await upsertResources(env, 'github.repository', repositorySchema, repos, source, 'source', now)
 const fresh = written.results.filter(r => r.id && r.outcome !== 'removed' && coverage.repositories_read.includes(r.uniqueId)).map(r => r.id!)
 const observed = [
  ...(coverage.organization === 'read' ? [env.DB.prepare("UPDATE resources SET observed_at=? WHERE type='github.organization' AND unique_id=? AND source_ref=?").bind(resume.started_at, connection.account, source.ref)] : []),
  ...(fresh.length ? [env.DB.prepare('UPDATE resources SET observed_at=? WHERE id IN (SELECT value FROM json_each(?))').bind(resume.started_at, JSON.stringify(fresh))] : []),
 ]
 // Nothing read is nothing stamped: an empty batch would abort the run before it finishes.
 if (observed.length) await env.DB.batch(observed)
 // A run that read nothing at all is a failure: it never refreshes the last successful read.
 if (coverage.organization !== 'read' && !coverage.repositories_read.length) {
  const result = await finish('failed', coverage, 'nothing readable: organization ' + coverage.organization, env.DB.prepare('UPDATE connections SET last_attempt_at=?,last_error=? WHERE id=?').bind(at, `GitHub returned nothing readable (organization ${coverage.organization}).`, connection.id))
  await runForType(env, 'github.repository', now); await runForType(env, 'github.organization', now)
  return result
 }
 const outcome = coverage.gaps.length || coverage.unreadable.length || coverage.organization !== 'read' ? 'partial' : 'complete'
 const result = await finish(outcome, coverage, '', env.DB.prepare("UPDATE connections SET last_attempt_at=?,last_success_at=?,next_attempt_at=NULL,backoff_seconds=0,last_error=? WHERE id=?").bind(at, at, outcome === 'partial' ? `${coverage.unreadable.length} repositories unreadable; ${coverage.gaps.length} evidence gaps` : '', connection.id))
 await runForType(env, 'github.repository', now)
 await runForType(env, 'github.organization', now)
 await runForType(env, 'identity.account', now)
 return result
}
export const runCollection=(env:Bindings,connection:Connection,trigger:'schedule'|'manual',now:Date)=>withPages(env,connection,now,()=>collectConnection(env,connection,trigger,now))
// Every hosted collector uses its owner-set elapsed interval.
// Backoff is a lower bound even when a shorter schedule becomes due.
export async function collectDue(env: Bindings, now: Date) {
 const events=await collectEvents(env,now,async (scoped,id,clock)=>runCollection(scoped,await requireConnection(scoped,id),'manual',clock))
 const { results } = await env.DB.prepare("SELECT * FROM connections WHERE status='active' AND provider!='private-git' AND (next_attempt_at IS NULL OR next_attempt_at<=?)").bind(now.toISOString()).all<Connection>()
 const due = results.filter(connection => !connection.last_attempt_at || Date.parse(connection.last_attempt_at) + collectionMinutes(connection) * 60000 <= now.getTime())
 for (const connection of due) await runCollection(env, connection, 'schedule', now)
 return due.length + events
}
