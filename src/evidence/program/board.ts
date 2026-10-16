import type { Bindings } from '../../auth.server'
import { libraryControl } from '../library'
import { obligations } from '../remedy/storage'
import { testSummaries } from '../tests/http'
import { policyList } from '../policy/storage'
import { readiness } from './readiness'
import { programs, type ProgramRow } from './storage'
// READINESS-001 board and auditor report: one reconcilable record of a
// program's scope, open and overdue remediation with per-item SLA status,
// collection freshness, test last-run times, exceptions, policies, risks and
// the daily trend. Stale, unknown and missing work stays listed; a filter
// narrows the item list only and never turns a failure into a pass.
export interface BoardFilters { owner: string; severity: string; category: string; from: string; to: string }
const DAY = 86400000
const plusDays = (day: string, days: number) => new Date(Date.parse(day + 'T00:00:00Z') + days * DAY).toISOString().slice(0, 10)
export async function boardReport(env: Bindings, row: ProgramRow, filters: BoardFilters, now: Date) {
 const ready = await readiness(env, row, now)
 const controls = new Set(ready.requirements.filter(r => r.state === 'included').flatMap(r => r.controls.map(c => c.id)))
 const testIds = new Set((await env.DB.prepare('SELECT test_id,control_id FROM test_controls').all<{ test_id: string; control_id: string }>()).results.filter(l => controls.has(l.control_id)).map(l => l.test_id))
 const all = (await obligations(env, now)).filter(o => testIds.has(o.test_id))
 const matches = (o: typeof all[number]) => (!filters.owner || o.owner_person_id === filters.owner) && (!filters.severity || o.severity === filters.severity) && (!filters.category || o.category === filters.category) && (!filters.from || o.clock_started_at >= filters.from) && (!filters.to || o.clock_started_at <= filters.to + 'T23:59:59.999Z')
 const tickets = (await env.DB.prepare('SELECT k.obligation_id,k.remote_key,k.remote_url,k.remote_status,k.remote_assignee,k.sync_state,k.last_synced_at,d.label FROM tickets k JOIN tracker_destinations d ON d.id=k.destination_id').all<{ obligation_id: string; remote_key: string | null; remote_url: string | null; remote_status: string; remote_assignee: string | null; sync_state: string; last_synced_at: string | null; label: string }>()).results
 const items = all.filter(matches).map(o => ({
  obligation: o.id, link: `${env.AUTH_ORIGIN}/app/remediation/${o.id}`, test: o.test_name, item: o.resource_name, source: o.source_kind, category: o.category, severity: o.severity, state: o.state,
  owner: o.owner_name, opened: o.clock_started_at, due: o.sla.due, sla: o.sla.status, sla_paused: o.sla.paused, closed_at: o.closed_at, hours_to_remediate: o.sla.hoursToRemediate,
  tickets: tickets.filter(t => t.obligation_id === o.id).map(({ obligation_id: _o, ...t }) => t),
 }))
 const open = items.filter(i => i.state !== 'verified')
 const tests = (await testSummaries(env, now)).filter(t => testIds.has(t.id)).map(t => ({ id: t.id, name: t.name, cadence: t.cadence, origin: t.origin, last_run: t.last_run, status: t.stale ? 'stale' : t.status, failing: t.failing }))
 const stale = (at: string | null, active: boolean) => active && (!at || now.getTime() - Date.parse(at) > 2 * 3600000)
 const collectors = (await env.DB.prepare('SELECT label,provider,status,last_success_at,last_error FROM connections ORDER BY created_at').all<{ label: string; provider: string; status: string; last_success_at: string | null; last_error: string }>()).results
 const trackers = (await env.DB.prepare('SELECT label,provider,status,last_success_at,last_error FROM tracker_destinations ORDER BY created_at').all<{ label: string; provider: string; status: string; last_success_at: string | null; last_error: string }>()).results
 const freshness = [...collectors.map(c => ({ kind: 'collector', ...c, stale: stale(c.last_success_at, c.status === 'active') })), ...trackers.map(c => ({ kind: 'ticket destination', ...c, stale: stale(c.last_success_at, false) }))]
 const at = now.toISOString()
 const exceptions = (await env.DB.prepare('SELECT e.id,e.test_id,t.name AS test,e.resource_id,e.reason,e.approved_name,e.approved_at,e.expires_at FROM test_exceptions e JOIN tests t ON t.id=e.test_id WHERE e.revoked_at IS NULL AND e.approved_at<=? AND e.expires_at>? ORDER BY e.expires_at').bind(at, at).all<{ id: string; test_id: string; test: string; resource_id: string | null; reason: string; approved_name: string; approved_at: string; expires_at: string }>()).results.filter(e => testIds.has(e.test_id))
 const required = [...new Set([...controls].flatMap(id => { const adopted = ready.requirements.flatMap(r => r.controls).find(c => c.id === id); return adopted?.library_id ? libraryControl(adopted.library_id)?.policies ?? [] : [] }))].sort()
 const registered = await policyList(env, now)
 const policies = required.map(title => { const p = registered.find(x => x.title.toLowerCase() === title.toLowerCase()); return { title, state: p?.review_state ?? 'not published', version: p?.published?.version ?? null, review_due: p?.published?.review_due ?? null } })
 const risks = (await env.DB.prepare("SELECT r.id,r.title,(SELECT a.level FROM risk_assessments a WHERE a.risk_id=r.id ORDER BY a.at DESC,a.rowid DESC LIMIT 1) AS level,(SELECT MIN(x.expires_at) FROM risk_acceptances x WHERE x.risk_id=r.id AND x.expires_at>?) AS accepted_until FROM risks r ORDER BY r.created_at").bind(at).all<{ id: string; title: string; level: string | null; accepted_until: string | null }>()).results
 const trend = (await env.DB.prepare('SELECT day,totals_json,taken_at FROM readiness_snapshots WHERE program_id=? ORDER BY day').bind(row.id).all<{ day: string; totals_json: string; taken_at: string }>()).results.map(s => ({ day: s.day, taken_at: s.taken_at, totals: JSON.parse(s.totals_json) as typeof ready.totals }))
 // Current and prior audit periods of equal length, each read from its last recorded snapshot.
 const length = Math.round((Date.parse(row.audit_to) - Date.parse(row.audit_from)) / DAY) + 1, priorFrom = plusDays(row.audit_from, -length), priorTo = plusDays(row.audit_from, -1)
 const period = (from: string, to: string) => { const last = trend.filter(s => s.day >= from && s.day <= to).at(-1); return { from, to, snapshot_day: last?.day ?? null, totals: last?.totals ?? null, note: last ? '' : 'No snapshot was recorded in this period.' } }
 return {
  format: 'evidence-board-report', version: 1, generated_at: at, certification: 'None asserted. ' + ready.framework.assessor,
  program: { id: row.id, name: row.name, framework: ready.framework.name, edition: row.edition, legal_entity: row.legal_entity, report_type: row.report_type, products: JSON.parse(row.products), systems: JSON.parse(row.systems), audit_from: row.audit_from, audit_to: row.audit_to, assessor: row.assessor },
  filters, calculation: ready.calculation + ' SLA status is per item from its first failing observation; a paused clock is an approved, expiring exception. Freshness marks an active collector stale after two hours without a successful read.',
  readiness: ready.totals,
  sla: { open: open.length, within: open.filter(i => i.sla === 'within SLA').length, approaching: open.filter(i => i.sla === 'approaching').length, missed: open.filter(i => i.sla === 'SLA missed').length, resolved_within: items.filter(i => i.sla === 'resolved within SLA').length, resolved_after: items.filter(i => i.sla === 'resolved after SLA').length },
  items, overdue: open.filter(i => i.sla === 'SLA missed'), tests, freshness, exceptions, policies, risks, trend,
  periods: { current: period(row.audit_from, row.audit_to), prior: period(priorFrom, priorTo) },
 }
}
export type BoardReport = Awaited<ReturnType<typeof boardReport>>
const cell = (value: unknown) => { const text = value === null || value === undefined ? '' : String(value); return /[",\n\r]/.test(text) || /^[=+\-@\t]/.test(text) ? `"${(/^[=+\-@\t]/.test(text) ? "'" : '') + text.replace(/"/g, '""')}"` : text }
// One flat CSV whose rows reconcile to the JSON report section by section.
export function boardCsv(r: BoardReport) {
 const rows: unknown[][] = [['section', 'reference', 'name', 'state', 'sla', 'due_or_time', 'owner', 'severity', 'detail']]
 for (const [k, v] of Object.entries(r.readiness)) rows.push(['readiness', k, k, String(v), '', '', '', '', ''])
 for (const i of r.items) rows.push(['remediation', i.obligation, `${i.test} — ${i.item}`, i.state, i.sla, i.due, i.owner ?? '', `${i.category} ${i.severity}`, i.tickets.map(t => `${t.label} ${t.remote_key ?? ''} ${t.remote_status} ${t.sync_state}`).join('; ')])
 for (const t of r.tests) rows.push(['test', t.id, t.name, t.status, '', t.last_run ?? 'never', '', t.cadence, `${t.failing} failing`])
 for (const f of r.freshness) rows.push(['freshness', f.provider, f.label, f.status, '', f.last_success_at ?? 'never', '', f.kind, f.stale ? 'stale' : f.last_error])
 for (const e of r.exceptions) rows.push(['exception', e.id, e.test, 'approved', '', e.expires_at, e.approved_name, '', e.reason])
 for (const p of r.policies) rows.push(['policy', p.version ?? '', p.title, p.state, '', p.review_due ?? '', '', '', ''])
 for (const k of r.risks) rows.push(['risk', k.id, k.title, k.level ?? 'unassessed', '', k.accepted_until ?? '', '', '', ''])
 for (const s of r.trend) rows.push(['trend', s.day, 'snapshot', '', '', s.taken_at, '', '', JSON.stringify(s.totals)])
 return rows.map(row => row.map(cell).join(',')).join('\r\n') + '\r\n'
}
// Daily snapshots: the first scheduler tick of each UTC day records each program's readiness.
export async function snapshotReadiness(env: Bindings, now: Date) {
 const day = now.toISOString().slice(0, 10)
 let taken = 0
 for (const row of await programs(env)) {
  if (await env.DB.prepare('SELECT 1 FROM readiness_snapshots WHERE program_id=? AND day=?').bind(row.id, day).first()) continue
  const totals = (await readiness(env, row, now)).totals
  taken += (await env.DB.prepare('INSERT INTO readiness_snapshots(program_id,day,totals_json,taken_at) VALUES(?,?,?,?) ON CONFLICT DO NOTHING').bind(row.id, day, JSON.stringify(totals), now.toISOString()).run()).meta.changes
 }
 return taken
}
