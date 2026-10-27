import { assertFieldBaseline, nativeIds, numericField, stateValue, call, dateOnly, TrackerFailure, type Adapter } from './client'
import { json, id, metadata, requireId } from './rest'
// https://github.com/basecamp/bc3-api/blob/master/sections/todos.md
const name='Basecamp'
const headers=(key:string)=>({authorization:'Bearer '+key,'content-type':'application/json',accept:'application/json','user-agent':'Evidence remediation (https://github.com/just-every/run-evidence)'})
const html=(s:string)=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('\n','<br>')
function parts(project:string) {const p=project.split('/');if(p.length!==3||p.some(v=>!/^\d+$/.test(v)))throw new TrackerFailure('invalid',400,'Use account-id/project-id/todolist-id for Basecamp.');return p}
const root=(d:{api_base:string;project:string})=>{const [a,b]=parts(d.project);return `${d.api_base}/${a}/buckets/${b}`}
const api=(url:string,key:string,method='GET',body?:unknown)=>json(url,key,name,method,body,headers(key))
export const basecamp: Adapter = {
 ...metadata(name,'https://3.basecampapi.com','account-id/project-id/todolist-id','A Basecamp OAuth access token','Read and write to-dos and comments in the chosen project'),
 webhook: 'Evidence-registered secret-address callback (unsigned provider events), with ten-minute polling as backstop',
 fieldNotes: 'Assignee and due date use native fields. The to-do API has no priority or label fields, so these mapped values are explicit description text. Due-date updates preserve content, description, assignees, subscribers and start date.',
 async verify(base,key,_account,project) {const [a,b,c]=parts(project),p=await api(`${base}/${a}/projects/${b}.json`,key),list=await api(`${base}/${a}/buckets/${b}/todolists/${c}.json`,key);return {account:a,projectName:p.name+' / '+list.name}},
 async create(d,key,draft) {const i=await api(`${root(d)}/todolists/${parts(d.project)[2]}/todos.json`,key,'POST',{content:draft.title,description:html(`${draft.description}\n\nPriority: ${draft.priority}\nLabels: ${draft.labels.join(', ')}`),due_on:draft.due,assignee_ids:draft.assignee?[Number(draft.assignee)]:[],notify:false});return {id:requireId(i.id,name),key:String(i.id),url:i.app_url}},
 async read(d,key,t) {
  const i=await api(`${root(d)}/todos/${id(t.remote_id)}.json`,key),comments=[],seen=new Set<string>()
  let next:string|null=`${root(d)}/recordings/${id(t.remote_id)}/comments.json`
  while(next) {
   const url=new URL(next)
   if(url.origin!==new URL(d.api_base).origin||!url.pathname.startsWith('/'+parts(d.project)[0]+'/')||seen.has(next))throw new TrackerFailure('unavailable',502,'Basecamp comment pagination is unsafe or made no progress.')
   seen.add(next)
   const response=await call(next,{headers:headers(key),label:name}),rows=response.body as unknown as any[]
   comments.push(...rows.map((c:any)=>({id:String(c.id),author:c.creator.name,body:c.content,at:c.created_at})))
   next=response.headers.get('link')?.match(/<([^>]+)>;\s*rel="next"/)?.[1]??null
  }
  return {status_id:typeof i.completed==='boolean'?(i.completed?'completed':'incomplete'):null,assignee_ids:nativeIds(i.assignees?.map((a:any)=>a.id)),status:i.completed?'completed':'incomplete',closed:i.completed,assignee:i.assignees.map((a:any)=>a.name).join(', ')||null,due:dateOnly(i.due_on),comments}
 },
 async comment(d,key,t,body) {return requireId((await api(`${root(d)}/recordings/${id(t.remote_id)}/comments.json`,key,'POST',{content:body.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('\n','<br>')})).id,name)},
 async setFields(d,key,t,fields,lastRead) {
  // Completion is a separate native endpoint; validate before either mutation.
  const completed=fields.status===undefined?undefined:stateValue(fields.status,['completed','incomplete'],name)==='completed'
  const assignee=fields.assignee==null?null:numericField(fields.assignee,name)
  const url=`${root(d)}/todos/${id(t.remote_id)}.json`
  if(fields.assignee!==undefined) {
   const i=await api(url,key)
   assertFieldBaseline(lastRead,{status_id:typeof i.completed==='boolean'?(i.completed?'completed':'incomplete'):null,assignee_ids:nativeIds(i.assignees?.map((a:any)=>a.id))},fields,name)
   await api(url,key,'PUT',{content:i.content,description:i.description,assignee_ids:assignee===null?[]:[assignee],completion_subscriber_ids:i.completion_subscribers.map((a:any)=>a.id),starts_on:i.starts_on,due_on:i.due_on,notify:false})
  }
  if(completed!==undefined)await api(`${root(d)}/todos/${id(t.remote_id)}/completion.json`,key,completed?'POST':'DELETE')
 },
 async setDue(d,key,t,due) {const url=`${root(d)}/todos/${id(t.remote_id)}.json`,i=await api(url,key);await api(url,key,'PUT',{content:i.content,description:i.description,assignee_ids:i.assignees.map((a:any)=>a.id),completion_subscriber_ids:i.completion_subscribers.map((a:any)=>a.id),starts_on:i.starts_on,due_on:due,notify:false})},
 async reopen(d,key,t) {await api(`${root(d)}/todos/${id(t.remote_id)}/completion.json`,key,'DELETE')},
}
