import { themeFrame } from '../base/theme-frame'
import { cadences, groups, period, type Receipt } from './model'
import type { desk } from './storage'
import { appShell, type PageOptions } from './shell'
import { escape, icon, iconTile, slab, stateChip, type IconName } from './ui'
export { escape } from './ui'
export type { PageOptions } from './shell'
export const headers = { 'cache-control': 'no-store', 'referrer-policy': 'strict-origin', 'x-content-type-options': 'nosniff', 'x-robots-tag': 'noindex, nofollow' }

export async function page(title: string, body: string, status = 200, options: PageOptions = {}) {
 const frame = await themeFrame({ href: '/rer-theme.css', productName: 'Evidence', accentColor: '#16181d' })
 const styles = ['/desk.css', ...(options.styles ?? [])].map(href=>`<link rel="stylesheet" href="${escape(href)}">`).join('')
 const scripts = (options.scripts ?? []).map(src=>`<script src="${escape(src)}" defer></script>`).join('')
 return new Response(`<!doctype html><html lang="en"${frame.htmlClass}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)} · Evidence</title>${frame.head}${styles}${scripts}</head><body class="evidence-app">${appShell(title, body, options)}</body></html>`, { status, headers: { ...headers, 'content-type':'text/html; charset=utf-8', 'content-security-policy': `default-src 'none'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'; ${scripts ? "script-src 'self'; connect-src 'self'; " : ''}${frame.policy}` } })
}
const options = (values: readonly string[]) => values.map(value => `<option>${escape(value)}</option>`).join('')
const groupIcon = (group: string): IconName => group === 'Data' ? 'database' : group === 'People' ? 'people' : group === 'Change' ? 'change' : 'document'
type DeskRequirement = Awaited<ReturnType<typeof desk>>['requirements'][number]

function requirementCard(r: DeskRequirement, selected: string) {
 const window = period(r.cadence, selected)
 return slab(`<article class="requirement-card">${iconTile(groupIcon(r.group_name))}<div class="requirement-summary"><h2>${escape(r.control_name)}</h2><p>${escape(r.group_name)} · ${escape(r.cadence)} · ${escape(r.name)}</p><p>Selected period: ${window.from} through ${window.to} (UTC)</p><a class="requirement-link" href="/app/requirements/${r.id}?date=${selected}">Upload proof &amp; view history (${r.receipts.length})</a></div><div class="requirement-state">${stateChip(r.gap)}${icon('chevron')}</div></article>`, 'requirement-slab')
}
function addControl() {
 return slab(`<section class="add-control" aria-labelledby="add-control-title"><h2 id="add-control-title">Add a control</h2><form method="post" action="/app/controls"><label>Control in plain words<input name="name" maxlength="300" required placeholder="Review who can access customer data"></label><label>Group<select name="group" aria-label="Group">${options(groups)}</select></label><label>Named proof<input name="proof" maxlength="300" required placeholder="Dated access review screenshot"></label><label>Cadence<select name="cadence" aria-label="Cadence">${options(cadences)}</select></label><button>Add control</button></form></section>`, 'control-slab')
}
export async function deskPage(data: Awaited<ReturnType<typeof desk>>, owner: string) {
 const dateForm = slab(`<form method="get" class="period"><label for="review-date">Review a date</label><input id="review-date" type="date" name="date" value="${data.selected}" required><button>Show period</button></form>`, 'period-slab')
 const empty = slab(`<section class="empty-state">${iconTile('document')}<h2>No controls yet.</h2><p>Add the first control and the proof you want to keep.</p></section>`, 'empty-slab')
 const rows = data.requirements.map(r=>requirementCard(r,data.selected)).join('')
 return page('Proof desk', `<p class="page-intro">Signed in as <strong>${escape(owner)}</strong>. One business, owner-written controls and manual proof.</p><div class="desk-columns"><div class="desk-requirements">${dateForm}${rows || empty}</div>${addControl()}</div>`, 200, { owner, active: 'desk', className: 'desk-page' })
}
function receiptHistory(receipts: Receipt[]) {
 return receipts.map(x=>`<article class="receipt-row">${iconTile('document')}<div><h3><a class="receipt-title" href="/app/receipts/${x.id}">${escape(x.filename)}</a></h3><p>${x.covered_from} through ${x.covered_to} · ${x.superseded_by ? 'superseded' : 'current'} · ${x.available ? 'bytes available' : 'unavailable bytes'}</p><p>Added ${escape(x.added_at)} by ${escape(x.added_by_name)}</p><a class="receipt-download" href="/app/receipts/${x.id}/download">Download retained file</a></div><span class="receipt-chevron">${icon('chevron')}</span></article>`).join('') || '<p class="empty-copy">No receipts yet.</p>'
}
export async function requirementPage(r: DeskRequirement, selected: string, owner?: string) {
 const window = period(r.cadence, selected)
 const current = r.receipts.filter(x => !x.superseded_by)
 const upload = slab(`<section aria-labelledby="add-proof-title"><h2 id="add-proof-title">Add proof</h2><p class="panel-intro">Any file or screenshot, up to 10 MiB. Every upload is recorded as manually-asserted. Files are downloaded, never previewed here.</p><form method="post" enctype="multipart/form-data" action="/app/requirements/${r.id}/uploads"><label>File<input type="file" name="file" required></label><label>Source<input name="source" maxlength="1000" required placeholder="Where this file came from"></label><div class="dates"><label>Covered from (UTC)<input type="date" name="covered_from" value="${window.from}" required></label><label>Covered through (UTC)<input type="date" name="covered_to" value="${window.to}" required></label></div><label>Supersede a receipt (explicit replacement)<select name="supersedes" aria-label="Supersede a receipt (explicit replacement)"><option value="">Keep all existing receipts current</option>${current.map(x => `<option value="${x.id}">${escape(x.filename)} · ${x.covered_from} to ${x.covered_to}</option>`).join('')}</select></label><button>Store proof &amp; issue receipt</button></form></section>`, 'proof-slab')
 const history = slab(`<section aria-labelledby="receipt-history-title"><h2 id="receipt-history-title">Receipt history</h2><div class="card-list">${receiptHistory(r.receipts)}</div></section>`, 'history-slab')
 return page(r.control_name, `<p class="page-intro">${escape(r.group_name)} · ${escape(r.name)} · ${r.cadence}</p><p class="requirement-period">${stateChip(r.gap)}<span>for ${window.from} through ${window.to} (UTC).</span></p><div class="app-columns requirement-columns">${upload}${history}</div>`, 200, { owner, active: 'desk', className: 'requirement-page' })
}
export async function receiptPage(r: Receipt, owner?: string) {
 const facts = [['Receipt',r.id],['Origin',r.origin],['Source',r.source],['Covered period',r.covered_from+' through '+r.covered_to+' (UTC)'],['Added by',r.added_by_name+' ('+r.added_by+')'],['Stored at',r.added_at],['Bytes',r.size],['Status',r.superseded_by ? 'superseded' : 'current'],['Availability',r.available ? 'bytes available' : 'unavailable bytes']]
 const details = slab(`<dl class="facts receipt-facts">${facts.map(([label,value]) => `<dt>${label}</dt><dd>${label==='Status' ? stateChip(String(value)) : escape(value)}</dd>`).join('')}</dl>`, 'receipt-facts-slab')
 const fingerprint = slab(`<section aria-labelledby="fingerprint-title"><h2 id="fingerprint-title">SHA-256 fingerprint</h2><code class="fingerprint">${escape(r.sha256)}</code>${r.supersedes ? `<p>Supersedes <a href="/app/receipts/${r.supersedes}">${r.supersedes}</a>.</p>` : ''}${r.superseded_by ? `<p>Superseded by <a href="/app/receipts/${r.superseded_by}">${r.superseded_by}</a>. These original facts and bytes are retained.</p>` : ''}<div class="receipt-actions"><a class="button" href="/app/receipts/${r.id}/download">Download retained file</a><a class="button button-secondary" href="/api/receipts/${r.id}">Receipt JSON</a><a class="button button-secondary" href="/app/requirements/${r.requirement_id}?date=${r.covered_from}">Requirement history</a></div></section>`, 'fingerprint-slab')
 return page('Receipt', `<p class="receipt-filename">${escape(r.filename)}</p><div class="receipt-columns">${details}${fingerprint}</div>`, 200, { owner, active: 'desk', className: 'receipt-page' })
}
