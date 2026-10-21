import type { Bindings } from '../../auth.server'
import { text,oneOf,auditStatement,type Actor,type Input } from '../door'
import { Refusal } from '../upload'
import { sha } from '../archive/format'
import { documentBytes,documents } from '../vendor/storage'
import type { Extraction } from '../vendor/review-model'
export interface Source {id:string;kind:string;source_id:string;quote:string;revision:string;period_from:string;period_to:string;state:string;href:string;fingerprint:string}
export async function resolveSource(env:Bindings,kind:string,id:string,quote:string,now:Date,chain=new Set<string>()):Promise<Omit<Source,'id'>> {
 const key=kind+':'+id
 if(chain.has(key)||chain.size>=16)throw new Refusal('The approved-answer citation chain is cyclic or exceeds 16 levels.',409)
 chain=new Set([...chain,key])
 let body='',revision='',from='',to='',state='',href=''
 if(kind==='policy'){
  const p=await env.DB.prepare("SELECT r.*,p.title FROM policy_revisions r JOIN policies p ON p.id=r.policy_id WHERE r.id=? AND r.status IN ('approved','published') AND r.approved_sha256=r.body_sha256 AND NOT EXISTS(SELECT 1 FROM policy_revisions n WHERE n.policy_id=r.policy_id AND n.version>r.version AND n.status IN ('approved','published'))").bind(id).first<any>()
  if(!p)throw new Refusal('Select an exact approved policy revision.',409)
  body=p.body;revision=p.body_sha256;from=p.effective_date??p.decided_at.slice(0,10);to=p.review_due??'';state='approved';href=`/app/policies/${p.policy_id}/revisions/${p.id}`
 }else if(kind==='observation'){
  const o=await env.DB.prepare('SELECT * FROM observations WHERE id=?').bind(id).first<any>();if(!o)throw new Refusal('Observation not found.',404)
  body=JSON.stringify({result:o.result,expected:o.expected_json,actual:o.actual_json,reason:o.reason});revision=await sha(new TextEncoder().encode(JSON.stringify(o)));from=o.interval_from??o.observed_at;to=o.observed_at;state=o.result;href='/app/tests/'+o.test_id
 }else if(kind==='audit-report'){
  const r=await env.DB.prepare("SELECT r.* FROM vendor_document_reviews r JOIN vendor_review_decisions d ON d.review_id=r.id WHERE r.id=? AND d.decision='approved' AND NOT EXISTS(SELECT 1 FROM vendor_document_reviews n WHERE n.document_id=r.document_id AND n.revision>r.revision)").bind(id).first<any>()
  if(!r)throw new Refusal('Choose the latest exact approved SOC report review.',409)
  const doc=(await documents(env,r.vendor_id)).find(d=>d.id===r.document_id),snapshot=JSON.parse(r.snapshot_json) as Extraction
  if(!doc||!['soc1','soc2'].includes(doc.kind)||doc.sha256!==snapshot.document_sha256||!await documentBytes(env,doc)||await env.DB.prepare('SELECT 1 FROM vendor_documents WHERE supersedes=?').bind(doc.id).first())throw new Refusal('The approved report was superseded or its original bytes are unavailable.',409)
  const page=snapshot.pages.findIndex(p=>p.includes(quote));if(page<0)throw new Refusal('The passage is absent from the approved report.')
  body=snapshot.pages[page];revision=r.snapshot_hash+':'+doc.sha256
  const period=snapshot.fields.find(f=>f.kind==='period')?.value??'',dates=period.match(/\d{4}-\d\d-\d\d/g)
  from=dates?.[0]??period;to=dates?.at(-1)??''
  state=snapshot.fields.some(f=>(f.kind==='exception'||(f.kind==='opinion'&&f.value!=='unqualified'))&&(f.quote.includes(quote)||quote.includes(f.quote)))?'fail':'approved'
  href=`/app/vendors/${r.vendor_id}/document-reviews/${id}/pages/${page+1}`
 }else if(kind==='approved-answer'){
  const draft=id.slice(0,36),qid=id.slice(37)
  if(id[36]!==':'||!qid)throw new Refusal('Choose a prior answer as draftId:questionId.')
  const d=await env.DB.prepare('SELECT d.*,a.snapshot_hash AS approved_hash,a.expires_on FROM questionnaire_drafts d JOIN questionnaire_approvals a ON a.draft_id=d.id WHERE d.id=? AND NOT EXISTS(SELECT 1 FROM questionnaire_drafts n WHERE n.questionnaire_id=d.questionnaire_id AND n.revision>d.revision)').bind(draft).first<any>()
  if(!d||d.snapshot_hash!==d.approved_hash||d.expires_on<now.toISOString().slice(0,10))throw new Refusal('The prior answer must have a current exact approval.',409)
  const answer=JSON.parse(d.snapshot_json).answers.find((a:any)=>a.id===qid)
  if(!answer||answer.state!=='cited'||!answer.citations.length)throw new Refusal('Only a cited approved answer can be reused.',409)
  await assertSources(env,answer.citations,now,chain)
  body=answer.answer;revision=d.snapshot_hash;from=answer.citations.map((c:Source)=>c.period_from).filter(Boolean).sort()[0]??'';to=answer.citations.map((c:Source)=>c.period_to).filter(Boolean).sort().at(-1)??'';state='approved';href=`/app/questionnaires/${d.questionnaire_id}/drafts/${draft}`
 }else throw new Refusal('Choose an approved policy, observation, approved SOC report review or prior cited approved answer.')
 if(!body.includes(quote))throw new Refusal('The passage is not present in this authorized source revision.')
 const value={kind,source_id:id,quote,revision,period_from:from,period_to:to,state,href};return {...value,fingerprint:await sha(new TextEncoder().encode(JSON.stringify(value)))}
}
export async function addSource(env:Bindings,input:Input,actor:Actor,now:Date){const kind=oneOf(input,'kind',['policy','observation','audit-report','approved-answer'] as const),sid=text(input,'source_id',512),quote=text(input,'quote',10000);await resolveSource(env,kind,sid,quote,now);const id=crypto.randomUUID();await env.DB.batch([env.DB.prepare('INSERT INTO questionnaire_sources VALUES(?,?,?,?,?,?)').bind(id,kind,sid,quote,actor.name,now.toISOString()),auditStatement(env,actor,'questionnaire.source-selected','questionnaire-source:'+id,now)]);return {id}}
export async function sources(env:Bindings,now:Date):Promise<Source[]> {
 const rows=(await env.DB.prepare('SELECT * FROM questionnaire_sources ORDER BY registered_at,rowid').all<any>()).results,out:Source[]=[]
 for(const r of rows){try{out.push({id:r.id,...await resolveSource(env,r.kind,r.source_id,r.quote,now)})}catch(error){if(!(error instanceof Refusal))throw error}}
 return out
}
export async function assertSources(env:Bindings,citations:Source[],now:Date,chain?:Set<string>) {for(const c of citations){let live;try{live=await resolveSource(env,c.kind,c.source_id,c.quote,now,chain)}catch{throw new Refusal('A cited source is no longer approved or available. Draft again and obtain a new decision.',409)}if(live.fingerprint!==c.fingerprint)throw new Refusal('A cited revision or period changed. Draft again and obtain a new decision.',409)}}
