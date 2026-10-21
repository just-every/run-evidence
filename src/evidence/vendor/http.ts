import type { Bindings } from '../../auth.server'
import { Refusal, boundedBody, MAX_FILE } from '../upload'
import { auditStatement, done, json, ownerRoutes, readInput, uuid, type Route } from '../door'
import { people } from '../program/people'
import { addAssertion, addOwnerDocument, addSubprocessor, documentBytes, documents, onboardVendor, profileOf, removeSubprocessor, requireVendor, reviewDocument, updateProfile, verifyAssertion, type DocumentRow } from './storage'
import { answersOf, approvalsOf, approve, closeCondition, closeLink, closeRequest, createTemplate, decideFinding, findingsOf, issueRequests, linkEvents, linksOf, needs, recordFinding, reminderLog, requestsOf, standing, templates } from './diligence'
import { compare, vendorPage, vendorsPage, type VendorRow } from './view'
const id = `(${uuid})`
const both = (path: string) => new RegExp(`^/(?:app|api)${path}$`)
export const vendorList = async (env: Bindings) => (await env.DB.prepare('SELECT v.id,v.name,v.criticality,v.data_access,v.review_due,p.name AS owner_name,(SELECT departed_at FROM people_departures d WHERE d.person_id=v.owner_person_id) AS owner_left_at FROM vendors v LEFT JOIN people p ON p.id=v.owner_person_id ORDER BY v.name').all<Omit<VendorRow, 'risk_tier' | 'approval' | 'reassessment' | 'missing'>>()).results
async function register(env: Bindings, now: Date): Promise<VendorRow[]> {
 return Promise.all((await vendorList(env)).map(async v => {
  const st = standing(await approvalsOf(env, v.id), now), profile = await profileOf(env, v.id)
  const gaps = needs(profile, await documents(env, v.id), await requestsOf(env, v.id), now).filter(n => ['missing', 'expired', 'overdue'].includes(n.state)).length
  return { ...v, risk_tier: profile?.risk_tier ?? null, approval: st.approval, reassessment: st.reassessment, missing: gaps }
 }))
}
async function detail(env: Bindings, vendorId: string, now: Date) {
 const vendor = await requireVendor(env, vendorId), [profile, docs, requests, approvals] = await Promise.all([profileOf(env, vendorId), documents(env, vendorId), requestsOf(env, vendorId), approvalsOf(env, vendorId)])
 const owner = vendor.owner_person_id ? await env.DB.prepare('SELECT p.name,d.departed_at FROM people p LEFT JOIN people_departures d ON d.person_id=p.id WHERE p.id=?').bind(vendor.owner_person_id).first<{ name: string; departed_at: string | null }>() : null
 const answers = Object.fromEntries(await Promise.all(requests.filter(r => r.kind === 'questionnaire').map(async r => [r.id, await answersOf(env, r.id)] as const)))
 return {
  vendor, owner_name: owner?.name ?? null, owner_left_at: owner?.departed_at ?? null, profile, documents: docs, requests, approvals, answers, templates: await templates(env),
  subprocessors: (await env.DB.prepare('SELECT * FROM vendor_subprocessors WHERE vendor_id=? ORDER BY added_at,rowid').bind(vendorId).all<Record<string, string | null>>()).results,
  links: await linksOf(env, vendorId), events: await linkEvents(env, vendorId), findings: await findingsOf(env, vendorId),
  assertions: (await env.DB.prepare('SELECT * FROM vendor_assertions WHERE vendor_id=? ORDER BY recorded_at,rowid').bind(vendorId).all<Record<string, string | null>>()).results,
  needs: needs(profile, docs, requests, now), standing: (({ latest: _latest, ...rest }) => rest)(standing(approvals, now)), reminders: await reminderLog(env, vendorId),
 }
}
const back = (vendor: string) => '/app/vendors/' + vendor
export function vendorHandler(clock: () => Date) {
 const routes: Route[] = [
  { method: 'GET', pattern: both('/vendors'), run: async c => c.isApi ? json({ vendors: await register(c.env, c.now) }) : vendorsPage(await register(c.env, c.now), await people(c.env), await templates(c.env), c.actor.name) },
  { method: 'POST', pattern: both('/vendors'), run: async c => { const created = await onboardVendor(c.env, c.actor, await readInput(c.request), c.now); return done(c, back(created.id), created, 201) } },
  { method: 'GET', pattern: both('/vendor-templates'), run: async c => json({ templates: (await templates(c.env)).map(t => ({ id: t.id, name: t.name, revision: t.revision, source: t.source, owner_built: t.owner_built, questions: t.questions })) }) },
  { method: 'POST', pattern: both('/vendor-templates'), run: async c => done(c, '/app/vendors', await createTemplate(c.env, c.actor, await readInput(c.request), c.now), 201) },
  { method: 'GET', pattern: both(`/vendors/${id}`), run: async (c, m) => { const d = await detail(c.env, m[1], c.now); return c.isApi ? json({ ...d, documents: d.documents.map(x => ({ ...x, comparison: compare(x, d.documents) })), templates: d.templates.map(t => ({ id: t.id, name: t.name, questions: t.questions.length })) }) : vendorPage(d, await people(c.env), c.now, c.actor.name, null) } },
  { method: 'POST', pattern: both(`/vendors/${id}`), run: async (c, m) => done(c, back(m[1]), await updateProfile(c.env, c.actor, m[1], await readInput(c.request), c.now)) },
  { method: 'POST', pattern: both(`/vendors/${id}/subprocessors`), run: async (c, m) => done(c, back(m[1]), { id: await addSubprocessor(c.env, c.actor, m[1], await readInput(c.request), c.now) }, 201) },
  { method: 'POST', pattern: both(`/vendors/${id}/subprocessors/${id}/remove`), run: async (c, m) => { await removeSubprocessor(c.env, c.actor, m[1], m[2], await readInput(c.request), c.now); return done(c, back(m[1]), { removed: true }) } },
  { method: 'POST', pattern: both(`/vendors/${id}/documents`), run: async (c, m) => {
   if (!c.request.headers.get('content-type')?.startsWith('multipart/form-data;')) throw new Refusal('Use a file upload form.')
   let form: FormData
   try { form = await new Response(await boundedBody(c.request, MAX_FILE + 65536), { headers: { 'content-type': c.request.headers.get('content-type')! } }).formData() } catch (error) { if (error instanceof Refusal) throw error; throw new Refusal('Invalid upload form.') }
   return done(c, back(m[1]), await addOwnerDocument(c.env, c.actor, m[1], form, c.now), 201)
  } },
  { method: 'GET', pattern: both(`/vendors/${id}/documents/${id}/download`), run: async (c, m) => {
   const row = (await documents(c.env, m[1])).find((x: DocumentRow) => x.id === m[2])
   if (!row) throw new Refusal('Document not found.', 404)
   const bytes = await documentBytes(c.env, row)
   if (!bytes) throw new Refusal('The stored bytes are missing or changed; nothing is served.', 409)
   await auditStatement(c.env, c.actor, 'vendor.document-downloaded', 'vendor:' + m[1], c.now, 'succeeded', row.sha256.slice(0, 16), { revision: row.id }).run()
   return new Response(bytes, { headers: { 'content-type': 'application/octet-stream', 'content-disposition': `attachment; filename="document"; filename*=UTF-8''${encodeURIComponent(row.filename)}`, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'content-security-policy': "default-src 'none'; sandbox" } })
  } },
  { method: 'POST', pattern: both(`/vendors/${id}/documents/${id}/review`), run: async (c, m) => { await reviewDocument(c.env, c.actor, m[1], m[2], await readInput(c.request), c.now); return done(c, back(m[1]), { reviewed: true }) } },
  { method: 'POST', pattern: both(`/vendors/${id}/requests`), run: async (c, m) => {
   const issued = await issueRequests(c.env, c.actor, m[1], await readInput(c.request), c.now)
   if (c.isApi) return json(issued, 201)
   return vendorPage(await detail(c.env, m[1], c.now), await people(c.env), c.now, c.actor.name, issued)
  } },
  { method: 'POST', pattern: both(`/vendors/${id}/requests/${id}/close`), run: async (c, m) => { await closeRequest(c.env, c.actor, m[1], m[2], await readInput(c.request), c.now); return done(c, back(m[1]), { closed: true }) } },
  { method: 'POST', pattern: both(`/vendors/${id}/links/${id}/close`), run: async (c, m) => { await closeLink(c.env, c.actor, m[1], m[2], c.now); return done(c, back(m[1]), { closed: true }) } },
  { method: 'POST', pattern: both(`/vendors/${id}/findings`), run: async (c, m) => done(c, back(m[1]), { id: await recordFinding(c.env, c.actor, m[1], await readInput(c.request), c.now) }, 201) },
  { method: 'POST', pattern: both(`/vendors/${id}/findings/${id}/decision`), run: async (c, m) => { await decideFinding(c.env, c.actor, m[1], m[2], await readInput(c.request), c.now); return done(c, back(m[1]), { decided: true }) } },
  { method: 'POST', pattern: both(`/vendors/${id}/approvals`), run: async (c, m) => done(c, back(m[1]), await approve(c.env, c.actor, m[1], await readInput(c.request), c.now), 201) },
  { method: 'POST', pattern: both(`/vendors/${id}/approvals/${id}/condition`), run: async (c, m) => { await closeCondition(c.env, c.actor, m[1], m[2], await readInput(c.request), c.now); return done(c, back(m[1]), { closed: true }) } },
  { method: 'POST', pattern: both(`/vendors/${id}/assertions`), run: async (c, m) => done(c, back(m[1]), { id: await addAssertion(c.env, c.actor, m[1], await readInput(c.request), c.now) }, 201) },
  { method: 'POST', pattern: both(`/vendors/${id}/assertions/${id}/verify`), run: async (c, m) => { await verifyAssertion(c.env, c.actor, m[1], m[2], await readInput(c.request), c.now); return done(c, back(m[1]), { verified: true }) } },
 ]
 return ownerRoutes(routes, clock)
}
