import type { Bindings } from '../../auth.server'
import { Refusal, boundedBody, appendReceipt, MAX_FILE } from '../upload'
import { auditStatement, type Actor } from '../door'
import { validDate } from '../model'
import { parseTable } from '../tabular'
import { slaFor, DAY } from '../remedy/storage'
// VULN-002: penetration-test and other manual assessment findings. A reviewed
// CSV/XLSX import maps columns and dry-runs every row; confirming admits the
// valid rows and refuses the rest. The report PDF becomes an immutable receipt
// on the program's penetration-test requirement (CADENCE-001). A finding marked
// fixed only awaits verification; it closes on an approved retest letter.
export const fields = { required: ['title', 'severity'], optional: ['asset', 'description', 'cve', 'cwe', 'tester', 'report_date', 'recommended_fix'] } as const
export const severities = ['critical', 'high', 'medium', 'low'] as const
type Field = typeof fields.required[number] | typeof fields.optional[number]
const all: Field[] = [...fields.required, ...fields.optional]
const normal = (h: string) => h.trim().toLowerCase().replace(/[\s-]+/g, '_')
const digest = async (bytes: Uint8Array | ArrayBuffer) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes as BufferSource)), b => b.toString(16).padStart(2, '0')).join('')
const isPdf = (bytes: Uint8Array) => new TextDecoder().decode(bytes.subarray(0, 5)) === '%PDF-'
const addDays = (date: string, days: number) => new Date(Date.parse(date + 'T00:00:00Z') + days * DAY).toISOString().slice(0, 10)

// The penetration-test requirement of an adopted library control (OPS-05).
export async function pentestRequirement(env: Bindings) {
 return env.DB.prepare("SELECT r.id,c.name AS control_name FROM requirements r JOIN library_adoptions a ON a.control_id=r.control_id JOIN controls c ON c.id=r.control_id WHERE a.library_id='OPS-05' ORDER BY r.created_at,r.rowid LIMIT 1").first<{ id: string; control_name: string }>()
}

export async function readImport(request: Request) {
 if (!request.headers.get('content-type')?.startsWith('multipart/form-data;')) throw new Refusal('Upload the findings table and the report as files.')
 const form = await new Response(await boundedBody(request, MAX_FILE + 6 * 1024 * 1024), { headers: { 'content-type': request.headers.get('content-type')! } }).formData().catch(() => { throw new Refusal('Invalid upload form.') })
 const field = (k: string) => typeof form.get(k) === 'string' ? String(form.get(k)).trim() : ''
 const file = form.get('file'), report = form.get('report')
 if (!(file instanceof File) || !file.size) throw new Refusal('Choose the findings table (CSV or XLSX).')
 if (file.size > 5 * 1024 * 1024) throw new Refusal('The findings table exceeds 5 MiB.', 413)
 if (!(report instanceof File) || !report.size) throw new Refusal('Choose the penetration-test report (PDF).')
 if (report.size > MAX_FILE) throw new Refusal('The report exceeds 10 MiB.', 413)
 const tester = field('tester'), reportDate = field('report_date')
 if (!tester || tester.length > 120) throw new Refusal('Name the tester or firm that wrote the report.')
 if (!validDate(reportDate)) throw new Refusal('Give the report date (YYYY-MM-DD).')
 const bytes = new Uint8Array(await file.arrayBuffer()), reportBytes = new Uint8Array(await report.arrayBuffer())
 if (!isPdf(reportBytes)) throw new Refusal('The report must be a PDF.')
 const mapping: Partial<Record<Field, string>> = {}
 for (const f of all) if (field('map_' + f)) mapping[f] = field('map_' + f)
 const clean = (name: string, fallback: string) => name.replace(/[\x00-\x1f\x7f]/g, '').slice(0, 200) || fallback
 return { tester, reportDate, mapping, filename: clean(file.name, 'findings.csv'), bytes, sha256: await digest(bytes), reportName: clean(report.name, 'report.pdf'), reportBytes, reportSha256: await digest(reportBytes), confirm: field('confirm') === 'yes', expected: field('sha256'), expectedReport: field('report_sha256') }
}
type Import = Awaited<ReturnType<typeof readImport>>
export interface PlannedRow { row: number; title: string; severity: string; values: Record<Field, string | null>; reasons: string[] }

// Map columns (field names by default, owner renames win), then validate every row.
export function plan(upload: Import) {
 const table = parseTable(upload.filename, upload.bytes)
 for (const [f, h] of Object.entries(upload.mapping)) if (!table.headers.includes(h)) throw new Refusal(`The column "${h}" mapped to ${f} is not in the file. It has: ${table.headers.join(', ')}.`)
 const mapping = Object.fromEntries(all.map(f => [f, upload.mapping[f] ?? table.headers.find(h => normal(h) === f) ?? ''])) as Record<Field, string>
 const missing = fields.required.filter(f => !mapping[f])
 if (missing.length) throw new Refusal(`Map the required columns: ${missing.join(', ')}. The file has: ${table.headers.join(', ')}.`)
 const rows: PlannedRow[] = table.rows.map((record, i) => {
  const values = Object.fromEntries(all.map(f => [f, mapping[f] ? (record[mapping[f]] ?? '').trim() || null : null])) as Record<Field, string | null>, reasons: string[] = []
  if (!values.title) reasons.push('title is required')
  if (!values.severity) reasons.push('severity is required')
  else if (!(severities as readonly string[]).includes(values.severity.toLowerCase())) reasons.push(`severity "${values.severity}" is not critical, high, medium or low`)
  else values.severity = values.severity.toLowerCase()
  if (values.cve && !/^CVE-\d{4}-\d{4,}$/i.test(values.cve)) reasons.push(`cve "${values.cve}" is not a CVE id`)
  if (values.cwe && !/^CWE-\d+$/i.test(values.cwe)) reasons.push(`cwe "${values.cwe}" is not a CWE id`)
  if (values.report_date && !validDate(values.report_date)) reasons.push(`report_date "${values.report_date}" is not a date (YYYY-MM-DD)`)
  for (const f of all) if (values[f] && values[f]!.length > 4000) reasons.push(`${f} is longer than 4000 characters`)
  values.tester ??= upload.tester; values.report_date ??= upload.reportDate
  return { row: i + 2, title: values.title ?? '', severity: values.severity ?? '', values, reasons }
 })
 return { headers: table.headers, mapping, total: rows.length, admit: rows.filter(r => !r.reasons.length).length, refuse: rows.filter(r => r.reasons.length).length, rows }
}

// Confirming the dry-run fingerprints admits every valid row and refuses the rest.
export async function admit(env: Bindings, actor: Actor, upload: Import, now: Date) {
 if (upload.expected !== upload.sha256 || upload.expectedReport !== upload.reportSha256) throw new Refusal('Confirm the exact files you dry-ran; a fingerprint changed.', 409)
 const requirement = await pentestRequirement(env)
 if (!requirement) throw new Refusal('Start a program with the penetration-test control (OPS-05) first; its report requirement keeps the PDF.', 409)
 const checked = plan(upload), valid = checked.rows.filter(r => !r.reasons.length)
 if (!valid.length) throw new Refusal('No valid rows; nothing was admitted.', 400, checked.rows.map(r => `row ${r.row}: ${r.reasons.join('; ')}`))
 const id = crypto.randomUUID(), at = now.toISOString()
 const findings = await Promise.all(valid.map(async r => {
  // The SLA in force on the report date fixes the due date; later policy changes never move it.
  const sla = await slaFor(env, 'vulnerability', r.severity, new Date(r.values.report_date + 'T00:00:00Z'))
  const asset = r.values.asset, resource = asset ? await env.DB.prepare('SELECT id FROM resources WHERE removed_at IS NULL AND (unique_id=? OR display_name=?) ORDER BY rowid LIMIT 1').bind(asset, asset).first<{ id: string }>() : null
  return { id: crypto.randomUUID(), r, sla, resource: resource?.id ?? null, due: addDays(r.values.report_date!, sla.days) }
 }))
 const receipt = await appendReceipt(env, { requirement: requirement.id, bytes: upload.reportBytes.slice().buffer, filename: upload.reportName, mediaType: 'application/pdf', origin: 'manually-asserted', source: `Penetration test report by ${upload.tester}, dated ${upload.reportDate}`, from: upload.reportDate, to: upload.reportDate, effective: upload.reportDate, supersedes: null }, { id: actor.id, displayName: actor.name }, now, receiptId => [
  env.DB.prepare('INSERT INTO vuln_imports(id,requirement_id,receipt_id,tester,report_date,report_filename,report_sha256,table_filename,table_sha256,mapping_json,admitted,refused,imported_by,imported_name,imported_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id, requirement.id, receiptId, upload.tester, upload.reportDate, upload.reportName, upload.reportSha256, upload.filename, upload.sha256, JSON.stringify(checked.mapping), valid.length, checked.refuse, actor.id, actor.name, at),
  ...findings.flatMap(f => [
   env.DB.prepare("INSERT INTO vuln_findings(id,import_id,row_number,title,severity,asset,resource_id,description,cve,cwe,tester,report_date,recommended_fix,sla_days,sla_policy_id,due_date,state) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'open')").bind(f.id, id, f.r.row, f.r.title.slice(0, 300), f.r.severity, f.r.values.asset, f.resource, f.r.values.description, f.r.values.cve?.toUpperCase() ?? null, f.r.values.cwe?.toUpperCase() ?? null, f.r.values.tester, f.r.values.report_date, f.r.values.recommended_fix, f.sla.days, f.sla.id, f.due),
   event(env, f.id, 'imported', actor, at, `Manual finding from ${f.r.values.tester}'s report dated ${f.r.values.report_date}; remediate by ${f.due} (${f.sla.days}-day ${f.r.severity} SLA).`),
  ]),
  auditStatement(env, actor, 'vulnerabilities.imported', 'vuln-import:' + id, now, 'succeeded', `${valid.length} findings admitted, ${checked.refuse} rows refused; report ${upload.reportSha256}`),
 ])
 return { id, admitted: valid.length, refused: checked.refuse, receipt: receipt.id }
}
const event = (env: Bindings, finding: string, kind: string, actor: Actor, at: string, body: string, document: string | null = null) => env.DB.prepare('INSERT INTO vuln_events(id,finding_id,kind,body,document_id,actor_id,actor_name,at) VALUES(?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(), finding, kind, body, document, actor.id, actor.name, at)

export interface Finding { id: string; import_id: string; row_number: number; title: string; severity: string; asset: string | null; resource_id: string | null; resource_label: string | null; description: string | null; cve: string | null; cwe: string | null; tester: string; report_date: string; recommended_fix: string | null; sla_days: number; sla_policy_id: string | null; due_date: string; state: 'open' | 'awaiting verification' | 'closed'; marked_fixed_at: string | null; closed_at: string | null; closure_basis: string | null; closed_by: string | null; report_filename: string; receipt_id: string; provenance: 'manual'; sla_status: string }
// Past due once the UTC date is after the due date; a closed finding keeps whether it closed by its due date.
export const slaStatus = (f: Pick<Finding, 'state' | 'due_date' | 'closed_at'>, now: Date) => f.state === 'closed' ? (f.closed_at!.slice(0, 10) <= f.due_date ? 'closed within SLA' : 'closed after SLA') : now.toISOString().slice(0, 10) > f.due_date ? 'past due' : 'within SLA'
export async function findings(env: Bindings, now: Date, id?: string): Promise<Finding[]> {
 const rows = (await env.DB.prepare(`SELECT f.*,i.report_filename,i.receipt_id,r.source_label||' · '||r.display_name AS resource_label FROM vuln_findings f JOIN vuln_imports i ON i.id=f.import_id LEFT JOIN resources r ON r.id=f.resource_id${id ? ' WHERE f.id=?' : ''} ORDER BY f.due_date,f.rowid`).bind(...(id ? [id] : [])).all<Omit<Finding, 'provenance' | 'sla_status'>>()).results
 return rows.map(f => ({ ...f, provenance: 'manual' as const, sla_status: slaStatus(f, now) }))
}
export async function finding(env: Bindings, id: string, now: Date) {
 const [f] = await findings(env, now, id); if (!f) throw new Refusal('Finding not found.', 404)
 const [events, documents] = await env.DB.batch([env.DB.prepare('SELECT kind,body,document_id,actor_name,at FROM vuln_events WHERE finding_id=? ORDER BY at,rowid').bind(id), env.DB.prepare('SELECT id,filename,sha256,size,uploaded_name,uploaded_at,decision,decided_name,decided_at,decision_note FROM vuln_documents WHERE finding_id=? ORDER BY uploaded_at,rowid').bind(id)])
 return { finding: f, events: events.results as { kind: string; body: string; document_id: string | null; actor_name: string; at: string }[], retests: documents.results as { id: string; filename: string; sha256: string; size: number; uploaded_name: string; uploaded_at: string; decision: string | null; decided_name: string | null; decided_at: string | null; decision_note: string | null }[] }
}

// An owner marking a finding fixed leaves it awaiting verification; it never closes it.
export async function markFixed(env: Bindings, actor: Actor, id: string, note: string, now: Date) {
 const { finding: f } = await finding(env, id, now)
 if (f.state !== 'open') throw new Refusal(`The finding is ${f.state}; only an open finding can be marked fixed.`, 409)
 const at = now.toISOString()
 await env.DB.batch([env.DB.prepare("UPDATE vuln_findings SET state='awaiting verification',marked_fixed_at=? WHERE id=? AND state='open'").bind(at, id), event(env, id, 'marked fixed', actor, at, `Marked fixed${note ? ': ' + note : ''}. Awaiting verification: it closes only on an approved retest letter.`), auditStatement(env, actor, 'vulnerability.marked_fixed', 'vuln:' + id, now)])
 return { state: 'awaiting verification' }
}

// A retest letter or report: kept with its digest, read back before it is recorded.
export async function attachRetest(env: Bindings, actor: Actor, id: string, request: Request, now: Date) {
 const { finding: f } = await finding(env, id, now)
 if (f.state !== 'awaiting verification') throw new Refusal('Mark the finding fixed before attaching retest evidence.', 409)
 if (!request.headers.get('content-type')?.startsWith('multipart/form-data;')) throw new Refusal('Attach the retest letter as a file.')
 const form = await new Response(await boundedBody(request, MAX_FILE + 65536), { headers: { 'content-type': request.headers.get('content-type')! } }).formData().catch(() => { throw new Refusal('Invalid upload form.') })
 const file = form.get('file')
 if (!(file instanceof File) || !file.size) throw new Refusal('Choose the retest letter or report.')
 if (file.size > MAX_FILE) throw new Refusal('The retest letter exceeds 10 MiB.', 413)
 const bytes = new Uint8Array(await file.arrayBuffer()), sha256 = await digest(bytes), doc = crypto.randomUUID(), key = 'vulns/' + doc, at = now.toISOString()
 await env.EXHIBITS.put(key, bytes, { onlyIf: { etagDoesNotMatch: '*' } })
 const stored = await env.EXHIBITS.get(key)
 if (!stored || await digest(await stored.arrayBuffer()) !== sha256) throw new Refusal('Storage did not keep the exact file; nothing was recorded.', 503)
 const filename = file.name.replace(/[\x00-\x1f\x7f]/g, '').slice(0, 200) || 'retest'
 await env.DB.batch([env.DB.prepare('INSERT INTO vuln_documents(id,finding_id,filename,sha256,size,object_key,uploaded_by,uploaded_name,uploaded_at) VALUES(?,?,?,?,?,?,?,?,?)').bind(doc, id, filename, sha256, bytes.byteLength, key, actor.id, actor.name, at), event(env, id, 'retest attached', actor, at, `Retest evidence ${filename} attached; waiting for a reviewer's decision.`, doc)])
 return { document: doc, sha256 }
}

// The reviewer's decision on one retest letter. Approval closes the finding and names the reviewer.
export async function decideRetest(env: Bindings, actor: Actor, id: string, doc: string, decision: string, note: string, now: Date) {
 if (!['approved', 'rejected'].includes(decision)) throw new Refusal('Approve or reject the retest evidence.')
 const { finding: f, retests } = await finding(env, id, now), letter = retests.find(r => r.id === doc)
 if (!letter) throw new Refusal('Retest evidence not found.', 404)
 if (letter.decision) throw new Refusal(`This retest evidence was already ${letter.decision}.`, 409)
 if (f.state !== 'awaiting verification') throw new Refusal(`The finding is ${f.state}.`, 409)
 if (decision === 'rejected' && !note) throw new Refusal('Say why the retest evidence does not show the fix.')
 const at = now.toISOString()
 await env.DB.batch([
  env.DB.prepare('UPDATE vuln_documents SET decision=?,decided_by=?,decided_name=?,decided_at=?,decision_note=? WHERE id=? AND decision IS NULL').bind(decision, actor.id, actor.name, at, note || null, doc),
  decision === 'approved'
   ? env.DB.prepare("UPDATE vuln_findings SET state='closed',closed_at=?,closure_basis=?,closed_by=? WHERE id=?").bind(at, `Retest evidence ${letter.filename} approved`, actor.name, id)
   : env.DB.prepare("UPDATE vuln_findings SET state='open',marked_fixed_at=NULL WHERE id=?").bind(id),
  event(env, id, decision === 'approved' ? 'closed' : 'retest rejected', actor, at, decision === 'approved' ? `Closed: ${actor.name} approved the retest evidence ${letter.filename}${note ? ' (' + note + ')' : ''}.` : `${actor.name} rejected the retest evidence ${letter.filename}: ${note}. The finding is open again.`, doc),
  auditStatement(env, actor, 'vulnerability.retest_' + decision, 'vuln:' + id, now),
 ])
 return { state: decision === 'approved' ? 'closed' : 'open' }
}

// The vulnerability-remediation population: every pentest finding with its provenance and SLA history.
export const populationColumns = ['finding_id', 'title', 'severity', 'asset', 'provenance', 'tester', 'report_date', 'report', 'first_detected', 'sla_days', 'due_date', 'state', 'sla_status', 'marked_fixed_at', 'closed_at', 'closure_basis', 'closed_by'] as const
export async function population(env: Bindings, now: Date) {
 return (await findings(env, now)).map(f => ({ finding_id: f.id, title: f.title, severity: f.severity, asset: f.asset ?? '', provenance: 'manual', tester: f.tester, report_date: f.report_date, report: f.report_filename, first_detected: f.report_date, sla_days: f.sla_days, due_date: f.due_date, state: f.state, sla_status: f.sla_status, marked_fixed_at: f.marked_fixed_at ?? '', closed_at: f.closed_at ?? '', closure_basis: f.closure_basis ?? '', closed_by: f.closed_by ?? '' }))
}
export async function pentestTotals(env: Bindings, now: Date) {
 const list = await findings(env, now), open = list.filter(f => f.state !== 'closed')
 return { pentest_open: open.length, pentest_awaiting_verification: open.filter(f => f.state === 'awaiting verification').length, pentest_past_due: open.filter(f => f.sla_status === 'past due').length }
}
