import { operatorAuth, runtimeBindings, type Bindings } from '../auth.server'
import { day, validDate, groups, cadences } from './model'
import { createControl, desk, receipt, storedBytes } from './storage'
import { boundedBody, Refusal, textField, upload } from './upload'
import { deskPage, requirementPage, receiptPage, page, headers, escape } from './view'
const json = (data: unknown, status = 200) => Response.json(data, { status, headers })
const redirect = (location: string) => new Response(null, { status: 303, headers: { ...headers, location } })
// Only the harness supplies a clock function. No header, URL or runtime binding sets time.
export function evidenceHandler(clock: () => Date = () => new Date()) {
 return async (request: Request, original: Bindings): Promise<Response | null> => {
  const url = new URL(request.url), path = url.pathname
  if (!(path === '/app' || path.startsWith('/app/') || path === '/api/desk' || path.startsWith('/api/receipts/'))) return null
  const env = runtimeBindings(original), isApi = path.startsWith('/api/')
  if (url.origin !== env.AUTH_ORIGIN || (request.headers.has('host') && request.headers.get('host')?.toLowerCase() !== url.host.toLowerCase())) return json({ error:'Invalid host.' },403)
  if (request.headers.get('sec-fetch-site') === 'cross-site' || (request.headers.has('origin') && request.headers.get('origin') !== env.AUTH_ORIGIN) || (!['GET','HEAD'].includes(request.method) && request.headers.get('origin') !== env.AUTH_ORIGIN)) return json({ error:'Same-origin request required.' },403)
  const session = await operatorAuth(env).getSession(request)
  if (!session) return isApi ? json({ error:'Owner sign-in required.' },401) : page('Owner sign-in required','<p><a href="/signin">Sign in to the proof desk</a></p>',401)
  if (session.operator.role !== 'owner') return json({ error:'Owner access required.' },403)
  try {
   const now = clock(), selected = url.searchParams.get('date') || day(now)
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
   if (uploading && request.method === 'POST') return redirect('/app/receipts/'+await upload(request,env,uploading[1],session.operator,now))
   if (!['GET','HEAD'].includes(request.method)) return json({ error:'Method not allowed.' },405)
   if (path === '/app' || path === '/api/desk') { const data = await desk(env,selected,now); return isApi ? json(data) : deskPage(data,session.operator.displayName) }
   const requirement = /^\/app\/requirements\/([a-f0-9-]+)$/.exec(path)
   if (requirement) { const data = await desk(env,selected,now), row = data.requirements.find(x => x.id === requirement[1]); return row ? requirementPage(row,selected,session.operator.displayName,(await env.DB.prepare('SELECT id,name,email FROM people ORDER BY name').all<{ id: string; name: string; email: string }>()).results,(await env.DB.prepare('SELECT id,name FROM programs ORDER BY created_at').all<{ id: string; name: string }>()).results) : json({ error:'Requirement not found.' },404) }
   const match = /^\/(?:app|api)\/receipts\/([a-f0-9-]+)(\/download)?$/.exec(path)
   if (match) {
    const row = await receipt(env,match[1]); if (!row) return json({ error:'Receipt not found.' },404)
    if (match[2]) {
     const bytes = await storedBytes(env,row)
     if (!bytes) return json({ error:'Unavailable bytes. The receipt is retained.' },410)
     return new Response(bytes, { headers: { ...headers, 'content-type':'application/octet-stream', 'content-disposition': `attachment; filename="exhibit"; filename*=UTF-8''${encodeURIComponent(row.filename).replace(/'/g,'%27')}`, 'content-length':String(bytes.byteLength), 'content-security-policy':"default-src 'none'; sandbox" } })
    }
    row.available = !!await storedBytes(env,row)
    return isApi ? json(row) : receiptPage(row,session.operator.displayName)
   }
   return json({ error:'Not found.' },404)
  } catch (error) {
   if (!(error instanceof Refusal)) { console.error('Evidence operation failed'); return json({ error:'Storage unavailable; no completeness claim can be made.' },503) }
   return isApi ? json({ error:error.message },error.status) : page('Could not save',`<p role="alert">${escape(error.message)}</p><p><a href="/app">Return to the desk</a></p>`,error.status)
  }
 }
}
