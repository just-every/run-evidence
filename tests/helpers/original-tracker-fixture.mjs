// WORK-001 network boundary for the original REST/GraphQL destinations.
import assert from 'node:assert/strict'
const reply=(status,body)=>new Response(body===undefined?null:JSON.stringify(body),{status,headers:{'content-type':'application/json'}})
export function originalTrackerReply({p,path,method,body,c,state,create,find,note,url}) {
 if(p==='github') {
  if(path==='/repos/northstar/web')return reply(200,{full_name:'northstar/web',has_issues:true,owner:{login:'northstar'}})
  if(path==='/repos/northstar/web/issues'&&method==='POST') {const i=create(p,{title:body.title,description:body.body,labels:body.labels,priority:body.labels.at(-1),due:/^Evidence due date: (.*)$/m.exec(body.body)?.[1]??null,assignee:body.assignees?.length?'Dana Lee':null});return reply(201,{number:Number(i.id),html_url:`https://github.example.com/northstar/web/issues/${i.id}`})}
  const m=/^\/repos\/northstar\/web\/issues\/(\d+)(\/comments)?$/.exec(path),i=m&&find(p,m[1]);if(!i||i.deleted)return reply(404,{message:'Not found'})
  if(m[2]){if(method==='POST')return reply(201,{id:note(i,body.body).id});return reply(200,i.comments.map(n=>({id:n.id,user:{login:n.author},body:n.body,created_at:n.at})))}
  if(method==='PATCH'){if(body.state)i.closed=body.state==='closed';if(Object.hasOwn(body,'body')){i.description=body.body;i.due=/^Evidence due date: (.*)$/m.exec(body.body)?.[1]??null}return reply(200,{})}
  const description=i.description.replace(/^Evidence due date:.*$/m,'Evidence due date: '+(i.due??'none'))
  return reply(200,{number:Number(i.id),body:description,state:i.closed?'closed':'open',assignee:i.assignee?{login:i.assignee}:null})
 }
 if(p==='jira') {
  if(path==='/rest/api/3/myself')return reply(200,{displayName:'Dana Lee',emailAddress:c.account})
  if(path==='/rest/api/3/project/SEC')return reply(200,{name:'Security'})
  const plain=v=>(v?.content??[]).map(n=>n.content?.map(t=>t.text??'\n').join('')??'').join('\n')
  if(path==='/rest/api/3/issue'&&method==='POST') {const f=body.fields,i=create(p,{title:f.summary,description:plain(f.description),priority:f.priority.name,labels:f.labels,due:f.duedate,assignee:f.assignee?'Dana Lee':null});return reply(201,{id:i.id,key:i.id})}
  const m=/^\/rest\/api\/3\/issue\/(\d+)(\/comment|\/transitions)?$/.exec(path),i=m&&find(p,m[1]);if(!i||i.deleted)return reply(404,{errorMessages:['Issue not found']})
  if(m[2]==='/transitions'){if(method==='POST'){i.closed=false;return reply(204)}return reply(200,{transitions:[{id:'11',to:{statusCategory:{key:'new'}}}]})}
  if(m[2]){if(method==='POST')return reply(201,{id:note(i,plain(body.body)).id});return reply(200,{comments:i.comments.map(n=>({id:n.id,author:{displayName:n.author},body:{type:'doc',content:[{type:'paragraph',content:[{type:'text',text:n.body}]}]},created:n.at}))})}
  if(method==='PUT'){i.due=body.fields.duedate;return reply(204)}
  return reply(200,{fields:{status:{name:i.closed?'Done':i.status,statusCategory:{key:i.closed?'done':'new'}},assignee:i.assignee?{displayName:i.assignee}:null,duedate:i.due}})
 }
 if(p==='linear') {
  const q=body.query,v=body.variables
  if(q.includes('viewer'))return reply(200,{data:{viewer:{name:'Dana Lee',organization:{name:'Northstar'}},team:{id:c.project,name:'Security'}}})
  if(q.includes('issueLabels'))return reply(200,{data:{issueLabels:{nodes:[{id:'label-evidence',name:'evidence',team:null},{id:'label-compliance',name:'compliance',team:{id:c.project}}],pageInfo:{hasNextPage:false,endCursor:null}}}})
  if(q.includes('issueCreate')){const f=v.input;assert.deepEqual(f.labelIds,['label-evidence','label-compliance']);const i=create(p,{title:f.title,description:f.description,priority:String(f.priority),labels:['evidence','compliance'],due:f.dueDate,assignee:f.assigneeId?'Dana Lee':null});return reply(200,{data:{issueCreate:{success:true,issue:{id:i.id,identifier:i.id,url:`https://linear.app/northstar/issue/${i.id}`}}}})}
  if(q.includes('states'))return reply(200,{data:{team:{states:{nodes:[{id:'state-open',type:'unstarted'}]}}}})
  const i=find(p,v.id??v.input?.issueId);if(!i||i.deleted)return reply(200,{errors:[{message:'Entity not found',extensions:{code:'ENTITY_NOT_FOUND'}}]})
  if(q.includes('commentCreate'))return reply(200,{data:{commentCreate:{success:true,comment:{id:note(i,v.input.body).id}}}})
  if(q.includes('issueUpdate')){if(Object.hasOwn(v.input,'dueDate'))i.due=v.input.dueDate;if(v.input.stateId)i.closed=false;return reply(200,{data:{issueUpdate:{success:true}}})}
  return reply(200,{data:{issue:{id:i.id,identifier:i.id,url:'',dueDate:i.due,state:{name:i.closed?'Done':i.status,type:i.closed?'completed':'started'},assignee:i.assignee?{name:i.assignee}:null,comments:{nodes:i.comments.map(n=>({id:n.id,body:n.body,createdAt:n.at,user:{name:n.author}}))}}}})
 }
 if(p==='vector') {
  if(path==='/api/v1/comments')return vectorCommentPage(url,c.base,find(p,url.searchParams.get('issue')),state)
  if(path==='/api/v1/metadata')return reply(200,{workspace:{name:'Northstar'},teams:[{id:c.project,name:'Security',statuses:[{id:'open',category:'unstarted'}]}],labels:[{id:'label-evidence',name:'evidence'},{id:'label-compliance',name:'compliance'}]})
  if(path==='/api/v1/issues'&&method==='POST'){const i=create(p,{title:body.title,description:body.description,priority:body.priority,labels:body.labelIds??[],due:body.dueDate,assignee:body.assigneeOperatorId?'Dana Lee':null,version:1});return reply(201,{id:i.id,identifier:'FLW-'+i.id})}
  const m=/^\/api\/v1\/issues\/(?:FLW-)?(\d+)(\/comments)?$/.exec(path),i=m&&find(p,m[1]);if(!i||i.deleted)return reply(404,{error:'issue_not_found'})
  if(m[2])return reply(201,{id:note(i,body.body).id})
  if(method==='PATCH'){assert.equal(body.expectedVersion,i.version);if(Object.hasOwn(body,'dueDate'))i.due=body.dueDate;if(body.statusId)i.closed=false;i.version++;return reply(200,{})}
  return reply(200,{identifier:'FLW-'+i.id,version:i.version,dueDate:i.due,status:{name:i.closed?'Done':i.status,category:i.closed?'completed':'started'},assignee:i.assignee?{name:i.assignee}:null,activity:i.comments.map(n=>({id:n.id,kind:'comment.created',at:n.at,actor:n.author,nextValue:{id:n.id}}))})
 }
 return null
}

// Published Vector schema/api-v1.json Comment and docs/API.md cursor shape.
// State knobs only alter the network response; no application code is faked.
export function vectorCommentPage(url,base,issue,state={}) {
 assert.equal(url.searchParams.get('limit'),'100')
 if(!issue||issue.deleted)return reply(404,{error:'issue_not_found'})
 const identifier=issue.id.startsWith('FLW-')?issue.id:'FLW-'+issue.id
 assert.equal(url.searchParams.get('issue'),identifier)
 if(state.vectorCommentsDenied)return reply(403,{error:'insufficient_scope'})
 const cursor=url.searchParams.get('cursor'),start=cursor?Number(cursor.replace('synthetic-evidence-page-','')):0
 assert.ok(Number.isSafeInteger(start)&&start>=0)
 const size=state.vectorPageSize??100,all=issue.comments.filter(c=>!c.deleted),rows=all.slice(start,start+size).map(c=>({id:c.id,issueIdentifier:identifier,body:c.body,version:c.version??1,author:{id:'01K000000000000000000000001',displayName:c.author},createdAt:c.at,editedAt:c.editedAt??null,url:c.url??`${base}/app/issues/${identifier}`,maxBodyLength:100000,truncated:false,unrequested:'synthetic-evidence-unrequested-field'}))
 if(state.vectorMalformedComment&&rows.length)delete rows[0].body
 if(state.vectorForeignComment&&rows.length)rows[0].issueIdentifier='FLW-999999'
 if(state.vectorUnsafeLink&&rows.length)rows[0].url='javascript:alert(1)'
 return reply(200,{comments:rows,total:all.length,nextCursor:state.vectorCursorLoop?'synthetic-evidence-page-0':start+size<all.length?'synthetic-evidence-page-'+(start+size):null})
}
