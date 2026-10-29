import { auditDoorRefusal, type Actor as AuditActor } from '../door'
import { problem } from '../problem'
import { showOnce, takeOnce } from '../credential-display'
import { operatorAuth, runtimeBindings, type Bindings } from '../../auth.server'
import { issuedPage } from '../review/view'
import { safeHeaders } from '../review/frame'
import { Refusal } from '../upload'
import { inputBody, folderInput, future } from './input'
import { active, decide, grant, issueToken, proposal, proposals, revoke, tokens } from './storage'
import { invokeLegacy } from '../agent-door/legacy'
import { agentPage, proposalPage, tokenPage } from './view'
const redirect=()=>new Response(null,{status:303,headers:{...safeHeaders,location:'/app/agent'}})
export function agentHandler(clock:()=>Date=()=>new Date()) {
 return async(request:Request,original:Bindings):Promise<Response|null>=>{
  const url=new URL(request.url),path=url.pathname
  if(path!=='/app/agent' && !path.startsWith('/app/agent/') && path!=='/api/agent' && !path.startsWith('/api/agent/')) return null
  const env=runtimeBindings(original),api=path.startsWith('/api/'),bearer=request.headers.get('authorization')
  const json=(value:unknown,status=200):Response|Promise<Response>=>!api&&status>=400?problem((value as {error:string}).error,status,'/app/agent'):Response.json(value,{status,headers:safeHeaders})
  let auditActor: (AuditActor & { kind: 'owner' | 'token' }) | undefined
  const refused = async (reason: string, status: number) => {
   if (auditActor) await auditDoorRefusal(env,auditActor,request,clock(),status,reason)
   return json({error:reason},status)
  }
  try {
   if(url.origin!==env.AUTH_ORIGIN || (request.headers.has('host') && request.headers.get('host')?.toLowerCase()!==url.host.toLowerCase())) return json({error:'Invalid host.'},403)
   // Browser requests always use same-origin admission. Non-browser agent
   // requests have no Origin and authenticate only with a header credential.
   if(request.headers.get('sec-fetch-site')==='cross-site' || (request.headers.has('origin') && request.headers.get('origin')!==env.AUTH_ORIGIN)) return json({error:'Same-origin request required.'},403)
   if(bearer!==null) {
    const secret=/^Bearer ([a-f0-9]{64})$/.exec(bearer)?.[1],token=secret?await grant(env,secret):null
    if(token) auditActor={id:token.id,name:token.label,kind:'token'}
    if(!active(token,clock())) return refused('Agent credential expired, revoked or invalid.',401)
    if(!api) return refused('Native owner session required.',403)
    let name:string,args:Record<string,unknown>={},status=200
    if(path==='/api/agent/desk' && request.method==='GET') { name='evidence.desk.get';if(url.searchParams.has('date'))args.date=url.searchParams.get('date') }
    else if(path==='/api/agent/prepare-folder' && request.method==='POST') {
     name='evidence.folders.prepare';const input=await inputBody(request)
     args={...input,idempotency_key:request.headers.get('idempotency-key')??input.idempotency_key??crypto.randomUUID()};status=201
    } else if(path==='/api/agent/proposals' && request.method==='GET')name='evidence.proposals.list'
    else return refused('This credential permits inspection and preparation only.',403)
    const result=await invokeLegacy(env,token,name,args,clock)
    if(!active(await grant(env,secret!),clock())) return refused('Agent credential expired or revoked.',401)
    if(result.outcome!=='done')return json({code:result.code??'approval_required',...result.fields,...(result.approval?{approval:result.approval}:{}),error:result.code??'approval_required'},result.code==='unauthenticated'?401:result.code==='invalid_arguments'?400:409)
    return json(result.result,status)
   }
   if(!['GET','HEAD'].includes(request.method) && request.headers.get('origin')!==env.AUTH_ORIGIN) return json({error:'Same-origin request required.'},403)
   const session=await operatorAuth(env).getSession(request)
   if(!session) return json({error:'Native owner sign-in required.'},401)
   if(session.operator.role!=='owner' || !['native','dev'].includes(session.kind)) return json({error:'Native owner sign-in required.'},403)
   auditActor={id:session.operator.id,name:session.operator.displayName,kind:'owner'}
   const actor=session.operator,now=clock(),display={env,sessionId:session.id,actor,now,request,url}
   if((path==='/app/agent' || path==='/api/agent') && ['GET','HEAD'].includes(request.method)) {
    const issued=!api?await takeOnce<{label?:string;token?:string;folder?:import('../review/types').Folder;url?:string}>(display):null
    if(issued?.token)return tokenPage(issued.label!,issued.token,actor.displayName)
    if(issued?.folder)return issuedPage(issued.folder,issued.url!,actor.displayName)
    const [access,rows]=await Promise.all([tokens(env),proposals(env)])
    return api?json({tokens:access,proposals:rows}):agentPage(access,rows,now,actor.displayName)
   }
   if(/^\/(?:app|api)\/agent\/tokens$/.test(path) && request.method==='POST') {
    const input=await inputBody(request)
    if(typeof input.label!=='string' || !input.label.trim() || input.label.trim().length>100) throw new Refusal('Name the agent (up to 100 characters).')
    const result=await issueToken(env,input.label.trim(),future(input.expires_at,now),actor,now)
    return api?json(result,201):showOnce(display,'/app/agent',{label:result.grant.label,token:result.token})
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
      return api?json({decision:result.decision,folder:result.folder,review_url:reviewURL},201):showOnce(display,'/app/agent',{folder:result.folder,url:reviewURL})
     }
     return api?json({decision:result.decision}):redirect()
    }
   }
   return json({error:'Not found or method not allowed.'},405)
  } catch(error) {
   if(error instanceof Refusal) return refused(error.message,error.status)
   // Never log errors or request metadata: these requests carry credentials.
   return json({error:'Storage unavailable; no authorization or publication was established.'},503)
  }
 }
}
