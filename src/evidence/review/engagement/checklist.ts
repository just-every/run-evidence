import type {Bindings} from '../../../auth.server'
import type {ChecklistArea} from '../../program/checklist'
import {rows} from './storage'
export async function engagementChecklist(env:Bindings,controls:string[]):Promise<ChecklistArea[]>{
 const scope=JSON.stringify(controls)
 const engagements=await rows(env,'SELECT DISTINCT e.id,e.name,e.closed_at FROM audit_engagements e JOIN audit_scope s ON s.engagement_id=e.id WHERE s.control_id IN (SELECT value FROM json_each(?)) ORDER BY e.id',scope)
 const requests=await rows(env,'SELECT id,title,engagement_id,closed_at FROM audit_requests WHERE control_id IN (SELECT value FROM json_each(?)) ORDER BY id',scope)
 return [{area:'Audit engagements',ready:engagements.filter(e=>e.closed_at).length,total:engagements.length,available:true,refs:[],records:engagements.map(e=>({id:e.id,href:'/api/audit-engagements/'+e.id,label:e.name,state:e.closed_at?'closed':'open'}))},{area:'Audit requests',ready:requests.filter(r=>r.closed_at).length,total:requests.length,available:true,refs:[],records:requests.map(r=>({id:r.id,href:'/api/audit-engagements/'+r.engagement_id,label:r.title,state:r.closed_at?'closed':'open'}))}]
}

export async function evidenceDecisionChecklist(env:Bindings,controls:string[]):Promise<ChecklistArea>{
 const flags=await rows(env,`SELECT d.id,d.reason,d.actor_name,s.id AS share_id,s.engagement_id,s.snapshot_json,e.name
 FROM audit_evidence_decisions d JOIN audit_evidence_shares s ON s.id=d.share_id JOIN audit_engagements e ON e.id=s.engagement_id
 WHERE s.unshared_at IS NULL AND d.state='flagged' AND d.revision=(SELECT MAX(x.revision) FROM audit_evidence_decisions x WHERE x.share_id=s.id)
 AND EXISTS(SELECT 1 FROM audit_scope a WHERE a.engagement_id=e.id AND a.control_id IN (SELECT value FROM json_each(?)))
 AND (s.kind<>'test' OR EXISTS(SELECT 1 FROM test_controls t WHERE t.test_id=s.subject_id AND t.control_id IN (SELECT value FROM json_each(?)))) ORDER BY d.at,d.id`,JSON.stringify(controls),JSON.stringify(controls))
 return {area:'Auditor decisions',ready:0,total:flags.length,available:true,refs:[],records:flags.map(f=>({id:f.id,href:'/api/audit-engagements/'+f.engagement_id+'/evidence/'+f.share_id,label:JSON.parse(f.snapshot_json).name??JSON.parse(f.snapshot_json).title??f.name,state:'Flagged by '+f.actor_name+': '+f.reason}))}
}
