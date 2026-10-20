import type { Bindings } from '../../auth.server'
import { Refusal } from '../upload'
import { auditStatement, text, type Actor, type Input } from '../door'
import { edition, frameworks, isLibraryRevision, latestLibraryRevision, latestEdition, libraryControl, libraryRevisions, mappedControls } from '../library'
import { acceptedLibraryRevision } from './library-revision'
import { adoptionStatements, programs } from './storage'
// LIBRARY-001: newer shipped library revisions wait as reviewable change sets.
// Current mappings stay at the accepted revision until the owner accepts a
// later one; each test run records the revision it was evaluated under, and
// that record is never rewritten.
export async function libraryReview(env: Bindings) {
 const accepted = await acceptedLibraryRevision(env), active = await programs(env)
 const history = (await env.DB.prepare('SELECT revision,from_revision,actor_name,reason,at FROM library_acceptances ORDER BY revision').all<{ revision: number; from_revision: number; actor_name: string; reason: string; at: string }>()).results
 const pending = libraryRevisions.filter(r => r.revision > accepted).map(r => ({ ...r, changes: r.changes.map(x => ({
  ...x, control_title: libraryControl(x.control)!.title, framework_name: frameworks[x.framework].name,
  requirement: latestEdition(x.framework).requirements.find(q => q.ref === x.ref)!.title,
  programs: active.filter(p => p.framework === x.framework && edition(p.framework, p.edition)!.requirements.some(q => (q.successors ?? [q.ref]).includes(x.ref))).map(p => ({ id: p.id, name: p.name })),
 })) }))
 return { accepted, latest: latestLibraryRevision, pending, history }
}
export async function acceptLibraryRevision(env: Bindings, actor: Actor, revision: number, input: Input, now: Date) {
 const reason = text(input, 'reason', 1000)
 if (!isLibraryRevision(revision)) throw new Refusal('Library revision not found.', 404)
 const accepted = await acceptedLibraryRevision(env)
 if (revision <= accepted) throw new Refusal(`Library revision ${revision} is already in force.`, 409)
 const changes = libraryRevisions.filter(r => r.revision > accepted && r.revision <= revision).flatMap(r => r.changes)
 // Controls a program now maps at the accepted revision are adopted with it.
 const adopt = [...new Map((await programs(env)).flatMap(p => mappedControls(p.framework, p.edition, revision)).map(c => [c.id, c])).values()]
 await env.DB.batch([
  env.DB.prepare('INSERT INTO library_acceptances(id,revision,from_revision,changes_json,actor_id,actor_name,reason,at) VALUES(?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(), revision, accepted, JSON.stringify(changes), actor.id, actor.name, reason, now.toISOString()),
  ...await adoptionStatements(env, adopt, now, revision),
  auditStatement(env, actor, 'library.revision-accepted', 'library:' + revision, now, 'succeeded', `${accepted} -> ${revision}: ${reason}`, { reason, revision }),
 ])
 return { accepted: revision, from: accepted, changes }
}
