import { runtimeBindings, type Bindings } from '../../auth.server'
import { Refusal, upload } from '../upload'
import { auditStatement } from '../door'
import { apiType, declareType, parseSchema, removeResource, resourceType, upsertResources, MAX_ITEMS } from '../resources'
import { runForType, runTest } from '../tests/engine'
import { defineTest, parseDefinition, requireTest } from '../tests/storage'
import { createRisk } from '../risk/storage'
import { authenticate, type Scope } from './tokens'
import { page } from './collections'
import { openapi } from './openapi'
export const RATE_LIMIT = 120
const headers = { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }
const reply = (data: unknown, status = 200, extra: Record<string, string> = {}) => Response.json(data, { status, headers: { ...headers, ...extra } })
async function body(request: Request) {
 const length = Number(request.headers.get('content-length') ?? 0)
 if (length > 1024 * 1024) throw new Refusal('Request body exceeds 1 MiB.', 413)
 const text = await request.text()
 if (text.length > 1024 * 1024) throw new Refusal('Request body exceeds 1 MiB.', 413)
 try { const value = JSON.parse(text); if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown> } catch { /* refused below */ }
 throw new Refusal('Send one JSON object.')
}
type Handler = (request: Request, env: Bindings, match: RegExpExecArray, token: { id: string; name: string; created_by: string; created_name: string }, now: Date) => Promise<Response>
interface V1Route { method: string; pattern: RegExp; route: string; scope: Scope; run: Handler }
const sourceOf = (token: { id: string; name: string; created_name: string }) => ({ kind: 'source-reported' as const, ref: 'api:' + token.id, label: `Source-reported via API token "${token.name}" (owner ${token.created_name})` })
const routes: V1Route[] = [
 { method: 'PUT', pattern: /^\/v1\/resource-types\/([a-z][a-z0-9_]{1,62})$/, route: '/v1/resource-types/{type}', scope: 'resource-push', run: async (request, env, m, token, now) => {
  const schema = parseSchema((await body(request)).schema)
  await declareType(env, m[1], schema, 'api:' + token.id, now)
  return reply({ type: m[1], schema })
 } },
 { method: 'PUT', pattern: /^\/v1\/resources\/([^/]+)$/, route: '/v1/resources/{type}', scope: 'resource-push', run: async (request, env, m, token, now) => {
  if (!apiType(m[1])) throw new Refusal('Pushed resource types are lowercase names such as internal_service; connector types are read-only.')
  const declared = await resourceType(env, m[1]); if (!declared) throw new Refusal('Declare the resource type first with PUT /v1/resource-types/{type}.', 404)
  const input = await body(request), items = input.resources
  if (!Array.isArray(items)) throw new Refusal(`Send resources as a list of at most ${MAX_ITEMS}.`)
  const result = await upsertResources(env, m[1], parseSchema(declared.schema_json), items, sourceOf(token), input.fullSync === true, now)
  // A source change event: tests over this type run now, as a source-change run.
  const testsRun = result.changed.length ? await runForType(env, m[1], now) : 0
  const rejected = result.results.filter(r => r.outcome === 'rejected').length
  return reply({ results: result.results, created: result.results.filter(r => r.outcome === 'created').length, updated: result.results.filter(r => r.outcome === 'updated' || r.outcome === 'restored').length, unchanged: result.results.filter(r => r.outcome === 'unchanged').length, removed: result.results.filter(r => r.outcome === 'removed').length, rejected, tests_run: testsRun, provenance: sourceOf(token).label }, rejected && rejected === items.length ? 422 : 200)
 } },
 { method: 'DELETE', pattern: /^\/v1\/resources\/([a-z][a-z0-9_]{1,62})\/([^/]+)$/, route: '/v1/resources/{type}/{uniqueId}', scope: 'resource-push', run: async (_request, env, m, token, now) => {
  const removed = await removeResource(env, m[1], decodeURIComponent(m[2]), sourceOf(token), now)
  await runForType(env, m[1], now)
  return reply({ uniqueId: removed.unique_id, removed_at: removed.removed_at })
 } },
 { method: 'POST', pattern: /^\/v1\/evidence$/, route: '/v1/evidence', scope: 'evidence-push', run: async (request, env, _m, token, now) => {
  if (!request.headers.get('content-type')?.startsWith('multipart/form-data;')) throw new Refusal('Send multipart form data with requirement_id, file, covered_from and covered_to.')
  const form = await request.clone().formData().catch(() => { throw new Refusal('Invalid multipart body.') })
  const requirement = form.get('requirement_id'); if (typeof requirement !== 'string') throw new Refusal('Name the requirement_id.')
  const source = sourceOf(token).label + (typeof form.get('source') === 'string' && form.get('source') ? ': ' + String(form.get('source')).slice(0, 700) : '')
  const rebuilt = new FormData(); for (const [key, value] of form) if (key !== 'source') rebuilt.append(key, value); rebuilt.set('source', source)
  const receipt = await upload(new Request(request.url, { method: 'POST', body: rebuilt }), env, requirement, { id: token.created_by, displayName: token.created_name }, now, id => [env.DB.prepare('INSERT INTO api_evidence(receipt_id,token_id,token_name,owner_name) VALUES(?,?,?,?)').bind(id, token.id, token.name, token.created_name)])
  return reply({ receipt, origin: 'manually-asserted', label: 'source-reported', source }, 201)
 } },
 { method: 'POST', pattern: /^\/v1\/tests$/, route: '/v1/tests', scope: 'test-write', run: async (request, env, _m, token, now) => {
  const created = await defineTest(env, parseDefinition(await body(request)), 'api', 'api:' + token.id, { id: token.id, name: `API token ${token.name}`, kind: 'token' }, now)
  const test = await requireTest(env, created.id); const result = await runTest(env, created.id, 'manual', now)
  return reply({ id: created.id, test, first_run: { id: result.run, results: result.observations.map(o => ({ resource_id: o.resource_id, result: o.result, reason: o.reason, source_kind: o.source_kind })) } }, 201)
 } },
 { method: 'POST', pattern: /^\/v1\/tests\/([a-f0-9-]{36})\/runs$/, route: '/v1/tests/{id}/runs', scope: 'test-write', run: async (_request, env, m, _token, now) => { const result = await runTest(env, m[1], 'manual', now); return reply({ run: result.run, results: result.observations.map(o => ({ resource_id: o.resource_id, result: o.result, reason: o.reason, source_kind: o.source_kind })) }, 201) } },
 { method: 'POST', pattern: /^\/v1\/risks$/, route: '/v1/risks', scope: 'risk-push', run: async (request, env, _m, token, now) => reply(await createRisk(env, { id: token.created_by, name: `API token ${token.name} (owner ${token.created_name})`, kind: 'token' }, await body(request), 'api', now), 201) },
 { method: 'GET', pattern: /^\/v1\/(programs|controls|requirements|test-results|tests|remediation|policies|people|vendors|risks|resources)$/, route: '/v1/{collection}', scope: 'read', run: async (request, env, m, _token, now) => reply(await page(env, m[1], new URL(request.url).searchParams, now)) },
]
// The public door: Bearer tokens only (cookies are ignored), explicit 429s with
// a retry time, and one audit row per call without the token or its digest.
export function apiHandler(clock: () => Date) {
 return async (request: Request, original: Bindings): Promise<Response | null> => {
  const url = new URL(request.url)
  if (!url.pathname.startsWith('/v1/')) return null
  const env = runtimeBindings(original), now = clock()
  if (url.pathname === '/v1/openapi.json' && request.method === 'GET') return reply(openapi(env.AUTH_ORIGIN))
  if (url.origin !== env.AUTH_ORIGIN) return reply({ error: 'Invalid host.' }, 403)
  const candidates = routes.filter(r => r.pattern.test(url.pathname))
  const route = candidates.find(r => r.method === request.method)
  const record = (status: number, tokenId: string | null) => env.DB.prepare('INSERT INTO api_calls(id,token_id,method,route,status,at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(), tokenId, request.method.slice(0, 10), route?.route ?? (candidates[0]?.route ?? 'unknown'), status, now.toISOString()).run()
  if (!candidates.length) { await record(404, null); return reply({ error: 'Unknown API route.' }, 404) }
  if (!route) { await record(405, null); return reply({ error: 'Method not allowed.' }, 405) }
  const auth = await authenticate(env, request.headers.get('authorization'), now)
  if (!auth.ok) { await record(401, null); return reply({ error: auth.error }, 401, { 'www-authenticate': 'Bearer' }) }
  if (!auth.scopes.includes(route.scope)) { await record(403, auth.token.id); await auditStatement(env, { id: auth.token.id, name: 'API token ' + auth.token.name, kind: 'token' }, 'api.scope-refused', route.route, now, 'refused', 'needs ' + route.scope).run(); return reply({ error: `This token lacks the ${route.scope} scope.` }, 403) }
  const window = now.toISOString().slice(0, 16), used = await env.DB.prepare('INSERT INTO api_rate(token_id,window,count) VALUES(?,?,1) ON CONFLICT(token_id,window) DO UPDATE SET count=count+1 RETURNING count').bind(auth.token.id, window).first<{ count: number }>()
  if ((used?.count ?? 0) > RATE_LIMIT) { const retry = Math.max(1, 60 - now.getUTCSeconds()); await record(429, auth.token.id); return reply({ error: `Rate limit of ${RATE_LIMIT} requests per minute reached.`, retry_after_seconds: retry }, 429, { 'retry-after': String(retry) }) }
  try {
   const response = await route.run(request, env, route.pattern.exec(url.pathname)!, auth.token, now)
   await record(response.status, auth.token.id)
   return response
  } catch (error) {
   const status = error instanceof Refusal ? error.status : 503
   await record(status, auth.token.id).catch(() => undefined)
   if (!(error instanceof Refusal)) console.error('API operation failed', error instanceof Error ? error.message : '')
   return reply({ error: error instanceof Refusal ? error.message : 'Storage unavailable; nothing was written.' }, status)
  }
 }
}
