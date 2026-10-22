import { operatorAuth, runtimeBindings, type Bindings } from '../../auth.server'
import { headers } from '../view'
import { boundedBody, Refusal } from '../upload'
import { MAX_ARCHIVE } from './zip'
import { MAPPING_VERSION, validateMapping } from './plan'
import { commit, jobAction, providerOf, readBundle, readSource, reviewById, reviews, saveMapping, stage } from './storage'
import { reviewPage, shapePage } from './view'
import { moveInPage, bundleReviewPage } from './bundle/view'
import { BUNDLE_MAPPING_VERSION, identityReview, validateBundleMapping, type BundleMapping } from './bundle/plan'
import { importedRecords, reconcile, recordsCsv } from './bundle/records'
import { classes, type Provider } from './bundle/classes'
import type { BundleSummary } from './bundle/parse'
import type { Mapping, Review } from './types'
import { auditStatement } from '../door'
import { sha256 } from './base/provenance/identity'
const json=(value:unknown,status=200)=>Response.json(value,{status,headers})
const redirect=(id:string)=>new Response(null,{status:303,headers:{...headers,location:'/app/import/'+id}})
async function input(request:Request,review:Review){
 const text=new TextDecoder().decode(await boundedBody(request,65536))
 if(request.headers.get('content-type')?.startsWith('application/json')){try{const obj=JSON.parse(text);if(!obj||typeof obj!=='object'||Array.isArray(obj))throw 0;return obj}catch{throw new Refusal('Use an input object.')}}
 if(!request.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded'))throw new Refusal('Use JSON or a form.')
 const form=new URLSearchParams(text)
 if(providerOf(review)!=='Drata'){const identity:{group:string|null;decision:string|null}[]=[];for(let i=0;form.has('group_'+i);i++)identity.push({group:form.get('group_'+i),decision:form.get('decision_'+i)});return{fingerprint:form.get('fingerprint'),approve:form.get('approve'),mapping:{identity}}}
 const controls=JSON.parse(review.summary_json).controls as {id:string}[]
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
  const signedIn=await operatorAuth(env).getSession(request)
  if(!signedIn)return json({error:'Owner sign-in required.'},401)
  if(signedIn.operator.role!=='owner')return json({error:'Owner access required.'},403)
  const session=signedIn
  // LOG-001: every import write (upload, mapping, commit, resume, undo) is
  // audited with its outcome, including refusals and storage failures.
  const write=request.method==='POST'?(/^\/(?:app|api)\/import\/(?:drata|vanta|secureframe|[a-f0-9-]+\/(mapping|commit|resume|undo))$/.exec(path)):null
  const note:{detail:string;revision?:string}={detail:''}
  const audit=(outcome:'succeeded'|'refused'|'failed',detail='')=>write?auditStatement(env,{id:session.operatorId,name:session.operator.displayName},'import.'+(write[1]??'staged'),'import:'+(/\/import\/([a-f0-9-]{36})/.exec(path)?.[1]??'upload'),clock(),outcome,detail||(outcome==='succeeded'?note.detail:''),{revision:note.revision}).run():Promise.resolve()
  try{
   const response=await route()
   if(response.status<400)await audit('succeeded');else await audit('refused','HTTP '+response.status)
   return response
  }catch(error){
   if(error instanceof Refusal){await audit('refused',error.message);return json({error:error.message},error.status)}
   // Never expose raw provider errors, source contents, cookie/session IDs or URLs.
   const code=error instanceof Error?error.message:''
   const conflicts=['REVIEW_FINGERPRINT_MISMATCH','SOURCE_ID_CONTENT_CONFLICT','OPERATION_KEY_CONFLICT','NATIVE_EDIT_CONFLICT','TARGET_REVISION_CONFLICT','IMPORT_ALREADY_REVERSING','UNDO_REQUIRES_COMPLETED_IMPORT','JOB_BINDING_MISMATCH','REVERSAL_MODE_CONFLICT']
   if(conflicts.includes(code)){await audit('refused','conflict with retained history');return json({error:'Import conflicts with retained history or a changed plan. Review this import before continuing.'},409)}
   await audit('failed','storage or integrity check failed')
   return json({error:'Import storage or integrity check failed. Retained history has not been discarded; retry the durable operation.'},503)
  }
  async function route():Promise<Response>{
   if(['/app/import','/api/import'].includes(path)&&['GET','HEAD'].includes(request.method))return api?json({imports:await reviews(env)}):moveInPage(await reviews(env),session.operator.displayName)
   if(path==='/app/import/shape'&&['GET','HEAD'].includes(request.method))return shapePage(session.operator.displayName)
   const door=/^\/(?:app|api)\/import\/(drata|vanta|secureframe)$/.exec(path)
   if(door&&request.method==='POST'){
    if(!request.headers.get('content-type')?.startsWith('multipart/form-data;'))throw new Refusal('Upload a ZIP using the file form.')
    const bytes=await boundedBody(request,MAX_ARCHIVE+65536)
    let form:FormData;try{form=await new Response(bytes,{headers:{'content-type':request.headers.get('content-type')!}}).formData()}catch{throw new Refusal('Invalid upload form.')}
    const file=form.get('file');if(!(file instanceof File)||!file.size||file.size>MAX_ARCHIVE)throw new Refusal('Choose a nonempty ZIP up to 20 MiB.')
    const provider=(door[1][0].toUpperCase()+door[1].slice(1)) as Provider
    const review=await stage(env,new Uint8Array(await file.arrayBuffer()),session,clock(),provider);note.detail=provider+' export staged: '+review.archive_size+' bytes, sha256 '+review.archive_sha256.slice(0,16);note.revision=provider==='Drata'?MAPPING_VERSION:BUNDLE_MAPPING_VERSION
    return api?json({review,summary:JSON.parse(review.summary_json)},201):redirect(review.id)
   }
   if(['/api/import/records'].includes(path)&&['GET','HEAD'].includes(request.method)){
    const cls=url.searchParams.get('class')??undefined;if(cls&&!classes.some(c=>c.id===cls))throw new Refusal('Unknown record class.')
    return json({records:await importedRecords(env,{class:cls,activeOnly:true})})
   }
   const match=/^\/(?:app|api)\/import\/([a-f0-9-]+)(?:\/(mapping|commit|resume|undo|source|manifest|records|export|export\.csv|exhibit\/[a-f0-9-]+))?$/.exec(path)
   if(!match)return json({error:'Not found.'},404)
   const review=await reviewById(env,match[1],session.operatorId),action=match[2]
   if(['GET','HEAD'].includes(request.method)){
    const provider=providerOf(review),summary=JSON.parse(review.summary_json) as BundleSummary
    if(action==='source'&&provider!=='Drata')return download((await readBundle(env,review)).archive,provider.toLowerCase()+'-source.zip')
    if(action==='source'||(action==='manifest'&&provider==='Drata')){const parsed=await readSource(env,review);return download(action==='source'?parsed.archive:parsed.manifestBytes,action==='source'?'drata-source.zip':'evidence_manifest.html')}
    const cls=url.searchParams.get('class')??undefined;if(cls&&!classes.some(c=>c.id===cls))throw new Refusal('Unknown record class.')
    if(action==='records')return json({records:await importedRecords(env,{review:review.id,class:cls})})
    if(action==='export'||action==='export.csv'){
     const records=await importedRecords(env,{review:review.id,class:cls}),csv=action==='export.csv'
     await auditStatement(env,{id:session.operatorId,name:session.operator.displayName},'import.exported','import:'+review.id,clock(),'succeeded',csv?'csv':'json').run()
     if(csv)return new Response(recordsCsv(records),{headers:{...headers,'content-type':'text/csv; charset=utf-8','content-disposition':`attachment; filename="import-${review.id.slice(0,8)}.csv"`}})
     return json({format:'evidence-import-export',version:1,review:{id:review.id,incumbent:provider,received_at:review.staged_at,approved_at:review.approved_at,archive_sha256:review.archive_sha256,exported_at:summary.exported_at??null},reconciliation:reconcile(review,summary,await importedRecords(env,{review:review.id})),records})
    }
    if(action?.startsWith('exhibit/')){
     const record=(await importedRecords(env,{review:review.id,class:'exhibits'})).find(r=>r.id===action.slice(8)&&r.file&&r.incumbent!=='Drata')
     const bytes=record&&(await readBundle(env,review)).files.get(record.file!.path)
     if(!record||!bytes||sha256(bytes)!==record.file!.sha256)throw new Refusal('Exhibit not found or its retained bytes no longer match the recorded digest.',404)
     return download(bytes,record.file!.name.replace(/[^\w.-]+/g,'_').slice(0,120)||'exhibit')
    }
    if(action)return json({error:'Method not allowed.'},405)
    const job=review.job_id?await jobAction(env,review,session,'read'):undefined,records=await importedRecords(env,{review:review.id}),rec=reconcile(review,summary,records)
    const groups=provider==='Drata'?[]:await identityReview(env,await readBundle(env,review))
    if(api)return json({review,summary,reconciliation:rec,identity_groups:groups,mapping:review.mapping_json?JSON.parse(review.mapping_json):null,job})
    if(provider!=='Drata')return bundleReviewPage(review,summary,rec,groups,review.mapping_json?JSON.parse(review.mapping_json) as BundleMapping:null,job,records,cls,session.operator.displayName)
    const {results}=await env.DB.prepare('SELECT r.id,r.name,c.name AS control_name FROM requirements r JOIN controls c ON c.id=r.control_id ORDER BY c.name,r.name').all<{id:string;name:string;control_name:string}>()
    return reviewPage(review,results,job,session.operator.displayName,rec)
   }
   if(request.method!=='POST')return json({error:'Method not allowed.'},405)
   const body=await input(request,review)
   if(action==='mapping'){
    const mapping=providerOf(review)==='Drata'?await validateMapping(env,await readSource(env,review),body.mapping):await validateBundleMapping(env,await readBundle(env,review),body.mapping),result=await saveMapping(env,review,mapping,session);note.detail=providerOf(review)+' mapping saved'+(providerOf(review)==='Drata'?'':': '+(mapping as BundleMapping).identity.map(d=>d.decision).join(', ')+' identity decisions');note.revision=providerOf(review)==='Drata'?MAPPING_VERSION:BUNDLE_MAPPING_VERSION
    return api?json(result):redirect(review.id)
   }
   if(action==='commit'){
    if(body.approve!=='commit')throw new Refusal('Explicit owner approval is required.',409)
    if(typeof body.fingerprint!=='string')throw new Refusal('Supply the reviewed fingerprint.',409)
    const job=await commit(env,review,body.fingerprint,session,clock());note.detail=providerOf(review)+' import approved with plan fingerprint '+body.fingerprint.slice(0,16)+'; job '+job.state;note.revision=providerOf(review)==='Drata'?MAPPING_VERSION:BUNDLE_MAPPING_VERSION;return api?json({job}):redirect(review.id)
   }
   if(action==='resume'||action==='undo'){
    if(action==='undo'&&body.approve!=='undo')throw new Refusal('Confirm unlinking imported additions.',409)
    const job=await jobAction(env,review,session,action);note.detail=providerOf(review)+' '+action+': job '+job.state;note.revision=providerOf(review)==='Drata'?MAPPING_VERSION:BUNDLE_MAPPING_VERSION;return api?json({job}):redirect(review.id)
   }
   return json({error:'Method not allowed.'},405)
  }
 }
}
