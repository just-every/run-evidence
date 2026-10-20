import { dateOnly, TrackerFailure, type Adapter } from './client'
import { json, id, metadata, requireId } from './rest'
// https://api.freshservice.com/v2/#tickets
const name='Freshservice', headers=(key:string)=>({authorization:'Basic '+btoa(key+':X'),accept:'application/json','content-type':'application/json'})
const api=(url:string,key:string,method='GET',body?:unknown)=>json(url,key,name,method,body,headers(key))
export const freshservice: Adapter = {
 ...metadata(name,'','Group ID','A Freshservice API key, requester email and https://your-domain.freshservice.com/api/v2 address','Read and write tickets and notes in the selected group'),
 defaultPriorities:{critical:'4',high:'3',medium:'2',low:'1'},
 fieldNotes: 'Group, priority, tags, responder and due date use native fields. The account email is the requester. Status 4 or 5 is closed; reopen uses 2. Comments are private notes.',
 async verify(base,key,account,project) {const g=await api(`${base}/groups/${id(project)}`,key);if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(account))throw new TrackerFailure('invalid',400,'Freshservice requires the requester account email.');return {account,projectName:g.group.name}},
 async create(d,key,draft) {const {ticket:i}=await api(d.api_base+'/tickets',key,'POST',{subject:draft.title,description:draft.description.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('\n','<br>'),email:d.account,group_id:Number(d.project),priority:Number(draft.priority),status:2,tags:draft.labels,due_by:draft.due?draft.due+'T00:00:00Z':null,...(draft.assignee?{responder_id:Number(draft.assignee)}:{})});return {id:requireId(i.id,name),key:String(i.id),url:new URL(d.api_base).origin+'/a/tickets/'+i.id}},
 async read(d,key,t) {const {ticket:i}=await api(`${d.api_base}/tickets/${id(t.remote_id)}`,key),comments=[];for(let page=1;;page++){const {conversations:rows}=await api(`${d.api_base}/tickets/${id(t.remote_id)}/conversations?per_page=100&page=${page}`,key);for(const c of rows){const {agent}=await api(`${d.api_base}/agents/${id(String(c.user_id))}`,key);comments.push({id:String(c.id),author:agent.first_name+' '+agent.last_name,body:c.body_text,at:c.created_at})}if(rows.length<100)break}let assignee=null;if(i.responder_id){const {agent}=await api(`${d.api_base}/agents/${id(String(i.responder_id))}`,key);assignee=agent.first_name+' '+agent.last_name}return {status:String(i.status),closed:[4,5].includes(i.status),assignee,due:dateOnly(i.due_by),comments}},
 async comment(d,key,t,body) {return requireId((await api(`${d.api_base}/tickets/${id(t.remote_id)}/notes`,key,'POST',{body:body.replaceAll('&','&amp;').replaceAll('<','&lt;'),private:true})).conversation.id,name)},
 async setDue(d,key,t,due) {await api(`${d.api_base}/tickets/${id(t.remote_id)}`,key,'PUT',{due_by:due?due+'T00:00:00Z':null})},
 async reopen(d,key,t) {await api(`${d.api_base}/tickets/${id(t.remote_id)}`,key,'PUT',{status:2})},
}
