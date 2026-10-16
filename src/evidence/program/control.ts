import type { Bindings } from '../../auth.server'
import { validDate } from '../model'
import { Refusal } from '../upload'
import { auditStatement, list, oneOf, parseList, text, type Actor, type Input } from '../door'
import { controlsFor, edition, frameworks, isFramework } from '../library'
import { requirePerson } from './people'
import { programs } from './storage'
// PROGRAM-002: one control, mapped to several frameworks, with an accountable
// owner, contributors and scope whose every change keeps actor and reason.
export async function requireControl(env: Bindings, id: string) {
 const row = await env.DB.prepare('SELECT c.*,l.library_id,l.library_revision FROM controls c LEFT JOIN library_adoptions l ON l.control_id=c.id WHERE c.id=?').bind(id).first<{ id: string; name: string; group_name: string; created_at: string; library_id: string | null; library_revision: number | null }>()
 if (!row) throw new Refusal('Control not found.', 404)
 return row
}
export async function controlMappings(env: Bindings, id: string, libraryId: string | null) {
 const active = await programs(env)
 const library = libraryId ? active.flatMap(p => edition(p.framework, p.edition)!.requirements.filter(r => controlsFor(p.framework, p.edition, r.ref).some(c => c.id === libraryId)).map(r => ({ program_id: p.id, program: p.name, framework: frameworks[p.framework].name, edition: p.edition, ref: r.ref, title: r.title, origin: 'library' as const }))) : []
 const custom = (await env.DB.prepare('SELECT * FROM control_mappings WHERE control_id=? ORDER BY added_at,rowid').bind(id).all<{ id: string; framework: string; edition: string; ref: string; added_name: string; added_at: string; reason: string; removed_name: string | null; removed_at: string | null; removal_reason: string | null }>()).results
 return { library, custom }
}
export async function addMapping(env: Bindings, actor: Actor, id: string, input: Input, now: Date) {
 await requireControl(env, id)
 const framework = input.framework, editionId = text(input, 'edition', 40), ref = text(input, 'ref', 40), reason = text(input, 'reason', 500)
 if (!isFramework(framework) || !edition(framework, editionId)?.requirements.some(r => r.ref === ref)) throw new Refusal('Choose a requirement of a shipped framework edition.')
 if (await env.DB.prepare('SELECT 1 FROM control_mappings WHERE control_id=? AND framework=? AND edition=? AND ref=? AND removed_at IS NULL').bind(id, framework, editionId, ref).first()) throw new Refusal('That mapping already exists.', 409)
 const mapping = crypto.randomUUID()
 await env.DB.batch([env.DB.prepare('INSERT INTO control_mappings(id,control_id,framework,edition,ref,added_by,added_name,added_at,reason) VALUES(?,?,?,?,?,?,?,?,?)').bind(mapping, id, framework, editionId, ref, actor.id, actor.name, now.toISOString(), reason), auditStatement(env, actor, 'control.mapped', 'control:' + id, now, 'succeeded', `${framework} ${ref}: ${reason}`)])
 return mapping
}
export async function removeMapping(env: Bindings, actor: Actor, id: string, mapping: string, input: Input, now: Date) {
 const reason = text(input, 'reason', 500)
 const changed = await env.DB.prepare('UPDATE control_mappings SET removed_by=?,removed_name=?,removed_at=?,removal_reason=? WHERE id=? AND control_id=? AND removed_at IS NULL').bind(actor.id, actor.name, now.toISOString(), reason, mapping, id).run()
 if (!changed.meta.changes) throw new Refusal('Active mapping not found.', 404)
 await auditStatement(env, actor, 'control.unmapped', 'control:' + id, now, 'succeeded', reason).run()
}
export async function assignOwner(env: Bindings, actor: Actor, id: string, input: Input, now: Date) {
 await requireControl(env, id)
 const owner = await requirePerson(env, input.owner_person_id, 'owner'), contributors = list(input, 'contributors', 20)
 for (const c of contributors) await requirePerson(env, c, 'contributor')
 const due = typeof input.due_date === 'string' && input.due_date ? input.due_date : null
 if (due && !validDate(due)) throw new Refusal('The due date must be a real UTC date.')
 await env.DB.batch([
  env.DB.prepare('INSERT INTO control_owners(id,control_id,owner_person_id,contributors,due_date,actor_id,actor_name,reason,at) VALUES(?,?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(), id, owner.id, JSON.stringify(contributors), due, actor.id, actor.name, text(input, 'reason', 500, true) || 'Assigned', now.toISOString()),
  auditStatement(env, actor, 'control.owner-assigned', 'control:' + id, now, 'succeeded', owner.email),
 ])
}
export async function ownership(env: Bindings, id: string) {
 const rows = (await env.DB.prepare('SELECT o.*,p.name AS owner_name,p.email AS owner_email FROM control_owners o JOIN people p ON p.id=o.owner_person_id WHERE o.control_id=? ORDER BY o.at,o.rowid').bind(id).all<{ owner_person_id: string; owner_name: string; owner_email: string; contributors: string; due_date: string | null; actor_name: string; reason: string; at: string }>()).results
 const names = new Map((await env.DB.prepare('SELECT id,name FROM people').all<{ id: string; name: string }>()).results.map(p => [p.id, p.name]))
 return rows.map(r => ({ ...r, contributor_names: parseList(r.contributors).map(c => names.get(c) ?? c) }))
}
export async function changeScope(env: Bindings, actor: Actor, id: string, input: Input, now: Date) {
 await requireControl(env, id)
 const asset = text(input, 'asset', 200), action = oneOf(input, 'action', ['added', 'removed'] as const), reason = text(input, 'reason', 500)
 const inScope = (await scopeAt(env, id, now.toISOString())).includes(asset)
 if (action === 'added' && inScope) throw new Refusal('That asset is already in scope.', 409)
 if (action === 'removed' && !inScope) throw new Refusal('That asset is not in scope.', 409)
 await env.DB.batch([env.DB.prepare('INSERT INTO control_scope(id,control_id,asset,action,reason,effective_at,actor_id,actor_name) VALUES(?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(), id, asset, action, reason, now.toISOString(), actor.id, actor.name), auditStatement(env, actor, 'control.scope-' + action, 'control:' + id, now, 'succeeded', `${asset}: ${reason}`)])
}
const scopeRows = async (env: Bindings, id: string) => (await env.DB.prepare('SELECT asset,action,reason,effective_at,actor_name FROM control_scope WHERE control_id=? ORDER BY effective_at,rowid').bind(id).all<{ asset: string; action: 'added' | 'removed'; reason: string; effective_at: string; actor_name: string }>()).results
export async function scopeAt(env: Bindings, id: string, at: string) {
 const assets = new Set<string>()
 for (const r of await scopeRows(env, id)) if (r.effective_at <= at) r.action === 'added' ? assets.add(r.asset) : assets.delete(r.asset)
 return [...assets].sort()
}
// The audit-period report keeps each scope definition with its own
// denominator: a scope reduction is labelled, never applied backwards.
export async function periodReport(env: Bindings, id: string, from: string, to: string) {
 if (!validDate(from) || !validDate(to) || from > to) throw new Refusal('Choose a real audit period.')
 const rows = await scopeRows(env, id), start = from + 'T00:00:00.000Z', end = to + 'T23:59:59.999Z'
 const changes = rows.filter(r => r.effective_at > start && r.effective_at <= end)
 const segments: { from: string; to: string; assets: string[]; definition: string }[] = []
 const boundaries = [start, ...changes.map(c => c.effective_at), end]
 for (let i = 0; i < boundaries.length - 1; i++) {
  const assets = new Set<string>()
  for (const r of rows) if (r.effective_at <= boundaries[i]) r.action === 'added' ? assets.add(r.asset) : assets.delete(r.asset)
  const change = i > 0 ? changes[i - 1] : null
  segments.push({ from: boundaries[i], to: boundaries[i + 1], assets: [...assets].sort(), definition: change ? `Changed definition: ${change.asset} ${change.action} by ${change.actor_name} (${change.reason})` : 'Definition in force at period start' })
 }
 const receipts = (await env.DB.prepare('SELECT r.id,r.origin,r.covered_from,r.covered_to,r.added_at,q.name AS requirement FROM receipts r JOIN requirements q ON q.id=r.requirement_id WHERE q.control_id=? AND r.covered_to>=? AND r.covered_from<=? ORDER BY r.covered_from').bind(id, from, to).all()).results
 return { control_id: id, from, to, segments, changes, receipts }
}
