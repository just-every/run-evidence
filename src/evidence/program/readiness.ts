import type { Bindings } from '../../auth.server'
import { day } from '../model'
import { desk } from '../storage'
import { controlsFor, edition, frameworks } from '../library'
import { controlTestStatus, type ControlTestStatus } from '../tests/storage'
import { obligations } from '../remedy/storage'
import { applicability, type ProgramRow } from './storage'
import { libraryControl } from '../library'
import { policyList } from '../policy/storage'
// READINESS-001 (program view): recorded proof completeness and automated test
// effectiveness stay separate. Every total drills to its requirement rows, and
// missing, stale or untested work stays visible. No score certifies anything.
type DeskRow = Awaited<ReturnType<typeof desk>>['requirements'][number]
export interface ControlState { id: string; name: string; library_id: string | null; proof: 'current' | 'not current'; gaps: string[]; tests: ControlTestStatus | null; open_obligations: number }
export interface RequirementState { ref: string; title: string; section: string; state: 'included' | 'excluded'; rationale: string; controls: ControlState[]; proof: 'current' | 'not current' | 'unmapped'; testing: 'failing' | 'unknown' | 'passing' | 'untested'; failing_sources: string[]; policy: 'current' | 'missing' | 'none required'; policies_missing: string[] }
export async function controlStates(env: Bindings, now: Date) {
 const data = await desk(env, day(now), now), tests = await controlTestStatus(env), queue = await obligations(env, now)
 const testsOfControl = new Map((await env.DB.prepare('SELECT control_id,test_id FROM test_controls').all<{ control_id: string; test_id: string }>()).results.reduce((map, row) => map.set(row.control_id, [...(map.get(row.control_id) ?? []), row.test_id]), new Map<string, string[]>()))
 const byControl = new Map<string, DeskRow[]>()
 for (const r of data.requirements) byControl.set(r.control_id, [...(byControl.get(r.control_id) ?? []), r])
 const states = new Map<string, ControlState>()
 for (const [id, rows] of byControl) {
  const gaps = rows.map(r => r.gap)
  states.set(id, { id, name: rows[0].control_name, library_id: rows[0].library_id, proof: gaps.every(g => g === 'covered' || g === 'due soon') ? 'current' : 'not current', gaps, tests: tests.get(id) ?? null, open_obligations: queue.filter(o => o.state !== 'verified' && (testsOfControl.get(id) ?? []).includes(o.test_id)).length })
 }
 return { states, desk: data, queue }
}
export async function readiness(env: Bindings, row: ProgramRow, now: Date) {
 const { states, queue } = await controlStates(env, now), { current } = await applicability(env, row.id)
 const libraryToControl = new Map([...states.values()].filter(s => s.library_id).map(s => [s.library_id!, s.id]))
 const custom = (await env.DB.prepare('SELECT control_id,ref FROM control_mappings WHERE framework=? AND edition=? AND removed_at IS NULL').bind(row.framework, row.edition).all<{ control_id: string; ref: string }>()).results
 // POLICY-001: a requirement whose controls call for policies is met only by approved, published, in-review revisions.
 const policyState = new Map((await policyList(env, now)).map(p => [p.title.toLowerCase(), p.review_state]))
 const requirements: RequirementState[] = edition(row.framework, row.edition)!.requirements.map(r => {
  const decision = current.get(r.ref)
  const ids = new Set([...controlsFor(row.framework, row.edition, r.ref).map(c => libraryToControl.get(c.id)).filter((x): x is string => !!x), ...custom.filter(m => m.ref === r.ref).map(m => m.control_id)])
  const controls = [...ids].map(id => states.get(id)).filter((x): x is ControlState => !!x)
  const tested = controls.filter(c => c.tests && c.tests.tests > 0)
  const testing = tested.some(c => c.tests!.fail) ? 'failing' : tested.some(c => c.tests!.unknown || c.tests!.untested) ? 'unknown' : tested.some(c => c.tests!.pass) ? 'passing' : 'untested'
  const required = [...new Set(controlsFor(row.framework, row.edition, r.ref).flatMap(c => libraryControl(c.id)?.policies ?? []))], missing = required.filter(t => policyState.get(t.toLowerCase()) !== 'current')
  return { ref: r.ref, title: r.title, section: r.section, state: decision?.state === 'excluded' ? 'excluded' : 'included', rationale: decision?.rationale ?? '', controls, proof: !controls.length ? 'unmapped' : controls.every(c => c.proof === 'current') ? 'current' : 'not current', testing, failing_sources: [...new Set(tested.flatMap(c => c.tests!.failingSources))], policy: !required.length ? 'none required' : missing.length ? 'missing' : 'current', policies_missing: missing }
 })
 const included = requirements.filter(r => r.state === 'included')
 const programControls = new Set(included.flatMap(r => r.controls.map(c => c.id)))
 // Remediation counted here is the program's own: obligations of tests mapped to its in-scope controls.
 const programTests = new Set((await env.DB.prepare('SELECT test_id,control_id FROM test_controls').all<{ test_id: string; control_id: string }>()).results.filter(l => programControls.has(l.control_id)).map(l => l.test_id))
 const open = queue.filter(o => o.state !== 'verified' && programTests.has(o.test_id))
 const totals = {
  requirements: requirements.length, excluded: requirements.length - included.length, included: included.length,
  unmapped: included.filter(r => r.proof === 'unmapped').length,
  proof_current: included.filter(r => r.proof === 'current').length, proof_missing: included.filter(r => r.proof === 'not current').length,
  tests_failing: included.filter(r => r.testing === 'failing').length, tests_unknown: included.filter(r => r.testing === 'unknown').length, tests_passing: included.filter(r => r.testing === 'passing').length, untested: included.filter(r => r.testing === 'untested').length,
  policy_missing: included.filter(r => r.policy === 'missing').length,
  controls: programControls.size, open_obligations: open.length,
  sla_within: open.filter(o => o.sla.status === 'within SLA').length, sla_approaching: open.filter(o => o.sla.status === 'approaching').length, sla_missed: open.filter(o => o.sla.status === 'SLA missed').length,
 }
 return { framework: frameworks[row.framework], requirements, totals, calculation: 'Counts are requirements of the program edition. Proof is current when every mapped control\'s named proof is covered or due soon for today\'s period. Testing is failing when any mapped control has a failing latest observation, unknown when any is unknown or never ran. Excluded requirements stay listed with their rationale. Open remediation counts obligations of tests mapped to in-scope controls, each with its own SLA clock. A requirement whose controls call for policies needs each one approved, published and within its review deadline. Nothing here certifies the business.' }
}
