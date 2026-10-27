import { capabilityAllowed } from '../archive/capabilities'
import { operatorAuth, type Bindings } from '../../auth.server'
import { AuthError } from '../../modules/operator-auth/index.mjs'
import { Refusal } from '../upload'
import { auditStatement, list, oneOf, text, type Actor, type Input } from '../door'
import { validDate } from '../model'
import { upsertRegister } from '../resources'
import { catalogueStatements } from '../tests/storage'
import { runForType } from '../tests/engine'
import { sendFollowup, sent } from '../followup/send'
import { requestHandover } from '../handover/storage'
// ATTEST-001: role-appropriate policy assignment, acknowledgment of an exact
// published revision by the signed-in person only, exceptions, reminders and
// departures. Publishing, assigning or reminding never records anyone's assent.
const DAY = 86400000
export interface Assignment { id: string; policy_id: string; revision_id: string; person_id: string; assigned_by: string; assigned_at: string; due_date: string; state: string; closed_at: string | null }
const departed = (env: Bindings) => env.DB.prepare('SELECT person_id FROM people_departures').all<{ person_id: string }>().then(r => new Set(r.results.map(x => x.person_id)))
async function published(env: Bindings, policy: string) {
 const row = await env.DB.prepare("SELECT id,version FROM policy_revisions WHERE policy_id=? AND status='published'").bind(policy).first<{ id: string; version: number }>()
 if (!row) throw new Refusal('Publish an approved revision before assigning it.', 409)
 return row
}
// Assign the published revision to employees, contractors, everyone or named people.
export async function assign(env: Bindings, actor: Actor, policy: string, input: Input, now: Date) {
 const revision = await published(env, policy), audience = oneOf(input, 'audience', ['employees', 'contractors', 'everyone', 'selected'] as const), due = text(input, 'due_date', 10)
 if (!validDate(due) || due < now.toISOString().slice(0, 10)) throw new Refusal('The due date must be a real date, today or later.')
 const gone = await departed(env), chosen = audience === 'selected' ? list(input, 'people', 500) : []
 const people = (await env.DB.prepare("SELECT id,kind FROM people WHERE kind IN ('employee','contractor')").all<{ id: string; kind: string }>()).results.filter(p => !gone.has(p.id) && (audience === 'everyone' || (audience === 'employees' && p.kind === 'employee') || (audience === 'contractors' && p.kind === 'contractor') || (audience === 'selected' && chosen.includes(p.id))))
 if (!people.length) throw new Refusal('Nobody matches that audience.')
 const at = now.toISOString()
 const results = await env.DB.batch([
  ...people.map(p => env.DB.prepare("INSERT INTO policy_assignments(id,policy_id,revision_id,person_id,assigned_by,assigned_at,due_date,state) VALUES(?,?,?,?,?,?,?,'pending') ON CONFLICT(revision_id,person_id) DO NOTHING RETURNING id").bind(crypto.randomUUID(), policy, revision.id, p.id, actor.name, at, due)),
  auditStatement(env, actor, 'policy.assigned', 'policy:' + policy, now, 'succeeded', `version ${revision.version} to ${audience} (${people.length}) due ${due}`, { revision: revision.version }),
  ...await catalogueStatements(env, 'attestations', actor, now),
 ])
 await syncAttestations(env, now)
 return { assigned: results.slice(0, people.length).reduce((n, r) => n + r.results.length, 0) }
}
// A material revision replaces open and completed assignments of earlier
// revisions with new ones for the same people; earlier acknowledgments stay.
export async function reassignOnPublish(env: Bindings, actor: Actor, policy: string, due: string, now: Date) {
 const revision = await published(env, policy), gone = await departed(env), at = now.toISOString()
 const earlier = (await env.DB.prepare("SELECT DISTINCT person_id FROM policy_assignments WHERE policy_id=? AND revision_id!=? AND state IN ('pending','acknowledged')").bind(policy, revision.id).all<{ person_id: string }>()).results.filter(r => !gone.has(r.person_id))
 if (!earlier.length) return 0
 await env.DB.batch([
  env.DB.prepare("UPDATE policy_assignments SET state='superseded',closed_at=? WHERE policy_id=? AND revision_id!=? AND state IN ('pending','acknowledged')").bind(at, policy, revision.id),
  ...earlier.map(r => env.DB.prepare("INSERT INTO policy_assignments(id,policy_id,revision_id,person_id,assigned_by,assigned_at,due_date,state) VALUES(?,?,?,?,?,?,?,'pending') ON CONFLICT(revision_id,person_id) DO NOTHING").bind(crypto.randomUUID(), policy, revision.id, r.person_id, actor.name, at, due)),
  auditStatement(env, actor, 'policy.reassigned', 'policy:' + policy, now, 'succeeded', `version ${revision.version} to ${earlier.length} people due ${due}`, { revision: revision.version }),
 ])
 await syncAttestations(env, now)
 return earlier.length
}
// Only the signed-in person acknowledges, and only the exact text they were shown.
export async function acknowledge(env: Bindings, operator: { id: string; email: string; displayName: string }, person: string, assignment: string, input: Input, now: Date) {
 const row = await env.DB.prepare('SELECT a.*,r.version,r.body_sha256,r.status AS revision_status FROM policy_assignments a JOIN policy_revisions r ON r.id=a.revision_id WHERE a.id=? AND a.person_id=?').bind(assignment, person).first<Assignment & { version: number; body_sha256: string; revision_status: string }>()
 if (!row) throw new Refusal('Assignment not found.', 404)
 if (row.state !== 'pending') throw new Refusal('This assignment is not waiting for you.', 409)
 if (row.revision_status !== 'published') throw new Refusal('A newer version replaced this one; acknowledge the current version.', 409)
 if (input.body_sha256 !== row.body_sha256) throw new Refusal('The text you read is not the published revision; reload it.', 409)
 const at = now.toISOString()
 await env.DB.batch([
  env.DB.prepare('INSERT INTO policy_acknowledgments(id,assignment_id,person_id,operator_id,operator_email,revision_id,version,body_sha256,acknowledged_at) VALUES(?,?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(), assignment, person, operator.id, operator.email, row.revision_id, row.version, row.body_sha256, at),
  env.DB.prepare("UPDATE policy_assignments SET state='acknowledged',closed_at=? WHERE id=? AND state='pending'").bind(at, assignment),
  auditStatement(env, { id: operator.id, name: operator.displayName }, 'policy.acknowledged', 'policy:' + row.policy_id, now, 'succeeded', `version ${row.version} by ${operator.email}`, { revision: row.version }),
 ])
 await syncAttestations(env, now)
}
export async function addException(env: Bindings, actor: Actor, policy: string, input: Input, now: Date) {
 const person = typeof input.person_id === 'string' && input.person_id ? input.person_id : null, until = text(input, 'expires_at', 10)
 if (person && !await env.DB.prepare('SELECT 1 FROM people WHERE id=?').bind(person).first()) throw new Refusal('Choose a person from People.')
 if (!validDate(until) || until <= now.toISOString().slice(0, 10)) throw new Refusal('An exception needs a future expiry date.')
 const reason = text(input, 'reason', 500)
 await env.DB.batch([env.DB.prepare('INSERT INTO policy_exceptions(id,policy_id,person_id,reason,approved_by,approved_at,expires_at) VALUES(?,?,?,?,?,?,?)').bind(crypto.randomUUID(), policy, person, reason, actor.name, now.toISOString(), until + 'T23:59:59.999Z'), auditStatement(env, actor, 'policy.exception', 'policy:' + policy, now, 'succeeded', `${person ?? 'everyone'} until ${until}`, { reason })])
 await syncAttestations(env, now)
}
// A departure closes open work, keeps every acknowledgment, ends sign-in access
// and asks for the handover of everything the person still holds (LIFECYCLE-002).
export async function depart(env: Bindings, actor: Actor, request: Request, person: string, reason: string, now: Date) {
 const row = await env.DB.prepare('SELECT id,email FROM people WHERE id=?').bind(person).first<{ id: string; email: string }>()
 if (!row) throw new Refusal('Person not found.', 404)
 if (await env.DB.prepare('SELECT 1 FROM people_departures WHERE person_id=?').bind(person).first()) throw new Refusal('This departure is already recorded.', 409)
 const auth = operatorAuth(env), operator = (await auth.listOperators(request)).find(o => o.email.toLowerCase() === row.email.toLowerCase() && o.role !== 'owner')
 let outcome = 'no Evidence sign-in account'
 if (operator && operator.status === 'active') { await auth.setOperatorStatus(request, operator.id, 'inactive'); outcome = 'sign-in account deactivated' }
 else if (operator) outcome = `sign-in account ${operator.status}`
 const at = now.toISOString()
 await env.DB.batch([
  env.DB.prepare('INSERT INTO people_departures(person_id,departed_at,recorded_by,reason,access_outcome) VALUES(?,?,?,?,?)').bind(person, at, actor.name, reason, outcome),
  env.DB.prepare("UPDATE policy_assignments SET state='departed',closed_at=? WHERE person_id=? AND state='pending'").bind(at, person),
  auditStatement(env, actor, 'person.departed', 'person:' + person, now, 'succeeded', outcome, { reason }),
 ])
 await syncAttestations(env, now)
 const handover = await requestHandover(env, person, now, false)
 return { outcome, handover }
}
export async function invite(env: Bindings, request: Request, actor: Actor, person: string, now: Date) {
 const row = await env.DB.prepare('SELECT id,name,email FROM people WHERE id=?').bind(person).first<{ id: string; name: string; email: string }>()
 if (!row) throw new Refusal('Person not found.', 404)
 if (await env.DB.prepare('SELECT 1 FROM people_departures WHERE person_id=?').bind(person).first()) throw new Refusal('This person has left.', 409)
 try { await operatorAuth(env).invite(request, { email: row.email, displayName: row.name, role: 'member', returnTo: '/me' }) }
 catch (error) {
  if (!(error instanceof AuthError)) throw error
  const messages: Record<string, string> = {
   invitation_conflict: 'This address already has an account or a different invitation. Check its access before inviting again.',
   mail_unavailable: 'The invitation could not be delivered. Check the sign-in mail settings before trying again.',
   rate_limited: 'Too many invitations were requested. Wait a few minutes before trying again.',
   email_not_allowed: 'This email address is not allowed to sign in here.',
  }
  throw new Refusal(messages[error.code] ?? 'The invitation could not be created. Check this person’s account access before trying again.', error.status)
 }
 await auditStatement(env, actor, 'person.invited', 'person:' + person, now).run()
 return { name: row.name, email: row.email }
}
// Each person's attestation state: the attestation test fails while any assignment is overdue.
export async function syncAttestations(env: Bindings, now: Date) {
 if (!await capabilityAllowed(env,'schedules')) return 0
 if (!await env.DB.prepare("SELECT 1 FROM tests WHERE catalogue_id='attest.acknowledged'").first()) return 0
 const today = now.toISOString().slice(0, 10), at = now.toISOString()
 const rows = (await env.DB.prepare("SELECT p.id,p.name,p.email,SUM(a.state='pending') AS pending,SUM(a.state='pending' AND a.due_date<? AND NOT EXISTS(SELECT 1 FROM policy_exceptions e WHERE e.policy_id=a.policy_id AND (e.person_id IS NULL OR e.person_id=a.person_id) AND e.expires_at>?)) AS overdue,SUM(a.state='acknowledged') AS acknowledged FROM policy_assignments a JOIN people p ON p.id=a.person_id WHERE p.id NOT IN (SELECT person_id FROM people_departures) GROUP BY p.id").bind(today, at).all<{ id: string; name: string; email: string; pending: number; overdue: number; acknowledged: number }>()).results
 const written = await upsertRegister(env, 'attestation.person', { fields: { pending: 'number', overdue: 'number', acknowledged: 'number' }, required: [] }, rows.map(r => ({ uniqueId: r.id, displayName: `${r.name} <${r.email}>`, attributes: { pending: r.pending, overdue: r.overdue, acknowledged: r.acknowledged } })), { kind: 'source-observed', ref: 'attestations:register', label: 'Evidence attestation register' }, now)
 const ids = written.results.filter(r => r.id && r.outcome !== 'removed').map(r => r.id!)
 if (ids.length) await env.DB.prepare('UPDATE resources SET observed_at=? WHERE id IN (SELECT value FROM json_each(?))').bind(at, JSON.stringify(ids)).run()
 if (written.changed.length) await runForType(env, 'attestation.person', now)
 return rows.length
}
// Reminders three days before the due date and once overdue, to the person.
export async function attestationReminders(env: Bindings, now: Date) {
 const soon = new Date(now.getTime() + 3 * DAY).toISOString().slice(0, 10), today = now.toISOString().slice(0, 10)
 const rows = (await env.DB.prepare("SELECT a.id,a.due_date,p.email,po.title,r.version FROM policy_assignments a JOIN people p ON p.id=a.person_id JOIN policies po ON po.id=a.policy_id JOIN policy_revisions r ON r.id=a.revision_id WHERE a.state='pending' AND a.due_date<=?").bind(soon).all<{ id: string; due_date: string; email: string; title: string; version: number }>()).results
 let count = 0
 for (const a of rows) {
  const overdue = a.due_date < today
  if (sent(await sendFollowup(env, { kind: overdue ? 'attestation-overdue' : 'attestation-due', subject: a.id, cycle: a.due_date, recipient: a.email, title: `${overdue ? 'Overdue' : 'Due soon'}: acknowledge the ${a.title} (version ${a.version})`, text: `Please read and acknowledge the ${a.title}, version ${a.version}, by ${a.due_date}.\n\nSign in to Evidence: ${env.AUTH_ORIGIN}/me`, link: `${env.AUTH_ORIGIN}/me` }, now))) count++
 }
 return count
}
