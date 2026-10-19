import type { Bindings } from '../../auth.server'
import { auditStatement, text, type Actor, type Input } from '../door'
import { Refusal } from '../upload'
import { requireRisk, treatments } from './storage'
import { validDate } from '../model'
// Editing a risk never changes its assessments, provenance or prior method.
export async function editRisk(env: Bindings, actor: Actor, id: string, input: Input, now: Date) {
 await requireRisk(env, id)
 const title = text(input, 'title', 300), scenario = text(input, 'scenario', 4000)
 const treatment = text(input, 'treatment')
 if (!treatments.includes(treatment as typeof treatments[number])) throw new Refusal('Choose a treatment.')
 const owner = text(input, 'owner_person_id', 36, true) || null, due = text(input, 'review_due', 10, true) || null
 if (owner && !await env.DB.prepare('SELECT 1 FROM people WHERE id=?').bind(owner).first()) throw new Refusal('Choose an owner from People.')
 if (due && !validDate(due)) throw new Refusal('Choose a real review date.')
 await env.DB.batch([
  env.DB.prepare('UPDATE risks SET title=?,scenario=?,treatment=?,owner_person_id=?,review_due=?,updated_at=? WHERE id=?').bind(title, scenario, treatment, owner, due, now.toISOString(), id),
  auditStatement(env, actor, 'risk.edited', 'risk:' + id, now),
 ])
}
export async function unlinkRisk(env: Bindings, actor: Actor, id: string, input: Input, now: Date) {
 await requireRisk(env, id)
 const kind = text(input, 'kind', 20), target = text(input, 'target', 300)
 await env.DB.batch([
  env.DB.prepare('DELETE FROM risk_links WHERE risk_id=? AND kind=? AND target=?').bind(id, kind, target),
  env.DB.prepare('UPDATE risks SET assets=(SELECT json_group_array(target) FROM risk_links WHERE risk_id=? AND kind=\'asset\'),updated_at=? WHERE id=?').bind(id, now.toISOString(), id),
  auditStatement(env, actor, 'risk.unlinked', 'risk:' + id, now, 'succeeded', kind),
 ])
}
