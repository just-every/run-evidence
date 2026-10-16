import type { Bindings } from '../../auth.server'
import { day } from '../model'
import { desk } from '../storage'
import { controlsFor, edition, frameworks } from '../library'
import { controlTestStatus, type ControlTestStatus } from '../tests/storage'
import { obligations } from '../remedy/storage'
import { applicability, type ProgramRow } from './storage'
// READINESS-001 (program view): recorded proof completeness and automated test
// effectiveness stay separate. Every total drills to its requirement rows, and
// missing, stale or untested work stays visible. No score certifies anything.
type DeskRow = Awaited<ReturnType<typeof desk>>['requirements'][number]
export interface ControlState { id: string; name: string; library_id: string | null; proof: 'current' | 'not current'; gaps: string[]; tests: ControlTestStatus | null; open_obligations: number }
export interface RequirementState { ref: string; title: string; section: string; state: 'included' | 'excluded'; rationale: string; controls: ControlState[]; proof: 'current' | 'not current' | 'unmapped'; testing: 'failing' | 'unknown' | 'passing' | 'untested'; failing_sources: string[] }
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
 const requirements: RequirementState[] = edition(row.framework, row.edition)!.requirements.map(r => {
  const decision = current.get(r.ref)
  const ids = new Set([...controlsFor(row.framework, row.edition, r.ref).map(c => libraryToControl.get(c.id)).filter((x): x is string => !!x), ...custom.filter(m => m.ref === r.ref).map(m => m.control_id)])
  const controls = [...ids].map(id => states.get(id)).filter((x): x is ControlState => !!x)
  const tested = controls.filter(c => c.tests && c.tests.tests > 0)
  const testing = tested.some(c => c.tests!.fail) ? 'failing' : tested.some(c => c.tests!.unknown || c.tests!.untested) ? 'unknown' : tested.some(c => c.tests!.pass) ? 'passing' : 'untested'
  return { ref: r.ref, title: r.title, section: r.section, state: decision?.state === 'excluded' ? 'excluded' : 'included', rationale: decision?.rationale ?? '', controls, proof: !controls.length ? 'unmapped' : controls.every(c => c.proof === 'current') ? 'current' : 'not current', testing, failing_sources: [...new Set(tested.flatMap(c => c.tests!.failingSources))] }
 })
 const included = requirements.filter(r => r.state === 'included')
 const programControls = new Set(included.flatMap(r => r.controls.map(c => c.id)))
 const totals = {
  requirements: requirements.length, excluded: requirements.length - included.length, included: included.length,
  unmapped: included.filter(r => r.proof === 'unmapped').length,
  proof_current: included.filter(r => r.proof === 'current').length, proof_missing: included.filter(r => r.proof === 'not current').length,
  tests_failing: included.filter(r => r.testing === 'failing').length, tests_unknown: included.filter(r => r.testing === 'unknown').length, tests_passing: included.filter(r => r.testing === 'passing').length, untested: included.filter(r => r.testing === 'untested').length,
  controls: programControls.size, open_obligations: queue.filter(o => o.state !== 'verified').length,
 }
 return { framework: frameworks[row.framework], requirements, totals, calculation: 'Counts are requirements of the program edition. Proof is current when every mapped control\'s named proof is covered or due soon for today\'s period. Testing is failing when any mapped control has a failing latest observation, unknown when any is unknown or never ran. Excluded requirements stay listed with their rationale. Nothing here certifies the business.' }
}
