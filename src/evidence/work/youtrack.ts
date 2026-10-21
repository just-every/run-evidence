import { TrackerFailure, type Adapter } from './client'
import { json, id, metadata, requireId, epoch, isoDay, namedIds } from './rest'
// https://www.jetbrains.com/help/youtrack/devportal/resource-api-issues.html
const name='YouTrack', field=(name:string,type:string,value:unknown)=>({name,$type:type,value})
export const youtrack: Adapter = {
 ...metadata(name,'','Project ID','A YouTrack permanent token and https://your-domain.youtrack.cloud/api address','Read and create/update issues and comments in the selected project'),
 webhook: 'authenticated provider webhook, with polling every 10 minutes',
 defaultPriorities:{critical:'Critical',high:'Major',medium:'Normal',low:'Minor'},
 fieldNotes: 'Needs the project custom fields Priority, Due Date, Assignee and State. Priority enum names and visible native tag names must exist; duplicate tag names are refused. Reopen uses the Open state. Dates are UTC calendar days.',
 async verify(base,key,_account,project) {const p=await json(`${base}/admin/projects/${id(project)}?fields=id,name,shortName`,key,name),u=await json(base+'/users/me?fields=name,login',key,name);return {account:u.login,projectName:p.name}},
 async create(d,key,draft) {
  const tags:{id:string;name:string}[]=[]
  if(draft.labels.length)for(let skip=0;;skip+=100){const rows=await json(`${d.api_base}/tags?fields=id,name&$top=100&$skip=${skip}`,key,name);if(!Array.isArray(rows))throw new TrackerFailure('unavailable',502,'YouTrack native tag metadata is unavailable.');tags.push(...rows);if(rows.length<100)break}
  const nativeTags=namedIds(tags,draft.labels,name).map(id=>({id}))
  const i=await json(d.api_base+'/issues?fields=id,idReadable',key,name,'POST',{project:{id:d.project},summary:draft.title,description:draft.description,tags:nativeTags,customFields:[field('Priority','SingleEnumIssueCustomField',{name:draft.priority}),field('Due Date','DateIssueCustomField',epoch(draft.due)),...(draft.assignee?[field('Assignee','SingleUserIssueCustomField',{id:draft.assignee})]:[])]})
  return {id:requireId(i.id,name),key:i.idReadable,url:d.api_base.replace(/\/api$/,'')+'/issue/'+id(i.idReadable)}
 },
 async read(d,key,t) {const url=`${d.api_base}/issues/${id(t.remote_id)}`,i=await json(url+'?fields=id,resolved,customFields(name,value(name,fullName,presentation,isResolved))',key,name),comments=[];for(let skip=0;;skip+=100){const rows=await json(`${url}/comments?fields=id,text,created,author(fullName)&$top=100&$skip=${skip}`,key,name);comments.push(...rows.map((c:any)=>({id:c.id,author:c.author.fullName,body:c.text,at:new Date(c.created).toISOString()})));if(rows.length<100)break}const f=(n:string)=>i.customFields.find((f:any)=>f.name===n)?.value;return {status:f('State')?.name??(i.resolved?'Resolved':'Unresolved'),closed:i.resolved!=null,assignee:f('Assignee')?.fullName??null,due:isoDay(f('Due Date')),comments}},
 async comment(d,key,t,body) {return requireId((await json(`${d.api_base}/issues/${id(t.remote_id)}/comments?fields=id`,key,name,'POST',{text:body})).id,name)},
 async setDue(d,key,t,due) {await json(`${d.api_base}/issues/${id(t.remote_id)}`,key,name,'POST',{customFields:[field('Due Date','DateIssueCustomField',epoch(due))]})},
 async reopen(d,key,t) {await json(`${d.api_base}/issues/${id(t.remote_id)}`,key,name,'POST',{customFields:[field('State','StateIssueCustomField',{name:'Open'})]})},
}
