import { problem } from './problem'
import { auditFormRefusal, retainedMultipart, scalarValues, type RefusedForm } from './form-state'
import { operatorAuth, runtimeBindings, type Bindings } from '../auth.server'
import { day, validDate, groups, cadences } from './model'
import { createControl, desk, receipt, storedBytes } from './storage'
import { boundedBody, MAX_FILE, Refusal, textField, upload } from './upload'
import { authorize } from './authz/gate'
import { scopedControls, unrestricted } from './authz/roles'
import { guardRead, recordState, sensitiveIds } from './secure/records'
import { deskPage, requirementPage, receiptPage, page, headers, escape, signedOutPage } from './view'
const redirect = (location: string) => new Response(null, { status: 303, headers: { ...headers, location } })
// Only the harness supplies a clock function. No header, URL or runtime binding sets time.
export function evidenceHandler(clock: () => Date = () => new Date()) {
 return async (request: Request, original: Bindings): Promise<Response | null> => {
  const url = new URL(request.url), path = url.pathname
  if (!(path === '/app' || path.startsWith('/app/') || path === '/api/desk' || path.startsWith('/api/receipts/'))) return null
  const env = runtimeBindings(original), isApi = path.startsWith('/api/')
  const json = (data: { error: string } | unknown, status = 200): Response | Promise<Response> => !isApi && status >= 400 ? problem((data as { error: string }).error, status, status === 403 ? '/me' : '/app', status === 403) : Response.json(data, { status, headers })
  if (url.origin !== env.AUTH_ORIGIN || (request.headers.has('host') && request.headers.get('host')?.toLowerCase() !== url.host.toLowerCase())) return json({ error:'Invalid host.' },403)
  if (request.headers.get('sec-fetch-site') === 'cross-site' || (request.headers.has('origin') && request.headers.get('origin') !== env.AUTH_ORIGIN) || (!['GET','HEAD'].includes(request.method) && request.headers.get('origin') !== env.AUTH_ORIGIN)) return json({ error:'Same-origin request required.' },403)
  const session = await operatorAuth(env).getSession(request)
  if (!session) return isApi ? json({ error:'Owner sign-in required.' },401) : signedOutPage(request)
  const verdict = await authorize(env, session.operator, request.method, path)
  if (!verdict.ok) return json({ error:verdict.error },verdict.status)
  // A scoped control owner or contributor reaches only the controls the grants name.
  const reach = verdict.delegate && !unrestricted(verdict.delegate) ? await scopedControls(env, verdict.delegate) : null
  const reaches = async (requirementId: string) => !reach || reach.has((await env.DB.prepare('SELECT control_id FROM requirements WHERE id=?').bind(requirementId).first<{ control_id: string }>())?.control_id ?? '')
  const operator = { id: verdict.actor.id, displayName: verdict.actor.name, email: verdict.delegate?.email }
  // SECURE-001: a delegate sees a sensitive record only with a need-to-know grant.
  const hideSensitive = async <T extends { receipts: { id: string }[] }>(rows: T[]) => {
   if (!verdict.delegate) return rows
   const sensitive = await sensitiveIds(env), held = new Set((await env.DB.prepare('SELECT receipt_id FROM record_grants WHERE email=? AND revoked_at IS NULL').bind(verdict.delegate.email).all<{ receipt_id: string }>()).results.map(r => r.receipt_id))
   return rows.map(r => ({ ...r, receipts: r.receipts.filter(x => !sensitive.has(x.id) || held.has(x.id)) }))
  }
  const now = clock(), selected = url.searchParams.get('date') || day(now)
  const renderRequirement = async (id: string, refused?: RefusedForm) => {
   const data = await desk(env,selected,now), row = (await hideSensitive(data.requirements)).find(x => x.id === id)
   if (!row) return json({ error:'Requirement not found.' },404)
   const [people, programs] = await Promise.all([
    env.DB.prepare('SELECT id,name,email FROM people ORDER BY name').all<{ id: string; name: string; email: string }>(),
    env.DB.prepare('SELECT id,name FROM programs ORDER BY created_at').all<{ id: string; name: string }>(),
   ])
   return requirementPage(row,selected,session.operator.displayName,people.results,programs.results,refused)
  }
  try {
   if (!validDate(selected)) throw new Refusal('Select a real UTC date.')
   if (request.method === 'POST' && path === '/app/controls') {
    if (!request.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded')) throw new Refusal('Use the control form.')
    const form = new URLSearchParams(new TextDecoder().decode(await boundedBody(request,8192)))
    const fields = new FormData(); for (const [key,value] of form) fields.append(key,value)
    const name = textField(fields,'name'), proof = textField(fields,'proof'), group = textField(fields,'group'), cadence = textField(fields,'cadence')
    if (!(groups as readonly string[]).includes(group) || !(cadences as readonly string[]).includes(cadence)) throw new Refusal('Choose a listed group and cadence.')
    const result = await createControl(env,name,group,proof,cadence,now)
    return redirect('/app/requirements/'+result.requirement)
   }
   const uploading = /^\/app\/requirements\/([a-f0-9-]+)\/uploads$/.exec(path)
   if (uploading && request.method === 'POST') {
    if (!await reaches(uploading[1])) return json({ error:'That requirement is outside your scope.' },403)
    let values: Record<string, string> = {}
    try {
     const retained = await retainedMultipart(request, MAX_FILE + 1024 * 1024 + 65536)
     values = scalarValues(retained.form)
     return redirect('/app/receipts/'+await upload(retained.request,env,uploading[1],operator,now))
    } catch (error) {
     if (!(error instanceof Refusal) || error.status >= 500) throw error
     await auditFormRefusal({ env, actor: verdict.actor, request, url, now },error)
     return renderRequirement(uploading[1], { values, error: error.message, status: error.status })
    }
   }
   if (!['GET','HEAD'].includes(request.method)) return json({ error:'Method not allowed.' },405)
   if (path === '/app' || path === '/api/desk') { const data = await desk(env,selected,now); if (reach) data.requirements = data.requirements.filter(x => reach.has(x.control_id)); data.requirements = await hideSensitive(data.requirements); return isApi ? json(data) : deskPage(data,session.operator.displayName) }
   const requirement = /^\/app\/requirements\/([a-f0-9-]+)$/.exec(path)
   if (requirement) { if (!await reaches(requirement[1])) return json({ error:'Requirement not found.' },404); return renderRequirement(requirement[1]) }
   const match = /^\/(?:app|api)\/receipts\/([a-f0-9-]+)(\/download)?$/.exec(path)
   if (match) {
    const row = await receipt(env,match[1]); if (!row || !await reaches(row.requirement_id)) return json({ error:'Receipt not found.' },404)
    if (!await guardRead(env, { id: verdict.actor.id, name: verdict.actor.name }, verdict.delegate, row.id, now, match[2] ? 'download' : 'view')) return json({ error:'This record is restricted. Ask the owner for a need-to-know grant.' },403)
    if (match[2]) {
     if (verdict.delegate?.grants.every(g => g.role === 'contributor')) return json({ error:'Your role does not allow this.' },403)
     const bytes = await storedBytes(env,row)
     if (!bytes) return json({ error:'Unavailable bytes. The receipt is retained.' },410)
     return new Response(bytes, { headers: { ...headers, 'content-type':'application/octet-stream', 'content-disposition': `attachment; filename="exhibit"; filename*=UTF-8''${encodeURIComponent(row.filename).replace(/'/g,'%27')}`, 'content-length':String(bytes.byteLength), 'content-security-policy':"default-src 'none'; sandbox" } })
    }
    row.available = !!await storedBytes(env,row)
    return isApi ? json(row) : receiptPage(row,session.operator.displayName,verdict.delegate ? undefined : await recordState(env,row.id))
   }
   return json({ error:'Not found.' },404)
  } catch (error) {
   if (!(error instanceof Refusal)) { console.error('Evidence operation failed'); return json({ error:'Storage unavailable; no completeness claim can be made.' },503) }
   return isApi ? json({ error:error.message },error.status) : page('Could not save',`<p role="alert">${escape(error.message)}</p><p><a href="/app">Return to the desk</a></p>`,error.status)
  }
 }
}
