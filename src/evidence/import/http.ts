import { operatorAuth, runtimeBindings, type Bindings } from '../../auth.server'
import { headers } from '../view'
import { boundedBody, Refusal } from '../upload'
import { MAX_ARCHIVE } from './zip'
import { validateMapping } from './plan'
import { commit, jobAction, readSource, reviewById, reviews, saveMapping, stage } from './storage'
import { importPage, reviewPage, shapePage } from './view'
import type { Mapping, Review } from './types'
const json=(value:unknown,status=200)=>Response.json(value,{status,headers})
const redirect=(id:string)=>new Response(null,{status:303,headers:{...headers,location:'/app/import/'+id}})
async function input(request:Request,review:Review){
 const text=new TextDecoder().decode(await boundedBody(request,65536))
 if(request.headers.get('content-type')?.startsWith('application/json')){try{const obj=JSON.parse(text);if(!obj||typeof obj!=='object'||Array.isArray(obj))throw 0;return obj}catch{throw new Refusal('Use an input object.')}}
 if(!request.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded'))throw new Refusal('Use JSON or a form.')
 const form=new URLSearchParams(text),controls=JSON.parse(review.summary_json).controls as {id:string}[]
 return{fingerprint:form.get('fingerprint'),approve:form.get('approve'),mapping:controls.map((_,i)=>({source_id:form.get('source_id_'+i),action:form.get('action_'+i),name:form.get('name_'+i),proof:form.get('proof_'+i),group:form.get('group_'+i),cadence:form.get('cadence_'+i),requirement_id:form.get('requirement_id_'+i),covered_from:form.get('covered_from_'+i),covered_to:form.get('covered_to_'+i)}))}
}
const download=(bytes:Uint8Array,name:string)=>new Response(bytes as BodyInit,{headers:{...headers,'content-type':'application/octet-stream','content-disposition':`attachment; filename="${name}"`,'content-security-policy':"default-src 'none'; sandbox",'content-length':String(bytes.length)}})
// Call before evidenceHandler, which owns the broader /app namespace.
export function importHandler(clock:()=>Date=()=>new Date()){
 return async(request:Request,original:Bindings):Promise<Response|null>=>{
  const url=new URL(request.url),path=url.pathname
  if(!/^\/(?:app|api)\/import(?:\/|$)/.test(path))return null
  const env=runtimeBindings(original),api=path.startsWith('/api/')
  if(url.origin!==env.AUTH_ORIGIN||(request.headers.has('host')&&request.headers.get('host')?.toLowerCase()!==url.host.toLowerCase()))return json({error:'Invalid host.'},403)
  if(request.headers.get('sec-fetch-site')==='cross-site'||(request.headers.has('origin')&&request.headers.get('origin')!==env.AUTH_ORIGIN)||(!['GET','HEAD'].includes(request.method)&&request.headers.get('origin')!==env.AUTH_ORIGIN))return json({error:'Same-origin request required.'},403)
  const session=await operatorAuth(env).getSession(request)
  if(!session)return json({error:'Owner sign-in required.'},401)
  if(session.operator.role!=='owner')return json({error:'Owner access required.'},403)
  try{
   if(['/app/import','/api/import'].includes(path)&&['GET','HEAD'].includes(request.method))return api?json({imports:await reviews(env)}):importPage(await reviews(env),session.operator.displayName)
   if(path==='/app/import/shape'&&['GET','HEAD'].includes(request.method))return shapePage(session.operator.displayName)
   if(['/app/import/drata','/api/import/drata'].includes(path)&&request.method==='POST'){
    if(!request.headers.get('content-type')?.startsWith('multipart/form-data;'))throw new Refusal('Upload a ZIP using the file form.')
    const bytes=await boundedBody(request,MAX_ARCHIVE+65536)
    let form:FormData;try{form=await new Response(bytes,{headers:{'content-type':request.headers.get('content-type')!}}).formData()}catch{throw new Refusal('Invalid upload form.')}
    const file=form.get('file');if(!(file instanceof File)||!file.size||file.size>MAX_ARCHIVE)throw new Refusal('Choose a nonempty ZIP up to 20 MiB.')
    const review=await stage(env,new Uint8Array(await file.arrayBuffer()),session,clock())
    return api?json({review,summary:JSON.parse(review.summary_json)},201):redirect(review.id)
   }
   const match=/^\/(?:app|api)\/import\/([a-f0-9-]+)(?:\/(mapping|commit|resume|undo|source|manifest))?$/.exec(path)
   if(!match)return json({error:'Not found.'},404)
   const review=await reviewById(env,match[1],session.operatorId),action=match[2]
   if(['GET','HEAD'].includes(request.method)){
    if(action==='source'||action==='manifest'){const parsed=await readSource(env,review);return download(action==='source'?parsed.archive:parsed.manifestBytes,action==='source'?'drata-source.zip':'evidence_manifest.html')}
    if(action)return json({error:'Method not allowed.'},405)
    const job=review.job_id?await jobAction(env,review,session,'read'):undefined
    if(api)return json({review,summary:JSON.parse(review.summary_json),mapping:review.mapping_json?JSON.parse(review.mapping_json):null,job})
    const {results}=await env.DB.prepare('SELECT r.id,r.name,c.name AS control_name FROM requirements r JOIN controls c ON c.id=r.control_id ORDER BY c.name,r.name').all<{id:string;name:string;control_name:string}>()
    return reviewPage(review,results,job,session.operator.displayName)
   }
   if(request.method!=='POST')return json({error:'Method not allowed.'},405)
   const body=await input(request,review)
   if(action==='mapping'){
    const parsed=await readSource(env,review),mapping=await validateMapping(env,parsed,body.mapping),result=await saveMapping(env,review,mapping as Mapping[],session)
    return api?json(result):redirect(review.id)
   }
   if(action==='commit'){
    if(body.approve!=='commit')throw new Refusal('Explicit owner approval is required.',409)
    if(typeof body.fingerprint!=='string')throw new Refusal('Supply the reviewed fingerprint.',409)
    const job=await commit(env,review,body.fingerprint,session,clock());return api?json({job}):redirect(review.id)
   }
   if(action==='resume'||action==='undo'){
    if(action==='undo'&&body.approve!=='undo')throw new Refusal('Confirm unlinking imported additions.',409)
    const job=await jobAction(env,review,session,action);return api?json({job}):redirect(review.id)
   }
   return json({error:'Method not allowed.'},405)
  }catch(error){
   if(error instanceof Refusal)return json({error:error.message},error.status)
   // Never expose raw provider errors, source contents, cookie/session IDs or URLs.
   const code=error instanceof Error?error.message:''
   const conflicts=['REVIEW_FINGERPRINT_MISMATCH','SOURCE_ID_CONTENT_CONFLICT','OPERATION_KEY_CONFLICT','NATIVE_EDIT_CONFLICT','TARGET_REVISION_CONFLICT','IMPORT_ALREADY_REVERSING','UNDO_REQUIRES_COMPLETED_IMPORT','JOB_BINDING_MISMATCH','REVERSAL_MODE_CONFLICT']
   if(conflicts.includes(code))return json({error:'Import conflicts with retained history or a changed plan. Review this import before continuing.'},409)
   return json({error:'Import storage or integrity check failed. Retained history has not been discarded; retry the durable operation.'},503)
  }
 }
}
