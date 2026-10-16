import type { Bindings } from '../../auth.server'
import { Refusal } from '../upload'
import { auditStatement, oneOf, text, type Actor, type Input } from '../door'
import { validDate } from '../model'
import { addMonths } from '../cadence'
import { sendFollowup, sent } from '../followup/send'
// ACCESS-001 campaigns. The population is frozen when a campaign starts, from
// directory connections (source-observed) and uploaded account lists (manual).
// Resource owners decide each account with a reason; nobody reviews their own
// access, and a delegation is an explicit record. A revocation closes only on
// a fresh source read, or a newer uploaded list, that shows the account gone.
export type Cadence = 'quarterly' | 'semi-annual' | 'annual' | 'one-off'
interface Source { key: string; label: string; provenance: 'source-observed' | 'manually-asserted' }
interface Account { subject_ref: string; account_key: string; display_name: string; attributes: Record<string, unknown> }
// Sources a campaign can freeze: directory connections and the latest list of each uploaded application.
export async function sources(env: Bindings): Promise<Source[]> {
 const directories = (await env.DB.prepare("SELECT id,label FROM connections WHERE provider IN ('okta','google','entra','jumpcloud') AND status!='revoked' ORDER BY created_at").all<{ id: string; label: string }>()).results
 const lists = (await env.DB.prepare("SELECT DISTINCT source_system FROM population_uploads WHERE kind='accounts' ORDER BY source_system").all<{ source_system: string }>()).results
 return [...directories.map(d => ({ key: 'directory:' + d.id, label: d.label, provenance: 'source-observed' as const })), ...lists.map(l => ({ key: 'list:' + l.source_system, label: `${l.source_system} (uploaded account list)`, provenance: 'manually-asserted' as const }))]
}
async function accountsOf(env: Bindings, source: string): Promise<Account[]> {
 if (source.startsWith('directory:')) return (await env.DB.prepare("SELECT id,unique_id,display_name,attributes_json FROM resources WHERE type='identity.account' AND source_ref=? AND removed_at IS NULL ORDER BY display_name").bind(source).all<{ id: string; unique_id: string; display_name: string; attributes_json: string }>()).results.map(r => { const a = JSON.parse(r.attributes_json); return { subject_ref: r.id, account_key: String(a.email || r.unique_id), display_name: r.display_name, attributes: { email: a.email ?? null, status: a.status ?? null, population: a.population ?? null, admin: a.admin ?? null, roles: a.roles ?? null, groups: a.groups ?? null, mfa: a.mfa_enrolled ?? null } } })
 const upload = await env.DB.prepare("SELECT id FROM population_uploads WHERE kind='accounts' AND source_system=? ORDER BY uploaded_at DESC,rowid DESC LIMIT 1").bind(source.slice(5)).first<{ id: string }>()
 if (!upload) return []
 return (await env.DB.prepare('SELECT id,row_key,attributes_json FROM population_rows WHERE upload_id=? ORDER BY row_number').bind(upload.id).all<{ id: string; row_key: string; attributes_json: string }>()).results.map(r => { const a = JSON.parse(r.attributes_json); return { subject_ref: r.id, account_key: r.row_key, display_name: String(a.name ?? a.email ?? r.row_key), attributes: { email: a.email ?? null, role: a.role ?? null, status: a.status ?? null, mfa: a.mfa ?? null, upload: upload.id } } })
}
const itemStatements = async (env: Bindings, review: string, chosen: Source[], reviewers: Record<string, string>, supplemental: boolean, at: string) => {
 const statements: D1PreparedStatement[] = []
 for (const s of chosen) for (const a of await accountsOf(env, s.key)) statements.push(env.DB.prepare('INSERT INTO access_review_items(id,review_id,source,source_label,provenance,subject_ref,account_key,display_name,attributes_json,reviewer_person_id,supplemental,added_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(review_id,source,account_key) DO NOTHING').bind(crypto.randomUUID(), review, s.key, s.label, s.provenance, a.subject_ref, a.account_key, a.display_name, JSON.stringify(a.attributes), reviewers[s.key] ?? null, supplemental ? 1 : 0, at))
 return statements
}
export async function startReview(env: Bindings, actor: Actor, input: Input, now: Date, previous: string | null = null) {
 const name = text(input, 'name', 200), cadence = oneOf(input, 'cadence', ['quarterly', 'semi-annual', 'annual', 'one-off'] as const), from = text(input, 'period_from', 10), to = text(input, 'period_to', 10), due = text(input, 'due_date', 10)
 if (![from, to, due].every(validDate) || from > to) throw new Refusal('Give a real period and due date.')
 const available = await sources(env), chosen = available.filter(s => (Array.isArray(input.sources) ? input.sources : [input.sources]).includes(s.key))
 if (!chosen.length) throw new Refusal('Choose at least one directory or uploaded account list.')
 const reviewers: Record<string, string> = {}
 for (const s of chosen) { const person = input['reviewer_' + s.key]; if (typeof person !== 'string' || !person || !await env.DB.prepare('SELECT 1 FROM people WHERE id=?').bind(person).first()) throw new Refusal(`Choose the resource owner who reviews ${s.label}.`); reviewers[s.key] = person }
 const id = crypto.randomUUID(), at = now.toISOString()
 const statements = [env.DB.prepare('INSERT INTO access_reviews(id,name,cadence,period_from,period_to,due_date,sources_json,reviewers_json,created_by,created_name,created_at,previous_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').bind(id, name, cadence, from, to, due, JSON.stringify(chosen.map(s => s.key)), JSON.stringify(reviewers), actor.id, actor.name, at, previous), ...await itemStatements(env, id, chosen, reviewers, false, at), auditStatement(env, actor, 'access-review.started', 'access-review:' + id, now, 'succeeded', `${cadence} ${from} to ${to}`)]
 await env.DB.batch(statements)
 return { id, items: statements.length - 2 }
}
export async function requireReview(env: Bindings, id: string) { const row = await env.DB.prepare('SELECT * FROM access_reviews WHERE id=?').bind(id).first<{ id: string; name: string; cadence: Cadence; period_from: string; period_to: string; due_date: string; sources_json: string; reviewers_json: string; created_name: string; created_at: string; completed_at: string | null; previous_id: string | null }>(); if (!row) throw new Refusal('Access review not found.', 404); return row }
export interface ItemView { id: string; source: string; source_label: string; provenance: string; account_key: string; display_name: string; attributes: Record<string, unknown>; reviewer_person_id: string | null; reviewer: string | null; delegated_to: string | null; delegation_reason: string | null; supplemental: boolean; decision: { decision: string; reason: string; by: string; at: string } | null; history: { decision: string; reason: string; by: string; at: string }[]; revocation: { state: string; requested_at: string; verified_at: string | null; evidence: string } | null; overdue: boolean }
export async function items(env: Bindings, review: string, now: Date): Promise<ItemView[]> {
 const r = await requireReview(env, review), today = now.toISOString().slice(0, 10)
 const rows = (await env.DB.prepare('SELECT i.*,p.name AS reviewer,d.to_person_id,d.reason AS delegation_reason,q.name AS delegate,v.state AS rev_state,v.requested_at,v.verified_at,v.evidence FROM access_review_items i LEFT JOIN people p ON p.id=i.reviewer_person_id LEFT JOIN access_delegations d ON d.item_id=i.id LEFT JOIN people q ON q.id=d.to_person_id LEFT JOIN access_revocations v ON v.item_id=i.id WHERE i.review_id=? ORDER BY i.source,i.display_name').bind(review).all<Record<string, string | number | null>>()).results
 const decisions = (await env.DB.prepare('SELECT d.item_id,d.decision,d.reason,d.decided_by_name,d.at FROM access_decisions d JOIN access_review_items i ON i.id=d.item_id WHERE i.review_id=? ORDER BY d.at,d.rowid').bind(review).all<{ item_id: string; decision: string; reason: string; decided_by_name: string; at: string }>()).results
 return rows.map(i => { const history = decisions.filter(d => d.item_id === i.id).map(d => ({ decision: d.decision, reason: d.reason, by: d.decided_by_name, at: d.at })), decision = history.at(-1) ?? null
  return { id: String(i.id), source: String(i.source), source_label: String(i.source_label), provenance: String(i.provenance), account_key: String(i.account_key), display_name: String(i.display_name), attributes: JSON.parse(String(i.attributes_json)), reviewer_person_id: i.reviewer_person_id as string | null, reviewer: i.reviewer as string | null, delegated_to: i.delegate as string | null, delegation_reason: i.delegation_reason as string | null, supplemental: !!i.supplemental, decision, history, revocation: i.rev_state ? { state: String(i.rev_state), requested_at: String(i.requested_at), verified_at: i.verified_at as string | null, evidence: String(i.evidence) } : null, overdue: !decision && today > r.due_date } })
}
// Only the assigned resource owner (or the explicit delegate) decides, never about their own account.
export async function decide(env: Bindings, person: { id: string; name: string; email: string }, itemId: string, input: Input, now: Date) {
 const item = await env.DB.prepare('SELECT i.*,d.to_person_id,r.completed_at FROM access_review_items i JOIN access_reviews r ON r.id=i.review_id LEFT JOIN access_delegations d ON d.item_id=i.id WHERE i.id=?').bind(itemId).first<{ id: string; review_id: string; reviewer_person_id: string | null; to_person_id: string | null; attributes_json: string; completed_at: string | null; display_name: string }>()
 if (!item || (item.to_person_id ?? item.reviewer_person_id) !== person.id) throw new Refusal('This account is not assigned to you.', 404)
 if (item.completed_at) throw new Refusal('This review is complete.', 409)
 if (String(JSON.parse(item.attributes_json).email ?? '').toLowerCase() === person.email.toLowerCase()) throw new Refusal('You cannot review your own access; the review owner delegates it to someone else.', 403)
 const decision = oneOf(input, 'decision', ['retain', 'revoke', 'change'] as const), reason = text(input, 'reason', 1000), at = now.toISOString()
 await env.DB.batch([
  env.DB.prepare('INSERT INTO access_decisions(id,item_id,decision,reason,decided_by_person,decided_by_name,decided_by_email,at) VALUES(?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(), itemId, decision, reason, person.id, person.name, person.email, at),
  ...(decision === 'revoke' ? [env.DB.prepare("INSERT INTO access_revocations(item_id,state,requested_at) VALUES(?,'requested',?) ON CONFLICT(item_id) DO NOTHING").bind(itemId, at)] : [env.DB.prepare("DELETE FROM access_revocations WHERE item_id=? AND state!='verified'").bind(itemId)]),
  auditStatement(env, { id: person.id, name: person.name }, 'access-review.decided', 'access-item:' + itemId, now, 'succeeded', `${decision}: ${reason}`.slice(0, 400)),
 ])
}
export async function exclude(env: Bindings, actor: Actor, itemId: string, input: Input, now: Date) {
 if (!await env.DB.prepare('SELECT 1 FROM access_review_items WHERE id=?').bind(itemId).first()) throw new Refusal('Item not found.', 404)
 const reason = text(input, 'reason', 1000)
 await env.DB.batch([env.DB.prepare("INSERT INTO access_decisions(id,item_id,decision,reason,decided_by_person,decided_by_name,decided_by_email,at) VALUES(?,?,'excluded',?,NULL,?,'',?)").bind(crypto.randomUUID(), itemId, reason, actor.name, now.toISOString()), auditStatement(env, actor, 'access-review.excluded', 'access-item:' + itemId, now, 'succeeded', reason)])
}
export async function delegate(env: Bindings, actor: Actor, itemId: string, input: Input, now: Date) {
 const item = await env.DB.prepare('SELECT attributes_json FROM access_review_items WHERE id=?').bind(itemId).first<{ attributes_json: string }>()
 if (!item) throw new Refusal('Item not found.', 404)
 const to = await env.DB.prepare('SELECT id,email FROM people WHERE id=?').bind(String(input.person_id ?? '')).first<{ id: string; email: string }>()
 if (!to) throw new Refusal('Choose the person who decides instead.')
 if (String(JSON.parse(item.attributes_json).email ?? '').toLowerCase() === to.email.toLowerCase()) throw new Refusal('Nobody can be delegated their own access.', 409)
 const reason = text(input, 'reason', 500)
 await env.DB.batch([env.DB.prepare('INSERT INTO access_delegations(item_id,to_person_id,reason,by_name,at) VALUES(?,?,?,?,?) ON CONFLICT(item_id) DO UPDATE SET to_person_id=excluded.to_person_id,reason=excluded.reason,by_name=excluded.by_name,at=excluded.at').bind(itemId, to.id, reason, actor.name, now.toISOString()), auditStatement(env, actor, 'access-review.delegated', 'access-item:' + itemId, now, 'succeeded', reason)])
}
// Scheduler work: revocation readback, late-discovered accounts, completion, reminders and recurrence.
export async function accessReviewWork(env: Bindings, now: Date) {
 const at = now.toISOString(), today = at.slice(0, 10)
 let count = 0
 for (const v of (await env.DB.prepare("SELECT v.item_id,v.state,v.requested_at,i.source,i.subject_ref,i.account_key,r.due_date FROM access_revocations v JOIN access_review_items i ON i.id=v.item_id JOIN access_reviews r ON r.id=i.review_id WHERE v.state!='verified'").all<{ item_id: string; state: string; requested_at: string; source: string; subject_ref: string; account_key: string; due_date: string }>()).results) {
  let evidence = ''
  if (v.source.startsWith('directory:')) {
   const r = await env.DB.prepare('SELECT removed_at,observed_at,json_extract(attributes_json,\'$.status\') AS status FROM resources WHERE id=?').bind(v.subject_ref).first<{ removed_at: string | null; observed_at: string | null; status: string | null }>()
   if (r && r.observed_at && r.observed_at > v.requested_at && (r.removed_at || r.status !== 'active')) evidence = `Source read at ${r.observed_at} shows the account ${r.removed_at ? 'removed' : r.status}`
  } else {
   const newer = await env.DB.prepare("SELECT u.id,u.uploaded_at,(SELECT 1 FROM population_rows x WHERE x.upload_id=u.id AND x.row_key=? AND lower(coalesce(json_extract(x.attributes_json,'$.status'),'active')) NOT IN ('inactive','deactivated','suspended','removed')) AS still FROM population_uploads u WHERE u.kind='accounts' AND u.source_system=? AND u.uploaded_at>? ORDER BY u.uploaded_at DESC LIMIT 1").bind(v.account_key, v.source.slice(5), v.requested_at).first<{ id: string; uploaded_at: string; still: number | null }>()
   if (newer && !newer.still) evidence = `Re-uploaded list ${newer.id} at ${newer.uploaded_at} no longer lists the account`
  }
  if (evidence) { await env.DB.prepare("UPDATE access_revocations SET state='verified',verified_at=?,checked_at=?,evidence=? WHERE item_id=?").bind(at, at, evidence, v.item_id).run(); count++ }
  else await env.DB.prepare('UPDATE access_revocations SET state=?,checked_at=? WHERE item_id=?').bind(today > v.due_date ? 'unresolved' : 'requested', at, v.item_id).run()
 }
 for (const review of (await env.DB.prepare('SELECT * FROM access_reviews WHERE completed_at IS NULL').all<{ id: string; name: string; cadence: Cadence; period_from: string; period_to: string; due_date: string; sources_json: string; reviewers_json: string }>()).results) {
  // Accounts that appeared after the freeze join as supplemental work.
  const all = await sources(env), chosen = all.filter(s => (JSON.parse(review.sources_json) as string[]).includes(s.key))
  const added = await itemStatements(env, review.id, chosen, JSON.parse(review.reviewers_json), true, at)
  if (added.length) count += (await env.DB.batch(added)).reduce((n, r) => n + r.meta.changes, 0)
  const view = await items(env, review.id, now)
  if (view.length && view.every(i => i.decision && (i.decision.decision !== 'revoke' || i.revocation?.state === 'verified'))) { await env.DB.prepare('UPDATE access_reviews SET completed_at=? WHERE id=? AND completed_at IS NULL').bind(at, review.id).run(); continue }
  const pending = new Map<string, number>()
  for (const i of view.filter(i => !i.decision)) { const who = (await env.DB.prepare('SELECT COALESCE(d.to_person_id,i.reviewer_person_id) AS p FROM access_review_items i LEFT JOIN access_delegations d ON d.item_id=i.id WHERE i.id=?').bind(i.id).first<{ p: string | null }>())?.p; if (who) pending.set(who, (pending.get(who) ?? 0) + 1) }
  for (const [person, n] of pending) {
   const email = (await env.DB.prepare('SELECT email FROM people WHERE id=?').bind(person).first<{ email: string }>())?.email
   const overdue = today > review.due_date, soon = new Date(Date.parse(review.due_date + 'T00:00:00Z') - 3 * 86400000).toISOString().slice(0, 10) <= today
   if (email && (overdue || soon) && sent(await sendFollowup(env, { kind: overdue ? 'access-review-overdue' : 'access-review-due', subject: `${review.id}:${person}`, cycle: review.due_date, recipient: email, title: `${overdue ? 'Overdue' : 'Due soon'}: ${n} access decisions in ${review.name}`, text: `${n} accounts in ${review.name} wait for your decision (due ${review.due_date}).\n\nSign in to Evidence: ${env.AUTH_ORIGIN}/me`, link: `${env.AUTH_ORIGIN}/me` }, now))) count++
  }
 }
 // CADENCE-001: a recurring campaign starts its next period once the current one ends.
 for (const r of (await env.DB.prepare("SELECT * FROM access_reviews a WHERE cadence!='one-off' AND period_to<? AND NOT EXISTS(SELECT 1 FROM access_reviews b WHERE b.previous_id=a.id)").bind(today).all<{ id: string; name: string; cadence: Cadence; period_from: string; period_to: string; due_date: string; sources_json: string; reviewers_json: string; created_by: string }>()).results) {
  const step = r.cadence === 'quarterly' ? 3 : r.cadence === 'semi-annual' ? 6 : 12, shift = (d: string) => addMonths(new Date(d + 'T00:00:00Z'), step).toISOString().slice(0, 10)
  const reviewers = JSON.parse(r.reviewers_json) as Record<string, string>
  await startReview(env, { id: 'system', name: 'Evidence (recurring campaign)' }, { name: r.name, cadence: r.cadence, period_from: shift(r.period_from), period_to: shift(r.period_to), due_date: shift(r.due_date), sources: JSON.parse(r.sources_json), ...Object.fromEntries(Object.entries(reviewers).map(([k, v]) => ['reviewer_' + k, v])) }, now, r.id).catch(error => { if (!(error instanceof Refusal)) throw error })
  count++
 }
 return count
}
