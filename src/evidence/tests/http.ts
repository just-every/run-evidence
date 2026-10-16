import { Refusal } from '../upload'
import { done, json, ownerRoutes, readInput, text, uuid, type Route } from '../door'
import { catalogue } from './catalogue'
import { parseCriteria } from './criteria'
import { runTest } from './engine'
import { addException, catalogueFor, defineTest, latestRevision, parseDefinition, requireTest, reviseTest, staleIntervals, testControls, type TestRow } from './storage'
import { testPage, testsPage, type TestDetail } from './view'
import type { Bindings } from '../../auth.server'
import { obligations } from '../remedy/storage'
import { ticketPanel } from '../work/granularity'
const id = `(${uuid})`
const both = (path: string) => new RegExp(`^/(?:app|api)${path}$`)
export async function testSummaries(env: Bindings, now: Date) {
 const rows = (await env.DB.prepare('SELECT t.*,(SELECT MAX(started_at) FROM test_runs r WHERE r.test_id=t.id) AS last_run FROM tests t ORDER BY t.created_at,t.id').all<TestRow & { last_run: string | null }>()).results
 const latest = (await env.DB.prepare('SELECT o.test_id,o.result FROM observations o JOIN test_runs r ON r.id=o.run_id WHERE r.started_at=(SELECT MAX(started_at) FROM test_runs x WHERE x.test_id=o.test_id)').all<{ test_id: string; result: string }>()).results
 return rows.map(t => { const results = latest.filter(o => o.test_id === t.id).map(o => o.result); return { ...t, failing: results.filter(r => r === 'fail').length, status: !t.last_run ? 'never run' : results.includes('fail') ? 'failing' : results.includes('unknown') ? 'unknown' : results.length ? 'passing' : 'no resources', stale: !!t.last_run && now.getTime() - Date.parse(t.last_run) > (t.cadence === 'hourly' ? 3600000 : 86400000) * 1.5 } })
}
export async function testDetail(env: Bindings, testId: string, now: Date): Promise<TestDetail> {
 const t = await requireTest(env, testId)
 const [revisions, runs, latest, exceptions] = await env.DB.batch([
  env.DB.prepare('SELECT revision,criteria_json,excluded_json,cadence,actor,reason,at FROM test_revisions WHERE test_id=? ORDER BY revision').bind(testId),
  env.DB.prepare('SELECT id,trigger,started_at,revision,population,passed,failed,unknown,not_applicable FROM test_runs WHERE test_id=? ORDER BY started_at DESC,rowid DESC LIMIT 200').bind(testId),
  env.DB.prepare(`SELECT o.resource_id,r.display_name,o.source_kind,r.source_label,o.result,o.reason,o.observed_at,o.revision,o.exception_id AS exception,(SELECT id FROM obligations b WHERE b.test_id=o.test_id AND b.resource_id=o.resource_id) AS obligation FROM observations o JOIN resources r ON r.id=o.resource_id WHERE o.test_id=? AND r.removed_at IS NULL AND o.rowid=(SELECT o2.rowid FROM observations o2 WHERE o2.test_id=o.test_id AND o2.resource_id=o.resource_id ORDER BY o2.observed_at DESC,o2.rowid DESC LIMIT 1) ORDER BY r.display_name`).bind(testId),
  env.DB.prepare('SELECT id,resource_id,reason,approved_name,approved_at,expires_at,revoked_at FROM test_exceptions WHERE test_id=? ORDER BY approved_at').bind(testId),
 ])
 const runRows = runs.results as TestDetail['runs']
 // Per-item SLA status and linked tracker tickets (REMEDY-002, WORK-002).
 const own = (await obligations(env, now)).filter(o => o.test_id === testId)
 const tickets = own.length ? (await env.DB.prepare(`SELECT k.obligation_id,k.remote_key,k.remote_url,k.remote_status,k.remote_assignee,k.sync_state,k.last_synced_at,d.label FROM tickets k JOIN tracker_destinations d ON d.id=k.destination_id WHERE k.obligation_id IN (${own.map(() => '?').join(',')})`).bind(...own.map(o => o.id)).all<TestDetail['latest'][number]['tickets'][number] & { obligation_id: string }>()).results : []
 const latestRows = (latest.results as Omit<TestDetail['latest'][number], 'sla' | 'due' | 'tickets'>[]).map(o => { const ob = own.find(x => x.id === o.obligation); return { ...o, sla: ob ? (ob.state === 'risk accepted' ? 'risk accepted' : ob.sla.status) : null, due: ob?.sla.due ?? null, tickets: tickets.filter(t => t.obligation_id === o.obligation).map(t => ({ ...t, stale: !t.last_synced_at || now.getTime() - Date.parse(t.last_synced_at) > 15 * 60000 })) } })
 return { test: t, criteria: parseCriteria(t.criteria_json), entry: catalogueFor(t), revisions: revisions.results as TestDetail['revisions'], controls: await testControls(env, testId), runs: runRows, latest: latestRows, exceptions: exceptions.results as TestDetail['exceptions'], stale: staleIntervals([...runRows].reverse(), t.cadence, t.created_at, now) }
}
export function testHandler(clock: () => Date) {
 const routes: Route[] = [
  { method: 'GET', pattern: both('/tests'), run: async c => {
   const rows = await testSummaries(c.env, c.now)
   if (c.isApi) return json({ tests: rows, catalogue })
   const types = [...new Set([...(await c.env.DB.prepare('SELECT type FROM resource_types ORDER BY type').all<{ type: string }>()).results.map(r => r.type), ...catalogue.map(e => e.resourceType)])]
   return testsPage(rows, types, catalogue.filter(e => e.unsupported), c.actor.name, c.url.searchParams.get('controls') ?? '')
  } },
  { method: 'POST', pattern: both('/tests'), run: async c => { const created = await defineTest(c.env, parseDefinition(await readInput(c.request)), 'custom', c.actor.id, c.actor, c.now); return done(c, '/app/tests/' + created.id, created, 201) } },
  { method: 'GET', pattern: both(`/tests/${id}`), run: async (c, m) => { const d = await testDetail(c.env, m[1], c.now), tickets = await ticketPanel(c.env, m[1], c.now); return c.isApi ? json({ ...d, tickets }) : testPage(d, c.actor.name, tickets) } },
  { method: 'POST', pattern: both(`/tests/${id}/run`), run: async (c, m) => { const result = await runTest(c.env, m[1], 'manual', c.now); return done(c, '/app/tests/' + m[1], { run: result.run, observations: result.observations.length }) } },
  { method: 'POST', pattern: both(`/tests/${id}/revisions`), run: async (c, m) => {
   const input = await readInput(c.request), prior = (await latestRevision(c.env, m[1]))!
   const criteria = typeof input.criteria === 'string' && input.criteria && input.criteria !== prior.criteria_json ? parseCriteria(input.criteria) : undefined
   const excluded = typeof input.excluded === 'string' ? input.excluded.split('\n').map(l => l.trim()).filter(Boolean).map(l => { const [resource, ...why] = l.split(/\s+/); if (!resource || !why.length) throw new Refusal('Each out-of-scope line needs a resource id and a rationale.'); return { resource_id: resource, rationale: why.join(' ') } }) : undefined
   const revision = await reviseTest(c.env, m[1], { criteria, excluded, cadence: input.cadence === 'daily' || input.cadence === 'hourly' ? input.cadence : undefined }, c.actor, text(input, 'reason', 500), c.now)
   return done(c, '/app/tests/' + m[1], { revision })
  } },
  { method: 'POST', pattern: both(`/tests/${id}/exceptions`), run: async (c, m) => { const input = await readInput(c.request); return done(c, '/app/tests/' + m[1], { id: await addException(c.env, m[1], typeof input.resource_id === 'string' && input.resource_id ? input.resource_id : null, text(input, 'reason', 500), text(input, 'expires_at', 40), c.actor, c.now) }, 201) } },
 ]
 return ownerRoutes(routes, clock)
}
