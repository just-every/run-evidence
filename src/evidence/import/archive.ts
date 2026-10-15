import type { Bindings } from '../../auth.server'
import { Refusal } from '../upload'
import type { D1Sql } from './base/d1/types'
import { canonicalJson, sha256 } from './base/provenance/identity'
import { planFingerprint } from './base/plan/index'
import { importTableColumns, importRestoreTriggers } from './archive-schema'
export { importTableColumns, importRestoreTriggers }
export interface ImportFile { path:string; object_key:string; size:number; sha256:string; available:boolean }
export interface ImportInventory { rows:Record<string,Record<string,any>[]>; files:ImportFile[] }
const blob=(table:string,column:string)=>column==='bytes'&&['ik_originals','ik_d1_original_chunks','ik_stages'].includes(table)
const bad=():never=>{throw new Refusal('Invalid retained import inventory.',400)}
export async function importInventory(env:Bindings):Promise<ImportInventory>{
 const rows:ImportInventory['rows']={}
 for(const [table,columns]of Object.entries(importTableColumns)){
  const select=columns.map(c=>blob(table,c)?`CASE WHEN ${c} IS NULL THEN NULL ELSE hex(${c}) END AS ${c}`:c).join(',')
  rows[table]=(await env.DB.prepare(`SELECT ${select} FROM ${table} ORDER BY ${columns.map((_,i)=>i+1).join(',')}`).all()).results
 }
 const files:ImportFile[]=[]
 for(const review of rows.import_reviews){const stored=await env.EXHIBITS.get(review.object_key);let available=false;if(stored){const bytes=new Uint8Array(await stored.arrayBuffer());available=bytes.length===review.archive_size&&sha256(bytes)===review.archive_sha256}files.push({path:'import-sources/'+review.id,object_key:review.object_key,size:review.archive_size,sha256:review.archive_sha256,available})}
 return{rows,files}
}
export function validateImportInventory(value:unknown):asserts value is ImportInventory{
 const v=value as ImportInventory
 if(!v||typeof v!=='object'||!v.rows||typeof v.rows!=='object'||!Array.isArray(v.files)||Object.keys(v.rows).length!==Object.keys(importTableColumns).length)bad()
 for(const [table,columns]of Object.entries(importTableColumns)){
  const rows=v.rows[table];if(!Array.isArray(rows)||rows.length>20000)bad()
  const seen=new Set<string>()
  for(const candidate of rows){const row=candidate as Record<string,any>;if(!row||typeof row!=='object'||Array.isArray(row)||Object.keys(row).sort().join('\0')!==[...columns].sort().join('\0'))bad()
   for(const c of columns){const item=(row as Record<string,any>)[c];if(item!==null&&typeof item!=='string'&&!(typeof item==='number'&&Number.isFinite(item)))bad();if(blob(table,c)&&item!==null&&(typeof item!=='string'||! /^(?:[0-9A-F]{2})*$/.test(item)))bad()}
   const key=canonicalJson(row);if(seen.has(key))bad();seen.add(key)
  }
 }
 const reviewIds=new Set(v.rows.import_reviews.map(r=>r.id)),jobs=new Map(v.rows.ik_jobs.map(r=>[r.id,r]))
 for(const r of v.rows.import_reviews){
  if(typeof r.id!=='string'||!/^[a-f0-9-]{36}$/.test(r.id)||r.object_key!=='import-sources/'+r.id||!/^[a-f0-9]{64}$/.test(r.archive_sha256)||!Number.isSafeInteger(r.archive_size)||r.archive_size<1||(r.job_id!==null&&!jobs.has(r.job_id))||(r.job_id!==null&&!r.approved_at))bad()
  let summary:any;try{summary=JSON.parse(r.summary_json);if(r.mapping_json!==null)JSON.parse(r.mapping_json)}catch{bad()}
  if(summary.archive_sha256!==r.archive_sha256)bad()
 }
 if(v.files.length!==v.rows.import_reviews.length||new Set(v.files.map(f=>f.path)).size!==v.files.length)bad()
 for(const f of v.files){const r=v.rows.import_reviews.find(r=>r.object_key===f.object_key);if(!r||f.path!=='import-sources/'+r.id||f.size!==r.archive_size||f.sha256!==r.archive_sha256||typeof f.available!=='boolean')bad()}
 for(const r of v.rows.import_additions){if(!['control','receipt'].includes(r.kind)||!reviewIds.has(r.review_id))bad();try{const val=JSON.parse(r.value_json);if(val.review_id!==r.review_id||(r.kind==='control'?val.control_id:val.receipt_id)!==r.id)bad()}catch{bad()}}
 for(const r of v.rows.import_active){const a=v.rows.import_additions.find(a=>a.kind===r.kind&&a.id===r.id);if(!a||a.value_json!==r.value_json||typeof r.revision!=='string')bad()}
 // Validate each retained plan's exact envelope and job binding. Its domain
 // targets remain inert on restore; no source mapping or job execution occurs.
 for(const j of jobs.values()){
  let p:any;try{p=JSON.parse(j.plan_json);if(p?.d1Plan===1){const chunks=v.rows.ik_d1_plan_chunks.filter(r=>r.job_id===j.id).sort((a,b)=>a.ordinal-b.ordinal);if(chunks.length!==p.chunks||chunks.some((r,i)=>r.ordinal!==i))bad();const body=chunks.map(r=>r.body).join('');if(new TextEncoder().encode(body).length!==p.size||sha256(body)!==p.sha256)bad();p=JSON.parse(body)}
   if(p.version!==1||p.fingerprint!==j.fingerprint||planFingerprint(p)!==j.fingerprint||p.destination!==j.destination||p.namespace!==j.namespace||p.mappingVersion!==j.mapping_version||p.principalId!==j.principal_id||p.entries.length!==j.total)bad()
  }catch{bad()}
 }
}
export function restoreImportStatements(inventory:ImportInventory):D1Sql[]{
 validateImportInventory(inventory)
 const statements:D1Sql[]=importRestoreTriggers.map(t=>({sql:`DROP TRIGGER IF EXISTS ${t.name}`}))
 for(const [table,columns]of Object.entries(importTableColumns))for(const row of inventory.rows[table]){
  const params=columns.map(c=>blob(table,c)&&row[c]!==null?Uint8Array.from((row[c] as string).match(/../g)||[],x=>parseInt(x,16)).buffer:row[c])
  statements.push({sql:`INSERT INTO ${table}(${columns.join(',')}) VALUES(${columns.map(()=>'?').join(',')})`,params})
 }
 statements.push(...importRestoreTriggers.map(t=>({sql:t.sql})))
 return statements
}
export type ImportArchive=ImportInventory
export const exportImportArchive=importInventory
export function validateImportExtension(value:unknown,baseRows?:Record<string,Record<string,any>[]>):asserts value is ImportInventory{
 validateImportInventory(value)
 if(!baseRows)return
 for(const addition of value.rows.import_additions){
  const v=JSON.parse(addition.value_json)
  if(addition.kind==='control'){
   if(!baseRows.controls?.some(c=>c.id===addition.id)||!baseRows.requirements?.some(r=>r.id===v.requirement_id&&r.control_id===addition.id))bad()
  }else{
   const receipt=baseRows.receipts?.find(r=>r.id===addition.id),exhibit=baseRows.exhibits?.find(e=>e.id===v.exhibit_id)
   if(!receipt||!exhibit||receipt.origin!=='imported'||receipt.requirement_id!==v.requirement_id||receipt.exhibit_id!==v.exhibit_id||receipt.sha256!==v.sha256||exhibit.object_key!==v.object_key||exhibit.size!==v.size)bad()
  }
 }
}
