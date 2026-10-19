import type { Bindings } from '../../auth.server'
import { Refusal, boundedBody } from '../upload'
import { auditStatement, type Actor } from '../door'
import { parseTable } from '../tabular'
import { controlTargets, currentMethod, insertRisk, score, validateRisk, type RiskInput } from './storage'
// RISK-002 spreadsheet import: map columns, dry-run every row, admit nothing
// until the owner confirms the same file. Admitted risks are labelled imported.
export const fields = ['title', 'scenario', 'likelihood', 'impact', 'treatment', 'owner_email', 'review_due', 'controls'] as const
const digest = async (bytes: Uint8Array) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes as BufferSource)), b => b.toString(16).padStart(2, '0')).join('')
export async function readImport(request: Request) {
 if (!request.headers.get('content-type')?.startsWith('multipart/form-data;')) throw new Refusal('Upload the register as a file.')
 const body = await boundedBody(request, 5 * 1024 * 1024)
 const form = await new Response(body, { headers: { 'content-type': request.headers.get('content-type')! } }).formData().catch(() => { throw new Refusal('Invalid upload form.') })
 const file = form.get('file'); if (!(file instanceof File) || !file.size) throw new Refusal('Choose a CSV or XLSX file.')
 const bytes = new Uint8Array(await file.arrayBuffer())
 const mapping = Object.fromEntries(fields.map(f => [f, typeof form.get('map_' + f) === 'string' && form.get('map_' + f) ? String(form.get('map_' + f)) : f]))
 return { filename: file.name.replace(/[\x00-\x1f\x7f]/g, '').slice(0, 200) || 'register', bytes, sha256: await digest(bytes), mapping, confirm: form.get('confirm') === 'yes', expected: typeof form.get('sha256') === 'string' ? String(form.get('sha256')) : '' }
}
export async function dryRun(env: Bindings, filename: string, bytes: Uint8Array, mapping: Record<string, string>) {
 const table = parseTable(filename, bytes), method = await currentMethod(env)
 const missing = ['title', 'likelihood', 'impact'].filter(f => !table.headers.includes(mapping[f]))
 if (missing.length) throw new Refusal(`Map the required columns: ${missing.join(', ')}. The file has: ${table.headers.join(', ')}.`)
 const existing = new Set((await env.DB.prepare('SELECT lower(title) AS t FROM risks').all<{ t: string }>()).results.map(r => r.t)), seen = new Set<string>()
 const rows: { row: number; title: string; outcome: 'admit' | 'refuse'; reasons: string[]; owner: 'matched' | 'unmatched' | 'none'; input?: RiskInput }[] = []
 for (const [i, record] of table.rows.entries()) {
  const value = (f: string) => mapping[f] && table.headers.includes(mapping[f]) ? record[mapping[f]] : ''
  const raw = { title: value('title'), scenario: value('scenario'), likelihood: value('likelihood'), impact: value('impact'), treatment: value('treatment').toLowerCase(), owner_email: value('owner_email'), review_due: value('review_due'), controls: value('controls') }
  const reasons: string[] = []; let input: RiskInput | undefined
  try { input = await validateRisk(env, raw); score(method, input.likelihood, input.impact); await controlTargets(env, input.controls) } catch (error) { reasons.push(error instanceof Refusal ? error.message : 'Invalid row') }
  const key = raw.title.toLowerCase()
  if (raw.title && existing.has(key)) reasons.push('Duplicate of a risk already in the register')
  else if (raw.title && seen.has(key)) reasons.push('Duplicate title earlier in this file')
  seen.add(key)
  rows.push({ row: i + 2, title: raw.title, outcome: reasons.length ? 'refuse' : 'admit', reasons, owner: !raw.owner_email ? 'none' : input?.owner ? 'matched' : 'unmatched', input })
 }
 return { method_revision: method.revision, headers: table.headers, mapping, total: rows.length, admit: rows.filter(r => r.outcome === 'admit').length, refuse: rows.filter(r => r.outcome === 'refuse').length, rows }
}
export async function confirmImport(env: Bindings, actor: Actor, file: Awaited<ReturnType<typeof readImport>>, now: Date) {
 if (file.expected !== file.sha256) throw new Refusal('Confirm the exact file you dry-ran; its fingerprint changed.', 409)
 const plan = await dryRun(env, file.filename, file.bytes, file.mapping), method = await currentMethod(env), id = crypto.randomUUID()
 await env.DB.batch([env.DB.prepare('INSERT INTO risk_imports(id,filename,sha256,admitted,refused,actor_name,at) VALUES(?,?,?,?,?,?,?)').bind(id, file.filename, file.sha256, plan.admit, plan.refuse, actor.name, now.toISOString()), auditStatement(env, actor, 'risk.imported', 'risk-import:' + id, now, 'succeeded', `${plan.admit} admitted, ${plan.refuse} refused from ${file.filename}`)])
 for (const row of plan.rows) if (row.outcome === 'admit') await insertRisk(env, actor, row.input!, method, 'import', now, { import_id: id, source_label: `Imported from ${file.filename} on ${now.toISOString().slice(0, 10)}` })
 return { import_id: id, ...plan, rows: plan.rows.map(({ input: _input, ...r }) => r) }
}
