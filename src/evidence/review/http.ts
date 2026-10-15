import { operatorAuth, runtimeBindings, type Bindings } from '../../auth.server'
import { validDate } from '../model'
import { storedBytes } from '../storage'
import { boundedBody, Refusal } from '../upload'
import { closeFolder, controls, events, folderActive, folders, grant, issueFolder, logEvent, projectReceipt, receiptExhibit, reviewData, scopedReceipt } from './storage'
import type { FolderInput, ReviewAction } from './types'
import { foldersPage, issuedPage, logsPage, reviewerPage, reviewReceiptPage } from './view'
export const reviewHeaders = { 'cache-control':'no-store', 'referrer-policy':'no-referrer', 'x-content-type-options':'nosniff', 'x-robots-tag':'noindex, nofollow' }
const json = (data: unknown, status=200) => Response.json(data,{status,headers:reviewHeaders})
const absent = () => new Response('Not found.\n',{status:404,headers:{...reviewHeaders,'content-type':'text/plain; charset=utf-8'}})
const redirect = (location: string) => new Response(null,{status:303,headers:{...reviewHeaders,location}})
async function readInput(request: Request): Promise<FolderInput> {
 const body = new TextDecoder().decode(await boundedBody(request,16384))
 if (request.headers.get('content-type')?.startsWith('application/json')) {
  try { const value = JSON.parse(body); if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(); return value } catch { throw new Refusal('Use a folder object.') }
 }
 if (!request.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded')) throw new Refusal('Use the folder form or JSON.')
 const fields = new URLSearchParams(body)
 return {reviewer_label:fields.get('reviewer_label') || '',period_from:fields.get('period_from') || '',period_to:fields.get('period_to') || '',expires_at:fields.get('expires_at') || '',control_ids:fields.getAll('control_ids')}
}
async function validateInput(env: Bindings, input: FolderInput, now: Date): Promise<FolderInput> {
 if (typeof input.reviewer_label !== 'string' || !input.reviewer_label.trim() || input.reviewer_label.trim().length>300) throw new Refusal('Name the reviewer (up to 300 characters).')
 if (!validDate(input.period_from) || !validDate(input.period_to) || input.period_from>input.period_to) throw new Refusal('Choose an inclusive UTC period with its start on or before its end.')
 if (typeof input.expires_at !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?Z?$/.test(input.expires_at)) throw new Refusal('Choose a real future expiry in UTC.')
 const expiry = input.expires_at.endsWith('Z') ? input.expires_at : input.expires_at+'Z', milliseconds = Date.parse(expiry)
 if (!validDate(expiry.slice(0,10)) || !Number.isFinite(milliseconds) || new Date(milliseconds).toISOString().slice(0,16)!==expiry.slice(0,16) || milliseconds<=now.getTime()) throw new Refusal('Choose a real future expiry in UTC.')
 if (!Array.isArray(input.control_ids) || !input.control_ids.length || input.control_ids.length>500 || input.control_ids.some(id=>typeof id!=='string')) throw new Refusal('Select at least one existing control.')
 const ids = [...new Set(input.control_ids)], known = new Set((await controls(env)).map(c=>c.id))
 if (ids.some(id=>!known.has(id))) throw new Refusal('Select existing controls only.')
 return {...input,reviewer_label:input.reviewer_label.trim(),expires_at:new Date(milliseconds).toISOString(),control_ids:ids}
}
async function publicReview(request: Request, env: Bindings, clock: () => Date) {
 const url = new URL(request.url), match = /^\/review\/([a-f0-9]{64})(?:\/(.*))?$/.exec(url.pathname), tail = match?.[2] || ''
 const receiptMatch = /^receipts\/([a-f0-9-]+)(?:\/(download|view))?$/.exec(tail)
 const action: ReviewAction = !tail && match ? 'page' : tail==='exhibits' ? 'list' : receiptMatch ? receiptMatch[2]==='download' ? 'download' : 'receipt' : 'unknown'
 let folder = match ? await grant(env,match[1]) : null
 const requestedReceipt = folder && receiptMatch ? await scopedReceipt(env,folder,receiptMatch[1]) : null
 let exhibit: string | null = requestedReceipt?.exhibit_id ?? null
 const refuse = async () => {
  if (folder && receiptMatch && !exhibit) exhibit = await receiptExhibit(env,receiptMatch[1])
  await logEvent(env,folder,exhibit,action,'refused',clock())
  return absent()
 }
 if (!folder || !folderActive(folder,clock()) || url.origin!==env.AUTH_ORIGIN || (request.headers.has('host') && request.headers.get('host')?.toLowerCase()!==url.host.toLowerCase()) || !['GET','HEAD'].includes(request.method) || action==='unknown') return refuse()
 let response: Response
 let viewedExhibits: string[] = []
 if (receiptMatch) {
  const row = requestedReceipt
  if (!row) return refuse()
  exhibit = row.exhibit_id
  const bytes = await storedBytes(env,row)
  row.available = !!bytes
  if (action==='download') {
   if (!bytes) return refuse()
   response = new Response(bytes,{headers:{...reviewHeaders,'content-type':'application/octet-stream','content-disposition':`attachment; filename="exhibit"; filename*=UTF-8''${encodeURIComponent(row.filename).replace(/'/g,'%27')}`,'content-length':String(bytes.byteLength),'content-security-policy':"default-src 'none'; sandbox"}})
  } else {
   const supersedes = row.supersedes ? await scopedReceipt(env,folder,row.supersedes) : null
   const projected = projectReceipt(row,new Set(supersedes ? [supersedes.id] : []))
   response = receiptMatch[2]==='view' ? await reviewReceiptPage(folder,projected,'/review/'+match![1]) : json(projected)
  }
 } else {
  const data = await reviewData(env,folder,clock())
  viewedExhibits = data.requirements.flatMap(r=>r.receipts.map(row=>row.exhibit_id))
  response = action==='page' ? await reviewerPage(data,'/review/'+match![1]) : json(data)
 }
 // Byte verification and rendering may take time. Recheck before logging access.
 folder = await grant(env,match![1])
 if (!folder || !folderActive(folder,clock())) return refuse()
 for (const id of viewedExhibits.length ? viewedExhibits : [exhibit]) await logEvent(env,folder,id,action,'allowed',clock())
 // Logging also awaits storage. Recheck persisted authorization and exact expiry
 // after every awaited operation; the allowed path must not await again.
 folder = await grant(env,match![1])
 if (!folder || !folderActive(folder,clock())) return refuse()
 return request.method==='HEAD' ? new Response(null,{status:response.status,headers:response.headers}) : response
}
// Only the workerd harness injects a clock. Production has no caller time knob.
export function reviewHandler(clock: () => Date = () => new Date()) {
 return async (request: Request, original: Bindings): Promise<Response | null> => {
  const url = new URL(request.url), path = url.pathname
  const isPublic = path==='/review' || path.startsWith('/review/')
  if (!isPublic && path!=='/app/folders' && !path.startsWith('/app/folders/') && path!=='/api/folders' && !path.startsWith('/api/folders/')) return null
  const env = runtimeBindings(original)
  try {
   if (isPublic) return await publicReview(request,env,clock)
   if (url.origin!==env.AUTH_ORIGIN || (request.headers.has('host') && request.headers.get('host')?.toLowerCase()!==url.host.toLowerCase())) return json({error:'Invalid host.'},403)
   if (request.headers.get('sec-fetch-site')==='cross-site' || (request.headers.has('origin') && request.headers.get('origin')!==env.AUTH_ORIGIN) || (!['GET','HEAD'].includes(request.method) && request.headers.get('origin')!==env.AUTH_ORIGIN)) return json({error:'Same-origin request required.'},403)
   const session = await operatorAuth(env).getSession(request)
   if (!session) return json({error:'Owner sign-in required.'},401)
   if (session.operator.role!=='owner') return json({error:'Owner access required.'},403)
   const api = path.startsWith('/api/'), now = clock()
   if (path==='/app/folders' || path==='/api/folders') {
    if (request.method==='POST') {
     const result = await issueFolder(env,await validateInput(env,await readInput(request),now),now), reviewURL = env.AUTH_ORIGIN+'/review/'+result.token
     return api ? json({folder:result.folder,review_url:reviewURL},201) : issuedPage(result.folder,reviewURL)
    }
    if (['GET','HEAD'].includes(request.method)) { const data = await folders(env); return api ? json({folders:data}) : foldersPage(data,await controls(env),now) }
   }
   const closing = /^\/(?:app|api)\/folders\/([a-f0-9-]+)\/close$/.exec(path)
   if (closing && request.method==='POST') { const folder = await closeFolder(env,closing[1],now); return !folder ? absent() : api ? json({folder}) : redirect('/app/folders') }
   const log = /^\/(?:app|api)\/folders\/(?:([a-f0-9-]+)\/)?events$/.exec(path)
   if (log && ['GET','HEAD'].includes(request.method)) { const data=await events(env,log[1]); return api ? json({events:data}) : logsPage(data) }
   return ['GET','HEAD'].includes(request.method) ? absent() : json({error:'Method not allowed.'},405)
  } catch (error) {
   if (error instanceof Refusal) return json({error:error.message},error.status)
   // Do not log errors, request URLs or bearer tokens, including from storage.
   return json({error:'Storage unavailable; access cannot be established.'},503)
  }
 }
}
