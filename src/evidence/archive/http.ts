import { operatorAuth,runtimeBindings,type Bindings } from '../../auth.server'
import { headers,page,signedOutPage } from '../view'
import { ArchiveError } from './format'
import { inventory,summary } from './inventory'
import { exportArchive } from './export'
import { restoreArchive } from './restore'
import { archivePage } from './view'
const json=(data:unknown,status=200)=>Response.json(data,{status,headers})
export function archiveHandler(clock:()=>Date=()=>new Date()) {
 return async(request:Request,original:Bindings):Promise<Response|null>=>{
  const url=new URL(request.url),path=url.pathname
  if(path!=='/app/archive' && !path.startsWith('/api/archive/')) return null
  const env=runtimeBindings(original)
  if(url.origin!==env.AUTH_ORIGIN || (request.headers.has('host') && request.headers.get('host')?.toLowerCase()!==url.host.toLowerCase())) return json({error:'Invalid host.'},403)
  if(request.headers.get('sec-fetch-site')==='cross-site' || (request.headers.has('origin') && request.headers.get('origin')!==env.AUTH_ORIGIN) || (!['GET','HEAD'].includes(request.method) && request.headers.get('origin')!==env.AUTH_ORIGIN)) return json({error:'Same-origin request required.'},403)
  const session=await operatorAuth(env).getSession(request)
  if(!session) return path.startsWith('/api/') ? json({error:'Owner sign-in required.'},401) : signedOutPage(request)
  if(session.operator.role!=='owner') return json({error:'Owner access required.'},403)
  try {
   if(request.method==='GET' && path==='/app/archive') return archivePage(await inventory(env,clock()),session.operator.displayName)
   if(request.method==='GET' && path==='/api/archive/manifest') {const manifest=await inventory(env,clock()); return json({manifest,...summary(manifest)})}
   if(request.method==='GET' && path==='/api/archive/export') {
    const manifest=await inventory(env,clock())
    if(url.searchParams.get('dry-run')==='1') return json({manifest,...summary(manifest)})
    return new Response(await exportArchive(env,manifest),{headers:{...headers,'content-type':'application/octet-stream','content-disposition':'attachment; filename="evidence-custody.evidence"','content-security-policy':"default-src 'none'; sandbox"}})
   }
   if(request.method==='POST' && path==='/api/archive/restore') {
    if(!request.body || request.headers.get('content-type')!=='application/octet-stream') return json({error:'Upload the raw Evidence archive file.'},400)
    const dryRun=url.searchParams.get('dry-run')==='1'
    if(!dryRun && request.headers.get('x-evidence-confirm')!=='restore') return json({error:'Confirm restore after reviewing the dry run.'},400)
    return json(await restoreArchive(env,request.body,dryRun,clock()))
   }
   return json({error:'Method or route not allowed.'},405)
  } catch(error) { if(!(error instanceof ArchiveError)) console.error('Archive operation failed', error instanceof Error ? error.message : ''); if(request.body && !request.body.locked) await request.body.pipeTo(new WritableStream({write(){}})).catch(()=>{}); return json({error:error instanceof ArchiveError ? error.message : 'Archive storage operation failed; no complete archive or successful restore is claimed.'},error instanceof ArchiveError ? 400 : 503) }
 }
}
