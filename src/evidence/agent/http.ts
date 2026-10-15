import { operatorAuth, runtimeBindings, type Bindings } from '../../auth.server'
import { day, validDate } from '../model'
import { issuedPage } from '../review/view'
import { safeHeaders } from '../review/frame'
import { Refusal } from '../upload'
import { inputBody, folderInput, future } from './input'
import { active, agentDesk, decide, grant, issueToken, prepare, proposal, proposals, revoke, tokens } from './storage'
import { agentPage, proposalPage, tokenPage } from './view'
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:safeHeaders})
const redirect=()=>new Response(null,{status:303,headers:{...safeHeaders,location:'/app/agent'}})
export function agentHandler(clock:()=>Date=()=>new Date()) {
 return async(request:Request,original:Bindings):Promise<Response|null>=>{
  const url=new URL(request.url),path=url.pathname
  if(path!=='/app/agent' && !path.startsWith('/app/agent/') && path!=='/api/agent' && !path.startsWith('/api/agent/')) return null
  const env=runtimeBindings(original),api=path.startsWith('/api/'),bearer=request.headers.get('authorization')
  try {
   if(url.origin!==env.AUTH_ORIGIN || (request.headers.has('host') && request.headers.get('host')?.toLowerCase()!==url.host.toLowerCase())) return json({error:'Invalid host.'},403)
   // Browser requests always use same-origin admission. Non-browser agent
   // requests have no Origin and authenticate only with a header credential.
   if(request.headers.get('sec-fetch-site')==='cross-site' || (request.headers.has('origin') && request.headers.get('origin')!==env.AUTH_ORIGIN)) return json({error:'Same-origin request required.'},403)
   if(bearer!==null) {
    const secret=/^Bearer ([a-f0-9]{64})$/.exec(bearer)?.[1],token=secret?await grant(env,secret):null
    if(!active(token,clock())) return json({error:'Agent credential expired, revoked or invalid.'},401)
    if(!api) return json({error:'Native owner session required.'},403)
    let response:Response
    if(path==='/api/agent/desk' && request.method==='GET') {
     const selected=url.searchParams.get('date')||day(clock());if(!validDate(selected)) throw new Refusal('Select a real UTC date.')
     response=json(await agentDesk(env,selected,clock()))
    } else if(path==='/api/agent/prepare-folder' && request.method==='POST') {
     const input=await folderInput(env,await inputBody(request),clock())
     response=json({proposal:await prepare(env,input,token,clock)},201)
    } else if(path==='/api/agent/proposals' && request.method==='GET') response=json({proposals:await proposals(env,token.id)})
    else return json({error:'This credential permits inspection and preparation only.'},403)
    if(!active(await grant(env,secret!),clock())) return json({error:'Agent credential expired or revoked.'},401)
    return response
   }
   if(!['GET','HEAD'].includes(request.method) && request.headers.get('origin')!==env.AUTH_ORIGIN) return json({error:'Same-origin request required.'},403)
   const session=await operatorAuth(env).getSession(request)
   if(!session) return json({error:'Native owner sign-in required.'},401)
   if(session.operator.role!=='owner' || !['native','dev'].includes(session.kind)) return json({error:'Native owner sign-in required.'},403)
   const actor=session.operator,now=clock()
   if((path==='/app/agent' || path==='/api/agent') && request.method==='GET') {
    const [access,rows]=await Promise.all([tokens(env),proposals(env)])
    return api?json({tokens:access,proposals:rows}):agentPage(access,rows,now,actor.displayName)
   }
   if(/^\/(?:app|api)\/agent\/tokens$/.test(path) && request.method==='POST') {
    const input=await inputBody(request)
    if(typeof input.label!=='string' || !input.label.trim() || input.label.trim().length>100) throw new Refusal('Name the agent (up to 100 characters).')
    const result=await issueToken(env,input.label.trim(),future(input.expires_at,now),actor,now)
    return api?json(result,201):tokenPage(result.grant.label,result.token,actor.displayName)
   }
   const revoking=/^\/(?:app|api)\/agent\/tokens\/([a-f0-9-]+)\/revoke$/.exec(path)
   if(revoking && request.method==='POST') { const token=await revoke(env,revoking[1],actor,now);return token?(api?json({grant:token}):redirect()):json({error:'Not found.'},404) }
   const match=/^\/(?:app|api)\/agent\/proposals\/([a-f0-9-]+)(?:\/(approve|reject))?$/.exec(path)
   if(match) {
    const row=await proposal(env,match[1]);if(!row) return json({error:'Not found.'},404)
    if(!match[2] && request.method==='GET') return api?json({proposal:row}):proposalPage(row,actor.displayName)
    if(match[2] && request.method==='POST') {
     const input=await inputBody(request)
     if(input.snapshot_hash!==row.snapshot_hash) throw new Refusal('Review and submit the exact proposal fingerprint.',409)
     if(match[2]==='approve') await folderInput(env,row.input as unknown as Record<string,unknown>,clock())
     const result=await decide(env,row,match[2]==='approve'?'approved':'rejected',actor,clock())
     if('folder' in result && result.folder && 'token' in result) {
      const reviewURL=env.AUTH_ORIGIN+'/review/'+result.token
      return api?json({decision:result.decision,folder:result.folder,review_url:reviewURL},201):issuedPage(result.folder,reviewURL,actor.displayName)
     }
     return api?json({decision:result.decision}):redirect()
    }
   }
   return json({error:'Not found or method not allowed.'},405)
  } catch(error) {
   if(error instanceof Refusal) return json({error:error.message},error.status)
   // Never log errors or request metadata: these requests carry credentials.
   return json({error:'Storage unavailable; no authorization or publication was established.'},503)
  }
 }
}
