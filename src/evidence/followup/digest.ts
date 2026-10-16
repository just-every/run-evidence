import type { Bindings } from '../../auth.server'
import { obligations } from '../remedy/storage'
import { digestDue, settings } from './settings'
import { sendFollowup, sent } from './send'
// The weekly compliance digest (FOLLOWUP-001): on the owner-chosen day and
// local time (moved to the next business day when the calendar marks it off), each remediation owner and control owner gets their own new
// failures, items due in the next 14 days, missed SLAs and expiring
// exceptions. Unowned work goes to the installation owner. Nothing open means
// no digest, unless the person opted into an all-clear.
const DAY = 86400000
type Item = Awaited<ReturnType<typeof obligations>>[number]
export async function weeklyDigest(env: Bindings, now: Date) {
 const rules = await settings(env)
 if (!rules.digest_enabled) return 0
 const week = digestDue(rules, now)
 if (!week) return 0
 const open = (await obligations(env, now)).filter(o => o.state !== 'verified')
 const controlsOf = new Map<string, string[]>()
 for (const link of (await env.DB.prepare('SELECT test_id,control_id FROM test_controls').all<{ test_id: string; control_id: string }>()).results) controlsOf.set(link.test_id, [...(controlsOf.get(link.test_id) ?? []), link.control_id])
 const controlOwner = new Map((await env.DB.prepare('SELECT o.control_id,o.owner_person_id FROM control_owners o WHERE o.rowid=(SELECT o2.rowid FROM control_owners o2 WHERE o2.control_id=o.control_id ORDER BY o2.at DESC,o2.rowid DESC LIMIT 1)').all<{ control_id: string; owner_person_id: string }>()).results.map(r => [r.control_id, r.owner_person_id]))
 const people = (await env.DB.prepare('SELECT p.id,p.name,p.email,COALESCE(n.all_clear,0) AS all_clear FROM people p LEFT JOIN notify_preferences n ON n.person_id=p.id ORDER BY p.name').all<{ id: string; name: string; email: string; all_clear: number }>()).results
 const ownersOf = (testId: string, item?: Item) => { const ids = new Set([...(item?.owner_person_id ? [item.owner_person_id] : []), ...(controlsOf.get(testId) ?? []).map(c => controlOwner.get(c)).filter((x): x is string => !!x)]); return ids.size ? [...ids] : ['owner'] }
 const mine = new Map<string, Item[]>()
 for (const o of open) for (const who of ownersOf(o.test_id, o)) mine.set(who, [...(mine.get(who) ?? []), o])
 const soon = new Date(now.getTime() + 14 * DAY).toISOString(), at = now.toISOString()
 const exceptions = (await env.DB.prepare('SELECT e.test_id,e.expires_at,e.reason,t.name FROM test_exceptions e JOIN tests t ON t.id=e.test_id WHERE e.revoked_at IS NULL AND e.approved_at<=? AND e.expires_at>? AND e.expires_at<=?').bind(at, at, soon).all<{ test_id: string; expires_at: string; reason: string; name: string }>()).results
 let count = 0
 for (const person of [...people, { id: 'owner', name: 'Installation owner', email: env.OWNER_EMAIL, all_clear: 0 }]) {
  const items = mine.get(person.id) ?? [], expiring = exceptions.filter(e => ownersOf(e.test_id).includes(person.id) || items.some(o => o.test_id === e.test_id))
  const label = (o: Item) => `- ${o.test_name} on ${o.resource_name}: due ${o.sla.due.slice(0, 10)} (${o.sla.status}) ${env.AUTH_ORIGIN}/app/remediation/${o.id}`
  const fresh = items.filter(o => now.getTime() - Date.parse(o.clock_started_at) <= 7 * DAY), missed = items.filter(o => o.sla.status === 'SLA missed'), upcoming = items.filter(o => o.sla.status !== 'SLA missed' && o.sla.due <= soon)
  const sections = [['New failures this week', fresh.map(label)], ['Due in the next 14 days', upcoming.map(label)], ['Overdue and SLA missed', missed.map(label)], ['Exceptions expiring in the next 14 days', expiring.map(e => `- ${e.name}: expires ${e.expires_at.slice(0, 10)} (${e.reason})`)]] as const
  const total = fresh.length + upcoming.length + missed.length + expiring.length
  if (!total && !person.all_clear) continue
  const text = total ? sections.filter(([, lines]) => lines.length).map(([title, lines]) => `${title}:\n${lines.join('\n')}`).join('\n\n') + '\n\nA digest is a reminder, not proof that anyone acted.' : 'Nothing is open for you this week.'
  if (sent(await sendFollowup(env, { kind: 'weekly-digest', subject: person.id, cycle: week, recipient: person.email, title: total ? `Weekly compliance digest: ${missed.length} missed, ${upcoming.length} due soon, ${fresh.length} new` : 'Weekly compliance digest: all clear', text, link: `${env.AUTH_ORIGIN}/app/remediation${person.id === 'owner' ? '' : '?owner=' + person.id}`, scheduled: false }, now))) count++
 }
 return count
}
