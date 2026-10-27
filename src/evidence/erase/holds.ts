import type { Bindings } from '../../auth.server'
import { sendFollowup, sent } from '../followup/send'

// Keep preview, the atomic confirmation guard and pending-work protection on
// the same native engagement relationships. Closed engagements retain custody.
export const holdPredicate = `((kind=? AND subject_id=?) OR kind='business' OR
 (kind='engagement' AND subject_id IN
  (SELECT engagement_id FROM privacy_exhibit_engagements WHERE exhibit_id=?)) OR
 (kind,subject_id) IN (SELECT s.kind,s.subject_id FROM privacy_exhibit_scopes s WHERE s.exhibit_id=?))`
export const holdParameters = (kind: string, subject: string) => [kind, subject, kind === 'exhibit' ? subject : '', kind === 'exhibit' ? subject : '']
export interface OverdueHold { id: string; kind: string; subject_id: string; reason: string; authorized_by: string; authorized_name: string; review_on: string }
export async function overdueHolds(env: Bindings, now: Date) {
 return (await env.DB.prepare(`SELECT id,kind,subject_id,reason,authorized_by,authorized_name,review_on
  FROM privacy_holds WHERE released_at IS NULL AND review_on<? ORDER BY review_on,id`)
  .bind(now.toISOString().slice(0,10)).all<OverdueHold>()).results
}
export async function holdReviewReminders(env: Bindings, now: Date) {
 // The retained authorizer receives the notice. Never substitute another
 // recipient or include held content in mail. Existing delivery recovery and
 // idempotency preserve failed or uncertain attempts without resending them.
 const rows = (await env.DB.prepare(`SELECT h.id,h.review_on,o.email FROM privacy_holds h
  JOIN oa_operators o ON o.id=h.authorized_by AND o.status='active'
  WHERE h.released_at IS NULL AND h.review_on<? AND NOT EXISTS
   (SELECT 1 FROM followups f WHERE f.kind='privacy-hold-review' AND f.subject_id=h.id AND f.cycle_key=h.review_on)
  ORDER BY h.review_on,h.id LIMIT 100`).bind(now.toISOString().slice(0,10)).all<{id:string;review_on:string;email:string}>()).results
 let count = 0
 for (const row of rows) if (sent(await sendFollowup(env, {
  kind: 'privacy-hold-review', subject: row.id, cycle: row.review_on, recipient: row.email,
  title: 'Legal hold review overdue', link: env.AUTH_ORIGIN + '/app/privacy',
  text: `A legal hold you authorized was due for review on ${row.review_on}. It remains active until an attributed release with a reason. Review the hold after signing in: ${env.AUTH_ORIGIN}/app/privacy`,
 }, now))) count++
 return count
}
