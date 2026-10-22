import { runtimeBindings, type Bindings } from '../../auth.server'
import { boundedBody, MAX_FILE, Refusal } from '../upload'
import { auditStatement } from '../door'
import { safeHeaders } from '../review/frame'
import { tokenDigest } from '../review/storage'
import { storeDocument, documentKinds } from './storage'
import { answersOf, type LinkRow } from './diligence'
import { supplierPage, questionnairePage, type OpenRequest } from './supplier-view'
import { completedWorkbook, encodeAnswer, type SupplierAnswer } from './workbook'
import type { Question } from './caiq'
// The supplier door: a bearer link scoped to one vendor's named requests. Every
// refusal (unknown, expired, closed, other vendor's request) is the same plain
// 404, recorded against the link when one is known.
const absent = () => new Response('Not found.\n', { status: 404, headers: { ...safeHeaders, 'content-type': 'text/plain; charset=utf-8' } })
const json = (data: unknown, status = 200) => Response.json(data, { status, headers: safeHeaders })
const redirect = (to: string) => new Response(null, { status: 303, headers: { ...safeHeaders, location: to } })
const active = (link: LinkRow, now: Date) => !link.closed_at && now.getTime() < Date.parse(link.expires_at)
async function openRequests(env: Bindings, link: LinkRow) {
 return (await env.DB.prepare(`SELECT r.id,r.kind,r.label,r.questions_json,r.due_date,s.submitted_at,(SELECT COUNT(*) FROM vendor_documents d WHERE d.request_id=r.id) AS received FROM vendor_requests r JOIN vendor_link_requests lr ON lr.request_id=r.id AND lr.link_id=? LEFT JOIN vendor_submissions s ON s.request_id=r.id WHERE r.vendor_id=? AND r.closed_at IS NULL ORDER BY r.created_at,r.rowid`).bind(link.id, link.vendor_id).all<OpenRequest>()).results
}
const log = (env: Bindings, link: LinkRow | null, action: string, outcome: 'allowed' | 'refused', now: Date) => env.DB.prepare('INSERT INTO vendor_link_events(id,link_id,vendor_id,action,outcome,at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(), link?.id ?? null, link?.vendor_id ?? null, action, outcome, now.toISOString()).run()
async function handle(request: Request, env: Bindings, clock: () => Date) {
 if (request.headers.get('sec-fetch-site') === 'cross-site') return absent()
 const url = new URL(request.url), m = /^\/supplier\/([a-f0-9]{64})(?:\/requests\/([a-f0-9-]{36})(?:\/(documents|answers|workbook))?)?$/.exec(url.pathname)
 const action = !m ? 'unknown' : !m[2] ? 'page' : !m[3] ? 'questionnaire' : m[3]
 const link = m ? await env.DB.prepare('SELECT id,vendor_id,contact_email,expires_at,created_by,created_at,closed_at,emailed_at FROM vendor_links WHERE token_hash=?').bind(await tokenDigest(m[1])).first<LinkRow>() : null
 const refuse = async () => { await log(env, link, action, 'refused', clock()); return absent() }
 // The URL token is the credential, so no Origin check applies: pages send no referrer, which makes browsers send Origin: null on form posts.
 const write = action === 'documents' || action === 'answers' || action === 'workbook'
 if (!m || !link || !active(link, clock()) || url.origin !== env.AUTH_ORIGIN || (request.headers.has('host') && request.headers.get('host')?.toLowerCase() !== url.host.toLowerCase()) || request.headers.get('sec-fetch-site') === 'cross-site' || (write ? request.method !== 'POST' : !['GET', 'HEAD'].includes(request.method))) return refuse()
 const token = m[1], wantsJson = (request.headers.get('accept') ?? '').includes('application/json'), vendor = await env.DB.prepare('SELECT name FROM vendors WHERE id=?').bind(link.vendor_id).first<{ name: string }>()
 const requests = await openRequests(env, link), name = vendor?.name ?? 'the supplier'
 const actor = { id: link.id, name: `Supplier link for ${name}`, kind: 'token' as const }
 if (!m[2]) {
  await log(env, link, 'page', 'allowed', clock())
  return wantsJson ? json({ vendor: name, expires_at: link.expires_at, requests: requests.map(r => ({ id: r.id, kind: r.kind, label: r.label, due_date: r.due_date, received: r.received, submitted: !!r.submitted_at })) }) : supplierPage(name, link.expires_at, token, requests)
 }
 const req = requests.find(r => r.id === m[2])
 if (!req) return refuse()
 const questions = req.questions_json ? JSON.parse(req.questions_json) as Question[] : []
 if (action === 'questionnaire') {
  if (req.kind !== 'questionnaire') return refuse()
  const answers = new Map((await answersOf(env, req.id)).map(a => [a.question_id, a]))
  await log(env, link, 'questionnaire', 'allowed', clock())
  return wantsJson ? json({ request: req.id, label: req.label, submitted: !!req.submitted_at, edition: questions[0]?.edition, questions: questions.map(({ source_row: _row, workbook: _meta, ...q }) => q), answers: Object.fromEntries(answers) }) : questionnairePage(name, token, req, questions, answers)
 }
 const now = clock()
 try {
  if (action === 'documents') {
   if (req.kind === 'questionnaire') return refuse()
   if (!request.headers.get('content-type')?.startsWith('multipart/form-data;')) throw new Refusal('Use the file upload form.')
   let form: FormData
   try { form = await new Response(await boundedBody(request, MAX_FILE + 65536), { headers: { 'content-type': request.headers.get('content-type')! } }).formData() } catch (error) { if (error instanceof Refusal) throw error; throw new Refusal('Invalid upload form.') }
   const date = (k: string) => { const v = form.get(k); return typeof v === 'string' && v ? v : null }, kind = (documentKinds as readonly string[]).includes(req.kind) ? req.kind as typeof documentKinds[number] : 'other'
   const stored = await storeDocument(env, actor, { vendor: link.vendor_id, request: req.id, kind, file: form.get('file') as File, origin: 'supplier', providedBy: `Supplier link (${link.contact_email || 'no contact recorded'})`, link: link.id, effective: date('effective_on'), expires: date('expires_on') }, now)
   await log(env, link, 'documents', 'allowed', now)
   return wantsJson ? json({ id: stored.id, sha256: stored.sha256 }, 201) : redirect(`/supplier/${token}`)
  }
  if (req.kind !== 'questionnaire') return refuse()
  if (req.submitted_at) throw new Refusal('This questionnaire was already submitted.', 409)
  const type = request.headers.get('content-type') ?? ''
  let given = new Map<string, SupplierAnswer>(), extra: Record<string, string> = {}, workbookFile: File | null = null
  const body = action === 'workbook' ? '' : new TextDecoder().decode(await boundedBody(request, 4 * 1024 * 1024))
  let submit = false
  if (action === 'workbook') {
   if (!type.startsWith('multipart/form-data;') || !questions[0]?.workbook) throw new Refusal('This request needs its licensed workbook upload form.')
   let form: FormData
   try { form = await new Response(await boundedBody(request, MAX_FILE + 65536), { headers: { 'content-type': type } }).formData() } catch { throw new Refusal('Invalid completed-workbook form.') }
   const file = form.get('file')
   if (!(file instanceof File) || !file.size || file.size > MAX_FILE) throw new Refusal('Choose a completed workbook up to 10 MiB.')
   given = completedWorkbook(file, new Uint8Array(await file.arrayBuffer()), { edition: String(form.get('edition') ?? '') }, questions, questions[0].workbook)
   extra.respondent_name = String(form.get('respondent_name') ?? ''); extra.respondent_email = String(form.get('respondent_email') ?? '')
   workbookFile = file; submit = true
  } else if (type.startsWith('application/json')) {
   let value: { answers?: Record<string, { answer?: string; comment?: string; ownership?: string; implementation?: string }>; respondent_name?: string; respondent_email?: string; submit?: boolean }
   try { value = JSON.parse(body) } catch { throw new Refusal('Send one JSON object.') }
   for (const [id, a] of Object.entries(value.answers ?? {})) given.set(id, { answer: String(a?.answer ?? ''), comment: String(a?.comment ?? ''), ownership: String(a?.ownership ?? ''), implementation: String(a?.implementation ?? '') })
   extra.respondent_name = String(value.respondent_name ?? ''); extra.respondent_email = String(value.respondent_email ?? ''); submit = value.submit === true
  } else if (type.startsWith('application/x-www-form-urlencoded')) {
   const form = new URLSearchParams(body)
   for (const q of questions) { const a = form.get('answer.' + q.id); if (a) given.set(q.id, { answer: a, comment: form.get('comment.' + q.id) ?? '', ownership: form.get('ownership.' + q.id) ?? '', implementation: form.get('implementation.' + q.id) ?? '' }) }
   extra.respondent_name = form.get('respondent_name') ?? ''; extra.respondent_email = form.get('respondent_email') ?? ''; submit = form.get('submit') === 'yes'
  } else throw new Refusal('Use the form or JSON.')
  const known = new Set(questions.filter(q => q.in_scope !== false).map(q => q.id)), prior = new Map((await answersOf(env, req.id)).map(a => [a.question_id, a]))
  const statements: D1PreparedStatement[] = []
  for (const [id, a] of given) {
   if (!known.has(id)) throw new Refusal(`Unknown question ${id.slice(0, 40)}.`)
   if (!['yes', 'no', 'na'].includes(a.answer) || a.comment.length > 2000 || (a.ownership?.length ?? 0) > 500 || (a.implementation?.length ?? 0) > 4000) throw new Refusal('Answer yes, no or not applicable, with a comment up to 2,000 characters.')
   const q = questions.find(q => q.id === id)!
   if (q.template_type === 'caiq-v4' && (!a.ownership?.trim() || !a.implementation?.trim())) throw new Refusal('CAIQ answers require SSRM control ownership and an implementation description.')
   const before = prior.get(id); if (before && before.answer === a.answer && encodeAnswer(before) === encodeAnswer(a)) continue
   statements.push(env.DB.prepare('INSERT INTO vendor_answers(id,request_id,question_id,answer,comment,link_id,answered_at) VALUES(?,?,?,?,?,?,?)').bind(crypto.randomUUID(), req.id, id, a.answer, encodeAnswer(a), link.id, now.toISOString()))
   prior.set(id, { question_id: id, answer: a.answer, comment: a.comment, answered_at: now.toISOString(), link_id: link.id })
  }
  if (submit) {
   const unanswered = questions.filter(q => q.in_scope !== false && !prior.has(q.id)).length, respondent = extra.respondent_name.trim(), email = extra.respondent_email.trim().toLowerCase()
   if (unanswered) throw new Refusal(`${unanswered} question${unanswered === 1 ? ' is' : 's are'} still unanswered; answer every question before submitting.`)
   if (!respondent || respondent.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Refusal('Give your name and email address to submit.')
   statements.push(env.DB.prepare('INSERT INTO vendor_submissions(id,request_id,link_id,respondent_name,respondent_email,submitted_at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(), req.id, link.id, respondent, email, now.toISOString()))
  }
  statements.push(auditStatement(env, actor, submit ? 'vendor.supplier-submitted' : 'vendor.supplier-answers-saved', 'vendor:' + link.vendor_id, now, 'succeeded', `${given.size} answer(s) for ${req.label}; supplier-asserted, unverified`, { revision: req.id }), env.DB.prepare('INSERT INTO vendor_link_events(id,link_id,vendor_id,action,outcome,at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(), link.id, link.vendor_id, 'answers', 'allowed', now.toISOString()))
  if (workbookFile) await storeDocument(env, actor, { vendor: link.vendor_id, request: req.id, kind: 'other', file: workbookFile, origin: 'supplier', providedBy: 'Completed licensed workbook; supplier-asserted, unverified', link: link.id, effective: null, expires: null }, now)
  await env.DB.batch(statements)
  return wantsJson || type.startsWith('application/json') ? json({ saved: given.size, submitted: submit }, 201) : redirect(submit ? `/supplier/${token}` : `/supplier/${token}/requests/${req.id}`)
 } catch (error) {
  if (error instanceof Refusal) return wantsJson || (request.headers.get('content-type') ?? '').startsWith('application/json') ? json({ error: error.message }, error.status) : new Response(`${error.message}\n`, { status: error.status, headers: { ...safeHeaders, 'content-type': 'text/plain; charset=utf-8' } })
  throw error
 }
}
export function supplierHandler(clock: () => Date = () => new Date()) {
 return async (request: Request, original: Bindings): Promise<Response | null> => {
  const path = new URL(request.url).pathname
  if (path !== '/supplier' && !path.startsWith('/supplier/')) return null
  try { return await handle(request, runtimeBindings(original), clock) }
  catch { return json({ error: 'Storage unavailable; access cannot be established.' }, 503) }
 }
}
