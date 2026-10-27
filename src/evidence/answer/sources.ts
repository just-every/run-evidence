import {sourceAuthorities,sourceAuthorityGap} from '../connect/source-authority'
import type { Bindings } from '../../auth.server'
import { text,oneOf,auditStatement,type Actor,type Input } from '../door'
import { Refusal } from '../upload'
import { sha } from '../archive/format'
import { documentBytes,documents } from '../vendor/storage'
import { receipt,storedBytes } from '../storage'
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
  if(p.review_due&&p.review_due<now.toISOString().slice(0,10))throw new Refusal('The policy review is overdue.',409)
  body=p.body;revision=p.body_sha256;from=p.effective_date??p.decided_at.slice(0,10);to=p.review_due??'';state='approved';href=`/app/policies/${p.policy_id}/revisions/${p.id}`
 }else if(kind==='observation'){
  const o=await env.DB.prepare('SELECT * FROM observations WHERE id=?').bind(id).first<any>();if(!o)throw new Refusal('Observation not found.',404)
  await currentObservation(env,o,now)
  body=JSON.stringify({result:o.result,expected:o.expected_json,actual:o.actual_json,reason:o.reason});revision=await sha(new TextEncoder().encode(JSON.stringify(o)));from=o.interval_from??o.observed_at;to=o.observed_at;state=o.result;href='/app/tests/'+o.test_id
 }else if(kind==='control'){
  const control=await env.DB.prepare('SELECT * FROM controls WHERE id=?').bind(id).first<any>()
  if(!control)throw new Refusal('Control not found.',404)
  const tests=(await env.DB.prepare('SELECT t.* FROM tests t JOIN test_controls c ON c.test_id=t.id WHERE c.control_id=? ORDER BY t.id').bind(id).all<any>()).results
  if(!tests.length)throw new Refusal('The control has no passing automated evidence.',409)
  const observations=[]
  for(const test of tests){
   const rows=(await env.DB.prepare('SELECT o.* FROM observations o WHERE o.test_id=? AND o.run_id=(SELECT id FROM test_runs WHERE test_id=? ORDER BY started_at DESC,rowid DESC LIMIT 1) ORDER BY resource_id').bind(test.id,test.id).all<any>()).results
   if(!rows.length||rows.some(o=>o.result!=='pass'))throw new Refusal('The control has failed, unknown or absent evidence.',409)
   for(const o of rows)await currentObservation(env,o,now)
   observations.push(...rows)
  }
  const definitions=(await env.DB.prepare('SELECT * FROM control_revisions WHERE control_id=? ORDER BY revision').bind(id).all()).results
  const scope=(await env.DB.prepare('SELECT * FROM control_scope WHERE control_id=? ORDER BY effective_at,rowid').bind(id).all()).results
  body=control.name;revision=await sha(new TextEncoder().encode(JSON.stringify({control,definitions,tests,observations,scope})));state='pass';href='/app/controls/'+id;from=observations.map(o=>o.observed_at).sort()[0];to=observations.map(o=>o.observed_at).sort().at(-1)??''
 }else if(kind==='exhibit'){
  const row=await receipt(env,id)
  if(!row||!await storedBytes(env,row))throw new Refusal('The cited exhibit bytes are unavailable.',409)
  if(await env.DB.prepare('SELECT 1 FROM receipts WHERE supersedes=?').bind(id).first())throw new Refusal('The exhibit was superseded.',409)
  body=row.filename;revision=await sha(new TextEncoder().encode(JSON.stringify(row)));state='approved';href='/app/receipts/'+id
 }else if(kind==='audit-period'){
  const row=await env.DB.prepare('SELECT * FROM programs WHERE id=?').bind(id).first<any>()
  if(!row)throw new Refusal('Program audit period not found.',404)
  body=JSON.stringify(row);revision=await sha(new TextEncoder().encode(body));state='approved';href='/app/programs/'+id;from=row.audit_from??'';to=row.audit_to??''
 }else if(kind==='obligation'){
  const row=await env.DB.prepare("SELECT o.*,d.snapshot_hash,d.policy_revision_id FROM tailored_obligations o JOIN tailoring_decisions d ON d.proposal_id=o.proposal_id WHERE o.id=? AND d.decision='approved'").bind(id).first<any>()
  if(!row)throw new Refusal('Approved customer obligation not found.',404)
  const proposal=await env.DB.prepare('SELECT * FROM tailoring_proposals WHERE id=?').bind(row.proposal_id).first<any>(),snapshot=JSON.parse(proposal.snapshot_json)
  const requirement=await env.DB.prepare('SELECT * FROM custom_framework_requirements WHERE id=? AND removed_at IS NULL').bind(proposal.requirement_id).first<any>()
  if(!requirement||['ref','title','description','section'].some(k=>requirement[k]!==snapshot.context.requirement[k]))throw new Refusal('The customer contract requirement changed. Review a new obligation.',409)
  body=row.body;revision=await sha(new TextEncoder().encode(JSON.stringify(row)));state='approved';href='/app/tailoring/'+row.proposal_id
 }else if(kind==='audit-report'){
  const r=await env.DB.prepare("SELECT r.* FROM vendor_document_reviews r JOIN vendor_review_decisions d ON d.review_id=r.id WHERE r.id=? AND d.decision='approved' AND NOT EXISTS(SELECT 1 FROM vendor_document_reviews n WHERE n.document_id=r.document_id AND n.revision>r.revision)").bind(id).first<any>()
  if(!r)throw new Refusal('Choose the latest exact approved SOC report review.',409)
  const doc=(await documents(env,r.vendor_id)).find(d=>d.id===r.document_id),snapshot=JSON.parse(r.snapshot_json) as Extraction
  if(!doc||!['soc1','soc2'].includes(doc.kind)||doc.sha256!==snapshot.document_sha256||!await documentBytes(env,doc)||await env.DB.prepare('SELECT 1 FROM vendor_documents WHERE supersedes=?').bind(doc.id).first())throw new Refusal('The approved report was superseded or its original bytes are unavailable.',409)
  const page=snapshot.pages.findIndex(p=>p.includes(quote));if(page<0)throw new Refusal('The passage is absent from the approved report.')
  body=snapshot.pages[page];revision=r.snapshot_hash+':'+doc.sha256
  const period=snapshot.fields.find(f=>f.kind==='period')?.value??'',dates=period.match(/\d{4}-\d\d-\d\d/g)
  if(!period.trim())throw new Refusal('Review a cited report period or as-of date before using this report as an answer source.',409)
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
  await (await import('../agent/promises')).assertDependencies(env,'answer',draft,now,undefined,chain)
  await assertSources(env,answer.citations,now,chain)
  body=answer.answer;revision=d.snapshot_hash;from=answer.citations.map((c:Source)=>c.period_from).filter(Boolean).sort()[0]??'';to=answer.citations.map((c:Source)=>c.period_to).filter(Boolean).sort().at(-1)??'';state='approved';href=`/app/questionnaires/${d.questionnaire_id}/drafts/${draft}`
 }else throw new Refusal('Choose a supported exact promise source.')
 if(!body.includes(quote))throw new Refusal('The passage is not present in this authorized source revision.')
 const value={kind,source_id:id,quote,revision,period_from:from,period_to:to,state,href};return {...value,fingerprint:await sha(new TextEncoder().encode(JSON.stringify(value)))}
}
export async function addSource(env:Bindings,input:Input,actor:Actor,now:Date){const kind=oneOf(input,'kind',['policy','observation','audit-report','approved-answer','control','exhibit','audit-period','obligation'] as const),sid=text(input,'source_id',512),quote=text(input,'quote',10000);await resolveSource(env,kind,sid,quote,now);const id=crypto.randomUUID();await env.DB.batch([env.DB.prepare('INSERT INTO questionnaire_sources VALUES(?,?,?,?,?,?)').bind(id,kind,sid,quote,actor.name,now.toISOString()),auditStatement(env,actor,'questionnaire.source-selected','questionnaire-source:'+id,now)]);return {id}}
export async function sources(env:Bindings,now:Date):Promise<Source[]> {
 const rows=(await env.DB.prepare('SELECT * FROM questionnaire_sources ORDER BY registered_at,rowid').all<any>()).results,out:Source[]=[]
 for(const r of rows){try{out.push({id:r.id,...await resolveSource(env,r.kind,r.source_id,r.quote,now)})}catch(error){if(!(error instanceof Refusal))throw error}}
 return out
}
export async function assertSources(env:Bindings,citations:Source[],now:Date,chain?:Set<string>) {for(const c of citations){let live;try{live=await resolveSource(env,c.kind,c.source_id,c.quote,now,chain)}catch{throw new Refusal('A cited source is no longer approved or available. Draft again and obtain a new decision.',409)}if(live.fingerprint!==c.fingerprint)throw new Refusal('A cited revision or period changed. Draft again and obtain a new decision.',409)}}

// An immutable historical observation remains readable, but is no longer a
// current promise source after a newer result, definition or expiry.
async function currentObservation(env:Bindings,o:any,now:Date){
 const test=await env.DB.prepare('SELECT * FROM tests WHERE id=?').bind(o.test_id).first<any>()
 const latest=await env.DB.prepare('SELECT id FROM observations WHERE test_id=? AND resource_id=? ORDER BY observed_at DESC,rowid DESC LIMIT 1').bind(o.test_id,o.resource_id).first<{id:string}>()
 const resource=await env.DB.prepare('SELECT * FROM resources WHERE id=? AND removed_at IS NULL').bind(o.resource_id).first<any>()
 if(resource?.source_kind==='source-observed'&&(sourceAuthorityGap(resource.source_ref,await sourceAuthorities(env))||!resource.observed_at))throw new Refusal('The source read authority is no longer current.',409)
 const cadence=test?.cadence==='hourly'?3600000:test?.cadence==='daily'?86400000:0
 if(resource?.source_kind==='source-observed'&&resource.observed_at&&now.getTime()-Date.parse(resource.observed_at)>cadence*1.5+3600000)throw new Refusal('The provider source read is stale.',409)
 if(!test?.enabled||test.revision!==o.revision||latest?.id!==o.id||!resource||!cadence||now.getTime()-Date.parse(o.observed_at)>cadence*1.5+3600000)throw new Refusal('The cited observation is superseded, stale or no longer in scope. Prepare a fresh cited revision.',409)
}
