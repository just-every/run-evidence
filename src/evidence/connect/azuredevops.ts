import {scopedFetch} from '../ops/execution'
import {record,natural} from './github-schema'
import {sourceInstant,sourceAtOrAfter} from './source-time'
import {readPageStream} from './pages'
import {persistCodeMembers} from './code-members'
import type {Bindings} from '../../auth.server'
import type {Connection} from './storage'
import type {GithubHistory,ChangeFact,DeploymentFact} from './github-history'
export class AzureDevopsFailure extends Error{constructor(message:string,public kind:'gap'|'unauthorized'|'throttled'='gap',public reset=0){super(message)}}
const string=(v:unknown):v is string=>typeof v==='string'&&v.length>0&&v.length<=200
const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v)
const revision=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{40,64}$/i.test(v)
const date=(v:unknown):v is string=>sourceInstant(v)!==null
export const azuredevopsPermissions=['vso.code (read code, PRs, commit statuses and policies)','vso.project (read project visibility)','vso.build (read build artifacts)','vso.release (read project-level release metadata)','vso.graph (read organization membership); MFA and effective administrator privileges are not exposed here']
// Microsoft REST 7.1/7.1-preview.1 official reference schemas:
// https://learn.microsoft.com/en-us/rest/api/azure/devops/{core/projects,git/repositories,git/policy-configurations,git/pull-requests,git/statuses,git/items,git/refs,graph/users,release/deployments,release/releases,build/builds}
// Fixed service origins and GET-only PAT usage. Provider URLs in bodies are
// never fetched; releases retain only artifacts matching the selected repo.
export function azuredevopsClient(base:string,token:string,now:Date){
 type Area='main'|'graph'|'release'
 const account=new URL(base).pathname.split('/').filter(Boolean)[0],bases={main:base,graph:'https://vssps.dev.azure.com/'+account,release:'https://vsrm.dev.azure.com/'+account}
 async function get(path:string,area:Area='main'){
  const response=await scopedFetch(bases[area]+path,{headers:{authorization:'Basic '+btoa(':'+token),accept:'application/json'},redirect:'manual'})
  if(response.status===401)throw new AzureDevopsFailure('Azure DevOps rejected the credential','unauthorized')
  if(response.status===429){const n=Number(response.headers.get('retry-after'));throw new AzureDevopsFailure('Azure DevOps rate limited the read','throttled',now.getTime()+(Number.isFinite(n)&&n>0?Math.min(n,86400):60)*1000)}
  if(!response.ok)throw new AzureDevopsFailure('Azure DevOps answered '+response.status)
  let body:unknown;try{body=await response.json()}catch{throw new AzureDevopsFailure('schema drift: invalid JSON')}
  const cursor=response.headers.get('x-ms-continuationtoken')
  if(cursor&&(cursor.length>2048||/[\r\n\x00]/.test(cursor)))throw new AzureDevopsFailure('invalid continuation token')
  return {body,cursor}
 }
 async function list<T>(path:string,normalize:(v:unknown)=>T,area:Area='main',offset=false){
  const endpoint=new URL(bases[area]+path)
  return readPageStream<T>('azuredevops:'+area+':'+path,path,async cursor=>{
   const u=new URL(cursor.startsWith('http')?cursor:bases[area]+cursor)
   if(u.origin!==endpoint.origin||u.pathname!==endpoint.pathname||u.username||u.password||u.hash||[...endpoint.searchParams].some(([k,v])=>!['continuationToken','$skip'].includes(k)&&u.searchParams.get(k)!==v)||[...u.searchParams.keys()].some(k=>!endpoint.searchParams.has(k)&&!['continuationToken','$skip'].includes(k)))throw new AzureDevopsFailure('unsafe source continuation')
   const reply=await get(u.pathname.slice(new URL(bases[area]).pathname.length)+u.search,area)
   if(!record(reply.body)||!Array.isArray(reply.body.value)||reply.body.count!==undefined&&(!natural(reply.body.count)||reply.body.count!==reply.body.value.length))throw new AzureDevopsFailure('schema drift: paginated source envelope')
   let next:string|null=null
   if(reply.cursor){const n=new URL(u);n.searchParams.set('continuationToken',reply.cursor);next=n.href}
   else if(offset&&reply.body.value.length===100){const n=new URL(u);n.searchParams.set('$skip',String(Number(u.searchParams.get('$skip')??0)+100));next=n.href}
   return {items:reply.body.value.map(normalize),next}
  },10,m=>new AzureDevopsFailure(m))
 }
 return {get,list,base}
}
type Client=ReturnType<typeof azuredevopsClient>
export async function azuredevopsGroup(client:Client,account:string){
 await client.list('/_apis/projects?api-version=7.1&$top=100',v=>{if(!record(v)||!uuid(v.id)||!string(v.name))throw new AzureDevopsFailure('schema drift: project identity');return {id:v.id,name:v.name}})
 return {id:account,login:account,two_factor_requirement_enabled:null}
}
export const azuredevopsProjects=(client:Client,_account:string)=>client.list('/_apis/git/repositories?api-version=7.1&includeHidden=true',v=>{
 if(!record(v)||!uuid(v.id)||!string(v.name)||!record(v.project)||!uuid(v.project.id)||!string(v.project.name))throw new AzureDevopsFailure('schema drift: repository/project identity')
 return {id:v.id,name:v.project.id+'/'+v.id,label:v.project.name+'/'+v.name}
})
export async function azuredevopsRepository(client:Client,name:string){
 const [project,repository]=name.split('/');if(!uuid(project)||!uuid(repository))throw new AzureDevopsFailure('invalid selected project/repository identity')
 const root='/'+project+'/_apis/git/repositories/'+repository,gaps:string[]=[]
 const attempt=async<T>(label:string,work:()=>Promise<T>):Promise<T|null>=>{try{return await work()}catch(e){if(!(e instanceof AzureDevopsFailure)||e.kind!=='gap')throw e;gaps.push(label+': '+e.message);return null}}
 const repo=(await client.get(root+'?api-version=7.1')).body,p=(await client.get('/_apis/projects/'+project+'?api-version=7.1')).body
 if(!record(repo)||repo.id!==repository||!string(repo.name)||!record(repo.project)||repo.project.id!==project||!record(p)||p.id!==project||!string(p.name)||!['private','public'].includes(String(p.visibility)))throw new AzureDevopsFailure('schema drift: selected repository identity or project visibility')
 const branch=typeof repo.defaultBranch==='string'&&repo.defaultBranch.startsWith('refs/heads/')?repo.defaultBranch:null
 if(!branch)gaps.push('Default branch unavailable; branch policies and manifest revision are unknown.')
 const policies=branch?await attempt('branch policies',()=>client.list('/'+project+'/_apis/git/policy/configurations?repositoryId='+repository+'&refName='+encodeURIComponent(branch)+'&api-version=7.1',v=>{
  if(!record(v)||!natural(v.id)||typeof v.isEnabled!=='boolean'||typeof v.isBlocking!=='boolean'||!(v.isDeleted===undefined||typeof v.isDeleted==='boolean')||!record(v.type)||!uuid(v.type.id)||!record(v.settings)||!Array.isArray(v.settings.scope))throw new AzureDevopsFailure('schema drift: blocking policy or scope')
  const scope=v.settings.scope.map(s=>{if(!record(s)||!(s.repositoryId===null||uuid(s.repositoryId))||!(s.refName===null||typeof s.refName==='string')||!['Exact','Prefix'].includes(String(s.matchKind)))throw new AzureDevopsFailure('schema drift: policy branch match');return {repository:s.repositoryId as string|null,ref:s.refName as string|null,kind:String(s.matchKind)}})
  if(v.type.id==='0609b952-1397-4640-95ec-e00a01b2c241'&&(!natural(v.settings.buildDefinitionId)||v.settings.buildDefinitionId<1))throw new AzureDevopsFailure('schema drift: build policy definition')
  if(v.type.id==='cbdc66da-9728-4af8-aada-9a5a32e4a226'&&!string(v.settings.statusName))throw new AzureDevopsFailure('schema drift: status policy context')
  const minimum=v.settings.minimumApproverCount,creator=v.settings.creatorVoteCounts
  if(v.type.id==='fa4e907d-c16b-4a4c-9dfa-4906e5d171dd'&&(!natural(minimum)||typeof creator!=='boolean'))throw new AzureDevopsFailure('schema drift: minimum approving reviewer policy')
  return {id:v.id,type:v.type.id,enabled:v.isEnabled&&v.isDeleted!==true,blocking:v.isBlocking,scope,minimum:typeof minimum==='number'?Math.max(0,minimum-(creator===true?1:0)):null}
 })):null
 const applicable=policies?.filter(p=>p.enabled&&p.blocking&&p.scope.some(s=>(s.repository===null||s.repository===repository)&&(s.ref===null||s.kind==='Exact'&&s.ref===branch||s.kind==='Prefix'&&branch!.startsWith(s.ref))))
 const attributes={private:p.visibility==='private',archived:null,default_branch:branch,branch_protection:policies===null?null:!!applicable?.length,required_reviews:policies===null?null:Math.max(0,...(applicable??[]).filter(p=>p.type==='fa4e907d-c16b-4a4c-9dfa-4906e5d171dd').map(p=>p.minimum??0)),required_status_checks:policies===null?null:(applicable??[]).filter(p=>['0609b952-1397-4640-95ec-e00a01b2c241','cbdc66da-9728-4af8-aada-9a5a32e4a226'].includes(p.type)).length,readable:true}
 const changes=await attempt('merged changes',async()=>{
  const rows=await client.list(root+'/pullrequests?searchCriteria.status=completed&$top=100&api-version=7.1',v=>{
   if(!record(v)||!natural(v.pullRequestId)||v.pullRequestId<1||v.status!=='completed'||!date(v.closedDate)||!record(v.lastMergeSourceCommit)||!revision(v.lastMergeSourceCommit.commitId)||!record(v.lastMergeCommit)||!revision(v.lastMergeCommit.commitId)||!string(v.targetRefName)||!Array.isArray(v.reviewers))throw new AzureDevopsFailure('schema drift: completed pull request')
   const reviews=v.reviewers.map(r=>{if(!record(r)||!uuid(r.id)||![-10,-5,0,5,10].includes(Number(r.vote))||typeof r.vote!=='number')throw new AzureDevopsFailure('schema drift: source reviewer vote');return {id:r.id,actor:r.id,state:({10:'APPROVED',5:'APPROVED WITH SUGGESTIONS',0:'NO VOTE',[-5]:'WAITING FOR AUTHOR',[-10]:'REJECTED'} as Record<number,string>)[r.vote],commit:null,submitted_at:null}})
   return {number:v.pullRequestId,merged_at:v.closedDate,source_revision:v.lastMergeSourceCommit.commitId,merge_revision:v.lastMergeCommit.commitId,base:v.targetRefName,reviews}
  },'main',true)
  if(rows.length>20)throw new AzureDevopsFailure('more than 20 completed changes; history incomplete')
  const result:ChangeFact[]=[]
  for(const row of rows){const checks=await attempt('commit statuses for change '+row.number,()=>client.list(root+'/commits/'+row.source_revision+'/statuses?api-version=7.1',v=>{
   if(!record(v)||!record(v.context)||!string(v.context.name)||!['error','failed','notApplicable','pending','succeeded'].includes(String(v.state))||!date(v.updatedDate))throw new AzureDevopsFailure('schema drift: commit status')
   return {name:(typeof v.context.genre==='string'?v.context.genre+': ':'')+v.context.name,state:v.state==='pending'?'in progress':'completed',conclusion:String(v.state),completed_at:v.state==='pending'?null:v.updatedDate,revision:row.source_revision}
  }));result.push({...row,checks,statuses:null})}return result
 })
 const deployments=await attempt('Pipelines releases',async()=>{
  const rows=await client.list('/'+project+'/_apis/release/deployments?$top=100&api-version=7.1',v=>{
   if(!record(v)||!natural(v.id)||!record(v.release)||!natural(v.release.id)||!record(v.releaseDefinition)||!natural(v.releaseDefinition.id)||!natural(v.definitionEnvironmentId)||!record(v.releaseEnvironment)||!string(v.releaseEnvironment.name)||!date(v.startedOn)||!['notDeployed','inProgress','succeeded','partiallySucceeded','failed','canceled'].includes(String(v.deploymentStatus)))throw new AzureDevopsFailure('schema drift: release deployment')
   return {id:v.id,release:v.release.id,definition:v.releaseDefinition.id,environment_id:v.definitionEnvironmentId,environment:v.releaseEnvironment.name,started:v.startedOn,state:String(v.deploymentStatus)}
  },'release')
  if(rows.length>20)throw new AzureDevopsFailure('more than 20 project deployments; source history incomplete')
  const result:DeploymentFact[]=[]
  for(const row of rows){
   const release=(await client.get('/'+project+'/_apis/release/releases/'+row.release+'?api-version=7.1','release')).body
   if(!record(release)||release.id!==row.release||!Array.isArray(release.artifacts))throw new AzureDevopsFailure('schema drift: release artifacts')
   let matched=false
   for(const a of release.artifacts){
    if(!record(a)||a.type!=='Build')continue
    if(!record(a.definitionReference)||!record(a.definitionReference.project)||a.definitionReference.project.id!==project||!record(a.definitionReference.version)||typeof a.definitionReference.version.id!=='string'||!/^\d{1,12}$/.test(a.definitionReference.version.id))throw new AzureDevopsFailure('unsupported or malformed build artifact; cross-project release coverage unknown')
    const build=(await client.get('/'+project+'/_apis/build/builds/'+a.definitionReference.version.id+'?api-version=7.1')).body
    if(!record(build)||!natural(build.id)||String(build.id)!==a.definitionReference.version.id||!record(build.repository)||!uuid(build.repository.id)||!revision(build.sourceVersion)||!['none','succeeded','partiallySucceeded','failed','canceled'].includes(String(build.result))||!(build.finishTime===null||date(build.finishTime)))throw new AzureDevopsFailure('schema drift: release build source')
    if(build.repository.id!==repository)continue
    matched=true
    result.push({id:row.id,revision:build.sourceVersion,environment:row.environment,environment_key:project+':'+row.definition+':'+row.environment_id,production:null,created_at:row.started,current_state:row.state,statuses:null,pipeline_identity:'build:'+build.id,pipeline_state:String(build.result),pipeline_completed_at:build.finishTime as string|null,source_url:client.base+'/'+project+'/_build/results?buildId='+build.id,change_numbers:(changes??[]).filter(c=>c.merge_revision===build.sourceVersion&&sourceAtOrAfter(row.started,c.merged_at)).map(c=>c.number)})
   }
   if(!matched)gaps.push('deployment '+row.id+': no verified artifact for the selected repository; no change link is inferred')
  }return result
 })
 const dependencies=branch?await attempt('package manifest',async()=>{
  const refs=await client.list(root+'/refs?filter='+encodeURIComponent(branch.slice(5))+'&api-version=7.1',v=>{if(!record(v)||typeof v.name!=='string'||!revision(v.objectId))throw new AzureDevopsFailure('schema drift: source ref');return {name:v.name,revision:v.objectId}}),selected=refs.filter(r=>r.name===branch)
  if(selected.length!==1)throw new AzureDevopsFailure('unique source branch revision unavailable')
  const commit=selected[0].revision,item=(await client.get(root+'/items?path=%2Fpackage.json&includeContent=true&versionDescriptor.versionType=commit&versionDescriptor.version='+commit+'&api-version=7.1')).body
  if(!record(item)||item.commitId!==commit||item.path!=='/package.json'||typeof item.content!=='string'||item.content.length>128000)throw new AzureDevopsFailure('source manifest unavailable, oversized or revision mismatch')
  let body:unknown;try{body=JSON.parse(item.content)}catch{throw new AzureDevopsFailure('schema drift: package manifest JSON')}
  if(!record(body))throw new AzureDevopsFailure('schema drift: package manifest object')
  const packages:{id:string;name:string;version:string|null}[]=[]
  for(const field of ['dependencies','devDependencies','optionalDependencies','peerDependencies']){if(body[field]===undefined)continue;if(!record(body[field]))throw new AzureDevopsFailure('schema drift: dependency map');for(const [name,version]of Object.entries(body[field])){if(!/^[@A-Za-z0-9_.+/-]{1,200}$/.test(name)||typeof version!=='string'||!/^[A-Za-z0-9._+^~*<>=| -]{1,100}$/.test(version))throw new AzureDevopsFailure('unsupported dependency locator');packages.push({id:field+':'+name,name,version})}}
  if(packages.length>500)throw new AzureDevopsFailure('more than 500 package entries; inventory incomplete')
  return {generated_at:null,source_revision:commit,packages,note:'Parsed package.json metadata from an exact source commit. Original bytes and other manifest formats are not retained; no generated timestamp or AI approval is invented.'}
 }):null
 const history:GithubHistory={label:p.name+'/'+repo.name,changes,deployments,dependencies,gaps,note:'Azure DevOps source metadata. Blocking branch policies exclude disabled, nonblocking and out-of-scope rules. Current reviewer votes have no established reviewed revision/time. Exact-commit statuses are current source results, not independent pre-merge proof. Classic Pipelines releases link only after build-artifact repository and source revision readback; deployment and build outcomes remain separate, and production classification is an explicit prospective owner decision.'}
 if(new TextEncoder().encode(JSON.stringify(history)).length>50000){history.changes=null;history.deployments=null;history.dependencies=null;gaps.push('source history exceeds 50,000 bytes; detailed coverage unavailable')}
 return {attributes,history,gaps}
}
export async function azuredevopsMembers(env:Bindings,c:Connection,client:Client,now:Date){
 const gaps=['Azure DevOps Graph users do not establish MFA policy/enrollment, active access or effective administrator privilege; use an authorized identity-policy source or reviewed manual evidence.']
 let members:import('./code-members').CodeMember[]|null=null
 try{members=await client.list('/_apis/graph/users?api-version=7.1-preview.1',v=>{if(!record(v)||v.subjectKind!=='user'||typeof v.descriptor!=='string'||!v.descriptor||v.descriptor.length>120||!string(v.displayName))throw new AzureDevopsFailure('schema drift: graph membership');return {id:v.descriptor,name:v.displayName,status:'unknown',admin:null,roles:'Effective privileges not exposed',mfa:null,service:v.origin==='vsts'&&v.metaType==='service'}} ,'graph');if(new Set(members.map(m=>m.id)).size!==members.length)throw new AzureDevopsFailure('repeated source identity')}
 catch(e){if(!(e instanceof AzureDevopsFailure)||e.kind!=='gap')throw e;gaps.push('membership: '+e.message);members=null}
 return persistCodeMembers(env,c,members,gaps,now)
}
