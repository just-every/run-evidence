import { nativeId, nativeIds, numericField, dateOnly, TrackerFailure, type Adapter } from './client'
import { json, id, metadata, requireId } from './rest'
// https://api.freshservice.com/v2/#tickets
const name='Freshservice', headers=(key:string)=>({authorization:'Basic '+btoa(key+':X'),accept:'application/json','content-type':'application/json'})
const api=(url:string,key:string,method='GET',body?:unknown)=>json(url,key,name,method,body,headers(key))
async function actor(base:string,key:string,user:string|number) {
 try {const {agent}=await api(`${base}/agents/${id(String(user))}`,key);return [agent.first_name,agent.last_name].filter(Boolean).join(' ')||`Freshservice user ${user}`}
 catch(error) {if(error instanceof TrackerFailure && error.kind==='not found')return `Freshservice user ${user}`;throw error}
}
export const freshservice: Adapter = {
 ...metadata(name,'','Group ID','A Freshservice API key, requester email and https://your-domain.freshservice.com/api/v2 address','Read and write tickets and notes in the selected group'),
 webhook: 'authenticated provider webhook, with polling every 10 minutes',
 defaultPriorities:{critical:'4',high:'3',medium:'2',low:'1'},
 fieldNotes: 'Group, priority, tags, responder and due date use native fields. The account email is the requester. Status 4 or 5 is closed; reopen uses 2. Comments are private notes.',
 async verify(base,key,account,project) {const g=await api(`${base}/groups/${id(project)}`,key);if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(account))throw new TrackerFailure('invalid',400,'Freshservice requires the requester account email.');return {account,projectName:g.group.name}},
 async create(d,key,draft) {const {ticket:i}=await api(d.api_base+'/tickets',key,'POST',{subject:draft.title,description:draft.description.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('\n','<br>'),email:d.account,group_id:Number(d.project),priority:Number(draft.priority),status:2,tags:draft.labels,due_by:draft.due?draft.due+'T00:00:00Z':null,...(draft.assignee?{responder_id:Number(draft.assignee)}:{})});return {id:requireId(i.id,name),key:String(i.id),url:new URL(d.api_base).origin+'/a/tickets/'+i.id}},
 async read(d,key,t) {const {ticket:i}=await api(`${d.api_base}/tickets/${id(t.remote_id)}`,key),comments=[];for(let page=1;;page++){const {conversations:rows}=await api(`${d.api_base}/tickets/${id(t.remote_id)}/conversations?per_page=100&page=${page}`,key);for(const c of rows){comments.push({id:String(c.id),author:await actor(d.api_base,key,c.user_id),body:c.body_text,at:c.created_at})}if(rows.length<100)break}let assignee=null;if(i.responder_id){assignee=await actor(d.api_base,key,i.responder_id)}return {status_id:nativeId(i.status),assignee_ids:i.responder_id===null?[]:nativeIds([i.responder_id]),status:String(i.status),closed:[4,5].includes(i.status),assignee,due:dateOnly(i.due_by),comments}},
 async comment(d,key,t,body) {return requireId((await api(`${d.api_base}/tickets/${id(t.remote_id)}/notes`,key,'POST',{body:body.replaceAll('&','&amp;').replaceAll('<','&lt;'),private:true})).conversation.id,name)},
 async setFields(d,key,t,fields) {
  const values:Record<string,unknown>={}
  if(fields.assignee!==undefined)values.responder_id=fields.assignee===null?null:numericField(fields.assignee,name)
  if(fields.status!==undefined)values.status=numericField(fields.status,name)
  await api(`${d.api_base}/tickets/${id(t.remote_id)}`,key,'PUT',values)
 },
 async setDue(d,key,t,due) {await api(`${d.api_base}/tickets/${id(t.remote_id)}`,key,'PUT',{due_by:due?due+'T00:00:00Z':null})},
 async reopen(d,key,t) {await api(`${d.api_base}/tickets/${id(t.remote_id)}`,key,'PUT',{status:2})},
}
