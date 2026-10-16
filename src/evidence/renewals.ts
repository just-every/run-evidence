import type { Bindings } from '../auth.server'
import { day } from './model'
import { desk } from './storage'
import { sendFollowup } from './followup'
// CADENCE-001 reminders: one at the reminder lead and one at the deadline per
// renewal cycle, to the requirement owner, deduplicated across restarts.
export async function renewalReminders(env: Bindings, now: Date) {
 const data = await desk(env, day(now), now)
 const owners = new Map((await env.DB.prepare('SELECT s.requirement_id,p.email FROM requirement_schedules s JOIN people p ON p.id=s.owner_person_id WHERE s.rowid=(SELECT s2.rowid FROM requirement_schedules s2 WHERE s2.requirement_id=s.requirement_id AND s2.effective_from<=? ORDER BY s2.effective_from DESC,s2.rowid DESC LIMIT 1)').bind(now.toISOString()).all<{ requirement_id: string; email: string }>()).results.map(r => [r.requirement_id, r.email]))
 const controlOwners = new Map((await env.DB.prepare('SELECT o.control_id,p.email FROM control_owners o JOIN people p ON p.id=o.owner_person_id WHERE o.rowid=(SELECT o2.rowid FROM control_owners o2 WHERE o2.control_id=o.control_id ORDER BY o2.at DESC,o2.rowid DESC LIMIT 1)').all<{ control_id: string; email: string }>()).results.map(r => [r.control_id, r.email]))
 let sent = 0
 for (const r of data.requirements) {
  const state = r.renewal
  if (!state.due || (r.gap !== 'due soon' && r.gap !== 'overdue')) continue
  const kind = r.gap === 'due soon' ? 'renewal-lead' : 'renewal-deadline'
  const recipient = owners.get(r.id) ?? controlOwners.get(r.control_id) ?? env.OWNER_EMAIL
  const result = await sendFollowup(env, { kind, subject: r.id, cycle: state.due, recipient, title: `${r.gap === 'due soon' ? 'Due soon' : 'Overdue'}: ${r.name}`, text: `${r.control_name}\n${r.name} (${state.cadence}, ${state.anchor} anchor) ${r.gap === 'due soon' ? 'is due' : 'was due'} on ${state.due}.\n\nUpload the renewed proof in Evidence: ${env.AUTH_ORIGIN}/app/requirements/${r.id}\n\nThis reminder records that it was sent, not that anyone acted.` }, now)
  if (result !== 'duplicate') sent++
 }
 return sent
}
