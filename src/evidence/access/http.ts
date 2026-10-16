import { page, escape } from '../view'
import { slab, stateChip } from '../ui'
import { done, json, ownerRoutes, readInput, uuid, type Route } from '../door'
import { facts, options, personOptions, table } from '../program/view'
import { people } from '../program/people'
import { delegate, exclude, items, requireReview, sources, startReview, type ItemView } from './storage'
const id = `(${uuid})`
const both = (path: string) => new RegExp(`^/(?:app|api)${path}$`)
const cell = (v: unknown) => { const t = v === null || v === undefined ? '' : String(v); return /[",\n\r]/.test(t) || /^[=+\-@\t]/.test(t) ? `"${(/^[=+\-@\t]/.test(t) ? "'" : '') + t.replace(/"/g, '""')}"` : t }
const state = (i: ItemView) => i.decision ? i.decision.decision : i.overdue ? 'overdue' : 'pending'
// Owners start campaigns, exclude or delegate items, and export the evidence.
export function accessHandler(clock: () => Date) {
 const routes: Route[] = [
  { method: 'GET', pattern: both('/access-reviews'), run: async c => {
   const reviews = (await c.env.DB.prepare('SELECT * FROM access_reviews ORDER BY created_at DESC').all<{ id: string; name: string; cadence: string; period_from: string; period_to: string; due_date: string; completed_at: string | null; previous_id: string | null }>()).results, available = await sources(c.env)
   if (c.isApi) return json({ reviews, sources: available })
   const folks = await people(c.env)
   const list = slab(`<section aria-labelledby="reviews-list"><h2 id="reviews-list">Access reviews</h2>${table(['Review', 'Cadence', 'Period', 'Due', 'State'], reviews.map(r => [`<a href="/app/access-reviews/${r.id}">${escape(r.name)}</a>`, escape(r.cadence), escape(`${r.period_from} to ${r.period_to}`), escape(r.due_date), stateChip(r.completed_at ? 'complete' : 'open')]), 'Access reviews')}</section>`)
   const start = slab(`<section aria-labelledby="start-title"><h2 id="start-title">Start a campaign</h2><p class="panel-intro">The population is frozen now from each chosen source. Resource owners decide in their own sign-in at /me; nobody reviews their own access. An uploaded list stays labelled manual, and its revocations close only on a newer upload without the account.</p><form method="post" action="/app/access-reviews"><label>Name<input name="name" required maxlength="200" placeholder="Q4 access review"></label><label>Cadence<select name="cadence" aria-label="Cadence">${options(['quarterly', 'semi-annual', 'annual', 'one-off'])}</select></label><div class="dates"><label>Period from<input type="date" name="period_from" required></label><label>Period to<input type="date" name="period_to" required></label></div><label>Decisions due<input type="date" name="due_date" required></label><fieldset><legend>Sources and resource owners</legend>${available.map(s => `<label class="check"><input type="checkbox" name="sources[]" value="${escape(s.key)}"> ${escape(s.label)}</label><label>Reviewer for ${escape(s.label)}<select name="reviewer_${escape(s.key)}" aria-label="Reviewer for ${escape(s.label)}">${personOptions(folks)}</select></label>`).join('') || '<p class="empty-copy">Connect a directory or upload an account list first.</p>'}</fieldset><button>Freeze the population and start</button></form></section>`)
   return page('Access reviews', `<div class="app-columns">${list}${start}</div>`, 200, { owner: c.actor.name, active: 'connections' })
  } },
  { method: 'POST', pattern: both('/access-reviews'), run: async c => { const created = await startReview(c.env, c.actor, await readInput(c.request), c.now); return done(c, '/app/access-reviews/' + created.id, created, 201) } },
  { method: 'GET', pattern: both(`/access-reviews/${id}`), run: async (c, m) => {
   const r = await requireReview(c.env, m[1]), list = await items(c.env, r.id, c.now)
   const summary = { total: list.length, decided: list.filter(i => i.decision).length, overdue: list.filter(i => i.overdue).length, supplemental: list.filter(i => i.supplemental).length, revocations_open: list.filter(i => i.revocation && i.revocation.state !== 'verified').length }
   if (c.isApi) return json({ review: r, summary, items: list })
   const folks = await people(c.env)
   const head = slab(`<section aria-labelledby="review-facts"><h2 id="review-facts">${escape(r.name)}</h2>${facts([['Cadence', escape(r.cadence)], ['Period', escape(`${r.period_from} to ${r.period_to}`)], ['Decisions due', escape(r.due_date)], ['State', stateChip(r.completed_at ? 'complete' : 'open')], ['Decided', `${summary.decided} of ${summary.total}`], ['Overdue', String(summary.overdue)], ['Late-discovered accounts', String(summary.supplemental)], ['Revocations not yet verified', String(summary.revocations_open)]])}<p class="actions-row"><a class="button button-secondary" href="/api/access-reviews/${r.id}/export">Export JSON</a> <a class="button button-secondary" href="/app/access-reviews/${r.id}/export.csv">Export CSV</a></p></section>`)
   const body = slab(`<section aria-labelledby="items-title"><h2 id="items-title">Population and decisions</h2>${table(['Account', 'Source', 'Access', 'Reviewer', 'Decision', 'Revocation', ''], list.map(i => [escape(i.display_name) + (i.supplemental ? ' ' + stateChip('late') : ''), (i.provenance === 'manually-asserted' ? stateChip('manual') + ' ' : '') + escape(i.source_label), escape([i.attributes.roles ?? i.attributes.role, i.attributes.admin ? 'admin' : '', i.attributes.population, i.attributes.mfa === false ? 'no MFA' : ''].filter(Boolean).join(' · ') || '—'), escape(i.delegated_to ? `${i.delegated_to} (delegated: ${i.delegation_reason})` : i.reviewer ?? '—'), stateChip(state(i)) + (i.decision ? `<br><small>${escape(`${i.decision.by}: ${i.decision.reason}`)}</small>` : ''), i.revocation ? stateChip(i.revocation.state) + `<br><small>${escape(i.revocation.evidence || 'waiting for the source')}</small>` : '—', i.decision ? '' : `<details><summary>Exclude or delegate</summary><form method="post" action="/app/access-reviews/items/${i.id}/exclude"><label>Exclusion reason<input name="reason" required maxlength="1000"></label><button class="button-secondary">Exclude</button></form><form method="post" action="/app/access-reviews/items/${i.id}/delegate"><label>Decides instead<select name="person_id" aria-label="Delegate">${personOptions(folks)}</select></label><label>Reason<input name="reason" required maxlength="500"></label><button class="button-secondary">Delegate</button></form></details>`]), 'Population')}</section>`)
   return page(r.name, `${head}${body}`, 200, { owner: c.actor.name, active: 'connections' })
  } },
  { method: 'GET', pattern: both(`/access-reviews/${id}/export`), run: async (c, m) => {
   const r = await requireReview(c.env, m[1]), list = await items(c.env, r.id, c.now)
   await c.env.DB.prepare("INSERT INTO product_audit(id,actor_kind,actor_id,actor_name,action,subject,outcome,detail,at) VALUES(?,'owner',?,?,'access-review.exported',?,'succeeded','json',?)").bind(crypto.randomUUID(), c.actor.id, c.actor.name, 'access-review:' + r.id, c.now.toISOString()).run()
   return json({ format: 'evidence-access-review', version: 1, exported_at: c.now.toISOString(), review: r, population: list.map(({ history: _h, ...i }) => i), decisions: list.flatMap(i => i.history.map(h => ({ item: i.id, account: i.account_key, ...h }))) })
  } },
  { method: 'GET', pattern: new RegExp(`^/app/access-reviews/${id}/export\\.csv$`), run: async (c, m) => {
   const r = await requireReview(c.env, m[1]), list = await items(c.env, r.id, c.now)
   const rows = [['review', 'period_from', 'period_to', 'source', 'provenance', 'account', 'access', 'reviewer', 'decision', 'reason', 'decided_by', 'decided_at', 'revocation', 'revocation_evidence', 'supplemental'], ...list.map(i => [r.name, r.period_from, r.period_to, i.source_label, i.provenance, i.account_key, [i.attributes.roles ?? i.attributes.role, i.attributes.admin ? 'admin' : ''].filter(Boolean).join(' '), i.delegated_to ?? i.reviewer ?? '', state(i), i.decision?.reason ?? '', i.decision?.by ?? '', i.decision?.at ?? '', i.revocation?.state ?? '', i.revocation?.evidence ?? '', i.supplemental ? 'yes' : 'no'])]
   return new Response(rows.map(row => row.map(cell).join(',')).join('\r\n') + '\r\n', { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="access-review-${r.id}.csv"`, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } })
  } },
  { method: 'POST', pattern: both(`/access-reviews/items/${id}/exclude`), run: async (c, m) => { await exclude(c.env, c.actor, m[1], await readInput(c.request), c.now); return done(c, '/app/access-reviews', { excluded: true }) } },
  { method: 'POST', pattern: both(`/access-reviews/items/${id}/delegate`), run: async (c, m) => { await delegate(c.env, c.actor, m[1], await readInput(c.request), c.now); return done(c, '/app/access-reviews', { delegated: true }) } },
 ]
 return ownerRoutes(routes, clock)
}
