import type { Bindings } from '../../auth.server'
import { auditStatement,text,list,type Actor,type Input } from '../door'
import { Refusal } from '../upload'
import { validDate } from '../model'
import { requirePerson } from '../program/people'
import { requireFramework,requirements,revisionStatements,mappingStatement,emptyDiff,commit } from '../framework/storage'
import { currentMethod,score } from '../risk/storage'
import { retainDefaultMethod } from '../risk/method-default'
import { sha } from '../archive/format'
export interface Tailoring {id:string;framework_id:string;requirement_id:string;snapshot_json:string;snapshot_hash:string;created_by:string;created_at:string}
const fingerprint=(v:unknown)=>sha(new TextEncoder().encode(JSON.stringify(v)))
export async function tailoringOf(env:Bindings,id:string){const r=await env.DB.prepare('SELECT * FROM tailoring_proposals WHERE id=?').bind(id).first<Tailoring>();if(!r)throw new Refusal('Tailoring proposal not found.',404);return r}
export async function tailoringContext(env:Bindings,input:Input){
 const framework=await requireFramework(env,text(input,'framework_id',128)),requirement=(await requirements(env,framework.id)).find(q=>q.id===input.requirement_id&&!q.removed_at)
 if(!requirement)throw new Refusal('Select an active customer requirement.',404)
 const material=await env.DB.prepare('SELECT q.*,f.name AS framework_name FROM custom_framework_requirements q JOIN custom_frameworks f ON f.id=q.framework_id WHERE q.id=? AND q.removed_at IS NULL').bind(text(input,'material_id',128)).first<any>();if(!material)throw new Refusal('Select imported framework or regulatory material.',404)
 const program=await env.DB.prepare('SELECT * FROM programs WHERE id=?').bind(text(input,'program_id',128)).first<any>();if(!program)throw new Refusal('Select the receiving program.',404)
 const controlHint=text(input,'control_id',128,true)
 const resources=[]
 for(const id of list(input,'resource_ids',50)){const r=await env.DB.prepare('SELECT id,type,unique_id,display_name,attributes_json,attributes_hash,updated_at,removed_at FROM resources WHERE id=?').bind(id).first<any>();if(!r||r.removed_at)throw new Refusal('Selected inventory resource is unavailable.',409);resources.push(r)}
 if(!resources.length)throw new Refusal('Select the actual in-scope asset inventory.')
 const query='SELECT c.*,(SELECT max(revision) FROM control_revisions r WHERE r.control_id=c.id) AS definition_revision FROM controls c'
 let control:any
 if(controlHint)control=await env.DB.prepare(query+' WHERE c.id=?').bind(controlHint).first<any>()
 else {
  // Source-based candidate preparation, with no writes or authority from the
  // source text. A human still approves the exact chosen mapping.
  const terms=(value:string)=>new Set((value.toLowerCase().match(/[a-z]{3,}/g)??[]).map(w=>w.replace(/s$/,'')))
  const requested=terms([requirement.title,requirement.description,material.title,material.description,...resources.map(r=>r.display_name)].join(' '))
  const ranked=(await env.DB.prepare(query).all<any>()).results.map(c=>({control:c,score:[...terms(c.name)].filter(t=>requested.has(t)).length})).sort((a,b)=>b.score-a.score||a.control.name.localeCompare(b.control.name)||a.control.id.localeCompare(b.control.id))
  control=ranked.find(c=>c.score>0)?.control
 }
 if(!control)throw new Refusal('No existing control matches the selected material. Create a suitable control or supply an explicit candidate for review.',409)
 const policy=await env.DB.prepare("SELECT r.id,r.policy_id,r.version,r.body,r.body_sha256,r.status,p.title FROM policy_revisions r JOIN policies p ON p.id=r.policy_id WHERE r.id=? AND r.status IN ('approved','published') AND NOT EXISTS(SELECT 1 FROM policy_revisions n WHERE n.policy_id=r.policy_id AND n.version>r.version AND n.status IN ('approved','published'))").bind(text(input,'policy_revision_id',128)).first<any>();if(!policy)throw new Refusal('Select the current approved policy revision.',409)
 const method=await currentMethod(env)
 return {framework:{id:framework.id,name:framework.name},requirement,material,program,control,resources,policy,method}
}
export async function prepareTailoring(env:Bindings,input:Input,actor:Actor,now:Date){
 const context=await tailoringContext(env,input),assumptions=text(input,'assumptions',2000),likelihood=Number(input.likelihood),impact=Number(input.impact),assessment=score(context.method,likelihood,impact)
 const passage=context.requirement.description||context.requirement.title,material=context.material.description||context.material.title,date=/\b(?:by|no later than|due(?: on)?)\s+(\d{4}-\d\d-\d\d)\b/i.exec(passage)?.[1],deadline=date&&validDate(date)?date:null,ambiguous=/reasonable|appropriate|promptly|as soon|where applicable|\bmay\b/i.test(passage)
 const citations=[{kind:'contract-promise',ref:context.requirement.ref,passage,href:`/app/frameworks/${context.framework.id}/requirements/${context.requirement.id}`},{kind:'framework-requirement',ref:context.material.ref,passage:material,href:`/app/frameworks/${context.material.framework_id}/requirements/${context.material.id}`}]
 const after=context.policy.body+'\n\nCustomer promise '+context.requirement.ref+':\n'+passage+'\n\nSelected framework requirement '+context.material.ref+':\n'+material
 const snapshot={input:{...input,control_id:context.control.id,resource_ids:context.resources.map(r=>r.id)},context,context_hash:await fingerprint(context),control_selection:{mode:input.control_id?'owner-supplied candidate':'source-based recommendation',explanation:input.control_id?'The owner supplied a candidate; the exact mapping still needs review.':'Selected by shared terms across the contract, framework passage and actual inventory. This proposes applicability; it does not prove equivalence.'},citations,assumptions,ambiguous,deadline,conflicts:context.policy.body.includes(passage)?[]:['The proposed customer promise differs from the current approved policy; review the exact diff and any incompatible cadence or scope.'],mapping:{requirement_id:context.requirement.id,control_id:context.control.id},policy_diff:{before:context.policy.body,after},risk:{title:('Unmet customer promise '+context.requirement.ref).slice(0,300),scenario:'Failure to meet the cited customer promise: '+passage,likelihood,impact,...assessment},obligation:{kind:'contract-promise',body:passage,deadline},notice:'Local deterministic preparation from selected passages and inventory. Interpretation and applicability are assumptions, not legal advice. Approval creates a policy draft, a reviewed risk assessment, one mapping and one structured obligation; it never publishes policy or sends work.'}
 const id=crypto.randomUUID(),json=JSON.stringify(snapshot),hash=await sha(new TextEncoder().encode(json))
 if(new TextEncoder().encode(json).length>1024*1024)throw new Refusal('Proposal exceeds 1 MiB.',413)
 await env.DB.batch([env.DB.prepare('INSERT INTO tailoring_proposals VALUES(?,?,?,?,?,?,?)').bind(id,context.framework.id,context.requirement.id,json,hash,actor.name,now.toISOString()),auditStatement(env,actor,'tailoring.prepared','tailoring:'+id,now,'succeeded','prepare only',{revision:hash})]);return tailoringOf(env,id)
}
export async function decideTailoring(env:Bindings,id:string,input:Input,actor:Actor,now:Date){
 const row=await tailoringOf(env,id),s=JSON.parse(row.snapshot_json),decision=text(input,'decision',20),approver=await requirePerson(env,input.approver_person_id,'named security/legal owner'),reason=text(input,'reason',1000)
 if(!['approved','rejected'].includes(decision)||input.snapshot_hash!==row.snapshot_hash||await sha(new TextEncoder().encode(row.snapshot_json))!==row.snapshot_hash)throw new Refusal('Decide the exact proposal fingerprint.',409)
 if(await env.DB.prepare('SELECT 1 FROM tailoring_decisions WHERE proposal_id=?').bind(id).first())throw new Refusal('This proposal already has a decision.',409)
 let policyRevision:string|null=null,riskId:string|null=null,statements:D1PreparedStatement[]=[]
 if(decision==='approved'){
  const current=await tailoringContext(env,s.input)
  if(await fingerprint(current)!==s.context_hash)throw new Refusal('A cited requirement, material, policy, control, asset or scoring method changed. Prepare and review again.',409)
  if(s.ambiguous&&input.acknowledge_ambiguity!=='yes')throw new Refusal('Explicitly confirm the recorded interpretation assumptions for the ambiguous obligation.',409)
  const guardParts:string[]=[],guardValues:(string|number|null)[]=[]
  const same=(table:string,values:Record<string,any>)=>{guardParts.push(`EXISTS(SELECT 1 FROM ${table} WHERE ${Object.keys(values).map(k=>'"'+k+'" IS ?').join(' AND ')})`);guardValues.push(...Object.values(values))}
  same('custom_framework_requirements',{id:current.requirement.id,title:current.requirement.title,description:current.requirement.description,section:current.requirement.section,removed_at:null})
  same('custom_framework_requirements',{id:current.material.id,title:current.material.title,description:current.material.description,section:current.material.section,removed_at:null})
  same('policy_revisions',{id:current.policy.id,body_sha256:current.policy.body_sha256,status:current.policy.status})
  same('programs',current.program)
  same('controls',{id:current.control.id,name:current.control.name,group_name:current.control.group_name})
  guardParts.push(`COALESCE((SELECT max(revision) FROM control_revisions WHERE control_id=?),0)=?`);guardValues.push(current.control.id,current.control.definition_revision??0)
  guardParts.push(`COALESCE((SELECT max(revision) FROM risk_methods),1)=?`);guardValues.push(current.method.revision)
  guardParts.push(`NOT EXISTS(SELECT 1 FROM json_each(?) r LEFT JOIN resources x ON x.id=json_extract(r.value,'$.id') WHERE x.id IS NULL OR x.attributes_hash<>json_extract(r.value,'$.attributes_hash') OR x.updated_at<>json_extract(r.value,'$.updated_at') OR x.display_name<>json_extract(r.value,'$.display_name') OR x.removed_at IS NOT NULL)`);guardValues.push(JSON.stringify(current.resources))
  guardParts.push(`NOT EXISTS(SELECT 1 FROM policy_revisions WHERE policy_id=? AND version>? AND status IN ('approved','published'))`);guardValues.push(current.policy.policy_id,current.policy.version)
  statements.push(env.DB.prepare(`INSERT INTO tailoring_guard SELECT 1,CASE WHEN ${guardParts.join(' AND ')} THEN 1 ELSE 0 END`).bind(...guardValues))
  const framework=await requireFramework(env,row.framework_id),rows=await requirements(env,framework.id),q=rows.find(r=>r.id===row.requirement_id)!
  if(q.mappings.includes(s.mapping.control_id))throw new Refusal('The proposed mapping is already current.',409)
  q.mappings=[...q.mappings,s.mapping.control_id].sort();const diff=emptyDiff();diff.changed.push(q.ref)
  statements.push(...revisionStatements(env,framework,rows,diff,actor,now,'Approved tailoring '+id),mappingStatement(env,q.id,s.mapping.control_id,'mapped','manual',actor,now,'Exact approved tailoring '+id,framework.revision+1))
  const version=(await env.DB.prepare('SELECT max(version) AS n FROM policy_revisions WHERE policy_id=?').bind(current.policy.policy_id).first<{n:number}>())!.n+1
  policyRevision=crypto.randomUUID();riskId=crypto.randomUUID();const at=now.toISOString(),bodyHash=await sha(new TextEncoder().encode(s.policy_diff.after))
  statements.push(env.DB.prepare("INSERT INTO policy_revisions(id,policy_id,version,body,body_sha256,status,drafted_by,drafted_at) VALUES(?,?,?,?,?,'draft',?,?)").bind(policyRevision,current.policy.policy_id,version,s.policy_diff.after,bodyHash,approver.name,at),env.DB.prepare('UPDATE policies SET updated_at=? WHERE id=?').bind(at,current.policy.policy_id))
  if(current.method.revision===1)statements.push(retainDefaultMethod(env))
  statements.push(env.DB.prepare("INSERT INTO risks(id,title,scenario,origin,source_label,owner_person_id,assets,treatment,created_at,updated_at) VALUES(?,?,?,'form',?,?,?,'mitigate',?,?)").bind(riskId,s.risk.title,s.risk.scenario,'Approved tailoring '+id,approver.id,JSON.stringify(current.resources.map((r:any)=>r.id)),at,at),env.DB.prepare("INSERT INTO risk_assessments(id,risk_id,kind,method_revision,likelihood,impact,score,level,likelihood_label,impact_label,notes,actor_name,at) VALUES(?,?,'inherent',?,?,?,?,?,?,?,?,?,?)").bind(crypto.randomUUID(),riskId,current.method.revision,s.risk.likelihood,s.risk.impact,s.risk.score,s.risk.level,s.risk.likelihood_label,s.risk.impact_label,s.assumptions,approver.name,at),env.DB.prepare("INSERT INTO risk_links VALUES(?,'control',?,?)").bind(riskId,current.control.id,at))
  for(const resource of current.resources)statements.push(env.DB.prepare("INSERT INTO risk_links VALUES(?,'asset',?,?)").bind(riskId,resource.id,at))
  statements.push(env.DB.prepare('INSERT INTO tailored_obligations VALUES(?,?,?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),id,current.program.id,current.control.id,'contract-promise',s.obligation.body,current.requirement.ref,s.deadline,s.assumptions,at))
 }
 statements.push(env.DB.prepare('INSERT INTO tailoring_decisions VALUES(?,?,?,?,?,?,?,?,?,?)').bind(id,row.snapshot_hash,decision,approver.id,actor.id,actor.name,reason,policyRevision,riskId,now.toISOString()),auditStatement(env,actor,'tailoring.'+decision,'tailoring:'+id,now,'succeeded','named owner '+approver.name,{reason,revision:row.snapshot_hash}))
 // Decision's primary key, framework revision and policy version fence the
 // same transaction; no partially applied proposal survives a refusal.
 if(decision==='approved')statements.push(env.DB.prepare('DELETE FROM tailoring_guard'))
 try{await commit(env,statements)}catch(error){if(String(error).includes('tailoring_snapshot_current'))throw new Refusal('A cited source changed during approval. Prepare and review again.',409);throw error}
 return {decision,policy_revision_id:policyRevision,risk_id:riskId}
}
