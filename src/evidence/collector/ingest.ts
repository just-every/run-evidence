import type { Bindings } from '../../auth.server'
import { runtimeBindings } from '../../auth.server'
import { json, uuid } from '../door'
import { boundedBody, Refusal } from '../upload'
import { upsertResources, declareType } from '../resources'
import { runForType } from '../tests/engine'
import { startRun } from '../connect/runs'
import { authenticateCollector } from './storage'
import { resourceType, revision, schema, validateReport, unsupported } from './profile'
// Receiving door for the reviewed collector only. Ordinary API tokens and
// owner cookies never acquire source-observation authority here.
export function collectorHandler(clock: () => Date) {
 return async (request: Request, original: Bindings): Promise<Response | null> => {
  const url = new URL(request.url), match = new RegExp(`^/collectors/(${uuid})/observations$`).exec(url.pathname)
  if (!match) return null
  const env = runtimeBindings(original), now = clock()
  if (url.origin !== env.AUTH_ORIGIN || request.headers.has('host') && request.headers.get('host')?.toLowerCase() !== url.host.toLowerCase() || request.headers.get('sec-fetch-site') === 'cross-site' || request.headers.has('origin') && request.headers.get('origin') !== env.AUTH_ORIGIN) return json({ error: 'Invalid collector origin.' }, 403)
  if (request.method !== 'POST') return json({ error: 'POST required.' }, 405)
  const row = await authenticateCollector(env, match[1], request.headers.get('authorization'))
  if (!row) return json({ error: 'Collector credential refused.' }, 401)
  try {
   if (!request.headers.get('content-type')?.startsWith('application/json')) throw new Refusal('Send a JSON collector report.')
   let input: unknown
   try { input = JSON.parse(new TextDecoder().decode(await boundedBody(request, 8192))) } catch (e) { if (e instanceof Refusal) throw e; throw new Refusal('Invalid collector report JSON.') }
   if (JSON.parse(row.config_json).revision !== revision) throw new Refusal('Review and register the current collector profile before sending observations.', 409)
   const report = validateReport(input, row.account, now)
   // Reports from the same read are idempotent, and older reads cannot make a source fresh.
   const last = await env.DB.prepare('SELECT MAX(started_at) AS at FROM collection_runs WHERE connection_id=? AND finished_at IS NOT NULL').bind(row.id).first<{ at: string | null }>()
   if (last?.at && report.observedAt <= last.at) return json({ error: 'This source read was already recorded or is older than its history.' }, 409)
   const live = await authenticateCollector(env, row.id, request.headers.get('authorization'))
   if (!live) return json({ error: 'Collector credential refused.' }, 401)
   const sourceTime = new Date(report.observedAt), started = await startRun(env, row, revision, 'manual', sourceTime)
   if (!started) return json({ error: 'A collection is already running.' }, 409)
   if (!report.complete) {
    // Preserve the resource in the denominator, immediately invalidate its read
    // time, and never stamp the failure as a successful source observation.
    await env.DB.prepare('UPDATE resources SET observed_at=NULL WHERE source_ref=?').bind('private-git:' + row.id).run()
    const result = await started.finish('failed', { resources_expected: 1, resources_read: 0, unsupported }, 'repository_unreadable', env.DB.prepare('UPDATE connections SET last_attempt_at=?,last_error=? WHERE id=?').bind(now.toISOString(), 'Private repository could not be read. Check its local path and permissions; run the collector again.', row.id))
    await runForType(env, resourceType, now)
    return json(result, 202)
   }
   await declareType(env, resourceType, schema, 'reviewed collector ' + revision, now)
   // Identity includes the connection, so two collectors cannot overwrite one another.
   const written = await upsertResources(env, resourceType, schema, [{ uniqueId: row.id, displayName: row.label, attributes: report.attributes }], { kind: 'source-observed', ref: 'private-git:' + row.id, label: row.label }, 'source', now)
   if (written.results.some(r => r.outcome === 'rejected')) throw new Refusal('Collector resource admission refused.', 409)
   await env.DB.prepare('UPDATE resources SET observed_at=? WHERE type=? AND source_ref=?').bind(report.observedAt, resourceType, 'private-git:' + row.id).run()
   const result = await started.finish('complete', { resources_expected: 1, resources_read: 1, source_read_at: report.observedAt, received_at: now.toISOString(), unsupported }, '', env.DB.prepare("UPDATE connections SET last_attempt_at=?,last_success_at=?,last_error='' WHERE id=?").bind(now.toISOString(), report.observedAt, row.id))
   await runForType(env, resourceType, now)
   return json(result, 201)
  } catch (e) { return json({ error: e instanceof Refusal ? e.message : 'Collector storage unavailable; no completed read is claimed.' }, e instanceof Refusal ? e.status : 503) }
 }
}
