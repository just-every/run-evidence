import type { Bindings } from '../auth.server'
import { validDate } from './model'
export const MAX_FILE = 10 * 1024 * 1024
export class Refusal extends Error { constructor(message: string, public status = 400, public details?: unknown) { super(message) } }
export async function boundedBody(request: Request, limit: number) {
 const declared = request.headers.get('content-length')
 if (declared && (!/^\d+$/.test(declared) || Number(declared) > limit)) throw new Refusal('Upload exceeds the size limit.', 413)
 const reader = request.body?.getReader()
 if (!reader) throw new Refusal('A request body is required.')
 const chunks: Uint8Array[] = []; let size = 0
 try { for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > limit) { await reader.cancel(); throw new Refusal('Upload exceeds the size limit.', 413) }; chunks.push(value) } } finally { reader.releaseLock() }
 const bytes = new Uint8Array(size); let offset = 0
 for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
 return bytes
}
export const textField = (form: FormData, key: string, max = 300) => { const value = form.get(key); if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Refusal(`Provide ${key} (at most ${max} characters).`); return value.trim() }
// `extra` lets the public API label a pushed receipt in the same transaction.
function restrictedRecord(env: Bindings, receipt: string, operator: { id: string; displayName: string; email?: string }, reason: FormDataEntryValue | null, now: Date) {
 const why = typeof reason === 'string' && reason.trim() ? reason.trim().slice(0, 500) : 'Marked sensitive at upload', at = now.toISOString()
 return [
  env.DB.prepare("INSERT INTO record_classes(receipt_id,class,reason,set_by,set_name,set_at) VALUES(?,'sensitive',?,?,?,?)").bind(receipt, why, operator.id, operator.displayName, at),
  ...(operator.email ? [env.DB.prepare('INSERT INTO record_grants(id,receipt_id,email,reason,granted_by,granted_name,granted_at) VALUES(?,?,?,?,?,?,?)').bind(crypto.randomUUID(), receipt, operator.email.toLowerCase(), 'Uploaded this record', operator.id, operator.displayName, at)] : []),
  env.DB.prepare("INSERT INTO product_audit(id,actor_kind,actor_id,actor_name,action,subject,outcome,detail,at) VALUES(?,'owner',?,?,'record.classified',?,'succeeded','sensitive at upload',?)").bind(crypto.randomUUID(), operator.id, operator.displayName, 'receipt:' + receipt, at),
 ]
}
export async function upload(request: Request, env: Bindings, requirement: string, operator: { id: string; displayName: string; email?: string }, now: Date, extra?: (receipt: string) => D1PreparedStatement[]) {
 if (!request.headers.get('content-type')?.startsWith('multipart/form-data;')) throw new Refusal('Use a file upload form.')
 const bytes = await boundedBody(request, MAX_FILE + 65536)
 let form: FormData
 try { form = await new Response(bytes, { headers: { 'content-type': request.headers.get('content-type')! } }).formData() } catch { throw new Refusal('Invalid upload form.') }
 const file = form.get('file'), from = form.get('covered_from'), to = form.get('covered_to'), source = textField(form, 'source', 1000)
 if (!(file instanceof File) || file.size === 0) throw new Refusal('Choose a nonempty file.')
 if (file.size > MAX_FILE) throw new Refusal('File exceeds 10 MiB.', 413)
 if (!validDate(from) || !validDate(to) || from > to) throw new Refusal('Covered period must be real UTC dates, from on or before to.')
 // CADENCE-001: an owner-asserted effective date (such as a report date), kept apart from the upload time.
 const effective = form.get('effective_date') || null
 if (effective !== null && !validDate(effective)) throw new Refusal('Effective date must be a real UTC date.')
 const parent = await env.DB.prepare('SELECT id FROM requirements WHERE id=?').bind(requirement).first()
 if (!parent) throw new Refusal('Requirement not found.', 404)
 // SECURE-001: a record marked sensitive at upload stays private, and its uploader is its first need-to-know holder.
 const sensitive = form.get('sensitivity') === 'sensitive'
 const supersedes = form.get('supersedes') || null
 if (supersedes) {
  if (typeof supersedes !== 'string' || !await env.DB.prepare('SELECT id FROM receipts WHERE id=? AND requirement_id=? AND NOT EXISTS(SELECT 1 FROM receipts n WHERE n.supersedes=receipts.id)').bind(supersedes,requirement).first()) throw new Refusal('Replacement must name a current receipt for this requirement.', 409)
 }
 return appendReceipt(env, { requirement, bytes: await file.arrayBuffer(), filename: file.name, mediaType: file.type, origin: 'manually-asserted', source, from, to, effective: effective as string | null, supersedes: supersedes as string | null }, operator, now, sensitive ? receipt => [...(extra?.(receipt) ?? []), ...restrictedRecord(env, receipt, operator, form.get('sensitivity_reason'), now)] : extra).then(r => r.id)
}
// Custody for one exhibit: write fresh bytes, read them back, digest what was
// stored and append the immutable exhibit and receipt (VULN-002 reports use it too).
export async function appendReceipt(env: Bindings, r: { requirement: string; bytes: ArrayBuffer; filename: string; mediaType: string; origin: 'manually-asserted'; source: string; from: string; to: string; effective: string | null; supersedes: string | null }, operator: { id: string; displayName: string }, now: Date, extra?: (receipt: string) => D1PreparedStatement[]) {
 const { requirement, from, to, source, effective, supersedes } = r
 const exhibitId = crypto.randomUUID(), id = crypto.randomUUID(), objectKey = 'exhibits/' + exhibitId
 // Caller names are display metadata only; keys are fresh random identifiers.
 const written = await env.EXHIBITS.put(objectKey, r.bytes, { onlyIf: { etagDoesNotMatch: '*' }, httpMetadata: { contentType: 'application/octet-stream' } })
 if (!written) throw new Refusal('Object key conflict; no receipt issued.',409)
 const stored = await env.EXHIBITS.get(objectKey)
 if (!stored) throw new Refusal('Stored bytes could not be read; no receipt issued.', 503)
 const actual = await stored.arrayBuffer()
 const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', actual))).map(n => n.toString(16).padStart(2, '0')).join('')
 const filename = r.filename.replace(/[\x00-\x1f\x7f]/g, '').slice(0, 240) || 'exhibit'
 try {
  await env.DB.batch([
   env.DB.prepare('INSERT INTO exhibits(id,object_key,filename,size,media_type) VALUES(?,?,?,?,?)').bind(exhibitId,objectKey,filename,actual.byteLength,r.mediaType || 'application/octet-stream'),
   env.DB.prepare('INSERT INTO receipts(id,requirement_id,exhibit_id,origin,source,covered_from,covered_to,added_by,added_by_name,added_at,sha256,supersedes) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,requirement,exhibitId,r.origin,source,from,to,operator.id,operator.displayName,now.toISOString(),hash,supersedes),
   ...(effective ? [env.DB.prepare('INSERT INTO receipt_effective_dates(receipt_id,effective_date) VALUES(?,?)').bind(id,effective)] : []),
   // LOG-001: each receipt and each replacement is audited in the same batch.
   env.DB.prepare("INSERT INTO product_audit(id,actor_kind,actor_id,actor_name,action,subject,outcome,detail,at) VALUES(?,'owner',?,?,?,?,'succeeded',?,?)").bind(crypto.randomUUID(), operator.id, operator.displayName, supersedes ? 'receipt.superseded' : 'receipt.added', 'receipt:' + id, `sha256 ${hash.slice(0, 16)}${supersedes ? ' supersedes receipt:' + supersedes : ''}`, now.toISOString()),
   ...(extra ? extra(id) : []),
  ])
 } catch { throw new Refusal('Receipt could not be appended. A concurrent replacement may already exist.', 409) }
 return { id, sha256: hash }
}
