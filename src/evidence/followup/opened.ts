import type { Bindings } from '../../auth.server'
import { event, obligations } from '../remedy/storage'
import { catalogueEntry } from '../tests/catalogue'
import { controlMappings, ownership, requireControl } from '../program/control'
import { usDate } from '../format'
import { sendFollowup, sent } from './send'
import { pausedSubjects, settings } from './settings'
// FOLLOWUP-002. When a failing observation opens (or reopens) an obligation,
// its accountable owner is told at once on their chosen channel, without waiting
// for the SLA to approach. A test that fails on several items sends one notice
// per recipient listing each item with its own due date. An item with no owner
// goes to the control owner, then the escalation contact, and the notice says so.
// Each delivery is recorded on the obligation per failure cycle and recipient;
// a deferred or paused send is retried by the next scheduler run, and a
// verified fix that was announced is announced closed.
const system = { id: 'system', name: 'Evidence' }
type Recipient = { email: string; name: string; basis: 'owner' | 'control owner' | 'escalation contact' | 'installation owner' }
const key = (id: string, line: string) => id + '|' + line
async function hash(text: string) { return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))].slice(0, 12).map(b => b.toString(16).padStart(2, '0')).join('') }
async function context(env: Bindings, test: string) {
 const controls = (await env.DB.prepare('SELECT c.id,c.name,l.library_id FROM test_controls t JOIN controls c ON c.id=t.control_id LEFT JOIN library_adoptions l ON l.control_id=c.id WHERE t.test_id=? ORDER BY c.name').bind(test).all<{ id: string; name: string; library_id: string | null }>()).results
 const requirements: string[] = []
 let fallback: Recipient | null = null
 for (const c of controls) {
  const mappings = await controlMappings(env, c.id, c.library_id)
  for (const m of mappings.library) requirements.push(`${m.framework} ${m.ref}`)
  for (const m of mappings.custom) if (!m.removed_at) requirements.push(`${m.framework} ${m.ref}`)
  const owner = (await ownership(env, (await requireControl(env, c.id)).id)).at(-1)
  if (!fallback && owner && !owner.owner_left_at) fallback = { email: owner.owner_email, name: owner.owner_name, basis: 'control owner' }
 }
 const written = (await env.DB.prepare('SELECT remediation FROM tests WHERE id=?').bind(test).first<{ remediation: string | null }>())?.remediation ?? null
 return { controls, requirements: [...new Set(requirements)], fallback, written }
}
async function ticketLines(env: Bindings, obligation: string) {
 return (await env.DB.prepare("SELECT t.remote_key,t.remote_url,d.label FROM tickets t JOIN tracker_destinations d ON d.id=t.destination_id WHERE t.obligation_id=? AND t.remote_id IS NOT NULL ORDER BY t.created_at").bind(obligation).all<{ remote_key: string; remote_url: string; label: string }>()).results
}
export async function openingNotices(env: Bindings, now: Date) {
 const rules = await settings(env), paused = await pausedSubjects(env), at = now.toISOString()
 const escalation = rules.escalation_person_id ? await env.DB.prepare('SELECT email,name FROM people WHERE id=?').bind(rules.escalation_person_id).first<{ email: string; name: string }>() : null
 const events = (await env.DB.prepare("SELECT obligation_id,body,kind,actor_name,at FROM obligation_events WHERE kind IN ('notified','reassigned') ORDER BY at,rowid").all<{ obligation_id: string; body: string; kind: string; actor_name: string; at: string }>()).results
 const noticed = new Set(events.filter(e => e.kind === 'notified').map(e => key(e.obligation_id, e.body.split('\n')[0])))
 const reassigned = new Map(events.filter(e => e.kind === 'reassigned').map(e => [e.obligation_id, e]))
 const all = await obligations(env, now), contexts = new Map<string, Awaited<ReturnType<typeof context>>>()
 const contextOf = async (test: string) => { if (!contexts.has(test)) contexts.set(test, await context(env, test)); return contexts.get(test)! }
 let count = 0
 // Announce each failure cycle to the person who is now accountable.
 const groups = new Map<string, { recipient: Recipient; rows: Awaited<ReturnType<typeof obligations>> }>()
 for (const o of all) {
  if (o.state !== 'open' || paused.has(o.id)) continue
  const ctx = await contextOf(o.test_id)
  const recipient: Recipient = o.owner_email && !o.owner_left_at ? { email: o.owner_email, name: o.owner_name ?? o.owner_email, basis: 'owner' } : ctx.fallback ?? (escalation ? { email: escalation.email, name: escalation.name, basis: 'escalation contact' } : { email: env.OWNER_EMAIL, name: 'the installation owner', basis: 'installation owner' })
  if (noticed.has(key(o.id, `cycle ${o.cycles} to ${recipient.email}`))) continue
  const id = o.test_id + '|' + recipient.email, group = groups.get(id) ?? { recipient, rows: [] }
  group.rows.push(o); groups.set(id, group)
 }
 for (const group of groups.values()) {
  const { recipient, rows } = group, first = rows[0], ctx = await contextOf(first.test_id), link = `${env.AUTH_ORIGIN}/app/remediation/${first.id}`
  const catalogued = first.catalogue_id ? Object.entries(catalogueEntry(first.catalogue_id)?.remediation ?? {})[0] : undefined
  const step = catalogued ? `First step (${catalogued[0]}): ${catalogued[1].console}` : ctx.written ? `First step: ${ctx.written}` : 'No remediation step is recorded for this test.'
  const items: string[] = []
  for (const o of rows) {
   const tickets = await ticketLines(env, o.id), moved = reassigned.get(o.id)
   items.push(`- ${o.resource_name}: remediate by ${usDate(o.sla.due)}. ${env.AUTH_ORIGIN}/app/remediation/${o.id}${tickets.map(t => `\n  Ticket ${t.remote_key} (${t.label}): ${t.remote_url}`).join('')}${moved && o.owner_person_id ? `\n  Reassigned to you by ${moved.actor_name}: ${moved.body.split(': ').slice(1).join(': ')}` : ''}`)
  }
  const text = [`${first.test_name} fails on ${rows.length === 1 ? first.resource_name : rows.length + ' items'}.`,
   `Severity: ${first.severity}. Control: ${ctx.controls.map(c => c.name).join(', ') || 'none mapped'}. Requirements: ${ctx.requirements.slice(0, 8).join(', ') || 'none mapped'}.`,
   recipient.basis === 'owner' ? `Owner: ${recipient.name}.` : `${rows.length === 1 ? 'This item has' : 'These items have'} no assigned owner, so this notice goes to the ${recipient.basis}${recipient.basis === 'installation owner' ? '' : ' ' + recipient.name}.`,
   '', ...items, '', step,
   '', `Acknowledge or reassign in Evidence (sign-in required): ${link}`, 'A sent notice is not proof that anyone acted; only a passing re-test closes this.'].join('\n')
  const cycle = await hash(rows.map(o => `${o.id}:${o.cycles}`).sort().join(','))
  const result = await sendFollowup(env, { kind: 'obligation-opened', subject: `opened:${first.test_id}:${recipient.email}`, cycle, recipient: recipient.email, title: rows.length === 1 ? `Failing: ${first.test_name} on ${first.resource_name}` : `Failing: ${first.test_name} on ${rows.length} items`, text, link }, now)
  if (!sent(result)) continue
  count++
  const why = (await env.DB.prepare('SELECT detail FROM followups WHERE kind=? AND subject_id=? AND cycle_key=?').bind('obligation-opened', `opened:${first.test_id}:${recipient.email}`, cycle).first<{ detail: string }>())?.detail ?? ''
  await env.DB.batch(rows.map(o => event(env, o.id, 'notified', system, at, `cycle ${o.cycles} to ${recipient.email}\nNotice ${result} to ${recipient.basis === 'owner' ? 'the assigned owner' : 'the ' + recipient.basis} (${recipient.name}) for ${rows.length} item${rows.length === 1 ? '' : 's'} of this test: ${why}`)))
 }
 // A fix is announced closed to whoever heard about the failure.
 for (const o of all) {
  if (o.state !== 'verified') continue
  const heard = events.filter(e => e.kind === 'notified' && e.obligation_id === o.id && e.body.startsWith(`cycle ${o.cycles} to `)).at(-1)
  if (!heard || noticed.has(key(o.id, `verified cycle ${o.cycles}`))) continue
  const recipient = heard.body.split('\n')[0].slice(`cycle ${o.cycles} to `.length)
  const result = await sendFollowup(env, { kind: 'obligation-verified', subject: 'verified:' + o.id, cycle: String(o.cycles), recipient, title: `Verified: ${o.test_name} on ${o.resource_name}`, text: `${o.test_name} now passes on ${o.resource_name}. A fresh source read verified the fix on ${usDate(o.closed_at)}, so this obligation is closed. The earlier failure notice no longer needs action.\n\n${env.AUTH_ORIGIN}/app/remediation/${o.id}`, link: `${env.AUTH_ORIGIN}/app/remediation/${o.id}` }, now)
  if (!sent(result)) continue
  count++
  await event(env, o.id, 'notified', system, at, `verified cycle ${o.cycles} to ${recipient}\nNotice ${result}: the closure was announced.`).run()
 }
 return count
}
