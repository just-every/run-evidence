import { sha,fail } from './format'
import { pages,staged,type Store } from './registry'
import { validateExtraction } from '../vendor/review-model'
export async function validateFeatureRecords(env:Store,id:string) {
 const t=(name:string)=>staged(id,name)
 for(const table of ['privacy_requests','vendor_document_reviews'])for await(const rows of pages(env,table,t(table)))for(const r of rows){
  if(typeof r.snapshot_json!=='string'||await sha(new TextEncoder().encode(r.snapshot_json))!==r.snapshot_hash)fail('Retained review fingerprint does not match.')
  let value:any;try{value=JSON.parse(r.snapshot_json)}catch{fail('Invalid retained review JSON.')}
  if(table==='privacy_requests'){if(value.kind!==r.kind||value.subject!==r.subject_id||!['preview','pending','complete'].includes(String(r.state)))fail('Invalid retained erasure scope.')}
  else {
   try{validateExtraction(value)}catch{fail('Invalid page citation in retained vendor review.')}
   const doc=await env.DB.prepare(`SELECT sha256,vendor_id FROM ${t('vendor_documents')} WHERE id=?`).bind(r.document_id).first<{sha256:string;vendor_id:string}>()
   if(!doc||doc.vendor_id!==r.vendor_id||value.document_id!==r.document_id||value.document_sha256!==doc.sha256)fail('Vendor review contradicts original custody.')
  }
 }
 if(await env.DB.prepare(`SELECT 1 FROM ${t('vendor_review_decisions')} d JOIN ${t('vendor_document_reviews')} r ON r.id=d.review_id WHERE d.snapshot_hash<>r.snapshot_hash LIMIT 1`).first())fail('Vendor decision does not approve its exact proposal.')
 if(await env.DB.prepare(`SELECT 1 FROM ${t('privacy_erased_exhibits')} e JOIN ${t('privacy_requests')} r ON r.id=e.request_id WHERE r.kind<>'exhibit' OR r.subject_id<>e.exhibit_id OR r.state NOT IN ('pending','complete') LIMIT 1`).first())fail('Invalid retained erasure tombstone.')
}
