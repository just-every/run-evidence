import type { Bindings } from '../../auth.server'
import { validDate } from '../model'
import { Refusal } from '../upload'
import { requireConnection, type runs } from './storage'
import { page, escape } from '../view'
import { slab } from '../ui'
import { table } from '../program/view'
type Run = Awaited<ReturnType<typeof runs>>[number]
export async function collectionReport(env: Bindings, id: string, from: string, to: string, now: Date) {
 if (!validDate(from) || !validDate(to) || from > to) throw new Refusal('Choose a real UTC collection period.')
 const connection = await requireConnection(env, id), start = from + 'T00:00:00.000Z', end = to + 'T23:59:59.999Z'
 const history = (await env.DB.prepare('SELECT * FROM collection_runs WHERE connection_id=? AND started_at<=? AND (started_at>=? OR id=(SELECT id FROM collection_runs WHERE connection_id=? AND started_at<? ORDER BY started_at DESC,id DESC LIMIT 1)) ORDER BY started_at,id LIMIT 10002').bind(id, end, start, id, start).all<Run>()).results
 if (history.filter(r => r.started_at >= start).length > 10000) throw new Refusal('Collection report exceeds 10,000 attempts; choose a narrower period.', 409)
 const selected = history.filter(r => r.started_at >= start)
 const missing: { from: string; to: string; reason: string }[] = []
 // No synthetic runs fill downtime. Each interval uses the schedule retained
 // on the earlier attempt, with one five-minute scheduler tick of tolerance.
 const observedEnd = Math.min(Date.parse(end), now.getTime())
 let prior = history.filter(r => r.started_at < start).at(-1)
 let boundary = Math.max(Date.parse(start), Date.parse(connection.created_at))
 for (const run of [...selected, null]) {
  const upper = run ? Date.parse(run.started_at) : observedEnd
  const cov = prior ? JSON.parse(prior.coverage_json) : null
  const interval = typeof cov?.interval_minutes === 'number' ? cov.interval_minutes * 60000 : null
  const due = prior && interval ? Date.parse(prior.started_at) + interval + 300000 : boundary
  const lower = Math.max(boundary, due)
  if (upper > lower) missing.push({ from: new Date(lower).toISOString(), to: new Date(upper).toISOString(), reason: prior && interval ? 'No recorded collection attempt in the elapsed schedule window; no catch-up evidence exists.' : 'No recorded schedule or collection before the first attempt; coverage unknown.' })
  if (run) { prior = run; boundary = upper }
 }
 return { connection: { id: connection.id, label: connection.label, provider: connection.provider, account: connection.account }, from, to, attempts: selected, missing, note: 'Attempts, successful reads, failures and recovery are separate facts. Source event times are unknown unless explicitly retained; receipt time is the collector clock, never proof of a source change time. Historical rows without context remain unknown.' }
}
export function collectionReportPage(report: Awaited<ReturnType<typeof collectionReport>>, owner: string) {
 return page('Collection period report', `<p><a href="/app/connections/${report.connection.id}">${escape(report.connection.label)}</a> · ${escape(report.from)} to ${escape(report.to)} (UTC)</p><p>${escape(report.note)}</p>${slab(`<section><h2>Missing coverage</h2>${table(['From', 'To', 'Reason'], report.missing.map(g => [escape(g.from), escape(g.to), escape(g.reason)]))}</section>`)}${slab(`<section><h2>Collection attempts and retained revisions</h2>${table(['Started', 'Outcome', 'Connector', 'Coverage and original context'], report.attempts.map(r => [escape(r.started_at), escape(r.outcome ?? 'running / unknown'), escape(r.connector_revision), `<details><summary>Account, gaps, timestamps, controls and audit periods</summary><pre>${escape(JSON.stringify(JSON.parse(r.coverage_json), null, 2))}</pre></details>${r.error_code ? `<p>${escape(r.error_code)}</p>` : ''}`]))}</section>`)}`, 200, { owner, active: 'connections' })
}
