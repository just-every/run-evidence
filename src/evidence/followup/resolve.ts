import type { Bindings } from '../../auth.server'
import { auditStatement, oneOf, text, type Actor, type Input } from '../door'
import { Refusal } from '../upload'

// LOG-001. A delivery whose provider answer was lost stays "uncertain": its
// row and its followup.sent audit entry are never rewritten and it is never
// resent. The owner records how it later resolved (checked with the person or
// the provider), with a reason, as one separate followup.resolved entry.
export const resolutions = ['delivered', 'not delivered'] as const
export interface Resolution { resolution: string; reason: string; actor_name: string; at: string }

export async function resolveDelivery(env: Bindings, actor: Actor, id: string, input: Input, now: Date) {
 const row = await env.DB.prepare('SELECT state FROM followups WHERE id=?').bind(id).first<{ state: string }>()
 if (!row) throw new Refusal('Delivery not found.', 404)
 if (row.state !== 'uncertain') throw new Refusal('Only an uncertain delivery can be resolved.', 409)
 const resolution = oneOf(input, 'resolution', resolutions), reason = text(input, 'reason', 500)
 if ((await resolved(env)).has(id)) throw new Refusal('This delivery is already resolved.', 409)
 try { await auditStatement(env, actor, 'followup.resolved', 'followup:' + id, now, 'succeeded', resolution, { reason }).run() }
 catch (error) { if (error instanceof Error && /UNIQUE/i.test(error.message)) throw new Refusal('This delivery is already resolved.', 409); throw error }
 return { id, resolution, reason }
}

export async function resolved(env: Bindings) {
 const rows = (await env.DB.prepare("SELECT substr(subject,10) AS id,detail AS resolution,reason,actor_name,at FROM product_audit WHERE action='followup.resolved' ORDER BY at").all<Resolution & { id: string }>()).results
 return new Map(rows.map(({ id, ...r }) => [id, r]))
}
