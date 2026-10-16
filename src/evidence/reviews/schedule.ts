import type { Bindings } from '../../auth.server'
import { Refusal } from '../upload'
import { auditStatement, oneOf, text, type Actor, type Input } from '../door'
import { day, validDate } from '../model'
import { addMonths, anchoredPeriod, months, type Schedule } from '../cadence'
import { requirePerson } from '../program/people'
import { requireProgram } from '../program/storage'
import { sendFollowup, sent } from '../followup/send'
// CADENCE-001 for policy and vendor reviews. The default is an annual review
// from the date of the last review (a policy's effective date, or a recorded
// review). Due soon begins at the owner's lead or the final 20% of the cycle.
export type Kind = 'policy' | 'vendor'
export interface ReviewSchedule { id: string | null; cadence: 'semi-annual' | 'annual'; anchor: 'effective-date' | 'fiscal-year' | 'audit-window'; fiscal_start_month: number | null; window_start: string | null; reminder_lead_days: number | null; owner_person_id: string | null; effective_from: string; reason: string; actor_name: string }
export interface ReviewState { state: 'covered' | 'due soon' | 'due' | 'overdue' | 'never reviewed'; due: string | null; last_review: string | null; period: { from: string; to: string } | null; schedule: ReviewSchedule; override: { due_date: string; reason: string } | null }
const defaultSchedule: ReviewSchedule = { id: null, cadence: 'annual', anchor: 'effective-date', fiscal_start_month: null, window_start: null, reminder_lead_days: null, owner_person_id: null, effective_from: '', reason: 'default', actor_name: 'Evidence' }
const DAY = 86400000
const asSchedule = (s: ReviewSchedule): Schedule => ({ cadence: s.cadence, anchor: s.anchor, fiscal_start_month: s.fiscal_start_month, window_start: s.window_start, reminder_lead_days: s.reminder_lead_days, owner_person_id: s.owner_person_id, effective_from: s.effective_from, revision_id: s.id })
const leadStart = (start: number, deadline: number, lead: number | null) => lead ? deadline - lead * DAY : deadline - (deadline - start) * 0.2
// The state of one subject's review at an instant, from its schedule history, reviews and overrides.
export function reviewState(schedules: ReviewSchedule[], reviews: string[], overrides: { cycle_due: string; due_date: string; reason: string }[], now: Date): ReviewState {
 const at = now.getTime(), schedule = schedules.filter(s => Date.parse(s.effective_from) <= at).at(-1) ?? defaultSchedule
 const done = reviews.filter(r => r <= day(now)).sort(), last = done.at(-1) ?? null
 if (schedule.anchor === 'effective-date') {
  if (!last) return { state: 'never reviewed', due: null, last_review: null, period: null, schedule, override: null }
  const start = Date.parse(last + 'T00:00:00Z'), computed = day(addMonths(new Date(start), months(schedule.cadence))), override = overrides.filter(o => o.cycle_due === computed).at(-1) ?? null
  const deadline = Date.parse((override?.due_date ?? computed) + 'T00:00:00Z')
  return { state: at >= deadline ? 'overdue' : at >= leadStart(start, deadline, schedule.reminder_lead_days) ? 'due soon' : 'covered', due: day(new Date(deadline)), last_review: last, period: { from: last, to: day(new Date(deadline - 1)) }, schedule, override: override ? { due_date: override.due_date, reason: override.reason } : null }
 }
 // Fiscal-year and audit-window cycles: one review inside each window.
 const window = anchoredPeriod(asSchedule(schedule), day(now)), prior = anchoredPeriod(asSchedule(schedule), day(new Date(window.start - DAY)))
 const inWindow = done.some(r => r >= window.from && r <= window.to), missedPrior = prior.start >= Date.parse(schedule.effective_from) && !done.some(r => r >= prior.from && r <= prior.to)
 const state = inWindow ? 'covered' : missedPrior ? 'overdue' : at >= leadStart(window.start, window.deadline, schedule.reminder_lead_days) ? 'due soon' : 'due'
 return { state, due: day(new Date(window.deadline)), last_review: last, period: { from: window.from, to: window.to }, schedule, override: null }
}
export async function subjects(env: Bindings) {
 const policies = (await env.DB.prepare("SELECT p.id,p.title AS name,p.owner_person_id,(SELECT effective_date FROM policy_revisions r WHERE r.policy_id=p.id AND r.status IN ('published','superseded') ORDER BY r.version DESC LIMIT 1) AS effective FROM policies p ORDER BY p.title").all<{ id: string; name: string; owner_person_id: string | null; effective: string | null }>()).results
 const vendors = (await env.DB.prepare('SELECT id,name,owner_person_id,review_due FROM vendors ORDER BY name').all<{ id: string; name: string; owner_person_id: string | null; review_due: string | null }>()).results
 return [...policies.map(p => ({ kind: 'policy' as const, id: p.id, name: p.name, owner_person_id: p.owner_person_id, implicit: p.effective ? [p.effective] : [] })), ...vendors.map(v => ({ kind: 'vendor' as const, id: v.id, name: v.name, owner_person_id: v.owner_person_id, implicit: [] as string[] }))]
}
// Every policy and vendor with its review state now.
export async function reviewStates(env: Bindings, now: Date) {
 const [schedules, reviews, overrides] = await Promise.all([
  env.DB.prepare('SELECT * FROM review_schedules ORDER BY effective_from,rowid').all<ReviewSchedule & { subject_kind: string; subject_id: string }>(),
  env.DB.prepare('SELECT subject_kind,subject_id,completed_on FROM review_completions').all<{ subject_kind: string; subject_id: string; completed_on: string }>(),
  env.DB.prepare('SELECT subject_kind,subject_id,cycle_due,due_date,reason FROM review_overrides ORDER BY at,rowid').all<{ subject_kind: string; subject_id: string; cycle_due: string; due_date: string; reason: string }>(),
 ])
 const of = <T extends { subject_kind: string; subject_id: string }>(rows: T[], kind: string, id: string) => rows.filter(r => r.subject_kind === kind && r.subject_id === id)
 return (await subjects(env)).map(s => ({ ...s, history: of(schedules.results, s.kind, s.id), review: reviewState(of(schedules.results, s.kind, s.id), [...s.implicit, ...of(reviews.results, s.kind, s.id).map(r => r.completed_on)], of(overrides.results, s.kind, s.id), now) }))
}
async function requireSubject(env: Bindings, kind: Kind, id: string) { const row = await env.DB.prepare(`SELECT id FROM ${kind === 'policy' ? 'policies' : 'vendors'} WHERE id=?`).bind(id).first(); if (!row) throw new Refusal(kind === 'policy' ? 'Policy not found.' : 'Vendor not found.', 404) }
// A schedule revision applies from now on; earlier cycles keep the schedule they ran under.
export async function scheduleReview(env: Bindings, actor: Actor, kind: Kind, id: string, input: Input, now: Date) {
 await requireSubject(env, kind, id)
 const cadence = oneOf(input, 'cadence', ['semi-annual', 'annual'] as const), anchor = oneOf(input, 'anchor', ['effective-date', 'fiscal-year', 'audit-window'] as const), reason = text(input, 'reason', 500)
 let month: number | null = null, windowStart: string | null = null, program: string | null = null
 if (anchor === 'fiscal-year') { month = Number(input.fiscal_start_month); if (!Number.isInteger(month) || month < 1 || month > 12) throw new Refusal('Choose the fiscal year start month (1-12).') }
 if (anchor === 'audit-window') {
  if (typeof input.program_id === 'string' && input.program_id) { const p = await requireProgram(env, input.program_id); program = p.id; windowStart = p.audit_from }
  else if (validDate(input.window_start)) windowStart = input.window_start as string
  else throw new Refusal('Choose a program audit window or a window start date.')
 }
 const lead = input.reminder_lead_days ? Number(input.reminder_lead_days) : null
 if (lead !== null && (!Number.isInteger(lead) || lead < 1 || lead > 365)) throw new Refusal('The reminder lead is 1 to 365 days.')
 const owner = input.owner_person_id ? (await requirePerson(env, input.owner_person_id, 'review owner')).id : null
 await env.DB.batch([
  env.DB.prepare('INSERT INTO review_schedules(id,subject_kind,subject_id,cadence,anchor,fiscal_start_month,window_start,program_id,reminder_lead_days,owner_person_id,effective_from,actor_id,actor_name,reason) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(), kind, id, cadence, anchor, month, windowStart, program, lead, owner, now.toISOString(), actor.id, actor.name, reason),
  auditStatement(env, actor, kind + '.review-scheduled', `${kind}:${id}`, now, 'succeeded', `${cadence} ${anchor}: ${reason}`),
 ])
}
export async function completeReview(env: Bindings, actor: Actor, kind: Kind, id: string, input: Input, now: Date) {
 await requireSubject(env, kind, id)
 const on = text(input, 'completed_on', 10)
 if (!validDate(on) || on > day(now)) throw new Refusal('The review date must be a real date, today or earlier.')
 await env.DB.batch([env.DB.prepare('INSERT INTO review_completions(id,subject_kind,subject_id,completed_on,notes,recorded_by,recorded_at) VALUES(?,?,?,?,?,?,?)').bind(crypto.randomUUID(), kind, id, on, text(input, 'notes', 1000), actor.name, now.toISOString()), auditStatement(env, actor, kind + '.reviewed', `${kind}:${id}`, now, 'succeeded', on)])
}
// A one-off date moves the current effective-date cycle only; the next cycle returns to the anchor.
export async function overrideReview(env: Bindings, actor: Actor, kind: Kind, id: string, input: Input, now: Date) {
 const current = (await reviewStates(env, now)).find(s => s.kind === kind && s.id === id)
 if (!current) throw new Refusal('Not found.', 404)
 if (current.review.schedule.anchor !== 'effective-date' || !current.review.due) throw new Refusal('One-off review dates apply to reviews anchored to the last review date.', 409)
 const due = text(input, 'due_date', 10)
 if (!validDate(due)) throw new Refusal('Choose a real review date.')
 const cycle = day(addMonths(new Date(Date.parse(current.review.last_review! + 'T00:00:00Z')), months(current.review.schedule.cadence)))
 await env.DB.batch([env.DB.prepare('INSERT INTO review_overrides(id,subject_kind,subject_id,cycle_due,due_date,reason,actor_name,at) VALUES(?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(), kind, id, cycle, due, text(input, 'reason', 500), actor.name, now.toISOString()), auditStatement(env, actor, kind + '.review-date', `${kind}:${id}`, now, 'succeeded', `${cycle} -> ${due}`)])
}
// Reminders at the lead and at the deadline, to the review owner, once per cycle.
export async function reviewReminders(env: Bindings, now: Date) {
 let count = 0
 for (const s of await reviewStates(env, now)) {
  if (!['due soon', 'overdue'].includes(s.review.state) || !s.review.due) continue
  const ownerId = s.review.schedule.owner_person_id ?? s.owner_person_id, email = ownerId ? (await env.DB.prepare('SELECT email FROM people WHERE id=?').bind(ownerId).first<{ email: string }>())?.email : null
  const overdue = s.review.state === 'overdue', link = `${env.AUTH_ORIGIN}/app/reviews`
  if (sent(await sendFollowup(env, { kind: overdue ? 'review-deadline' : 'review-lead', subject: `${s.kind}:${s.id}`, cycle: s.review.due, recipient: email ?? env.OWNER_EMAIL, title: `${overdue ? 'Review overdue' : 'Review due soon'}: ${s.name}`, text: `The ${s.kind} review of ${s.name} ${overdue ? 'was' : 'is'} due ${s.review.due} (${s.review.schedule.cadence}, ${s.review.schedule.anchor} anchor).\n\nRecord the review in Evidence: ${link}`, link }, now))) count++
 }
 return count
}
