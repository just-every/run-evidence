import { page, escape } from '../view'
import { slab, stateChip } from '../ui'
import { done, json, ownerRoutes, readInput, uuid, type Route } from '../door'
import { options, personOptions, table } from '../program/view'
import { people } from '../program/people'
import { programs } from '../program/storage'
import { completeReview, overrideReview, reviewStates, scheduleReview, type Kind } from './schedule'
const id = `(${uuid})`
const both = (path: string) => new RegExp(`^/(?:app|api)${path}$`)
const kind = (value: string) => value as Kind
// Recurring policy and vendor reviews: schedule, record a review, move one cycle.
export function reviewHandler(clock: () => Date) {
 const routes: Route[] = [
  { method: 'GET', pattern: both('/reviews'), run: async c => {
   const rows = await reviewStates(c.env, c.now)
   if (c.isApi) return json({ reviews: rows.map(r => ({ kind: r.kind, id: r.id, name: r.name, ...r.review, history: r.history })) })
   const folks = await people(c.env), progs = await programs(c.env)
   const body = slab(`<section aria-labelledby="reviews-title"><h2 id="reviews-title">Policy and vendor reviews</h2><p class="panel-intro">Each policy and vendor is reviewed on its own cycle: annual by default from its last review, or semi-annual, or anchored to a fiscal year or a program's audit window. A schedule change applies from now on; a one-off date moves only the current cycle. Reminders go to the review owner at the lead and at the deadline.</p>${table(['Subject', 'Cycle', 'Last review', 'Due', 'State', ''], rows.map(r => [`${escape(r.name)}<br><small>${r.kind}</small>`, escape(`${r.review.schedule.cadence}, ${r.review.schedule.anchor}${r.review.period ? ` (${r.review.period.from} to ${r.review.period.to})` : ''}`), escape(r.review.last_review ?? 'never'), escape(r.review.due ?? '—') + (r.review.override ? `<br><small>moved: ${escape(r.review.override.reason)}</small>` : ''), stateChip(r.review.state === 'covered' ? 'current' : r.review.state === 'overdue' ? 'overdue' : r.review.state === 'due soon' ? 'due soon' : 'missing'),
    `<details><summary>Record or schedule</summary><form method="post" action="/app/reviews/${r.kind}/${r.id}/complete"><label>Reviewed on<input type="date" name="completed_on" required></label><label>Notes<input name="notes" required maxlength="1000"></label><button class="button-secondary">Record review</button></form><form method="post" action="/app/reviews/${r.kind}/${r.id}/schedule"><label>Cycle<select name="cadence" aria-label="Cycle">${options(['annual', 'semi-annual'], r.review.schedule.cadence)}</select></label><label>Anchor<select name="anchor" aria-label="Anchor">${options([['effective-date', 'Last review date'], ['fiscal-year', 'Fiscal year'], ['audit-window', 'Audit window']], r.review.schedule.anchor)}</select></label><label>Fiscal year starts (month)<input name="fiscal_start_month" inputmode="numeric" maxlength="2"></label><label>Audit window of<select name="program_id" aria-label="Program">${`<option value="">—</option>` + options(progs.map(p => [p.id, `${p.name} (from ${p.audit_from})`] as [string, string]))}</select></label><label>Reminder lead (days)<input name="reminder_lead_days" inputmode="numeric" maxlength="3"></label><label>Review owner<select name="owner_person_id" aria-label="Review owner">${personOptions(folks, r.review.schedule.owner_person_id ?? '', 'The policy or vendor owner')}</select></label><label>Reason<input name="reason" required maxlength="500"></label><button class="button-secondary">Change schedule from now on</button></form>${r.review.schedule.anchor === 'effective-date' && r.review.due ? `<form method="post" action="/app/reviews/${r.kind}/${r.id}/renewal-date"><label>Move this cycle to<input type="date" name="due_date" required></label><label>Reason<input name="reason" required maxlength="500"></label><button class="button-secondary">Move this cycle only</button></form>` : ''}</details>`]), 'Reviews')}</section>`)
   return page('Reviews', body, 200, { owner: c.actor.name, active: 'programs' })
  } },
  { method: 'POST', pattern: both(`/reviews/(policy|vendor)/${id}/schedule`), run: async (c, m) => { await scheduleReview(c.env, c.actor, kind(m[1]), m[2], await readInput(c.request), c.now); return done(c, '/app/reviews', { scheduled: true }, 201) } },
  { method: 'POST', pattern: both(`/reviews/(policy|vendor)/${id}/complete`), run: async (c, m) => { await completeReview(c.env, c.actor, kind(m[1]), m[2], await readInput(c.request), c.now); return done(c, '/app/reviews', { recorded: true }, 201) } },
  { method: 'POST', pattern: both(`/reviews/(policy|vendor)/${id}/renewal-date`), run: async (c, m) => { await overrideReview(c.env, c.actor, kind(m[1]), m[2], await readInput(c.request), c.now); return done(c, '/app/reviews', { moved: true }, 201) } },
 ]
 return ownerRoutes(routes, clock)
}
