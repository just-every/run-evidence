import { assertFieldBaseline, nativeId, nativeIds, numericField, TrackerFailure, type Adapter } from './client'
import { json, id, metadata, requireId, epoch, isoDay } from './rest'
// https://developer.clickup.com/reference/createtask and /gettask
const name='ClickUp', headers=(key:string)=>({authorization:key,accept:'application/json','content-type':'application/json'})
const api=(url:string,key:string,method='GET',body?:unknown)=>json(url,key,name,method,body,headers(key))
export const clickup: Adapter = {
 ...metadata(name,'https://api.clickup.com/api/v2','List ID','A ClickUp personal API token','Read and write tasks, comments and tags in the chosen list'),
 webhook: 'ClickUp webhooks (X-Signature), with ten-minute polling fallback',
 fieldNotes: 'Priority, tags, assignees and due date use native fields. Dates are UTC calendar days; reopen uses the list open status.',
 async verify(base,key,_account,project) { const u=await api(base+'/user',key),p=await api(`${base}/list/${id(project)}`,key);return {account:u.user.username,projectName:p.name} },
 async create(d,key,draft) {const i=await api(`${d.api_base}/list/${id(d.project)}/task`,key,'POST',{name:draft.title,description:draft.description,priority:Number(draft.priority),tags:draft.labels,due_date:epoch(draft.due),due_date_time:false,...(draft.assignee?{assignees:[Number(draft.assignee)]}:{})});return {id:requireId(i.id,name),key:i.custom_id??i.id,url:i.url} },
 async read(d,key,t) {
  const i=await api(`${d.api_base}/task/${id(t.remote_id)}`,key), comments=[]
  let start:unknown, start_id:unknown
  for(;;) {const p=await api(`${d.api_base}/task/${id(t.remote_id)}/comment${start?`?start=${start}&start_id=${start_id}`:''}`,key);const rows=p.comments??[];comments.push(...rows.map((c:any)=>({id:String(c.id),author:c.user.username,body:c.comment_text,at:new Date(Number(c.date)).toISOString()})));if(rows.length<25)break;const last=rows.at(-1);if(start_id===last.id)throw new TrackerFailure('unavailable',502,'ClickUp comment pagination made no progress.');start=last.date;start_id=last.id}
  return {status_id:nativeId(i.status.status),assignee_ids:nativeIds(i.assignees?.map((a:any)=>a.id)),status:i.status.status,closed:['closed','done'].includes(i.status.type),assignee:i.assignees.map((a:any)=>a.username).join(', ')||null,due:isoDay(i.due_date),comments}
 },
 async comment(d,key,t,body) { return requireId((await api(`${d.api_base}/task/${id(t.remote_id)}/comment`,key,'POST',{comment_text:body,notify_all:false})).id,name) },
 async setFields(d,key,t,fields,lastRead) {
  const values:Record<string,unknown>={}
  if(fields.status!==undefined)values.status=fields.status
  if(fields.assignee!==undefined) {
   const next=fields.assignee===null?null:numericField(fields.assignee,name)
   const current=await api(`${d.api_base}/task/${id(t.remote_id)}`,key)
   assertFieldBaseline(lastRead,{status_id:nativeId(current.status?.status),assignee_ids:nativeIds(current.assignees?.map((a:any)=>a.id))},fields,name)
   if(!Array.isArray(current.assignees))throw new TrackerFailure('unavailable',502,'ClickUp did not return the current assignees.')
   const previous=current.assignees.map((a:any)=>numericField(String(a.id),name))
   values.assignees={add:next===null?[]:[next],rem:previous.filter((v:number)=>v!==next)}
  }
  await api(`${d.api_base}/task/${id(t.remote_id)}`,key,'PUT',values)
 },
 async setDue(d,key,t,due) {await api(`${d.api_base}/task/${id(t.remote_id)}`,key,'PUT',{due_date:epoch(due),due_date_time:false})},
 async reopen(d,key,t) {const list=await api(`${d.api_base}/list/${id(d.project)}`,key);const open=list.statuses?.find((s:any)=>s.type==='open');if(!open)throw new TrackerFailure('invalid',400,'ClickUp list has no open status.');await api(`${d.api_base}/task/${id(t.remote_id)}`,key,'PUT',{status:open.status})},
}
