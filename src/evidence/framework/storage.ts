import type { Bindings } from '../../auth.server'
import { auditStatement, text, type Actor, type Input } from '../door'
import { libraryControl } from '../library'
import { adoptionStatements } from '../program/storage'
import { Refusal } from '../upload'
import { controlIds, knownControls, requireValid, type Definition, type Difference, type Framework, type FrameworkRequirement, type Mapping, type Revision } from './model'
export const frameworks = async (env: Bindings) => (await env.DB.prepare('SELECT * FROM custom_frameworks ORDER BY created_at,id').all<Framework>()).results
export async function requireFramework(env: Bindings, id: string) { const row = await env.DB.prepare('SELECT * FROM custom_frameworks WHERE id=?').bind(id).first<Framework>(); if (!row) throw new Refusal('Custom framework not found.', 404); return row }
export const revisions = async (env: Bindings, id: string) => (await env.DB.prepare('SELECT * FROM custom_framework_revisions WHERE framework_id=? ORDER BY revision').bind(id).all<Revision>()).results
export const mappingHistory = async (env: Bindings, id: string) => (await env.DB.prepare('SELECT m.* FROM custom_framework_mappings m JOIN custom_framework_requirements q ON q.id=m.requirement_id WHERE q.framework_id=? ORDER BY m.framework_revision,m.rowid').bind(id).all<Mapping>()).results
export async function requirements(env: Bindings, id: string) {
 const rows = (await env.DB.prepare('SELECT * FROM custom_framework_requirements WHERE framework_id=? ORDER BY ref').bind(id).all<Omit<FrameworkRequirement, 'mappings'>>()).results
 const history = await mappingHistory(env, id), current = new Map<string, Mapping>()
 for (const m of history) current.set(m.requirement_id + '|' + m.control_id, m)
 return rows.map(r => ({ ...r, mappings: [...current.values()].filter(m => m.requirement_id === r.id && m.decision === 'mapped').map(m => m.control_id).sort() }))
}
export const emptyDiff = (): Difference => ({ added: [], changed: [], removed: [] })
export function mappingStatement(env: Bindings, requirement: string, control: string, decision: 'mapped' | 'unmapped', origin: 'manual' | 'import', actor: Actor, now: Date, reason: string, revision: number) {
 return env.DB.prepare('INSERT INTO custom_framework_mappings(id,requirement_id,control_id,decision,origin,actor_id,actor_name,at,reason,framework_revision) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(), requirement, control, decision, origin, actor.id, actor.name, now.toISOString(), reason, revision)
}
export function revisionStatements(env: Bindings, framework: Framework, rows: FrameworkRequirement[], diff: Difference, actor: Actor, now: Date, reason: string, exhibit: { object_key: string; filename: string; size: number; media_type: string; sha256: string } | null = null) {
 const revision = framework.revision + 1
 return [
  // Unique revision is the transactional concurrency fence for the full batch.
  env.DB.prepare('INSERT INTO custom_framework_revisions(id,framework_id,revision,snapshot_json,diff_json,actor_id,actor_name,at,reason,object_key,filename,size,media_type,sha256) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(), framework.id, revision, JSON.stringify({ framework: { ...framework, revision }, requirements: rows }), JSON.stringify(diff), actor.id, actor.name, now.toISOString(), reason, exhibit?.object_key ?? null, exhibit?.filename ?? null, exhibit?.size ?? null, exhibit?.media_type ?? null, exhibit?.sha256 ?? null),
  env.DB.prepare('UPDATE custom_frameworks SET revision=? WHERE id=? AND revision=?').bind(revision, framework.id, framework.revision),
  auditStatement(env, actor, 'framework.revised', 'framework:' + framework.id, now, 'succeeded', reason, { reason, revision }),
 ]
}
export async function commit(env: Bindings, statements: D1PreparedStatement[]) { try { await env.DB.batch(statements) } catch (error) { if (/UNIQUE constraint failed: custom_framework_revisions/.test(String(error))) throw new Refusal('The framework changed after review. Review the current revision again.', 409); throw error } }
export async function createFramework(env: Bindings, actor: Actor, input: Input, now: Date) {
 const row: Framework = { id: crypto.randomUUID(), name: text(input, 'name', 200), revision: 0, created_at: now.toISOString() }
 await commit(env, [env.DB.prepare('INSERT INTO custom_frameworks(id,name,revision,created_at) VALUES(?,?,?,?)').bind(row.id, row.name, 0, row.created_at), ...revisionStatements(env, row, [], emptyDiff(), actor, now, 'Custom framework created')])
 return { id: row.id, revision: 1 }
}
function definition(input: Input): Definition { return { ref: text(input, 'ref', 120), title: text(input, 'title', 300), description: text(input, 'description', 10000, true), section: text(input, 'section', 300, true), control_ids: controlIds(typeof input.control_ids === 'string' ? input.control_ids : '') } }
export async function saveRequirement(env: Bindings, actor: Actor, id: string, requirementId: string | null, input: Input, now: Date) {
 const framework = await requireFramework(env, id), rows = await requirements(env, id), value = definition(input)
 requireValid(value, await knownControls(env))
 const old = requirementId ? rows.find(r => r.id === requirementId) : null
 if (requirementId && !old) throw new Refusal('Requirement not found.', 404)
 if (old && value.ref !== old.ref) throw new Refusal('The stable requirement ID cannot change; add a new requirement instead.')
 if (!old && rows.some(r => r.ref === value.ref)) throw new Refusal('That requirement ID already exists, including retained history.', 409)
 const reason = text(input, 'reason', 500, !old) || 'Manual requirement created', revision = framework.revision + 1
 const row: FrameworkRequirement = { id: old?.id ?? crypto.randomUUID(), framework_id: id, ref: value.ref, title: value.title, description: value.description, section: value.section, removed_at: null, created_at: old?.created_at ?? now.toISOString(), mappings: old?.mappings ?? [] }
 // Requirement edits leave mappings alone; a new requirement may start with explicit mappings.
 if (!old) row.mappings = value.control_ids
 const next = old ? rows.map(r => r.id === old.id ? row : r) : [...rows, row], diff = emptyDiff(); (old ? diff.changed : diff.added).push(row.ref)
 const statements = old ? [env.DB.prepare('UPDATE custom_framework_requirements SET title=?,description=?,section=?,removed_at=NULL WHERE id=?').bind(row.title,row.description,row.section,row.id)] : [env.DB.prepare('INSERT INTO custom_framework_requirements(id,framework_id,ref,title,description,section,removed_at,created_at) VALUES(?,?,?,?,?,?,?,?)').bind(row.id,id,row.ref,row.title,row.description,row.section,null,row.created_at)]
 statements.push(...await adoptionStatements(env, row.mappings.map(libraryControl).filter((x): x is NonNullable<typeof x> => !!x), now))
 if (!old) for (const control of row.mappings) statements.push(mappingStatement(env,row.id,control,'mapped','manual',actor,now,reason,revision))
 await commit(env, [...revisionStatements(env,framework,next,diff,actor,now,reason), ...statements])
 return { id: row.id, framework_id: id, revision }
}
export async function decideMapping(env: Bindings, actor: Actor, id: string, requirementId: string, input: Input, now: Date) {
 const framework = await requireFramework(env,id), rows = await requirements(env,id), row = rows.find(r => r.id === requirementId)
 if (!row || row.removed_at) throw new Refusal('Active requirement not found.',404)
 const control = text(input,'control_id',200), reason = text(input,'reason',500), decision = text(input,'decision',20)
 if (!['mapped','unmapped'].includes(decision)) throw new Refusal('Choose mapped or unmapped.')
 requireValid({ ref: row.ref, title: row.title, description: row.description, section: row.section, control_ids: [control] }, await knownControls(env))
 if (row.mappings.includes(control) === (decision === 'mapped')) throw new Refusal('This mapping decision is already current.',409)
 row.mappings = decision === 'mapped' ? [...row.mappings,control].sort() : row.mappings.filter(c => c !== control)
 const diff = emptyDiff(); diff.changed.push(row.ref)
 await commit(env,[...revisionStatements(env,framework,rows,diff,actor,now,reason),...await adoptionStatements(env,[libraryControl(control)].filter((x): x is NonNullable<typeof x> => !!x),now),mappingStatement(env,row.id,control,decision as 'mapped' | 'unmapped','manual',actor,now,reason,framework.revision+1)])
 return { framework_id: id, requirement_id: row.id, revision: framework.revision+1 }
}
