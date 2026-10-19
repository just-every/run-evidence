import type { Bindings } from '../../auth.server'
import { obligations } from '../remedy/storage'
import { catalogueFor, CADENCE_MS, type TestRow } from './storage'
import type { CatalogueEntry } from './catalogue'
import type { TestSummary } from './view'
import { explain } from './criteria'
// The Tests screen: every test with its mapped control, the integration that
// supplies its items, the control's accountable owner and its latest run; one
// test opened beside the list with its failure, remediation and run history.
export const providerNames: Record<string, string> = { github: 'GitHub', aws: 'AWS', gcp: 'Google Cloud', azure: 'Azure', okta: 'Okta', google: 'Google Workspace', entra: 'Microsoft Entra ID', jumpcloud: 'JumpCloud', knowbe4: 'KnowBe4', attestations: 'Attestations', policies: 'Policies', training: 'Training' }
export interface LatestRun { id: string; started_at: string; trigger: string; population: number; passed: number; failed: number; unknown: number; not_applicable: number }
export interface WorkspaceRow extends TestSummary { control: { id: string; ref: string } | null; owner: string | null; integration: string; unit: string; run: LatestRun | null }
export interface FailingItem { resource_id: string; display_name: string; reason: string; observed_at: string; obligation: { id: string; state: string; next_action: string; target_date: string | null; owner_name: string | null; sla_status: string; sla_due: string; retest_queued_at: string | null } | null }
export interface OpenTest { row: WorkspaceRow; entry?: CatalogueEntry; failing: FailingItem[]; runs: LatestRun[]; nextRun: string | null }
export type Show = 'all' | 'failing' | 'stale'
export type TestState = 'failing' | 'stale' | 'passing' | 'unknown' | 'never run' | 'no resources'
export const state = (t: TestSummary): TestState => t.stale ? 'stale' : t.status as TestState
// A resource type names the counted items: device → devices, github.repository → repositories.
export function unitOf(type: string) {
 const noun = type.split('.').at(-1)!.replaceAll('_', ' ')
 return /(s|x|sh|ch)$/.test(noun) ? noun + 'es' : /[^aeiou]y$/.test(noun) ? noun.slice(0, -1) + 'ies' : noun + 's'
}
function integrationOf(t: TestRow, source: { source_ref: string; source_label: string; token: string | null } | undefined) {
 if (source?.token) return source.token
 const entry = catalogueFor(t)
 if (entry && entry.providers.length === 1) return providerNames[entry.providers[0]] ?? entry.providers[0]
 if (source) return Object.values(providerNames).find(name => source.source_label.startsWith(name)) ?? providerNames[source.source_ref.split(':')[0]] ?? source.source_label
 return entry ? entry.providers.map(p => providerNames[p] ?? p).join(', ') : t.origin === 'api' ? 'API' : 'Custom'
}
export async function workspaceRows(env: Bindings, summaries: TestSummary[]): Promise<WorkspaceRow[]> {
 const [runs, controls, owners, sources] = await env.DB.batch([
  env.DB.prepare('SELECT r.test_id,r.id,r.started_at,r.trigger,r.population,r.passed,r.failed,r.unknown,r.not_applicable FROM test_runs r WHERE r.rowid=(SELECT x.rowid FROM test_runs x WHERE x.test_id=r.test_id ORDER BY x.started_at DESC,x.rowid DESC LIMIT 1)'),
  env.DB.prepare('SELECT tc.test_id,c.id,c.name,l.library_id FROM test_controls tc JOIN controls c ON c.id=tc.control_id LEFT JOIN library_adoptions l ON l.control_id=c.id ORDER BY l.library_id IS NULL,l.library_id,c.name'),
  env.DB.prepare('SELECT o.control_id,p.name FROM control_owners o JOIN people p ON p.id=o.owner_person_id WHERE o.rowid=(SELECT x.rowid FROM control_owners x WHERE x.control_id=o.control_id ORDER BY x.at DESC,x.rowid DESC LIMIT 1)'),
  env.DB.prepare("SELECT o.test_id,o.source_ref,r.source_label,a.name AS token FROM observations o JOIN resources r ON r.id=o.resource_id LEFT JOIN api_tokens a ON 'api:'||a.id=o.source_ref WHERE o.rowid=(SELECT x.rowid FROM observations x WHERE x.test_id=o.test_id ORDER BY x.observed_at DESC,x.rowid DESC LIMIT 1)"),
 ])
 const run = new Map((runs.results as (LatestRun & { test_id: string })[]).map(r => [r.test_id, r]))
 const owner = new Map((owners.results as { control_id: string; name: string }[]).map(o => [o.control_id, o.name]))
 const source = new Map((sources.results as { test_id: string; source_ref: string; source_label: string; token: string | null }[]).map(s => [s.test_id, s]))
 const linked = controls.results as { test_id: string; id: string; name: string; library_id: string | null }[]
 return summaries.map(t => {
  const c = linked.find(x => x.test_id === t.id)
  return { ...t, control: c ? { id: c.id, ref: c.library_id ?? c.name } : null, owner: c ? owner.get(c.id) ?? null : null, integration: integrationOf(t, source.get(t.id)), unit: unitOf(t.resource_type), run: run.get(t.id) ?? null }
 })
}
export function filterRows(rows: WorkspaceRow[], show: Show, integration: string) {
 return rows.filter(r => (show === 'all' || state(r) === show) && (!integration || r.integration === integration))
}
export async function openTest(env: Bindings, row: WorkspaceRow, now: Date): Promise<OpenTest> {
 const [latest, runs, retests] = await env.DB.batch([
  env.DB.prepare("SELECT o.resource_id,r.display_name,o.result,o.reason,o.expected_json,o.actual_json,o.observed_at FROM observations o JOIN resources r ON r.id=o.resource_id WHERE o.test_id=? AND o.result='fail' AND r.removed_at IS NULL AND o.rowid=(SELECT x.rowid FROM observations x WHERE x.test_id=o.test_id AND x.resource_id=o.resource_id ORDER BY x.observed_at DESC,x.rowid DESC LIMIT 1) ORDER BY o.observed_at,r.display_name").bind(row.id),
  env.DB.prepare('SELECT id,started_at,trigger,population,passed,failed,unknown,not_applicable FROM test_runs WHERE test_id=? ORDER BY started_at DESC,rowid DESC LIMIT 4').bind(row.id),
  env.DB.prepare('SELECT q.obligation_id,q.queued_at FROM retests q JOIN obligations o ON o.id=q.obligation_id WHERE o.test_id=? AND q.done_at IS NULL').bind(row.id),
 ])
 const queued = new Map((retests.results as { obligation_id: string; queued_at: string }[]).map(q => [q.obligation_id, q.queued_at]))
 const own = (await obligations(env, now)).filter(o => o.test_id === row.id && o.state !== 'verified')
 // A failure is shown from the observation that first opened it, which later passes never rewrite.
 const failing = await Promise.all((latest.results as (Omit<FailingItem, 'obligation'> & { result: string; expected_json: string; actual_json: string })[]).map(async ({ result, expected_json, actual_json, ...item }) => {
  const ob = own.find(o => o.resource_id === item.resource_id)
  const opened = ob ? await env.DB.prepare('SELECT observed_at FROM observations WHERE id=?').bind(ob.opened_observation_id).first<{ observed_at: string }>() : null
  return { ...item, reason: explain({ result, reason: item.reason, expected_json, actual_json }), observed_at: opened?.observed_at ?? item.observed_at, obligation: ob ? { id: ob.id, state: ob.state, next_action: ob.next_action, target_date: ob.target_date, owner_name: ob.owner_name, sla_status: ob.sla.status, sla_due: ob.sla.due, retest_queued_at: queued.get(ob.id) ?? null } : null }
 }))
 const nextRun = row.last_run ? new Date(Date.parse(row.last_run) + CADENCE_MS[row.cadence]).toISOString() : null
 return { row, entry: catalogueFor(row), failing, runs: runs.results as LatestRun[], nextRun }
}
