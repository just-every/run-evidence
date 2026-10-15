import type { Bindings } from '../../auth.server'
import { validDate, cadences } from '../model'
import { tokenDigest } from '../review/storage'
import { fail, type Row } from '../archive/format'
export const agentColumns={
 agent_tokens:['id','label','created_by','created_by_name','created_at','expires_at','revoked_at','revoked_by'],
 agent_proposals:['id','token_id','created_at','input_json','snapshot_json','snapshot_hash'],
 agent_decisions:['id','proposal_id','action','actor_id','actor_name','decided_at','snapshot_hash','folder_id'],
} as const
export async function exportAgentRows(env:Bindings) {
 const result:Record<string,Row[]>={}
 for(const [table,columns] of Object.entries(agentColumns)) result[table]=(await env.DB.prepare(`SELECT ${columns.join(',')} FROM ${table} ORDER BY id`).all<Row>()).results
 return result
}
export interface AgentArchive { rows:Record<keyof typeof agentColumns,Row[]> }
export async function exportAgentArchive(env:Bindings):Promise<AgentArchive> { return {rows:await exportAgentRows(env) as AgentArchive['rows']} }
export async function validateAgentExtension(value:unknown,baseRows:Record<string,Row[]>):Promise<AgentArchive> {
 if(!object(value) || !exact(value,['rows']) || !object(value.rows) || !exact(value.rows,Object.keys(agentColumns))) fail('Invalid agent archive extension.')
 const rows=value.rows as AgentArchive['rows'];let count=0
 const nullable=new Set(['agent_tokens.revoked_at','agent_tokens.revoked_by','agent_decisions.folder_id'])
 for(const [table,columns] of Object.entries(agentColumns)) {
  if(!Array.isArray(rows[table as keyof typeof rows])) fail('Invalid agent archive inventory.')
  const seen=new Set()
  for(const row of rows[table as keyof typeof rows]) {
   if(++count>20000 || !object(row) || !exact(row,[...columns]) || typeof row.id!=='string' || !/^[A-Za-z0-9_-]{1,128}$/.test(row.id) || seen.has(row.id)) fail('Invalid agent archive row.')
   seen.add(row.id)
   for(const column of columns) {
    const field=row[column]
    if(field===null && nullable.has(table+'.'+column)) continue
    const limit=column==='snapshot_json'?512*1024:column==='input_json'?32768:1024
    if(!text(field,limit)) fail('Invalid agent archive field.')
   }
  }
 }
 await validateAgentArchive({...baseRows,...rows})
 return {rows}
}
export function restoreAgentStatements(env:Bindings,extension:AgentArchive) {
 // token_hash is deliberately absent: restored grants cannot authenticate.
 return Object.entries(agentColumns).flatMap(([table,columns])=>extension.rows[table as keyof typeof agentColumns].map(row=>env.DB.prepare(`INSERT INTO ${table}(${columns.join(',')}) VALUES(${columns.map(()=>'?').join(',')})`).bind(...columns.map(c=>row[c]))))
}
const object=(v:unknown):v is Record<string,unknown>=>!!v && typeof v==='object' && !Array.isArray(v)
const exact=(v:Record<string,unknown>,keys:string[])=>Object.keys(v).length===keys.length && keys.every(k=>Object.hasOwn(v,k))
const text=(v:unknown,n=1024)=>typeof v==='string' && !!v && v.length<=n
const date=(v:unknown)=>typeof v==='string' && Number.isFinite(Date.parse(v)) && new Date(v).toISOString()===v
const hash=(v:unknown)=>typeof v==='string' && /^[a-f0-9]{64}$/.test(v)
export async function validateAgentArchive(rows:Record<string,Row[]>) {
 const controlIds=new Set(rows.controls.map(r=>r.id)), tokenIds=new Set(rows.agent_tokens.map(r=>r.id)), proposals=new Map(rows.agent_proposals.map(r=>[r.id,r])), folders=new Map(rows.review_folders.map(r=>[r.id,r]))
 const parsed=new Map<string,{input:Record<string,unknown>;snapshot:Record<string,unknown>}>()
 for(const row of rows.agent_tokens) {
  if(!text(row.label,100) || !text(row.created_by) || !text(row.created_by_name) || !date(row.created_at) || !date(row.expires_at) || String(row.expires_at)<=String(row.created_at) || ((row.revoked_at===null)!==(row.revoked_by===null)) || (row.revoked_at!==null && (!date(row.revoked_at)||!text(row.revoked_by)))) fail('Invalid archived agent grant.')
 }
 for(const row of rows.agent_proposals) {
  if(!tokenIds.has(row.token_id) || !date(row.created_at) || !text(row.input_json,32768) || !text(row.snapshot_json,512*1024) || !hash(row.snapshot_hash)) fail('Invalid archived proposal.')
  let input:unknown,snapshot:unknown
  try {input=JSON.parse(String(row.input_json));snapshot=JSON.parse(String(row.snapshot_json))} catch {fail('Invalid proposal snapshot JSON.')}
  if(!object(input) || !exact(input,['reviewer_label','period_from','period_to','expires_at','control_ids']) || !text(input.reviewer_label,300) || !validDate(input.period_from) || !validDate(input.period_to) || input.period_from>input.period_to || !date(input.expires_at) || !Array.isArray(input.control_ids) || !input.control_ids.length || input.control_ids.length>500 || new Set(input.control_ids).size!==input.control_ids.length || input.control_ids.some(id=>!controlIds.has(String(id)))) fail('Invalid proposal scope.')
  if(!object(snapshot) || !exact(snapshot,['folder','selected','requirements']) || !object(snapshot.folder) || !exact(snapshot.folder,['reviewer_label','period_from','period_to','expires_at']) || Object.entries(snapshot.folder).some(([k,v])=>input[k]!==v) || snapshot.selected!==input.period_to || !Array.isArray(snapshot.requirements)) fail('Invalid proposal snapshot.')
  const selected=new Set(input.control_ids), seen=new Set()
  for(const r of snapshot.requirements) {
   if(!object(r) || !exact(r,['id','control_id','control_name','group_name','name','cadence','gap','period_from','period_to','receipts']) || !text(r.id) || seen.has(r.id) || !selected.has(r.control_id) || !text(r.control_name) || !text(r.group_name) || !text(r.name) || !(cadences as readonly unknown[]).includes(r.cadence) || !['covered','due soon','overdue','missing','superseded-only','unavailable bytes'].includes(String(r.gap)) || !validDate(r.period_from) || !validDate(r.period_to) || !Array.isArray(r.receipts)) fail('Invalid proposal requirement snapshot.')
   seen.add(r.id)
   for(const receipt of r.receipts) {
    if(!object(receipt) || !exact(receipt,['id','requirement_id','exhibit_id','origin','source','covered_from','covered_to','added_at','sha256','filename','size','media_type','available','superseded','supersedes']) || !text(receipt.id) || receipt.requirement_id!==r.id || !text(receipt.exhibit_id) || !['source-observed','manually-asserted','imported'].includes(String(receipt.origin)) || !text(receipt.source,1000) || !validDate(receipt.covered_from) || !validDate(receipt.covered_to) || receipt.covered_from< String(input.period_from) || receipt.covered_to> String(input.period_to) || receipt.covered_from>receipt.covered_to || !date(receipt.added_at) || !hash(receipt.sha256) || !text(receipt.filename) || !text(receipt.media_type) || !Number.isSafeInteger(receipt.size) || Number(receipt.size)<1 || typeof receipt.available!=='boolean' || typeof receipt.superseded!=='boolean' || !(receipt.supersedes===null || text(receipt.supersedes))) fail('Invalid proposal receipt snapshot.')
   }
  }
  if(await tokenDigest(JSON.stringify({input,snapshot}))!==row.snapshot_hash) fail('Proposal snapshot fingerprint mismatch.')
  parsed.set(String(row.id),{input,snapshot})
 }
 const decided=new Set(),folderIds=new Set()
 for(const row of rows.agent_decisions) {
  const proposal=proposals.get(row.proposal_id)
  if(!proposal || decided.has(row.proposal_id) || !['approved','rejected'].includes(String(row.action)) || !text(row.actor_id) || !text(row.actor_name) || !date(row.decided_at) || row.snapshot_hash!==proposal.snapshot_hash || String(row.decided_at)<String(proposal.created_at)) fail('Invalid proposal decision.')
  decided.add(row.proposal_id)
  if(row.action==='rejected') {if(row.folder_id!==null) fail('Rejected proposal has a folder.');continue}
  const folder=folders.get(row.folder_id), input=parsed.get(String(row.proposal_id))!.input
  if(!folder || folderIds.has(row.folder_id) || ['reviewer_label','period_from','period_to','expires_at'].some(k=>folder[k]!==input[k]) || folder.created_at!==row.decided_at) fail('Approved folder contradicts its proposal.')
  folderIds.add(row.folder_id)
  const actual=rows.review_folder_controls.filter(r=>r.folder_id===row.folder_id).map(r=>r.control_id).sort()
  if(JSON.stringify(actual)!==JSON.stringify([...(input.control_ids as string[])].sort())) fail('Approved folder selection contradicts its proposal.')
 }
}
