import type {Bindings} from '../../../auth.server'
import type {ChecklistArea} from '../../program/checklist'
import {rows} from './storage'
export async function engagementChecklist(env:Bindings,controls:string[]):Promise<ChecklistArea[]>{
 const scope=JSON.stringify(controls)
 const engagements=await rows(env,'SELECT DISTINCT e.id,e.name,e.closed_at FROM audit_engagements e JOIN audit_scope s ON s.engagement_id=e.id WHERE s.control_id IN (SELECT value FROM json_each(?)) ORDER BY e.id',scope)
 const requests=await rows(env,'SELECT id,title,engagement_id,closed_at FROM audit_requests WHERE control_id IN (SELECT value FROM json_each(?)) ORDER BY id',scope)
 return [{area:'Audit engagements',ready:engagements.filter(e=>e.closed_at).length,total:engagements.length,available:true,refs:[],records:engagements.map(e=>({id:e.id,href:'/api/audit-engagements/'+e.id,label:e.name,state:e.closed_at?'closed':'open'}))},{area:'Audit requests',ready:requests.filter(r=>r.closed_at).length,total:requests.length,available:true,refs:[],records:requests.map(r=>({id:r.id,href:'/api/audit-engagements/'+r.engagement_id,label:r.title,state:r.closed_at?'closed':'open'}))}]
}
