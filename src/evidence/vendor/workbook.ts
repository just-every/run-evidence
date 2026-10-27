import type { Bindings } from '../../auth.server'
import { auditStatement, text, oneOf, type Actor, type Input } from '../door'
import { Refusal } from '../upload'
import { parseXlsx } from '../tabular'
import { sha256 } from './storage'
import { licensedTypes, type Question, type TemplateData, type WorkbookMeta } from './caiq'
// Map columns explicitly: workbook display names never decide licence policy.
// Preserve the original row, including the scoped workbook's rule and decision.
export const workbookFields = ['id', 'domain', 'question', 'scope', 'in_scope', 'answer', 'comment', 'ownership', 'implementation'] as const
export function readWorkbook(file: File, bytes: Uint8Array, input: Input) {
 if (!/\.(xlsx|xlsm)$/i.test(file.name)) throw new Refusal('Choose an XLSX or XLSM workbook.')
 const row = Number(input.header_row || 1)
 if (!Number.isInteger(row) || row < 1 || row > 100) throw new Refusal('Header row must be 1 to 100.')
 const sheet = typeof input.sheet === 'string' ? input.sheet : ''
 const table = parseXlsx(bytes, { sheet, headerRow: row, maxRows: 10000 })
 const columns = Object.fromEntries(workbookFields.map(k => [k, typeof input['column_' + k] === 'string' && input['column_' + k] ? String(input['column_' + k]) : k]))
 for (const k of ['id', 'domain', 'question']) if (!table.headers.includes(columns[k])) throw new Refusal(`Map the ${k} column to an existing workbook header.`)
 return { ...table, columns, sheet, header_row: row }
}
export function workbookQuestions(rows: Record<string, string>[], columns: Record<string, string>, type: WorkbookMeta['type'], edition: string): Question[] {
 const questions = rows.filter(r => r[columns.id] || r[columns.question]).map(r => {
  const id = r[columns.id], domain = r[columns.domain], wording = r[columns.question], rule = r[columns.scope] ?? '', decision = (r[columns.in_scope] ?? '').toLowerCase()
  if (!id || id.length > 100 || !domain || !wording || wording.length > 10000) throw new Refusal('Every question needs its unchanged id, domain and text (up to 10,000 characters).')
  if ((rule && !decision) || (decision && !['yes', 'no', 'in', 'out', 'true', 'false', '1', '0'].includes(decision))) throw new Refusal('For each scoping rule, include an explicit in_scope yes/no decision from your scoped workbook; Evidence does not execute workbook macros.')
  return { id, domain, text: wording, scope_rule: rule, in_scope: !['no', 'out', 'false', '0'].includes(decision), template_type: type, edition, source_row: r }
 })
 if (!questions.length || questions.length > 10000 || new Set(questions.map(q => q.id)).size !== questions.length || !questions.some(q => q.in_scope)) throw new Refusal('Import 1–10,000 unique question ids, with at least one in scope.')
 return questions
}
export async function importWorkbook(env: Bindings, actor: Actor, form: FormData, now: Date) {
 const input = Object.fromEntries([...form.entries()].filter((e): e is [string, string] => typeof e[1] === 'string')) as Input
 const type = oneOf(input, 'template_type', licensedTypes.map(t => t.id)), edition = text(input, 'edition', 80), licensee = text(input, 'licensee', 200)
 if (input.licensed_copy !== 'yes') throw new Refusal('Confirm your licence for this workbook, whatever its filename or template name.')
 if (type === 'caiq-v4' ? !/^4\.0\.\d+$/.test(edition) : !/\b20\d{2}\b/.test(edition)) throw new Refusal('CAIQ edition must be 4.0.x; SIG edition must name its year.')
 const file = form.get('file')
 if (!(file instanceof File) || !file.size || file.size > 10 * 1024 * 1024) throw new Refusal('Choose a nonempty workbook up to 10 MiB.')
 const bytes = new Uint8Array(await file.arrayBuffer()), parsed = readWorkbook(file, bytes, input), questions = workbookQuestions(parsed.rows, parsed.columns, type, edition)
 const workbook: WorkbookMeta = { type, edition, licensee, confirmed_by: actor.name, confirmed_at: now.toISOString(), sha256: await sha256(bytes.buffer as ArrayBuffer), sheet: parsed.sheet, header_row: parsed.header_row, columns: parsed.columns, headers: parsed.headers }
 questions[0].workbook = workbook
 const data: TemplateData = { questions, workbook }, id = crypto.randomUUID(), name = text(input, 'name', 200)
 await env.DB.batch([env.DB.prepare('INSERT INTO vendor_templates(id,name,questions_json,created_by,created_at) VALUES(?,?,?,?,?)').bind(id, name, JSON.stringify(data), actor.name, now.toISOString()), auditStatement(env, actor, 'vendor.workbook-imported', 'vendor-template:' + id, now, 'succeeded', `${type} ${edition}; licensed copy confirmed; ${questions.length} ids retained`, { revision: id })])
 return { id, questions: questions.length, in_scope: questions.filter(q => q.in_scope).length, workbook }
}
export interface SupplierAnswer { answer: string; comment: string; ownership?: string; implementation?: string }
// Keep structured CAIQ fields in the existing immutable answer record. A tagged
// envelope distinguishes it from historical free-text comments without a schema rewrite.
const tag = 'evidence-answer-v1:'
export const encodeAnswer = (a: SupplierAnswer) => tag + JSON.stringify({ comment: a.comment, ownership: a.ownership ?? '', implementation: a.implementation ?? '' })
export function decodeAnswer(comment: string): Pick<SupplierAnswer, 'comment' | 'ownership' | 'implementation'> {
 if (comment.startsWith(tag)) { try { const v = JSON.parse(comment.slice(tag.length)); if (typeof v.comment === 'string' && typeof v.ownership === 'string' && typeof v.implementation === 'string') return v } catch { /* historical comment */ } }
 return { comment }
}
export function completedWorkbook(file: File, bytes: Uint8Array, input: Input, questions: Question[], expected: WorkbookMeta) {
 if (input.edition !== expected.edition) throw new Refusal('Upload the completed workbook of the requested edition.')
 const parsed = readWorkbook(file, bytes, { ...Object.fromEntries(Object.entries(expected.columns).map(([k, v]) => ['column_' + k, v])), sheet: expected.sheet, header_row: String(expected.header_row) })
 const actual = workbookQuestions(parsed.rows, parsed.columns, expected.type, expected.edition), known = new Map(questions.map(q => [q.id, q]))
 if (actual.length !== questions.length || actual.some(q => { const old = known.get(q.id); return !old || old.domain !== q.domain || old.text !== q.text || old.scope_rule !== q.scope_rule || old.in_scope !== q.in_scope })) throw new Refusal('The completed workbook must keep the requested ids, wording, domains and scope unchanged.')
 const answers = new Map<string, SupplierAnswer>()
 for (const q of actual.filter(q => q.in_scope !== false)) {
  const r = q.source_row!, value = (r[parsed.columns.answer] ?? '').toLowerCase(), answer = ({ yes: 'yes', no: 'no', 'n/a': 'na', na: 'na', 'not applicable': 'na' } as Record<string, string>)[value]
  if (!answer) throw new Refusal(`Complete the yes/no/not applicable answer for ${q.id}.`)
  answers.set(q.id, { answer, comment: r[parsed.columns.comment] ?? '', ownership: r[parsed.columns.ownership] ?? '', implementation: r[parsed.columns.implementation] ?? '' })
 }
 return answers
}
