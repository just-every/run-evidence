import type { Bindings } from '../../auth.server'
import { Refusal } from '../upload'
import { auditStatement, parseList, type Actor } from '../door'
import { libraryControl } from '../library'
import { adoptionStatements } from '../program/storage'
import { catalogue, type CatalogueEntry } from './catalogue'
import { parseCriteria, type Criterion } from './criteria'
export const categories = ['cloud', 'identity', 'code', 'device', 'vulnerability', 'security issue', 'personnel', 'policy', 'vendor'] as const
export const severities = ['critical', 'high', 'medium', 'low'] as const
export type Category = typeof categories[number]
export type Severity = typeof severities[number]
export interface TestRow { id: string; catalogue_id: string | null; name: string; resource_type: string; criteria_json: string; cadence: 'hourly' | 'daily'; category: Category; severity: Severity; origin: 'catalogue' | 'custom' | 'api'; defined_by: string; revision: number; enabled: number; created_at: string }
export interface Exclusion { resource_id: string; rationale: string }
export interface Observation { id: string; run_id: string; test_id: string; revision: number; resource_id: string; result: 'pass' | 'fail' | 'unknown' | 'not applicable'; expected_json: string; actual_json: string; reason: string; source_kind: string; source_ref: string; observed_at: string; exception_id: string | null; interval_from: string | null }
export const CADENCE_MS = { hourly: 3600000, daily: 86400000 } as const
export const test = (env: Bindings, id: string) => env.DB.prepare('SELECT * FROM tests WHERE id=?').bind(id).first<TestRow>()
export async function requireTest(env: Bindings, id: string) { const row = await test(env, id); if (!row) throw new Refusal('Test not found.', 404); return row }
export const latestRevision = (env: Bindings, id: string) => env.DB.prepare('SELECT * FROM test_revisions WHERE test_id=? ORDER BY revision DESC LIMIT 1').bind(id).first<{ revision: number; criteria_json: string; excluded_json: string; cadence: string; reason: string; actor: string; at: string }>()

// Resolve control references: an adopted control id or a shipped library id
// (adopting that library control when this installation has not yet).
async function controlStatements(env: Bindings, testId: string, refs: string[], now: Date, pending = new Set<string>()) {
 const statements: D1PreparedStatement[] = [], ids: string[] = []
 for (const ref of [...new Set(refs)]) {
  const direct = await env.DB.prepare('SELECT id FROM controls WHERE id=?').bind(ref).first<{ id: string }>()
  if (direct) { ids.push(direct.id); continue }
  const control = libraryControl(ref)
  if (!control) throw new Refusal(`Unknown control ${ref}.`)
  const adopted = await env.DB.prepare('SELECT control_id FROM library_adoptions WHERE library_id=?').bind(ref).first<{ control_id: string }>()
  if (adopted) { ids.push(adopted.control_id); continue }
  if (!pending.has(ref)) statements.push(...await adoptionStatements(env, [control], now))
  pending.add(ref)
  statements.push(env.DB.prepare('INSERT INTO test_controls(test_id,control_id) SELECT ?,control_id FROM library_adoptions WHERE library_id=?').bind(testId, ref))
 }
 statements.push(...ids.map(id => env.DB.prepare('INSERT OR IGNORE INTO test_controls(test_id,control_id) VALUES(?,?)').bind(testId, id)))
 return statements
}
// Enable the catalogue tests a connector runs. Unsupported classes stay listed
// in the catalogue with their manual requirement and never become tests.
export async function catalogueStatements(env: Bindings, provider: string, actor: Actor, now: Date) {
 const statements: D1PreparedStatement[] = [], pending = new Set<string>()
 for (const entry of catalogue.filter(e => e.providers.includes(provider) && !e.unsupported)) {
  if (await env.DB.prepare('SELECT 1 FROM tests WHERE catalogue_id=?').bind(entry.id).first()) continue
  const id = crypto.randomUUID(), at = now.toISOString()
  statements.push(
   env.DB.prepare("INSERT INTO tests(id,catalogue_id,name,resource_type,criteria_json,cadence,category,severity,origin,defined_by,created_at) VALUES(?,?,?,?,?,?,?,?,'catalogue','catalogue',?)").bind(id, entry.id, entry.name, entry.resourceType, JSON.stringify(entry.criteria), entry.cadence, entry.category, entry.severity, at),
   env.DB.prepare("INSERT INTO test_revisions(id,test_id,revision,criteria_json,excluded_json,cadence,actor,reason,at) VALUES(?,?,1,?,'[]',?,'catalogue',?,?)").bind(crypto.randomUUID(), id, JSON.stringify(entry.criteria), entry.cadence, 'Catalogue revision ' + entry.id, at),
   ...await controlStatements(env, id, entry.controls, now, pending))
 }
 return statements.length ? [...statements, auditStatement(env, actor, 'tests.catalogue-enabled', 'provider:' + provider, now)] : []
}
export interface TestDefinition { name: string; resourceType: string; criteria: Criterion[]; cadence: 'hourly' | 'daily'; category: Category; severity: Severity; controls: string[] }
export function parseDefinition(value: Record<string, unknown>): TestDefinition {
 const name = typeof value.name === 'string' ? value.name.trim() : ''
 if (!name || name.length > 200) throw new Refusal('Name the test (up to 200 characters).')
 const resourceType = String(value.resourceType ?? value.resource_type ?? '')
 const cadence = value.cadence === 'daily' ? 'daily' : value.cadence === undefined || value.cadence === 'hourly' ? 'hourly' : null
 if (!cadence) throw new Refusal('Cadence is hourly or daily.')
 const category = String(value.category ?? 'cloud') as Category, severity = String(value.severity ?? 'high') as Severity
 if (!categories.includes(category) || !severities.includes(severity)) throw new Refusal('Choose a listed category and severity.')
 const controls = Array.isArray(value.controls) ? value.controls.map(String) : typeof value.controls === 'string' && value.controls ? value.controls.split(/[\s,]+/).filter(Boolean) : []
 return { name, resourceType, criteria: parseCriteria(value.criteria), cadence, category, severity, controls }
}
export async function defineTest(env: Bindings, definition: TestDefinition, origin: 'custom' | 'api', definedBy: string, actor: Actor & { kind?: 'owner' | 'token' }, now: Date) {
 if (!await env.DB.prepare('SELECT 1 FROM resource_types WHERE type=?').bind(definition.resourceType).first() && !catalogue.some(e => e.resourceType === definition.resourceType)) throw new Refusal('Declare the resource type before defining a test over it.')
 const id = crypto.randomUUID(), at = now.toISOString()
 await env.DB.batch([
  env.DB.prepare('INSERT INTO tests(id,catalogue_id,name,resource_type,criteria_json,cadence,category,severity,origin,defined_by,created_at) VALUES(?,NULL,?,?,?,?,?,?,?,?,?)').bind(id, definition.name, definition.resourceType, JSON.stringify(definition.criteria), definition.cadence, definition.category, definition.severity, origin, definedBy, at),
  env.DB.prepare("INSERT INTO test_revisions(id,test_id,revision,criteria_json,excluded_json,cadence,actor,reason,at) VALUES(?,?,1,?,'[]',?,?,?,?)").bind(crypto.randomUUID(), id, JSON.stringify(definition.criteria), definition.cadence, actor.name, 'Test defined', at),
  ...await controlStatements(env, id, definition.controls, now),
  auditStatement(env, actor, 'test.defined', 'test:' + id, now, 'succeeded', definition.name),
 ])
 return { id }
}
// A revision applies to later runs only; earlier observations keep theirs.
export async function reviseTest(env: Bindings, id: string, change: { criteria?: Criterion[]; excluded?: Exclusion[]; cadence?: 'hourly' | 'daily' }, actor: Actor, reason: string, now: Date) {
 const row = await requireTest(env, id), prior = (await latestRevision(env, id))!
 const criteria = change.criteria ? JSON.stringify(change.criteria) : prior.criteria_json, excluded = change.excluded ? JSON.stringify(change.excluded) : prior.excluded_json, cadence = change.cadence ?? row.cadence
 const revision = row.revision + 1
 await env.DB.batch([
  env.DB.prepare('INSERT INTO test_revisions(id,test_id,revision,criteria_json,excluded_json,cadence,actor,reason,at) VALUES(?,?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(), id, revision, criteria, excluded, cadence, actor.name, reason, now.toISOString()),
  env.DB.prepare('UPDATE tests SET revision=?,criteria_json=?,cadence=? WHERE id=? AND revision=?').bind(revision, criteria, cadence, id, row.revision),
  auditStatement(env, actor, 'test.revised', 'test:' + id, now, 'succeeded', reason),
 ])
 return revision
}
export async function addException(env: Bindings, id: string, resourceId: string | null, reason: string, expiresAt: string, actor: Actor, now: Date) {
 await requireTest(env, id)
 if (resourceId && !await env.DB.prepare('SELECT 1 FROM resources WHERE id=?').bind(resourceId).first()) throw new Refusal('Choose a resource this test evaluates.')
 if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(expiresAt) || !(Date.parse(expiresAt.endsWith('Z') ? expiresAt : expiresAt + 'Z') > now.getTime())) throw new Refusal('An exception needs a future expiry.')
 const expiry = new Date(Date.parse(expiresAt.endsWith('Z') ? expiresAt : expiresAt + 'Z')).toISOString(), exception = crypto.randomUUID()
 await env.DB.batch([
  env.DB.prepare('INSERT INTO test_exceptions(id,test_id,resource_id,reason,approved_by,approved_name,approved_at,expires_at) VALUES(?,?,?,?,?,?,?,?)').bind(exception, id, resourceId, reason, actor.id, actor.name, now.toISOString(), expiry),
  auditStatement(env, actor, 'test.exception-approved', 'test:' + id, now, 'succeeded', `${resourceId ?? 'whole test'} until ${expiry}`),
 ])
 return exception
}
export const activeExceptions = async (env: Bindings, at: Date) => (await env.DB.prepare('SELECT * FROM test_exceptions WHERE revoked_at IS NULL AND approved_at<=? AND expires_at>?').bind(at.toISOString(), at.toISOString()).all<{ id: string; test_id: string; resource_id: string | null; reason: string; approved_name: string; expires_at: string }>()).results
export const exclusions = (json: string): Exclusion[] => { try { const v = JSON.parse(json); return Array.isArray(v) ? v : [] } catch { return [] } }
export const testControls = async (env: Bindings, id: string) => (await env.DB.prepare('SELECT c.id,c.name,l.library_id FROM test_controls t JOIN controls c ON c.id=t.control_id LEFT JOIN library_adoptions l ON l.control_id=c.id WHERE t.test_id=? ORDER BY c.name').bind(id).all<{ id: string; name: string; library_id: string | null }>()).results
// Latest result per test and resource, for every enabled test.
export async function latestResults(env: Bindings) {
 return (await env.DB.prepare(`SELECT o.*,r.source_label FROM observations o JOIN tests t ON t.id=o.test_id JOIN resources r ON r.id=o.resource_id
  WHERE t.enabled=1 AND r.removed_at IS NULL AND o.rowid=(SELECT o2.rowid FROM observations o2 WHERE o2.test_id=o.test_id AND o2.resource_id=o.resource_id ORDER BY o2.observed_at DESC,o2.rowid DESC LIMIT 1)`).all<Observation & { source_label: string }>()).results
}
// Runs that started later than their cadence allows leave a stale interval;
// a missed run is never carried forward as a pass.
export function staleIntervals(runs: { started_at: string }[], cadence: 'hourly' | 'daily', since: string, now: Date) {
 const limit = CADENCE_MS[cadence] * 1.5, out: { from: string; to: string }[] = []
 const starts = [since, ...runs.map(r => r.started_at).sort()].map(Date.parse)
 for (let i = 1; i < starts.length; i++) if (starts[i] - starts[i - 1] > limit) out.push({ from: new Date(starts[i - 1] + CADENCE_MS[cadence]).toISOString(), to: new Date(starts[i]).toISOString() })
 const last = starts.at(-1)!
 if (now.getTime() - last > limit) out.push({ from: new Date(last + CADENCE_MS[cadence]).toISOString(), to: now.toISOString() })
 return out
}
export interface ControlTestStatus { tests: number; pass: number; fail: number; unknown: number; notApplicable: number; untested: number; failingSources: string[] }
export async function controlTestStatus(env: Bindings) {
 const links = (await env.DB.prepare('SELECT tc.test_id,tc.control_id FROM test_controls tc JOIN tests t ON t.id=tc.test_id WHERE t.enabled=1').all<{ test_id: string; control_id: string }>()).results
 const latest = await latestResults(env), out = new Map<string, ControlTestStatus>()
 for (const link of links) {
  const status = out.get(link.control_id) ?? { tests: 0, pass: 0, fail: 0, unknown: 0, notApplicable: 0, untested: 0, failingSources: [] }
  status.tests++
  const results = latest.filter(o => o.test_id === link.test_id)
  if (!results.length) status.untested++
  for (const o of results) { if (o.result === 'pass') status.pass++; else if (o.result === 'fail') { status.fail++; if (!status.failingSources.includes(o.source_label)) status.failingSources.push(o.source_label) } else if (o.result === 'unknown') status.unknown++; else status.notApplicable++ }
  out.set(link.control_id, status)
 }
 return out
}
export const catalogueFor = (row: TestRow): CatalogueEntry | undefined => row.catalogue_id ? catalogue.find(e => e.id === row.catalogue_id) : undefined
export const controlRefs = (value: string) => parseList(value)
