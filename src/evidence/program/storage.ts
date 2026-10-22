import type { Bindings } from '../../auth.server'
import { validDate } from '../model'
import { Refusal } from '../upload'
import { auditStatement, list, oneOf, parseList, text, type Actor, type Input } from '../door'
import { edition, editionChange, frameworks, frameworkIds, latestEdition, mappedControls, type FrameworkId, type LibraryControl } from '../library'
import { requirePerson } from './people'
import { parseFigures, programInputs, stateOf, stateRationale } from './extended'
import { statesAt } from '../library/extended/usdp-data'
import { acceptedLibraryRevision } from './library-revision'
export interface ProgramRow { id: string; framework: FrameworkId; edition: string; name: string; legal_entity: string; report_type: string | null; categories: string; products: string; teams: string; regions: string; systems: string; audit_from: string; audit_to: string; assessor: string; lead_person_id: string | null; milestones: string; created_at: string; updated_at: string }
export const reportTypes = ['Type I', 'Type II'] as const
export const programs = async (env: Bindings) => (await env.DB.prepare('SELECT * FROM programs ORDER BY created_at,id').all<ProgramRow>()).results
export const program = (env: Bindings, id: string) => env.DB.prepare('SELECT * FROM programs WHERE id=?').bind(id).first<ProgramRow>()
export async function requireProgram(env: Bindings, id: string) { const row = await program(env, id); if (!row) throw new Refusal('Program not found.', 404); return row }

// Adopt shipped library controls this installation does not hold yet: one
// control and its named proof each, with the library revision in force (the
// installation's accepted revision unless a revision is being accepted).
export async function adoptionStatements(env: Bindings, controls: LibraryControl[], now: Date, revision?: number) {
 const libraryRevision = revision ?? await acceptedLibraryRevision(env)
 const adopted = new Set((await env.DB.prepare('SELECT library_id FROM library_adoptions').all<{ library_id: string }>()).results.map(r => r.library_id))
 const rows = controls.filter(c => !adopted.has(c.id)).map(c => ({ control: crypto.randomUUID(), requirement: crypto.randomUUID(), library: c.id, name: c.id + ' · ' + c.title, group: c.group, proof: c.proof, cadence: c.cadence }))
 if (!rows.length) return []
 const data = JSON.stringify(rows), at = now.toISOString()
 return [
  env.DB.prepare("INSERT INTO controls(id,name,group_name,created_at) SELECT value->>'control',value->>'name',value->>'group',? FROM json_each(?)").bind(at, data),
  env.DB.prepare("INSERT INTO requirements(id,control_id,name,cadence,created_at) SELECT value->>'requirement',value->>'control',value->>'proof',value->>'cadence',? FROM json_each(?)").bind(at, data),
  env.DB.prepare("INSERT INTO library_adoptions(control_id,library_id,library_revision,adopted_at) SELECT value->>'control',value->>'library',?,? FROM json_each(?)").bind(libraryRevision, at, data),
 ]
}

function scope(input: Input, framework: FrameworkId) {
 const auditFrom = text(input, 'audit_from', 10), auditTo = text(input, 'audit_to', 10)
 if (!validDate(auditFrom) || !validDate(auditTo) || auditFrom > auditTo) throw new Refusal('The audit period needs real UTC dates, start on or before end.')
 const choices = framework === 'usdp' ? undefined : frameworks[framework].categories, categories = choices ? list(input, 'categories', choices.length) : []
 if (categories.some(c => !choices!.includes(c))) throw new Refusal(framework === 'soc2' ? 'Choose listed trust services categories.' : 'Choose listed roles.')
 if (framework === 'iso27701' && !categories.length) throw new Refusal('Choose at least one role: controller, processor or both.')
 const milestones = list(input, 'milestones', 20).map(m => { const [date, ...name] = m.split(/\s+/); if (!validDate(date) || !name.length) throw new Refusal('Write each milestone as a date and a name, such as 2027-01-15 Fieldwork starts.'); return { date, name: name.join(' ') } })
 return {
  name: text(input, 'name', 200), legal_entity: text(input, 'legal_entity', 200),
  report_type: framework === 'soc2' ? oneOf(input, 'report_type', reportTypes) : null, categories: JSON.stringify(categories),
  products: JSON.stringify(list(input, 'products')), teams: JSON.stringify(list(input, 'teams')), regions: JSON.stringify(list(input, 'regions')), systems: JSON.stringify(list(input, 'systems', 200)),
  audit_from: auditFrom, audit_to: auditTo, assessor: text(input, 'assessor', 200, true), milestones: JSON.stringify(milestones),
 }
}
const snapshot = (row: Record<string, unknown>) => JSON.stringify(row)
const revisionStatement = (env: Bindings, id: string, revision: number, row: Record<string, unknown>, actor: Actor, reason: string, now: Date) => env.DB.prepare('INSERT INTO program_revisions(id,program_id,revision,snapshot_json,actor_id,actor_name,reason,at) VALUES(?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(), id, revision, snapshot(row), actor.id, actor.name, reason, now.toISOString())

export async function createProgram(env: Bindings, actor: Actor, input: Input, now: Date) {
 if (typeof input.framework !== 'string' || !frameworkIds.includes(input.framework as FrameworkId)) throw new Refusal('Choose a listed framework.')
 const framework = input.framework as FrameworkId
 const editionId = typeof input.edition === 'string' && input.edition ? input.edition : latestEdition(framework).id
 if (!edition(framework, editionId)) throw new Refusal('Choose a shipped edition.')
 const fields = scope(input, framework), lead = input.lead_person_id ? (await requirePerson(env, input.lead_person_id, 'accountable lead')).id : null
 const figures = framework === 'usdp' ? parseFigures(input) : undefined
 const id = crypto.randomUUID(), at = now.toISOString()
 const row = { id, framework, edition: editionId, ...fields, lead_person_id: lead, created_at: at, updated_at: at, ...(figures ? { inputs: { figures } } : {}) }
 const chosen = parseList(fields.categories), outOfScope = framework === 'soc2' || framework === 'iso27701' ? edition(framework, editionId)!.requirements.filter(r => r.optional && !chosen.includes(r.optional)) : []
 const excluded = outOfScope.map(r => ({ ref: r.ref, rationale: framework === 'soc2' ? `Trust services category ${r.optional} is not in this report's scope.` : `The ${r.optional} role is not in this program's scope.` }))
 const libraryRevision = await acceptedLibraryRevision(env)
 if (figures) for (const r of edition(framework, editionId)!.requirements) { const state = statesAt(libraryRevision).find(s => s.code === stateOf(r.ref))!; if (!state.applies(figures, figures.consumers[state.code] ?? 0)) excluded.push({ ref: r.ref, rationale: stateRationale(figures, state.code, 1, libraryRevision) }) }
 await env.DB.batch([
  env.DB.prepare('INSERT INTO programs(id,framework,edition,name,legal_entity,report_type,categories,products,teams,regions,systems,audit_from,audit_to,assessor,lead_person_id,milestones,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id, framework, editionId, row.name, row.legal_entity, row.report_type, row.categories, row.products, row.teams, row.regions, row.systems, row.audit_from, row.audit_to, row.assessor, lead, row.milestones, at, at),
  env.DB.prepare('INSERT INTO program_editions(id,program_id,edition,effective_at,change_id) VALUES(?,?,?,?,NULL)').bind(crypto.randomUUID(), id, editionId, at),
  revisionStatement(env, id, 1, row, actor, 'Program created', now),
  ...(excluded.length ? [env.DB.prepare("INSERT INTO program_applicability(id,program_id,ref,state,rationale,actor_id,actor_name,decided_at) SELECT lower(hex(randomblob(16))),?,value->>'ref','excluded',value->>'rationale',?,?,? FROM json_each(?)").bind(id, actor.id, actor.name, at, JSON.stringify(excluded))] : []),
  ...await adoptionStatements(env, mappedControls(framework, editionId, await acceptedLibraryRevision(env)), now),
  auditStatement(env, actor, 'program.created', 'program:' + id, now, 'succeeded', frameworks[framework].name + ' ' + editionId),
 ])
 return { id }
}
export async function updateProgram(env: Bindings, actor: Actor, id: string, input: Input, now: Date) {
 const current = await requireProgram(env, id), fields = scope(input, current.framework), reason = text(input, 'reason', 500)
 const lead = input.lead_person_id ? (await requirePerson(env, input.lead_person_id, 'accountable lead')).id : null
 const revision = Number((await env.DB.prepare('SELECT MAX(revision) AS n FROM program_revisions WHERE program_id=?').bind(id).first<{ n: number }>())?.n ?? 0) + 1
 const kept = (await programInputs(env, id)).inputs, row = { ...current, ...fields, lead_person_id: lead, updated_at: now.toISOString(), ...(Object.keys(kept).length ? { inputs: kept } : {}) }
 await env.DB.batch([
  env.DB.prepare('UPDATE programs SET name=?,legal_entity=?,report_type=?,categories=?,products=?,teams=?,regions=?,systems=?,audit_from=?,audit_to=?,assessor=?,lead_person_id=?,milestones=?,updated_at=? WHERE id=?').bind(row.name, row.legal_entity, row.report_type, row.categories, row.products, row.teams, row.regions, row.systems, row.audit_from, row.audit_to, row.assessor, lead, row.milestones, row.updated_at, id),
  revisionStatement(env, id, revision, row, actor, reason, now),
  auditStatement(env, actor, 'program.updated', 'program:' + id, now, 'succeeded', reason, { reason, revision }),
 ])
}

export async function applicability(env: Bindings, id: string) {
 const { results } = await env.DB.prepare('SELECT * FROM program_applicability WHERE program_id=? ORDER BY decided_at,rowid').bind(id).all<{ ref: string; state: string; rationale: string; actor_name: string; decided_at: string }>()
 const current = new Map<string, typeof results[number]>()
 for (const row of results) current.set(row.ref, row)
 return { history: results, current }
}
export async function decideApplicability(env: Bindings, actor: Actor, id: string, input: Input, now: Date) {
 const row = await requireProgram(env, id), ref = text(input, 'ref', 40), state = oneOf(input, 'state', ['excluded', 'included'] as const), rationale = text(input, 'rationale', 1000)
 if (!edition(row.framework, row.edition)!.requirements.some(r => r.ref === ref)) throw new Refusal('Choose a requirement of this program\'s edition.')
 await env.DB.batch([
  env.DB.prepare('INSERT INTO program_applicability(id,program_id,ref,state,rationale,actor_id,actor_name,decided_at) VALUES(?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(), id, ref, state, rationale, actor.id, actor.name, now.toISOString()),
  auditStatement(env, actor, 'program.applicability', 'program:' + id, now, 'succeeded', `${ref} ${state}`),
 ])
}
const digest = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), b => b.toString(16).padStart(2, '0')).join('')
export async function recordReview(env: Bindings, actor: Actor, id: string, input: Input, now: Date) {
 await requireProgram(env, id)
 const decisions = [...(await applicability(env, id)).current.values()].map(r => [r.ref, r.state, r.rationale])
 const hash = await digest(JSON.stringify(decisions))
 await env.DB.batch([
  env.DB.prepare('INSERT INTO program_reviews(id,program_id,reviewer,notes,snapshot_hash,recorded_by,recorded_name,at) VALUES(?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(), id, text(input, 'reviewer', 200), text(input, 'notes', 2000), hash, actor.id, actor.name, now.toISOString()),
  auditStatement(env, actor, 'program.applicability-reviewed', 'program:' + id, now),
 ])
 return { snapshot_hash: hash }
}

// Changing editions is a reviewable mapping change. Accepting it moves the
// program forward from that moment; earlier results keep the edition in force.
export async function proposeEdition(env: Bindings, actor: Actor, id: string, input: Input, now: Date) {
 const row = await requireProgram(env, id), to = text(input, 'edition', 40)
 const diff = editionChange(row.framework, row.edition, to)
 if (!diff) throw new Refusal('Choose a different shipped edition of this framework.')
 if (await env.DB.prepare('SELECT 1 FROM edition_changes WHERE program_id=? AND decision IS NULL').bind(id).first()) throw new Refusal('An edition change is already waiting for review.', 409)
 const change = crypto.randomUUID()
 await env.DB.batch([
  env.DB.prepare('INSERT INTO edition_changes(id,program_id,from_edition,to_edition,diff_json,proposed_by,proposed_name,proposed_at) VALUES(?,?,?,?,?,?,?,?)').bind(change, id, row.edition, to, JSON.stringify(diff), actor.id, actor.name, now.toISOString()),
  auditStatement(env, actor, 'program.edition-proposed', 'program:' + id, now, 'succeeded', `${row.edition} -> ${to}`, { revision: row.edition }),
 ])
 return { id: change, diff }
}
export async function decideEdition(env: Bindings, actor: Actor, id: string, changeId: string, input: Input, now: Date) {
 const row = await requireProgram(env, id), decision = oneOf(input, 'decision', ['accepted', 'rejected'] as const), reason = text(input, 'reason', 1000)
 const change = await env.DB.prepare('SELECT * FROM edition_changes WHERE id=? AND program_id=?').bind(changeId, id).first<{ to_edition: string; from_edition: string; decision: string | null; diff_json: string }>()
 if (!change) throw new Refusal('Edition change not found.', 404)
 if (change.decision) throw new Refusal('This edition change was already decided.', 409)
 if (change.from_edition !== row.edition) throw new Refusal('The program edition moved since this change was proposed; propose it again.', 409)
 const at = now.toISOString(), statements = [
  env.DB.prepare('UPDATE edition_changes SET decision=?,decided_by=?,decided_name=?,decided_at=?,reason=? WHERE id=? AND decision IS NULL').bind(decision, actor.id, actor.name, at, reason, changeId),
  auditStatement(env, actor, 'program.edition-' + decision, 'program:' + id, now, 'succeeded', `${change.from_edition} -> ${change.to_edition}`, { reason, revision: decision === 'accepted' ? change.to_edition : change.from_edition }),
 ]
 if (decision === 'accepted') {
  const diff = JSON.parse(change.diff_json) as NonNullable<ReturnType<typeof editionChange>>
  const { current } = await applicability(env, id)
  const carried = diff.carried.filter(r => r.from.every(ref => current.get(ref)?.state === 'excluded'))
  const revision = Number((await env.DB.prepare('SELECT MAX(revision) AS n FROM program_revisions WHERE program_id=?').bind(id).first<{ n: number }>())?.n ?? 0) + 1
  statements.push(
   env.DB.prepare('UPDATE programs SET edition=?,updated_at=? WHERE id=?').bind(change.to_edition, at, id),
   env.DB.prepare('INSERT INTO program_editions(id,program_id,edition,effective_at,change_id) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(), id, change.to_edition, at, changeId),
   revisionStatement(env, id, revision, { ...row, edition: change.to_edition, updated_at: at }, actor, 'Edition change accepted: ' + reason, now),
   ...carried.map(r => env.DB.prepare('INSERT INTO program_applicability(id,program_id,ref,state,rationale,actor_id,actor_name,decided_at) VALUES(?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(), id, r.ref, 'excluded', `Carried at edition change from excluded ${r.from.join(', ')}: ${current.get(r.from[0])!.rationale}`, actor.id, actor.name, at)),
   ...await adoptionStatements(env, mappedControls(row.framework, change.to_edition, await acceptedLibraryRevision(env)), now),
  )
 }
 await env.DB.batch(statements)
}
export async function programHistory(env: Bindings, id: string) {
 const [revisions, editions, changes, reviews] = await env.DB.batch([
  env.DB.prepare('SELECT revision,actor_name,reason,at,snapshot_json FROM program_revisions WHERE program_id=? ORDER BY revision').bind(id),
  env.DB.prepare('SELECT edition,effective_at,change_id FROM program_editions WHERE program_id=? ORDER BY effective_at,rowid').bind(id),
  env.DB.prepare('SELECT id,from_edition,to_edition,diff_json,proposed_name,proposed_at,decision,decided_name,decided_at,reason FROM edition_changes WHERE program_id=? ORDER BY proposed_at').bind(id),
  env.DB.prepare('SELECT reviewer,notes,snapshot_hash,recorded_name,at FROM program_reviews WHERE program_id=? ORDER BY at').bind(id),
 ])
 return { revisions: revisions.results as Record<string, string>[], editions: editions.results as Record<string, string>[], changes: changes.results as Record<string, string>[], reviews: reviews.results as Record<string, string>[] }
}
