import { capabilityAllowed } from '../archive/capabilities'
import type { Bindings } from '../../auth.server'
import { Refusal } from '../upload'
import { auditStatement, oneOf, text, type Actor, type Input } from '../door'
import { validDate } from '../model'
import { addMonths } from '../cadence'
import { upsertRegister } from '../resources'
import { catalogueStatements } from '../tests/storage'
import { runForType } from '../tests/engine'
import { sendFollowup, sent } from '../followup/send'
import { settings } from '../followup/settings'
import { course, courses, grade, type Course } from './courses'
// TRAIN-001: shipped courses unlock with the programs and roles they serve,
// campaigns assign them at onboarding and on a recurring schedule, and only a
// passed assessment, an approved internal course or a source-reported KnowBe4
// completion completes an assignment. Every attempt is kept.
const DAY = 86400000
const today = (now: Date) => now.toISOString().slice(0, 10)
const plusDays = (iso: string, days: number) => new Date(Date.parse(iso) + days * DAY).toISOString().slice(0, 10)
// HIPAA training needs a HIPAA program; secure coding needs a SOC 2 or ISO 27001 program and engineering roles.
export async function availability(env: Bindings) {
 const frameworks = new Set((await env.DB.prepare('SELECT framework FROM programs').all<{ framework: string }>()).results.map(r => r.framework))
 const adopted = new Map((await env.DB.prepare('SELECT course_id,MAX(revision) AS revision FROM training_adoptions GROUP BY course_id').all<{ course_id: string; revision: number }>()).results.map(r => [r.course_id, r.revision]))
 return courses.map(c => ({ id: c.id, title: c.title, audience: c.audience, shipped_revision: c.revision, adopted_revision: adopted.get(c.id) ?? null, minutes: c.minutes, lessons: c.lessons.length, questions: c.quiz.length, pass_mark: c.passMark, available: c.audience === 'everyone' || (c.audience === 'hipaa' && frameworks.has('hipaa')) || (c.audience === 'engineering' && (frameworks.has('soc2') || frameworks.has('iso27001'))), unlock: c.audience === 'hipaa' ? 'a HIPAA program' : c.audience === 'engineering' ? 'a SOC 2 or ISO 27001 program, for engineering roles' : 'always' }))
}
// A shipped revision applies only after an owner reviews and adopts it.
export async function adopt(env: Bindings, actor: Actor, courseId: string, now: Date, revision?: unknown) {
 const selected = revision === undefined ? undefined : revisionNumber(revision)
 if (selected !== undefined && !course(courseId, selected)) throw new Refusal('Course revision not found.', 404)
 const c = course(courseId, selected); if (!c) throw new Refusal('Course not found.', 404)
 await env.DB.batch([env.DB.prepare('INSERT INTO training_adoptions(course_id,revision,adopted_by,adopted_at) VALUES(?,?,?,?) ON CONFLICT DO NOTHING').bind(c.id, c.revision, actor.name, now.toISOString()), auditStatement(env, actor, 'training.adopted', 'course:' + c.id, now, 'succeeded', `revision ${c.revision}`, { revision: c.revision })])
}
export async function createCampaign(env: Bindings, actor: Actor, input: Input, now: Date) {
 const courseId = text(input, 'course_id', 60), avail = (await availability(env)).find(c => c.id === courseId)
 if (!avail) throw new Refusal('Choose a shipped course.')
 if (!avail.available) throw new Refusal(`${avail.title} unlocks with ${avail.unlock}.`, 409)
 if (!avail.adopted_revision) throw new Refusal(`Review and adopt ${avail.title} revision ${avail.shipped_revision} first.`, 409)
 const audience = oneOf(input, 'audience', ['everyone', 'employees', 'contractors', 'engineering'] as const)
 if (avail.audience === 'engineering' && audience !== 'engineering') throw new Refusal('Secure coding is assigned to engineering roles.')
 const kind = oneOf(input, 'kind', ['onboarding', 'recurring'] as const), due = Number(input.due_days ?? 30), interval = Number(input.interval_months ?? 12)
 if (!Number.isInteger(due) || due < 1 || due > 365 || !Number.isInteger(interval) || interval < 1 || interval > 36) throw new Refusal('Due days are 1 to 365 and the interval 1 to 36 months.')
 const id = crypto.randomUUID()
 await env.DB.batch([
  env.DB.prepare('INSERT INTO training_campaigns(id,name,course_id,kind,audience,due_days,interval_months,created_by,created_name,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(id, text(input, 'name', 200), courseId, kind, audience, due, interval, actor.id, actor.name, now.toISOString()),
  auditStatement(env, actor, 'training.campaign', 'training-campaign:' + id, now, 'succeeded', `${kind} ${courseId} for ${audience}`),
  ...await catalogueStatements(env, 'training', actor, now),
 ])
 await trainingWork(env, now)
 return { id }
}
// Changing the schedule applies to open assignments and later cycles, and is recorded.
export async function amendSchedule(env: Bindings, actor: Actor, id: string, input: Input, now: Date) {
 const campaign = await env.DB.prepare('SELECT * FROM training_campaigns WHERE id=?').bind(id).first<{ id: string; due_days: number; interval_months: number }>()
 if (!campaign) throw new Refusal('Campaign not found.', 404)
 const due = Number(input.due_days ?? campaign.due_days), interval = Number(input.interval_months ?? campaign.interval_months), reason = text(input, 'reason', 500)
 if (!Number.isInteger(due) || due < 1 || due > 365 || !Number.isInteger(interval) || interval < 1 || interval > 36) throw new Refusal('Due days are 1 to 365 and the interval 1 to 36 months.')
 await env.DB.batch([
  env.DB.prepare('INSERT INTO training_schedule_changes(id,campaign_id,due_days,interval_months,reason,actor_name,at) VALUES(?,?,?,?,?,?,?)').bind(crypto.randomUUID(), id, due, interval, reason, actor.name, now.toISOString()),
  env.DB.prepare("UPDATE training_assignments SET due_date=date(assigned_at, '+' || ? || ' days') WHERE campaign_id=? AND state='assigned'").bind(due, id),
  auditStatement(env, actor, 'training.schedule-changed', 'training-campaign:' + id, now, 'succeeded', `${due} days, every ${interval} months: ${reason}`, { reason }),
 ])
}
const schedule = async (env: Bindings, c: { id: string; due_days: number; interval_months: number }) => (await env.DB.prepare('SELECT due_days,interval_months FROM training_schedule_changes WHERE campaign_id=? ORDER BY at DESC,rowid DESC LIMIT 1').bind(c.id).first<{ due_days: number; interval_months: number }>()) ?? c
function revisionNumber(value: unknown): number {
 if ((typeof value !== 'number' && (typeof value !== 'string' || !/^[1-9][0-9]*$/.test(value))) || !Number.isSafeInteger(Number(value)) || Number(value) < 1) throw new Refusal('Choose a known course revision.')
 return Number(value)
}
// Resolve the exact assignment curriculum; open assignments take priority.
export async function assignedCourse(env: Bindings, person: string, courseId: string, revision?: unknown, includeCompleted = false) {
 const selected = revision === undefined ? null : revisionNumber(revision)
 const assignment = await env.DB.prepare(`SELECT revision FROM training_assignments WHERE person_id=? AND course_id=? AND state ${includeCompleted ? "IN ('assigned','completed')" : "= 'assigned'"} AND (? IS NULL OR revision=?) ORDER BY state='assigned' DESC,assigned_at,revision,id LIMIT 1`).bind(person, courseId, selected, selected).first<{ revision: number }>()
 const c = assignment && course(courseId, assignment.revision)
 if (!c) throw new Refusal('This course revision is not assigned to you.', 404)
 return c
}
// External and approved internal completions can replace a course; native passes settle only their assessed revision.
async function settle(env: Bindings, person: string, courseId: string, completion: string, at: string, revision: number | null = null) {
 await env.DB.prepare("UPDATE training_assignments SET state='completed',completed_at=?,completion_id=? WHERE person_id=? AND course_id=? AND state='assigned' AND assigned_at<=? AND (? IS NULL OR revision=?)").bind(at, completion, person, courseId, at, revision, revision).run()
}
export async function attempt(env: Bindings, person: { id: string; email: string }, courseId: string, input: Input, now: Date) {
 const c = await assignedCourse(env, person.id, courseId, input.revision)
 const submitted = input.answers === undefined ? c.quiz.map((_, i) => input[`answers[${i}]`]) : Array.isArray(input.answers) ? input.answers : input.answers.split(',')
 // Missing, repeated and blank answers must never become the numeric answer zero.
 if (submitted.length !== c.quiz.length || submitted.some(a => typeof a !== 'string' || !/^[0-3]$/.test(a))) throw new Refusal('Answer every question.')
 const answers = submitted.map(Number), result = grade(c, answers)
 if (!result) throw new Refusal('Answer every question.')
 const id = crypto.randomUUID(), at = now.toISOString()
 const statements = [env.DB.prepare('INSERT INTO training_attempts(id,person_id,course_id,revision,answers_json,score,passed,operator_email,at) VALUES(?,?,?,?,?,?,?,?,?)').bind(id, person.id, c.id, c.revision, JSON.stringify(answers), result.score, result.passed ? 1 : 0, person.email, at)]
 const completion = crypto.randomUUID()
 if (result.passed) statements.push(env.DB.prepare("INSERT INTO training_completions(id,person_id,course_id,course_title,revision,source,provenance,score,attempt_id,recorded_by,completed_at,recorded_at) VALUES(?,?,?,?,?,'evidence','assessment graded in Evidence',?,?,?,?,?)").bind(completion, person.id, c.id, c.title, c.revision, result.score, id, person.email, at, at))
 await env.DB.batch(statements)
 if (result.passed) await settle(env, person.id, c.id, completion, at, c.revision)
 await syncTraining(env, now)
 return { ...result, attempt: id }
}
// Approved internal training: manual provenance, recorded by an owner.
export async function approveInternal(env: Bindings, actor: Actor, input: Input, now: Date) {
 const countsAs = typeof input.counts_as === 'string' && input.counts_as ? input.counts_as : null
 if (countsAs && !course(countsAs)) throw new Refusal('Choose a shipped course it replaces, or none.')
 const id = crypto.randomUUID()
 await env.DB.batch([env.DB.prepare('INSERT INTO internal_courses(id,title,description,counts_as,approved_by,approved_at) VALUES(?,?,?,?,?,?)').bind(id, text(input, 'title', 200), text(input, 'description', 2000), countsAs, actor.name, now.toISOString()), auditStatement(env, actor, 'training.internal-approved', 'internal-course:' + id, now)])
 return { id }
}
export async function recordInternal(env: Bindings, actor: Actor, internalId: string, input: Input, now: Date) {
 const ic = await env.DB.prepare('SELECT * FROM internal_courses WHERE id=?').bind(internalId).first<{ id: string; title: string; counts_as: string | null }>()
 if (!ic) throw new Refusal('Internal course not found.', 404)
 const person = String(input.person_id ?? ''), on = text(input, 'completed_on', 10)
 if (!await env.DB.prepare('SELECT 1 FROM people WHERE id=?').bind(person).first()) throw new Refusal('Choose a person from People.')
 if (!validDate(on) || on > today(now)) throw new Refusal('The completion date must be today or earlier.')
 const id = crypto.randomUUID(), at = on + 'T12:00:00.000Z'
 await env.DB.batch([env.DB.prepare("INSERT INTO training_completions(id,person_id,course_id,course_title,revision,source,provenance,score,attempt_id,external_ref,recorded_by,completed_at,recorded_at) VALUES(?,?,?,?,NULL,'internal',?,NULL,NULL,NULL,?,?,?)").bind(id, person, ic.counts_as, ic.title, `manual: approved internal course recorded by ${actor.name}`, actor.name, at, now.toISOString()), auditStatement(env, actor, 'training.internal-recorded', 'person:' + person, now, 'succeeded', ic.title)])
 if (ic.counts_as) await settle(env, person, ic.counts_as, id, at)
 await syncTraining(env, now)
}
// KnowBe4 completions arrive source-reported, mapped to a shipped course by module name.
export async function importKnowBe4(env: Bindings, rows: { enrollment_id: string; module: string; email: string; completed: string; status: string }[], moduleMap: Record<string, string>, connection: string, now: Date) {
 let added = 0
 for (const r of rows) {
  const person = await env.DB.prepare('SELECT id FROM people WHERE email=?').bind(r.email.toLowerCase()).first<{ id: string }>()
  if (!person) continue
  const courseId = moduleMap[r.module.toLowerCase()] ?? null, id = crypto.randomUUID()
  const done = await env.DB.prepare("INSERT INTO training_completions(id,person_id,course_id,course_title,revision,source,provenance,score,attempt_id,external_ref,recorded_by,completed_at,recorded_at) VALUES(?,?,?,?,NULL,'knowbe4',?,NULL,NULL,?,?,?,?) ON CONFLICT DO NOTHING").bind(id, person.id, courseId, r.module, `source-reported by KnowBe4 (${r.status})`, `${connection}:${r.enrollment_id}`, 'KnowBe4', r.completed, now.toISOString()).run()
  if (done.meta.changes) { added++; if (courseId) await settle(env, person.id, courseId, id, r.completed) }
 }
 await syncTraining(env, now)
 return added
}
// Scheduler work: onboarding and recurring assignments, reminders and escalation.
export async function trainingWork(env: Bindings, now: Date) {
 if (!await capabilityAllowed(env,'schedules')) return 0
 const at = now.toISOString()
 const gone = new Set((await env.DB.prepare('SELECT person_id FROM people_departures').all<{ person_id: string }>()).results.map(r => r.person_id))
 const folks = (await env.DB.prepare('SELECT id,email,kind,role,created_at FROM people').all<{ id: string; email: string; kind: string; role: string | null; created_at: string }>()).results.filter(p => !gone.has(p.id) && ['employee', 'contractor'].includes(p.kind))
 let count = 0
 for (const c of (await env.DB.prepare('SELECT * FROM training_campaigns').all<{ id: string; course_id: string; kind: string; audience: string; due_days: number; interval_months: number; created_at: string }>()).results) {
  const rev = (await env.DB.prepare('SELECT MAX(revision) AS r FROM training_adoptions WHERE course_id=?').bind(c.course_id).first<{ r: number | null }>())?.r
  if (!rev) continue
  const s = await schedule(env, c), audience = folks.filter(p => c.audience === 'everyone' || (c.audience === 'employees' && p.kind === 'employee') || (c.audience === 'contractors' && p.kind === 'contractor') || (c.audience === 'engineering' && p.role === 'engineering'))
  // Onboarding: people added after the campaign; recurring: everyone, once per interval from the campaign start.
  const cycles = c.kind === 'onboarding' ? audience.filter(p => p.created_at > c.created_at).map(p => ({ person: p.id, cycle: 'onboarding', start: p.created_at })) : (() => { let k = 0; while (addMonths(new Date(c.created_at), (k + 1) * s.interval_months) <= now) k++; const start = addMonths(new Date(c.created_at), k * s.interval_months).toISOString(); return audience.map(p => ({ person: p.id, cycle: 'cycle-' + k, start })) })()
  const inserts = cycles.map(x => env.DB.prepare("INSERT INTO training_assignments(id,campaign_id,course_id,revision,person_id,cycle,assigned_at,due_date,state) VALUES(?,?,?,?,?,?,?,?,'assigned') ON CONFLICT DO NOTHING").bind(crypto.randomUUID(), c.id, c.course_id, rev, x.person, x.cycle, x.start > at ? at : x.start, plusDays(x.start, s.due_days)))
  if (inserts.length) count += (await env.DB.batch(inserts)).reduce((n, r) => n + r.meta.changes, 0)
 }
 await env.DB.prepare("UPDATE training_assignments SET state='departed' WHERE state='assigned' AND person_id IN (SELECT person_id FROM people_departures)").run()
 const rules = await settings(env), escalateTo = rules.escalation_person_id ? (await env.DB.prepare('SELECT email FROM people WHERE id=?').bind(rules.escalation_person_id).first<{ email: string }>())?.email ?? env.OWNER_EMAIL : env.OWNER_EMAIL
 for (const a of (await env.DB.prepare("SELECT a.id,a.course_id,a.due_date,p.email,p.name FROM training_assignments a JOIN people p ON p.id=a.person_id WHERE a.state='assigned' AND a.due_date<=?").bind(plusDays(at, 3)).all<{ id: string; course_id: string; due_date: string; email: string; name: string }>()).results) {
  const title = course(a.course_id)?.title ?? a.course_id, overdue = a.due_date < today(now), link = `${env.AUTH_ORIGIN}/me`
  if (sent(await sendFollowup(env, { kind: overdue ? 'training-overdue' : 'training-due', subject: a.id, cycle: a.due_date, recipient: a.email, title: `${overdue ? 'Overdue' : 'Due soon'}: ${title} training`, text: `Complete ${title} by ${a.due_date}, including its assessment.\n\nSign in to Evidence: ${link}`, link }, now))) count++
  if (overdue && rules.escalate_after_days && now.getTime() - Date.parse(a.due_date + 'T00:00:00Z') >= rules.escalate_after_days * DAY && sent(await sendFollowup(env, { kind: 'training-escalated', subject: a.id, cycle: a.due_date, recipient: escalateTo, title: `Escalation: ${a.name} has not completed ${title}`, text: `${a.name} (${a.email}) was due to complete ${title} by ${a.due_date}.\n\n${env.AUTH_ORIGIN}/app/training`, link: `${env.AUTH_ORIGIN}/app/training` }, now))) count++
 }
 await syncTraining(env, now)
 return count
}
// The training test: nobody holds an overdue training assignment.
export async function syncTraining(env: Bindings, now: Date) {
 if (!await capabilityAllowed(env,'schedules')) return 0
 if (!await env.DB.prepare("SELECT 1 FROM tests WHERE catalogue_id='training.current'").first()) return 0
 const rows = (await env.DB.prepare("SELECT p.id,p.name,p.email,SUM(a.state='assigned' AND a.due_date<?) AS overdue,SUM(a.state='assigned') AS open,SUM(a.state='completed') AS completed FROM training_assignments a JOIN people p ON p.id=a.person_id WHERE a.state!='departed' GROUP BY p.id").bind(today(now)).all<{ id: string; name: string; email: string; overdue: number; open: number; completed: number }>()).results
 const written = await upsertRegister(env, 'training.person', { fields: { overdue: 'number', open: 'number', completed: 'number' }, required: [] }, rows.map(r => ({ uniqueId: r.id, displayName: `${r.name} <${r.email}>`, attributes: { overdue: r.overdue, open: r.open, completed: r.completed } })), { kind: 'source-observed', ref: 'training:register', label: 'Evidence training register' }, now)
 const ids = written.results.filter(r => r.id && r.outcome !== 'removed').map(r => r.id!)
 if (ids.length) await env.DB.prepare('UPDATE resources SET observed_at=? WHERE id IN (SELECT value FROM json_each(?))').bind(now.toISOString(), JSON.stringify(ids)).run()
 if (written.changed.length) await runForType(env, 'training.person', now)
 return rows.length
}
export type { Course }
