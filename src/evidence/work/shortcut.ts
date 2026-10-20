import { dateOnly, TrackerFailure, type Adapter } from './client'
import { json, id, metadata, requireId } from './rest'
// https://developer.shortcut.com/api/rest/v3#Stories
const name='Shortcut', headers=(key:string)=>({'shortcut-token':key,accept:'application/json','content-type':'application/json'})
const api=(url:string,key:string,method='GET',body?:unknown)=>json(url,key,name,method,body,headers(key))
export const shortcut: Adapter = {
 ...metadata(name,'https://api.app.shortcut.com/api/v3','Project ID','A Shortcut API token','Read and write stories and comments in the selected project'),
 fieldNotes: 'Labels, owners and deadline are native fields. Priority is description text; reopen uses the current workflow unstarted state.',
 async verify(base,key,_account,project) {const p=await api(`${base}/projects/${id(project)}`,key),u=await api(base+'/member',key);return {account:u.profile.name,projectName:p.name}},
 async create(d,key,draft) {const i=await api(d.api_base+'/stories',key,'POST',{name:draft.title,description:`${draft.description}\n\nPriority: ${draft.priority}`,story_type:'chore',project_id:Number(d.project),deadline:draft.due?draft.due+'T00:00:00Z':null,labels:draft.labels.map(name=>({name})),owner_ids:draft.assignee?[draft.assignee]:[]});return {id:requireId(i.id,name),key:String(i.id),url:i.app_url}},
 async read(d,key,t) {const i=await api(`${d.api_base}/stories/${id(t.remote_id)}`,key),flows=await api(d.api_base+'/workflows',key),state=flows.flatMap((f:any)=>f.states).find((s:any)=>s.id===i.workflow_state_id);if(!state)throw new TrackerFailure('invalid',400,'Shortcut workflow state is unavailable.');const members=await api(d.api_base+'/members',key);return {status:state.name,closed:state.type==='done',assignee:i.owner_ids.map((v:string)=>members.find((m:any)=>m.id===v)?.profile.name??v).join(', ')||null,due:dateOnly(i.deadline),comments:i.comments.map((c:any)=>({id:String(c.id),author:members.find((m:any)=>m.id===c.author_id)?.profile.name??c.author_id,body:c.text,at:c.created_at}))}},
 async comment(d,key,t,body) {return requireId((await api(`${d.api_base}/stories/${id(t.remote_id)}/comments`,key,'POST',{text:body})).id,name)},
 async setDue(d,key,t,due) {await api(`${d.api_base}/stories/${id(t.remote_id)}`,key,'PUT',{deadline:due?due+'T00:00:00Z':null})},
 async reopen(d,key,t) {const i=await api(`${d.api_base}/stories/${id(t.remote_id)}`,key),flows=await api(d.api_base+'/workflows',key),flow=flows.find((f:any)=>f.states.some((s:any)=>s.id===i.workflow_state_id)),state=flow?.states.find((s:any)=>s.type==='unstarted');if(!state)throw new TrackerFailure('invalid',400,'Shortcut workflow has no unstarted state.');await api(`${d.api_base}/stories/${id(t.remote_id)}`,key,'PUT',{workflow_state_id:state.id})},
}
