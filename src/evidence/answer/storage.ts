import { portalDocument, assertPortalDocuments, type PortalDocument } from './portal-documents'
import { assertDependencies,carryDependencies,type Replacement } from '../agent/promises'
import type { Bindings } from '../../auth.server'
import { auditStatement,text,type Actor,type Input } from '../door'
import { boundedBody,MAX_FILE,Refusal } from '../upload'
import { sha } from '../archive/format'
import { validDate } from '../model'
import { requirePerson } from '../program/people'
import { readQuestionnaire,exportAnswers,validChoice,type Mapping,type Question } from './format'
import { sources,assertSources,type Source } from './sources'
export interface Questionnaire {id:string;program_id:string;name:string;filename:string;media_type:string;size:number;sha256:string;object_key:string;format:string;mapping_json:string;questions_json:string;created_by:string;created_at:string}
export interface Answer {document?:PortalDocument;id:string;answer:string;state:'cited'|'flagged'|'conflicting';reason:string;citations:Source[];mapping?:{value:string;format:string;reason:string}}
export interface Draft {id:string;questionnaire_id:string;revision:number;snapshot_json:string;snapshot_hash:string;created_by:string;created_at:string}
export const questionnaireList=async(env:Bindings,program?:string)=>(await (program?env.DB.prepare('SELECT * FROM questionnaires WHERE program_id=? ORDER BY created_at,rowid').bind(program):env.DB.prepare('SELECT * FROM questionnaires ORDER BY created_at,rowid')).all<Questionnaire>()).results
export async function questionnaire(env:Bindings,id:string){const r=await env.DB.prepare('SELECT * FROM questionnaires WHERE id=?').bind(id).first<Questionnaire>();if(!r)throw new Refusal('Questionnaire not found.',404);return r}
export async function templateBytes(env:Bindings,q:Questionnaire){const o=await env.EXHIBITS.get(q.object_key);if(!o)throw new Refusal('Original template unavailable.',409);const b=await o.arrayBuffer();if(b.byteLength!==q.size||await sha(b)!==q.sha256)throw new Refusal('Original template digest changed.',409);return new Uint8Array(b)}
export async function uploadQuestionnaire(env:Bindings,request:Request,actor:Actor,now:Date){
 const type=request.headers.get('content-type')??'';if(!type.startsWith('multipart/form-data'))throw new Refusal('Use the questionnaire file form.')
 const form=await new Response(await boundedBody(request,MAX_FILE+65536),{headers:{'content-type':type}}).formData(),file=form.get('file'),program=form.get('program_id'),name=form.get('name')
 if(!(file instanceof File)||!file.size||file.size>MAX_FILE)throw new Refusal('Choose a nonempty questionnaire no larger than 10 MiB.')
 if(typeof program!=='string'||!await env.DB.prepare('SELECT 1 FROM programs WHERE id=?').bind(program).first())throw new Refusal('Choose its program.')
 if(typeof name!=='string'||!name.trim()||name.length>200)throw new Refusal('Name the questionnaire.')
 const mapping=Object.fromEntries(['id','question','section','format','answer'].map(k=>[k,String(form.get(k+'_column')??'')])) as unknown as Mapping,bytes=new Uint8Array(await file.arrayBuffer()),parsed=readQuestionnaire(file.name,bytes,mapping),id=crypto.randomUUID(),key='questionnaires/'+id,hash=await sha(bytes)
 if(!await env.EXHIBITS.put(key,bytes,{onlyIf:{etagDoesNotMatch:'*'},httpMetadata:{contentType:'application/octet-stream'}}))throw new Refusal('Template storage conflict.',409)
 const stored=await env.EXHIBITS.get(key);if(!stored||await sha(await stored.arrayBuffer())!==hash)throw new Refusal('Stored template could not be verified.',503)
 await env.DB.batch([env.DB.prepare('INSERT INTO questionnaires VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id,program,name.trim(),file.name.replace(/[\x00-\x1f\x7f]/g,'').slice(0,240),file.type||'application/octet-stream',bytes.length,hash,key,parsed.format,JSON.stringify(mapping),JSON.stringify(parsed.questions),actor.name,now.toISOString()),auditStatement(env,actor,'questionnaire.uploaded','questionnaire:'+id,now,'succeeded',parsed.questions.length+' questions',{revision:hash})])
 return questionnaire(env,id)
}
const words=(s:string)=>new Set(s.toLowerCase().match(/[a-z]{4,}/g)?.filter(w=>!['what','does','your','with','that','this','have','from','please','describe','provide','which','when'].includes(w))??[])
export function extractiveAnswers(questions:Question[],selected:Source[]):Answer[]{return questions.map(q=>{
 const terms=words(q.question),matches=selected.filter(s=>s.kind!=='exhibit').filter(s=>{const found=[...words(s.quote)].filter(w=>terms.has(w));return found.length>=2})
 if(!/^(?:text|free.?text|narrative)$/i.test(q.format))return {id:q.id,answer:'',state:'flagged',reason:'Required non-text answer format needs reviewed mapping; no value is inferred.',citations:[]}
 if(matches.some(s=>['fail','unknown'].includes(s.state)))return {id:q.id,answer:'',state:'conflicting',reason:'Matching evidence includes a failure or unknown; reconcile the contradiction.',citations:matches}
 const match=matches[0];return match?{id:q.id,answer:match.quote,state:'cited',reason:'Exact source excerpt; reviewer must assess relevance.',citations:[match]}:{id:q.id,answer:'',state:'flagged',reason:'No authorized matching source passage.',citations:[]}
})}
export async function draftOf(env:Bindings,q:string,id:string){const r=await env.DB.prepare('SELECT * FROM questionnaire_drafts WHERE id=? AND questionnaire_id=?').bind(id,q).first<Draft>();if(!r)throw new Refusal('Draft not found.',404);return r}
const fingerprint=(s:string)=>sha(new TextEncoder().encode(s))
export async function appendDraft(env:Bindings,q:string,answers:Answer[],actor:Actor,now:Date,replacement?:Replacement){
 const previous=await env.DB.prepare('SELECT id FROM questionnaire_drafts WHERE questionnaire_id=? ORDER BY revision DESC LIMIT 1').bind(q).first<{id:string}>()
 const row=await questionnaire(env,q),questions=JSON.parse(row.questions_json) as Question[]
 if(answers.length!==questions.length||answers.some((a,i)=>{
  if(a.id!==questions[i].id)return true
  if(a.state!=='cited')return a.answer!==''
  if(!a.citations.length)return true
  const q=questions[i]
  if(q.format==='file'&&(q as any).portal)return !a.document||a.citations.length!==1||a.citations[0].kind!=='exhibit'||a.citations[0].source_id!==a.document.receipt_id||a.answer!==a.document.filename||a.citations[0].quote!==a.document.filename||!!a.mapping
  if(a.document)return true
  if(/^(?:text|free.?text|narrative)$/i.test(q.format))return !!a.mapping||a.answer!==a.citations.map(c=>c.quote).join('\n\n')
  return !a.mapping||a.mapping.format!==q.format||a.mapping.value!==a.answer||!validChoice(q,a.answer)||!a.mapping.reason.trim()
 }))throw new Refusal('Each answer needs exact cited excerpts or an explicit reviewed mapping to its declared choice format; otherwise flag it.')
 await assertSources(env,answers.flatMap(a=>a.citations),now)
 await assertPortalDocuments(env,answers)
 const stats={cited:answers.filter(a=>a.state==='cited').length,flagged:answers.filter(a=>a.state==='flagged').length,conflicting:answers.filter(a=>a.state==='conflicting').length,total:questions.length},snapshot=JSON.stringify({questions,answers,stats,template_sha256:row.sha256}),hash=await fingerprint(snapshot),id=crypto.randomUUID()
 await env.DB.batch([env.DB.prepare('INSERT INTO questionnaire_drafts SELECT ?,?,COALESCE(max(revision),0)+1,?,?,?,? FROM questionnaire_drafts WHERE questionnaire_id=?').bind(id,q,snapshot,hash,actor.name,now.toISOString(),q),...(previous?[carryDependencies(env,'answer',previous.id,id,replacement)]:[]),auditStatement(env,actor,'questionnaire.drafted','questionnaire:'+q,now,'succeeded',JSON.stringify(stats),{revision:hash})]);return draftOf(env,q,id)
}
export async function generateDraft(env:Bindings,q:string,actor:Actor,now:Date,replacement?:Replacement){return appendDraft(env,q,extractiveAnswers(JSON.parse((await questionnaire(env,q)).questions_json),await sources(env,now)),actor,now,replacement)}
export async function editDraft(env:Bindings,q:string,id:string,input:Input,actor:Actor,now:Date){
 const row=await draftOf(env,q,id);if(input.snapshot_hash!==row.snapshot_hash)throw new Refusal('Review the exact draft.',409)
 const s=JSON.parse(row.snapshot_json),answer=s.answers.find((a:Answer)=>a.id===input.question_id),question=s.questions.find((q:Question)=>q.id===input.question_id)
 if(!answer||!question)throw new Refusal('Question not found.')
 const src=(await sources(env,now)).find(s=>s.id===input.source_id)
 delete answer.mapping;delete answer.document
 if(input.flag==='yes')Object.assign(answer,{answer:'',state:'flagged',reason:text(input,'reason',500),citations:[]})
 else {
  if(!src)throw new Refusal('Select an authorized source passage.')
  if(src.kind==='exhibit'&&question.format!=='file')throw new Refusal('An exhibit filename is only a document selection, not a cited text answer.')
  if(question.format==='file'&&question.portal){
   if(src.kind!=='exhibit'||input.mapping_confirm!=='yes')throw new Refusal('Select an exhibit and explicitly confirm the exact document for this portal field.')
   const document=await portalDocument(env,src.source_id);if(src.quote!==document.filename)throw new Refusal('Select the exact exhibit filename as the source passage.')
   Object.assign(answer,{answer:document.filename,state:'cited',reason:text(input,'reason',500),citations:[src],document})
  }else if(/^(?:text|free.?text|narrative)$/i.test(question.format))Object.assign(answer,{answer:src.quote,state:'cited',reason:'Reviewer selected exact source passage',citations:[src]})
  else {
   const value=text(input,'answer_value',question.portal?10000:100),reason=text(input,'reason',500)
   if(input.mapping_confirm!=='yes'||!validChoice(question,value))throw new Refusal('Explicitly confirm that the cited passage supports this exact declared choice. Unknown formats must stay flagged.')
   Object.assign(answer,{answer:value,state:'cited',reason:'Reviewer mapped cited passage to declared choice',citations:[src],mapping:{value,format:question.format,reason}})
  }
 }
 return appendDraft(env,q,s.answers,actor,now)
}
export async function approveDraft(env:Bindings,q:string,id:string,input:Input,actor:Actor,now:Date){const dependencies=await assertDependencies(env,'answer',id,now,input);const row=await draftOf(env,q,id),snapshot=JSON.parse(row.snapshot_json),reviewer=await requirePerson(env,input.reviewer_person_id,'named security/legal reviewer'),recipient=text(input,'recipient',254),expiry=text(input,'expires_on',10),reason=text(input,'reason',1000)
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)||!validDate(expiry)||expiry<now.toISOString().slice(0,10))throw new Refusal('Name the exact recipient email and a current or future expiry date.')
 if(input.snapshot_hash!==row.snapshot_hash||await fingerprint(row.snapshot_json)!==row.snapshot_hash||(await env.DB.prepare('SELECT max(revision) AS n FROM questionnaire_drafts WHERE questionnaire_id=?').bind(q).first<{n:number}>())?.n!==row.revision)throw new Refusal('Review the exact latest answer set.',409)
 await assertSources(env,snapshot.answers.flatMap((a:Answer)=>a.citations),now);await assertPortalDocuments(env,snapshot.answers)
 if(await env.DB.prepare('SELECT 1 FROM questionnaire_approvals WHERE draft_id=?').bind(id).first())throw new Refusal('This draft is already approved.',409)
 const saved=await env.DB.batch([env.DB.prepare("INSERT INTO questionnaire_approvals SELECT ?,?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM promise_dependencies WHERE subject_kind='answer' AND subject_id=?)=? AND NOT EXISTS(SELECT 1 FROM promise_dependencies WHERE subject_kind='answer' AND subject_id=? AND id NOT IN (SELECT value FROM json_each(?)))").bind(id,row.snapshot_hash,reviewer.id,recipient,expiry,reason,actor.name,now.toISOString(),id,dependencies.rows.length,id,JSON.stringify(dependencies.rows.map(r=>r.id))),auditStatement(env,actor,'questionnaire.approved','questionnaire:'+q,now,'succeeded','recipient '+recipient+'; reviewer '+reviewer.name,{reason,revision:row.snapshot_hash})]);if(!saved[0].meta.changes)throw new Refusal('Dependencies changed during approval. Review again.',409);return {approved:true}
}
export async function approvedExport(env:Bindings,q:string,id:string,recipient:string,actor:Actor,now:Date){await assertDependencies(env,'answer',id,now);const row=await draftOf(env,q,id),approval=await env.DB.prepare('SELECT * FROM questionnaire_approvals WHERE draft_id=?').bind(id).first<any>(),snapshot=JSON.parse(row.snapshot_json)
 if(!approval||approval.snapshot_hash!==row.snapshot_hash||approval.recipient!==recipient||approval.expires_on<now.toISOString().slice(0,10))throw new Refusal('An unexpired exact approval for this recipient is required.',409)
 if((await env.DB.prepare('SELECT max(revision) AS n FROM questionnaire_drafts WHERE questionnaire_id=?').bind(q).first<{n:number}>())?.n!==row.revision)throw new Refusal('A newer draft needs its own decision.',409)
 await assertSources(env,snapshot.answers.flatMap((a:Answer)=>a.citations),now);await assertPortalDocuments(env,snapshot.answers)
 const original=await questionnaire(env,q);if(original.format==='portal')throw new Refusal('Portal questionnaires fill through the scoped browser extension; there is no buyer file template to export.',409);const out=new Map<string,string>(snapshot.answers.map((a:Answer)=>[a.id,a.state==='cited'?a.answer+(a.mapping?'':'\n'+a.citations.map(c=>`Source ${c.kind}:${c.source_id} revision ${c.revision}, period ${c.period_from} to ${c.period_to||'not specified'}`).join('\n')):`FLAGGED (${a.state}): ${a.reason}`]))
 const bytes=exportAnswers(original.filename,await templateBytes(env,original),JSON.parse(original.mapping_json),out)
 await auditStatement(env,actor,'questionnaire.exported','questionnaire:'+q,now,'succeeded','approved recipient '+recipient,{revision:row.snapshot_hash}).run();return {bytes,filename:original.filename,media_type:original.media_type,citations:{questionnaire_id:q,template_sha256:original.sha256,draft_id:id,snapshot_hash:row.snapshot_hash,recipient,approved_at:approval.approved_at,answers:snapshot.answers}}
}
export async function questionnaireChecklist(env:Bindings,program:string,now:Date){const rows=await questionnaireList(env,program),records=[]
 for(const q of rows){const draft=await env.DB.prepare('SELECT * FROM questionnaire_drafts WHERE questionnaire_id=? ORDER BY revision DESC LIMIT 1').bind(q.id).first<Draft>();let complete=false
  if(draft){const a=await env.DB.prepare('SELECT expires_on FROM questionnaire_approvals WHERE draft_id=?').bind(draft.id).first<{expires_on:string}>(),s=JSON.parse(draft.snapshot_json);try{await assertSources(env,s.answers.flatMap((a:Answer)=>a.citations),now);complete=!!a&&a.expires_on>=now.toISOString().slice(0,10)&&s.stats.flagged===0&&s.stats.conflicting===0}catch{complete=false}}
  records.push({id:q.id,href:'/app/questionnaires/'+q.id,label:q.name,state:complete?'complete':'open'})
 }
 return {area:'Questionnaires',ready:records.filter(r=>r.state==='complete').length,total:rows.length,available:true,refs:[],records}
}
