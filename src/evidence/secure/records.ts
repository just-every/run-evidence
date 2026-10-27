import type { Bindings } from '../../auth.server'
import { auditStatement, text, type Actor, type Input } from '../door'
import { Refusal } from '../upload'
import type { Delegate } from '../authz/roles'
import type { RestrictedState } from '../view'
// SECURE-001: a sensitive record stays private. The owner and a named need-to-know
// holder read it; a manager, auditor or reviewer does not unless the owner grants
// that person or publishes the record. Every read, refusal and decision is audited.
const system = { id: 'unauthenticated', name: 'Evidence', kind: 'system' as const }
export const disclosure = (env: Bindings, kind: string, subject: string, actor: string, detail: string, now: Date) =>
 env.DB.prepare('INSERT INTO disclosure_events(id,at,kind,subject,actor,detail) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(), now.toISOString(), kind, subject, actor, detail.slice(0, 500))

export const classOf = (env: Bindings, receipt: string) => env.DB.prepare('SELECT class FROM record_classes WHERE receipt_id=?').bind(receipt).first<{ class: string }>()
export async function sensitiveIds(env: Bindings, ids?: string[]) {
 const rows = ids ? (ids.length ? (await env.DB.prepare(`SELECT receipt_id FROM record_classes WHERE receipt_id IN (${ids.map(() => '?').join(',')})`).bind(...ids).all<{ receipt_id: string }>()).results : []) : (await env.DB.prepare('SELECT receipt_id FROM record_classes').all<{ receipt_id: string }>()).results
 return new Set(rows.map(r => r.receipt_id))
}
// Sensitive receipts that no reviewer or auditor may see: sensitive and not published.
export async function withheld(env: Bindings) {
 return new Set((await env.DB.prepare('SELECT c.receipt_id FROM record_classes c WHERE NOT EXISTS(SELECT 1 FROM record_publications p WHERE p.receipt_id=c.receipt_id AND p.revoked_at IS NULL)').all<{ receipt_id: string }>()).results.map(r => r.receipt_id))
}
export const withheldSql = (column: string) => `NOT EXISTS(SELECT 1 FROM record_classes c WHERE c.receipt_id=${column} AND NOT EXISTS(SELECT 1 FROM record_publications p WHERE p.receipt_id=c.receipt_id AND p.revoked_at IS NULL))`

// One read decision. Returns whether this actor may read the record, and records it.
export async function guardRead(env: Bindings, actor: Actor, delegate: Delegate | undefined, receipt: string, now: Date, how: 'view' | 'download') {
 if (!await classOf(env, receipt)) return true
 const held = !delegate || !!await env.DB.prepare('SELECT 1 FROM record_grants WHERE receipt_id=? AND email=? AND revoked_at IS NULL').bind(receipt, delegate.email).first()
 await env.DB.batch(held ? [auditStatement(env, actor, 'record.read', 'receipt:' + receipt, now, 'succeeded', how)] : [
  auditStatement(env, actor, 'record.read-refused', 'receipt:' + receipt, now, 'refused', how + ': no need-to-know grant'),
  disclosure(env, 'unauthorized-read', 'receipt:' + receipt, actor.name, how + ' refused: no need-to-know grant', now),
 ])
 return held
}
// A reviewer or auditor asked for a record that is sensitive and unpublished.
export async function refusePublication(env: Bindings, subject: string, who: string, now: Date) {
 await env.DB.batch([
  auditStatement(env, system, 'record.publication-refused', subject, now, 'refused', 'sensitive and not published: ' + who),
  disclosure(env, 'unpublished-record-request', subject, who, 'refused: sensitive and not published', now),
 ])
}

export async function classify(env: Bindings, actor: Actor, receipt: string, input: Input, now: Date) {
 const reason = text(input, 'reason', 500)
 if (!await env.DB.prepare('SELECT 1 FROM receipts WHERE id=?').bind(receipt).first()) throw new Refusal('Receipt not found.', 404)
 await env.DB.batch([
  env.DB.prepare("INSERT INTO record_classes(receipt_id,class,reason,set_by,set_name,set_at) VALUES(?,'sensitive',?,?,?,?) ON CONFLICT(receipt_id) DO NOTHING").bind(receipt, reason, actor.id, actor.name, now.toISOString()),
  auditStatement(env, actor, 'record.classified', 'receipt:' + receipt, now, 'succeeded', 'sensitive', { reason }),
 ])
 return { receipt, class: 'sensitive' }
}
export async function grantRead(env: Bindings, actor: Actor, receipt: string, input: Input, now: Date) {
 const email = text(input, 'email', 254).toLowerCase(), reason = text(input, 'reason', 500), id = crypto.randomUUID()
 if (!await classOf(env, receipt)) throw new Refusal('Only a sensitive record takes need-to-know grants.', 409)
 if (!await env.DB.prepare('SELECT 1 FROM oa_operators WHERE email=? AND status=\'active\'').bind(email).first()) throw new Refusal('Grant to a person who has an account.', 409)
 try { await env.DB.batch([env.DB.prepare('INSERT INTO record_grants(id,receipt_id,email,reason,granted_by,granted_name,granted_at) VALUES(?,?,?,?,?,?,?)').bind(id, receipt, email, reason, actor.id, actor.name, now.toISOString()), auditStatement(env, actor, 'record.grant', 'receipt:' + receipt, now, 'succeeded', email, { reason })]) } catch { throw new Refusal('That person already holds a grant.', 409) }
 return { id, receipt, email }
}
export async function revokeRead(env: Bindings, actor: Actor, receipt: string, grant: string, now: Date) {
 const done = await env.DB.prepare('UPDATE record_grants SET revoked_at=?,revoked_by=? WHERE id=? AND receipt_id=? AND revoked_at IS NULL').bind(now.toISOString(), actor.id, grant, receipt).run()
 if (!done.meta.changes) throw new Refusal('Grant not found.', 404)
 await auditStatement(env, actor, 'record.grant-revoked', 'receipt:' + receipt, now).run()
 return { revoked: true }
}
export async function publish(env: Bindings, actor: Actor, receipt: string, input: Input, now: Date) {
 const reason = text(input, 'reason', 500), id = crypto.randomUUID()
 if (!await classOf(env, receipt)) throw new Refusal('Only a sensitive record needs an explicit publication.', 409)
 try { await env.DB.batch([env.DB.prepare('INSERT INTO record_publications(id,receipt_id,reason,decided_by,decided_name,decided_at) VALUES(?,?,?,?,?,?)').bind(id, receipt, reason, actor.id, actor.name, now.toISOString()), auditStatement(env, actor, 'record.published', 'receipt:' + receipt, now, 'succeeded', 'to reviewers and auditors', { reason })]) } catch { throw new Refusal('Already published.', 409) }
 return { id, receipt }
}
export async function unpublish(env: Bindings, actor: Actor, receipt: string, now: Date) {
 const done = await env.DB.prepare('UPDATE record_publications SET revoked_at=?,revoked_by=? WHERE receipt_id=? AND revoked_at IS NULL').bind(now.toISOString(), actor.id, receipt).run()
 if (!done.meta.changes) throw new Refusal('Not published.', 404)
 await auditStatement(env, actor, 'record.unpublished', 'receipt:' + receipt, now).run()
 return { unpublished: true }
}
export async function recordState(env: Bindings, receipt: string): Promise<RestrictedState> {
 const [cls, grants, pub] = await env.DB.batch([
  env.DB.prepare('SELECT reason,set_name,set_at FROM record_classes WHERE receipt_id=?').bind(receipt),
  env.DB.prepare('SELECT id,email,reason,granted_name,granted_at FROM record_grants WHERE receipt_id=? AND revoked_at IS NULL ORDER BY granted_at').bind(receipt),
  env.DB.prepare('SELECT reason,decided_name,decided_at FROM record_publications WHERE receipt_id=? AND revoked_at IS NULL').bind(receipt),
 ])
 return { sensitive: (cls.results[0] ?? null) as RestrictedState['sensitive'], grants: grants.results as RestrictedState['grants'], publication: (pub.results[0] ?? null) as RestrictedState['publication'] }
}
