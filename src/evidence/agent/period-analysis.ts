import type { Bindings } from '../../auth.server'
import { validDate } from '../model'
import { periodReport, requireControl } from '../program/control'
import type { Resource } from '../resources'
import { CADENCE_MS, type Observation } from '../tests/storage'
import { Refusal } from '../upload'

type Row = Record<string, unknown>
interface Test { id: string; resource_type: string; cadence: 'hourly' | 'daily'; created_at: string }
interface Revision { id: string; test_id: string; revision: number; cadence: 'hourly' | 'daily'; at: string }
interface Version { id: string; resource_id: string; change: string; attributes_json: string; source_ref: string; at: string }
interface Scope { id: string; asset: string; action: string; effective_at: string }
interface Evaluated extends Observation { control_revision: number | null; control_snapshot_json: string | null; test_revision_id: string | null; cadence: 'hourly' | 'daily' | null }
interface Citation { kind: string; id: string; href: string; at: string }
interface Finding { kind: string; summary: string; test_id: string | null; resource_id: string | null; citations: Citation[]; proposed_exception: string | null }
const LIMIT = 5000, BYTE_LIMIT = 8 * 1024 * 1024

// LIMIT + 1 detects overflow; no partial investigation can be returned as complete.
async function bounded<T>(env: Bindings, sql: string, args: (string | number)[], label: string): Promise<T[]> {
 const rows = (await env.DB.prepare(sql + ` LIMIT ${LIMIT + 1}`).bind(...args).all<T>()).results
 if (rows.length > LIMIT || new TextEncoder().encode(JSON.stringify(rows)).byteLength > BYTE_LIMIT) throw new Refusal(`Investigation exceeds ${LIMIT} rows or 8 MiB for ${label}; select a narrower audit period.`, 413)
 return rows
}

export async function investigatePeriod(env: Bindings, controlId: string, from: string, to: string, now: Date) {
 if (!validDate(from) || !validDate(to) || from > to) throw new Refusal('Choose a real audit period.')
 await requireControl(env, controlId)
 const start = from + 'T00:00:00.000Z', end = to + 'T23:59:59.999Z'
 const stop = new Date(Math.min(Date.parse(end), now.getTime())).toISOString()
 if (start > stop) throw new Refusal('The audit period has not started.')
 const linked = `SELECT test_id FROM test_controls WHERE control_id=? UNION SELECT r.test_id FROM run_control_definitions d JOIN test_runs r ON r.id=d.run_id WHERE d.control_id=?`
 const args = [controlId, controlId]
 const [tests, revisions, observations, definitions, scopeRows, runDefinitions] = await Promise.all([
  bounded<Test>(env, `SELECT id,resource_type,cadence,created_at FROM tests WHERE id IN (${linked}) AND created_at<=? ORDER BY id`, [...args, stop], 'mapped tests'),
  bounded<Revision>(env, `SELECT * FROM test_revisions WHERE test_id IN (${linked}) AND at<=? ORDER BY at,revision,id`, [...args, stop], 'test revisions'),
  bounded<Evaluated>(env, `SELECT o.*,d.control_revision,d.snapshot_json AS control_snapshot_json,v.id AS test_revision_id,v.cadence FROM observations o LEFT JOIN run_control_definitions d ON d.run_id=o.run_id AND d.control_id=? LEFT JOIN test_revisions v ON v.test_id=o.test_id AND v.revision=o.revision WHERE o.test_id IN (${linked}) AND o.observed_at>=? AND o.observed_at<=? ORDER BY o.observed_at,o.rowid`, [controlId, ...args, start, stop], 'observations'),
  bounded<Row>(env, 'SELECT * FROM control_revisions WHERE control_id=? AND effective_at<=? ORDER BY revision', [controlId, end], 'control definitions'),
  bounded<Scope>(env, 'SELECT * FROM control_scope WHERE control_id=? ORDER BY effective_at,rowid', [controlId], 'scope history'),
  bounded<Row>(env, 'SELECT d.*,r.test_id,r.started_at FROM run_control_definitions d JOIN test_runs r ON r.id=d.run_id WHERE d.control_id=? AND r.started_at>=? AND r.started_at<=? ORDER BY r.started_at,r.id', [controlId, start, stop], 'run definitions'),
 ])
 const types = JSON.stringify([...new Set(tests.map(t => t.resource_type))])
 const [resources, changes] = await Promise.all([
  bounded<Resource>(env, 'SELECT * FROM resources WHERE first_seen_at<=? AND (type IN (SELECT value FROM json_each(?)) OR id IN (SELECT asset FROM control_scope WHERE control_id=?)) ORDER BY id', [stop, types, controlId], 'resource population'),
  bounded<Version>(env, `SELECT v.* FROM resource_versions v JOIN resources r ON r.id=v.resource_id WHERE (r.type IN (SELECT value FROM json_each(?)) OR r.id IN (SELECT asset FROM control_scope WHERE control_id=?)) AND v.at<=? AND (v.at>=? OR v.id=(SELECT p.id FROM resource_versions p WHERE p.resource_id=v.resource_id AND p.at<? ORDER BY p.at DESC,p.rowid DESC LIMIT 1)) ORDER BY v.at,v.rowid`, [types, controlId, stop, start, start], 'resource history'),
 ])
 // periodReport also reads receipt rows and its evaluated join. Bound those
 // projections before calling it rather than inheriting an unbounded read.
 await Promise.all([
  bounded<Row>(env, 'SELECT r.* FROM receipts r JOIN requirements q ON q.id=r.requirement_id WHERE q.control_id=? AND r.covered_to>=? AND r.covered_from<=?', [controlId, from, to], 'period receipts'),
  bounded<Row>(env, 'SELECT d.snapshot_json,o.id,o.expected_json,o.actual_json,o.reason FROM run_control_definitions d JOIN test_runs r ON r.id=d.run_id LEFT JOIN observations o ON o.run_id=r.id WHERE d.control_id=? AND r.started_at>=? AND r.started_at<=?', [controlId, start, end], 'period evaluation'),
 ])
 const scope = (await periodReport(env, controlId, from, to)).segments.filter(s => s.from <= stop).map(s => ({...s,to:s.to > stop ? stop : s.to}))
 const findings: Finding[] = []
 const cite = (kind: string, id: string, at: string): Citation => ({ kind, id, at, href: `/api/controls/${encodeURIComponent(controlId)}/investigation-source?kind=${kind}&id=${encodeURIComponent(id)}` })
 const proof = (o: Evaluated): Citation[] => [cite('observation', o.id, o.observed_at), ...(o.control_snapshot_json ? [cite('run-definition', o.run_id, o.observed_at)] : []), ...(o.test_revision_id ? [cite('test-revision', o.test_revision_id, o.observed_at)] : [])]
 const add = (kind: string, summary: string, test: string | null, resource: string | null, citations: Citation[], proposal: string | null = null) => {
  if (findings.length >= LIMIT) throw new Refusal('Investigation exceeds 5000 findings; select a narrower audit period.', 413)
  findings.push({ kind, summary, test_id: test, resource_id: resource, citations, proposed_exception: proposal })
 }
 if (!tests.length) add('coverage-unavailable', 'No mapped tests or captured historical test associations were recorded for this control. Period operation is unknown.', null, null, [])
 const groups = new Map<string, Evaluated[]>()
 for (const o of observations) {
  const key = o.test_id + ':' + o.resource_id
  groups.set(key, [...(groups.get(key) ?? []), o])
  if (o.result === 'unknown') add('unknown', `Unknown observation: ${o.reason}. Origin: ${o.source_kind}.`, o.test_id, o.resource_id, proof(o))
  if (!o.control_snapshot_json) add('definition-unavailable', 'The evaluated control definition was not recorded; current meaning cannot reconstruct it.', o.test_id, o.resource_id, proof(o))
 }
 for (const rows of groups.values()) {
  const latest = rows.at(-1)!
  for (const failure of rows.filter(o => o.result === 'fail')) add(latest.result === 'pass' && failure.observed_at < latest.observed_at ? 'earlier-failure-latest-pass' : 'failure', `Recorded failure at ${failure.observed_at}: ${failure.reason}. Latest result in the selected period: ${latest.result}. Origin: ${failure.source_kind}.`, failure.test_id, failure.resource_id, [...proof(failure), ...(latest.id !== failure.id ? proof(latest) : [])], `Proposed only: review the recorded failure ${failure.id} and its period impact. No exception, pass, mapping or auditor decision has been changed.`)
 }
 for (const test of tests) {
  const history = revisions.filter(r => r.test_id === test.id)
  const boundaries = [start, ...history.filter(r => r.at > start && r.at < stop).map(r => r.at), stop]
  for (let i = 0; i < boundaries.length - 1; i++) {
   const a = boundaries[i] > test.created_at ? boundaries[i] : test.created_at, b = boundaries[i + 1]
   if (a >= b) continue
   const revision = history.filter(r => r.at <= a).at(-1)
   if (!revision) { add('cadence-unavailable', `Cadence history is unavailable from ${a} to ${b}; no cadence is reconstructed.`, test.id, null, []); continue }
   const allRows = observations.filter(o => o.test_id === test.id && o.observed_at >= a && o.observed_at <= b)
   const population = resources.filter(r => r.type === test.resource_type && r.first_seen_at <= b)
   // Each asset has its own coverage. A busy asset cannot fill another's gap.
   for (const resource of population.length ? population : [null]) {
    const rows = resource ? allRows.filter(o => o.resource_id === resource.id) : allRows
    const begins = resource && resource.first_seen_at > a ? resource.first_seen_at : a
    const points = [begins, ...[...new Set(rows.filter(o => o.observed_at >= begins).map(o => o.observed_at))], b]
    for (let j = 0; j < points.length - 1; j++) {
     const gapStart = Date.parse(points[j]) + CADENCE_MS[revision.cadence] * 1.5
     if (gapStart < Date.parse(points[j + 1])) add('missing-window', `No recorded observation${resource ? ' for ' + resource.display_name : ''} from ${new Date(gapStart).toISOString()} to ${points[j + 1]}; event coverage is unknown. Cadence is ${revision.cadence}. A recorded retirement may explain part of this window; it does not supply an observation.`, test.id, resource?.id ?? null, [cite('test-revision', revision.id, revision.at), ...rows.filter(o => o.observed_at === points[j] || o.observed_at === points[j + 1]).flatMap(proof)])
    }
   }
  }
 }
 // Compare only exact resource IDs and identical criteria. Different criteria
 // legitimately produce different results; adjacent intervals do not overlap.
 const compared = new Map<string, Evaluated[]>()
 let comparisons = 0
 for (const o of observations.filter(o => o.result === 'pass' || o.result === 'fail')) {
  const key = JSON.stringify([o.resource_id, o.expected_json]), prior = compared.get(key) ?? []
  for (const p of prior) {
   if (++comparisons > 100000) throw new Refusal('Investigation comparison bound exceeded; select a narrower audit period.', 413)
   if (p.result === o.result) continue
   const overlap = p.observed_at === o.observed_at || (!!p.interval_from && !!o.interval_from && p.interval_from < o.observed_at && o.interval_from < p.observed_at)
   if (overlap) add('contradictory-sources', 'Opposite results for the same resource and criteria have equal evaluation times or overlapping recorded intervals. Review the original source references; evaluation time is not a provider event timestamp.', o.test_id, o.resource_id, [...proof(p), ...proof(o)])
  }
  compared.set(key, [...prior, o])
 }
 for (const version of changes.filter(v => v.at >= start)) {
  const resource = resources.find(r => r.id === version.resource_id), rows = observations.filter(o => o.resource_id === version.resource_id)
  const before = rows.filter(o => o.observed_at <= version.at).at(-1), after = rows.find(o => o.observed_at > version.at)
  add('source-change', `Stored ${resource?.type ?? 'resource'} version ${version.change} at ${version.at}; origin ${resource?.source_kind ?? 'unavailable'}. Adjacent observations are linked for review. This storage timestamp does not assert a provider event time or continuous coverage.`, null, version.resource_id, [cite('resource-version', version.id, version.at), ...(before ? proof(before) : []), ...(after ? proof(after) : [])])
 }
 for (const segment of scope) for (const asset of segment.assets) {
  if (segment.from > stop) continue
  const matching = resources.find(r => r.id === asset)
  const citations = scopeRows.filter(s => s.asset === asset && s.effective_at <= segment.from).map(s => cite('scope', s.id, s.effective_at))
  if (!matching) add('unmatched-scoped-asset', `Scoped asset ${asset} has no exact resource-ID match. Names and emails are not inferred identities. Window: ${segment.from} to ${segment.to}.`, null, null, citations)
  else if (!observations.some(o => o.resource_id === matching.id && o.observed_at >= segment.from && o.observed_at <= segment.to)) add('unobserved-scoped-asset', `Scoped resource ${asset} has no recorded observation in ${segment.from} to ${segment.to}.`, null, asset, citations)
 }
 for (const resource of resources) {
  const versions = changes.filter(v => v.resource_id === resource.id), baseline = versions.filter(v => v.at < start).at(-1)
  if (baseline?.change === 'removed' && !versions.some(v => v.at >= start && v.change !== 'removed')) continue
  for (const test of tests.filter(t => t.resource_type === resource.type)) if (!observations.some(o => o.test_id === test.id && o.resource_id === resource.id)) add('unobserved-population', `Mapped ${resource.type} resource ${resource.id} has no observation for this test in the selected period. Removed history is retained. Origin: ${resource.source_kind}.`, test.id, resource.id, versions.map(v => cite('resource-version', v.id, v.at)))
 }
 for (const d of definitions.filter(d => String(d.effective_at) <= stop)) add('control-revision', `Control revision ${d.revision} effective ${d.effective_at}; earlier observations retain their captured meaning.`, null, null, [cite('control-revision', String(d.id), String(d.effective_at))])
 const snapshot = { control_id: controlId, from, to, generated_at: now.toISOString(), method: 'Deterministic correlation of complete bounded stored observations, exact resource identities, immutable resource changes, captured run/control and test revisions, and historical scope. No model or external calls. Source-reported records remain source-reported. A missing observation window starts after 1.5 times the recorded hourly or daily cadence. Scope matching uses exact resource IDs, without inferring identities. Contradictions compare opposite results with identical serialized criteria on the same resource, at equal evaluation times or strictly overlapping recorded intervals. Observation intervals are recorded evaluation intervals, not proof of continuous provider-event coverage; all unrecorded coverage remains unknown. Current test mappings select candidate populations; captured run definitions preserve historical associations. Findings and exception text are proposals only; owners decide control meaning and exceptions, auditors decide sufficiency. Future period time is not investigated.', findings, observations, changes, definitions, scope }
 // Retain run snapshots even for zero-population runs without observations.
 const result = { ...snapshot, run_definitions: runDefinitions }
 if (new TextEncoder().encode(JSON.stringify(result)).byteLength > BYTE_LIMIT) throw new Refusal('Investigation snapshot exceeds 8 MiB; select a narrower audit period.', 413)
 return result
}
