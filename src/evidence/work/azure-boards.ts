import { TrackerFailure, type Adapter } from './client'
import { json, id, metadata, requireId } from './rest'
// https://learn.microsoft.com/rest/api/azure/devops/wit/work-items
const name='Azure Boards',headers=(key:string)=>({authorization:'Basic '+btoa(':'+key),accept:'application/json','content-type':'application/json-patch+json'})
const api=(url:string,key:string,method='GET',body?:unknown)=>json(url+(url.includes('?')?'&':'?')+'api-version=7.1',key,name,method,body,headers(key))
const patch=(field:string,value:unknown)=>({op:'add',path:'/fields/'+field,value})
function utcDay(value:unknown) {
 if(value==null)return null
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T/.test(value)||!Number.isFinite(Date.parse(value)))throw new TrackerFailure('unavailable',502,'Azure Boards returned an invalid mapped date field; coverage is unknown.')
 return new Date(value).toISOString().slice(0,10)
}
export const azureBoards: Adapter = {
 ...metadata(name,'','Azure DevOps project','A project-scoped PAT and https://dev.azure.com/organization address','Work Items: read and write in the selected project'),
 fieldNotes: 'Work-item type defaults to Task; reopen uses New. Priority and tags are native fields. The mapped due-date field must be a writable DateTime field on this work-item type (default Microsoft.VSTS.Scheduling.DueDate). Create and later changes write UTC midnight; reads use the UTC calendar day. Unsupported fields are refused visibly.',
 async verify(base,key,_account,project) {const p=await api(`${base}/_apis/projects/${id(project)}`,key);return {account:new URL(base).pathname.slice(1),projectName:p.name}},
 async create(d,key,draft) {const i=await api(`${d.api_base}/${id(d.project)}/_apis/wit/workitems/$${id(d.mapping.issue_type||'Task')}`,key,'POST',[patch('System.Title',draft.title),patch('System.Description',draft.description.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('\n','<br>')),patch('System.Tags',draft.labels.join('; ')),patch('Microsoft.VSTS.Common.Priority',Number(draft.priority)),patch(d.mapping.due_field,draft.due ? draft.due+'T00:00:00Z' : null),...(draft.assignee?[patch('System.AssignedTo',draft.assignee)]:[])]);return {id:requireId(i.id,name),key:String(i.id),url:i._links.html.href}},
 async read(d,key,t) {const base=`${d.api_base}/${id(d.project)}/_apis/wit/workitems/${id(t.remote_id)}`,i=await api(base,key),c=await json(base+'/comments?api-version=7.1-preview.4',key,name,'GET',undefined,headers(key));if(c.continuationToken)throw new TrackerFailure('unavailable',502,'Azure Boards comments exceed the current page; coverage is incomplete.');const f=i.fields;return {status:f['System.State'],closed:['Closed','Done','Removed'].includes(f['System.State']),assignee:f['System.AssignedTo']?.displayName??null,due:utcDay(f[d.mapping.due_field]),comments:c.comments.map((v:any)=>({id:String(v.id),author:v.createdBy.displayName,body:v.text,at:v.createdDate}))}},
 async comment(d,key,t,body) {return requireId((await json(`${d.api_base}/${id(d.project)}/_apis/wit/workitems/${id(t.remote_id)}/comments?api-version=7.1-preview.4`,key,name,'POST',{text:body},{...headers(key),'content-type':'application/json'})).id,name)},
 async setDue(d,key,t,due) {await api(`${d.api_base}/${id(d.project)}/_apis/wit/workitems/${id(t.remote_id)}`,key,'PATCH',[patch(d.mapping.due_field,due ? due+'T00:00:00Z' : null)])},
 async reopen(d,key,t) {await api(`${d.api_base}/${id(d.project)}/_apis/wit/workitems/${id(t.remote_id)}`,key,'PATCH',[patch('System.State','New')])},
}
