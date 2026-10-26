import { escape, icon, stateChip, type IconName } from '../ui'
import { ago, usDate, usDateTime, usDayTime, usTime } from '../format'
import { providerNames, state, type OpenTest, type Show, type TestState, type WorkspaceRow, type LatestRun } from './workspace'
import type { CatalogueEntry } from './catalogue'
export const categoryIcon: Record<string, IconName> = { cloud: 'cloud', identity: 'key', code: 'code', device: 'laptop', vulnerability: 'bug', 'security issue': 'alert', personnel: 'people', policy: 'document', vendor: 'plug' }
const dotLabel: Record<TestState, string> = { failing: 'Failing', stale: 'Stale', passing: 'Passing', unknown: 'Unknown', 'never run': 'Never run', 'no resources': 'No items' }
const dot = (s: TestState) => `<span class="test-dot test-dot-${s.replace(' ', '-')}" role="img" aria-label="${dotLabel[s]}"></span>`
const initial = (name: string) => `<span class="avatar" aria-hidden="true">${escape(Array.from(name)[0]?.toLocaleUpperCase() ?? '')}</span>`
const query = (params: Record<string, string>) => '?' + new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString()
// Resource type slugs stay in APIs; people see a noun and the correct count.
export function resourceNoun(type: string, count = 2) {
 const noun = type.split('.').at(-1)!.replaceAll('_',' ').replaceAll('-',' ').replace(/\biam\b/gi,'IAM').replace(/\bec2\b/gi,'EC2').replace(/\bs3\b/gi,'S3').replace(/\brds\b/gi,'RDS').replace(/\bsql\b/gi,'SQL').replace(/\bapi\b/gi,'API').replace(/\bnsg\b/gi,'network security group').replace(/\bsa key\b/gi,'service account key')
 if (count === 1) return noun
 const irregular: Record<string,string> = {person:'people',repository:'repositories',policy:'policies',identity:'identities'}
 return irregular[noun] ?? (/(s|x|sh|ch)$/.test(noun) ? noun+'es' : /[^aeiou]y$/.test(noun) ? noun.slice(0,-1)+'ies' : noun+'s')
}
function result(r: WorkspaceRow, now: Date) {
 const run = r.run, s = state(r)
 if (s === 'stale') return `<span class="result result-stale">Stale</span><small>${r.last_run ? escape(ago(r.last_run, now)) : ''}</small>`
 if (!run) return '<span class="result result-none">Never run</span>'
 if (!run.population) return '<span class="result result-none">No items</span>'
 if (run.failed) return `<span class="result result-fail">${run.failed} failing</span><small>of ${run.population} ${escape(resourceNoun(r.resource_type,run.population))}</small>`
 if (run.unknown) return `<span class="result result-unknown">${run.unknown} unknown</span><small>of ${run.population} ${escape(resourceNoun(r.resource_type,run.population))}</small>`
 return `<span class="result result-pass">${run.passed} of ${run.population - run.not_applicable}</span><small>${escape(resourceNoun(r.resource_type,run.population-run.not_applicable))}</small>`
}
function listRow(r: WorkspaceRow, selected: string, params: Record<string, string>, now: Date) {
 const s = state(r), open = r.id === selected
 return `<tr class="${open ? 'is-open' : ''}${s === 'failing' ? ' is-failing' : ''}"><td data-label="Status">${dot(s)}</td><td data-label="Test"><a class="test-link" href="${escape(query({ ...params, test: r.id }))}"${open ? ' aria-current="true"' : ''}>${escape(r.name)}</a></td><td data-label="Control" class="test-control">${r.control ? escape(r.control.ref) : '—'}</td><td data-label="Integration"><span class="integration">${icon(categoryIcon[r.category] ?? 'plug')}<span>${escape(r.integration)}</span></span></td><td data-label="Owner">${r.owner ? `<span class="owner">${initial(r.owner)}<span>${escape(r.owner)}</span></span>` : '<span class="unassigned">Unassigned</span>'}</td><td data-label="Last run" class="test-when">${r.last_run ? `${escape(usDate(r.last_run))}<small>${escape(usTime(r.last_run))}</small>` : '—'}</td><td data-label="Result" class="test-result">${result(r, now)}</td></tr>`
}
function runLine(run: LatestRun, type: string) {
 const unit = resourceNoun(type,run.population), passedUnit = resourceNoun(type,run.population-run.not_applicable)
 const failed = run.failed > 0, label = failed ? 'Failed' : run.unknown ? 'Unknown' : run.population ? 'Passed' : 'No items'
 const detail = failed ? `${run.failed} failing of ${run.population} ${unit}` : run.unknown ? `${run.unknown} unknown of ${run.population} ${unit}` : run.population ? `All ${run.population - run.not_applicable} ${passedUnit} passed` : 'No items in scope'
 return `<li class="run run-${failed ? 'fail' : run.unknown ? 'unknown' : 'pass'}"><div class="run-top"><span>${escape(usDateTime(run.started_at))}</span><span class="run-outcome">${label}</span></div><p>${escape(detail)} · ${escape(run.trigger)} run</p></li>`
}
// The opened test's header: its category icon, name, control and integration, and status.
export function testHead(r: WorkspaceRow, title: string) {
 const s = state(r)
 return `<div class="detail-icon${s === 'failing' ? ' is-failing' : ''}">${icon(categoryIcon[r.category] ?? 'pulse')}</div><div class="detail-title">${title}<p>${escape([r.control?.ref, r.integration].filter(Boolean).join(' · '))}</p></div>${stateChip(s)}`
}
// The first failure, from the observation that opened it, with what was found in words.
export function failureAlert(open: OpenTest) {
 const r = open.row, first = open.failing[0], ob = first?.obligation
 return first ? `<div class="detail-alert" role="status"><span class="alert-dot" aria-hidden="true"></span><div><strong>Failed on ${escape(usDate(first.observed_at))} at ${escape(usTime(first.observed_at))}</strong><p>${escape(first.reason)} on ${escape(first.display_name)}.${open.failing.length > 1 ? ` ${open.failing.length - 1} more failing.` : ''}</p></div><a class="button button-secondary button-small" href="${ob ? `/app/remediation/${ob.id}` : `/app/tests/${r.id}#results-title`}">View result ${icon('external')}</a></div>` : ''
}
// The remediation obligation of the first failing item: next action, owner, target and re-test.
export function remediationCard(open: OpenTest, now: Date) {
 const r = open.row, first = open.failing[0], ob = first?.obligation
 if (!ob) return ''
 const retest = ob.retest_queued_at ? `Queued<small>${escape(usDayTime(ob.retest_queued_at))}</small>` : open.nextRun ? (Date.parse(open.nextRun) > now.getTime() ? `Next run<small>${escape(usDayTime(open.nextRun))}</small>` : `Overdue<small>since ${escape(usDayTime(open.nextRun))}</small>`) : 'Not scheduled'
 return `<section class="detail-card" aria-labelledby="task-title"><div class="card-top">${icon('task')}<h3 id="task-title">Remediation</h3>${stateChip(ob.state)}</div><p class="task-action">${escape(ob.next_action || `Bring ${first.display_name} back within the test's criteria`)}</p><p>${escape(first.display_name)} · ${escape(r.severity)} severity · SLA ${escape(ob.sla_status)}</p><dl class="task-meta"><div><dt>Owner</dt><dd>${ob.owner_name ? `<span class="owner">${initial(ob.owner_name)}<span>${escape(ob.owner_name)}</span></span>` : 'Unassigned'}</dd></div><div><dt>${ob.target_date ? 'Target date' : 'Remediate by'}</dt><dd>${icon('calendar')}<span>${escape(usDate(ob.target_date ?? ob.sla_due))}</span></dd></div><div><dt>Re-test</dt><dd>${icon('clock')}<span>${retest}</span></dd></div></dl></section>`
}
// The test's own fix step: the catalogue's console step, or the step written with a custom test.
export function fixStep(r: WorkspaceRow, entry?: CatalogueEntry) {
 if (entry) return Object.entries(entry.remediation).slice(0, 1).map(([provider, step]) => `<div class="fix"><h4>${escape(providerNames[provider] ?? provider)}</h4><p>${escape(step.console)}</p></div>`).join('')
 if (r.remediation) return `<div class="fix"><h4>${escape(r.integration)}</h4><p>${escape(r.remediation)}</p></div>`
 return `<div class="fix"><p>No fix step is written for this test. <a href="/app/tests/${r.id}#tune-title">Write one under Tune</a> and every failure will carry it.</p></div>`
}
function detailPanel(open: OpenTest, now: Date) {
 const r = open.row, s = state(r), ob = open.failing[0]?.obligation
 const tabs = [['Overview', ''], ['Results', `/app/tests/${r.id}#results-title`], ['Run history', `/app/tests/${r.id}#runs-title`], ...(r.control ? [['Control', `/app/controls/${r.control.id}`]] : []), ['Tune', `/app/tests/${r.id}#tune-title`]]
 const head = `<div class="detail-head">${testHead(r, `<h2 id="detail-title"><a href="/app/tests/${r.id}">${escape(r.name)}</a></h2>`)}</div>`
 const nav = `<nav class="detail-tabs" aria-label="Test views">${tabs.map(([label, href]) => href ? `<a href="${href}">${label}</a>` : `<a aria-current="page" href="#detail-title">${label}</a>`).join('')}</nav>`
 const alert = failureAlert(open), task = remediationCard(open, now), steps = fixStep(r, open.entry)
 const fix = s === 'failing' ? `<section class="detail-card" aria-labelledby="fix-title"><div class="card-top">${icon('spark')}<h3 id="fix-title">How to remediate</h3></div>${steps}<div class="detail-actions"><form method="post" action="/app/tests/${r.id}/run"><button>Run now</button></form><a class="button button-secondary" href="${ob ? `/app/remediation/${ob.id}` : `/app/tests/${r.id}`}">Remediate</a></div><p class="footnote">Run now re-tests every item. This failure stays in the run history after any later pass.</p></section>` : `<section class="detail-card" aria-labelledby="fix-title"><div class="card-top">${icon('pulse')}<h3 id="fix-title">Latest run</h3></div><p>${r.run ? escape(`${usDateTime(r.run.started_at)} · ${r.run.population} ${resourceNoun(r.resource_type,r.run.population)} evaluated`) : 'This test has not run yet.'}</p><div class="detail-actions"><form method="post" action="/app/tests/${r.id}/run"><button>Run now</button></form><a class="button button-secondary" href="/app/tests/${r.id}">Open test</a></div></section>`
 const history = `<section class="detail-card detail-history" aria-labelledby="history-title"><h3 id="history-title">Run history</h3>${open.runs.length ? `<ol class="runs">${open.runs.map(run => runLine(run, r.resource_type)).join('')}</ol>` : '<p>No runs yet.</p>'}</section>`
 return `<aside class="test-detail${s === 'failing' ? ' is-failing' : ''}" aria-labelledby="detail-title">${s === 'failing' ? '<span class="pushpin" aria-hidden="true"></span>' : ''}${head}${nav}<div class="detail-body">${alert}${task}${fix}${history}</div></aside>`
}
export interface WorkspaceView { rows: WorkspaceRow[]; shown: WorkspaceRow[]; open: OpenTest | null; show: Show; integration: string }
export function testsWorkspace(v: WorkspaceView, now: Date) {
 const count = (s: TestState) => v.rows.filter(r => state(r) === s).length
 const failing = count('failing'), stale = count('stale'), passing = count('passing')
 const integrations = [...new Set(v.rows.map(r => r.integration))].sort()
 const keep = { show: v.show === 'all' ? '' : v.show, integration: v.integration }
 const pills = `<nav class="filter-row tests-filters" aria-label="Filter tests"><a href="${escape(query({ ...keep, show: v.show === 'failing' ? '' : 'failing' }))}"${v.show === 'failing' ? ' aria-current="true"' : ''}>Failing (${failing})</a><a href="${escape(query({ ...keep, show: v.show === 'stale' ? '' : 'stale' }))}"${v.show === 'stale' ? ' aria-current="true"' : ''}>Stale (${stale})</a><details class="pill-menu"><summary class="pill">${escape(v.integration || 'By integration')}</summary><div class="pill-menu-list"><a href="${escape(query({ show: keep.show }))}"${!v.integration ? ' aria-current="true"' : ''}>Every integration</a>${integrations.map(name => `<a href="${escape(query({ show: keep.show, integration: name }))}"${v.integration === name ? ' aria-current="true"' : ''}>${escape(name)}</a>`).join('')}</div></details></nav>`
 const counts = `<p class="tests-counts"><span>${dot('passing')}${passing} passing</span><span>${dot('failing')}${failing} failing</span><span>${dot('stale')}${stale} stale</span></p>`
 const params = { show: keep.show, integration: v.integration }
 const table = v.shown.length ? `<div class="tests-table"><table><caption class="visually-hidden">Tests</caption><colgroup><col class="c-status"><col class="c-test"><col class="c-control"><col class="c-integration"><col class="c-owner"><col class="c-when"><col class="c-result"></colgroup><thead><tr><th scope="col">Status</th><th scope="col">Test</th><th scope="col">Control</th><th scope="col">Integration</th><th scope="col">Owner</th><th scope="col">Last run</th><th scope="col">Result</th></tr></thead><tbody>${v.shown.map(r => listRow(r, v.open?.row.id ?? '', params, now)).join('')}</tbody></table></div>` : `<div class="tests-table tests-none"><p class="empty-copy">No tests match this filter. <a href="/app/tests">Show every test</a></p></div>`
 return `<div class="tests-workspace"><section class="tests-list" aria-labelledby="tests-title"><div class="tests-head"><h1 id="tests-title">Tests</h1><div class="tests-toolbar">${counts}${pills}</div></div>${table}</section>${v.open ? detailPanel(v.open, now) : ''}</div>`
}
export function testsEmpty() {
 return `<div class="tests-head"><h1 id="tests-title">Tests</h1></div><div class="panel tests-empty"><section class="empty-state" aria-labelledby="no-tests-title"><span class="icon-tile">${icon('pulse')}</span><h2 id="no-tests-title">No tests yet</h2><p>Connect GitHub, a cloud account or an identity directory to enable its catalogue tests, or define a custom test over pushed resources below.</p><div class="actions-row"><a class="button" href="/app/connections">Open connections</a><a class="button button-secondary" href="#define-title">Define a custom test</a></div></section></div>`
}
