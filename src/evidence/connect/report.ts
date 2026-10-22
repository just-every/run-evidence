import type { Bindings } from '../../auth.server'
import { validDate } from '../model'
import { Refusal } from '../upload'
import { requireConnection, type runs } from './storage'
import { page, escape } from '../view'
import { slab } from '../ui'
import { facts, table } from '../program/view'
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
 return page('Collection period report', `<p><a href="/app/connections/${report.connection.id}">${escape(report.connection.label)}</a> · ${escape(report.from)} to ${escape(report.to)} (UTC)</p><p>${escape(report.note)}</p>${slab(`<section><h2>Missing coverage</h2>${table(['From', 'To', 'Reason'], report.missing.map(g => [escape(g.from), escape(g.to), escape(g.reason)]))}</section>`)}${slab(`<section><h2>Collection attempts and retained revisions</h2>${report.attempts.map(r => collectionDetails(r.coverage_json, `${r.started_at} · ${r.outcome ?? 'running / unknown'} · ${r.connector_revision}`) + (r.error_code ? `<p>${escape(r.error_code)}</p>` : '')).join('') || '<p>No collection attempts in this period.</p>'}</section>`)}`, 200, { owner, active: 'connections' })
}

// Human report uses compact stored facts; the API preserves the complete
// original context, including structured criteria, for offline reconciliation.
export function collectionDetails(raw: string, title = 'Account, gaps, timestamps, controls and audit periods') {
 const cov = JSON.parse(raw) as Record<string, any>, context = cov.context
 const list = (rows: unknown[]) => rows.map(row => escape(typeof row === 'object' && row ? Object.entries(row).map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`).join(' · ') : row)).join('<br>') || 'None recorded'
 return `<details data-collection-context><summary>${escape(title)}</summary>${facts([
  ['Account', escape(context?.account ?? 'Not captured')],
  ['Library revision', escape(context?.library_revision ?? 'Not captured')],
  ['Attempt started', escape(cov.attempt_started_at ?? 'Not captured')],
  ['Source read started', escape(cov.source_read_started_at ?? 'No successful read recorded')],
  ['Source event time', escape(cov.source_event_at ?? 'Unknown; polling cannot establish a source change time')],
  ['Source-event hint', cov.source_event ? escape('Received '+cov.source_event.received_at+'; reported time '+(cov.source_event.reported_at ?? 'not supplied')+' (unverified)') : 'No event signal recorded'],
  ['Receipt time', escape(cov.received_at ?? 'Not captured')],
  ['Interval', escape(cov.interval_minutes === undefined ? 'Not captured' : cov.interval_minutes + ' minutes')],
  ['Cursor', escape(cov.cursor || cov.resume_pages?.cursors ? JSON.stringify(cov.cursor ?? cov.resume_pages.cursors) : 'Not captured / no resumable cursor')],
  ['Gaps', list(cov.gaps ?? [])],
  ['GitHub membership and departure coverage', cov.github_members ? list([cov.github_members]) : 'Not captured'],
  ['Controls', context ? (context.controls as { control_id: string; name: string; revision: number }[]).map(c => `<a href="/app/controls/${escape(c.control_id)}">${escape(c.name)}</a> · revision ${escape(c.revision)}`).join('<br>') || 'No linked controls' : 'Not captured'],
  ['Tests', context ? (context.tests as { id: string; revision: number }[]).map(t => `<a href="/app/tests/${escape(t.id)}">Test revision ${escape(t.revision)}</a>`).join(' · ') || 'No enabled source tests' : 'Not captured'],
  ['Audit periods', context ? (context.audit_periods as { id: string; name: string; audit_from: string; audit_to: string; revision: number }[]).map(p => `<a href="/app/programs/${escape(p.id)}">${escape(p.name)}</a> · ${escape(p.audit_from)} to ${escape(p.audit_to)} · revision ${escape(p.revision ?? 'not captured')}`).join('<br>') || 'No programs at collection time' : 'Not captured'],
 ])}${codeHistory(cov.code_history)}<p>Complete retained criteria and definitions are available in the JSON report.</p></details>`
}

function codeHistory(value:Record<string,import('./github-history').GithubHistory>|undefined) {
 if(!value)return ''
 return `<section><h3>GitHub change and deployment source history</h3>${Object.entries(value).map(([name,h])=>`<h4>${escape(name)}</h4><p>${escape(h.note)}</p>${h.changes===null?'<p>Merged changes unavailable / incomplete.</p>':h.changes.map(c=>`<details data-code-change><summary>Change #${c.number} · merged ${escape(c.merged_at)}</summary>${facts([['Source revision',escape(c.source_revision)],['Merge revision',escape(c.merge_revision)],['Base branch',escape(c.base)]])}<h5>Original review events</h5>${table(['Reviewer','State','Revision','Submitted'],(c.reviews??[]).map(r=>[escape(r.actor),escape(r.state),escape(r.commit),escape(r.submitted_at)]))}${c.reviews===null?'<p>Reviews unavailable.</p>':''}<h5>Source checks at read time</h5>${table(['Check','State','Conclusion','Completed'],(c.checks??[]).map(r=>[escape(r.name),escape(r.state),escape(r.conclusion??'unknown'),escape(r.completed_at??'not completed')]))}${c.checks===null?'<p>Checks unavailable.</p>':''}<h5>Commit statuses at read time</h5>${table(['Context','State','Created'],(c.statuses??[]).map(r=>[escape(r.context),escape(r.state),escape(r.created_at)]))}${c.statuses===null?'<p>Commit statuses unavailable.</p>':''}</details>`).join('')||'<p>No merged changes returned; historical completeness is unknown.</p>'}<h5>Dependency export</h5>${h.dependencies?`<p>${escape(h.dependencies.note)} Generated ${escape(h.dependencies.generated_at)}.</p>${table(['Package','Version'],h.dependencies.packages.map(p=>[escape(p.name),escape(p.version??'unknown')]))}`:'<p>Dependency export unavailable / incomplete.</p>'}<h5>Deployments</h5>${h.deployments===null?'<p>Deployments unavailable / incomplete.</p>':h.deployments.map(d=>`<details data-code-deployment><summary>Deployment ${d.id} · ${escape(d.environment)} · ${escape(d.created_at)}</summary>${facts([['Revision',escape(d.revision)],['Production',escape(d.production)],['Matching merged changes',escape(d.change_numbers.join(', ')||'Unknown / unmatched')]])}${table(['Status','Created'],(d.statuses??[]).map(r=>[escape(r.state),escape(r.created_at)]))}${d.statuses===null?'<p>Deployment outcomes unavailable.</p>':''}</details>`).join('')||'<p>No deployments returned; historical completeness is unknown.</p>'}${h.gaps.length?'<ul>'+h.gaps.map(g=>'<li>'+escape(g)+'</li>').join('')+'</ul>':''}`).join('')}</section>`
}
