// WORK-001: paid/network edges only. Response/request vocabulary follows each
// provider's official reference linked in the adapter; this is not live-provider proof.
import assert from 'node:assert/strict'
import { originalTrackerReply } from './original-tracker-fixture.mjs'
export const configs = {
 vector: { base:'https://vector.example.com',project:'01K0000000000000000000TEAM',priority:'high' },
 jira: { base:'https://northstar.atlassian.net',project:'SEC',priority:'High',account:'dana@northstar.test' },
 linear: { base:'https://api.linear.app',project:'team-lin',priority:'2' },
 github: { base:'https://api.github.com',project:'northstar/web',priority:'priority: high',textDue:true },
 gitlab: { base:'https://gitlab.com/api/v4',project:'42',priority:'priority::high' },
 'azure-boards': { base:'https://dev.azure.com/northstar',project:'Security',priority:'2' },
 shortcut: { base:'https://api.app.shortcut.com/api/v3',project:'42',priority:'High' },
 clickup: { base:'https://api.clickup.com/api/v2',project:'42',priority:'2' },
 monday: { base:'https://api.monday.com/v2',project:'42',priority:'High' },
 basecamp: { base:'https://3.basecampapi.com',project:'100/200/300',priority:'2' },
 freshservice: { base:'https://northstar.freshservice.com/api/v2',project:'42',priority:'3',account:'requester@northstar.test' },
 youtrack: { base:'https://northstar.youtrack.cloud/api',project:'0-42',priority:'Major' },
 asana: { base:'https://app.asana.com/api/1.0',project:'1200',priority:'High' },
}
const reply=(status,body)=>new Response(body===undefined?null:JSON.stringify(body),{status,headers:{'content-type':'application/json'}})
const columns=[{id:'tags1',title:'Tags',type:'tags',settings_str:'{}'},{id:'description1',title:'Description',type:'long_text',settings_str:'{}'},{id:'date1',title:'Due date',type:'date',settings_str:'{}'},{id:'person1',title:'Owner',type:'people',settings_str:'{}'},{id:'status1',title:'Status',type:'status',settings_str:JSON.stringify({labels:{0:'Working',1:'Done'},done_colors:[1]})},{id:'priority1',title:'Priority',type:'status',settings_str:'{}'}]
export function trackerFixture() {
 let seq=0
 const issues=new Map(),keys=Object.fromEntries(Object.keys(configs).map((p,index)=>[p,'synthetic-evidence-'+(index+1)])),calls=[]
 const state={rejectCreate:null,clock:'2026-10-11T12:00:00Z',handshake:null,rejectRegistration:false,rejectComments:false}
 const create=(p,fields)=>{const i={id:String(++seq),provider:p,title:'',description:'',due:null,assignee:null,status:'Open',closed:false,comments:[],labels:[],...fields};issues.set(p+':'+i.id,i);return i}
 const note=(i,body)=>{const c={id:i.provider==='vector'?String(++seq).padStart(26,'0'):'c'+ ++seq,body,author:'Evidence owner',at:state.clock};i.comments.push(c);return c}
 const basecampHooks=new Map()
 state.basecampHooks=basecampHooks
 const board={id:'42',name:'Security',columns}
 const find=(p,n)=>issues.get(p+':'+(p==='vector'?String(n).replace(/^FLW-/, ''):n))
 const date=n=>n==null?null:new Date(Number(n)).toISOString().slice(0,10)
 const strip=v=>String(v??'').replaceAll('<br>','\n').replaceAll('&lt;','<').replaceAll('&amp;','&')
 async function outbound(request) {
  const u=new URL(request.url),p=Object.keys(configs).find(p=>u.origin===new URL(configs[p].base).origin)
  if(!p)return null
  const c=configs[p],path=u.pathname.slice(new URL(c.base).pathname.replace(/\/$/,'').length),method=request.method,raw=await request.text(),body=raw?JSON.parse(raw):null
  calls.push({provider:p,method,path})
  const expected=p==='freshservice'?'Basic '+Buffer.from(keys[p]+':X').toString('base64'):p==='azure-boards'?'Basic '+Buffer.from(':'+keys[p]).toString('base64'):p==='jira'?'Basic '+Buffer.from(c.account+':'+keys[p]).toString('base64'):['monday','clickup','linear'].includes(p)?keys[p]:p==='shortcut'?keys[p]:'Bearer '+keys[p]
  if(request.headers.get(p==='shortcut'?'shortcut-token':'authorization')!==expected)return p==='monday'?reply(200,{errors:[{message:'Not authenticated',extensions:{code:'NOT_AUTHENTICATED'}}]}):reply(401,{message:'Credential revoked'})
  const creating=method==='POST' && (path==='/projects/42/issues'||path==='/Security/_apis/wit/workitems/$Task'||path==='/stories'||path==='/list/42/task'||p==='monday'&&body.query.includes('create_item(')||path==='/100/buckets/200/todolists/300/todos.json'||path==='/tickets'||path==='/issues'||path==='/tasks'||p==='linear'&&body?.query.includes('issueCreate')||path==='/api/v1/issues'||path==='/rest/api/3/issue'||path==='/repos/northstar/web/issues')
  if(state.rejectCreate===p&&creating)return p==='monday'?reply(200,{errors:[{message:'Column mapping is not valid'}]}):reply(422,{message:'Field mapping is not valid'})
  const original=originalTrackerReply({p,path,method,body,c,state,create,find,note,url:u});if(original)return original
  if(p==='gitlab') {
   if(path==='/projects/42')return reply(200,{id:42,name:'Security',namespace:{full_path:'northstar'},path_with_namespace:'northstar/security'})
   if(path==='/projects/42/issues'&&method==='POST') {if(body.labels.includes('invalid-priority'))return reply(422,{message:'Invalid priority label'});assert.ok(body.title);const i=create(p,{title:body.title,description:body.description,labels:body.labels.split(','),priority:body.labels.split(',').at(-1),due:body.due_date,assignee:body.assignee_ids?.length?'Dana Lee':null});return reply(201,{iid:Number(i.id),web_url:`https://gitlab.com/northstar/security/-/issues/${i.id}`})}
   const m=/^\/projects\/42\/issues\/(\d+)(\/notes)?$/.exec(path),i=m&&find(p,m[1]);if(!i||i.deleted)return reply(404,{message:'Issue not found'})
   if(m[2]) {if(method==='POST'){const n=note(i,body.body);return reply(201,{id:n.id})}return reply(200,i.comments.map(n=>({id:n.id,system:false,author:{name:n.author},body:n.body,created_at:n.at})))}
   if(method==='PUT'){if(Object.hasOwn(body,'due_date'))i.due=body.due_date;if(body.state_event==='reopen')i.closed=false;return reply(200,{})}
   return reply(200,{state:i.closed?'closed':'opened',assignees:i.assignee?[{name:i.assignee}]:[],due_date:i.due})
  }
  if(p==='azure-boards') {
   assert.ok(u.searchParams.get('api-version'))
   if(path==='/_apis/projects/Security')return reply(200,{id:'42',name:'Security'})
   if(path==='/Security/_apis/wit/workitems/$Task'&&method==='POST'){const f=Object.fromEntries(body.map(v=>[v.path.slice(8),v.value]));if(f['Microsoft.VSTS.Common.Priority']===0)return reply(400,{message:'Invalid priority'});assert.ok(f['System.Title']);if(!Object.hasOwn(f,'Custom.RemediationDue'))return reply(400,{message:'Date field mapping is not valid'});assert.ok(f['Custom.RemediationDue']===null||f['Custom.RemediationDue'].endsWith('T00:00:00Z'));const i=create(p,{title:f['System.Title'],description:strip(f['System.Description']),due:f['Custom.RemediationDue']?.slice(0,10)??null,priority:String(f['Microsoft.VSTS.Common.Priority']),labels:f['System.Tags'].split('; '),assignee:f['System.AssignedTo']?'Dana Lee':null});return reply(200,{id:Number(i.id),_links:{html:{href:`https://dev.azure.com/northstar/Security/_workitems/edit/${i.id}`}}})}
   const m=/^\/Security\/_apis\/wit\/workitems\/(\d+)(\/comments)?$/.exec(path),i=m&&find(p,m[1]);if(!i||i.deleted)return reply(404,{message:'Work item not found'})
   if(m[2]){if(method==='POST'){const n=note(i,body.text);return reply(200,{id:n.id})}return reply(200,{comments:i.comments.map(n=>({id:n.id,text:n.body,createdBy:{displayName:n.author},createdDate:n.at}))})}
   if(method==='PATCH'){for(const op of body){if(op.path==='/fields/System.State')i.closed=false;else if(op.path==='/fields/Custom.RemediationDue'){assert.ok(op.value===null||op.value.endsWith('T00:00:00Z'));i.due=op.value?.slice(0,10)??null}else return reply(400,{message:'Date field mapping is not valid'})}return reply(200,{})}
   return reply(200,{fields:{'Custom.RemediationDue':i.dueInstant??(i.due?i.due+'T00:00:00Z':null),'System.State':i.closed?'Done':i.status,'System.AssignedTo':i.assignee?{displayName:i.assignee}:null}})
  }
  if(p==='shortcut') {
   if(path==='/custom-fields')return reply(200,[{id:'priority-field',name:'Priority',canonical_name:'priority',enabled:true,field_type:'enum',values:['Critical','High','Medium','Low'].map(value=>({id:'priority-'+value,value,enabled:true}))}])
   if(path==='/member')return reply(200,{id:'u1',profile:{name:'Dana Lee'}})
   if(path==='/members')return reply(200,[{id:'u1',profile:{name:'Dana Lee'}},{id:'u2',profile:{name:'Lena Ortiz'}}])
   if(path==='/projects/42')return reply(200,{id:42,name:'Security'})
   if(path==='/workflows')return reply(200,[{id:42,states:[{id:1,name:'Open',type:'unstarted'},{id:2,name:'In Progress',type:'started'},{id:3,name:'Done',type:'done'}]}])
   if(path==='/stories'&&method==='POST'){assert.equal(body.project_id,42);if(body.description.includes('Priority: invalid-priority'))return reply(400,{message:'Invalid priority'});const i=create(p,{title:body.name,description:body.description,labels:body.labels.map(l=>l.name),priority:body.custom_fields?.[0]?.value_id?.replace('priority-',''),due:body.deadline?.slice(0,10),assignee:body.owner_ids.length?'Dana Lee':null});return reply(201,{id:Number(i.id),app_url:`https://app.shortcut.com/northstar/story/${i.id}`})}
   const m=/^\/stories\/(\d+)(\/comments)?$/.exec(path),i=m&&find(p,m[1]);if(!i||i.deleted)return reply(404,{message:'Story not found'})
   if(m[2])return reply(201,{id:note(i,body.text).id})
   if(method==='PUT'){if(Object.hasOwn(body,'deadline'))i.due=body.deadline?.slice(0,10)??null;if(body.workflow_state_id)i.closed=false;return reply(200,{})}
   return reply(200,{id:Number(i.id),workflow_state_id:i.closed?3:i.status==='In Progress'?2:1,owner_ids:i.assignee?[i.assignee==='Dana Lee'?'u1':'u2']:[],deadline:i.due?i.due+'T00:00:00Z':null,comments:i.comments.map(n=>({id:n.id,author_id:n.author==='Dana Lee'?'u1':'u2',text:n.body,created_at:n.at}))})
  }
  if(p==='clickup') {
   if(path==='/user')return reply(200,{user:{id:1,username:'Dana Lee'}})
   if(path==='/list/42')return reply(200,{id:'42',name:'Security',statuses:[{status:'Open',type:'open'},{status:'In Progress',type:'custom'},{status:'Done',type:'closed'}]})
   if(path==='/list/42/task'&&method==='POST'){if(!body.priority)return reply(400,{message:'Invalid priority'});assert.ok(body.name);const i=create(p,{title:body.name,description:body.description,priority:String(body.priority),labels:body.tags,due:date(body.due_date),assignee:body.assignees?.length?'Dana Lee':null});return reply(200,{id:i.id,url:`https://app.clickup.com/t/${i.id}`})}
   const m=/^\/task\/(\d+)(\/comment)?$/.exec(path),i=m&&find(p,m[1]);if(!i||i.deleted)return reply(404,{message:'Task not found'})
   if(m[2]){if(method==='POST')return reply(200,{id:note(i,body.comment_text).id});return reply(200,{comments:i.comments.map(n=>({id:n.id,user:{username:n.author},comment_text:n.body,date:String(Date.parse(n.at))}))})}
   if(method==='PUT'){if(Object.hasOwn(body,'due_date'))i.due=date(body.due_date);if(body.status)i.closed=false;return reply(200,{})}
   return reply(200,{id:i.id,status:{status:i.closed?'Done':i.status,type:i.closed?'closed':'open'},assignees:i.assignee?[{username:i.assignee}]:[],due_date:i.due?String(Date.parse(i.due+'T00:00:00Z')):null})
  }
  if(p==='monday') {
   assert.equal(request.headers.get('api-version'),'2026-04')
   const q=body.query,v=body.variables??{},data=x=>reply(200,{data:x})
   if(q.includes('boards('))return data({boards:[board]})
   if(q==='{me{name}}')return data({me:{name:'Dana Lee'}})
   if(q.includes('create_or_get_tag('))return data({create_or_get_tag:{id:v.name==='evidence'?'101':'102'}})
   if(q.includes('create_item(')){const f=JSON.parse(v.values);if(f.priority1.label==='invalid-priority')return reply(200,{errors:[{message:'Invalid priority label'}]});const i=create(p,{title:v.name,description:f.description1.text,priority:f.priority1.label,labels:f.tags1.tag_ids,due:f.date1.date,assignee:f.person1?'Dana Lee':null});return data({create_item:{id:i.id,url:`https://northstar.monday.com/boards/42/pulses/${i.id}`}})}
   const n=v.item??v.ids?.[0],i=find(p,String(n));if(!i||i.deleted)return data({items:[]})
   if(q.includes('create_update(')){if(state.rejectComments)return reply(200,{errors:[{message:'Update is not permitted'}]});const c=note(i,strip(v.body));if(!i.description)i.description=c.body;return data({create_update:{id:c.id}})}
   if(q.includes('change_multiple_column_values(')){const f=JSON.parse(v.values);if(f.date1)i.due=f.date1.date;if(f.status1)i.closed=f.status1.index===1;return data({change_multiple_column_values:{id:i.id}})}
   if(q.includes('updates('))return data({items:[{updates:i.comments.map(n=>({id:n.id,text_body:n.body,created_at:n.at,creator:{name:n.author}}))}]})
   return data({items:[{id:i.id,column_values:[{id:'date1',value:JSON.stringify({date:i.due}),text:i.due},{id:'person1',value:'{}',text:i.assignee??''},{id:'status1',value:JSON.stringify({index:i.closed?1:0}),text:i.closed?'Done':i.status}]}]})
  }
  if(p==='basecamp') {
   if(path==='/100/buckets/200/webhooks.json'&&method==='POST') {
    assert.deepEqual(body.types,['Todo','Comment']);assert.equal(new URL(body.payload_url).protocol,'https:')
    assert.match(new URL(body.payload_url).searchParams.get('secret'),/^[a-f0-9]{64}$/)
    if(state.rejectBasecampRegistration)return reply(422,{message:'Rejected address '+body.payload_url})
    const h={id:++seq,active:true,payload_url:body.payload_url,types:body.types};basecampHooks.set(String(h.id),h);return reply(201,h)
   }
   const hook=/^\/100\/webhooks\/(\d+)\.json$/.exec(path)
   if(hook){const h=basecampHooks.get(hook[1]);return h?reply(200,h):reply(404,{})}

   if(path==='/100/projects/200.json')return reply(200,{id:200,name:'Security'})
   if(path==='/100/buckets/200/todolists/300.json')return reply(200,{id:300,name:'Remediation'})
   if(path==='/100/buckets/200/todolists/300/todos.json'&&method==='POST'){if(body.description.includes('Priority: invalid-priority'))return reply(422,{message:'Invalid priority'});const i=create(p,{title:body.content,description:strip(body.description),priority:strip(body.description).match(/Priority: (.+)/)[1],labels:strip(body.description).match(/Labels: (.+)/)[1].split(', '),due:body.due_on,assignee:body.assignee_ids.length?'Dana Lee':null});return reply(201,{id:Number(i.id),app_url:`https://3.basecamp.com/100/buckets/200/todos/${i.id}`})}
   const m=/^\/100\/buckets\/200\/(?:todos|recordings)\/(\d+)(\/comments|\/completion)?\.json$/.exec(path),i=m&&find(p,m[1]);if(!i||i.deleted)return reply(404,{message:'To-do not found'})
   if(m[2]==='/comments'){if(method==='POST')return reply(201,{id:note(i,strip(body.content)).id});return reply(200,i.comments.map(n=>({id:n.id,content:n.body,created_at:n.at,creator:{name:n.author}})))}
   if(m[2]==='/completion'){i.closed=false;return reply(204)}
   if(method==='PUT'){assert.equal(body.content,i.title,'Basecamp update must preserve required content');assert.equal(strip(body.description),i.description);assert.deepEqual(body.assignee_ids,i.assignee?[1]:[]);assert.deepEqual(body.completion_subscriber_ids,[3]);assert.equal(body.starts_on,'2026-10-01');i.due=body.due_on;return reply(200,{})}
   return reply(200,{id:Number(i.id),completed:i.closed,content:i.title,description:i.description,starts_on:'2026-10-01',completion_subscribers:[{id:3}],due_on:i.due,assignees:i.assignee?[{id:1,name:i.assignee}]:[]})
  }
  if(p==='freshservice') {
   if(path==='/groups/42')return reply(200,{group:{id:42,name:'Security'}})
   if(path==='/agents/99')return reply(404,{message:'Not an agent'})
   if(path.startsWith('/agents/'))return reply(200,{agent:{first_name:path.endsWith('/2')?'Lena':'Dana',last_name:path.endsWith('/2')?'Ortiz':'Lee'}})
   if(path==='/tickets'&&method==='POST'){if(!body.priority)return reply(400,{message:'Invalid priority'});assert.equal(body.email,c.account);assert.equal(body.group_id,42);const i=create(p,{title:body.subject,description:strip(body.description),priority:String(body.priority),labels:body.tags,due:body.due_by?.slice(0,10),assignee:body.responder_id?'Dana Lee':null});return reply(201,{ticket:{id:Number(i.id)}})}
   const m=/^\/tickets\/(\d+)(\/conversations|\/notes)?$/.exec(path),i=m&&find(p,m[1]);if(!i||i.deleted)return reply(404,{message:'Ticket not found'})
   if(m[2]==='/notes'){assert.equal(body.private,true);return reply(201,{conversation:{id:note(i,strip(body.body)).id}})}
   if(m[2]==='/conversations')return reply(200,{conversations:i.comments.map(n=>({id:n.id,user_id:n.id==='requester-note'?99:n.author==='Dana Lee'?1:2,body_text:n.body,created_at:n.at}))})
   if(method==='PUT'){if(Object.hasOwn(body,'due_by'))i.due=body.due_by?.slice(0,10)??null;if(body.status===2)i.closed=false;return reply(200,{ticket:{id:Number(i.id)}})}
   return reply(200,{ticket:{id:Number(i.id),status:i.closed?4:2,responder_id:i.assignee?(i.assignee==='Dana Lee'?1:2):null,due_by:i.due?i.due+'T00:00:00Z':null}})
  }
  if(p==='youtrack') {
   if(path==='/admin/projects/0-42')return reply(200,{id:'0-42',name:'Security',shortName:'SEC'})
   if(path==='/tags')return reply(200,[{id:'tag-evidence',name:'evidence'},{id:'tag-compliance',name:'compliance'}])
   if(path==='/users/me')return reply(200,{name:'Dana Lee',login:'dana'})
   if(path==='/issues'&&method==='POST'){const f=n=>body.customFields.find(f=>f.name===n)?.value;if(f('Priority').name==='invalid-priority')return reply(400,{message:'Invalid priority'});assert.equal(body.project.id,'0-42');const i=create(p,{title:body.summary,description:body.description,priority:f('Priority').name,labels:body.tags.map(t=>t.id),due:date(f('Due Date')),assignee:f('Assignee')?'Dana Lee':null});return reply(200,{id:i.id,idReadable:'SEC-'+i.id})}
   const m=/^\/issues\/(\d+)(\/comments)?$/.exec(path),i=m&&find(p,m[1]);if(!i||i.deleted)return reply(404,{message:'Issue not found'})
   if(m[2]){if(method==='POST')return reply(200,{id:note(i,body.text).id});return reply(200,i.comments.map(n=>({id:n.id,text:n.body,created:Date.parse(n.at),author:{fullName:n.author}})))}
   if(method==='POST'){for(const f of body.customFields){if(f.name==='Due Date')i.due=date(f.value);if(f.name==='State')i.closed=false}return reply(200,{})}
   return reply(200,{id:i.id,resolved:i.closed?Date.parse(state.clock):null,customFields:[{name:'State',value:{name:i.closed?'Fixed':i.status,isResolved:i.closed}},{name:'Assignee',value:i.assignee?{fullName:i.assignee}:null},{name:'Due Date',value:i.due?Date.parse(i.due+'T00:00:00Z'):null}]})
  }
  if(p==='asana') {
   if(path==='/users/me')return reply(200,{data:{name:'Dana Lee',email:'dana@northstar.test'}})
   if(path==='/projects/1200')return reply(200,{data:{gid:'1200',name:'Security',workspace:{gid:'workspace-1'},custom_field_settings:[{custom_field:{gid:'priority-field',name:'Priority',resource_subtype:'enum',enum_options:['Critical','High','Medium','Low'].map(name=>({gid:'priority-'+name,name,enabled:true}))}}]}})
   if(path==='/workspaces/workspace-1/tags')return reply(200,{data:[{gid:'tag-evidence',name:'evidence'},{gid:'tag-compliance',name:'compliance'}],next_page:null})
   if(path==='/webhooks'&&method==='POST'){assert.equal(body.data.resource,'1200');const h=await state.handshake(body.data.target,'asana-provider-secret');assert.equal(h.status,200);assert.equal(h.headers.get('x-hook-secret'),'asana-provider-secret');if(state.rejectRegistration)return reply(503,{errors:[{message:'Temporarily unavailable'}]});return reply(201,{data:{gid:'webhook-42'}})}
   if(path==='/tasks'&&method==='POST'){const i=create(p,{title:body.data.name,description:body.data.notes,priority:body.data.custom_fields?.['priority-field']?.replace('priority-',''),labels:body.data.tags,due:body.data.due_on,assignee:body.data.assignee?'Dana Lee':null});return reply(201,{data:{gid:i.id,permalink_url:`https://app.asana.com/0/1200/${i.id}`}})}
   const m=/^\/tasks\/(\d+)(\/stories)?$/.exec(path),i=m&&find(p,m[1]);if(!i||i.deleted)return reply(404,{errors:[{message:'Task not found'}]})
   if(m[2]){if(method==='POST')return reply(201,{data:{gid:note(i,body.data.text).id}});return reply(200,{data:i.comments.map(n=>({gid:n.id,resource_subtype:'comment_added',text:n.body,created_at:n.at,created_by:{name:n.author}}))})}
   if(method==='PUT'){if(Object.hasOwn(body.data,'due_on'))i.due=body.data.due_on;if(Object.hasOwn(body.data,'completed'))i.closed=body.data.completed;return reply(200,{data:{}})}
   return reply(200,{data:{gid:i.id,completed:i.closed,assignee:i.assignee?{name:i.assignee}:null,due_on:i.due}})
  }
  throw Error('Unhandled tracker edge '+p+' '+method+' '+path)
 }
 return {outbound,issues,keys,calls,state,find}
}
