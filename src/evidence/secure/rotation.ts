import type { Bindings } from '../../auth.server'
import { auditStatement, type Actor } from '../door'
import { currentKey, keyOf, presentKeys, seal, unseal } from '../connect/custody'
// SECURE-001 key rotation: re-seal every stored credential under the current key.
// A credential whose old key is gone cannot be recovered; it is named, left as it
// is, and its owner reconnects it. Nothing is guessed or opened with another key.
const sealed = [
 { table: 'connections', key: 'id', cipher: 'secret_ciphertext', iv: 'secret_iv', aad: (id: string) => id },
 { table: 'followup_channels', key: 'id', cipher: 'secret_ciphertext', iv: 'secret_iv', aad: (id: string) => id },
 { table: 'tracker_destinations', key: 'id', cipher: 'secret_ciphertext', iv: 'secret_iv', aad: (id: string) => id },
 { table: 'tracker_destinations', key: 'id', cipher: 'hook_ciphertext', iv: 'hook_iv', aad: (id: string) => id + ':hook' },
 { table: 'trust_mail_webhooks', key: 'provider', cipher: 'secret_ciphertext', iv: 'secret_iv', aad: (id: string) => 'trust-webhook-' + id },
 { table: 'flow_declarations', key: 'id', cipher: 'secret_ciphertext', iv: 'secret_iv', aad: (id: string) => 'flow-' + id },
]
export async function custodyStatus(env: Bindings) {
 const counts: Record<string, number> = {}
 for (const s of sealed) for (const r of (await env.DB.prepare(`SELECT ${s.iv} AS iv FROM ${s.table} WHERE ${s.cipher} IS NOT NULL`).all<{ iv: string }>()).results) { const k = keyOf(r.iv); counts[k] = (counts[k] ?? 0) + 1 }
 const present = presentKeys(env), current = currentKey(env)
 return { current, present, current_present: present.includes(current), sealed_by_key: counts, unavailable: Object.keys(counts).filter(k => !present.includes(k)) }
}
export async function rotate(env: Bindings, actor: Actor, now: Date) {
 const to = currentKey(env)
 if (!presentKeys(env).includes(to)) throw new Error('The current custody key is not present.')
 let resealed = 0; const unrecoverable: string[] = []
 for (const s of sealed) {
  const rows = (await env.DB.prepare(`SELECT ${s.key} AS id,${s.cipher} AS cipher,${s.iv} AS iv FROM ${s.table} WHERE ${s.cipher} IS NOT NULL`).all<{ id: string; cipher: string; iv: string }>()).results
  for (const r of rows) {
   if (keyOf(r.iv) === to) continue
   try {
    const next = await seal(env, await unseal(env, r.cipher, r.iv, s.aad(r.id)), s.aad(r.id), to)
    // Fenced on the exact old ciphertext: a concurrent reconnect keeps its own newer secret.
    const done = await env.DB.prepare(`UPDATE ${s.table} SET ${s.cipher}=?,${s.iv}=? WHERE ${s.key}=? AND ${s.cipher}=? AND ${s.iv}=?`).bind(next.ciphertext, next.iv, r.id, r.cipher, r.iv).run()
    if (done.meta.changes) resealed++
   } catch { unrecoverable.push(`${s.table}:${r.id}`) }
  }
 }
 await env.DB.batch([
  env.DB.prepare('INSERT INTO custody_rotations(id,at,actor,to_key,resealed,unrecoverable) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(), now.toISOString(), actor.name, to, resealed, unrecoverable.length),
  auditStatement(env, actor, 'custody.rotated', 'custody:' + to, now, unrecoverable.length ? 'uncertain' : 'succeeded', `${resealed} resealed, ${unrecoverable.length} unrecoverable`),
 ])
 return { to, resealed, unrecoverable }
}
