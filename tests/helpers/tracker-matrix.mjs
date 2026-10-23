// Provider-shaped fakes at the outbound network boundary. Never substitutes
// application code: owner requests still traverse auth, mapping, adapters and D1.
import assert from 'node:assert/strict'
import { trackerFixture as legacyFixture, configs as legacyConfigs } from './tracker-fixture.mjs'
const statuses={
 vector:['open','working','done'],jira:['1','2','3'],linear:['state-open','state-working','state-done'],
 github:['open','open','closed'],gitlab:['opened','opened','closed'],'azure-boards':['Open','In Progress','Done'],
 shortcut:['1','2','3'],clickup:['Open','In Progress','Done'],monday:['0','0','1'],basecamp:['incomplete','incomplete','completed'],
 freshservice:['2','3','4'],youtrack:['Open','In Progress','Fixed'],asana:['incomplete','incomplete','completed'],
}
export const configs=Object.fromEntries(Object.entries(legacyConfigs).map(([p,c])=>[p,{...c,write:{open:statuses[p][0],working:statuses[p][1],done:statuses[p][2],assignee:p==='shortcut'?'u1':'1',otherAssignee:p==='shortcut'?'u2':'2'}}]))
const response=(body,status=200)=>new Response(status===204?null:JSON.stringify(body),{status,headers:{'content-type':'application/json'}})
const ids=(p,i)=>i.assignee?[i.assignee==='Dana Lee'?configs[p].write.assignee:configs[p].write.otherAssignee]:[]
const status=(p,i)=>p==='freshservice'?(i.closed?'4':i.status==='Pending'?'3':'2'):p==='azure-boards'&&!i.closed?i.status:statuses[p][i.closed?2:/In Progress|Working/.test(i.status)?1:0]
const field=(body,key)=>Object.hasOwn(body??{},key)
export function trackerFixture() {
 const edge=legacyFixture(),outbound=edge.outbound,fieldCalls=[]
 const setAssignee=(p,i,value)=>{const values=Array.isArray(value)?value:value==null||value===''?[]:[value];assert.ok(values.every(v=>[configs[p].write.assignee,configs[p].write.otherAssignee].includes(String(v))),'native assignee identity');i.assignee=values.length?String(values[0])===configs[p].write.assignee?'Dana Lee':'Lena Ortiz':null}
 const setStatus=(p,i,value)=>{const index=p==='azure-boards'&&value==='New'?0:statuses[p].findLastIndex(v=>v===String(value));assert.ok(index>=0,p+' native status '+value);i.closed=index===2;i.status=i.closed?(p==='youtrack'?'Fixed':'Done'):index===1?'In Progress':'Open';if(p==='monday'&&!i.closed)i.status='Working';if(p==='azure-boards'&&value==='New')i.status='New';if(p==='freshservice'&&index===1)i.status='Pending'}
 const matching=(p,path,b)=>{
  if(p==='linear')return edge.find(p,String(b?.variables?.id??b?.variables?.input?.issueId))
  if(p==='monday')return edge.find(p,String(b?.variables?.item??b?.variables?.ids?.[0]))
  return edge.find(p,path.match(/\/(?:FLW-)?(\d+)(?:\/transitions|\/completion)?(?:\.json)?$/)?.[1])
 }
 edge.fieldCalls=fieldCalls
 edge.fieldState=(p,i)=>({status_id:status(p,i),assignee_ids:ids(p,i).sort()})
 edge.outbound=async request=>{
  const u=new URL(request.url),p=Object.keys(configs).find(p=>u.origin===new URL(configs[p].base).origin)
  if(!p)return outbound(request)
  const path=u.pathname.slice(new URL(configs[p].base).pathname.replace(/\/$/,'').length),method=request.method,raw=await request.clone().text(),b=raw?JSON.parse(raw):null,i=matching(p,path,b)
  const call={provider:p,method,path,url:u,body:b};fieldCalls.push(call)
  const validKey=p==='freshservice'?'Basic '+Buffer.from(edge.keys[p]+':X').toString('base64'):p==='azure-boards'?'Basic '+Buffer.from(':'+edge.keys[p]).toString('base64'):p==='jira'?'Basic '+Buffer.from(configs[p].account+':'+edge.keys[p]).toString('base64'):['monday','clickup','linear','shortcut'].includes(p)?edge.keys[p]:'Bearer '+edge.keys[p]
  const authenticated=request.headers.get(p==='shortcut'?'shortcut-token':'authorization')===validKey
  let answer
  if(authenticated&&i&&!i.deleted) {
   const savedFields={assignee:i.assignee,status:i.status,closed:i.closed,version:i.version}
   if(p==='jira'&&path.endsWith('/transitions')&&method==='GET')answer=response({transitions:statuses[p].map((id,n)=>({id:String((n+1)*10+1),to:{id,name:['Open','In Progress','Done'][n],statusCategory:{key:n===2?'done':'new'}}}))})
   let write=false
   if(p==='vector'&&method==='PATCH'&&(field(b,'statusId')||field(b,'assigneeOperatorId'))){assert.equal(b.expectedVersion,i.version);if(field(b,'statusId'))setStatus(p,i,b.statusId);if(field(b,'assigneeOperatorId'))setAssignee(p,i,b.assigneeOperatorId);i.version++;write=true}
   if(p==='jira'&&((method==='POST'&&path.endsWith('/transitions'))||(method==='PUT'&&field(b?.fields,'assignee')))){
    if(b.transition){const n=['11','21','31'].indexOf(b.transition.id);assert.ok(n>=0);setStatus(p,i,statuses[p][n])}
    if(field(b.fields,'assignee'))setAssignee(p,i,b.fields.assignee?.accountId??null)
    write=true
   }
   if(p==='linear'&&b?.query?.includes('issueUpdate')&&(field(b.variables.input,'assigneeId')||field(b.variables.input,'stateId'))){if(field(b.variables.input,'stateId'))setStatus(p,i,b.variables.input.stateId);if(field(b.variables.input,'assigneeId'))setAssignee(p,i,b.variables.input.assigneeId);write=true}
   if(p==='github'&&method==='PATCH'&&(field(b,'assignees')||field(b,'state'))){if(field(b,'assignees'))setAssignee(p,i,b.assignees);if(field(b,'state'))setStatus(p,i,b.state);write=true}
   if(p==='gitlab'&&method==='PUT'&&(field(b,'assignee_ids')||field(b,'state_event'))){if(field(b,'assignee_ids'))setAssignee(p,i,b.assignee_ids);if(field(b,'state_event'))setStatus(p,i,b.state_event==='close'?'closed':'opened');write=true}
   if(p==='azure-boards'&&method==='PATCH'&&b.some(op=>['/fields/System.AssignedTo','/fields/System.State'].includes(op.path))){for(const op of b){if(op.path==='/fields/System.State')setStatus(p,i,op.value);else if(op.path==='/fields/System.AssignedTo')setAssignee(p,i,op.value?.id??op.value);else if(op.path==='/fields/Custom.RemediationDue')i.due=op.value?.slice(0,10)??null;else assert.fail('unexpected Azure field')}write=true}
   if(p==='shortcut'&&method==='PUT'&&(field(b,'owner_ids')||field(b,'workflow_state_id'))){if(field(b,'owner_ids'))setAssignee(p,i,b.owner_ids);if(field(b,'workflow_state_id'))setStatus(p,i,b.workflow_state_id);write=true}
   if(p==='clickup'&&method==='PUT'&&(field(b,'assignees')||field(b,'status'))){if(field(b,'assignees')){const current=ids(p,i),remove=(b.assignees.rem??[]).map(String),add=(b.assignees.add??[]).map(String);setAssignee(p,i,[...current.filter(id=>!remove.includes(id)),...add])}if(field(b,'status'))setStatus(p,i,b.status);write=true}
   if(p==='monday'&&b?.query?.includes('change_multiple_column_values')){const f=JSON.parse(b.variables.values);if(f.person1||f.status1){if(f.person1)setAssignee(p,i,f.person1.personsAndTeams.map(a=>a.id));if(f.status1)setStatus(p,i,f.status1.index??(f.status1.label==='Done'?'1':'0'));if(f.date1)i.due=f.date1.date;write=true}}
   if(p==='basecamp'&&path.endsWith('/completion.json')&&['POST','DELETE'].includes(method)){setStatus(p,i,method==='POST'?'completed':'incomplete');write=true}
   if(p==='basecamp'&&method==='PUT'&&field(b,'assignee_ids')){assert.equal(b.content,i.title);assert.equal(b.description.replaceAll('<br>','\n').replaceAll('&lt;','<').replaceAll('&amp;','&'),i.description);assert.deepEqual(b.completion_subscriber_ids,[3]);assert.equal(b.starts_on,'2026-10-01');setAssignee(p,i,b.assignee_ids);if(field(b,'due_on'))i.due=b.due_on;write=true}
   if(p==='freshservice'&&method==='PUT'&&(field(b,'responder_id')||field(b,'status'))){if(field(b,'responder_id'))setAssignee(p,i,b.responder_id);if(field(b,'status'))setStatus(p,i,b.status);write=true}
   if(p==='youtrack'&&method==='POST'&&b?.customFields?.some(f=>['Assignee','State'].includes(f.name))){for(const f of b.customFields){if(f.name==='Assignee')setAssignee(p,i,f.value?.id??null);if(f.name==='State')setStatus(p,i,f.value.name??f.value.id);if(f.name==='Due Date')i.due=f.value==null?null:new Date(f.value).toISOString().slice(0,10)}write=true}
   if(p==='asana'&&method==='PUT'&&(field(b?.data,'assignee')||field(b?.data,'completed'))){if(field(b.data,'assignee'))setAssignee(p,i,b.data.assignee);if(field(b.data,'completed'))setStatus(p,i,b.data.completed?'completed':'incomplete');write=true}
   if(write&&edge.state.unconfirmedFields===p)Object.assign(i,savedFields)
   if(write){call.fieldsWrite=true;edge.calls.push({provider:p,method,path});answer=p==='linear'?response({data:{issueUpdate:{success:true}}}):p==='monday'?response({data:{change_multiple_column_values:{id:i.id}}}):p==='freshservice'?response({ticket:{id:Number(i.id)}}):p==='asana'?response({data:{}}):response({},p==='jira'||p==='basecamp'&&path.endsWith('/completion.json')?204:200)}
  }
  if(!answer)answer=await outbound(request)
  if(!answer)return answer
  if(answer.ok&&answer.status!==204) {
   let data=await answer.clone().json().catch(()=>null)
   const isRead=method==='GET'||['linear','monday'].includes(p)&&!b?.query?.includes('mutation')
   if(i&&!i.deleted&&isRead&&data) {
    const a=ids(p,i)[0],s=status(p,i)
    if(p==='vector'&&/^\/api\/v1\/issues\/(?:FLW-)?\d+$/.test(path)){data.status.id=s;if(data.assignee)data.assignee.id=a}
    if(p==='jira'&&/^\/rest\/api\/3\/issue\/\d+$/.test(path)){data.fields.status.id=s;if(data.fields.assignee)data.fields.assignee.accountId=a}
    if(p==='linear'&&data.data?.issue){data.data.issue.state.id=s;if(data.data.issue.assignee)data.data.issue.assignee.id=a}
    if(p==='github'&&/^\/repos\/northstar\/web\/issues\/\d+$/.test(path))data.assignees=a?[{login:a}]:[]
    if(p==='gitlab'&&/^\/projects\/42\/issues\/\d+$/.test(path))data.assignees=a?[{id:Number(a),name:i.assignee}]:[]
    if(p==='azure-boards'&&data.fields&&data.fields['System.AssignedTo'])data.fields['System.AssignedTo'].id=a
    if(p==='clickup'&&/^\/task\/\d+$/.test(path))data.assignees=a?[{id:Number(a),username:i.assignee}]:[]
    if(p==='monday'&&data.data?.items?.[0]?.column_values){const f=data.data.items[0].column_values.find(f=>f.id==='person1');f.value=JSON.stringify({personsAndTeams:a?[{id:Number(a),kind:'person'}]:[]})}
    if(p==='basecamp'&&/^\/100\/buckets\/200\/todos\/\d+\.json$/.test(path))data.assignees=a?[{id:Number(a),name:i.assignee}]:[]
    if(p==='freshservice'&&data.ticket)data.ticket.status=Number(s)
    if(p==='youtrack'&&data.customFields){const state=data.customFields.find(f=>f.name==='State');state.value.id=s;const assignee=data.customFields.find(f=>f.name==='Assignee');if(assignee.value)assignee.value.id=a}
    if(p==='asana'&&/^\/tasks\/\d+$/.test(path)&&data.data.assignee)data.data.assignee.gid=a
   }
   if(data){answer=response(data,answer.status);call.response=data}
  }
  return answer
 }
 return edge
}
