import {collectionReceiptTime} from '../connect/clock'
import {sourceAuthorities,sourceAuthorityGap} from '../connect/source-authority'
import { runDefinitions } from '../control-definition/storage'
import type { Bindings } from '../../auth.server'
import type { Resource } from '../resources'
import { remediationStatements } from '../remedy/storage'
import { acceptedLibraryRevision } from '../program/library-revision'
import { evaluate, parseCriteria } from './criteria'
import { activeExceptions, CADENCE_MS, exclusions, latestRevision, requireTest, type Observation, type TestRow } from './storage'
type Trigger = 'schedule' | 'source-change' | 'manual' | 'retest'
// One run evaluates the declared population under the latest revision and
// appends immutable observations, stamped with the library revision in force
// (LIBRARY-001). Remediation follows in the same transaction.
export async function runTest(env: Bindings, testId: string, trigger: Trigger, now: Date, only?: string | string[]) {
 const row = await requireTest(env, testId), revision = (await latestRevision(env, testId))!
 const criteria = parseCriteria(revision.criteria_json), excluded = exclusions(revision.excluded_json)
 const selected = typeof only === 'string' ? [only] : only
 const population = (await env.DB.prepare('SELECT * FROM resources WHERE type=? AND removed_at IS NULL' + (selected ? ' AND id IN (SELECT value FROM json_each(?))' : '') + ' ORDER BY unique_id').bind(...(selected ? [row.resource_type, JSON.stringify(selected)] : [row.resource_type])).all<Resource>()).results
 const authorities=population.some(r=>r.source_kind==='source-observed')?await sourceAuthorities(env):[]
 const exceptions = (await activeExceptions(env, now)).filter(e => e.test_id === testId)
 const run = crypto.randomUUID(), at = now.toISOString(), observations: Observation[] = []
 const previous = (await env.DB.prepare('SELECT MAX(started_at) AS at FROM test_runs WHERE test_id=?').bind(testId).first<{ at: string | null }>())?.at ?? null
 for (const resource of population) {
  const exclusion = excluded.find(e => e.resource_id === resource.id)
  // A collector read older than the cadence allows is stale: unknown, never carried forward.
  const stale = resource.source_kind === 'source-observed' && (!resource.observed_at || now.getTime() - Date.parse(resource.observed_at) > CADENCE_MS[row.cadence] * 1.5 + 3600000)
  const authority=resource.source_kind==='source-observed'?sourceAuthorityGap(resource.source_ref,authorities):null
  const evaluated = exclusion ? { result: 'not applicable' as const, actual: {}, reason: 'Out of scope: ' + exclusion.rationale } : stale ? { result: 'unknown' as const, actual: {}, reason: `No successful source read since ${resource.observed_at ?? 'connection'}; the last read is stale` } : authority ? {result:'unknown' as const,actual:{},reason:authority} : evaluate(criteria, JSON.parse(resource.attributes_json))
  const exception = exceptions.find(e => e.resource_id === resource.id || e.resource_id === null)
  observations.push({ id: crypto.randomUUID(), run_id: run, test_id: testId, revision: revision.revision, resource_id: resource.id, result: evaluated.result, expected_json: revision.criteria_json, actual_json: JSON.stringify(evaluated.actual), reason: evaluated.reason, source_kind: resource.source_kind, source_ref: resource.source_ref, observed_at: at, exception_id: exception?.id ?? null, interval_from: previous })
 }
 const count = (result: string) => observations.filter(o => o.result === result).length
 await env.DB.batch([
  env.DB.prepare("INSERT INTO test_runs(id,test_id,revision,trigger,started_at,finished_at,outcome,population,passed,failed,unknown,not_applicable) VALUES(?,?,?,?,?,?,'complete',?,?,?,?,?)").bind(run, testId, revision.revision, trigger, at, at, observations.length, count('pass'), count('fail'), count('unknown'), count('not applicable')),
  env.DB.prepare('INSERT INTO run_library_revisions(run_id,library_revision) VALUES(?,?)').bind(run, await acceptedLibraryRevision(env)),
  ...(observations.length ? [env.DB.prepare("INSERT INTO observations(id,run_id,test_id,revision,resource_id,result,expected_json,actual_json,reason,source_kind,source_ref,observed_at,exception_id,interval_from) SELECT value->>'id',value->>'run_id',value->>'test_id',value->>'revision',value->>'resource_id',value->>'result',value->>'expected_json',value->>'actual_json',value->>'reason',value->>'source_kind',value->>'source_ref',value->>'observed_at',value->>'exception_id',value->>'interval_from' FROM json_each(?)").bind(JSON.stringify(observations))] : []),
  ...await runDefinitions(env, testId, run, now),
  ...await remediationStatements(env, row, observations, now),
 ])
 return { run, observations }
}
// Scheduled runs: configuration tests at least hourly, period tests daily.
export async function runDueTests(env: Bindings, now: Date, limit = 25) {
 const { results } = await env.DB.prepare('SELECT t.*,(SELECT MAX(started_at) FROM test_runs r WHERE r.test_id=t.id) AS last_run FROM tests t WHERE t.enabled=1 ORDER BY last_run IS NOT NULL,last_run').all<TestRow & { last_run: string | null }>()
 const due = results.filter(t => !t.last_run || now.getTime() - Date.parse(t.last_run) >= CADENCE_MS[t.cadence] - 5 * 60000).slice(0, limit)
 for (const t of due) await runTest(env, t.id, 'schedule', now)
 return due.length
}
// A source change re-runs the tests that read that resource type.
export async function runForType(env: Bindings, type: string, now: Date) {
 now=collectionReceiptTime(now)
 const { results } = await env.DB.prepare('SELECT id FROM tests WHERE enabled=1 AND resource_type=?').bind(type).all<{ id: string }>()
 for (const t of results) await runTest(env, t.id, 'source-change', now)
 return results.length
}

// Withdrawal and credential rejection append unknown evaluations without
// rewriting original receipts, resources, test runs or source snapshots.
export async function runForConnection(env:Bindings,id:string,now:Date){
 const types=(await env.DB.prepare("SELECT DISTINCT type FROM resources WHERE source_kind='source-observed' AND removed_at IS NULL AND (source_ref=? OR substr(source_ref,-length(?)-1)=':'||?)").bind(id,id,id).all<{type:string}>()).results
 for(const row of types)await runForType(env,row.type,now)
}
