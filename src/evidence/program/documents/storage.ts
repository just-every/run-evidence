import type { Bindings } from '../../../auth.server'
import { addMonths } from '../../cadence'
import { day, validDate } from '../../model'
import { Refusal, MAX_FILE } from '../../upload'
import { auditStatement, text, type Actor, type Input } from '../../door'
import { sendFollowup, sent } from '../../followup/send'
import { addFromLibrary } from '../../risk/storage'
import { requirePerson } from '../people'
import { readiness } from '../readiness'
import { requireProgram, type ProgramRow } from '../storage'
import { sha256 } from '../../vendor/storage'
import type { Ctx, Generated, Inputs } from './context'
import { kinds, kindsFor } from './kinds'
import { ephiScenarios } from './hipaa'
import { explanationNeeded } from './saq-scope'
import { notice, type Rendered, type Section } from './model'
// PROGRAM-003: each document is generated from live program state into an
// immutable revision. Owner edits and inputs, reconciliations and approvals add
// revisions or approvals; nothing earlier is ever rewritten.
export interface DocumentRow { id: string; program_id: string; kind: string; owner_person_id: string | null; review_months: number; created_by: string; created_at: string }
export interface RevisionRow { id: string; document_id: string; revision: number; origin: 'generated' | 'edited' | 'reconciled'; reason: string; inputs_json: string; owner_text_json: string; content_json: string; facts_json: string; facts_hash: string; actor_name: string; at: string }
export interface ApprovalRow { revision_id: string; document_id: string; approver_person_id: string; approved_by: string; approved_at: string; effective_date: string; review_due: string; note: string; approver_name: string | null }
const hash = async (value: unknown) => sha256(new TextEncoder().encode(JSON.stringify(value)).buffer as ArrayBuffer)
export const kindOf = (id: string) => { const k = kinds[id]; if (!k) throw new Refusal('Unknown document kind.', 404); return k }
export async function requireDocument(env: Bindings, program: string, kind: string) {
 const row = await env.DB.prepare('SELECT * FROM program_documents WHERE program_id=? AND kind=?').bind(program, kind).first<DocumentRow>()
 if (!row) throw new Refusal('That document has not been generated for this program.', 404)
 return row
}
async function context(env: Bindings, program: ProgramRow, documentId: string, inputs: Inputs, now: Date): Promise<Ctx> { return { env, program, ready: await readiness(env, program, now), now, inputs, documentId } }
const withTexts = (g: Generated, texts: Record<string, string>): Section[] => g.sections.map(s => texts[s.id] ? { ...s, owner_text: texts[s.id], status: 'owner-written' as const } : s)
const parse = (value: string) => JSON.parse(value) as Record<string, unknown>
export const revisions = async (env: Bindings, document: string) => (await env.DB.prepare('SELECT * FROM program_document_revisions WHERE document_id=? ORDER BY revision').bind(document).all<RevisionRow>()).results
export const approvals = async (env: Bindings, document: string) => (await env.DB.prepare('SELECT a.*,p.name AS approver_name FROM program_document_approvals a LEFT JOIN people p ON p.id=a.approver_person_id WHERE a.document_id=? ORDER BY a.approved_at,a.rowid').bind(document).all<ApprovalRow>()).results
export const exhibits = async (env: Bindings, document: string) => (await env.DB.prepare('SELECT id,label,filename,media_type,size,sha256,uploaded_by,uploaded_at FROM program_document_exhibits WHERE document_id=? ORDER BY uploaded_at,rowid').bind(document).all<{ id: string; label: string; filename: string; media_type: string; size: number; sha256: string; uploaded_by: string; uploaded_at: string }>()).results
async function insertRevision(env: Bindings, actor: Actor, doc: DocumentRow, revision: number, origin: RevisionRow['origin'], reason: string, inputs: Inputs, texts: Record<string, string>, generated: Generated, now: Date, extra: D1PreparedStatement[] = []) {
 const sections = withTexts(generated, texts), id = crypto.randomUUID(), content = JSON.stringify({ subtitle: generated.subtitle, sections })
 await env.DB.batch([
  env.DB.prepare('INSERT INTO program_document_revisions(id,document_id,revision,origin,reason,inputs_json,owner_text_json,content_json,facts_json,facts_hash,actor_name,at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').bind(id, doc.id, revision, origin, reason, JSON.stringify(inputs), JSON.stringify(texts), content, JSON.stringify(generated.facts), await hash(Object.fromEntries(Object.entries(generated.facts).map(([k, f]) => [k, f.value]))), actor.name, now.toISOString()),
  ...extra,
  auditStatement(env, actor, `program-document.${origin}`, `program-document:${doc.id}`, now, 'succeeded', `${kinds[doc.kind].title} revision ${revision}`, { reason, revision }),
 ])
 return id
}
export async function generateDocument(env: Bindings, actor: Actor, programId: string, input: Input, now: Date) {
 const program = await requireProgram(env, programId), kind = typeof input.kind === 'string' ? input.kind : '', def = kindOf(kind)
 if (def.framework !== program.framework) throw new Refusal(`That document belongs to a ${def.framework} program.`)
 if (await env.DB.prepare('SELECT 1 FROM program_documents WHERE program_id=? AND kind=?').bind(programId, kind).first()) throw new Refusal('This document already exists; open it, edit it or reconcile it.', 409)
 const owner = typeof input.owner_person_id === 'string' && input.owner_person_id ? (await requirePerson(env, input.owner_person_id, 'accountable owner')).id : program.lead_person_id
 const doc: DocumentRow = { id: crypto.randomUUID(), program_id: programId, kind, owner_person_id: owner, review_months: 12, created_by: actor.name, created_at: now.toISOString() }
 const generated = await def.generate(await context(env, program, doc.id, {}, now))
 await env.DB.batch([env.DB.prepare('INSERT INTO program_documents(id,program_id,kind,owner_person_id,review_months,created_by,created_at) VALUES(?,?,?,?,?,?,?)').bind(doc.id, programId, kind, owner, 12, actor.name, doc.created_at)])
 await insertRevision(env, actor, doc, 1, 'generated', 'Generated from live program state', {}, {}, generated, now)
 return { id: doc.id, kind, revision: 1 }
}
const latest = async (env: Bindings, doc: DocumentRow) => (await revisions(env, doc.id)).at(-1)!
// Owner edits: a section's own text, or the document's structured inputs. Each
// writes a new revision regenerated from live state; earlier revisions stay.
export async function reviseDocument(env: Bindings, actor: Actor, programId: string, kind: string, input: Input, now: Date) {
 const doc = await requireDocument(env, programId, kind), def = kindOf(kind), program = await requireProgram(env, programId), prior = await latest(env, doc), reason = text(input, 'reason', 500)
 let inputs = parse(prior.inputs_json), texts = parse(prior.owner_text_json) as Record<string, string>
 const sectionId = typeof input.section_id === 'string' ? input.section_id : ''
 if (sectionId) {
  const known = (JSON.parse(prior.content_json) as { sections: Section[] }).sections.map(s => s.id)
  if (!known.includes(sectionId)) throw new Refusal('Choose a section of this document.')
  const body = typeof input.text === 'string' ? input.text.trim() : ''
  if (body.length > 8000) throw new Refusal('A section text is at most 8,000 characters.')
  if (body) texts = { ...texts, [sectionId]: body }; else { const { [sectionId]: _gone, ...rest } = texts; texts = rest }
 }
 if (typeof input.inputs === 'string') { let given: unknown; try { given = JSON.parse(input.inputs) } catch { throw new Refusal('Send the inputs as one JSON object.') } if (!given || typeof given !== 'object' || Array.isArray(given)) throw new Refusal('Send the inputs as one JSON object.'); inputs = { ...inputs, ...(given as Inputs) } }
 else inputs = def.parse(input, inputs)
 if (JSON.stringify(inputs) === prior.inputs_json && JSON.stringify(texts) === prior.owner_text_json) throw new Refusal('Nothing changed; no revision was written.', 409)
 const generated = await def.generate(await context(env, program, doc.id, inputs, now))
 await insertRevision(env, actor, doc, prior.revision + 1, 'edited', reason, inputs, texts, generated, now)
 return { revision: prior.revision + 1 }
}
export async function reconcileDocument(env: Bindings, actor: Actor, programId: string, kind: string, input: Input, now: Date) {
 const doc = await requireDocument(env, programId, kind), def = kindOf(kind), program = await requireProgram(env, programId), prior = await latest(env, doc), reason = text(input, 'reason', 500)
 const generated = await def.generate(await context(env, program, doc.id, parse(prior.inputs_json), now))
 await insertRevision(env, actor, doc, prior.revision + 1, 'reconciled', reason, parse(prior.inputs_json), parse(prior.owner_text_json) as Record<string, string>, generated, now)
 return { revision: prior.revision + 1 }
}
export async function updateSettings(env: Bindings, actor: Actor, programId: string, kind: string, input: Input, now: Date) {
 const doc = await requireDocument(env, programId, kind), reason = text(input, 'reason', 500)
 const owner = typeof input.owner_person_id === 'string' && input.owner_person_id ? (await requirePerson(env, input.owner_person_id, 'accountable owner')).id : doc.owner_person_id
 const months = input.review_months ? Number(input.review_months) : doc.review_months
 if (!Number.isInteger(months) || months < 1 || months > 12) throw new Refusal('The review cycle is 1 to 12 months (annual at most).')
 await env.DB.batch([env.DB.prepare('UPDATE program_documents SET owner_person_id=?,review_months=? WHERE id=?').bind(owner, months, doc.id), auditStatement(env, actor, 'program-document.settings', `program-document:${doc.id}`, now, 'succeeded', `owner ${owner ?? 'none'}, review every ${months} months`, { reason })])
}
export async function approveDocument(env: Bindings, actor: Actor, programId: string, kind: string, input: Input, now: Date) {
 const doc = await requireDocument(env, programId, kind), prior = await latest(env, doc), approver = await requirePerson(env, input.approver_person_id, 'named approver')
 if (!doc.owner_person_id) throw new Refusal('Name the accountable owner before approving.')
 if (Number(input.revision) !== prior.revision) throw new Refusal('Approve the latest revision; it changed or is not the one you opened.', 409)
 if (await env.DB.prepare('SELECT 1 FROM program_document_approvals WHERE revision_id=?').bind(prior.id).first()) throw new Refusal('This revision is already approved.', 409)
 const effective = typeof input.effective_date === 'string' && input.effective_date ? input.effective_date : day(now)
 if (!validDate(effective)) throw new Refusal('The effective date must be a real date.')
 const sections = (JSON.parse(prior.content_json) as { sections: Section[] }).sections, open = sections.filter(s => s.status === 'owner-needed' && !s.owner_text)
 if (open.length) throw new Refusal(`Complete the sections that records cannot support before approving: ${open.map(s => s.heading).join(', ')}.`, 409)
 if (kind === 'pci-saq') {
  const rows = sections.find(s => s.id === 'worksheet')?.table?.rows ?? []
  if (!rows.length) throw new Refusal('Select an SAQ type before approving the worksheet.', 409)
  if (rows.some(r => r[3] === 'unanswered')) throw new Refusal('Answer every worksheet requirement with a response allowed by this SAQ revision before approving.', 409)
  if (rows.some(r => explanationNeeded(r[3]) && !r[5]?.trim())) throw new Refusal('Provide the required explanation for every not-applicable, CCW, not-tested or not-in-place response before approving.', 409)
 }
 const due = day(addMonths(new Date(effective + 'T00:00:00Z'), doc.review_months)), note = text(input, 'note', 1000, true)
 await env.DB.batch([env.DB.prepare('INSERT INTO program_document_approvals(revision_id,document_id,approver_person_id,approved_by,approved_at,effective_date,review_due,note) VALUES(?,?,?,?,?,?,?,?)').bind(prior.id, doc.id, approver.id, actor.name, now.toISOString(), effective, due, note), auditStatement(env, actor, 'program-document.approved', `program-document:${doc.id}`, now, 'succeeded', `${kinds[kind].title} revision ${prior.revision}; approver ${approver.name}; review by ${due}`, { reason: note, revision: prior.revision })])
 return { revision: prior.revision, review_due: due }
}
// Drift: the live facts a document would assert now against those of its latest
// approved revision. Any difference flags the document as needing review.
export async function drift(env: Bindings, doc: DocumentRow, now: Date) {
 const list = await approvals(env, doc.id), approved = list.at(-1)
 if (!approved) return { approved_revision: null as number | null, items: [] as { key: string; label: string; approved: string; live: string }[] }
 const revision = (await revisions(env, doc.id)).find(r => r.id === approved.revision_id)!, program = await requireProgram(env, doc.program_id)
 const live = await kindOf(doc.kind).generate(await context(env, program, doc.id, parse(revision.inputs_json), now)), before = JSON.parse(revision.facts_json) as Generated['facts'], items = []
 for (const key of new Set([...Object.keys(before), ...Object.keys(live.facts)])) { const a = before[key]?.value ?? 'absent', b = live.facts[key]?.value ?? 'absent'; if (a !== b) items.push({ key, label: (live.facts[key] ?? before[key]).label, approved: a, live: b }) }
 return { approved_revision: revision.revision, items }
}
export async function documentState(env: Bindings, doc: DocumentRow, now: Date) {
 const [revs, apps] = await Promise.all([revisions(env, doc.id), approvals(env, doc.id)]), tip = revs.at(-1)!, approved = apps.at(-1) ?? null, d = await drift(env, doc, now)
 const state = !approved ? 'draft' : d.items.length ? 'needs review' : approved.review_due <= day(now) ? 'review overdue' : tip.id === approved.revision_id ? 'approved' : 'approved, newer draft'
 return { state, drift: d, approved, latest: tip.revision }
}
export async function listDocuments(env: Bindings, program: ProgramRow, now: Date) {
 const docs = (await env.DB.prepare('SELECT * FROM program_documents WHERE program_id=?').bind(program.id).all<DocumentRow>()).results
 return Promise.all(kindsFor(program.framework).map(async k => { const doc = docs.find(d => d.kind === k.id); return { kind: k.id, title: k.title, blurb: k.blurb, generated: !!doc, owner_person_id: doc?.owner_person_id ?? null, ...(doc ? await documentState(env, doc, now) : { state: 'not generated', drift: { approved_revision: null, items: [] }, approved: null, latest: 0 }) } }))
}
export async function render(env: Bindings, doc: DocumentRow, revision: RevisionRow, now: Date): Promise<Rendered> {
 const program = await requireProgram(env, doc.program_id), apps = await approvals(env, doc.id), approval = apps.find(a => a.revision_id === revision.id) ?? null, content = JSON.parse(revision.content_json) as { subtitle: string; sections: Section[] }
 const owner = doc.owner_person_id ? (await env.DB.prepare('SELECT name FROM people WHERE id=?').bind(doc.owner_person_id).first<{ name: string }>())?.name : null, d = await drift(env, doc, now)
 const control: Section = { id: 'control', heading: 'Document control', status: 'prefilled', statements: [{ text: approval ? 'This revision is approved by the named approver. The approval is the owner organization’s decision, not an attestation by Evidence.' : 'This revision is a DRAFT and has no approval.', cites: [] }, ...(approval && apps.at(-1) === approval && d.items.length ? [{ text: `NEEDS REVIEW: ${d.items.length} item${d.items.length === 1 ? '' : 's'} no longer match program state (${d.items.slice(0, 3).map(i => `${i.label}: ${i.approved} -> ${i.live}`).join('; ')}).`, cites: [] }] : [])], table: { head: ['Field', 'Value'], rows: [['Program', program.name], ['Revision', `${revision.revision} (${revision.origin}, ${revision.at.slice(0, 10)} by ${revision.actor_name})`], ['Accountable owner', owner ?? 'not assigned'], ['Approver', approval?.approver_name ?? 'not approved'], ['Approved', approval ? approval.approved_at.slice(0, 10) : '—'], ['Effective date', approval?.effective_date ?? '—'], ['Review deadline', approval?.review_due ?? '—']] } }
 return { title: kinds[doc.kind].title, subtitle: content.subtitle, notice, sections: [control, ...content.sections] }
}
export async function exportDocument(env: Bindings, actor: Actor, programId: string, kind: string, revisionNumber: number | null, now: Date) {
 const doc = await requireDocument(env, programId, kind), all = await revisions(env, doc.id), apps = await approvals(env, doc.id)
 const revision = revisionNumber ? all.find(r => r.revision === revisionNumber) : all.at(-1)
 if (!revision) throw new Refusal('Revision not found.', 404)
 await auditStatement(env, actor, 'program-document.exported', `program-document:${doc.id}`, now, 'succeeded', `${kinds[kind].title} revision ${revision.revision}${apps.some(a => a.revision_id === revision.id) ? ' (approved)' : ' (draft)'}`, { revision: revision.revision }).run()
 return { doc, revision, rendered: await render(env, doc, revision, now) }
}
export async function addExhibit(env: Bindings, actor: Actor, programId: string, kind: string, form: FormData, now: Date) {
 const doc = await requireDocument(env, programId, kind), file = form.get('file'), label = form.get('label')
 if (kind !== 'pci-cde-scope') throw new Refusal('Exhibits attach to the cardholder data environment scope.', 409)
 if (typeof label !== 'string' || !['data-flow diagram', 'network diagram', 'other'].includes(label)) throw new Refusal('Choose a data-flow diagram, network diagram or other exhibit.')
 if (!(file instanceof File) || file.size === 0) throw new Refusal('Choose a nonempty file.')
 if (file.size > MAX_FILE) throw new Refusal('File exceeds 10 MiB.', 413)
 const id = crypto.randomUUID(), key = 'program-exhibits/' + id, bytes = await file.arrayBuffer()
 if (!await env.EXHIBITS.put(key, bytes, { onlyIf: { etagDoesNotMatch: '*' }, httpMetadata: { contentType: 'application/octet-stream' } })) throw new Refusal('Object key conflict; nothing was stored.', 409)
 const stored = await env.EXHIBITS.get(key)
 if (!stored) throw new Refusal('Stored bytes could not be read; nothing was recorded.', 503)
 const actual = await stored.arrayBuffer(), digest = await sha256(actual), filename = file.name.replace(/[\x00-\x1f\x7f]/g, '').slice(0, 240) || 'exhibit'
 await env.DB.batch([env.DB.prepare('INSERT INTO program_document_exhibits(id,document_id,label,filename,media_type,size,sha256,object_key,uploaded_by,uploaded_at) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(id, doc.id, label, filename, (file.type || 'application/octet-stream').slice(0, 100), actual.byteLength, digest, key, actor.name, now.toISOString()), auditStatement(env, actor, 'program-document.exhibit-added', `program-document:${doc.id}`, now, 'succeeded', `${label} ${filename} sha256 ${digest.slice(0, 16)}`, { revision: id })])
 return { id, sha256: digest }
}
export async function exhibitBytes(env: Bindings, programId: string, kind: string, id: string) {
 const doc = await requireDocument(env, programId, kind), row = await env.DB.prepare('SELECT * FROM program_document_exhibits WHERE id=? AND document_id=?').bind(id, doc.id).first<{ filename: string; size: number; sha256: string; object_key: string }>()
 if (!row) throw new Refusal('Exhibit not found.', 404)
 const object = await env.EXHIBITS.get(row.object_key), bytes = object ? await object.arrayBuffer() : null
 if (!bytes || bytes.byteLength !== row.size || await sha256(bytes) !== row.sha256) throw new Refusal('The stored bytes are missing or changed; nothing is served.', 409)
 return { bytes, filename: row.filename }
}
// RISK-002 inside the document: add every shipped ePHI scenario not yet in the register.
export async function addLibraryScenarios(env: Bindings, actor: Actor, programId: string, kind: string, input: Input, now: Date) {
 if (kind !== 'hipaa-risk-analysis') throw new Refusal('Library scenarios are added inside the HIPAA risk analysis.', 409)
 const doc = await requireDocument(env, programId, kind), have = new Set((await env.DB.prepare("SELECT library_id FROM risks WHERE origin='library'").all<{ library_id: string }>()).results.map(r => r.library_id))
 const added: string[] = []
 for (const s of ephiScenarios) if (!have.has(s.id)) { await addFromLibrary(env, actor, s.id, now); added.push(s.id) }
 if (!added.length) throw new Refusal('Every shipped ePHI scenario is already in the register.', 409)
 const result = await reviseDocumentWith(env, actor, doc, `Added ${added.length} shipped library scenarios: ${added.join(', ')}`, now)
 return { added, revision: result }
}
async function reviseDocumentWith(env: Bindings, actor: Actor, doc: DocumentRow, reason: string, now: Date) {
 const prior = await latest(env, doc), program = await requireProgram(env, doc.program_id), inputs = parse(prior.inputs_json), generated = await kindOf(doc.kind).generate(await context(env, program, doc.id, inputs, now))
 await insertRevision(env, actor, doc, prior.revision + 1, 'edited', reason, inputs, parse(prior.owner_text_json) as Record<string, string>, generated, now)
 return prior.revision + 1
}
// ISO/IEC 27001 clause 9 records
export async function recordAudit(env: Bindings, actor: Actor, programId: string, input: Input, now: Date) {
 await requireProgram(env, programId)
 const on = text(input, 'performed_on', 10); if (!validDate(on) || on > day(now)) throw new Refusal('The audit date must be a real date, today or earlier.')
 const id = crypto.randomUUID(), statements = [env.DB.prepare('INSERT INTO iso_internal_audits(id,program_id,title,auditor_name,independence,scope,performed_on,summary,recorded_by,recorded_at) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(id, programId, text(input, 'title', 200), text(input, 'auditor_name', 200), text(input, 'independence', 500), text(input, 'scope', 1000), on, text(input, 'summary', 2000, true), actor.name, now.toISOString())]
 let finding: string | null = null
 if (typeof input.finding_description === 'string' && input.finding_description.trim()) {
  finding = crypto.randomUUID()
  statements.push(findingStatement(env, finding, id, input.finding_kind, input, now, await findingOwner(env, input)))
 }
 await env.DB.batch([...statements, auditStatement(env, actor, 'iso.audit-recorded', 'program:' + programId, now, 'succeeded', text(input, 'title', 200), { revision: id })])
 return { id, finding }
}
const findingOwner = async (env: Bindings, input: Input) => typeof input.owner_person_id === 'string' && input.owner_person_id ? (await requirePerson(env, input.owner_person_id, 'corrective-action owner')).id : null
function findingStatement(env: Bindings, id: string, audit: string, kind: unknown, input: Input, now: Date, owner: string | null) {
 const k = typeof kind === 'string' && ['nonconformity', 'observation', 'opportunity'].includes(kind) ? kind : 'nonconformity', due = typeof input.due_date === 'string' && input.due_date ? input.due_date : null
 if (due && !validDate(due)) throw new Refusal('The corrective-action due date must be a real date.')
 const action = typeof input.corrective_action === 'string' ? input.corrective_action.trim().slice(0, 2000) : ''
 if (k === 'nonconformity' && !action) throw new Refusal('A nonconformity needs a corrective action.')
 return env.DB.prepare('INSERT INTO iso_audit_findings(id,audit_id,kind,ref,description,corrective_action,owner_person_id,due_date,recorded_at) VALUES(?,?,?,?,?,?,?,?,?)').bind(id, audit, k, typeof input.ref === 'string' ? input.ref.trim().slice(0, 40) : '', text(input, 'finding_description' in input ? 'finding_description' : 'description', 2000), action, owner, due, now.toISOString())
}
export async function addFinding(env: Bindings, actor: Actor, programId: string, audit: string, input: Input, now: Date) {
 if (!await env.DB.prepare('SELECT 1 FROM iso_internal_audits WHERE id=? AND program_id=?').bind(audit, programId).first()) throw new Refusal('Audit not found.', 404)
 const id = crypto.randomUUID()
 await env.DB.batch([findingStatement(env, id, audit, input.kind, input, now, await findingOwner(env, input)), auditStatement(env, actor, 'iso.finding-recorded', 'program:' + programId, now, 'succeeded', String(input.kind ?? 'nonconformity'), { revision: id })])
 return { id }
}
export async function closeFinding(env: Bindings, actor: Actor, programId: string, finding: string, input: Input, now: Date) {
 const note = text(input, 'note', 1000)
 const changed = await env.DB.prepare("UPDATE iso_audit_findings SET state='closed',closed_by=?,closed_at=?,closure_note=? WHERE id=? AND state='open' AND audit_id IN (SELECT id FROM iso_internal_audits WHERE program_id=?)").bind(actor.name, now.toISOString(), note, finding, programId).run()
 if (!changed.meta.changes) throw new Refusal('Open finding not found.', 404)
 await auditStatement(env, actor, 'iso.finding-closed', 'program:' + programId, now, 'succeeded', '', { reason: note, revision: finding }).run()
}
export const reviewInputNames = ['previous actions', 'external and internal issues', 'performance feedback', 'interested parties feedback', 'risk assessment results and treatment status', 'continual improvement opportunities'] as const
export async function recordManagementReview(env: Bindings, actor: Actor, programId: string, input: Input, now: Date) {
 await requireProgram(env, programId)
 const on = text(input, 'held_on', 10); if (!validDate(on) || on > day(now)) throw new Refusal('The review date must be a real date, today or earlier.')
 const inputs: Record<string, string> = {}
 for (const name of reviewInputNames) { const v = input['input.' + name]; if (typeof v !== 'string' || !v.trim()) throw new Refusal(`Record the required input: ${name}.`); inputs[name] = v.trim().slice(0, 2000) }
 const actions = (typeof input.actions === 'string' ? input.actions : '').split('\n').map(l => l.trim()).filter(Boolean).map(l => { const [action, owner = '', due = ''] = l.split('|').map(x => x.trim()); if (due && !validDate(due)) throw new Refusal('Write each action as "action | owner | due date".'); return { action, owner, due } })
 const id = crypto.randomUUID()
 await env.DB.batch([env.DB.prepare('INSERT INTO iso_management_reviews(id,program_id,held_on,attendees,inputs_json,decisions,actions_json,recorded_by,recorded_at) VALUES(?,?,?,?,?,?,?,?,?)').bind(id, programId, on, text(input, 'attendees', 500), JSON.stringify(inputs), text(input, 'decisions', 2000), JSON.stringify(actions), actor.name, now.toISOString()), auditStatement(env, actor, 'iso.management-review-recorded', 'program:' + programId, now, 'succeeded', on, { revision: id })])
 return { id }
}
// Review deadline reminders to the accountable owner, once per cycle.
export async function documentReminders(env: Bindings, now: Date) {
 let count = 0
 const docs = (await env.DB.prepare('SELECT d.*,p.name AS program_name,pe.email FROM program_documents d JOIN programs p ON p.id=d.program_id LEFT JOIN people pe ON pe.id=d.owner_person_id').all<DocumentRow & { program_name: string; email: string | null }>()).results
 for (const d of docs) {
  const a = (await approvals(env, d.id)).at(-1); if (!a) continue
  const lead = day(new Date(Date.parse(a.review_due + 'T00:00:00Z') - 14 * 86400000)), today = day(now)
  if (today < lead) continue
  const overdue = a.review_due <= today, link = `${env.AUTH_ORIGIN}/app/programs/${d.program_id}/documents/${d.kind}`
  if (sent(await sendFollowup(env, { kind: overdue ? 'document-review-overdue' : 'document-review-lead', subject: 'program-document:' + d.id, cycle: a.review_due, recipient: d.email ?? env.OWNER_EMAIL, title: `${overdue ? 'Review overdue' : 'Review due soon'}: ${kinds[d.kind].title}`, text: `The ${kinds[d.kind].title} for ${d.program_name} ${overdue ? 'was' : 'is'} due for review on ${a.review_due}. Reconcile it with program state and approve a revision: ${link}`, link }, now))) count++
 }
 return count
}

