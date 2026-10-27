import type { Bindings } from '../../auth.server'
import { TrackerFailure, type RemoteComment } from './client'
import type { TicketRow } from './storage'

export interface TrackerCommentSource {
 id: string; author: string; created_at: string | null; url: string | null
 truncated: boolean; received_characters: number
}
// A provider URL is a link only. Never fetch it, admit credentials in it, or
// turn a foreign/unsafe URL into a link on the owner's page.
export function commentUrl(value: unknown, fallback: string | null): string | null {
 const safe = (v: unknown) => {
  if (typeof v !== 'string' || v.length > 1200) return null
  try { const u = new URL(v); return u.protocol === 'https:' && !u.username && !u.password ? u : null } catch { return null }
 }
 const base = safe(fallback), candidate = safe(value)
 return base && candidate?.origin === base.origin ? candidate.href : base?.href ?? null
}
export function commentStatements(env: Bindings, ticket: TicketRow, comment: RemoteComment, provider: string, trigger: string, at: string): D1PreparedStatement[] {
 const eventId = crypto.randomUUID(), source: TrackerCommentSource = {
  id: comment.id, author: comment.author, created_at: Number.isFinite(Date.parse(comment.at)) ? new Date(comment.at).toISOString() : null,
  url: commentUrl(comment.url, ticket.remote_url), truncated: comment.body.length > 2000 || comment.truncated === true,
  received_characters: comment.body.length,
 }
 const detail = JSON.stringify({ event_id: eventId, ...source })
 // Do not silently truncate an identity or JSON metadata. A visible sync
 // failure leaves this read uncommitted if a provider exceeds the record bound.
 if (detail.length > 2000) throw new TrackerFailure('unavailable', 502, 'Tracker comment source metadata exceeds its record bound.')
 const unseen = 'NOT EXISTS(SELECT 1 FROM ticket_comments WHERE ticket_id=? AND remote_comment_id=?)'
 // The marker goes last in this atomic D1 batch. Competing reads check the
 // same marker inside SQL, so only the winning read writes either event.
 return [
  env.DB.prepare(`INSERT INTO obligation_events(id,obligation_id,kind,actor_id,actor_name,body,observation_id,at) SELECT ?,?,'tracker comment','tracker',?,?,NULL,? WHERE ${unseen}`).bind(eventId, ticket.obligation_id, `${comment.author} in ${provider}`, comment.body.slice(0, 2000), at, ticket.id, comment.id),
  env.DB.prepare(`INSERT INTO ticket_events(id,ticket_id,kind,remote_value,local_value,detail,trigger,at) SELECT ?,?,'comment source',NULL,NULL,?,?,? WHERE ${unseen}`).bind(crypto.randomUUID(), ticket.id, detail, trigger, at, ticket.id, comment.id),
  env.DB.prepare("INSERT INTO ticket_comments(ticket_id,remote_comment_id,direction,at) VALUES(?,?,'in',?) ON CONFLICT DO NOTHING").bind(ticket.id, comment.id, at),
 ]
}
export async function commentSources(env: Bindings, obligation: string): Promise<Map<string, TrackerCommentSource>> {
 const rows = (await env.DB.prepare("SELECT e.detail FROM ticket_events e JOIN tickets t ON t.id=e.ticket_id WHERE t.obligation_id=? AND e.kind='comment source' ORDER BY e.at,e.rowid").bind(obligation).all<{ detail: string }>()).results
 const result = new Map<string, TrackerCommentSource>()
 for (const row of rows) {
  const { event_id, ...source } = JSON.parse(row.detail) as TrackerCommentSource & { event_id: string }
  result.set(event_id, { ...source, url: commentUrl(source.url, source.url) })
 }
 return result
}
