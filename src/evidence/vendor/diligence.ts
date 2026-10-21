import type { Bindings } from '../../auth.server'
import { addMonths } from '../cadence'
import { day, validDate } from '../model'
import { Refusal } from '../upload'
import { auditStatement, oneOf, text, type Actor, type Input } from '../door'
import { requirePerson } from '../program/people'
import { sendFollowup, sent } from '../followup/send'
import { tokenDigest } from '../review/storage'
import { shipped, type Question, type Template } from './caiq'
import { documentKinds, kindLabels, profileOf, requireVendor, type DocumentRow } from './storage'
// VENDOR-001 diligence: requests sent through expiring supplier links, owner-built
// templates, findings, approvals with expiring conditions and reassessment.
export const requestKinds = [...documentKinds.filter(k => k !== 'contract'), 'contract', 'questionnaire'] as const
const hex = () => Array.from(crypto.getRandomValues(new Uint8Array(32))).map(n => n.toString(16).padStart(2, '0')).join('')
export const parseQuestions = (raw: string): Question[] => {
 const rows = raw.split('\n').map(l => l.trim()).filter(Boolean)
 if (!rows.length || rows.length > 500) throw new Refusal('Give between 1 and 500 questions, one per line.')
 const questions = rows.map((line, i) => { const m = /^([A-Za-z0-9&.\-]{1,20})\s*[:|]\s*(.+)$/.exec(line); return { id: m ? m[1] : `Q-${String(i + 1).padStart(3, '0')}`, domain: 'Owner-built', text: (m ? m[2] : line).slice(0, 500) } })
 if (new Set(questions.map(q => q.id)).size !== questions.length) throw new Refusal('Question ids must be unique.')
 return questions
}
export async function createTemplate(env: Bindings, actor: Actor, input: Input, now: Date) {
 const name = text(input, 'name', 200), questions = parseQuestions(typeof input.questions === 'string' ? input.questions : ''), id = crypto.randomUUID()
 if (shipped.some(t => t.name.toLowerCase() === name.toLowerCase())) throw new Refusal('Choose a name that differs from a shipped template.')
 const licensed = input.licensed_copy === 'yes'
 if (/\bSIG\b|shared assessments/i.test(name) && !licensed) throw new Refusal('SIG content is licensed by Shared Assessments. Confirm you hold a licence for the copy you are importing.')
 await env.DB.batch([env.DB.prepare('INSERT INTO vendor_templates(id,name,questions_json,created_by,created_at) VALUES(?,?,?,?,?)').bind(id, name, JSON.stringify(questions), actor.name, now.toISOString()), auditStatement(env, actor, 'vendor.template-created', 'vendor-template:' + id, now, 'succeeded', `${questions.length} questions${licensed ? ', owner confirmed a licensed copy' : ''}`, { revision: id })])
 return { id, questions: questions.length }
}
export async function templates(env: Bindings): Promise<Template[]> {
 const own = (await env.DB.prepare('SELECT id,name,questions_json FROM vendor_templates ORDER BY created_at,rowid').all<{ id: string; name: string; questions_json: string }>()).results
 return [...shipped.map(t => ({ ...t, owner_built: false })), ...own.map(t => ({ id: t.id, name: t.name, revision: 1, source: 'Owner-built template', questions: JSON.parse(t.questions_json) as Question[], owner_built: true }))]
}
export interface LinkRow { id: string; vendor_id: string; contact_email: string; expires_at: string; created_by: string; created_at: string; closed_at: string | null; emailed_at: string | null }
const linkColumns = 'id,vendor_id,contact_email,expires_at,created_by,created_at,closed_at,emailed_at'
export function futureExpiry(value: unknown, now: Date) {
 if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2})?Z?)?$/.test(value)) throw new Refusal('Choose a real future expiry in UTC.')
 const iso = value.length === 10 ? value + 'T23:59:59Z' : value.endsWith('Z') ? value : value + 'Z', ms = Date.parse(iso)
 if (!validDate(iso.slice(0, 10)) || !Number.isFinite(ms) || ms <= now.getTime()) throw new Refusal('Choose a real future expiry in UTC.')
 if (ms - now.getTime() > 90 * 86400000) throw new Refusal('A supplier link lasts at most 90 days.')
 return new Date(ms).toISOString()
}
// One link carries the open requests it names; the bearer token shows once and
// only its digest is kept. Emailing the link is a separate explicit choice.
export async function issueRequests(env: Bindings, actor: Actor, vendorId: string, input: Input, now: Date) {
 const vendor = await requireVendor(env, vendorId), profile = await profileOf(env, vendorId)
 const kinds = (Array.isArray(input.kinds) ? input.kinds : typeof input.kinds === 'string' && input.kinds ? [input.kinds] : []) as string[]
 const existing = Array.isArray(input.request_ids) ? input.request_ids : typeof input.request_ids === 'string' && input.request_ids ? [input.request_ids] : []
 if (!kinds.length && !existing.length) throw new Refusal('Choose at least one document or questionnaire to request.')
 const due = typeof input.due_date === 'string' && input.due_date ? input.due_date : null
 if (due && (!validDate(due) || due <= day(now))) throw new Refusal('The due date must be a future date.')
 const expires = futureExpiry(input.expires_at, now), email = text(input, 'contact_email', 254, true).toLowerCase() || profile?.contact_email || ''
 if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Refusal('Enter a real contact email address.')
 const all = await templates(env), statements: D1PreparedStatement[] = [], ids: string[] = [], linkId = crypto.randomUUID(), token = hex(), at = now.toISOString()
 statements.push(env.DB.prepare('INSERT INTO vendor_links(id,vendor_id,token_hash,contact_email,expires_at,created_by,created_at) VALUES(?,?,?,?,?,?,?)').bind(linkId, vendorId, await tokenDigest(token), email, expires, actor.name, at))
 for (const kind of kinds) {
  if (!(requestKinds as readonly string[]).includes(kind)) throw new Refusal(`Unknown request kind ${kind}.`)
  const rid = crypto.randomUUID(); ids.push(rid)
  let template: Template | undefined
  if (kind === 'questionnaire') { template = all.find(t => t.id === (typeof input.template_id === 'string' && input.template_id ? input.template_id : 'caiq-v4')); if (!template) throw new Refusal('Choose a shipped or owner-built questionnaire template.') }
  statements.push(env.DB.prepare('INSERT INTO vendor_requests(id,vendor_id,kind,label,template_id,template_name,questions_json,due_date,created_by,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)').bind(rid, vendorId, kind, template ? `${template.name} (revision ${template.revision})` : kindLabels[kind], template?.id ?? null, template?.name ?? null, template ? JSON.stringify(template.questions) : null, due, actor.name, at))
 }
 for (const rid of existing) {
  const open = await env.DB.prepare("SELECT 1 FROM vendor_requests WHERE id=? AND vendor_id=? AND closed_at IS NULL").bind(rid, vendorId).first()
  if (!open) throw new Refusal('Re-issue only open requests of this vendor.', 404)
  ids.push(rid)
 }
 for (const rid of ids) statements.push(env.DB.prepare('INSERT INTO vendor_link_requests(link_id,request_id) VALUES(?,?)').bind(linkId, rid))
 statements.push(auditStatement(env, actor, 'vendor.requests-issued', 'vendor:' + vendorId, now, 'succeeded', `${ids.length} request(s), link expires ${expires}`, { revision: linkId }))
 await env.DB.batch(statements)
 const url = `${env.AUTH_ORIGIN}/supplier/${token}`
 let emailed = false
 if (input.send_email === 'yes') {
  if (!email) throw new Refusal('Add a supplier contact email to email the link.')
  const result = await sendFollowup(env, { kind: 'vendor-request-link', subject: 'vendor-link:' + linkId, cycle: expires, recipient: email, scheduled: false, link: url, title: `Security information request from ${env.OWNER_EMAIL ? 'your customer' : 'a customer'}`, text: `You have been asked to provide security documents or answer a security questionnaire. Use this private link before ${expires}:\n\n${url}\n\nThe link shows only this request.` }, now)
  if (sent(result)) { emailed = true; await env.DB.batch([env.DB.prepare('UPDATE vendor_links SET emailed_at=? WHERE id=?').bind(at, linkId), auditStatement(env, actor, 'vendor.link-emailed', 'vendor:' + vendorId, now, 'succeeded', 'supplier contact notified by email', { revision: linkId })]) }
  else await auditStatement(env, actor, 'vendor.link-emailed', 'vendor:' + vendorId, now, 'failed', `delivery ${result}`, { revision: linkId }).run()
 }
 return { vendor: vendor.name, link_id: linkId, url, expires_at: expires, request_ids: ids, emailed }
}
export async function closeLink(env: Bindings, actor: Actor, vendor: string, link: string, now: Date) {
 const changed = await env.DB.prepare('UPDATE vendor_links SET closed_at=? WHERE id=? AND vendor_id=? AND closed_at IS NULL').bind(now.toISOString(), link, vendor).run()
 if (!changed.meta.changes) throw new Refusal('Open link not found.', 404)
 await auditStatement(env, actor, 'vendor.link-closed', 'vendor:' + vendor, now, 'succeeded', '', { revision: link }).run()
}
export async function closeRequest(env: Bindings, actor: Actor, vendor: string, request: string, input: Input, now: Date) {
 const reason = text(input, 'reason', 500)
 const changed = await env.DB.prepare('UPDATE vendor_requests SET closed_at=?,closed_reason=?,closed_by=? WHERE id=? AND vendor_id=? AND closed_at IS NULL').bind(now.toISOString(), reason, actor.name, request, vendor).run()
 if (!changed.meta.changes) throw new Refusal('Open request not found.', 404)
 await auditStatement(env, actor, 'vendor.request-closed', 'vendor:' + vendor, now, 'succeeded', '', { reason, revision: request }).run()
}
export interface RequestRow { id: string; vendor_id: string; kind: string; label: string; template_id: string | null; template_name: string | null; questions_json: string | null; due_date: string | null; created_by: string; created_at: string; closed_at: string | null; closed_reason: string | null; closed_by: string | null; received_at: string | null; received_documents: number; submitted_at: string | null; respondent_name: string | null }
export const requestsOf = async (env: Bindings, vendor: string) => (await env.DB.prepare(`SELECT r.*,(SELECT MAX(added_at) FROM vendor_documents d WHERE d.request_id=r.id) AS received_at,(SELECT COUNT(*) FROM vendor_documents d WHERE d.request_id=r.id) AS received_documents,s.submitted_at,s.respondent_name FROM vendor_requests r LEFT JOIN vendor_submissions s ON s.request_id=r.id WHERE r.vendor_id=? ORDER BY r.created_at,r.rowid`).bind(vendor).all<RequestRow>()).results
export const requestState = (r: RequestRow) => r.kind === 'questionnaire' ? (r.submitted_at ? 'received' : r.closed_at ? 'closed' : 'open') : r.received_documents ? 'received' : r.closed_at ? 'closed' : 'open'
export const linksOf = async (env: Bindings, vendor: string) => (await env.DB.prepare(`SELECT ${linkColumns},(SELECT COUNT(*) FROM vendor_link_requests q WHERE q.link_id=vendor_links.id) AS requests FROM vendor_links WHERE vendor_id=? ORDER BY created_at,rowid`).bind(vendor).all<LinkRow & { requests: number }>()).results
export const linkEvents = async (env: Bindings, vendor: string) => (await env.DB.prepare('SELECT id,link_id,action,outcome,at FROM vendor_link_events WHERE vendor_id=? ORDER BY at DESC,rowid DESC LIMIT 50').bind(vendor).all<{ id: string; link_id: string | null; action: string; outcome: string; at: string }>()).results
export const answersOf = async (env: Bindings, request: string) => (await env.DB.prepare('SELECT a.question_id,a.answer,a.comment,a.answered_at,a.link_id FROM vendor_answers a WHERE a.request_id=? ORDER BY a.rowid').bind(request).all<{ question_id: string; answer: string; comment: string; answered_at: string; link_id: string }>()).results
// Findings
export async function recordFinding(env: Bindings, actor: Actor, vendor: string, input: Input, now: Date) {
 await requireVendor(env, vendor)
 const severity = oneOf(input, 'severity', ['low', 'medium', 'high', 'critical'] as const), kind = oneOf(input, 'source_kind', ['document', 'answer', 'manual'] as const), ref = text(input, 'source_ref', 200, kind === 'manual')
 if (kind === 'document' && !await env.DB.prepare('SELECT 1 FROM vendor_documents WHERE id=? AND vendor_id=?').bind(ref, vendor).first()) throw new Refusal('Cite a document of this vendor.')
 if (kind === 'answer' && !/^[0-9a-f-]{36}:/.test(ref)) throw new Refusal('Cite an answer as requestId:questionId.')
 if (kind === 'answer') { const [rid, qid] = [ref.slice(0, 36), ref.slice(37)]; if (!await env.DB.prepare('SELECT 1 FROM vendor_answers WHERE request_id=? AND question_id=?').bind(rid, qid).first()) throw new Refusal('Cite an answer this supplier gave.') }
 const id = crypto.randomUUID()
 await env.DB.batch([env.DB.prepare('INSERT INTO vendor_findings(id,vendor_id,source_kind,source_ref,severity,title,detail,recorded_by,recorded_at) VALUES(?,?,?,?,?,?,?,?,?)').bind(id, vendor, kind, ref, severity, text(input, 'title', 300), text(input, 'detail', 2000, true), actor.name, now.toISOString()), auditStatement(env, actor, 'vendor.finding-recorded', 'vendor:' + vendor, now, 'succeeded', `${severity}: ${kind}`, { revision: id })])
 return id
}
export async function decideFinding(env: Bindings, actor: Actor, vendor: string, finding: string, input: Input, now: Date) {
 const decision = oneOf(input, 'decision', ['resolved', 'accepted'] as const), reason = text(input, 'reason', 1000)
 // An accepted finding is an exception: a named approver must own it.
 const approver = decision === 'accepted' ? (await requirePerson(env, input.approver_person_id, 'named approver')).id : null
 const changed = await env.DB.prepare("UPDATE vendor_findings SET state=?,decision_reason=?,approver_person_id=?,decided_by=?,decided_at=? WHERE id=? AND vendor_id=? AND state='open'").bind(decision, reason, approver, actor.name, now.toISOString(), finding, vendor).run()
 if (!changed.meta.changes) throw new Refusal('Open finding not found.', 404)
 await auditStatement(env, actor, 'vendor.finding-decided', 'vendor:' + vendor, now, 'succeeded', decision, { reason, revision: finding }).run()
}
export const findingsOf = async (env: Bindings, vendor: string) => (await env.DB.prepare('SELECT f.*,p.name AS approver_name FROM vendor_findings f LEFT JOIN people p ON p.id=f.approver_person_id WHERE f.vendor_id=? ORDER BY f.recorded_at,f.rowid').bind(vendor).all<Record<string, string | null>>()).results
// Diligence the profile makes necessary, and what each item stands at.
export interface Need { key: string; label: string; state: 'verified' | 'received' | 'expired' | 'requested' | 'overdue' | 'missing' | 'not required'; detail: string }
export function needs(profile: { risk_tier: string; data_types: string[] } | null, docs: DocumentRow[], requests: RequestRow[], now: Date): Need[] {
 const tier = profile?.risk_tier ?? 'medium', types = profile?.data_types ?? [], today = day(now)
 const doc = (kinds: string[]) => docs.filter(d => kinds.includes(d.kind) && d.review_state !== 'rejected' && !docs.some(n => n.supersedes === d.id)).at(-1)
 const asked = (kinds: string[]) => requests.find(r => kinds.includes(r.kind) && requestState(r) === 'open')
 const item = (key: string, label: string, kinds: string[], required: boolean, detail = ''): Need => {
  const d = doc(kinds), open = asked(kinds)
  if (d) return { key, label, state: d.expires_on && d.expires_on < today ? 'expired' : d.review_state === 'verified' ? 'verified' : 'received', detail: `${kindLabels[d.kind]} received ${d.added_at.slice(0, 10)}${d.review_state === 'verified' ? ', verified by ' + d.reviewed_by : ', not yet reviewed'}${d.expires_on ? ', expires ' + d.expires_on : ''}` }
  if (open) return { key, label, state: open.due_date && open.due_date < today ? 'overdue' : 'requested', detail: `Requested${open.due_date ? ', due ' + open.due_date : ''}` }
  return { key, label, state: required ? 'missing' : 'not required', detail: required ? detail || 'Not requested yet' : 'Not required for this tier or data' }
 }
 const q = requests.filter(r => r.kind === 'questionnaire'), submitted = q.filter(r => r.submitted_at).at(-1), openQ = q.find(r => requestState(r) === 'open')
 const questionnaire: Need = submitted ? { key: 'questionnaire', label: 'Security questionnaire', state: 'received', detail: `${submitted.template_name} submitted ${submitted.submitted_at!.slice(0, 10)} by ${submitted.respondent_name} (supplier-asserted)` } : openQ ? { key: 'questionnaire', label: 'Security questionnaire', state: openQ.due_date && openQ.due_date < today ? 'overdue' : 'requested', detail: `Requested${openQ.due_date ? ', due ' + openQ.due_date : ''}` } : { key: 'questionnaire', label: 'Security questionnaire', state: tier === 'low' ? 'not required' : 'missing', detail: tier === 'low' ? 'Not required for this tier' : 'Not requested yet' }
 return [
  item('soc2', 'SOC 2 or ISO 27001 assurance', ['soc2', 'iso27001'], tier !== 'low'),
  item('baa', 'Business associate agreement', ['baa'], types.includes('PHI'), 'The supplier handles ePHI, so a signed BAA is a prerequisite'),
  item('dpa', 'Data processing agreement', ['dpa'], types.includes('personal data'), 'The supplier handles personal data'),
  questionnaire,
 ]
}
// Approvals
export interface ApprovalRow { id: string; vendor_id: string; decision: 'approved' | 'conditional' | 'declined'; rationale: string; approver_person_id: string | null; approver_name: string | null; conditions: string; condition_expires_on: string | null; reassess_by: string; exceptions_json: string; decided_by: string; decided_at: string; condition_closed_by: string | null; condition_closed_at: string | null; condition_closed_note: string | null }
export const approvalsOf = async (env: Bindings, vendor: string) => (await env.DB.prepare('SELECT a.*,p.name AS approver_name FROM vendor_approvals a LEFT JOIN people p ON p.id=a.approver_person_id WHERE a.vendor_id=? ORDER BY a.decided_at,a.rowid').bind(vendor).all<ApprovalRow>()).results
export async function approve(env: Bindings, actor: Actor, vendorId: string, input: Input, now: Date) {
 const vendor = await requireVendor(env, vendorId), profile = await profileOf(env, vendorId)
 const decision = oneOf(input, 'decision', ['approved', 'conditional', 'declined'] as const), rationale = text(input, 'rationale', 2000)
 const conditions = text(input, 'conditions', 1000, decision !== 'conditional')
 let conditionExpires: string | null = null
 if (decision === 'conditional') {
  conditionExpires = typeof input.condition_expires_on === 'string' ? input.condition_expires_on : ''
  if (!conditions || !validDate(conditionExpires) || conditionExpires <= day(now)) throw new Refusal('A conditional approval names its condition and a future expiry date.')
 }
 const docs = (await env.DB.prepare('SELECT * FROM vendor_documents WHERE vendor_id=? ORDER BY added_at,rowid').bind(vendorId).all<DocumentRow>()).results
 const open = (await findingsOf(env, vendorId)).filter(f => f.state === 'open'), missing = needs(profile, docs, await requestsOf(env, vendorId), now).filter(n => n.state === 'missing' || n.state === 'expired' || n.state === 'overdue')
 const exceptions = decision === 'declined' ? [] : [...open.map(f => `open finding (${f.severity}): ${f.title}`), ...missing.map(n => `${n.state} diligence: ${n.label}`)]
 // Approving past open findings or missing diligence is an exception: a named approver owns it.
 const approver = exceptions.length || input.approver_person_id ? (await requirePerson(env, input.approver_person_id, 'named approver')).id : null
 if (exceptions.length && !approver) throw new Refusal('This approval has exceptions; name an approver.')
 const tierMonths = profile?.risk_tier === 'high' ? 6 : 12
 let reassess = typeof input.reassess_by === 'string' && input.reassess_by ? input.reassess_by : day(addMonths(now, tierMonths))
 if (!(typeof input.reassess_by === 'string' && input.reassess_by) && profile?.renewal_date && profile.renewal_date > day(now) && profile.renewal_date < reassess) reassess = profile.renewal_date
 if (!validDate(reassess) || reassess <= day(now)) throw new Refusal('The reassessment date must be in the future.')
 const id = crypto.randomUUID()
 await env.DB.batch([env.DB.prepare('INSERT INTO vendor_approvals(id,vendor_id,decision,rationale,approver_person_id,conditions,condition_expires_on,reassess_by,exceptions_json,decided_by,decided_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind(id, vendorId, decision, rationale, approver, conditions, conditionExpires, reassess, JSON.stringify(exceptions), actor.name, now.toISOString()), auditStatement(env, actor, 'vendor.' + decision, 'vendor:' + vendorId, now, 'succeeded', `${vendor.name}; reassess by ${reassess}${exceptions.length ? '; ' + exceptions.length + ' exception(s)' : ''}`, { reason: rationale, revision: id })])
 return { id, reassess_by: reassess, exceptions }
}
export async function closeCondition(env: Bindings, actor: Actor, vendor: string, approval: string, input: Input, now: Date) {
 const note = text(input, 'note', 1000)
 const changed = await env.DB.prepare("UPDATE vendor_approvals SET condition_closed_by=?,condition_closed_at=?,condition_closed_note=? WHERE id=? AND vendor_id=? AND decision='conditional' AND condition_closed_at IS NULL").bind(actor.name, now.toISOString(), note, approval, vendor).run()
 if (!changed.meta.changes) throw new Refusal('Open condition not found.', 404)
 await auditStatement(env, actor, 'vendor.condition-met', 'vendor:' + vendor, now, 'succeeded', '', { reason: note, revision: approval }).run()
}
// Where a vendor's approval and reassessment stand now.
export function standing(approvals: ApprovalRow[], now: Date) {
 const latest = approvals.at(-1) ?? null, today = day(now)
 if (!latest) return { approval: 'not assessed', reassessment: 'not assessed', reassess_by: null as string | null, condition: null as string | null, latest }
 const lapsed = latest.decision === 'conditional' && !latest.condition_closed_at && !!latest.condition_expires_on && latest.condition_expires_on <= today
 const approval = latest.decision === 'declined' ? 'declined' : latest.decision === 'conditional' ? (latest.condition_closed_at ? 'approved (condition met)' : lapsed ? 'condition lapsed' : 'conditionally approved') : 'approved'
 const soon = day(new Date(Date.parse(latest.reassess_by + 'T00:00:00Z') - 14 * 86400000))
 return { approval, reassessment: latest.decision === 'declined' ? 'not applicable' : latest.reassess_by <= today ? 'overdue' : soon <= today ? 'due soon' : 'current', reassess_by: latest.reassess_by, condition: latest.decision === 'conditional' ? `${latest.conditions} (expires ${latest.condition_expires_on}${latest.condition_closed_at ? ', met ' + latest.condition_closed_at.slice(0, 10) : ''})` : null, latest }
}
// Reminders to the vendor's business owner (or the installation owner), once per cycle:
// reassessment at 14 days ahead and when overdue, a lapsed condition, and an overdue request.
export async function vendorReminders(env: Bindings, now: Date) {
 let count = 0
 const vendors = (await env.DB.prepare('SELECT v.id,v.name,p.email FROM vendors v LEFT JOIN people p ON p.id=v.owner_person_id').all<{ id: string; name: string; email: string | null }>()).results
 for (const v of vendors) {
  const to = v.email ?? env.OWNER_EMAIL, link = `${env.AUTH_ORIGIN}/app/vendors/${v.id}`, s = standing(await approvalsOf(env, v.id), now)
  const send = async (kind: string, subject: string, cycle: string, title: string, body: string) => { if (sent(await sendFollowup(env, { kind, subject, cycle, recipient: to, title, text: `${body}\n\nOpen the vendor in Evidence: ${link}`, link }, now))) count++ }
  if (s.reassessment === 'due soon' || s.reassessment === 'overdue') await send(s.reassessment === 'overdue' ? 'vendor-reassessment-overdue' : 'vendor-reassessment-lead', 'vendor:' + v.id, s.reassess_by!, `${s.reassessment === 'overdue' ? 'Reassessment overdue' : 'Reassessment due soon'}: ${v.name}`, `The security reassessment of ${v.name} ${s.reassessment === 'overdue' ? 'was' : 'is'} due ${s.reassess_by}. Record a new approval decision to complete it.`)
  if (s.approval === 'condition lapsed') await send('vendor-condition-lapsed', 'vendor:' + v.id, s.latest!.id, `Approval condition expired: ${v.name}`, `The condition on ${v.name}'s approval expired ${s.latest!.condition_expires_on}: ${s.latest!.conditions}. Record that it was met or decide again.`)
  for (const r of await requestsOf(env, v.id)) if (requestState(r) === 'open' && r.due_date && r.due_date <= day(now)) await send('vendor-request-overdue', 'vendor-request:' + r.id, r.due_date, `Supplier request overdue: ${v.name}`, `${r.label} requested from ${v.name} was due ${r.due_date} and has not been received. Re-issue the link or close the request with a reason.`)
 }
 return count
}
export const reminderLog = async (env: Bindings, vendor: string) => (await env.DB.prepare("SELECT kind,cycle_key,recipient,state,created_at FROM followups WHERE subject_id=? OR subject_id IN (SELECT 'vendor-request:'||id FROM vendor_requests WHERE vendor_id=?) ORDER BY created_at,rowid").bind('vendor:' + vendor, vendor).all<{ kind: string; cycle_key: string; recipient: string; state: string; created_at: string }>()).results
