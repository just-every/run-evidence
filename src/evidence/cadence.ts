import { day, gapIn, period, type Cadence, type Gap, type Receipt } from './model'
// CADENCE-001 renewal periods. The four GAP-001 calendar periods are untouched:
// a calendar anchor on daily, weekly, monthly or quarterly uses period().
export type Anchor = 'calendar' | 'effective-date' | 'fiscal-year' | 'audit-window'
export const anchors: readonly Anchor[] = ['calendar', 'effective-date', 'fiscal-year', 'audit-window']
export interface Schedule { cadence: Cadence; anchor: Anchor; fiscal_start_month: number | null; window_start: string | null; reminder_lead_days: number | null; owner_person_id: string | null; effective_from: string; revision_id: string | null }
export interface ScheduleRow extends Omit<Schedule, 'revision_id'> { id: string; requirement_id: string; program_id: string | null; actor_name: string; reason: string }
export const renewalCadences: readonly Cadence[] = ['semi-annual', 'annual']
export const months = (cadence: Cadence) => cadence === 'annual' ? 12 : cadence === 'semi-annual' ? 6 : cadence === 'quarterly' ? 3 : 1
export const addMonths = (date: Date, count: number) => { const d = new Date(date); const dayOfMonth = d.getUTCDate(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + count); d.setUTCDate(Math.min(dayOfMonth, new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate())); return d }

// The schedule in force at an instant: the latest revision effective by then,
// otherwise the requirement's own cadence (renewals default to effective date).
export function scheduleAt(cadence: Cadence, rows: ScheduleRow[], at: number): Schedule {
 const row = rows.filter(r => Date.parse(r.effective_from) <= at).sort((a, b) => a.effective_from.localeCompare(b.effective_from)).at(-1)
 if (row) return { cadence: row.cadence, anchor: row.anchor, fiscal_start_month: row.fiscal_start_month, window_start: row.window_start, reminder_lead_days: row.reminder_lead_days, owner_person_id: row.owner_person_id, effective_from: row.effective_from, revision_id: row.id }
 return { cadence, anchor: renewalCadences.includes(cadence) ? 'effective-date' : 'calendar', fiscal_start_month: null, window_start: null, reminder_lead_days: null, owner_person_id: null, effective_from: '', revision_id: null }
}
// The anchored period containing the selected date: calendar halves and years,
// fiscal years from their start month, or audit windows from their start day.
export function anchoredPeriod(schedule: Schedule, selected: string) {
 if (schedule.anchor === 'calendar') return period(schedule.cadence, selected)
 const length = months(schedule.cadence), at = new Date(selected + 'T00:00:00Z')
 const anchorMonth = schedule.anchor === 'fiscal-year' ? (schedule.fiscal_start_month ?? 1) - 1 : schedule.anchor === 'audit-window' && schedule.window_start ? Number(schedule.window_start.slice(5, 7)) - 1 : 0
 const anchorDay = schedule.anchor === 'audit-window' && schedule.window_start ? Number(schedule.window_start.slice(8, 10)) : 1
 let start = new Date(Date.UTC(at.getUTCFullYear() - 1, anchorMonth, anchorDay))
 while (addMonths(start, length).getTime() <= at.getTime()) start = addMonths(start, length)
 const end = addMonths(start, length)
 return { from: day(start), to: day(new Date(end.getTime() - 1)), deadline: end.getTime(), start: start.getTime() }
}
export interface Renewal { expired_on: string | null; gap: Gap; due: string | null; anchor: Anchor; cadence: Cadence; period: { from: string; to: string } | null; lead_starts: string | null; effective_date: string | null; override: { due_date: string; reason: string; actor_name: string } | null; schedule_revision: string | null }
export interface Override { cycle_due: string; due_date: string; reason: string; actor_name: string }
// Requirement state at a selected date. Effective-date renewals run from the
// latest current receipt's owner-asserted effective date, not its upload time.
export function renewal(schedule: Schedule, selected: string, receipts: (Receipt & { effective_date?: string | null })[], overrides: Override[], now: Date): Renewal {
 const base = { expired_on: null, anchor: schedule.anchor, cadence: schedule.cadence, override: null, schedule_revision: schedule.revision_id }
 if (schedule.anchor !== 'effective-date') {
  const window = anchoredPeriod(schedule, selected), gap = gapIn(window, selected, receipts, now, schedule.reminder_lead_days)
  // An expired prior exhibit makes today's missing proof overdue at its expiry,
  // while a historical selection keeps the deadline of its own period.
  const expired = gap === 'overdue' && selected === day(now) && now.getTime() < window.deadline
   ? receipts.filter(r => !r.superseded_by).map(r => Date.parse(r.covered_to + 'T00:00:00Z') + 86400000).filter(at => at <= now.getTime()).sort((a,b) => a-b).at(-1)
   : undefined
  const deadline = expired ?? window.deadline, prior = expired === undefined ? window : anchoredPeriod(schedule, day(new Date(expired - 1)))
  return { ...base, gap, expired_on: expired === undefined ? null : day(new Date(expired)), due: day(new Date(deadline)), period: { from: window.from, to: window.to }, lead_starts: leadStart(prior.start, deadline, schedule.reminder_lead_days), effective_date: null }
 }
 const instant = selected === day(now) ? now.getTime() : Math.min(now.getTime(), Date.parse(selected + 'T00:00:00Z') + 86400000 - 1)
 const own = receipts.filter(r => r.origin !== 'imported')
 const current = own.filter(r => !r.superseded_by)
 const dated = current.map(r => ({ r, effective: r.effective_date ?? r.covered_from })).filter(x => x.effective <= selected).sort((a, b) => a.effective.localeCompare(b.effective))
 if (dated.some(x => !x.r.available)) return { ...base, gap: 'unavailable bytes', due: null, period: null, lead_starts: null, effective_date: null }
 const latest = dated.at(-1)
 if (!latest) {
  const gap: Gap = own.length && !current.length ? 'superseded-only' : 'missing'
  return { ...base, gap, due: null, period: null, lead_starts: null, effective_date: null }
 }
 const start = Date.parse(latest.effective + 'T00:00:00Z'), computed = addMonths(new Date(start), months(schedule.cadence))
 const override = overrides.filter(o => o.cycle_due === day(computed)).at(-1) ?? null
 const deadline = override ? Date.parse(override.due_date + 'T00:00:00Z') : computed.getTime()
 const lead = leadStart(start, deadline, schedule.reminder_lead_days)
 const gap: Gap = instant >= deadline ? 'overdue' : instant >= Date.parse(lead + 'T00:00:00Z') ? 'due soon' : 'covered'
 return { ...base, gap, due: day(new Date(deadline)), period: { from: latest.effective, to: day(new Date(deadline - 1)) }, lead_starts: lead, effective_date: latest.effective, override: override ? { due_date: override.due_date, reason: override.reason, actor_name: override.actor_name } : null }
}
// Due soon begins at the owner's lead in days, or the final 20% of the period.
function leadStart(start: number, deadline: number, leadDays: number | null) {
 return day(new Date(leadDays ? deadline - leadDays * 86400000 : deadline - (deadline - start) * 0.2))
}
