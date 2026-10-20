import { pentestTotals } from '../vuln/storage'
import { checklist } from './checklist'
import type { Bindings } from '../../auth.server'
import { day } from '../model'
import { desk } from '../storage'
import { controlsFor, edition, frameworks } from '../library'
import { controlTestStatus, type ControlTestStatus } from '../tests/storage'
import { obligations } from '../remedy/storage'
import { applicability, type ProgramRow } from './storage'
import { acceptedLibraryRevision } from './library-revision'
import { libraryControl } from '../library'
import { policyList } from '../policy/storage'
// READINESS-001 (program view): recorded proof completeness and automated test
// effectiveness stay separate. Every total drills to its requirement rows, and
// missing, stale or untested work stays visible. No score certifies anything.
type DeskRow = Awaited<ReturnType<typeof desk>>['requirements'][number]
export interface ControlState { id: string; name: string; library_id: string | null; proof: 'current' | 'not current'; gaps: string[]; tests: ControlTestStatus | null; open_obligations: number; owner_person_id: string | null; owner_name: string | null; owner_left_at: string | null; test_ids: string[]; severities: string[]; categories: string[]; scope: string[]; evidence: { id: string; name: string; gap: string; receipt_ids: string[] }[] }
export interface RequirementState { ready: boolean; ref: string; title: string; section: string; state: 'included' | 'excluded'; rationale: string; controls: ControlState[]; proof: 'current' | 'not current' | 'unmapped'; testing: 'failing' | 'unknown' | 'passing' | 'untested'; failing_sources: string[]; policy: 'current' | 'missing' | 'none required'; policies_missing: string[] }
export async function controlStates(env: Bindings, now: Date) {
 const data = await desk(env, day(now), now), tests = await controlTestStatus(env, now), queue = await obligations(env, now)
 const testsOfControl = new Map((await env.DB.prepare('SELECT control_id,test_id FROM test_controls').all<{ control_id: string; test_id: string }>()).results.reduce((map, row) => map.set(row.control_id, [...(map.get(row.control_id) ?? []), row.test_id]), new Map<string, string[]>()))
 const byControl = new Map<string, DeskRow[]>()
 for (const r of data.requirements) byControl.set(r.control_id, [...(byControl.get(r.control_id) ?? []), r])
 const owners = (await env.DB.prepare('SELECT o.control_id,o.owner_person_id,p.name,d.departed_at FROM control_owners o JOIN people p ON p.id=o.owner_person_id LEFT JOIN people_departures d ON d.person_id=o.owner_person_id WHERE o.rowid=(SELECT x.rowid FROM control_owners x WHERE x.control_id=o.control_id ORDER BY x.at DESC,x.rowid DESC LIMIT 1)').all<{ control_id: string; owner_person_id: string; name: string; departed_at: string | null }>()).results
 const definitions = (await env.DB.prepare('SELECT tc.control_id,t.id,t.severity,t.category FROM test_controls tc JOIN tests t ON t.id=tc.test_id WHERE t.enabled=1').all<{control_id: string; id: string; severity: string; category: string}>()).results
 const scopes = (await env.DB.prepare("SELECT s.control_id,s.asset FROM control_scope s WHERE s.action='added' AND s.effective_at<=? AND s.rowid=(SELECT x.rowid FROM control_scope x WHERE x.control_id=s.control_id AND x.asset=s.asset AND x.effective_at<=? ORDER BY x.effective_at DESC,x.rowid DESC LIMIT 1)").bind(now.toISOString(), now.toISOString()).all<{control_id: string; asset: string}>()).results
 const states = new Map<string, ControlState>()
 for (const [id, rows] of byControl) {
  const gaps = rows.map(r => r.gap), owner = owners.find(o => o.control_id === id), linked = definitions.filter(t => t.control_id === id)
  states.set(id, { owner_person_id: owner?.owner_person_id ?? null, owner_name: owner?.name ?? null, owner_left_at: owner?.departed_at ?? null, test_ids: linked.map(t => t.id), severities: [...new Set(linked.map(t => t.severity))], categories: [...new Set(linked.map(t => t.category))], scope: scopes.filter(s => s.control_id === id).map(s => s.asset), evidence: rows.map(r => ({id:r.id, name:r.name, gap:r.gap, receipt_ids:r.receipts.map(x => x.id)})), id, name: rows[0].control_name, library_id: rows[0].library_id, proof: gaps.every(g => g === 'covered' || g === 'due soon') ? 'current' : 'not current', gaps, tests: tests.get(id) ?? null, open_obligations: queue.filter(o => o.state !== 'verified' && (testsOfControl.get(id) ?? []).includes(o.test_id)).length })
 }
 return { states, desk: data, queue }
}
export async function readiness(env: Bindings, row: ProgramRow, now: Date) {
 const { states, queue } = await controlStates(env, now), { current } = await applicability(env, row.id), revision = await acceptedLibraryRevision(env)
 const libraryToControl = new Map([...states.values()].filter(s => s.library_id).map(s => [s.library_id!, s.id]))
 const custom = (await env.DB.prepare('SELECT control_id,ref FROM control_mappings WHERE framework=? AND edition=? AND removed_at IS NULL').bind(row.framework, row.edition).all<{ control_id: string; ref: string }>()).results
 // POLICY-001: a requirement whose controls call for policies is met only by approved, published, in-review revisions.
 const policyState = new Map((await policyList(env, now)).map(p => [p.title.toLowerCase(), p.review_state]))
 const requirements: RequirementState[] = edition(row.framework, row.edition)!.requirements.map(r => {
  const decision = current.get(r.ref)
  const ids = new Set([...controlsFor(row.framework, row.edition, r.ref, revision).map(c => libraryToControl.get(c.id)).filter((x): x is string => !!x), ...custom.filter(m => m.ref === r.ref).map(m => m.control_id)])
  const controls = [...ids].map(id => states.get(id)).filter((x): x is ControlState => !!x)
  const tested = controls.filter(c => c.tests && c.tests.tests > 0)
  const testing = tested.some(c => c.tests!.fail) ? 'failing' : tested.some(c => c.tests!.unknown || c.tests!.untested || !c.tests!.pass) ? 'unknown' : tested.length !== controls.length || !tested.length ? 'untested' : 'passing'
  const required = [...new Set([...controlsFor(row.framework, row.edition, r.ref, revision).flatMap(c => libraryControl(c.id)?.policies ?? []), ...controls.flatMap(c => c.library_id ? libraryControl(c.library_id)?.policies ?? [] : [])])], missing = required.filter(t => policyState.get(t.toLowerCase()) !== 'current')
  const proof = !controls.length ? 'unmapped' : controls.every(c => c.proof === 'current') ? 'current' : 'not current'
  return { ready: decision?.state !== 'excluded' && proof === 'current' && testing === 'passing' && !missing.length, ref: r.ref, title: r.title, section: r.section, state: decision?.state === 'excluded' ? 'excluded' : 'included', rationale: decision?.rationale ?? '', controls, proof: !controls.length ? 'unmapped' : controls.every(c => c.proof === 'current') ? 'current' : 'not current', testing, failing_sources: [...new Set(tested.flatMap(c => c.tests!.failingSources))], policy: !required.length ? 'none required' : missing.length ? 'missing' : 'current', policies_missing: missing }
 })
 const included = requirements.filter(r => r.state === 'included')
 const programControls = new Set(included.flatMap(r => r.controls.map(c => c.id)))
 // LIFECYCLE-002: a control whose owner left counts as unowned until it is reassigned.
 const controlRows = [...programControls].map(id => states.get(id)!)
 // Remediation counted here is the program's own: obligations of tests mapped to its in-scope controls.
 const programTests = new Set((await env.DB.prepare('SELECT test_id,control_id FROM test_controls').all<{ test_id: string; control_id: string }>()).results.filter(l => programControls.has(l.control_id)).map(l => l.test_id))
 const open = queue.filter(o => o.state !== 'verified' && programTests.has(o.test_id))
 // Failing tests are counted as tests, as on the Tests screen; tests_failing counts requirements.
 const failingTests = (await env.DB.prepare("SELECT DISTINCT o.test_id FROM observations o JOIN test_runs r ON r.id=o.run_id JOIN tests t ON t.id=o.test_id WHERE t.enabled=1 AND o.result='fail' AND r.started_at=(SELECT MAX(started_at) FROM test_runs x WHERE x.test_id=o.test_id)").all<{ test_id: string }>()).results.filter(r => programTests.has(r.test_id)).length
 const countReady = included.filter(r => r.ready).length
 const totals = {
  ready: countReady, not_ready: included.length - countReady, readiness_percent: included.length ? Math.floor(100 * countReady / included.length) : null,
  requirements: requirements.length, excluded: requirements.length - included.length, included: included.length,
  unmapped: included.filter(r => r.proof === 'unmapped').length,
  proof_current: included.filter(r => r.proof === 'current').length, proof_missing: included.filter(r => r.proof === 'not current').length,
  tests_failing: included.filter(r => r.testing === 'failing').length, failing_tests: failingTests, tests_unknown: included.filter(r => r.testing === 'unknown').length, tests_passing: included.filter(r => r.testing === 'passing').length, untested: included.filter(r => r.testing === 'untested').length,
  policy_missing: included.filter(r => r.policy === 'missing').length,
  controls: programControls.size, unowned_controls: controlRows.filter(c => !c.owner_person_id || c.owner_left_at).length, owner_left: controlRows.filter(c => c.owner_left_at).length, open_obligations: open.length,
  sla_within: open.filter(o => o.sla.status === 'within SLA').length, sla_approaching: open.filter(o => o.sla.status === 'approaching').length, sla_missed: open.filter(o => o.sla.status === 'SLA missed').length,
  // VULN-002: manual penetration-test findings not yet closed on approved retest evidence.
  ...await pentestTotals(env, now),
 }
 return { framework: frameworks[row.framework], requirements, totals, checklist: checklist(requirements), calculation: 'Readiness is floor(100 × ready ÷ included); an empty scope has no percentage. Ready means mapped, all proof current, every mapped control tested with fresh passing observations at the current test revision, and all required policies approved, published and current. Unknown, stale, unsupported and untested work is not ready; an exception never grants a pass. Filters narrow detail only, never the whole-program score. Counts are requirements of the program edition. Proof is current when every mapped control\'s named proof is covered or due soon for today\'s period. Testing is failing when any mapped control has a failing latest observation, unknown when any is unknown or never ran. Excluded requirements stay listed with their rationale. Open remediation counts obligations of tests mapped to in-scope controls, each with its own SLA clock. A requirement whose controls call for policies needs each one approved, published and within its review deadline. Unowned controls counts in-scope controls with no accountable owner or whose owner has left, until an owner reassigns them; it does not change the readiness percentage. Pentest findings open counts manual penetration-test findings not yet closed on approved retest evidence, and past due those whose fixed due date (report date plus the severity SLA then in force) is before today in UTC; neither changes the percentage. Nothing here certifies the business.' }
}
