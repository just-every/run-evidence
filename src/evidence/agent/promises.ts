import type { Bindings } from '../../auth.server'
import { auditStatement,text,type Actor,type Input } from '../door'
import { Refusal } from '../upload'
import { sha } from '../archive/format'
import { resolveSource,type Source } from '../answer/sources'
import { escape } from '../view'
type Kind='answer'|'trust'
export async function dependencies(env:Bindings,kind:Kind,id:string,now:Date,chain?:Set<string>){
 const rows=(await env.DB.prepare('SELECT * FROM promise_dependencies WHERE subject_kind=? AND subject_id=? ORDER BY linked_at,rowid').bind(kind,id).all<{id:string;source_json:string;linked_by:string;linked_at:string}>()).results
 const out=[]
 for(const row of rows){
  const source=JSON.parse(row.source_json) as Source
  let current:Omit<Source,'id'>|null=null,reason=''
  try{current=await resolveSource(env,source.kind,source.source_id,source.quote,now,chain);if(current.fingerprint!==source.fingerprint)reason='The source revision or period changed.';else if(['fail','unknown'].includes(current.state))reason='The cited evidence is failing or unknown.'}catch(error){if(!(error instanceof Refusal))throw error;reason=error.message}
  out.push({...row,source,current,reason,state:reason?'invalidated':'current'})
 }
 return {rows:out,hash:await sha(new TextEncoder().encode(JSON.stringify(rows.map(r=>({id:r.id,source_json:r.source_json}))))),current:out.every(r=>r.state==='current'),affected_commitments:out.some(r=>r.state==='invalidated')?out.filter(r=>r.source.kind==='obligation').map(r=>r.source):[]}
}
export async function assertDependencies(env:Bindings,kind:Kind,id:string,now:Date,input?:Input,chain?:Set<string>){
 const data=await dependencies(env,kind,id,now,chain)
 if(!data.current)throw new Refusal('A customer-promise dependency changed. Prepare a fresh cited revision and obtain a new exact human decision.',409,data.rows.filter(r=>r.reason).map(r=>r.source.kind+': '+r.source.source_id+' — '+r.reason))
 if(input&&data.rows.length&&input.dependency_hash!==data.hash)throw new Refusal('Review the exact dependency set before approving this promise.',409)
 return data
}
export async function linkDependency(env:Bindings,kind:Kind,id:string,input:Input,actor:Actor,now:Date){
 const subject=kind==='answer'?await env.DB.prepare('SELECT id FROM questionnaire_drafts WHERE id=?').bind(id).first():await env.DB.prepare('SELECT id FROM trust_updates WHERE id=?').bind(id).first()
 if(!subject)throw new Refusal('Promise revision not found.',404)
 const approved=kind==='answer'?await env.DB.prepare('SELECT 1 FROM questionnaire_approvals WHERE draft_id=?').bind(id).first():await env.DB.prepare('SELECT 1 FROM trust_updates WHERE id=? AND approved_at IS NOT NULL').bind(id).first()
 if(approved)throw new Refusal('Approved promise dependencies are frozen. Prepare a new revision.',409)
 const count=await env.DB.prepare('SELECT COUNT(*) AS n FROM promise_dependencies WHERE subject_kind=? AND subject_id=?').bind(kind,id).first<{n:number}>()
 if((count?.n??0)>=30)throw new Refusal('A promise revision can cite at most 30 explicit dependencies.',409)
 const kindOfSource=text(input,'kind',30),sourceId=text(input,'source_id',512),quote=text(input,'quote',10000),source=await resolveSource(env,kindOfSource,sourceId,quote,now)
 if(['fail','unknown'].includes(source.state))throw new Refusal('A promise cannot depend on failing or unknown evidence.',409)
 const key=crypto.randomUUID()
 // Freeze the dependency set atomically against a competing approval.
 const guard=kind==='answer'?'NOT EXISTS(SELECT 1 FROM questionnaire_approvals WHERE draft_id=?)':'EXISTS(SELECT 1 FROM trust_updates WHERE id=? AND approved_at IS NULL)'
 const result=await env.DB.batch([env.DB.prepare(`INSERT INTO promise_dependencies SELECT ?,?,?,?,?,? WHERE ${guard}`).bind(key,kind,id,JSON.stringify(source),actor.name,now.toISOString(),id),auditStatement(env,actor,'promise.dependency-linked',kind+':'+id,now,'succeeded',kindOfSource+' '+sourceId,{revision:source.revision})])
 if(!result[0].meta.changes)throw new Refusal('Approval froze this promise. Prepare a new revision.',409)
 return dependencies(env,kind,id,now)
}
export function dependencyView(data:Awaited<ReturnType<typeof dependencies>>,path:string,approved:boolean){return `<section><h2>Customer promise dependencies</h2><p>${!data.rows.length?'No explicit dependency links':data.current?'Current source revisions':'Invalidated — a fresh cited revision and human decision are required'}</p>${data.affected_commitments.length?`<h3>Affected customer commitments</h3><ul>${data.affected_commitments.map(s=>`<li><a href="${escape(s.href)}">${escape(s.source_id)}</a><blockquote>${escape(s.quote)}</blockquote>Revision <code>${escape(s.revision)}</code></li>`).join('')}</ul>`:''}<ul>${data.rows.map(r=>`<li><a href="${escape(r.source.href)}">${escape(r.source.kind)}</a> · ${escape(r.source.source_id)} · <code>${escape(r.source.revision)}</code><blockquote>${escape(r.source.quote)}</blockquote><p>${escape(r.reason||'Current')} · linked ${escape(r.linked_at)} by ${escape(r.linked_by)}</p></li>`).join('')}</ul>${approved?'':`<form method="post" action="${path}/dependencies"><label>Dependency kind<select name="kind">${['policy','control','observation','exhibit','audit-period','obligation','audit-report','approved-answer'].map(k=>`<option>${k}</option>`).join('')}</select></label><label>Exact dependency ID<input name="source_id" required maxlength="512"></label><label>Exact source passage<textarea name="quote" required maxlength="10000"></textarea></label><button>Link exact source revision</button></form>`}${data.rows.length?`<form method="post" action="${path}/refresh-source"><h3>Prepare a fresh cited revision</h3><label>Dependency to replace<select name="dependency_id">${data.rows.map(r=>`<option value="${r.id}">${escape(r.source.kind+' · '+r.source.source_id)}</option>`).join('')}</select></label><label>Fresh source kind<select name="kind">${['policy','control','observation','exhibit','audit-period','obligation','audit-report','approved-answer'].map(k=>`<option>${k}</option>`).join('')}</select></label><label>Fresh source ID<input name="source_id" required></label><label>Fresh exact passage<textarea name="quote" required></textarea></label>${path.startsWith('/app/trust/')?'<label>Revised promise text<textarea name="body" required maxlength="20000"></textarea></label>':''}<button>Prepare revision for human review</button></form>`:''}</section>`}
export function carryDependencies(env:Bindings,kind:Kind,from:string,to:string,replacement?:Replacement){
 return env.DB.prepare("INSERT INTO promise_dependencies SELECT lower(hex(randomblob(16))),subject_kind,?,CASE WHEN id=? THEN ? ELSE source_json END,CASE WHEN id=? THEN ? ELSE linked_by END,CASE WHEN id=? THEN ? ELSE linked_at END FROM promise_dependencies WHERE subject_kind=? AND subject_id=?").bind(to,replacement?.id??'',replacement?.source??'',replacement?.id??'',replacement?.actor??'',replacement?.id??'',replacement?.at??'',kind,from)
}
export interface Replacement {id:string;source:string;actor:string;at:string}
export async function replacement(env:Bindings,kind:Kind,subject:string,input:Input,actor:Actor,now:Date):Promise<Replacement>{
 const id=text(input,'dependency_id',36)
 if(!await env.DB.prepare('SELECT 1 FROM promise_dependencies WHERE id=? AND subject_kind=? AND subject_id=?').bind(id,kind,subject).first())throw new Refusal('Choose a dependency of this exact revision.',404)
 const source=await resolveSource(env,text(input,'kind',30),text(input,'source_id',512),text(input,'quote',10000),now)
 if(['fail','unknown'].includes(source.state))throw new Refusal('Resolve the failing or unknown source before preparing a replacement.',409)
 return {id,source:JSON.stringify(source),actor:actor.name,at:now.toISOString()}
}
