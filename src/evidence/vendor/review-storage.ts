import type { Bindings } from '../../auth.server'
import { auditStatement,text,oneOf,type Actor,type Input } from '../door'
import { Refusal } from '../upload'
import { requirePerson } from '../program/people'
import { addMonths } from '../cadence'
import { sha } from '../archive/format'
import { documentBytes,documents,profileOf,type DocumentRow } from './storage'
import { extractFields,readPages,validateExtraction,type Extraction } from './review-model'
export interface Review {id:string;document_id:string;vendor_id:string;revision:number;snapshot_json:string;snapshot_hash:string;reason:string;proposed_by:string;proposed_at:string}
const digest=(s:string)=>sha(new TextEncoder().encode(s))
export async function reviewOf(env:Bindings,vendor:string,id:string) {const row=await env.DB.prepare('SELECT * FROM vendor_document_reviews WHERE vendor_id=? AND id=?').bind(vendor,id).first<Review>();if(!row)throw new Refusal('Document review not found.',404);return row}
export async function reviewData(env:Bindings,vendor:string,id:string,now:Date) {
 const row=await reviewOf(env,vendor,id),snapshot=JSON.parse(row.snapshot_json) as Extraction
 return {review:row,snapshot,decision:await env.DB.prepare('SELECT d.*,p.name AS reviewer_name FROM vendor_review_decisions d JOIN people p ON p.id=d.reviewer_person_id WHERE review_id=?').bind(id).first(),history:(await env.DB.prepare('SELECT id,revision,reason,proposed_by,proposed_at FROM vendor_document_reviews WHERE document_id=? ORDER BY revision').bind(row.document_id).all()).results,bridge:await bridgeState(env,vendor,snapshot,now)}
}
async function append(env:Bindings,vendor:string,document:string,snapshot:Extraction,reason:string,actor:Actor,now:Date) {
 validateExtraction(snapshot)
 const json=JSON.stringify(snapshot),hash=await digest(json),id=crypto.randomUUID()
 if(new TextEncoder().encode(json).length>1024*1024)throw new Refusal('Review proposal exceeds 1 MiB.',413)
 await env.DB.batch([env.DB.prepare('INSERT INTO vendor_document_reviews(id,document_id,vendor_id,revision,snapshot_json,snapshot_hash,reason,proposed_by,proposed_at) SELECT ?,?,?,COALESCE(MAX(revision),0)+1,?,?,?,?,? FROM vendor_document_reviews WHERE document_id=?').bind(id,document,vendor,json,hash,reason,actor.name,now.toISOString(),document),auditStatement(env,actor,'vendor.review-proposed','vendor:'+vendor,now,'succeeded','page-cited local extraction',{reason,revision:hash})])
 return reviewOf(env,vendor,id)
}
export async function prepareReview(env:Bindings,vendor:string,document:string,actor:Actor,now:Date) {
 const doc=(await documents(env,vendor)).find(d=>d.id===document);if(!doc)throw new Refusal('Document not found.',404)
 const bytes=await documentBytes(env,doc);if(!bytes)throw new Refusal('Original bytes are unavailable or changed.',409)
 const pages=await readPages(bytes)
 return append(env,vendor,document,extractFields(document,doc.sha256,pages,doc.kind),'Initial extraction; all pages need human review',actor,now)
}
export async function correctReview(env:Bindings,vendor:string,id:string,input:Input,actor:Actor,now:Date) {
 const prior=await reviewOf(env,vendor,id)
 if(input.snapshot_hash!==prior.snapshot_hash)throw new Refusal('Confirm the exact source proposal.',409)
 if(await env.DB.prepare('SELECT 1 FROM vendor_review_decisions WHERE review_id=?').bind(id).first())throw new Refusal('A decided proposal cannot be corrected. Prepare a new review.',409)
 const latest=await env.DB.prepare('SELECT MAX(revision) AS n FROM vendor_document_reviews WHERE document_id=?').bind(prior.document_id).first<{n:number}>();if(latest?.n!==prior.revision)throw new Refusal('Correct the latest proposal revision.',409)
 const snapshot=JSON.parse(prior.snapshot_json) as Extraction,field=snapshot.fields.find(f=>f.id===input.field_id)
 if(!field)throw new Refusal('Choose a proposed field.')
 const value=text(input,'value',4000),quote=text(input,'quote',4000),page=Number(text(input,'page',3))
 if(!quote.toLowerCase().includes(value.toLowerCase())||!snapshot.pages[page-1]?.includes(quote))throw new Refusal('The corrected value must be supported by the cited original passage.')
 Object.assign(field,{value,quote,page})
 return append(env,vendor,prior.document_id,snapshot,text(input,'reason',500),actor,now)
}
export async function bridgeState(env:Bindings,vendor:string,snapshot:Extraction,now:Date) {
 const months=(await env.DB.prepare('SELECT bridge_months FROM vendor_review_settings WHERE vendor_id=?').bind(vendor).first<{bridge_months:number}>())?.bridge_months??3
 const period=snapshot.fields.find(f=>f.kind==='period')?.value??'',dates=period.match(/\d{4}-\d\d-\d\d/g),end=dates?.at(-1)
 if(!end||!Number.isFinite(Date.parse(end)))return {state:'unknown',months,period_end:null,letter:null,message:'Period end unavailable; bridge coverage must be reviewed.'}
 const letters=(await documents(env,vendor)).filter(d=>d.kind==='bridge'&&d.effective_on&&d.effective_on>=end&&(!d.expires_on||d.expires_on>=now.toISOString().slice(0,10)))
 let letter:DocumentRow|null=null
 for(const l of letters)if(await documentBytes(env,l)){letter=l;break}
 const gap=now.toISOString().slice(0,10)>addMonths(new Date(end+'T00:00:00Z'),months).toISOString().slice(0,10)
 return {state:letter?'letter on file':gap?'bridge letter missing':'within window',months,period_end:end,letter:letter?.id??null,message:letter?'Owner-uploaded bridge letter on file; its content is not independently verified.':gap?'Report period ended beyond the owner-set window; request a bridge letter.':'Report period is within the configured window.'}
}
export async function decideReview(env:Bindings,vendor:string,id:string,input:Input,actor:Actor,now:Date) {
 const row=await reviewOf(env,vendor,id),snapshot=JSON.parse(row.snapshot_json) as Extraction,decision=oneOf(input,'decision',['approved','rejected'] as const),reviewer=await requirePerson(env,input.reviewer_person_id,'named reviewer'),reason=text(input,'reason',1000)
 if(input.snapshot_hash!==row.snapshot_hash||await digest(row.snapshot_json)!==row.snapshot_hash)throw new Refusal('Approve the exact review fingerprint.',409)
 if((await env.DB.prepare('SELECT max(revision) AS n FROM vendor_document_reviews WHERE document_id=?').bind(row.document_id).first<{n:number}>())?.n!==row.revision)throw new Refusal('Review the latest correction.',409)
 if(await env.DB.prepare('SELECT 1 FROM vendor_review_decisions WHERE review_id=?').bind(id).first())throw new Refusal('This proposal already has a decision.',409)
 const doc=(await documents(env,vendor)).find(d=>d.id===row.document_id)
 if(!doc||!await documentBytes(env,doc)||doc.sha256!==snapshot.document_sha256)throw new Refusal('Original bytes changed or are unavailable.',409)
 const at=now.toISOString(),statements=[env.DB.prepare('INSERT INTO vendor_review_decisions(review_id,snapshot_hash,decision,reviewer_person_id,actor_id,actor_name,reason,decided_at) VALUES(?,?,?,?,?,?,?,?)').bind(id,row.snapshot_hash,decision,reviewer.id,actor.id,actor.name,reason,at)]
 if(decision==='approved'){
  validateExtraction(snapshot)
  for(const f of snapshot.fields.filter(f=>f.kind==='cuec')){
   const mapping=typeof input['mapping_'+f.id]==='string'?String(input['mapping_'+f.id]):'',accepted=mapping==='unaddressed'
   if(mapping&&!accepted&&!await env.DB.prepare('SELECT 1 FROM controls WHERE id=?').bind(mapping).first())throw new Refusal('CUEC mapping must name an existing control.')
   statements.push(env.DB.prepare('INSERT INTO vendor_cuecs(id,vendor_id,document_id,review_id,field_id,body,control_id,accepted_unaddressed,decided_at) VALUES(?,?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),vendor,row.document_id,id,f.id,f.value,mapping&&!accepted?mapping:null,accepted?1:0,at))
  }
  const findings=snapshot.fields.filter(f=>f.kind==='exception'||f.kind==='finding'||(f.kind==='opinion'&&f.value!=='unqualified'))
  for(const f of findings)statements.push(env.DB.prepare('INSERT INTO vendor_findings(id,vendor_id,source_kind,source_ref,severity,title,detail,recorded_by,recorded_at) VALUES(?,?,\'document\',?,\'high\',?,?,?,?)').bind(crypto.randomUUID(),vendor,row.document_id,`${f.kind}: ${f.value}`.slice(0,300),`Review ${id}, page ${f.page}: ${f.quote}`.slice(0,2000),actor.name,at))
  if(findings.length){const p=await profileOf(env,vendor);if(p)statements.push(env.DB.prepare("UPDATE vendor_profiles SET risk_tier='high',tier_basis=?,revision=revision+1,updated_by=?,updated_at=? WHERE vendor_id=?").bind('Named reviewer approved report exceptions or a modified opinion; review '+id,actor.name,at,vendor))}
 }
 statements.push(auditStatement(env,actor,'vendor.review-'+decision,'vendor:'+vendor,now,'succeeded','reviewer '+reviewer.name,{reason,revision:row.snapshot_hash}))
 await env.DB.batch(statements)
 return reviewData(env,vendor,id,now)
}
export async function vendorObligations(env:Bindings) {
 // Only the latest approved revision of each document contributes obligations.
 return (await env.DB.prepare("SELECT c.*,v.name AS vendor_name FROM vendor_cuecs c JOIN vendors v ON v.id=c.vendor_id JOIN vendor_document_reviews r ON r.id=c.review_id WHERE r.revision=(SELECT max(r2.revision) FROM vendor_document_reviews r2 JOIN vendor_review_decisions d ON d.review_id=r2.id WHERE r2.document_id=c.document_id AND d.decision='approved') ORDER BY c.decided_at,c.id").all<any>()).results
}
