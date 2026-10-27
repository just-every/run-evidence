import { assertPortalDocuments } from './portal-documents'
import { receipt,storedBytes } from '../storage'
import { assertDependencies } from '../agent/promises'
import { assertSources } from './sources'
import { draftOf,templateBytes } from './storage'
import type { Bindings } from '../../auth.server'
import { auditStatement, type Actor } from '../door'
import { Refusal } from '../upload'
import { sha } from '../archive/format'
import { questionnaire } from './storage'

// Capture is an inbound-only capability. It cannot read answers or approve,
// publish, fill, attach files or submit anything on a customer's portal.
const string = (v: unknown, max: number, name: string) => {
 if(typeof v !== 'string' || !v.trim() || v.length > max || /[\x00-\x1f\x7f]/.test(v)) throw new Refusal(`Invalid ${name}.`)
 return v.trim()
}
export async function capturePortal(env: Bindings, input: Record<string, unknown>, actor: Actor, now: Date) {
 const name=string(input.name,200,'questionnaire name'), program=string(input.program_id,36,'program')
 if(!await env.DB.prepare('SELECT 1 FROM programs WHERE id=?').bind(program).first())throw new Refusal('Choose an existing program.',404)
 if(!Array.isArray(input.pages)||!input.pages.length||input.pages.length>100)throw new Refusal('Capture 1–100 pages; larger questionnaires need separate captures.')
 const {pages,questions,origin}=parsePortalPages(input.pages)
 const original={version:1,capture_token_id:actor.id,previous_id:await priorCapture(env,input.previous_id,actor.id,program),captured_at:now.toISOString(),origin,pages},bytes=new TextEncoder().encode(JSON.stringify(original)),hash=await sha(bytes),id=crypto.randomUUID(),key='questionnaires/'+id
 if(bytes.byteLength>1024*1024)throw new Refusal('Capture exceeds 1 MiB; use separate questionnaires.',413)
 if(!await env.EXHIBITS.put(key,bytes,{onlyIf:{etagDoesNotMatch:'*'},httpMetadata:{contentType:'application/json'}}))throw new Refusal('Capture storage conflict.',409)
 const stored=await env.EXHIBITS.get(key);if(!stored||await sha(await stored.arrayBuffer())!==hash)throw new Refusal('Stored capture could not be verified.',503)
 await env.DB.batch([
  env.DB.prepare('INSERT INTO questionnaires VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,program,name,'portal-capture.json','application/json',bytes.length,hash,key,'portal',JSON.stringify({portal:original}),JSON.stringify(questions),actor.name,now.toISOString()),
  auditStatement(env,actor,'questionnaire.portal-captured','questionnaire:'+id,now,'succeeded',`${pages.length} pages; ${questions.length} typed fields`,{revision:hash}),
 ])
 return questionnaire(env,id)
}
export function parsePortalPages(input:unknown,allowEmptyFields=false){
 if(!Array.isArray(input)||!input.length||input.length>100)throw new Refusal('Capture 1–100 pages.')
 const ids=new Set<string>(),pageIds=new Set<string>();let origin=''
 const questions:Record<string,any>[]=[],pages=input.map((value,index)=>{
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Refusal('Invalid page.')
  const p=value as Record<string,unknown>,pageId=string(p.id,200,'page identifier'),title=string(p.title,300,'page title')
  if(pageIds.has(pageId))throw new Refusal('Page identifiers must be unique.');pageIds.add(pageId)
  let url:URL;try{url=new URL(string(p.url,2000,'page URL'))}catch{throw new Refusal('Invalid page URL.')}
  if(!['https:','http:'].includes(url.protocol)||url.username||url.password||url.search||url.hash)throw new Refusal('Page URLs must have no credentials, query or fragment. Use a distinct page identifier for each step.')
  if(origin&&origin!==url.origin)throw new Refusal('All pages must belong to the same portal origin.');origin=url.origin
  if(!Array.isArray(p.fields)||(!allowEmptyFields&&!p.fields.length)||p.fields.length>2000)throw new Refusal('Each page needs 1–2,000 fields.')
  if(!Array.isArray(p.unsupported)||p.unsupported.length)throw new Refusal('Resolve unsupported or unnamed fields before importing; no incomplete capture is admitted.')
  const fields=p.fields.map(v=>{
   if(!v||typeof v!=='object'||Array.isArray(v))throw new Refusal('Invalid field.')
   const f=v as Record<string,unknown>,field=string(f.id,200,'field identifier'),id=JSON.stringify([pageId,field])
   if(ids.has(id)||ids.size>=2000)throw new Refusal('Capture at most 2,000 unique page and field identifiers.');ids.add(id)
   const type=string(f.type,30,'field type'),label=string(f.label,1000,'question'),section=typeof f.section==='string'?f.section.slice(0,300):''
   if(!['text','choice','multi-select',['yes','no'].join('/'),'file'].includes(type))throw new Refusal('Unsupported field type.')
   if(!Array.isArray(f.options)||f.options.length>500||f.options.some(o=>!o||typeof o!=='object'||typeof o.value!=='string'||o.value.length>500||typeof o.label!=='string'||o.label.length>1000))throw new Refusal('Invalid field options.')
   const options=f.options.map(o=>({value:o.value,label:o.label}))
   if(new Set(options.map(o=>o.value)).size!==options.length||(['choice','multi-select'].includes(type)&&!options.length)||(['text','file'].includes(type)&&options.length))throw new Refusal('Options must be complete and unambiguous for the field type.')
   const captured={id:field,label,type,section,options,required:f.required===true,multiple:f.multiple===true,accept:typeof f.accept==='string'?f.accept.slice(0,500):''}
   questions.push({id,section,question:label,format:type==='text'?'text':type,row:questions.length+2,page:pageId,field_id:field,page_url:url.href,page_title:title,portal:captured})
   return captured
  })
  return {id:pageId,title,url:url.href,position:index+1,fields}
 })
 return {pages,questions,origin}
}

async function priorCapture(env:Bindings,id:unknown,token:string,program:string){
 if(id===undefined||id==='')return ''
 const previous=await questionnaire(env,string(id,36,'previous capture'))
 if(previous.format!=='portal'||previous.program_id!==program||JSON.parse(previous.mapping_json).portal.capture_token_id!==token)throw new Refusal('Re-capture must use the original capture token and program.',403)
 return previous.id
}
export async function portalFillPlan(env:Bindings,qid:string,input:Record<string,unknown>,actor:Actor,now:Date){
 const q=await questionnaire(env,qid),capture=JSON.parse(q.mapping_json).portal
 if(q.format!=='portal'||!capture||capture.capture_token_id!==actor.id)throw new Refusal('This token did not capture this questionnaire.',403)
 const originalBytes=await templateBytes(env,q)
 if(new TextDecoder().decode(originalBytes)!==JSON.stringify(capture))throw new Refusal('The retained capture metadata changed. Re-capture and review.',409)
 const scan=parsePortalPages([input.page],true),page=scan.pages[0],original=capture.pages.find((p:any)=>p.id===page.id)
 if(!original||original.url!==page.url)throw new Refusal('Page identity changed. Re-capture and review.',409)
 const draft=await draftOf(env,qid,string(input.draft_id,36,'draft')),snapshot=JSON.parse(draft.snapshot_json)
 const approval=await env.DB.prepare('SELECT * FROM questionnaire_approvals WHERE draft_id=?').bind(draft.id).first<any>()
 const latest=await env.DB.prepare('SELECT id FROM questionnaire_drafts WHERE questionnaire_id=? ORDER BY revision DESC LIMIT 1').bind(qid).first<{id:string}>()
 if(!approval||approval.snapshot_hash!==draft.snapshot_hash||approval.recipient!==input.recipient||approval.expires_on<now.toISOString().slice(0,10)||latest?.id!==draft.id||await sha(new TextEncoder().encode(draft.snapshot_json))!==draft.snapshot_hash)throw new Refusal('A current exact approval for this answer set and recipient is required.',409)
 await assertDependencies(env,'answer',draft.id,now)
 await assertSources(env,snapshot.answers.flatMap((a:any)=>a.citations),now)
 await assertPortalDocuments(env,snapshot.answers)
 const results=[]
 for(const field of [...original.fields,...page.fields.filter(f=>!original.fields.some((o:any)=>o.id===f.id))]){
  const live=page.fields.find(f=>f.id===field.id),before=original.fields.find((f:any)=>f.id===field.id),question=JSON.parse(q.questions_json).find((v:any)=>v.page===page.id&&v.field_id===field.id),answer=snapshot.answers.find((v:any)=>v.id===question?.id)
  let reason=''
  if(!before)reason='Field added; re-capture and review.'
  else if(!live)reason='Field removed; re-capture and review.'
  else if(JSON.stringify(before)!==JSON.stringify(live))reason='Field type, label, options or structure changed; re-capture and review.'
  else if(!answer||answer.state!=='cited')reason='No approved cited answer for this field.'
  else if(field.type==='file'&&!answer.document)reason='No exact approved document for this field.'
  const result=reason?{id:field.id,state:'refused',reason}:{id:field.id,state:'ready',field:live,value:answer.answer,...(answer.document?{document:answer.document}:{})}
  results.push(result)
 }
 await auditBatches(env,results.map(r=>auditStatement(env,actor,'questionnaire.portal-fill-planned','questionnaire:'+qid,now,r.state==='refused'?'refused':'succeeded',JSON.stringify({page:page.id,field:r.id,state:r.state,reason:'reason' in r?r.reason:''}),{revision:draft.snapshot_hash})))
 return {questionnaire_id:qid,draft_id:draft.id,snapshot_hash:draft.snapshot_hash,page:{id:page.id,url:page.url},results}
}

// The client reports what its isolated content script observed. This is kept
// as a client report, never proof that a portal accepted or submitted anything.
export async function portalFillReport(env:Bindings,qid:string,input:Record<string,unknown>,actor:Actor,now:Date){
 const q=await questionnaire(env,qid),capture=JSON.parse(q.mapping_json).portal
 if(q.format!=='portal'||capture?.capture_token_id!==actor.id)throw new Refusal('This token did not capture this questionnaire.',403)
 const draft=await draftOf(env,qid,string(input.draft_id,36,'draft'))
 if(draft.snapshot_hash!==input.snapshot_hash)throw new Refusal('Report the exact planned revision.',409)
 const page=string(input.page_id,200,'page'),original=capture.pages.find((p:any)=>p.id===page)
 if(!original||!Array.isArray(input.results)||input.results.length>2000)throw new Refusal('Report a captured page and bounded results.')
 const fields=new Set<string>()
 const rows=input.results.map((value:any)=>{
  if(!value||typeof value!=='object'||!['filled','refused'].includes(value.state))throw new Refusal('Invalid client fill outcome.')
  const field=string(value.id,200,'field');if(fields.has(field))throw new Refusal('Report each field once.');fields.add(field)
  return auditStatement(env,actor,'questionnaire.portal-fill-reported','questionnaire:'+qid,now,value.state==='filled'?'succeeded':'refused',JSON.stringify({page,field,state:value.state,reported_by:'extension',reason:typeof value.reason==='string'?value.reason.slice(0,200):''}),{revision:draft.snapshot_hash})
 })
 if(rows.length)await auditBatches(env,rows)
 return {recorded:true,provenance:'client-reported; no portal submission or acceptance is claimed'}
}

export async function portalFile(env:Bindings,qid:string,input:Record<string,unknown>,actor:Actor,now:Date){
 const plan=await portalFillPlan(env,qid,input,actor,now),field=plan.results.find(r=>r.id===input.field_id&&r.state==='ready') as any
 if(!field?.document)throw new Refusal('No approved unchanged document field.',409)
 const row=await receipt(env,field.document.receipt_id),bytes=row?await storedBytes(env,row):null
 if(!bytes)throw new Refusal('Approved document bytes unavailable.',409)
 await auditStatement(env,actor,'questionnaire.portal-document-released','questionnaire:'+qid,now,'succeeded',JSON.stringify({field:field.id,receipt:row!.id}),{revision:plan.snapshot_hash}).run()
 return new Response(bytes,{headers:{'content-type':'application/octet-stream','cache-control':'no-store','x-content-type-options':'nosniff'}})
}

async function auditBatches(env:Bindings,rows:D1PreparedStatement[]){
 for(let at=0;at<rows.length;at+=100)await env.DB.batch(rows.slice(at,at+100))
}
