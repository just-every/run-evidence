import { Refusal, boundedBody, MAX_FILE } from '../../upload'
import { done, json, ownerRoutes, readInput, uuid, type Route } from '../../door'
import { people } from '../people'
import { requireProgram } from '../storage'
import { docx } from './docx'
import { pdf } from './pdf'
import { xlsx } from './xlsx'
import { addExhibit, addFinding, addLibraryScenarios, approveDocument, approvals, closeFinding, documentState, exhibitBytes, exhibits, exportDocument, generateDocument, kindOf, listDocuments, reconcileDocument, recordAudit, recordManagementReview, requireDocument, reviseDocument, revisions, updateSettings } from './storage'
import { documentPage, documentsPage } from './view'
const id = `(${uuid})`, kind = '([a-z0-9-]{3,40})'
const both = (path: string) => new RegExp(`^/(?:app|api)${path}$`)
const base = (program: string, k: string) => `/app/programs/${program}/documents/${k}`
const types = { pdf: 'application/pdf', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' } as const
export function documentHandler(clock: () => Date) {
 const routes: Route[] = [
  { method: 'GET', pattern: both(`/programs/${id}/documents`), run: async (c, m) => { const program = await requireProgram(c.env, m[1]), docs = await listDocuments(c.env, program, c.now); return c.isApi ? json({ documents: docs }) : documentsPage(program, docs as never, await people(c.env), c.actor.name) } },
  { method: 'POST', pattern: both(`/programs/${id}/documents`), run: async (c, m) => { const created = await generateDocument(c.env, c.actor, m[1], await readInput(c.request), c.now); return done(c, base(m[1], created.kind), created, 201) } },
  { method: 'GET', pattern: both(`/programs/${id}/documents/${kind}`), run: async (c, m) => {
   const program = await requireProgram(c.env, m[1]), doc = await requireDocument(c.env, m[1], kindOf(m[2]) && m[2]), revs = await revisions(c.env, doc.id), apps = await approvals(c.env, doc.id), state = await documentState(c.env, doc, c.now), want = Number(c.url.searchParams.get('revision') || 0)
   const selected = (want ? revs.find(r => r.revision === want) : revs.at(-1)) ?? revs.at(-1)!
   if (c.isApi) return json({ document: doc, revision: { ...selected, content: JSON.parse(selected.content_json), inputs: JSON.parse(selected.inputs_json), facts: JSON.parse(selected.facts_json) }, revisions: revs.map(({ id: rid, revision, origin, reason, actor_name, at, facts_hash }) => ({ id: rid, revision, origin, reason, actor_name, at, facts_hash })), approvals: apps, state: state.state, drift: state.drift, exhibits: await exhibits(c.env, doc.id) })
   return documentPage(program, doc, revs, revs.at(-1)!, apps, state, await exhibits(c.env, doc.id), await people(c.env), selected, c.actor.name)
  } },
  { method: 'POST', pattern: both(`/programs/${id}/documents/${kind}/revisions`), run: async (c, m) => done(c, base(m[1], m[2]), await reviseDocument(c.env, c.actor, m[1], m[2], await readInput(c.request), c.now), 201) },
  { method: 'POST', pattern: both(`/programs/${id}/documents/${kind}/reconcile`), run: async (c, m) => done(c, base(m[1], m[2]), await reconcileDocument(c.env, c.actor, m[1], m[2], await readInput(c.request), c.now), 201) },
  { method: 'POST', pattern: both(`/programs/${id}/documents/${kind}/approvals`), run: async (c, m) => done(c, base(m[1], m[2]), await approveDocument(c.env, c.actor, m[1], m[2], await readInput(c.request), c.now), 201) },
  { method: 'POST', pattern: both(`/programs/${id}/documents/${kind}/settings`), run: async (c, m) => { await updateSettings(c.env, c.actor, m[1], m[2], await readInput(c.request), c.now); return done(c, base(m[1], m[2]), { updated: true }) } },
  { method: 'POST', pattern: both(`/programs/${id}/documents/${kind}/library-scenarios`), run: async (c, m) => done(c, base(m[1], m[2]), await addLibraryScenarios(c.env, c.actor, m[1], m[2], await readInput(c.request), c.now), 201) },
  { method: 'POST', pattern: both(`/programs/${id}/documents/${kind}/exhibits`), run: async (c, m) => {
   if (!c.request.headers.get('content-type')?.startsWith('multipart/form-data;')) throw new Refusal('Use a file upload form.')
   let form: FormData
   try { form = await new Response(await boundedBody(c.request, MAX_FILE + 65536), { headers: { 'content-type': c.request.headers.get('content-type')! } }).formData() } catch (error) { if (error instanceof Refusal) throw error; throw new Refusal('Invalid upload form.') }
   return done(c, base(m[1], m[2]), await addExhibit(c.env, c.actor, m[1], m[2], form, c.now), 201)
  } },
  { method: 'GET', pattern: both(`/programs/${id}/documents/${kind}/exhibits/${id}`), run: async (c, m) => {
   const { bytes, filename } = await exhibitBytes(c.env, m[1], m[2], m[3])
   return new Response(bytes, { headers: { 'content-type': 'application/octet-stream', 'content-disposition': `attachment; filename="exhibit"; filename*=UTF-8''${encodeURIComponent(filename)}`, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'content-security-policy': "default-src 'none'; sandbox" } })
  } },
  { method: 'GET', pattern: both(`/programs/${id}/documents/${kind}/export`), run: async (c, m) => {
   const format = (c.url.searchParams.get('format') || 'pdf') as keyof typeof types
   if (!Object.hasOwn(types, format)) throw new Refusal('Export as pdf, docx or xlsx.')
   const { revision, rendered } = await exportDocument(c.env, c.actor, m[1], m[2], Number(c.url.searchParams.get('revision') || 0) || null, c.now)
   const body = format === 'pdf' ? pdf(rendered) : format === 'docx' ? docx(rendered) : xlsx(rendered)
   return new Response(body, { headers: { 'content-type': types[format], 'content-disposition': `attachment; filename="${m[2]}-r${revision.revision}.${format}"`, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } })
  } },
  { method: 'POST', pattern: both(`/programs/${id}/audits`), run: async (c, m) => done(c, base(m[1], 'iso-internal-audit'), await recordAudit(c.env, c.actor, m[1], await readInput(c.request), c.now), 201) },
  { method: 'POST', pattern: both(`/programs/${id}/audits/${id}/findings`), run: async (c, m) => done(c, base(m[1], 'iso-internal-audit'), await addFinding(c.env, c.actor, m[1], m[2], await readInput(c.request), c.now), 201) },
  { method: 'POST', pattern: both(`/programs/${id}/audits/findings/${id}/close`), run: async (c, m) => { await closeFinding(c.env, c.actor, m[1], m[2], await readInput(c.request), c.now); return done(c, base(m[1], 'iso-internal-audit'), { closed: true }) } },
  { method: 'POST', pattern: both(`/programs/${id}/management-reviews`), run: async (c, m) => done(c, base(m[1], 'iso-management-review'), await recordManagementReview(c.env, c.actor, m[1], await readInput(c.request), c.now), 201) },
 ]
 return ownerRoutes(routes, clock)
}
