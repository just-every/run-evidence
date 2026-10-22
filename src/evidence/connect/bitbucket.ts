import {scopedFetch} from '../ops/execution'
import {record,natural} from './github-schema'
import {readPageStream} from './pages'
import type {GithubHistory,ChangeFact,DeploymentFact,ReviewFact} from './github-history'
import type {Connection} from './storage'
import type {Bindings} from '../../auth.server'
import {persistCodeMembers} from './code-members'
export class BitbucketFailure extends Error{constructor(message:string,public kind:'gap'|'unauthorized'|'throttled'='gap',public reset=0){super(message)}}
const string=(v:unknown):v is string=>typeof v==='string'&&v.length>0&&v.length<=200
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^\{?[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\}?$/i.test(v)
const revision=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{40,64}$/i.test(v)
const nanos=(v:string)=>{const m=/^(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d)(?:\.(\d{1,9}))?(Z|[+-]\d\d:\d\d)$/.exec(v);if(!m)throw new BitbucketFailure('unsupported source timestamp precision');return BigInt(Date.parse(m[1]+m[3]))*1000000n+BigInt((m[2]??'').padEnd(9,'0'))}
const date=(v:unknown):v is string=>typeof v==='string'&&/^\d{4}-\d\d-\d\dT/.test(v)&&Number.isFinite(Date.parse(v))
export const bitbucketPermissions=['repository (read)','pullrequest (read)','pipeline (read)','account (workspace membership)','repository:admin (Bitbucket requires this write-capable scope to READ branch restrictions; explicit owner consent required)']
// Official Bitbucket Cloud OpenAPI schemas, read 22 Oct 2026:
// https://dac-static.atlassian.com/cloud/bitbucket/swagger.v3.json
// Only GETs to this fixed origin; authenticated redirects are never followed.
export function bitbucketClient(base:string,token:string,now:Date){
 async function get(path:string){
  const r=await scopedFetch(base+path,{headers:{authorization:'Bearer '+token,accept:'application/json'},redirect:'manual'})
  if(r.status===401)throw new BitbucketFailure('Bitbucket rejected the credential','unauthorized')
  if(r.status===429){const n=Number(r.headers.get('retry-after'));throw new BitbucketFailure('Bitbucket rate limited the read','throttled',now.getTime()+(Number.isFinite(n)&&n>0?Math.min(n,86400):60)*1000)}
  if(!r.ok)throw new BitbucketFailure('Bitbucket answered '+r.status)
  try{return await r.json() as unknown}catch{throw new BitbucketFailure('schema drift: invalid JSON')}
 }
 async function list<T>(path:string,normalize:(v:unknown)=>T){
  const endpoint=new URL(base+path)
  return readPageStream<T>('bitbucket:'+path,path,async cursor=>{
   const u=new URL(cursor.startsWith('http')?cursor:base+cursor)
   if(u.origin!==endpoint.origin||u.pathname!==endpoint.pathname||u.username||u.password||u.hash||[...endpoint.searchParams].some(([k,v])=>k!=='page'&&u.searchParams.get(k)!==v)||[...u.searchParams.keys()].some(k=>!endpoint.searchParams.has(k)&&!['page','after','before'].includes(k)))throw new BitbucketFailure('unsafe source continuation')
   const body=await get(u.pathname.slice(new URL(base).pathname.length)+u.search)
   if(!record(body)||!Array.isArray(body.values)||!(body.next===undefined||typeof body.next==='string'&&body.next.length>0))throw new BitbucketFailure('schema drift: paginated source envelope')
   return {items:body.values.map(normalize),next:typeof body.next==='string'?body.next:null}
  },10,m=>new BitbucketFailure(m))
 }
 return {get,list}
}
type Client=ReturnType<typeof bitbucketClient>
export async function bitbucketGroup(client:Client,account:string){const b=await client.get('/workspaces/'+encodeURIComponent(account));if(!record(b)||b.slug!==account||!uuid(b.uuid))throw new BitbucketFailure('schema drift: workspace identity');return {id:b.uuid,login:account,two_factor_requirement_enabled:null}}
export async function bitbucketProjects(client:Client,account:string){return client.list('/repositories/'+encodeURIComponent(account)+'?pagelen=100',v=>{if(!record(v)||!uuid(v.uuid)||!string(v.full_name)||!v.full_name.startsWith(account+'/'))throw new BitbucketFailure('schema drift: repository identity');return {id:v.uuid,name:v.full_name}})}
const glob=(p:string,s:string)=>new RegExp('^'+p.split('*').map(v=>v.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('.*')+'$').test(s)
export async function bitbucketRepository(client:Client,name:string){
 const root='/repositories/'+name.split('/').map(encodeURIComponent).join('/'),gaps:string[]=[]
 const attempt=async<T>(label:string,work:()=>Promise<T>):Promise<T|null>=>{try{return await work()}catch(e){if(!(e instanceof BitbucketFailure)||e.kind!=='gap')throw e;gaps.push(label+': '+e.message);return null}}
 const repo=await client.get(root)
 if(!record(repo)||repo.full_name!==name||typeof repo.is_private!=='boolean'||!record(repo.mainbranch)||!string(repo.mainbranch.name))throw new BitbucketFailure('schema drift: repository privacy or default branch')
 const branch=repo.mainbranch.name
 const restrictions=await attempt('branch restrictions',()=>client.list(root+'/branch-restrictions?pagelen=100',v=>{
  if(!record(v)||!natural(v.id)||!['push','delete','force','restrict_merges','require_tasks_to_be_completed','require_approvals_to_merge','require_review_group_approvals_to_merge','require_default_reviewer_approvals_to_merge','require_no_changes_requested','require_passing_builds_to_merge','require_commits_behind','reset_pullrequest_approvals_on_change','smart_reset_pullrequest_approvals','reset_pullrequest_changes_requested_on_change','require_all_dependencies_merged','enforce_merge_checks','allow_auto_merge_when_builds_pass','require_all_comments_resolved'].includes(String(v.kind))||v.branch_match_kind!=='glob'||typeof v.pattern!=='string'||v.pattern.length>200||!(v.value===undefined||natural(v.value)))throw new BitbucketFailure('unsupported or malformed branch restriction; branching-model scope requires explicit source support')
  return {id:v.id,kind:String(v.kind),pattern:v.pattern,value:typeof v.value==='number'?v.value:null}
 }))
 const applicable=restrictions?.filter(r=>glob(r.pattern,branch)),enforced=applicable?.some(r=>r.kind==='enforce_merge_checks')??false
 const required=(kinds:string[])=>restrictions===null||(applicable??[]).some(r=>kinds.includes(r.kind)&&r.value===null)?null:!enforced?0:Math.max(0,...(applicable??[]).filter(r=>kinds.includes(r.kind)).map(r=>r.value??0))
 if(applicable?.some(r=>['require_approvals_to_merge','require_default_reviewer_approvals_to_merge','require_passing_builds_to_merge'].includes(r.kind)&&r.value===null))gaps.push('schema drift: numeric merge-check requirement unavailable')
 const attributes={private:repo.is_private,archived:null,default_branch:branch,branch_protection:restrictions===null?null:enforced||!!applicable?.some(r=>['push','force','delete','restrict_merges'].includes(r.kind)),required_reviews:required(['require_approvals_to_merge','require_default_reviewer_approvals_to_merge']),required_status_checks:required(['require_passing_builds_to_merge']),readable:true}
 const changes=await attempt('merged changes',async()=>{
  const rows=await client.list(root+'/pullrequests?state=MERGED&pagelen=100',v=>{
   if(!record(v)||!natural(v.id)||v.id<1||v.state!=='MERGED'||!record(v.source)||!record(v.source.commit)||!revision(v.source.commit.hash)||!record(v.merge_commit)||!revision(v.merge_commit.hash)||!record(v.destination)||!record(v.destination.branch)||!string(v.destination.branch.name))throw new BitbucketFailure('schema drift: merged pull request revision')
   return {number:v.id,source_revision:v.source.commit.hash,merge_revision:v.merge_commit.hash,base:v.destination.branch.name}
  });if(rows.length>20)throw new BitbucketFailure('more than 20 merged changes; history incomplete')
  const result:ChangeFact[]=[]
  for(const row of rows){
   const activity=await client.list(root+'/pullrequests/'+row.number+'/activity?pagelen=100',v=>{
    if(!record(v))throw new BitbucketFailure('schema drift: pull request activity')
    if(v.update!==undefined){if(!record(v.update)||!['OPEN','MERGED','DECLINED','SUPERSEDED'].includes(String(v.update.state))||!date(v.update.date))throw new BitbucketFailure('schema drift: change state event');return {kind:'update',state:String(v.update.state),at:v.update.date,actor:''}}
    if(v.approval!==undefined){if(!record(v.approval)||!date(v.approval.date)||!record(v.approval.user)||!uuid(v.approval.user.uuid))throw new BitbucketFailure('schema drift: approval event');return {kind:'approval',state:'APPROVED',at:v.approval.date,actor:v.approval.user.uuid}}
    // Comments and content are deliberately discarded at the network edge.
    return {kind:'other',state:'',at:'',actor:''}
   })
   const merge=activity.filter(a=>a.kind==='update'&&a.state==='MERGED')
   if(merge.length!==1)throw new BitbucketFailure('unique merge event time unavailable; updated_on is not a merge timestamp')
   const reviews:ReviewFact[]=activity.filter(a=>a.kind==='approval').map(a=>({id:a.actor+':'+a.at,actor:a.actor,state:a.state,commit:null,submitted_at:a.at}))
   const statuses=await attempt('checks for change '+row.number,()=>client.list(root+'/commit/'+row.source_revision+'/statuses?pagelen=100',v=>{
    if(!record(v)||!string(v.key)||!['FAILED','INPROGRESS','STOPPED','SUCCESSFUL'].includes(String(v.state))||!date(v.updated_on))throw new BitbucketFailure('schema drift: commit build status')
    return {name:v.key,state:v.state==='INPROGRESS'?'in progress':'completed',conclusion:String(v.state),completed_at:v.state==='INPROGRESS'?null:v.updated_on,revision:row.source_revision}
   }))
   result.push({...row,merged_at:merge[0].at,reviews,checks:statuses,statuses:null})
  }
  return result
 })
 let deployments=await attempt('Pipelines deployments',()=>client.list(root+'/deployments?pagelen=100',v=>{
  if(!record(v)||!uuid(v.uuid)||!record(v.environment)||!uuid(v.environment.uuid)||!string(v.environment.name)||!record(v.release)||!uuid(v.release.uuid)||!record(v.release.commit)||!revision(v.release.commit.hash)||!record(v.state)||!['COMPLETED','IN_PROGRESS','UNDEPLOYED'].includes(String(v.state.name)))throw new BitbucketFailure('schema drift: Pipelines deployment')
  if(!date(v.state.start_date))throw new BitbucketFailure('deployment start time unavailable')
  const state=v.state.name==='COMPLETED'&&record(v.state.status)?v.state.status.name:v.state.name
  if(!['SUCCESSFUL','FAILED','STOPPED','IN_PROGRESS','UNDEPLOYED'].includes(String(state))||!(v.state.completion_date===undefined||date(v.state.completion_date)))throw new BitbucketFailure('schema drift: deployment outcome')
  const commit=v.release.commit.hash,started=v.state.start_date
  return {id:v.uuid,revision:commit,environment:v.environment.name,environment_key:name+':'+v.environment.uuid,release_uuid:v.release.uuid,pipeline_uuid:null,production:null,created_at:v.state.start_date,current_state:String(state),statuses:date(v.state.completion_date)?[{state:String(state),created_at:v.state.completion_date}]:null,change_numbers:(changes??[]).filter(c=>c.merge_revision===commit&&nanos(c.merged_at)<=nanos(started)).map(c=>c.number)} as DeploymentFact
 }))
 if(deployments&&deployments.length>20){deployments=null;gaps.push('more than 20 deployments; history incomplete')}
 for(const deployment of deployments??[]){
  const pipeline=await attempt('Pipelines readback for deployment '+deployment.id,async()=>{
   const p=await client.get(root+'/pipelines/'+encodeURIComponent(deployment.release_uuid!))
   if(!record(p)||p.uuid!==deployment.release_uuid||!record(p.repository)||p.repository.full_name!==name||!record(p.target)||!record(p.target.commit)||p.target.commit.hash!==deployment.revision||!record(p.state)||!['PENDING','IN_PROGRESS','COMPLETED'].includes(String(p.state.name)))throw new BitbucketFailure('pipeline identity, repository or exact release revision mismatch')
   const result=record(p.state.result)?p.state.result.name:null
   if(p.state.name==='COMPLETED'&&!['SUCCESSFUL','FAILED','STOPPED','EXPIRED','ERROR'].includes(String(result)))throw new BitbucketFailure('pipeline completion result unavailable')
   if(!(p.completed_on===undefined||date(p.completed_on)))throw new BitbucketFailure('schema drift: pipeline completion time')
   return {uuid:p.uuid as string,state:p.state.name+(result?': '+result:''),completed_at:typeof p.completed_on==='string'?p.completed_on:null}
  });deployment.pipeline_uuid=pipeline?.uuid??null;deployment.pipeline_state=pipeline?.state;deployment.pipeline_completed_at=pipeline?.completed_at
 }
 const dependencies=await attempt('package manifest',async()=>{
  const b=await client.get(root+'/refs/branches/'+encodeURIComponent(branch));if(!record(b)||!record(b.target)||!revision(b.target.hash))throw new BitbucketFailure('source branch revision unavailable')
  const body=await client.get(root+'/src/'+b.target.hash+'/package.json')
  if(!record(body))throw new BitbucketFailure('schema drift: package.json object')
  const packages:{id:string;name:string;version:string|null}[]=[]
  for(const field of ['dependencies','devDependencies','optionalDependencies','peerDependencies']){
   const values=body[field];if(values===undefined)continue
   if(!record(values))throw new BitbucketFailure('schema drift: package.json '+field)
   for(const [name,version]of Object.entries(values)){if(!/^[@A-Za-z0-9_.+/-]{1,200}$/.test(name)||typeof version!=='string'||!/^[A-Za-z0-9._+^~*<>=| -]{1,100}$/.test(version))throw new BitbucketFailure('unsupported dependency locator; no credential-bearing URL is retained');packages.push({id:field+':'+name,name,version})}
  }
  if(packages.length>500)throw new BitbucketFailure('more than 500 package entries; dependency inventory incomplete')
  return {generated_at:null,source_revision:b.target.hash,packages,note:'Parsed package.json dependency metadata from an exact source revision. Original manifest bytes and other manifest formats are not retained; no export-generation timestamp is invented and package presence never approves an AI tool.'}
 })
 const history:GithubHistory={changes,deployments,dependencies,gaps,note:'Bitbucket Cloud source metadata. Merge time comes only from the unique MERGED activity event; updated_on is never substituted. Approval activity has no reviewed commit binding, so that revision is unknown. Check results are at read time. Pipelines deployments match changes by exact merge revision and chronology; production classification requires the owner’s explicit environment mapping.'}
 if(new TextEncoder().encode(JSON.stringify(history)).length>50000){history.changes=null;history.deployments=null;history.dependencies=null;gaps.push('history exceeds 50,000 characters; source detail unavailable')}
 return {attributes,history,gaps}
}
export async function bitbucketMembers(env:Bindings,c:Connection,client:Client,now:Date){
 const gaps=['Bitbucket workspace APIs do not establish individual MFA enrollment, sign-in or organization two-step policy; use an authorized identity-policy source or reviewed manual evidence.']
 let members:import('./code-members').CodeMember[]|null=null
 try{members=await client.list('/workspaces/'+encodeURIComponent(c.account)+'/permissions?pagelen=100',v=>{
  if(!record(v)||!record(v.user)||!uuid(v.user.uuid)||!string(v.user.display_name)||!record(v.workspace)||v.workspace.uuid!==JSON.parse(c.config_json).workspace_id||!['owner','collaborator','member'].includes(String(v.permission)))throw new BitbucketFailure('schema drift: workspace membership or permission')
  return {id:v.user.uuid,name:v.user.display_name,status:'unknown',admin:v.permission==='owner',roles:'Bitbucket workspace '+v.permission,mfa:null,service:false}
 });if(new Set(members.map(m=>m.id)).size!==members.length)throw new BitbucketFailure('repeated member identity')}
 catch(e){if(!(e instanceof BitbucketFailure)||e.kind!=='gap')throw e;gaps.push('membership: '+e.message);members=null}
 return persistCodeMembers(env,c,members,gaps,now)
}
