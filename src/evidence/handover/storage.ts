import type { Bindings } from '../../auth.server'
import { Refusal } from '../upload'
import { auditStatement, list, parseList, text, type Actor, type Input } from '../door'
import { sendFollowup, sent } from '../followup/send'
import { local, settings as followupSettings, type Settings } from '../followup/settings'
// LIFECYCLE-002: when a person leaves, every responsibility they still hold is
// flagged "owner left" from the departure itself, and stays flagged until an
// owner reassigns it with a reason. The manager (or the compliance owner) is
// asked to hand over within a business-day window and escalated after it.
// Past observations, approvals and decisions are never reattributed.
export const kinds = ['control', 'policy', 'risk', 'treatment', 'vendor', 'obligation', 'access-item', 'audit-request'] as const
export type Kind = typeof kinds[number]
export interface Held { kind: Kind; item_id: string; role: 'owner' | 'contributor' | 'reviewer'; label: string; link: string; person_id: string }
export interface Flagged extends Held { person_name: string; person_email: string; departed_at: string; deadline: string; state: 'owner left' | 'handover overdue' | 'escalated' }
export const DEFAULT_WINDOW = 5
const latestOwner = 'o.rowid=(SELECT x.rowid FROM control_owners x WHERE x.control_id=o.control_id ORDER BY x.at DESC,x.rowid DESC LIMIT 1)'
// Every responsibility a person can hold today, one row per item and role
// (separate selects: D1 caps a compound SELECT at five terms).
const heldSql = [
 "SELECT 'audit-request' AS kind,id AS item_id,'owner' AS role,title AS label,'/api/audit-engagements/'||engagement_id AS link,owner_person_id AS person_id FROM audit_requests WHERE closed_at IS NULL",
 `SELECT 'control' AS kind,o.control_id AS item_id,'owner' AS role,c.name AS label,'/app/controls/'||o.control_id AS link,o.owner_person_id AS person_id FROM control_owners o JOIN controls c ON c.id=o.control_id WHERE ${latestOwner}`,
 `SELECT 'control' AS kind,o.control_id AS item_id,'contributor' AS role,c.name AS label,'/app/controls/'||o.control_id AS link,j.value AS person_id FROM control_owners o JOIN controls c ON c.id=o.control_id JOIN json_each(o.contributors) j WHERE ${latestOwner}`,
 "SELECT 'policy' AS kind,id AS item_id,'owner' AS role,title AS label,'/app/policies' AS link,owner_person_id AS person_id FROM policies WHERE owner_person_id IS NOT NULL",
 "SELECT 'risk' AS kind,id AS item_id,'owner' AS role,title AS label,'/app/risks/'||id AS link,owner_person_id AS person_id FROM risks WHERE owner_person_id IS NOT NULL",
 "SELECT 'treatment' AS kind,t.id AS item_id,'owner' AS role,r.title||' · '||t.title AS label,'/app/risks/'||r.id AS link,t.owner_person_id AS person_id FROM risk_treatments t JOIN risks r ON r.id=t.risk_id WHERE t.owner_person_id IS NOT NULL AND t.status!='verified'",
 "SELECT 'vendor' AS kind,id AS item_id,'owner' AS role,name AS label,'/app/vendors' AS link,owner_person_id AS person_id FROM vendors WHERE owner_person_id IS NOT NULL",
 "SELECT 'obligation' AS kind,o.id AS item_id,'owner' AS role,t.name||' on '||r.display_name AS label,'/app/remediation/'||o.id AS link,o.owner_person_id AS person_id FROM obligations o JOIN tests t ON t.id=o.test_id JOIN resources r ON r.id=o.resource_id WHERE o.owner_person_id IS NOT NULL AND o.state!='verified'",
 "SELECT 'access-item' AS kind,i.id AS item_id,'reviewer' AS role,v.name||' · '||i.display_name AS label,'/app/access-reviews/'||v.id AS link,COALESCE(d.to_person_id,i.reviewer_person_id) AS person_id FROM access_review_items i JOIN access_reviews v ON v.id=i.review_id LEFT JOIN access_delegations d ON d.item_id=i.id WHERE v.completed_at IS NULL AND COALESCE(d.to_person_id,i.reviewer_person_id) IS NOT NULL AND NOT EXISTS(SELECT 1 FROM access_decisions x WHERE x.item_id=i.id)",
]
export const windowDays = async (env: Bindings) => (await env.DB.prepare('SELECT window_days FROM handover_settings WHERE singleton=1').first<{ window_days: number }>())?.window_days ?? DEFAULT_WINDOW
export async function saveWindow(env: Bindings, actor: Actor, input: Input, now: Date) {
 const days = Number(input.window_days)
 if (!Number.isInteger(days) || days < 1 || days > 30) throw new Refusal('The handover window must be a whole number of business days from 1 to 30.')
 await env.DB.batch([
  env.DB.prepare('INSERT INTO handover_settings(singleton,window_days,updated_by,updated_at) VALUES(1,?,?,?) ON CONFLICT(singleton) DO UPDATE SET window_days=excluded.window_days,updated_by=excluded.updated_by,updated_at=excluded.updated_at').bind(days, actor.name, now.toISOString()),
  auditStatement(env, actor, 'handover.window', 'handover-settings', now, 'succeeded', `${days} business days`),
 ])
}
const nextDay = (date: string) => new Date(Date.parse(date + 'T12:00:00Z') + 86400000).toISOString().slice(0, 10)
// The last day of the window: the departure's local date in the business
// timezone, then that many business days (FOLLOWUP-001 days, less holidays).
export function deadline(departedAt: string, days: number, s: Settings) {
 const business = JSON.parse(s.business_days) as number[], holidays = JSON.parse(s.holidays) as string[]
 let date = local(new Date(departedAt), s.timezone).date
 for (let counted = 0; counted < days;) { date = nextDay(date); if (business.includes(new Date(date + 'T12:00:00Z').getUTCDay()) && !holidays.includes(date)) counted++ }
 return date
}
export async function flagged(env: Bindings, now: Date, person?: string): Promise<Flagged[]> {
 const order = (a: Omit<Flagged, 'deadline' | 'state'>, b: Omit<Flagged, 'deadline' | 'state'>) => a.departed_at.localeCompare(b.departed_at) || a.person_name.localeCompare(b.person_name) || a.kind.localeCompare(b.kind) || a.label.localeCompare(b.label) || a.item_id.localeCompare(b.item_id)
 const rows = (await env.DB.batch(heldSql.map(sql => env.DB.prepare(`SELECT h.*,p.name AS person_name,p.email AS person_email,d.departed_at FROM (${sql}) h JOIN people_departures d ON d.person_id=h.person_id JOIN people p ON p.id=h.person_id ${person ? 'WHERE h.person_id=?' : ''}`).bind(...(person ? [person] : []))))).flatMap(r => r.results as Omit<Flagged, 'deadline' | 'state'>[]).sort(order)
 const s = await followupSettings(env), days = await windowDays(env), today = local(now, s.timezone).date
 const escalated = new Set((await env.DB.prepare("SELECT subject_id||'|'||cycle_key AS k FROM followups WHERE kind='handover-escalated' AND state!='pending'").all<{ k: string }>()).results.map(r => r.k))
 return rows.map(r => { const due = deadline(r.departed_at, days, s); return { ...r, deadline: due, state: today <= due ? 'owner left' : escalated.has(`handover:${r.person_id}|${due}`) ? 'escalated' : 'handover overdue' } })
}
async function successor(env: Bindings, id: unknown, from: string) {
 const to = typeof id === 'string' && id ? await env.DB.prepare('SELECT p.id,p.name,p.email,d.departed_at FROM people p LEFT JOIN people_departures d ON d.person_id=p.id WHERE p.id=?').bind(id).first<{ id: string; name: string; email: string; departed_at: string | null }>() : null
 if (!to) throw new Refusal('Choose the new owner from People.')
 if (to.departed_at) throw new Refusal('The new owner has left too; choose someone current.', 409)
 if (to.id === from) throw new Refusal('Choose someone other than the person who left.', 409)
 return to
}
// The statements that move one flagged item to its successor and record it.
async function move(env: Bindings, actor: Actor, item: Flagged, to: { id: string; email: string }, reason: string, now: Date, bulk: boolean) {
 const at = now.toISOString(), note = `Handover from ${item.person_name} (left ${item.departed_at.slice(0, 10)}): ${reason}`, statements: D1PreparedStatement[] = []
 const owned = (table: string) => env.DB.prepare(`UPDATE ${table} SET owner_person_id=?,updated_at=? WHERE id=? AND owner_person_id=?`).bind(to.id, at, item.item_id, item.person_id)
 if (item.kind === 'control') {
  const last = (await env.DB.prepare('SELECT owner_person_id,contributors,due_date FROM control_owners WHERE control_id=? ORDER BY at DESC,rowid DESC LIMIT 1').bind(item.item_id).first<{ owner_person_id: string; contributors: string; due_date: string | null }>())!
  const contributors = parseList(last.contributors), owner = item.role === 'owner' ? to.id : last.owner_person_id
  const next = [...new Set(contributors.map(c => c === item.person_id && item.role === 'contributor' ? to.id : c))].filter(c => c !== owner)
  statements.push(env.DB.prepare('INSERT INTO control_owners(id,control_id,owner_person_id,contributors,due_date,actor_id,actor_name,reason,at) VALUES(?,?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(), item.item_id, owner, JSON.stringify(next), last.due_date, actor.id, actor.name, note, at))
 } else if (item.kind === 'policy') statements.push(owned('policies'))
 else if (item.kind === 'risk') statements.push(owned('risks'))
 else if (item.kind === 'vendor') statements.push(owned('vendors'))
 else if (item.kind === 'treatment') statements.push(owned('risk_treatments'))
 else if (item.kind === 'audit-request') statements.push(env.DB.prepare('UPDATE audit_requests SET owner_person_id=? WHERE id=? AND owner_person_id=? AND closed_at IS NULL').bind(to.id,item.item_id,item.person_id))
 else if (item.kind === 'obligation') statements.push(env.DB.prepare('UPDATE obligations SET owner_person_id=? WHERE id=? AND owner_person_id=?').bind(to.id, item.item_id, item.person_id), env.DB.prepare("INSERT INTO obligation_events(id,obligation_id,kind,actor_id,actor_name,body,observation_id,at) VALUES(?,?,'reassigned',?,?,?,NULL,?)").bind(crypto.randomUUID(), item.item_id, actor.id, actor.name, note, at))
 else {
  const subject = await env.DB.prepare('SELECT attributes_json FROM access_review_items WHERE id=?').bind(item.item_id).first<{ attributes_json: string }>()
  if (String(JSON.parse(subject!.attributes_json).email ?? '').toLowerCase() === to.email.toLowerCase()) throw new Refusal('Nobody can be handed their own access to review.', 409)
  statements.push(env.DB.prepare('INSERT INTO access_delegations(item_id,to_person_id,reason,by_name,at) VALUES(?,?,?,?,?) ON CONFLICT(item_id) DO UPDATE SET to_person_id=excluded.to_person_id,reason=excluded.reason,by_name=excluded.by_name,at=excluded.at').bind(item.item_id, to.id, note, actor.name, at))
 }
 const id = crypto.randomUUID()
 statements.push(
  env.DB.prepare('INSERT INTO handover_events(id,person_id,kind,item_id,role,label,to_person_id,reason,bulk,actor_id,actor_name,at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').bind(id, item.person_id, item.kind, item.item_id, item.role, item.label, to.id, reason, bulk ? 1 : 0, actor.id, actor.name, at),
  auditStatement(env, actor, 'handover.reassigned', `${item.kind}:${item.item_id}`, now, 'succeeded', `${item.role} ${item.person_email} -> ${to.email}: ${reason}`.slice(0, 400), { reason }),
 )
 return { id, statements }
}
const notify = (env: Bindings, to: { email: string }, subject: string, items: Flagged[], actor: Actor, reason: string, now: Date) => sendFollowup(env, {
 kind: 'handover-assigned', subject, cycle: '1', recipient: to.email, scheduled: false, link: env.AUTH_ORIGIN + (items.length === 1 ? items[0].link : '/app/handover'),
 title: items.length === 1 ? `Handed over to you: ${items[0].label}` : `${items.length} responsibilities handed over to you`,
 text: `${actor.name} handed over to you, from ${items[0].person_name} who left on ${items[0].departed_at.slice(0, 10)}:\n${items.map(i => `- ${i.kind} ${i.role}: ${i.label} (${env.AUTH_ORIGIN}${i.link})`).join('\n')}\n\nReason: ${reason}`,
}, now)
const find = (items: Flagged[], key: string) => items.find(i => `${i.kind}:${i.item_id}:${i.role}` === key)
export async function reassign(env: Bindings, actor: Actor, input: Input, now: Date) {
 const person = text(input, 'person_id', 36), item = find(await flagged(env, now, person), `${text(input, 'kind', 20)}:${text(input, 'item_id', 36)}:${text(input, 'role', 20)}`)
 if (!item) throw new Refusal('That responsibility is not waiting for handover.', 404)
 const to = await successor(env, input.to_person_id, person), reason = text(input, 'reason', 500), moved = await move(env, actor, item, to, reason, now, false)
 await env.DB.batch(moved.statements)
 return { id: moved.id, notified: await notify(env, to, moved.id, [item], actor, reason, now) }
}
// A bulk handover moves the chosen items (all of them unless some are named)
// to one successor, each recorded as its own reassignment.
export async function bulkHandover(env: Bindings, actor: Actor, person: string, input: Input, now: Date) {
 const open = await flagged(env, now, person), chosen = list(input, 'items', 500)
 const items = chosen.length ? chosen.map(k => find(open, k) ?? (() => { throw new Refusal('One of the chosen responsibilities is not waiting for handover.', 409) })()) : open
 if (!items.length) throw new Refusal('Nothing is waiting for handover from this person.', 409)
 const to = await successor(env, input.to_person_id, person), reason = text(input, 'reason', 500), batch = crypto.randomUUID()
 const moves = []; for (const item of items) moves.push(await move(env, actor, item, to, reason, now, true))
 await env.DB.batch(moves.flatMap(m => m.statements))
 return { moved: moves.length, notified: await notify(env, to, 'bulk:' + batch, items, actor, reason, now) }
}
// The leaver's manager is the manager_email on their latest reviewed roster
// row (POPULATION-001) when it names a current person; otherwise the
// installation owner acts as the compliance owner.
async function handoverContact(env: Bindings, person: string) {
 const row = await env.DB.prepare("SELECT r.attributes_json FROM population_rows r JOIN population_matches m ON m.row_id=r.id JOIN population_uploads u ON u.id=r.upload_id WHERE m.person_id=? AND m.state='approved' AND u.kind='roster' ORDER BY u.uploaded_at DESC,u.rowid DESC LIMIT 1").bind(person).first<{ attributes_json: string }>()
 const email = row ? String(JSON.parse(row.attributes_json).manager_email ?? '').toLowerCase() : ''
 const manager = email ? await env.DB.prepare('SELECT p.email FROM people p WHERE p.email=? AND p.id!=? AND NOT EXISTS(SELECT 1 FROM people_departures d WHERE d.person_id=p.id)').bind(email, person).first<{ email: string }>() : null
 return manager ? { email: manager.email, role: 'manager' } : { email: env.OWNER_EMAIL, role: 'compliance owner' }
}
// Ask for the handover on the day of the departure; one request per departure.
export async function requestHandover(env: Bindings, person: string, now: Date, scheduled = true) {
 const items = await flagged(env, now, person)
 if (!items.length) return null
 const contact = await handoverContact(env, person), link = `${env.AUTH_ORIGIN}/app/handover?person=${person}`
 const result = await sendFollowup(env, { kind: 'handover-request', subject: 'handover:' + person, cycle: items[0].departed_at, recipient: contact.email, scheduled, link,
  title: `Hand over ${items.length} responsibilities: ${items[0].person_name} left`,
  text: `${items[0].person_name} left on ${items[0].departed_at.slice(0, 10)}. As their ${contact.role}, please hand over by ${items[0].deadline}:\n${items.map(i => `- ${i.kind} ${i.role}: ${i.label}`).join('\n')}\n\nHand over in Evidence: ${link}` }, now)
 return { to: contact.role, result }
}
// Scheduler: send any request that waited, and escalate each departure whose
// window has passed with items still flagged, once per window.
export async function handoverWork(env: Bindings, now: Date) {
 const items = await flagged(env, now), rules = await followupSettings(env)
 const escalation = rules.escalation_person_id ? (await env.DB.prepare('SELECT email FROM people WHERE id=?').bind(rules.escalation_person_id).first<{ email: string }>())?.email ?? env.OWNER_EMAIL : env.OWNER_EMAIL
 let count = 0
 for (const person of new Set(items.map(i => i.person_id))) {
  const own = items.filter(i => i.person_id === person)
  if (sent((await requestHandover(env, person, now))?.result ?? 'duplicate')) count++
  const late = own.filter(i => i.state !== 'owner left')
  if (!late.length) continue
  if (sent(await sendFollowup(env, { kind: 'handover-escalated', subject: 'handover:' + person, cycle: late[0].deadline, recipient: escalation, link: `${env.AUTH_ORIGIN}/app/handover?person=${person}`,
   title: `Escalation: ${late.length} responsibilities of ${late[0].person_name} still unowned`,
   text: `${late[0].person_name} left on ${late[0].departed_at.slice(0, 10)} and the handover window ended ${late[0].deadline}. Still waiting for a new owner:\n${late.map(i => `- ${i.kind} ${i.role}: ${i.label}`).join('\n')}\n\nHand over in Evidence: ${env.AUTH_ORIGIN}/app/handover?person=${person}` }, now))) count++
 }
 return count
}
export const handoverHistory = async (env: Bindings, person?: string) => (await env.DB.prepare(`SELECT e.id,e.kind,e.item_id,e.role,e.label,e.person_id,f.name AS from_name,e.to_person_id,t.name AS to_name,e.reason,e.bulk,e.actor_name,e.at FROM handover_events e JOIN people f ON f.id=e.person_id JOIN people t ON t.id=e.to_person_id ${person ? 'WHERE e.person_id=?' : ''} ORDER BY e.at DESC,e.rowid DESC LIMIT 500`).bind(...(person ? [person] : [])).all<{ id: string; kind: string; item_id: string; role: string; label: string; person_id: string; from_name: string; to_person_id: string; to_name: string; reason: string; bulk: number; actor_name: string; at: string }>()).results
