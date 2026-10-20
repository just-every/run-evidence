import { capabilityAllowed } from '../archive/capabilities'
import type { Bindings } from '../../auth.server'
import { operatorMail } from '../../mail.server.mjs'
import { escape } from '../ui'
import { auditStatement } from '../door'
import { activeChannel, deliver, type Outcome } from './channels'
import { inBusinessWindow, settings } from './settings'
// FOLLOWUP-001 delivery. One durable row per kind, subject and cycle
// deduplicates scheduled sends across restarts; the row id is the provider's
// idempotency key. Scheduled reminders wait for the business window, a paused
// subject gets nothing, and each person is reached on the channel they chose.
// A provider acknowledgement never means a person acted.
export interface Followup { kind: string; subject: string; cycle: string; recipient: string; title: string; text: string; link?: string; scheduled?: boolean }
export type SendResult = 'duplicate' | 'deferred' | 'paused' | Outcome['state']
const sender = { id: 'system', name: 'Evidence follow-ups', kind: 'system' as const }
async function email(env: Bindings, id: string, message: Followup): Promise<Outcome> {
 const sender = operatorMail(env)
 if (!sender || !env.MAIL_FROM) return { state: 'failed', detail: 'Mail is not configured; set MAIL_PROVIDER and MAIL_FROM.' }
 try {
  const result = await sender.send({ deliveryId: 'evidence-followup-' + id, from: env.MAIL_FROM, to: [message.recipient], subject: message.title, text: message.text, html: `<p>${escape(message.text).replace(/\n/g, '<br>')}</p>`, headers: {} })
  return { state: result.status === 'accepted' || result.status === 'development' ? 'accepted' : result.status === 'uncertain' ? 'uncertain' : 'failed', detail: result.status === 'development' ? 'Development mail: validated and suppressed.' : `Provider ${result.status}${result.code ? ' (' + result.code + ')' : ''}` }
 } catch (error) { return { state: 'uncertain', detail: 'Send failed before a provider answer: ' + (error instanceof Error ? error.message : 'unknown').slice(0, 120) } }
}
export async function sendFollowup(env: Bindings, message: Followup, now: Date): Promise<SendResult> {
 if (!await capabilityAllowed(env,'mail')) return 'paused'
 if (message.scheduled !== false && !inBusinessWindow(await settings(env), now)) return 'deferred'
 if (await env.DB.prepare('SELECT 1 FROM followup_pauses WHERE subject_id=? AND resumed_at IS NULL').bind(message.subject).first()) return 'paused'
 const via = (await env.DB.prepare('SELECT n.via FROM notify_preferences n JOIN people p ON p.id=n.person_id WHERE p.email=?').bind(message.recipient).first<{ via: 'email' | 'slack' | 'teams' }>())?.via ?? 'email'
 const id = crypto.randomUUID(), at = now.toISOString()
 const claimed = await env.DB.prepare("INSERT INTO followups(id,kind,subject_id,cycle_key,recipient,state,created_at,channel) VALUES(?,?,?,?,?,'pending',?,?) ON CONFLICT(kind,subject_id,cycle_key) DO NOTHING").bind(id, message.kind, message.subject, message.cycle, message.recipient, at, via).run()
 if (!claimed.meta.changes) return 'duplicate'
 let outcome: Outcome
 if (via === 'email') outcome = await email(env, id, message)
 else {
  const channel = await activeChannel(env, via)
  outcome = channel ? await deliver(env, channel, message.recipient, { title: message.title, text: message.text, link: message.link ?? env.AUTH_ORIGIN + '/app' }) : { state: 'failed', detail: `No active ${via === 'slack' ? 'Slack' : 'Teams'} connection; this person asked for ${via}.` }
  if (channel) await env.DB.prepare(outcome.revoked ? "UPDATE followup_channels SET status='needs reconnect',last_error=? WHERE id=?" : outcome.state === 'accepted' ? 'UPDATE followup_channels SET last_success_at=?,last_error=\'\' WHERE id=?' : 'UPDATE followup_channels SET last_error=? WHERE id=?').bind(outcome.state === 'accepted' ? at : outcome.detail, channel.id).run()
 }
 // LOG-001: every attempt is audited with its outcome; an uncertain one stays
 // uncertain until the owner records how it resolved (resolve.ts).
 await env.DB.batch([
  env.DB.prepare('UPDATE followups SET state=?,detail=?,attempted_at=? WHERE id=?').bind(outcome.state, outcome.detail, at, id),
  auditStatement(env, sender, 'followup.sent', 'followup:' + id, now, outcome.state === 'accepted' ? 'succeeded' : outcome.state, `${message.kind} via ${via}: ${outcome.detail}`),
 ])
 return outcome.state
}
export const sent = (result: SendResult) => result === 'accepted' || result === 'failed' || result === 'uncertain'
export const followups = async (env: Bindings, limit = 200) => (await env.DB.prepare('SELECT * FROM followups ORDER BY created_at DESC,rowid DESC LIMIT ?').bind(limit).all<{ id: string; kind: string; subject_id: string; cycle_key: string; recipient: string; state: string; detail: string; created_at: string; attempted_at: string | null; channel: string }>()).results
