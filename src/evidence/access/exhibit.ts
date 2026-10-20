import type { Bindings } from '../../auth.server'
import { MAX_FILE, Refusal, appendReceipt, boundedBody } from '../upload'
import { auditStatement, type Actor } from '../door'
// ACCESS-001: an app without a connector can evidence a revocation with an
// attached exhibit (an admin-console screenshot or export) instead of a newer
// account list. The owner attaches it; it is kept as an immutable receipt on
// the adopted access-review control (AC-04). A connected directory account
// closes only on a fresh source read, and a decision alone closes nothing.
export async function accessRequirement(env: Bindings) {
 return env.DB.prepare("SELECT r.id,c.name AS control_name FROM requirements r JOIN library_adoptions a ON a.control_id=r.control_id JOIN controls c ON c.id=r.control_id WHERE a.library_id='AC-04' ORDER BY r.created_at,r.rowid LIMIT 1").first<{ id: string; control_name: string }>()
}
export async function attachRevocationExhibit(env: Bindings, actor: Actor, itemId: string, request: Request, now: Date) {
 const item = await env.DB.prepare('SELECT i.review_id,i.provenance,i.account_key,i.source_label,r.name AS review,r.period_from,r.period_to,v.state FROM access_review_items i JOIN access_reviews r ON r.id=i.review_id LEFT JOIN access_revocations v ON v.item_id=i.id WHERE i.id=?').bind(itemId).first<{ review_id: string; provenance: string; account_key: string; source_label: string; review: string; period_from: string; period_to: string; state: string | null }>()
 if (!item) throw new Refusal('Item not found.', 404)
 if (item.provenance !== 'manually-asserted') throw new Refusal('A connected directory account is verified revoked only by a fresh source read, never by an exhibit.', 409)
 if (!item.state) throw new Refusal('Only a revoke decision waits for revocation evidence.', 409)
 if (item.state === 'verified') throw new Refusal('This revocation is already evidenced.', 409)
 const requirement = await accessRequirement(env)
 if (!requirement) throw new Refusal('Start a program with the access-review control (AC-04) first; its requirement keeps the exhibit.', 409)
 if (!request.headers.get('content-type')?.startsWith('multipart/form-data;')) throw new Refusal('Upload the exhibit as a file.')
 const form = await new Response(await boundedBody(request, MAX_FILE + 65536), { headers: { 'content-type': request.headers.get('content-type')! } }).formData().catch(() => { throw new Refusal('Invalid upload form.') })
 const file = form.get('file'), note = form.get('note')
 if (!(file instanceof File) || !file.size) throw new Refusal('Choose a nonempty file.')
 if (file.size > MAX_FILE) throw new Refusal('File exceeds 10 MiB.', 413)
 if (typeof note !== 'string' || !note.trim() || note.length > 500) throw new Refusal('Say what the exhibit shows (at most 500 characters).')
 const at = now.toISOString(), filename = file.name.replace(/[\x00-\x1f\x7f"]/g, '').slice(0, 240) || 'exhibit'
 const receipt = await appendReceipt(env, { requirement: requirement.id, bytes: await file.arrayBuffer(), filename, mediaType: file.type, origin: 'manually-asserted', source: `Revocation of ${item.account_key} in ${item.source_label} (access review ${item.review})`.slice(0, 1000), from: item.period_from, to: item.period_to, effective: null, supersedes: null }, { id: actor.id, displayName: actor.name }, now, id => [
  env.DB.prepare("UPDATE access_revocations SET state='verified',verified_at=?,checked_at=?,evidence=? WHERE item_id=? AND state!='verified'").bind(at, at, `Exhibit "${filename}" kept as receipt ${id}, attached by ${actor.name} at ${at}: ${note.trim()}`, itemId),
  auditStatement(env, actor, 'access-review.revocation-exhibit', 'access-item:' + itemId, now, 'succeeded', 'receipt:' + id),
 ])
 return { review: item.review_id, receipt: receipt.id, sha256: receipt.sha256 }
}
