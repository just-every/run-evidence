import type { Bindings } from '../auth.server'
import { operatorMail } from '../mail.server.mjs'
import { escape } from './ui'
// FOLLOWUP-001 email delivery. One durable row per kind, subject and cycle
// deduplicates scheduled sends across restarts; the row id is the provider's
// idempotency key. A provider acknowledgement never means a person acted.
export interface Followup { kind: string; subject: string; cycle: string; recipient: string; title: string; text: string }
export async function sendFollowup(env: Bindings, message: Followup, now: Date) {
 const id = crypto.randomUUID(), at = now.toISOString()
 const claimed = await env.DB.prepare("INSERT INTO followups(id,kind,subject_id,cycle_key,recipient,state,created_at) VALUES(?,?,?,?,?,'pending',?) ON CONFLICT(kind,subject_id,cycle_key) DO NOTHING").bind(id, message.kind, message.subject, message.cycle, message.recipient, at).run()
 if (!claimed.meta.changes) return 'duplicate' as const
 const sender = operatorMail(env)
 let state: 'accepted' | 'failed' | 'uncertain' = 'failed', detail = 'Mail is not configured; set MAIL_PROVIDER and MAIL_FROM.'
 if (sender && env.MAIL_FROM) {
  try {
   const result = await sender.send({ deliveryId: 'evidence-followup-' + id, from: env.MAIL_FROM, to: [message.recipient], subject: message.title, text: message.text, html: `<p>${escape(message.text).replace(/\n/g, '<br>')}</p>`, headers: {} })
   state = result.status === 'accepted' || result.status === 'development' ? 'accepted' : result.status === 'uncertain' ? 'uncertain' : 'failed'
   detail = result.status === 'development' ? 'Development mail: validated and suppressed.' : `Provider ${result.status}${result.code ? ' (' + result.code + ')' : ''}`
  } catch (error) { state = 'uncertain'; detail = 'Send failed before a provider answer: ' + (error instanceof Error ? error.message : 'unknown').slice(0, 120) }
 }
 await env.DB.prepare('UPDATE followups SET state=?,detail=?,attempted_at=? WHERE id=?').bind(state, detail, now.toISOString(), id).run()
 return state
}
export const followups = async (env: Bindings, limit = 200) => (await env.DB.prepare('SELECT * FROM followups ORDER BY created_at DESC,rowid DESC LIMIT ?').bind(limit).all<{ id: string; kind: string; subject_id: string; cycle_key: string; recipient: string; state: string; detail: string; created_at: string; attempted_at: string | null }>()).results
