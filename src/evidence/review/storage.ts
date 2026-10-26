import { requireCapability } from '../archive/capabilities'
import { activeControl, activeReceipt } from '../visibility'
import type { Bindings } from '../../auth.server'
import { gap, period, type Receipt, type Requirement } from '../model'
import { history, receipt } from '../storage'
import { refusePublication, withheld } from '../secure/records'
import type { Folder, FolderInput, Grant, ReviewAction, ReviewData, ReviewEvent, ReviewReceipt } from './types'
const folderColumns = 'id,reviewer_label,period_from,period_to,expires_at,created_at,closed_at'
export const tokenDigest = async (token: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token)))).map(n => n.toString(16).padStart(2,'0')).join('')
export const folderActive = (folder: Folder, now: Date) => !folder.closed_at && now.getTime() < Date.parse(folder.expires_at)
export async function issueFolder(env: Bindings, input: FolderInput, now: Date, options: { id?: string; statements?: D1PreparedStatement[] } = {}) {
 await requireCapability(env,'shares')
 const token = Array.from(crypto.getRandomValues(new Uint8Array(32))).map(n => n.toString(16).padStart(2,'0')).join('')
 const folder: Folder = { id:options.id ?? crypto.randomUUID(), reviewer_label:input.reviewer_label, period_from:input.period_from, period_to:input.period_to, expires_at:input.expires_at, created_at:now.toISOString(), closed_at:null }
 await env.DB.batch([
  env.DB.prepare('INSERT INTO review_folders(id,reviewer_label,period_from,period_to,expires_at,created_at,token_hash) VALUES(?,?,?,?,?,?,?)').bind(folder.id,folder.reviewer_label,folder.period_from,folder.period_to,folder.expires_at,folder.created_at,await tokenDigest(token)),
  ...input.control_ids.map(id => env.DB.prepare('INSERT INTO review_folder_controls(folder_id,control_id) VALUES(?,?)').bind(folder.id,id)),
  ...(options.statements ?? []),
 ])
 return { folder, token }
}
export async function folders(env: Bindings) {
 const { results } = await env.DB.prepare(`SELECT ${folderColumns} FROM review_folders ORDER BY created_at DESC,id`).all<Folder>()
 return Promise.all(results.map(async folder => ({...folder, control_ids:(await env.DB.prepare('SELECT control_id FROM review_folder_controls WHERE folder_id=? ORDER BY control_id').bind(folder.id).all<{control_id:string}>()).results.map(x=>x.control_id)})))
}
export async function controls(env: Bindings) { return (await env.DB.prepare('SELECT c.id,c.name,c.group_name FROM controls c WHERE '+activeControl('c')+' ORDER BY c.created_at,c.id').all<{id:string;name:string;group_name:string}>()).results }
export async function grant(env: Bindings, token: string) { return env.DB.prepare('SELECT * FROM review_folders WHERE token_hash=?').bind(await tokenDigest(token)).first<Grant>() }
export async function closeFolder(env: Bindings, id: string, now: Date) {
 // Keep the hash to associate subsequent refused requests with this closed folder.
 await env.DB.prepare('UPDATE review_folders SET closed_at=? WHERE id=? AND closed_at IS NULL').bind(now.toISOString(),id).run()
 return env.DB.prepare(`SELECT ${folderColumns} FROM review_folders WHERE id=?`).bind(id).first<Folder>()
}
export async function logEvent(env: Bindings, folder: Folder | null, exhibit: string | null, action: ReviewAction, outcome: 'allowed' | 'refused', now: Date) {
 await env.DB.prepare('INSERT INTO review_events(id,folder_id,exhibit_id,action,outcome,occurred_at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),folder?.id ?? null,exhibit,action,outcome,now.toISOString()).run()
}
export async function events(env: Bindings, folder?: string) {
 const query = env.DB.prepare('SELECT id,folder_id,exhibit_id,action,outcome,occurred_at FROM review_events'+(folder?' WHERE folder_id=?':'')+' ORDER BY occurred_at DESC,id')
 return (await (folder?query.bind(folder):query).all<ReviewEvent>()).results
}
// Resolve owner-facing labels without changing the access-event API or retained log.
export type NamedReviewEvent = ReviewEvent & { folder_name: string | null; exhibit_name: string | null }
export async function eventNames(env: Bindings, rows: ReviewEvent[]): Promise<NamedReviewEvent[]> {
 const [folders, exhibits] = await Promise.all([
  env.DB.prepare('SELECT id,reviewer_label FROM review_folders').all<{id:string;reviewer_label:string}>(),
  env.DB.prepare('SELECT id,filename FROM exhibits').all<{id:string;filename:string}>(),
 ])
 const folderNames = new Map(folders.results.map(r=>[r.id,r.reviewer_label])), exhibitNames = new Map(exhibits.results.map(r=>[r.id,r.filename]))
 return rows.map(row=>({...row,folder_name:row.folder_id ? folderNames.get(row.folder_id) ?? 'Unavailable folder' : null,exhibit_name:row.exhibit_id ? exhibitNames.get(row.exhibit_id) ?? 'Unavailable exhibit' : null}))
}
// Whole inclusive receipt interval must be contained in the folder interval.
// A receipt spanning either boundary is excluded, including direct downloads.
export const insidePeriod = (folder: Folder, row: Receipt) => row.covered_from >= folder.period_from && row.covered_to <= folder.period_to
// Refusal attribution is owner-only and independent of reviewer scope. Resolve
// only the exhibit identifier; this lookup never authorizes or projects a receipt.
export async function receiptExhibit(env: Bindings, id: string) {
 return (await env.DB.prepare('SELECT exhibit_id FROM receipts WHERE id=?').bind(id).first<{exhibit_id:string}>())?.exhibit_id ?? null
}
export async function scopedReceipt(env: Bindings, folder: Folder, id: string) {
 const row = await receipt(env,id)
 if (!row || !insidePeriod(folder,row)) return null
 if (!await env.DB.prepare('SELECT id FROM receipts r WHERE id=? AND '+activeReceipt('r')).bind(id).first()) return null
 // SECURE-001: a sensitive record is never released to a reviewer until the owner publishes it.
 if ((await withheld(env)).has(id)) { await refusePublication(env,'receipt:'+id,'review folder '+folder.id,new Date()); return null }
 const selected = await env.DB.prepare('SELECT 1 AS selected FROM requirements r JOIN review_folder_controls s ON s.control_id=r.control_id WHERE r.id=? AND s.folder_id=?').bind(row.requirement_id,folder.id).first()
 return selected ? row : null
}
export function projectReceipt(row: Receipt, scopedIds: Set<string>): ReviewReceipt {
 return { id:row.id, requirement_id:row.requirement_id, exhibit_id:row.exhibit_id, origin:row.origin, source:row.source, covered_from:row.covered_from, covered_to:row.covered_to, added_at:row.added_at, sha256:row.sha256, filename:row.filename, size:row.size, media_type:row.media_type, available:row.available, superseded:!!row.superseded_by, supersedes:row.supersedes && scopedIds.has(row.supersedes) ? row.supersedes : null }
}
export async function reviewData(env: Bindings, folder: Folder, now: Date): Promise<ReviewData> {
 const { results } = await env.DB.prepare('SELECT r.*,c.name AS control_name,c.group_name FROM requirements r JOIN controls c ON c.id=r.control_id JOIN review_folder_controls s ON s.control_id=c.id WHERE s.folder_id=? ORDER BY c.created_at,c.id,r.id').bind(folder.id).all<Requirement>()
 const requirements = [], hold = await withheld(env)
 // Full history is internal only. Scoped rows retain full-history supersession
 // flags, but hidden receipts cannot establish coverage or unavailable bytes.
 for (const r of results) {
  const all = (await history(env,r.id)).filter(row=>!hold.has(row.id)), scoped = all.filter(row=>insidePeriod(folder,row)), ids = new Set(scoped.map(row=>row.id)), window = period(r.cadence,folder.period_to)
  const scopedGap = gap(r.cadence,folder.period_to,scoped,now)
  const state = scopedGap==='missing' && gap(r.cadence,folder.period_to,all,now)==='overdue' ? 'overdue' : scopedGap
  requirements.push({ id:r.id, control_id:r.control_id, control_name:r.control_name, group_name:r.group_name, name:r.name, cadence:r.cadence, gap:state, period_from:window.from, period_to:window.to, receipts:scoped.map(row=>projectReceipt(row,ids)) })
 }
 return { folder:{reviewer_label:folder.reviewer_label,period_from:folder.period_from,period_to:folder.period_to,expires_at:folder.expires_at}, selected:folder.period_to, requirements }
}
