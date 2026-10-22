import {persistCodeMembers} from './code-members'
import type {Bindings} from '../../auth.server'
import type {Connection} from './storage'
import {scopedFetch} from '../ops/execution'
import {record,natural} from './github-schema'
import {readPageStream} from './pages'
import type {GithubHistory,ChangeFact,DeploymentFact} from './github-history'
export class GitlabFailure extends Error{constructor(message:string,public kind:'gap'|'unauthorized'|'throttled'='gap',public reset=0){super(message)}}
const string=(v:unknown):v is string=>typeof v==='string'&&v.length>0&&v.length<=200
const revision=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{40,64}$/i.test(v)
const instant=(v:unknown):v is string=>typeof v==='string'&&Number.isFinite(Date.parse(v))&&/^\d{4}-\d\d-\d\dT/.test(v)
export const gitlabPermissions=['read_api (groups, projects, protected branches, approvals, deployments, dependency metadata)','read_repository (authorized private repository metadata)']
// Consumed schemas only; no source descriptions, secrets or arbitrary objects.
// https://docs.gitlab.com/api/{groups,projects,protected_branches,merge_requests,merge_request_approvals,deployments,dependencies}/
export function gitlabClient(base:string,secret:string,now:Date){
 async function get(path:string){
  const response=await scopedFetch(base+path,{headers:{authorization:'Bearer '+secret,accept:'application/json'},redirect:'manual'})
  if(response.status===401)throw new GitlabFailure('GitLab rejected the credential','unauthorized')
  if(response.status===429){const delay=Number(response.headers.get('retry-after'));throw new GitlabFailure('GitLab rate limited the read','throttled',now.getTime()+(Number.isFinite(delay)&&delay>0?Math.min(delay,86400):60)*1000)}
  if(!response.ok)throw new GitlabFailure('GitLab answered '+response.status)
  let body:unknown;try{body=await response.json()}catch{throw new GitlabFailure('schema drift: invalid JSON')}
  let next=/<([^>]+)>;\s*rel="next"/.exec(response.headers.get('link')??'')?.[1]??null
  const page=response.headers.get('x-next-page')
  if(!next&&page){if(!/^\d{1,8}$/.test(page)||Number(page)<1)throw new GitlabFailure('invalid pagination cursor');const url=new URL(base+path);url.searchParams.set('page',page);next=url.href}
  return {body,next}
 }
 async function list<T>(path:string,normalize:(v:unknown)=>T){
  const endpoint=new URL(base+path)
  return readPageStream<T>('gitlab:'+path,path,async cursor=>{
   const url=new URL(cursor.startsWith('http')?cursor:base+cursor)
   if(url.origin!==endpoint.origin||url.pathname!==endpoint.pathname||url.username||url.password||url.hash||[...endpoint.searchParams].some(([k,v])=>k!=='page'&&url.searchParams.get(k)!==v)||[...url.searchParams.keys()].some(k=>!endpoint.searchParams.has(k)&&k!=='page'))throw new GitlabFailure('unsafe source continuation')
   const reply=await get(url.pathname.slice(new URL(base).pathname.length)+url.search)
   if(!Array.isArray(reply.body))throw new GitlabFailure('schema drift: expected a source array')
   return {items:reply.body.map(normalize),next:reply.next}
  },10,message=>new GitlabFailure(message))
 }
 return {get,list}
}
export type GitlabClient=ReturnType<typeof gitlabClient>
export async function gitlabGroup(client:GitlabClient,account:string){
 const {body}=await client.get('/groups/'+encodeURIComponent(account))
 if(!record(body)||!natural(body.id)||body.full_path!==account||typeof body.require_two_factor_authentication!=='boolean')throw new GitlabFailure('schema drift: group identity or two-factor requirement')
 return {id:body.id,login:account,two_factor_requirement_enabled:body.require_two_factor_authentication}
}
export const gitlabProjects=(client:GitlabClient,account:string)=>client.list('/groups/'+encodeURIComponent(account)+'/projects?with_shared=false&include_subgroups=true&per_page=100',value=>{
 if(!record(value)||!natural(value.id)||!string(value.path_with_namespace)||!value.path_with_namespace.startsWith(account+'/'))throw new GitlabFailure('schema drift: project identity or group scope')
 return {id:value.id,name:value.path_with_namespace}
})
const glob=(pattern:string,value:string)=>new RegExp('^'+pattern.split('*').map(p=>p.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('.*')+'$').test(value)
export async function gitlabRepository(client:GitlabClient,name:string){
 const root='/projects/'+encodeURIComponent(name),gaps:string[]=[]
 const attempt=async<T>(label:string,work:()=>Promise<T>):Promise<T|null>=>{try{return await work()}catch(e){if(!(e instanceof GitlabFailure)||e.kind!=='gap')throw e;gaps.push(label+': '+e.message);return null}}
 const project=await client.get(root)
 if(!record(project.body)||project.body.path_with_namespace!==name||!['private','public','internal'].includes(String(project.body.visibility))||!string(project.body.default_branch)||typeof project.body.archived!=='boolean')throw new GitlabFailure('schema drift: project identity, visibility or default branch')
 const p=project.body,branch=p.default_branch as string
 const protection=await attempt('branch protection',()=>client.list(root+'/protected_branches?per_page=100',v=>{if(!record(v)||!natural(v.id)||!string(v.name))throw new GitlabFailure('schema drift: protected branch');return {id:v.id,name:v.name}}))
 const protectedBranches=protection?.filter(v=>glob(v.name,branch))
 const rules=await attempt('required reviews',()=>client.list(root+'/approval_rules?per_page=100',v=>{
  if(!record(v)||!natural(v.approvals_required)||typeof v.applies_to_all_protected_branches!=='boolean'||!Array.isArray(v.protected_branches)||!v.protected_branches.every(b=>record(b)&&natural(b.id)&&string(b.name)))throw new GitlabFailure('schema drift: approval rule scope')
  return {count:v.approvals_required,all:v.applies_to_all_protected_branches,branches:v.protected_branches.map(b=>({id:b.id as number,name:b.name as string}))}
 }))
 const applicable=rules?.filter(r=>r.branches.length===0&&!r.all||r.all&&!!protectedBranches?.length||r.branches.some(b=>protectedBranches?.some(p=>p.id===b.id)))
 let checks:number|null=null
 if(typeof p.only_allow_merge_if_pipeline_succeeds==='boolean'&&typeof p.allow_merge_on_skipped_pipeline==='boolean')checks=p.only_allow_merge_if_pipeline_succeeds&&!p.allow_merge_on_skipped_pipeline?1:0
 else gaps.push('schema drift: required pipeline or skipped-pipeline setting')
 const attributes={private:p.visibility==='private',archived:p.archived,default_branch:branch,branch_protection:protection===null?null:!!protectedBranches?.length,required_reviews:rules===null||protection===null?null:Math.max(0,...(applicable??[]).map(r=>r.count)),required_status_checks:checks,readable:true}
 const changes=await attempt('merged changes',async()=>{
  const merged=await client.list(root+'/merge_requests?state=merged&per_page=100',v=>{
   if(!record(v)||!natural(v.iid)||v.iid<1||!revision(v.sha)||!revision(v.merge_commit_sha)||!instant(v.merged_at)||!string(v.target_branch))throw new GitlabFailure('schema drift: merged request revision or time')
   return {number:v.iid,source_revision:v.sha,merge_revision:v.merge_commit_sha,merged_at:v.merged_at,base:v.target_branch}
  })
  if(merged.length>20)throw new GitlabFailure('more than 20 merged requests; history incomplete')
  const result:ChangeFact[]=[]
  for(const row of merged){
   const reviews=await attempt('approvals for change '+row.number,async()=>{
    const {body}=await client.get(root+'/merge_requests/'+row.number+'/approvals')
    if(!record(body)||typeof body.approved!=='boolean'||!Array.isArray(body.approved_by)||!body.approved_by.every(v=>record(v)&&record(v.user)&&natural(v.user.id)&&string(v.user.username)))throw new GitlabFailure('schema drift: merge request approval state')
    // GitLab says approved=true with zero reviewers when no rule applies.
    // Never turn that boolean into an invented human approval or event time.
    return body.approved_by.map(v=>({id:(v as any).user.id as number,actor:(v as any).user.username as string,state:'APPROVED (current source state)',commit:null,submitted_at:null}))
   })
   const check=await attempt('pipeline for change '+row.number,async()=>{
    const {body}=await client.get(root+'/merge_requests/'+row.number)
    if(!record(body)||body.sha!==row.source_revision||!record(body.head_pipeline)||!natural(body.head_pipeline.id)||body.head_pipeline.sha!==row.source_revision)throw new GitlabFailure('pipeline unavailable or source revision mismatch')
    const pipeline=(await client.get(root+'/pipelines/'+body.head_pipeline.id)).body
    if(!record(pipeline)||pipeline.id!==body.head_pipeline.id||pipeline.sha!==row.source_revision||!['created','waiting_for_resource','preparing','pending','running','success','failed','canceled','skipped','manual','scheduled'].includes(String(pipeline.status))||!(pipeline.finished_at===null||instant(pipeline.finished_at)))throw new GitlabFailure('pipeline details unavailable or source revision mismatch')
    return {name:'GitLab head pipeline',state:pipeline.finished_at?'completed':'in progress',conclusion:pipeline.status as string,completed_at:pipeline.finished_at as string|null,revision:row.source_revision}
   })
   result.push({...row,reviews,checks:check?[check]:null,statuses:null})
  }
  return result
 })
 const deployments=await attempt('deployments',async()=>{
  const rows=await client.list(root+'/deployments?per_page=100',v=>{
   if(!record(v)||!natural(v.id)||!revision(v.sha)||!instant(v.created_at)||!(v.updated_at===undefined||instant(v.updated_at))||!['created','running','success','failed','canceled','blocked'].includes(String(v.status))||!record(v.environment)||!string(v.environment.name))throw new GitlabFailure('schema drift: deployment')
   return {id:v.id,revision:v.sha,environment:v.environment.name,production:typeof v.environment.tier==='string'?v.environment.tier==='production':null,created_at:v.created_at,statuses:typeof v.updated_at==='string'?[{state:v.status,created_at:v.updated_at}]:null,current_state:v.status,change_numbers:(changes??[]).filter(c=>c.merge_revision===v.sha&&Date.parse(c.merged_at)<=Date.parse(v.created_at as string)).map(c=>c.number)} as DeploymentFact
  });if(rows.length>20)throw new GitlabFailure('more than 20 deployments; history incomplete');return rows
 })
 const dependencies=await attempt('dependency metadata',async()=>{
  const packages=await client.list(root+'/dependencies?per_page=100',v=>{
   if(!record(v)||!string(v.name)||!string(v.version)||!/^[A-Za-z0-9._+^~*<>=| -]{1,100}$/.test(v.version)||!string(v.package_manager)||!string(v.dependency_file_path))throw new GitlabFailure('schema drift: dependency metadata')
   return {id:v.package_manager+':'+v.dependency_file_path+':'+v.name,name:v.name,version:v.version}
  });if(packages.length>500)throw new GitlabFailure('more than 500 dependency packages; inventory incomplete')
  return {generated_at:null,packages,note:'GitLab dependency metadata at read time. Manifest originals, exact manifest revision and export-generation time are not established; package presence never approves an AI tool.'}
 })
 const history:GithubHistory={changes,deployments,dependencies,gaps,note:'GitLab source metadata at read time. Current approvals do not establish an approval timestamp or reviewed revision. Pipeline results are on the source head revision; outcomes before merge remain unknown. Deployment production tier is unknown when absent. Original failures and unmatched deployments remain separate facts.'}
 if(new TextEncoder().encode(JSON.stringify(history)).length>50000){history.changes=null;history.deployments=null;history.dependencies=null;gaps.push('history exceeds 50,000 bytes; detailed source history unavailable')}
 return {attributes,history,gaps}
}

// https://docs.gitlab.com/api/members/#list-all-members-of-a-group-or-project-including-inherited-and-invited-members
export async function gitlabMembers(env:Bindings,c:Connection,client:GitlabClient,now:Date){
 const gaps:string[]=[]
 let members:import('./code-members').CodeMember[]|null=null
 try{members=await client.list('/groups/'+encodeURIComponent(c.account)+'/members/all?per_page=100',v=>{
  if(!record(v)||!natural(v.id)||v.id<1||!string(v.username)||!['active','blocked','ldap_blocked','deactivated','banned'].includes(String(v.state))||!natural(v.access_level)||![0,5,10,15,20,25,30,40,50].includes(v.access_level))throw new GitlabFailure('schema drift: inherited group membership')
  return {id:String(v.id),name:v.username,status:String(v.state),admin:v.access_level>=40,roles:'GitLab group access level '+v.access_level,mfa:null,service:v.bot===true}
 });if(new Set(members.map(m=>m.id)).size!==members.length)throw new GitlabFailure('repeated group member identity')}
 catch(e){if(!(e instanceof GitlabFailure)||e.kind!=='gap')throw e;gaps.push('membership: '+e.message);members=null}
 if(members?.length)gaps.push('GitLab group membership does not establish individual MFA enrollment or last sign-in; group enforcement is recorded separately. Use an authorized identity source or reviewed manual evidence for those attributes.')
 return persistCodeMembers(env,c,members,gaps,now)
}
