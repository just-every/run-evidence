import type { Bindings } from '../../auth.server'
import { libraryControl } from '../library'
import { obligations } from '../remedy/storage'
import { testSummaries } from '../tests/http'
import { policyList } from '../policy/storage'
import { readiness } from './readiness'
import { programs, type ProgramRow } from './storage'
import { Refusal } from '../upload'
import { matchingRequirements, type BoardFilters } from './report-filters'
export type { BoardFilters } from './report-filters'
// READINESS-001 board and auditor report: one reconcilable record of a
// program's scope, open and overdue remediation with per-item SLA status,
// collection freshness, test last-run times, exceptions, policies, risks and
// the daily trend. Stale, unknown and missing work stays listed; a filter
// narrows the item list only and never turns a failure into a pass.
const DAY = 86400000
const plusDays = (day: string, days: number) => new Date(Date.parse(day + 'T00:00:00Z') + days * DAY).toISOString().slice(0, 10)
async function currentBoard(env: Bindings, row: ProgramRow, now: Date) {
 const ready = await readiness(env, row, now)
 const controls = new Set(ready.requirements.filter(r => r.state === 'included').flatMap(r => r.controls.map(c => c.id)))
 const testIds = new Set((await env.DB.prepare('SELECT test_id,control_id FROM test_controls').all<{ test_id: string; control_id: string }>()).results.filter(l => controls.has(l.control_id)).map(l => l.test_id))
 const all = (await obligations(env, now)).filter(o => testIds.has(o.test_id))

 const tickets = (await env.DB.prepare('SELECT k.obligation_id,k.remote_key,k.remote_url,k.remote_status,k.remote_assignee,k.sync_state,k.last_synced_at,d.label FROM tickets k JOIN tracker_destinations d ON d.id=k.destination_id').all<{ obligation_id: string; remote_key: string | null; remote_url: string | null; remote_status: string; remote_assignee: string | null; sync_state: string; last_synced_at: string | null; label: string }>()).results
 const items = all.map(o => ({
  obligation: o.id, test_id: o.test_id, owner_person_id: o.owner_person_id, link: `${env.AUTH_ORIGIN}/app/remediation/${o.id}`, test: o.test_name, item: o.resource_name, source: o.source_kind, category: o.category, severity: o.severity, state: o.state,
  owner: o.owner_name, opened: o.clock_started_at, due: o.sla.due, sla: o.sla.status, sla_paused: o.sla.paused, closed_at: o.closed_at, hours_to_remediate: o.sla.hoursToRemediate,
  tickets: tickets.filter(t => t.obligation_id === o.id).map(({ obligation_id: _o, ...t }) => t),
 }))
 const open = items.filter(i => i.state !== 'verified')
 const tests = (await testSummaries(env, now)).filter(t => testIds.has(t.id)).map(t => ({ id: t.id, name: t.name, cadence: t.cadence, origin: t.origin, last_run: t.last_run, status: t.stale ? 'stale' : t.status, failing: t.failing }))
 const stale = (at: string | null, active: boolean) => active && (!at || now.getTime() - Date.parse(at) > 2 * 3600000)
 const collectors = (await env.DB.prepare('SELECT label,provider,status,last_success_at,last_error FROM connections ORDER BY created_at').all<{ label: string; provider: string; status: string; last_success_at: string | null; last_error: string }>()).results
 const trackers = (await env.DB.prepare('SELECT label,provider,status,last_success_at,last_error FROM tracker_destinations ORDER BY created_at').all<{ label: string; provider: string; status: string; last_success_at: string | null; last_error: string }>()).results
 const freshness = [...collectors.map(c => ({ kind: 'collector', ...c, stale: stale(c.last_success_at, c.status === 'active') })), ...trackers.map(c => ({ kind: 'ticket destination', ...c, stale: stale(c.last_success_at, false) }))]
 const attestations = (await env.DB.prepare('SELECT a.id,a.policy_id,a.revision_id,a.person_id,p.name,a.state,a.due_date FROM policy_assignments a JOIN people p ON p.id=a.person_id ORDER BY a.assigned_at,a.id').all<{id:string; policy_id:string; revision_id:string; person_id:string; name:string; state:string; due_date:string}>()).results
 const training = (await env.DB.prepare('SELECT a.id,a.person_id,p.name,a.course_id,a.revision,a.state,a.due_date FROM training_assignments a JOIN people p ON p.id=a.person_id ORDER BY a.assigned_at,a.id').all<{id:string; person_id:string; name:string; course_id:string; revision:number; state:string; due_date:string}>()).results
 const at = now.toISOString()
 const exceptions = (await env.DB.prepare('SELECT e.id,e.test_id,t.name AS test,e.resource_id,e.reason,e.approved_name,e.approved_at,e.expires_at FROM test_exceptions e JOIN tests t ON t.id=e.test_id WHERE e.revoked_at IS NULL AND e.approved_at<=? AND e.expires_at>? ORDER BY e.expires_at').bind(at, at).all<{ id: string; test_id: string; test: string; resource_id: string | null; reason: string; approved_name: string; approved_at: string; expires_at: string }>()).results.filter(e => testIds.has(e.test_id))
 const required = [...new Set([...controls].flatMap(id => { const adopted = ready.requirements.flatMap(r => r.controls).find(c => c.id === id); return adopted?.library_id ? libraryControl(adopted.library_id)?.policies ?? [] : [] }))].sort()
 const registered = await policyList(env, now)
 const policies = required.map(title => { const p = registered.find(x => x.title.toLowerCase() === title.toLowerCase()); return { id: p?.id ?? null, title, state: p?.review_state ?? 'not published', version: p?.published?.version ?? null, review_due: p?.published?.review_due ?? null } })
 const risks = (await env.DB.prepare("SELECT r.id,r.title,(SELECT a.level FROM risk_assessments a WHERE a.risk_id=r.id ORDER BY a.at DESC,a.rowid DESC LIMIT 1) AS level,(SELECT MIN(x.expires_at) FROM risk_acceptances x WHERE x.risk_id=r.id AND x.expires_at>?) AS accepted_until FROM risks r ORDER BY r.created_at").bind(at).all<{ id: string; title: string; level: string | null; accepted_until: string | null }>()).results
 return {
  format: 'evidence-board-report', version: 1, generated_at: at, certification: 'None asserted. ' + ready.framework.assessor,
  program: { id: row.id, name: row.name, framework: ready.framework.name, edition: row.edition, legal_entity: row.legal_entity, report_type: row.report_type, products: JSON.parse(row.products) as string[], systems: JSON.parse(row.systems), audit_from: row.audit_from, audit_to: row.audit_to, assessor: row.assessor },
  calculation: ready.calculation + ' SLA status is per item from its first failing observation; a paused clock is an approved, expiring exception. Freshness marks an active collector stale after two hours without a successful read.',
  readiness: ready.totals, requirements: ready.requirements, checklist: ready.checklist,
  sla: { open: open.length, within: open.filter(i => i.sla === 'within SLA').length, approaching: open.filter(i => i.sla === 'approaching').length, missed: open.filter(i => i.sla === 'SLA missed').length, resolved_within: items.filter(i => i.sla === 'resolved within SLA').length, resolved_after: items.filter(i => i.sla === 'resolved after SLA').length },
  items, overdue: open.filter(i => i.sla === 'SLA missed'), tests, freshness, exceptions, policies, risks, personnel: { attestations, training },
 }
}
// The original totals stay at the top level for archive compatibility. New
// snapshots also retain the exact source denominator, scope and report sections.
type CurrentBoard = Awaited<ReturnType<typeof currentBoard>>
type Totals = CurrentBoard['readiness']
interface StoredSnapshot { day: string; taken_at: string; totals: Totals; detail_available: boolean }
async function snapshots(env: Bindings, id: string): Promise<StoredSnapshot[]> {
 // Read only totals for the trend. Loading every day's full source projection
 // would grow the report request with all historical evidence populations.
 const rows = (await env.DB.prepare("SELECT day,json_remove(totals_json,'$.detail') AS totals_json,json_type(totals_json,'$.detail') AS detail_type,taken_at FROM readiness_snapshots WHERE program_id=? ORDER BY day").bind(id).all<{ day: string; totals_json: string; detail_type: string | null; taken_at: string }>()).results
 return rows.map(s => ({ day: s.day, taken_at: s.taken_at, totals: JSON.parse(s.totals_json) as Totals, detail_available: s.detail_type === 'object' }))
}
export async function boardReport(env: Bindings, row: ProgramRow, filters: BoardFilters, now: Date) {
 const history = await snapshots(env, row.id)
 const selected = filters.snapshot ? history.find(s => s.day === filters.snapshot) : null
 if (filters.snapshot && !selected) throw new Refusal('No snapshot was recorded on that date.', 404)
 if (selected && !selected.detail_available) throw new Refusal('Historical totals are retained, but their denominator was not recorded. It cannot be reconstructed from current state.', 409)
 const saved = selected ? await env.DB.prepare("SELECT json_extract(totals_json,'$.detail') AS detail FROM readiness_snapshots WHERE program_id=? AND day=?").bind(row.id, selected.day).first<{detail:string}>() : null
 const report: CurrentBoard = saved ? JSON.parse(saved.detail) as CurrentBoard : await currentBoard(env, row, now)
 const productMatches = !filters.product || report.program.products.includes(filters.product)
 const filtered_requirements = matchingRequirements(report.requirements, filters, productMatches)
 const matches = (i: typeof report.items[number]) => productMatches && (!filters.owner || i.owner_person_id === filters.owner) && (!filters.severity || i.severity === filters.severity) && (!filters.category || i.category === filters.category) && (!filters.from || i.opened >= filters.from) && (!filters.to || i.opened <= filters.to + 'T23:59:59.999Z')
 const items = report.items.filter(matches), open = items.filter(i => i.state !== 'verified')
 const length = Math.round((Date.parse(report.program.audit_to) - Date.parse(report.program.audit_from)) / DAY) + 1
 const priorFrom = plusDays(report.program.audit_from, -length), priorTo = plusDays(report.program.audit_from, -1)
 const period = (from: string, to: string) => { const last = history.filter(s => s.day >= from && s.day <= to).at(-1); return { from, to, snapshot_day: last?.day ?? null, totals: last?.totals ?? null, detail_available: !!last?.detail_available, note: !last ? 'No snapshot was recorded in this period.' : !last.detail_available ? 'Totals only; the historical denominator was not recorded.' : '' } }
 return { ...report, tests: productMatches ? report.tests : [], freshness: productMatches ? report.freshness : [], exceptions: productMatches ? report.exceptions : [], policies: productMatches ? report.policies : [], risks: productMatches ? report.risks : [], personnel: productMatches ? report.personnel : {attestations:[],training:[]}, filters, snapshot_day: selected?.day ?? null, filtered_requirements, items, overdue: open.filter(i => i.sla === 'SLA missed'),
  sla: { open: open.length, within: open.filter(i => i.sla === 'within SLA').length, approaching: open.filter(i => i.sla === 'approaching').length, missed: open.filter(i => i.sla === 'SLA missed').length, resolved_within: items.filter(i => i.sla === 'resolved within SLA').length, resolved_after: items.filter(i => i.sla === 'resolved after SLA').length },
  trend: history,
  periods: { current: period(report.program.audit_from, report.program.audit_to), prior: period(priorFrom, priorTo) },
 }
}
export type BoardReport = Awaited<ReturnType<typeof boardReport>>
const cell = (value: unknown) => { const text = value === null || value === undefined ? '' : String(value); return /[",\n\r]/.test(text) || /^[=+\-@\t]/.test(text) ? `"${(/^[=+\-@\t]/.test(text) ? "'" : '') + text.replace(/"/g, '""')}"` : text }
// One flat CSV whose rows reconcile to the JSON report section by section.
export function boardCsv(r: BoardReport) {
 const rows: unknown[][] = [['section', 'reference', 'name', 'state', 'sla', 'due_or_time', 'owner', 'severity', 'detail']]
 for (const [k, v] of Object.entries(r.readiness)) rows.push(['readiness', k, k, String(v), '', '', '', '', ''])
 for (const q of r.filtered_requirements) rows.push(['requirement', q.ref, q.title, q.state === 'excluded' ? 'excluded' : q.ready ? 'ready' : 'not ready', '', r.snapshot_day ?? r.generated_at, '', '', JSON.stringify({proof:q.proof, testing:q.testing, policy:q.policy, controls:q.controls})])
 for (const c of r.checklist) rows.push(['checklist', c.area, c.area, c.available ? `${c.ready} of ${c.total}` : 'unavailable', '', '', '', '', c.refs.join('; ')])
 for (const [name, p] of Object.entries(r.periods)) rows.push(['period', name, `${p.from} through ${p.to}`, p.detail_available ? 'denominator recorded' : p.note, '', p.snapshot_day ?? '', '', '', JSON.stringify(p.totals)])
 for (const [key,value] of Object.entries(r.filters)) rows.push(['filter',key,key,value,'','','','',''])
 for (const i of r.items) rows.push(['remediation', i.obligation, `${i.test} — ${i.item}`, i.state, i.sla, i.due, i.owner ?? '', `${i.category} ${i.severity}`, i.tickets.map(t => `${t.label} ${t.remote_key ?? ''} ${t.remote_status} ${t.sync_state}`).join('; ')])
 for (const t of r.tests) rows.push(['test', t.id, t.name, t.status, '', t.last_run ?? 'never', '', t.cadence, `${t.failing} failing`])
 for (const f of r.freshness) rows.push(['freshness', f.provider, f.label, f.status, '', f.last_success_at ?? 'never', '', f.kind, f.stale ? 'stale' : f.last_error])
 for (const e of r.exceptions) rows.push(['exception', e.id, e.test, 'approved', '', e.expires_at, e.approved_name, '', e.reason])
 for (const p of r.policies) rows.push(['policy', p.version ?? '', p.title, p.state, '', p.review_due ?? '', '', '', ''])
 for (const k of r.risks) rows.push(['risk', k.id, k.title, k.level ?? 'unassessed', '', k.accepted_until ?? '', '', '', ''])
 for (const a of r.personnel.attestations) rows.push(['attestation', a.id, a.name, a.state, '', a.due_date, a.person_id, '', `${a.policy_id} ${a.revision_id}`])
 for (const a of r.personnel.training) rows.push(['training', a.id, a.name, a.state, '', a.due_date, a.person_id, '', `${a.course_id} revision ${a.revision}`])
 for (const s of r.trend) rows.push(['trend', s.day, 'snapshot', '', '', s.taken_at, '', '', JSON.stringify(s.totals)])
 return rows.map(row => row.map(cell).join(',')).join('\r\n') + '\r\n'
}
// Daily snapshots: the first scheduler tick of each UTC day records each program's readiness.
export async function snapshotReadiness(env: Bindings, now: Date) {
 const day = now.toISOString().slice(0, 10)
 let taken = 0
 for (const row of await programs(env)) {
  if (await env.DB.prepare('SELECT 1 FROM readiness_snapshots WHERE program_id=? AND day=?').bind(row.id, day).first()) continue
  const detail = await currentBoard(env, row, now), totals = { ...detail.readiness, detail }
  taken += (await env.DB.prepare('INSERT INTO readiness_snapshots(program_id,day,totals_json,taken_at) VALUES(?,?,?,?) ON CONFLICT DO NOTHING').bind(row.id, day, JSON.stringify(totals), now.toISOString()).run()).meta.changes
 }
 return taken
}
