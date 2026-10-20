import { TrackerFailure, type Adapter } from './client'
import { json, id, metadata, requireId } from './rest'
// https://learn.microsoft.com/rest/api/azure/devops/wit/work-items
const name='Azure Boards',headers=(key:string)=>({authorization:'Basic '+btoa(':'+key),accept:'application/json','content-type':'application/json-patch+json'})
const api=(url:string,key:string,method='GET',body?:unknown)=>json(url+(url.includes('?')?'&':'?')+'api-version=7.1',key,name,method,body,headers(key))
const patch=(field:string,value:unknown)=>({op:'add',path:'/fields/'+field,value})
export const azureBoards: Adapter = {
 ...metadata(name,'','Azure DevOps project','A project-scoped PAT and https://dev.azure.com/organization address','Work Items: read and write in the selected project'),
 // DueDate is not supported by every Azure process; retain the deadline in text.
 supportsDue:false,
 fieldNotes: 'Work-item type defaults to Task; reopen uses New. Priority and tags are native fields. The deadline stays in description text because Azure process templates do not share a native due-date field; later target changes are not synchronized to that text yet.',
 async verify(base,key,_account,project) {const p=await api(`${base}/_apis/projects/${id(project)}`,key);return {account:new URL(base).pathname.slice(1),projectName:p.name}},
 async create(d,key,draft) {const i=await api(`${d.api_base}/${id(d.project)}/_apis/wit/workitems/$${id(d.mapping.issue_type||'Task')}`,key,'POST',[patch('System.Title',draft.title),patch('System.Description',draft.description.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('\n','<br>')),patch('System.Tags',draft.labels.join('; ')),patch('Microsoft.VSTS.Common.Priority',Number(draft.priority)),...(draft.assignee?[patch('System.AssignedTo',draft.assignee)]:[])]);return {id:requireId(i.id,name),key:String(i.id),url:i._links.html.href}},
 async read(d,key,t) {const base=`${d.api_base}/${id(d.project)}/_apis/wit/workitems/${id(t.remote_id)}`,i=await api(base,key),c=await json(base+'/comments?api-version=7.1-preview.4',key,name,'GET',undefined,headers(key));if(c.continuationToken)throw new TrackerFailure('unavailable',502,'Azure Boards comments exceed the current page; coverage is incomplete.');const f=i.fields;return {status:f['System.State'],closed:['Closed','Done','Removed'].includes(f['System.State']),assignee:f['System.AssignedTo']?.displayName??null,due:null,comments:c.comments.map((v:any)=>({id:String(v.id),author:v.createdBy.displayName,body:v.text,at:v.createdDate}))}},
 async comment(d,key,t,body) {return requireId((await json(`${d.api_base}/${id(d.project)}/_apis/wit/workitems/${id(t.remote_id)}/comments?api-version=7.1-preview.4`,key,name,'POST',{text:body},{...headers(key),'content-type':'application/json'})).id,name)},
 async setDue() {throw new TrackerFailure('invalid',400,'Azure Boards deadlines are retained in ticket text; no process-specific date field is configured.')},
 async reopen(d,key,t) {await api(`${d.api_base}/${id(d.project)}/_apis/wit/workitems/${id(t.remote_id)}`,key,'PATCH',[patch('System.State','New')])},
}
