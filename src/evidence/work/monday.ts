import { nativeId, nativeIds, numericField, TrackerFailure, type Adapter } from './client'
import { json, metadata, requireId } from './rest'
// https://developer.monday.com/api-reference/reference/items and /updates
const name='monday.com'
async function gql(base:string,key:string,query:string,variables:Record<string,unknown>={}) {
 const r=await json(base,key,name,'POST',{query,variables},{authorization:key,accept:'application/json','content-type':'application/json','API-Version':'2026-04'})
 const error=r.errors?.[0]
 if(error) {
  const code=String(error.extensions?.code??error.error_code??'').replaceAll('_',' ').toLowerCase(),reason=String(error.message??'')
  if(/unauthoriz|not authenticat|invalid.?token|permission|access denied/.test(code+' '+reason.toLowerCase()))throw new TrackerFailure('unauthorized',401,'monday.com refused the credential; reconnect with a new one.')
  if(/limit|complexity.*exhaust/.test(code))throw new TrackerFailure('throttled',429,'monday.com is rate limiting this credential.')
  if(/invaliditemid|item.*not.?found/.test(code))throw new TrackerFailure('not found',404,'monday.com item no longer exists.')
  throw new TrackerFailure('invalid',400,'monday.com refused the field mapping: '+reason.slice(0,200))
 }
 if(!r.data||typeof r.data!=='object')throw new TrackerFailure('unavailable',502,'monday.com returned no data; check the provider before retrying.')
 return r.data
}
async function board(base:string,key:string,project:string) {const r=await gql(base,key,'query($ids:[ID!]!){boards(ids:$ids){id name columns{id title type settings_str}}}',{ids:[project]});if(!r.boards?.[0])throw new TrackerFailure('invalid',400,'monday.com board is not visible to this token.');return r.boards[0]}
const column=(b:any,type:string,title?:string)=>{if(!Array.isArray(b?.columns)||b.columns.some((c:any)=>!c||typeof c.title!=='string'||typeof c.type!=='string'||typeof c.id!=='string'))throw new TrackerFailure('unavailable',502,'monday.com board column metadata is unavailable.');const c=b.columns.find((c:any)=>c.type===type&&(!title||c.title.toLowerCase()===title));if(!c)throw new TrackerFailure('invalid',400,`monday.com board needs a ${title??type} column.`);return c}
async function change(d:{api_base:string;project:string},key:string,t:{remote_id:string},values:unknown) {await gql(d.api_base,key,'mutation($board:ID!,$item:ID!,$values:JSON!){change_multiple_column_values(board_id:$board,item_id:$item,column_values:$values){id}}',{board:d.project,item:t.remote_id,values:JSON.stringify(values)})}
export const monday: Adapter = {
 ...metadata(name,'https://api.monday.com/v2','Board ID','A monday.com API token','Read boards and users; create/update items and updates on the selected board'),
 webhook: 'authenticated provider webhook, with polling every 10 minutes',
 defaultPriorities:{critical:'Critical',high:'High',medium:'Medium',low:'Low'},
 fieldNotes: 'Needs date, people, tags and long-text columns plus Status/Priority status columns. Priority labels must exist on the board. Labels use native tags, created or found by name before the item is created. Reopen selects a configured non-done state.',
 async verify(base,key,_account,project) {const b=await board(base,key,project),u=await gql(base,key,'{me{name}}');column(b,'date');column(b,'people');column(b,'status','status');column(b,'status','priority');column(b,'long_text');column(b,'tags');return {account:u.me.name,projectName:b.name}},
 async create(d,key,draft) {
  const b=await board(d.api_base,key,d.project),tagsColumn=column(b,'tags'),tagIds:number[]=[]
  for(const tag of new Set(draft.labels)) {
   const result=await gql(d.api_base,key,'mutation($name:String!,$board:ID!){create_or_get_tag(tag_name:$name,board_id:$board){id}}',{name:tag,board:d.project})
   const tagId=Number(requireId(result.create_or_get_tag?.id,name))
   if(!Number.isSafeInteger(tagId)||tagId<=0)throw new TrackerFailure('unavailable',502,'monday.com returned an invalid native tag identity.')
   tagIds.push(tagId)
  }
  const values:Record<string,unknown>={[column(b,'long_text').id]:{text:draft.description},[column(b,'date').id]:{date:draft.due},[column(b,'status','priority').id]:{label:draft.priority},[tagsColumn.id]:{tag_ids:tagIds}}
  if(draft.assignee)values[column(b,'people').id]={personsAndTeams:[{id:Number(draft.assignee),kind:'person'}]}
  const {create_item:i}=await gql(d.api_base,key,'mutation($board:ID!,$name:String!,$values:JSON!){create_item(board_id:$board,item_name:$name,column_values:$values){id url}}',{board:d.project,name:draft.title,values:JSON.stringify(values)})
  return {id:requireId(i.id,name),key:String(i.id),url:i.url}
 },
 async read(d,key,t) {
  const b=await board(d.api_base,key,d.project)
  const r=await gql(d.api_base,key,'query($ids:[ID!]!){items(ids:$ids){id column_values{id text value}}}',{ids:[t.remote_id]}),i=r.items?.[0]
  if(!i)throw new TrackerFailure('not found',404,'monday.com item no longer exists.')
  const value=(c:any)=>i.column_values.find((v:any)=>v.id===c.id)
  const statusColumn=column(b,'status','status'),status=value(statusColumn),settings=JSON.parse(statusColumn.settings_str)
  const index=JSON.parse(status.value??'null')?.index,people=value(column(b,'people'))
  const assigned=JSON.parse(people.value??'null')?.personsAndTeams
  // Keep non-person identities distinct so an external team assignment also
  // changes the conflict baseline, without making teams writable as people.
  const assigneeIds=people.value===null?[]:Array.isArray(assigned)?nativeIds(assigned.map((p:any)=>{
   const identity=nativeId(p?.id)
   return identity===null||!['person','team','agent'].includes(p?.kind)?null:p.kind==='person'?identity:p.kind+':'+identity
  })):null
  const comments=[]
  for(let page=1;;page++) {
   const result=await gql(d.api_base,key,'query($ids:[ID!]!,$page:Int!){items(ids:$ids){updates(limit:100,page:$page){id text_body created_at creator{name}}}}',{ids:[t.remote_id],page}),rows=result.items[0].updates
   comments.push(...rows.map((u:any)=>({id:u.id,author:u.creator.name,body:u.text_body,at:u.created_at})))
   if(rows.length<100)break
  }
  return {status_id:nativeId(index),assignee_ids:assigneeIds,status:status.text,closed:(settings.done_colors??[1]).includes(index),assignee:people.text||null,due:JSON.parse(value(column(b,'date')).value??'null')?.date??null,comments}
 },
 async comment(d,key,t,body) {return requireId((await gql(d.api_base,key,'mutation($item:ID!,$body:String!){create_update(item_id:$item,body:$body){id}}',{item:t.remote_id,body:body.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('\n','<br>')})).create_update.id,name)},
 async setFields(d,key,t,fields) {
  const b=await board(d.api_base,key,d.project),values:Record<string,unknown>={}
  if(fields.assignee!==undefined)values[column(b,'people').id]={personsAndTeams:fields.assignee===null?[]:[{id:numericField(fields.assignee,name),kind:'person'}]}
  if(fields.status!==undefined) {
   const c=column(b,'status','status'),settings=JSON.parse(c.settings_str)
   if(!/^\d+$/.test(fields.status)||!Object.hasOwn(settings.labels??{},fields.status))throw new TrackerFailure('invalid',400,'monday.com status mapping must be a native Status column label index.')
   values[c.id]={index:Number(fields.status)}
  }
  await change(d,key,t,values)
 },
 async setDue(d,key,t,due) {const b=await board(d.api_base,key,d.project);await change(d,key,t,{[column(b,'date').id]:{date:due}})},
 async reopen(d,key,t) {const b=await board(d.api_base,key,d.project),c=column(b,'status','status'),s=JSON.parse(c.settings_str),open=Object.keys(s.labels).find(i=>!(s.done_colors??[1]).includes(Number(i)));if(open===undefined)throw new TrackerFailure('invalid',400,'monday.com board has no open status.');await change(d,key,t,{[c.id]:{index:Number(open)}})},
}
