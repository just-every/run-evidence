import { validateManifestArchive } from '../connect/manifest-archive'
import { sha,fail } from './format'
import { pages,staged,type Store } from './registry'
import { validateExtraction } from '../vendor/review-model'
import { choiceValues } from '../answer/format'
export async function validateFeatureRecords(env:Store,id:string) {
 await validateManifestArchive(env,id)
 const t=(name:string)=>staged(id,name)
 for(const table of ['privacy_requests','vendor_document_reviews','questionnaire_drafts','tailoring_proposals'])for await(const rows of pages(env,table,t(table)))for(const r of rows){
  if(typeof r.snapshot_json!=='string'||await sha(new TextEncoder().encode(r.snapshot_json))!==r.snapshot_hash)fail('Retained review fingerprint does not match.')
  let value:any;try{value=JSON.parse(r.snapshot_json)}catch{fail('Invalid retained review JSON.')}
  if(table==='privacy_requests'){if(value.kind!==r.kind||value.subject!==r.subject_id||!['preview','pending','complete'].includes(String(r.state)))fail('Invalid retained erasure scope.')}
  else if(table==='questionnaire_drafts') {
   const q=await env.DB.prepare(`SELECT questions_json,sha256 FROM ${t('questionnaires')} WHERE id=?`).bind(r.questionnaire_id).first<{questions_json:string;sha256:string}>()
   if(!q||JSON.stringify(value.questions)!==q.questions_json||value.template_sha256!==q.sha256||!Array.isArray(value.answers)||value.answers.length!==value.questions.length)fail('Questionnaire draft contradicts its retained template.')
   const stats={cited:0,flagged:0,conflicting:0,total:value.answers.length}
   for(const [i,a]of value.answers.entries()){
    if(a.id!==value.questions[i].id||!['cited','flagged','conflicting'].includes(a.state)||!Array.isArray(a.citations))fail('Invalid retained questionnaire answer.')
    stats[a.state as 'cited'|'flagged'|'conflicting']++
    if(a.state==='cited'&&(!a.citations.length||(a.mapping?(!choiceValues(value.questions[i].format).includes(a.answer)||a.mapping.value!==a.answer||a.mapping.format!==value.questions[i].format||(typeof a.mapping.reason!=='string'||!a.mapping.reason.trim())):a.answer!==a.citations.map((c:any)=>c.quote).join('\n\n')))||a.state!=='cited'&&a.answer!=='')fail('Uncited retained questionnaire answer.')
    for(const c of a.citations){
     let expected=''
     if(c.kind==='policy'){const p=await env.DB.prepare(`SELECT policy_id,body,body_sha256 FROM ${t('policy_revisions')} WHERE id=?`).bind(c.source_id).first<any>();if(!p||p.body_sha256!==c.revision||!p.body.includes(c.quote))fail('Invalid retained policy citation.');expected=`/app/policies/${p.policy_id}/revisions/${c.source_id}`}
     else if(c.kind==='observation'){const o=await env.DB.prepare(`SELECT test_id FROM ${t('observations')} WHERE id=?`).bind(c.source_id).first<any>();if(!o)fail('Missing retained observation citation.');expected='/app/tests/'+o.test_id}
     else if(c.kind==='audit-report'){
      const r=await env.DB.prepare(`SELECT r.vendor_id,r.document_id,r.snapshot_json,r.snapshot_hash FROM ${t('vendor_document_reviews')} r JOIN ${t('vendor_review_decisions')} d ON d.review_id=r.id AND d.decision='approved' AND d.snapshot_hash=r.snapshot_hash WHERE r.id=?`).bind(c.source_id).first<any>()
      if(!r)fail('Missing retained SOC report review.')
      const s=JSON.parse(r.snapshot_json),page=s.pages.findIndex((p:string)=>p.includes(c.quote))
      if(page<0||c.revision!==r.snapshot_hash+':'+s.document_sha256)fail('Invalid retained SOC report passage.')
      expected=`/app/vendors/${r.vendor_id}/document-reviews/${c.source_id}/pages/${page+1}`
     }else if(c.kind==='approved-answer'){
      const id=c.source_id.slice(0,36),qid=c.source_id.slice(37),d=await env.DB.prepare(`SELECT d.questionnaire_id,d.snapshot_json,d.snapshot_hash FROM ${t('questionnaire_drafts')} d JOIN ${t('questionnaire_approvals')} a ON a.draft_id=d.id AND a.snapshot_hash=d.snapshot_hash WHERE d.id=?`).bind(id).first<any>()
      const a=d?JSON.parse(d.snapshot_json).answers.find((a:any)=>a.id===qid):null
      if(c.source_id[36]!==':'||!d||!a||a.state!=='cited'||!a.answer.includes(c.quote)||d.snapshot_hash!==c.revision)fail('Invalid retained approved-answer passage.')
      expected=`/app/questionnaires/${d.questionnaire_id}/drafts/${id}`
     }else fail('Unknown questionnaire citation kind.')
     if(c.href!==expected)fail('Questionnaire citation must use its exact owner source door.')
    }
   }
   if(JSON.stringify(stats)!==JSON.stringify(value.stats))fail('Questionnaire answer counts do not reconcile.')
  }else if(table==='tailoring_proposals'){
   if(!value.context||!value.context.requirement||value.context.requirement.id!==r.requirement_id||value.context.framework.id!==r.framework_id||await sha(new TextEncoder().encode(JSON.stringify(value.context)))!==value.context_hash||!Array.isArray(value.citations)||value.citations.length!==2)fail('Invalid retained tailoring context.')
   for(const [i,c]of value.citations.entries()){const q=i===0?value.context.requirement:value.context.material,framework=i===0?value.context.framework.id:value.context.material.framework_id;if(c.href!==`/app/frameworks/${framework}/requirements/${q.id}`||c.passage!==(q.description||q.title)||c.kind!==(i===0?'contract-promise':'framework-requirement'))fail('Invalid retained tailoring source door.')}
   if(value.mapping.requirement_id!==r.requirement_id||value.mapping.control_id!==value.context.control.id||value.policy_diff.before!==value.context.policy.body)fail('Tailoring proposal contradicts its exact sources.')
  }else {
   try{validateExtraction(value)}catch{fail('Invalid page citation in retained vendor review.')}
   const doc=await env.DB.prepare(`SELECT sha256,vendor_id FROM ${t('vendor_documents')} WHERE id=?`).bind(r.document_id).first<{sha256:string;vendor_id:string}>()
   if(!doc||doc.vendor_id!==r.vendor_id||value.document_id!==r.document_id||value.document_sha256!==doc.sha256)fail('Vendor review contradicts original custody.')
  }
 }
 for(const [decision,proposal,key]of [['questionnaire_approvals','questionnaire_drafts','draft_id'],['tailoring_decisions','tailoring_proposals','proposal_id']])if(await env.DB.prepare(`SELECT 1 FROM ${t(decision)} d JOIN ${t(proposal)} p ON p.id=d.${key} WHERE d.snapshot_hash<>p.snapshot_hash LIMIT 1`).first())fail('Retained approval does not name its exact proposal.')
 if(await env.DB.prepare(`SELECT 1 FROM ${t('vendor_review_decisions')} d JOIN ${t('vendor_document_reviews')} r ON r.id=d.review_id WHERE d.snapshot_hash<>r.snapshot_hash LIMIT 1`).first())fail('Vendor decision does not approve its exact proposal.')
 if(await env.DB.prepare(`SELECT 1 FROM ${t('privacy_erased_exhibits')} e JOIN ${t('privacy_requests')} r ON r.id=e.request_id WHERE r.kind<>'exhibit' OR r.subject_id<>e.exhibit_id OR r.state NOT IN ('pending','complete') LIMIT 1`).first())fail('Invalid retained erasure tombstone.')
}
