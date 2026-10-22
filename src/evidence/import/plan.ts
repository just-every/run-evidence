import type { Bindings } from '../../auth.server'
import { cadences, groups, validDate } from '../model'
import { Refusal } from '../upload'
import type { ImportMapping, Json, SourceBundle } from './base/types'
import { canonicalJson, sha256 } from './base/provenance/identity'
import { artifact, payloadHash, type ParsedArchive } from './manifest'
import type { Mapping, Review, ControlValue, ReceiptValue } from './types'
export const MAPPING_VERSION='drata-evidence-1'
export const targetId=(review:string,kind:string,id:string)=>{const h=sha256(canonicalJson([review,kind,id])).slice(0,32);return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`}
const field=(value:unknown,label:string)=>{if(typeof value!=='string'||!value.trim()||value.length>300)throw new Refusal('Provide '+label+' (up to 300 characters).');return value.trim()}
export async function validateMapping(env:Bindings,parsed:ParsedArchive,input:unknown):Promise<Mapping[]>{
 if(!Array.isArray(input)||input.length!==parsed.manifest.controls.length)throw new Refusal('Review one mapping for every source control.')
 const seen=new Set<string>(),result:Mapping[]=[]
 for(const m of input){
  if(!m||typeof m!=='object'||!parsed.manifest.controls.some(c=>c.id===m.source_id)||seen.has(m.source_id))throw new Refusal('Mapping contains an unknown or duplicate control.');seen.add(m.source_id)
  if(m.action==='skip'){result.push({source_id:m.source_id,action:'skip'});continue}
  if(!validDate(m.covered_from)||!validDate(m.covered_to)||m.covered_from>m.covered_to)throw new Refusal('Assign a real historical coverage period for each included control. These are owner claims, not Drata timestamps.')
  const coverage={covered_from:m.covered_from,covered_to:m.covered_to}
  if(m.action==='existing'){
   if(typeof m.requirement_id!=='string'||!await env.DB.prepare('SELECT id FROM requirements WHERE id=?').bind(m.requirement_id).first())throw new Refusal('Choose an existing proof requirement.')
   result.push({source_id:m.source_id,action:'existing',requirement_id:m.requirement_id,...coverage});continue
  }
  if(m.action!=='create'||!(groups as readonly string[]).includes(m.group)||!(cadences as readonly string[]).includes(m.cadence))throw new Refusal('Choose a mapping action, listed group and cadence.')
  result.push({source_id:m.source_id,action:'create',name:field(m.name,'a control in plain words'),proof:field(m.proof,'named proof'),group:m.group,cadence:m.cadence,...coverage})
 }
 return parsed.manifest.controls.map(c=>result.find(m=>m.source_id===c.id)!)
}
export function importInputs(review:Review,parsed:ParsedArchive,mapping:Mapping[]){
 const manifest=parsed.manifest,namespace='drata-package:'+review.archive_sha256,artifactHash=sha256(parsed.manifestBytes)
 const source:SourceBundle={records:[],artifacts:[artifact('audit.zip',parsed.archive),artifact('evidence_manifest.html',parsed.manifestBytes)],diagnostics:parsed.summary.missing.map(path=>({severity:'warning',code:'MISSING_FILE',message:'Referenced bytes missing: '+path}))}
 const record=(kind:string,id:string,payload:unknown)=>source.records.push({namespace,kind,sourceId:id,payload:payload as Json,payloadHash:payloadHash(payload),artifactHash,location:{artifact:'evidence_manifest.html',pointer:kind+'/'+id}})
 for(const c of manifest.controls){record('control',c.id,{id:c.id,name:c.name});for(const e of c.evidence)record('evidence',e.id,{...e,control_id:c.id,sha256:parsed.files.has(e.path)?sha256(parsed.files.get(e.path)!):null})}
 const importer:ImportMapping={version:MAPPING_VERSION,map(record){
  const payload=record.payload as Record<string,any>,controlId=record.kind==='control'?record.sourceId:payload.control_id,m=mapping.find(x=>x.source_id===controlId)!
  if(m.action==='skip')return{effects:[],unmapped:[{reason:'Owner excluded this source control.'}]}
  const control=targetId(review.id,'control',controlId),requirement=m.action==='existing'?m.requirement_id!:targetId(review.id,'requirement',controlId)
  if(record.kind==='control'){
   if(m.action==='existing')return{effects:[],unmapped:[{reason:'Owner mapped evidence to existing proof requirement '+requirement+'. No control added.'}]}
   const value:ControlValue={review_id:review.id,control_id:control,requirement_id:requirement,name:m.name!,group:m.group!,proof:m.proof!,cadence:m.cadence!,created_at:review.staged_at}
   return{effects:[{targetKind:'control',targetId:control,value:value as unknown as Json}]}
  }
  const bytes=parsed.files.get(payload.path)
  if(!bytes)return{effects:[],rejection:'Referenced file is missing from the ZIP. No receipt issued.'}
  const id=targetId(review.id,'receipt',record.sourceId),exhibit=targetId(review.id,'exhibit',record.sourceId)
  const value:ReceiptValue={review_id:review.id,receipt_id:id,requirement_id:requirement,exhibit_id:exhibit,object_key:'exhibits/'+exhibit,filename:payload.original_path.split(/[\\/]/).at(-1).slice(0,240),size:bytes.length,sha256:sha256(bytes),source:('Historical Drata import; owner-assigned coverage; '+payload.source).slice(0,1000),covered_from:m.covered_from!,covered_to:m.covered_to!,added_by:review.actor_id,added_by_name:review.actor_name,added_at:review.staged_at,source_collected_at:payload.collected_at,source_exported_at:manifest.exported_at,source_id:record.sourceId,source_path:payload.path,archive_sha256:review.archive_sha256}
  return{effects:[{targetKind:'receipt',targetId:id,value:value as unknown as Json}]}
 }}
 return{source,mapping:importer,namespace}
}
