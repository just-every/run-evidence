import type { Bindings } from '../../auth.server'
import { gap, period } from '../model'
import { desk } from '../storage'
import { controls, issueFolder, projectReceipt, tokenDigest } from '../review/storage'
import type { FolderInput } from '../review/types'
import { Refusal } from '../upload'
import type { Actor, AgentToken, TokenGrant, ProposalRow, Proposal, Decision } from './types'
const grantColumns='id,label,created_by,created_by_name,created_at,expires_at,revoked_at,revoked_by'
export const freshToken=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join('')
export const active=(row:TokenGrant|null,now:Date):row is TokenGrant=>!!row && !!row.token_hash && !row.revoked_at && Date.parse(row.expires_at)>now.getTime()
export async function grant(env:Bindings,secret:string) { return env.DB.prepare('SELECT * FROM agent_tokens WHERE token_hash=?').bind(await tokenDigest(secret)).first<TokenGrant>() }
export async function tokens(env:Bindings) { return (await env.DB.prepare(`SELECT ${grantColumns}, CASE WHEN token_hash IS NULL THEN 0 ELSE 1 END AS credential_present FROM agent_tokens ORDER BY created_at DESC,id`).all<AgentToken & {credential_present:number}>()).results }
export async function issueToken(env:Bindings,label:string,expires:string,actor:Actor,now:Date) {
 const token=freshToken(), row:AgentToken={id:crypto.randomUUID(),label,created_by:actor.id,created_by_name:actor.displayName,created_at:now.toISOString(),expires_at:expires,revoked_at:null,revoked_by:null}
 await env.DB.prepare('INSERT INTO agent_tokens(id,label,token_hash,created_by,created_by_name,created_at,expires_at) VALUES(?,?,?,?,?,?,?)').bind(row.id,label,await tokenDigest(token),actor.id,actor.displayName,row.created_at,expires).run()
 return {grant:row,token}
}
export async function revoke(env:Bindings,id:string,actor:Actor,now:Date) {
 await env.DB.prepare('UPDATE agent_tokens SET revoked_at=?,revoked_by=? WHERE id=? AND revoked_at IS NULL').bind(now.toISOString(),actor.id,id).run()
 return env.DB.prepare(`SELECT ${grantColumns} FROM agent_tokens WHERE id=?`).bind(id).first<AgentToken>()
}
export async function agentDesk(env:Bindings,selected:string,now:Date) {
 const data=await desk(env,selected,now)
 return { selected,controls:await controls(env),requirements:data.requirements.map(r=>({id:r.id,control_id:r.control_id,control_name:r.control_name,group_name:r.group_name,name:r.name,cadence:r.cadence,gap:r.gap,receipts:r.receipts.map(row=>({id:row.id,exhibit_id:row.exhibit_id,origin:row.origin,source:row.source,covered_from:row.covered_from,covered_to:row.covered_to,added_at:row.added_at,sha256:row.sha256,filename:row.filename,size:row.size,available:row.available,superseded:!!row.superseded_by}))})) }
}
export async function proposal(env:Bindings,id:string):Promise<Proposal|null> {
 const row=await env.DB.prepare('SELECT * FROM agent_proposals WHERE id=?').bind(id).first<ProposalRow>()
 if(!row) return null
 return {id:row.id,token_id:row.token_id,created_at:row.created_at,input:JSON.parse(row.input_json),snapshot:JSON.parse(row.snapshot_json),snapshot_hash:row.snapshot_hash,decision:await env.DB.prepare('SELECT * FROM agent_decisions WHERE proposal_id=?').bind(id).first<Decision>()}
}
export async function proposals(env:Bindings,tokenId?:string) {
 const stmt=env.DB.prepare('SELECT id FROM agent_proposals'+(tokenId?' WHERE token_id=?':'')+' ORDER BY created_at DESC,id LIMIT 200')
 const rows=(await (tokenId?stmt.bind(tokenId):stmt).all<{id:string}>()).results
 return Promise.all(rows.map(row=>proposal(env,row.id)))
}
export async function prepare(env:Bindings,input:FolderInput,token:TokenGrant,clock:()=>Date,preparer?:{id:string;name:string;kind:'token'}) {
 const now=clock(), id=crypto.randomUUID()
 const snapshot=await currentSnapshot(env,input,now)
 const snapshotJSON=JSON.stringify(snapshot), inputJSON=JSON.stringify(input)
 if(new TextEncoder().encode(snapshotJSON).length>512*1024) throw new Refusal('The selected folder is too large for a proposal; select fewer controls.')
 const hash=await tokenDigest(JSON.stringify({input,snapshot})), at=clock().toISOString()
 const insert=env.DB.prepare('INSERT INTO agent_proposals(id,token_id,created_at,input_json,snapshot_json,snapshot_hash) SELECT ?,?,?,?,?,? FROM agent_tokens WHERE id=? AND token_hash IS NOT NULL AND revoked_at IS NULL AND expires_at>?').bind(id,token.id,at,inputJSON,snapshotJSON,hash,token.id,at)
 const result=preparer ? (await env.DB.batch([insert,env.DB.prepare("INSERT INTO product_audit(id,actor_kind,actor_id,actor_name,action,subject,outcome,detail,at,reason,revision) SELECT ?,'token',?,?,'agent.proposal-prepared',?,'succeeded','Prepare only; no folder or link issued',?,'',? FROM agent_proposals WHERE id=?").bind(crypto.randomUUID(),preparer.id,preparer.name,'proposal:'+id,at,hash,id)]))[0] : await insert.run()
 if(!result.meta.changes) throw new Refusal('Agent credential expired or revoked.',401)
 return (await proposal(env,id))!
}
async function currentSnapshot(env:Bindings,input:FolderInput,now:Date) {
 return {folder:{reviewer_label:input.reviewer_label,period_from:input.period_from,period_to:input.period_to,expires_at:input.expires_at},selected:input.period_to,requirements:await selectedRequirements(env,input,now)}
}
// Reuse reviewData's scope/gap semantics without publishing or storing a folder.
async function selectedRequirements(env:Bindings,input:FolderInput,now:Date) {
 const selected=new Set(input.control_ids), data=await desk(env,input.period_to,now), requirements=[]
 for(const r of data.requirements.filter(r=>selected.has(r.control_id))) {
  const all=r.receipts, scoped=all.filter(row=>row.covered_from>=input.period_from && row.covered_to<=input.period_to), ids=new Set(scoped.map(row=>row.id)), window=period(r.cadence,input.period_to)
  const scopedGap=gap(r.cadence,input.period_to,scoped,now)
  requirements.push({id:r.id,control_id:r.control_id,control_name:r.control_name,group_name:r.group_name,name:r.name,cadence:r.cadence,gap:scopedGap==='missing' && gap(r.cadence,input.period_to,all,now)==='overdue'?'overdue' as const:scopedGap,period_from:window.from,period_to:window.to,receipts:scoped.map(row=>projectReceipt(row,ids))})
 }
 return requirements
}
export async function decide(env:Bindings,row:Proposal,action:'approved'|'rejected',actor:Actor,now:Date) {
 if(row.decision) throw new Refusal('This proposal already has a decision.',409)
 if(action==='approved') {
  const snapshot=await currentSnapshot(env,row.input,now)
  if(await tokenDigest(JSON.stringify({input:row.input,snapshot}))!==row.snapshot_hash) throw new Refusal('Evidence or gaps changed after preparation; prepare again and review the new proposal.',409)
 }
 const folderId=action==='approved'?crypto.randomUUID():null
 const decision:Decision={id:crypto.randomUUID(),proposal_id:row.id,action,actor_id:actor.id,actor_name:actor.displayName,decided_at:now.toISOString(),snapshot_hash:row.snapshot_hash,folder_id:folderId}
 const statement=env.DB.prepare('INSERT INTO agent_decisions(id,proposal_id,action,actor_id,actor_name,decided_at,snapshot_hash,folder_id) VALUES(?,?,?,?,?,?,?,?)').bind(...Object.values(decision))
 try {
  if(action==='approved') return {...await issueFolder(env,row.input,now,{id:folderId!,statements:[statement]}),decision}
  await statement.run(); return {decision}
 } catch(error) {
  if((await proposal(env,row.id))?.decision) throw new Refusal('This proposal already has a decision.',409)
  throw error
 }
}
