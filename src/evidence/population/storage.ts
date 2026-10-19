import type { Bindings } from '../../auth.server'
import { Refusal, boundedBody } from '../upload'
import { auditStatement, type Actor } from '../door'
import { validDate } from '../model'
import { parseTable } from '../tabular'
// POPULATION-001: rosters, account lists and device lists for systems with no
// connector. Each upload follows a published column template, is dry-run row
// by row, and is admitted whole or not at all. The file is kept with its
// digest as a manually-asserted exhibit; its rows are labelled manual
// everywhere and never stand in for a source read.
export type Kind = 'roster' | 'accounts' | 'devices'
export const columnTemplates: Record<Kind, { key: string; required: string[]; optional: string[]; label: string }> = {
 roster: { key: 'email', required: ['email', 'name'], optional: ['employment_type', 'department', 'manager_email', 'start_date', 'termination_date'], label: 'Workforce roster (HRIS without a connector)' },
 accounts: { key: 'account_id', required: ['account_id'], optional: ['email', 'name', 'role', 'status', 'mfa', 'last_sign_in'], label: 'Account list (an application without a connector)' },
 devices: { key: 'serial', required: ['serial'], optional: ['owner_email', 'hostname', 'os', 'os_version', 'encrypted', 'last_seen'], label: 'Device list (a fleet without MDM)' },
}
const emails = new Set(['email', 'manager_email', 'owner_email']), dates = new Set(['start_date', 'termination_date', 'last_sign_in', 'last_seen']), booleans = new Set(['mfa', 'encrypted'])
const digest = async (bytes: Uint8Array) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes as BufferSource)), b => b.toString(16).padStart(2, '0')).join('')
const normal = (h: string) => h.trim().toLowerCase().replace(/[\s-]+/g, '_')
export async function readUpload(request: Request) {
 if (!request.headers.get('content-type')?.startsWith('multipart/form-data;')) throw new Refusal('Upload the population as a file.')
 const form = await new Response(await boundedBody(request, 5 * 1024 * 1024), { headers: { 'content-type': request.headers.get('content-type')! } }).formData().catch(() => { throw new Refusal('Invalid upload form.') })
 const file = form.get('file'); if (!(file instanceof File) || !file.size) throw new Refusal('Choose a CSV or XLSX file.')
 const field = (k: string) => typeof form.get(k) === 'string' ? String(form.get(k)).trim() : ''
 const kind = field('kind') as Kind
 if (!Object.hasOwn(columnTemplates, kind)) throw new Refusal('Choose roster, accounts or devices.')
 const source = field('source_system'), asOf = field('as_of'), refresh = Number(field('refresh_days') || 90)
 if (!source || source.length > 120) throw new Refusal('Name the source system this list came from.')
 if (!validDate(asOf)) throw new Refusal('Give the date the list was true as of.')
 if (!Number.isInteger(refresh) || refresh < 1 || refresh > 366) throw new Refusal('The refresh window is 1 to 366 days.')
 const template = columnTemplates[kind], mapping: Record<string, string> = {}
 for (const f of [...template.required, ...template.optional]) if (field('map_' + f)) mapping[f] = field('map_' + f)
 const bytes = new Uint8Array(await file.arrayBuffer())
 return { kind, source, asOf, refresh, mapping, filename: file.name.replace(/[\x00-\x1f\x7f]/g, '').slice(0, 200) || 'population', bytes, sha256: await digest(bytes), confirm: field('confirm') === 'yes', expected: field('sha256') }
}
type Upload = Awaited<ReturnType<typeof readUpload>>
// Map columns (template names by default, owner renames win), then validate every row.
export function plan(upload: Upload) {
 const table = parseTable(upload.filename, upload.bytes), template = columnTemplates[upload.kind], fields = [...template.required, ...template.optional]
 const mapping = Object.fromEntries(fields.map(f => [f, upload.mapping[f] ?? table.headers.find(h => normal(h) === f) ?? ''])) as Record<string, string>
 for (const [f, h] of Object.entries(upload.mapping)) if (!table.headers.includes(h)) throw new Refusal(`The column "${h}" mapped to ${f} is not in the file. It has: ${table.headers.join(', ')}.`)
 const missing = template.required.filter(f => !mapping[f])
 if (missing.length) throw new Refusal(`Map the required columns: ${missing.join(', ')}. The file has: ${table.headers.join(', ')}.`)
 const seen = new Set<string>(), rows: { row: number; key: string; attributes: Record<string, string | boolean | null>; reasons: string[] }[] = []
 for (const [i, record] of table.rows.entries()) {
  const attributes: Record<string, string | boolean | null> = {}, reasons: string[] = []
  for (const f of fields) {
   const raw = mapping[f] ? record[mapping[f]] ?? '' : ''
   if (!raw) { if (template.required.includes(f)) reasons.push(`${f} is required`); attributes[f] = null; continue }
   if (emails.has(f) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) reasons.push(`${f} "${raw}" is not an email address`)
   if (dates.has(f) && !validDate(raw.slice(0, 10))) reasons.push(`${f} "${raw}" is not a date (YYYY-MM-DD)`)
   if (booleans.has(f) && !/^(true|false|yes|no|1|0)$/i.test(raw)) reasons.push(`${f} "${raw}" is not yes or no`)
   attributes[f] = booleans.has(f) ? /^(true|yes|1)$/i.test(raw) : emails.has(f) ? raw.toLowerCase() : dates.has(f) ? raw.slice(0, 10) : raw.slice(0, 300)
  }
  const key = String(attributes[template.key] ?? '').toLowerCase()
  if (key && seen.has(key)) reasons.push(`${template.key} "${key}" repeats an earlier row`)
  seen.add(key)
  rows.push({ row: i + 2, key, attributes, reasons })
 }
 return { headers: table.headers, mapping, total: rows.length, admit: rows.filter(r => !r.reasons.length).length, refuse: rows.filter(r => r.reasons.length).length, rows }
}
// Reviewable matches: email first, then a unique name; several same-named people are ambiguous.
async function proposal(env: Bindings, attributes: Record<string, string | boolean | null>) {
 const email = (attributes.email ?? attributes.owner_email ?? null) as string | null, name = (attributes.name ?? null) as string | null
 if (email) { const p = await env.DB.prepare('SELECT id FROM people WHERE email=?').bind(email).first<{ id: string }>(); if (p) return { person_id: p.id, state: 'proposed', basis: 'same email', candidates: [] as string[] } }
 if (name) { const same = (await env.DB.prepare('SELECT id FROM people WHERE lower(name)=lower(?)').bind(name).all<{ id: string }>()).results; if (same.length === 1) return { person_id: same[0].id, state: 'proposed', basis: 'same name only', candidates: [] }; if (same.length > 1) return { person_id: null, state: 'ambiguous', basis: 'several people share this name', candidates: same.map(s => s.id) } }
 return null
}
export async function admit(env: Bindings, actor: Actor, upload: Upload, now: Date) {
 if (upload.expected !== upload.sha256) throw new Refusal('Confirm the exact file you dry-ran; its fingerprint changed.', 409)
 const checked = plan(upload)
 if (checked.refuse) throw new Refusal(`${checked.refuse} rows are invalid; nothing was admitted.`, 400, checked.rows.filter(r => r.reasons.length).map(r => `row ${r.row}: ${r.reasons.join('; ')}`))
 const id = crypto.randomUUID(), key = `populations/${id}`, at = now.toISOString()
 // Custody as for exhibits: write, then read the stored bytes back and verify size and digest.
 await env.EXHIBITS.put(key, upload.bytes)
 const stored = await env.EXHIBITS.get(key)
 if (!stored || (await digest(new Uint8Array(await stored.arrayBuffer()))) !== upload.sha256) throw new Refusal('Storage did not keep the exact file; nothing was admitted.', 503)
 const previous = await env.DB.prepare('SELECT id FROM population_uploads WHERE kind=? AND source_system=? ORDER BY uploaded_at DESC,rowid DESC LIMIT 1').bind(upload.kind, upload.source).first<{ id: string }>()
 const rows = await Promise.all(checked.rows.map(async r => ({ id: crypto.randomUUID(), ...r, match: await proposal(env, r.attributes) })))
 await env.DB.batch([
  env.DB.prepare('INSERT INTO population_uploads(id,kind,source_system,as_of,refresh_days,filename,sha256,size,object_key,mapping_json,uploaded_by,uploaded_name,uploaded_at,row_count,previous_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id, upload.kind, upload.source, upload.asOf, upload.refresh, upload.filename, upload.sha256, upload.bytes.byteLength, key, JSON.stringify(checked.mapping), actor.id, actor.name, at, rows.length, previous?.id ?? null),
  ...rows.map(r => env.DB.prepare('INSERT INTO population_rows(id,upload_id,row_number,row_key,attributes_json) VALUES(?,?,?,?,?)').bind(r.id, id, r.row, r.key, JSON.stringify(r.attributes))),
  ...rows.filter(r => r.match).map(r => env.DB.prepare('INSERT INTO population_matches(row_id,person_id,state,basis,candidates_json) VALUES(?,?,?,?,?)').bind(r.id, r.match!.person_id, r.match!.state, r.match!.basis, JSON.stringify(r.match!.candidates))),
  auditStatement(env, actor, 'population.uploaded', 'population:' + id, now, 'succeeded', `${upload.kind} from ${upload.source} as of ${upload.asOf}: ${rows.length} rows`),
 ])
 return { id, rows: rows.length }
}
export async function decide(env: Bindings, actor: Actor, rowId: string, input: Record<string, unknown>, now: Date) {
 const row = await env.DB.prepare('SELECT id,upload_id FROM population_rows WHERE id=?').bind(rowId).first<{ id: string; upload_id: string }>()
 if (!row) throw new Refusal('Row not found.', 404)
 const decision = String(input.decision), person = typeof input.person_id === 'string' && input.person_id ? input.person_id : null
 if (!['approved', 'rejected'].includes(decision)) throw new Refusal('Approve or reject the match.')
 const existing = await env.DB.prepare('SELECT person_id FROM population_matches WHERE row_id=?').bind(rowId).first<{ person_id: string | null }>()
 const chosen = decision === 'approved' ? person ?? existing?.person_id ?? null : existing?.person_id ?? null
 if (decision === 'approved' && !chosen) throw new Refusal('Choose the person this row belongs to.')
 if (chosen && !await env.DB.prepare('SELECT 1 FROM people WHERE id=?').bind(chosen).first()) throw new Refusal('Choose a person from People.')
 await env.DB.batch([env.DB.prepare("INSERT INTO population_matches(row_id,person_id,state,basis,decided_by,decided_at) VALUES(?,?,?,'owner choice',?,?) ON CONFLICT(row_id) DO UPDATE SET person_id=excluded.person_id,state=excluded.state,basis=CASE WHEN population_matches.person_id IS excluded.person_id THEN population_matches.basis ELSE 'owner choice' END,decided_by=excluded.decided_by,decided_at=excluded.decided_at").bind(rowId, chosen, decision, actor.name, now.toISOString()), auditStatement(env, actor, 'population.match-' + decision, 'population-row:' + rowId, now, 'succeeded', chosen ?? '')])
 return row.upload_id
}
export interface RowView { id: string; row_number: number; row_key: string; attributes: Record<string, unknown>; match: { person_id: string | null; person: string | null; state: string; basis: string; candidates: string[] } | null }
export async function uploads(env: Bindings, now: Date) {
 const today = now.toISOString().slice(0, 10)
 return (await env.DB.prepare('SELECT id,kind,source_system,as_of,refresh_days,filename,sha256,size,uploaded_name,uploaded_at,row_count,previous_id FROM population_uploads ORDER BY uploaded_at DESC,rowid DESC').all<{ id: string; kind: Kind; source_system: string; as_of: string; refresh_days: number; filename: string; sha256: string; size: number; uploaded_name: string; uploaded_at: string; row_count: number; previous_id: string | null }>()).results.map(u => {
  const stale = new Date(Date.parse(u.as_of + 'T00:00:00Z') + u.refresh_days * 86400000).toISOString().slice(0, 10)
  return { ...u, provenance: 'manually-asserted', stale_after: stale, state: today > stale ? 'stale' : 'current' }
 })
}
export async function rows(env: Bindings, upload: string): Promise<RowView[]> {
 return (await env.DB.prepare('SELECT r.id,r.row_number,r.row_key,r.attributes_json,m.person_id,m.state,m.basis,m.candidates_json,p.name AS person FROM population_rows r LEFT JOIN population_matches m ON m.row_id=r.id LEFT JOIN people p ON p.id=m.person_id WHERE r.upload_id=? ORDER BY r.row_number').bind(upload).all<{ id: string; row_number: number; row_key: string; attributes_json: string; person_id: string | null; state: string | null; basis: string | null; candidates_json: string | null; person: string | null }>()).results
  .map(r => ({ id: r.id, row_number: r.row_number, row_key: r.row_key, attributes: JSON.parse(r.attributes_json), match: r.state ? { person_id: r.person_id, person: r.person, state: r.state, basis: r.basis ?? '', candidates: JSON.parse(r.candidates_json ?? '[]') } : null }))
}
// Differences from the previous list from the same source: joiners, leavers and removed rows.
export async function differences(env: Bindings, upload: { id: string; kind: Kind; previous_id: string | null }) {
 if (!upload.previous_id) return null
 const now = await rows(env, upload.id), before = new Map((await rows(env, upload.previous_id)).map(r => [r.row_key, r]))
 const keys = new Set(now.map(r => r.row_key))
 const leaver = (r: RowView) => !!r.attributes.termination_date
 return {
  joiners: now.filter(r => !before.has(r.row_key)).map(r => r.row_key),
  removed: [...before.keys()].filter(k => !keys.has(k)),
  leavers: upload.kind === 'roster' ? now.filter(r => leaver(r) && !(before.get(r.row_key) && leaver(before.get(r.row_key)!))).map(r => r.row_key) : [],
 }
}

// Latest approved list memberships for the People door; retain manual attribution.
export async function populationMemberships(env: Bindings, now: Date) {
 const latest = new Map<string, Awaited<ReturnType<typeof uploads>>[number]>()
 for (const u of await uploads(env, now)) if (!latest.has(u.kind + '|' + u.source_system)) latest.set(u.kind + '|' + u.source_system, u)
 const memberships = new Map<string, string[]>()
 for (const u of latest.values()) for (const r of await rows(env, u.id)) if (r.match?.state === 'approved' && r.match.person_id) {
  const id = r.match.person_id
  memberships.set(id, [...(memberships.get(id) ?? []), `${u.source_system} ${u.kind} (manual, uploaded ${u.uploaded_at.slice(0, 10)}; ${u.state})`])
 }
 return memberships
}
