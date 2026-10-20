import type { Bindings } from '../../auth.server'
import { validDate } from '../model'
import { Refusal } from '../upload'
import { auditStatement, oneOf, text, type Actor, type Input } from '../door'
import { libraryControls } from '../library'
import { reviewStates } from '../reviews/schedule'
// Policies: drafts, exact-revision decisions, publication and an annual review
// deadline. Publishing needs the approved revision's exact text fingerprint.
export const templateTitles = [...new Set(libraryControls.flatMap(c => c.policies))].sort()
const digest = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), b => b.toString(16).padStart(2, '0')).join('')
export interface PolicyRow { id: string; title: string; owner_person_id: string | null; created_at: string; updated_at: string; template_id: string | null }
export interface RevisionRow { id: string; policy_id: string; version: number; body: string; body_sha256: string; status: string; drafted_by: string; drafted_at: string; decided_by: string | null; decided_at: string | null; decision_note: string | null; approved_sha256: string | null; published_at: string | null; effective_date: string | null; review_due: string | null }
export async function draftPolicy(env: Bindings, actor: Actor, input: Input, now: Date) {
 const title = text(input, 'title', 200), body = text(input, 'body', 200000), at = now.toISOString()
 const existing = await env.DB.prepare('SELECT * FROM policies WHERE title=?').bind(title).first<PolicyRow>()
 const policy = existing?.id ?? crypto.randomUUID(), owner = typeof input.owner_person_id === 'string' && input.owner_person_id ? input.owner_person_id : existing?.owner_person_id ?? null
 if (owner && !await env.DB.prepare('SELECT 1 FROM people WHERE id=?').bind(owner).first()) throw new Refusal('Choose a policy owner from People.')
 const version = Number((await env.DB.prepare('SELECT MAX(version) AS n FROM policy_revisions WHERE policy_id=?').bind(policy).first<{ n: number | null }>())?.n ?? 0) + 1, revision = crypto.randomUUID()
 await env.DB.batch([
  existing ? env.DB.prepare('UPDATE policies SET owner_person_id=?,updated_at=? WHERE id=?').bind(owner, at, policy) : env.DB.prepare('INSERT INTO policies(id,title,owner_person_id,created_at,updated_at) VALUES(?,?,?,?,?)').bind(policy, title, owner, at, at),
  env.DB.prepare("INSERT INTO policy_revisions(id,policy_id,version,body,body_sha256,status,drafted_by,drafted_at) VALUES(?,?,?,?,?,'draft',?,?)").bind(revision, policy, version, body, await digest(body), actor.name, at),
  auditStatement(env, actor, 'policy.drafted', 'policy:' + policy, now, 'succeeded', `version ${version}`, { revision: version }),
 ])
 return { policy, revision, version }
}
export async function requireRevision(env: Bindings, policy: string, revision: string) {
 const row = await env.DB.prepare('SELECT * FROM policy_revisions WHERE id=? AND policy_id=?').bind(revision, policy).first<RevisionRow>()
 if (!row) throw new Refusal('Policy revision not found.', 404)
 return row
}
// A decision names the exact text it read; a changed fingerprint is refused.
export async function decide(env: Bindings, actor: Actor, policy: string, revision: string, input: Input, now: Date) {
 const row = await requireRevision(env, policy, revision), decision = oneOf(input, 'decision', ['approved', 'rejected'] as const), note = text(input, 'note', 1000, true)
 if (row.status !== 'draft') throw new Refusal('Only a draft revision can be decided.', 409)
 if (input.body_sha256 !== row.body_sha256) throw new Refusal('Review the exact revision: its text fingerprint does not match what you approved.', 409)
 await env.DB.batch([env.DB.prepare("UPDATE policy_revisions SET status=?,decided_by=?,decided_at=?,decision_note=?,approved_sha256=? WHERE id=? AND status='draft'").bind(decision, actor.name, now.toISOString(), note, decision === 'approved' ? row.body_sha256 : null, revision), auditStatement(env, actor, 'policy.' + decision, 'policy:' + policy, now, 'succeeded', `version ${row.version}`, { reason: note, revision: row.version })])
}
export async function publish(env: Bindings, actor: Actor, policy: string, revision: string, input: Input, now: Date) {
 const row = await requireRevision(env, policy, revision)
 if (row.status !== 'approved' || row.approved_sha256 !== row.body_sha256) throw new Refusal('Only an approved revision can be published.', 409)
 const effective = typeof input.effective_date === 'string' && input.effective_date ? input.effective_date : now.toISOString().slice(0, 10)
 if (!validDate(effective)) throw new Refusal('The effective date must be a real date.')
 const due = new Date(effective + 'T00:00:00Z'); due.setUTCFullYear(due.getUTCFullYear() + 1)
 await env.DB.batch([
  env.DB.prepare("UPDATE policy_revisions SET status='superseded' WHERE policy_id=? AND status='published'").bind(policy),
  env.DB.prepare("UPDATE policy_revisions SET status='published',published_at=?,effective_date=?,review_due=? WHERE id=? AND status='approved'").bind(now.toISOString(), effective, due.toISOString().slice(0, 10), revision),
  env.DB.prepare('UPDATE policies SET updated_at=? WHERE id=?').bind(now.toISOString(), policy),
  auditStatement(env, actor, 'policy.published', 'policy:' + policy, now, 'succeeded', `version ${row.version}`, { revision: row.version }),
 ])
}
export async function policyList(env: Bindings, now: Date) {
 const policies = (await env.DB.prepare('SELECT p.*,o.name AS owner_name,(SELECT departed_at FROM people_departures d WHERE d.person_id=p.owner_person_id) AS owner_left_at FROM policies p LEFT JOIN people o ON o.id=p.owner_person_id ORDER BY p.title').all<PolicyRow & { owner_name: string | null; owner_left_at: string | null }>()).results
 const revisions = (await env.DB.prepare('SELECT id,policy_id,version,status,body_sha256,drafted_by,drafted_at,decided_by,decided_at,decision_note,published_at,effective_date,review_due FROM policy_revisions ORDER BY version').all<Omit<RevisionRow, 'body' | 'approved_sha256'>>()).results
 // CADENCE-001: the review cycle comes from the policy's review schedule (default annual from its last review).
 const reviews = new Map((await reviewStates(env, now)).filter(s => s.kind === 'policy').map(s => [s.id, s.review]))
 return policies.map(p => { const own = revisions.filter(r => r.policy_id === p.id), published = own.find(r => r.status === 'published') ?? null, review = reviews.get(p.id) ?? null; return { ...p, revisions: own, published: published ? { ...published, review_due: review?.due ?? published.review_due } : null, review, review_state: !published ? 'not published' : review?.state === 'overdue' ? 'review overdue' : 'current' } })
}
