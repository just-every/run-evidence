import type { Bindings } from '../../auth.server'
import { Refusal } from '../upload'
import { auditStatement, text, type Actor, type Input } from '../door'
import { validDate } from '../model'
// FOLLOWUP-001 rules: a US business timezone, business days, holidays, quiet
// hours, repeat cadence and an escalation chain, plus the weekly digest
// schedule. Time is evaluated in the business timezone, so daylight-saving
// changes move UTC send times, never the local business hour.
export const usTimezones = ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Phoenix', 'America/Los_Angeles', 'America/Anchorage', 'Pacific/Honolulu'] as const
export interface Settings { timezone: string; calendar_enabled: number; business_days: string; holidays: string; quiet_start: string; quiet_end: string; digest_enabled: number; digest_day: number; digest_time: string; repeat_days: number; escalate_after_days: number; escalation_person_id: string | null; updated_by: string; updated_at: string }
export const defaults: Settings = { timezone: 'America/New_York', calendar_enabled: 0, business_days: '[1,2,3,4,5]', holidays: '[]', quiet_start: '18:00', quiet_end: '09:00', digest_enabled: 1, digest_day: 1, digest_time: '09:00', repeat_days: 0, escalate_after_days: 0, escalation_person_id: null, updated_by: 'default', updated_at: '' }
export const settings = async (env: Bindings) => (await env.DB.prepare('SELECT * FROM followup_settings WHERE singleton=1').first<Settings>()) ?? defaults
const hhmm = (value: unknown, label: string) => { if (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) throw new Refusal(`${label} must be a time like 09:00.`); return value }
export async function saveSettings(env: Bindings, actor: Actor, input: Input, now: Date) {
 const timezone = text(input, 'timezone', 60)
 if (!(usTimezones as readonly string[]).includes(timezone)) throw new Refusal('Choose a US business timezone.')
 const days = (Array.isArray(input.business_days) ? input.business_days : typeof input.business_days === 'string' ? input.business_days.split(',') : []).map(Number)
 if (!days.length || days.some(d => !Number.isInteger(d) || d < 0 || d > 6)) throw new Refusal('Choose at least one business day.')
 const holidays = String(input.holidays ?? '').split(/[\s,]+/).filter(Boolean)
 if (holidays.length > 60 || holidays.some(d => !validDate(d))) throw new Refusal('List holidays as dates like 2026-11-26.')
 const number = (key: string, max: number) => { const n = Number(input[key] ?? 0); if (!Number.isInteger(n) || n < 0 || n > max) throw new Refusal(`${key.replaceAll('_', ' ')} must be a whole number from 0 to ${max}.`); return n }
 const escalation = typeof input.escalation_person_id === 'string' && input.escalation_person_id ? input.escalation_person_id : null
 if (escalation && !await env.DB.prepare('SELECT 1 FROM people WHERE id=?').bind(escalation).first()) throw new Refusal('Choose the escalation contact from People.')
 const row: Settings = { timezone, calendar_enabled: input.calendar_enabled === 'on' || input.calendar_enabled === 'true' ? 1 : 0, business_days: JSON.stringify([...new Set(days)].sort()), holidays: JSON.stringify([...new Set(holidays)].sort()), quiet_start: hhmm(input.quiet_start ?? '18:00', 'Quiet hours start'), quiet_end: hhmm(input.quiet_end ?? '09:00', 'Quiet hours end'), digest_enabled: input.digest_enabled === 'off' || input.digest_enabled === 'false' ? 0 : 1, digest_day: number('digest_day', 6), digest_time: hhmm(input.digest_time ?? '09:00', 'Digest time'), repeat_days: number('repeat_days', 30), escalate_after_days: number('escalate_after_days', 60), escalation_person_id: escalation, updated_by: actor.name, updated_at: now.toISOString() }
 const columns = Object.keys(row)
 await env.DB.batch([
  env.DB.prepare(`INSERT INTO followup_settings(singleton,${columns.join(',')}) VALUES(1,${columns.map(() => '?').join(',')}) ON CONFLICT(singleton) DO UPDATE SET ${columns.map(c => `${c}=excluded.${c}`).join(',')}`).bind(...Object.values(row)),
  auditStatement(env, actor, 'followup.settings', 'followup-settings', now, 'succeeded', `${timezone}; calendar ${row.calendar_enabled ? 'on' : 'off'}; digest ${row.digest_enabled ? `day ${row.digest_day} ${row.digest_time}` : 'off'}`),
 ])
}
// The local calendar view of an instant in the business timezone.
export function local(now: Date, timezone: string) {
 const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23' }).formatToParts(now).map(p => [p.type, p.value]))
 return { date: `${parts.year}-${parts.month}-${parts.day}`, weekday: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday), minutes: Number(parts.hour) * 60 + Number(parts.minute) }
}
export const minutes = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5))
const shift = (date: string, days: number) => new Date(Date.parse(date + 'T12:00:00Z') + days * 86400000).toISOString().slice(0, 10)
// This week's digest: its anchor is the latest digest weekday; with the calendar
// on, a holiday or non-business day moves it to the next business day.
export function digestDue(s: Settings, now: Date) {
 const l = local(now, s.timezone), back = (l.weekday - s.digest_day + 7) % 7, anchor = shift(l.date, -back), days = JSON.parse(s.business_days) as number[], holidays = JSON.parse(s.holidays) as string[]
 let day = anchor, weekday = s.digest_day
 for (let i = 0; s.calendar_enabled && i < 7 && (!days.includes(weekday) || holidays.includes(day)); i++) { day = shift(day, 1); weekday = (weekday + 1) % 7 }
 return day === l.date && l.minutes >= minutes(s.digest_time) ? anchor : null
}
// Scheduled reminders wait for a business day outside quiet hours, when the calendar is on.
export function inBusinessWindow(s: Settings, now: Date) {
 if (!s.calendar_enabled) return true
 const l = local(now, s.timezone), start = minutes(s.quiet_start), end = minutes(s.quiet_end)
 if (!(JSON.parse(s.business_days) as number[]).includes(l.weekday) || (JSON.parse(s.holidays) as string[]).includes(l.date)) return false
 const quiet = start === end ? false : start > end ? l.minutes >= start || l.minutes < end : l.minutes >= start && l.minutes < end
 return !quiet
}
export const pausedSubjects = async (env: Bindings) => new Set((await env.DB.prepare('SELECT subject_id FROM followup_pauses WHERE resumed_at IS NULL').all<{ subject_id: string }>()).results.map(r => r.subject_id))
export async function pause(env: Bindings, actor: Actor, subject: string, reason: string, now: Date) {
 const done = await env.DB.prepare('INSERT INTO followup_pauses(id,subject_id,reason,paused_by,paused_at) VALUES(?,?,?,?,?) ON CONFLICT DO NOTHING').bind(crypto.randomUUID(), subject, reason, actor.name, now.toISOString()).run()
 if (!done.meta.changes) throw new Refusal('Follow-ups are already paused here.', 409)
 await auditStatement(env, actor, 'followup.paused', subject, now, 'succeeded', reason, { reason }).run()
}
export async function resume(env: Bindings, actor: Actor, subject: string, now: Date) {
 const done = await env.DB.prepare('UPDATE followup_pauses SET resumed_by=?,resumed_at=? WHERE subject_id=? AND resumed_at IS NULL').bind(actor.name, now.toISOString(), subject).run()
 if (!done.meta.changes) throw new Refusal('Follow-ups are not paused here.', 409)
 await auditStatement(env, actor, 'followup.resumed', subject, now).run()
}
