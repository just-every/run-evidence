import type { Bindings } from '../../auth.server'
import { cadences, day, validDate, type Cadence } from '../model'
import { Refusal } from '../upload'
import { auditStatement, oneOf, text, type Actor, type Input } from '../door'
import { anchors, renewal, renewalCadences, scheduleAt, type ScheduleRow } from '../cadence'
import { history } from '../storage'
import { requirePerson } from './people'
import { requireProgram } from './storage'
// CADENCE-001: a schedule revision applies from now on; earlier periods keep the
// definition they were evaluated under.
export async function scheduleRequirement(env: Bindings, actor: Actor, id: string, input: Input, now: Date) {
 const requirement = await env.DB.prepare('SELECT id FROM requirements WHERE id=?').bind(id).first()
 if (!requirement) throw new Refusal('Requirement not found.', 404)
 const cadence = oneOf(input, 'cadence', cadences) as Cadence, anchor = oneOf(input, 'anchor', anchors), reason = text(input, 'reason', 500)
 if (!renewalCadences.includes(cadence) && anchor !== 'calendar') throw new Refusal('Daily, weekly, monthly and quarterly proof keeps its calendar periods.')
 let month: number | null = null, windowStart: string | null = null, program: string | null = null
 if (anchor === 'fiscal-year') { month = Number(input.fiscal_start_month); if (!Number.isInteger(month) || month < 1 || month > 12) throw new Refusal('Choose the fiscal year start month (1-12).') }
 if (anchor === 'audit-window') {
  if (typeof input.program_id === 'string' && input.program_id) { const row = await requireProgram(env, input.program_id); program = row.id; windowStart = row.audit_from }
  else if (validDate(input.window_start)) windowStart = input.window_start as string
  else throw new Refusal('Choose a program audit window or a window start date.')
 }
 const lead = input.reminder_lead_days ? Number(input.reminder_lead_days) : null
 if (lead !== null && (!Number.isInteger(lead) || lead < 1 || lead > 365)) throw new Refusal('The reminder lead is 1 to 365 days.')
 const owner = input.owner_person_id ? (await requirePerson(env, input.owner_person_id, 'requirement owner')).id : null
 await env.DB.batch([
  env.DB.prepare('INSERT INTO requirement_schedules(id,requirement_id,cadence,anchor,fiscal_start_month,window_start,program_id,reminder_lead_days,owner_person_id,effective_from,actor_id,actor_name,reason) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(), id, cadence, anchor, month, windowStart, program, lead, owner, now.toISOString(), actor.id, actor.name, reason),
  auditStatement(env, actor, 'requirement.scheduled', 'requirement:' + id, now, 'succeeded', `${cadence} ${anchor}: ${reason}`, { reason }),
 ])
}
// A one-off renewal date moves only the current cycle's deadline.
export async function overrideRenewal(env: Bindings, actor: Actor, id: string, input: Input, now: Date) {
 const requirement = await env.DB.prepare('SELECT id,cadence FROM requirements WHERE id=?').bind(id).first<{ id: string; cadence: Cadence }>()
 if (!requirement) throw new Refusal('Requirement not found.', 404)
 const due = text(input, 'due_date', 10), reason = text(input, 'reason', 500)
 if (!validDate(due)) throw new Refusal('Choose a real renewal date.')
 const schedules = (await env.DB.prepare('SELECT * FROM requirement_schedules WHERE requirement_id=?').bind(id).all<ScheduleRow>()).results
 const schedule = scheduleAt(requirement.cadence, schedules, now.getTime())
 if (schedule.anchor !== 'effective-date') throw new Refusal('One-off renewal dates apply to effective-date renewals.')
 const state = renewal(schedule, day(now), await history(env, id), [], now)
 if (!state.due) throw new Refusal('There is no current cycle to move; upload proof with an effective date first.', 409)
 await env.DB.batch([
  env.DB.prepare('INSERT INTO renewal_overrides(id,requirement_id,cycle_due,due_date,reason,actor_id,actor_name,at) VALUES(?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(), id, state.due, due, reason, actor.id, actor.name, now.toISOString()),
  auditStatement(env, actor, 'requirement.renewal-date', 'requirement:' + id, now, 'succeeded', `${state.due} -> ${due}: ${reason}`, { reason }),
 ])
}
