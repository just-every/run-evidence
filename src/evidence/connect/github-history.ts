import { githubDependencies, DependencyGap, type Dependencies } from './github-dependencies'
import type { Client } from './github'
import { natural, record } from './github-schema'
import { readPageStream } from './pages'
// GitHub REST 2022-11-28 metadata only. No patch, commit message, PR body,
// repository file, environment secret or arbitrary response object is retained.
// https://docs.github.com/en/rest/pulls/pulls#list-pull-requests
// https://docs.github.com/en/rest/pulls/reviews#list-reviews-for-a-pull-request
// https://docs.github.com/en/rest/checks/runs#list-check-runs-for-a-git-reference
// https://docs.github.com/en/rest/repos/statuses#get-the-combined-status-for-a-specific-reference
// https://docs.github.com/en/rest/deployments/deployments#list-deployments
// https://docs.github.com/en/rest/deployments/statuses#list-deployment-statuses
class HistoryGap extends Error {}
const str = (v: unknown, max = 200): v is string => typeof v === 'string' && v.length > 0 && v.length <= max
const sha = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{40,64}$/i.test(v)
const date = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d\d-\d\dT/.test(v) && Number.isFinite(Date.parse(v))
const actor = (v: unknown): string => { if (!record(v) || !natural(v.id) || !str(v.login)) throw new HistoryGap('schema drift: source actor'); return v.login }
export interface ReviewFact { id:number; actor:string; state:string; commit:string|null; submitted_at:string|null }
export interface CheckFact { name:string; state:string; conclusion:string|null; completed_at:string|null; revision:string }
export interface ChangeFact { number:number; merged_at:string; source_revision:string; merge_revision:string; base:string; reviews:ReviewFact[]|null; checks:CheckFact[]|null; statuses:{context:string;state:string;created_at:string}[]|null }
export interface DeploymentFact { current_state?:string; id:number; revision:string; environment:string; production:boolean|null; created_at:string; statuses:{state:string;created_at:string}[]|null; change_numbers:number[] }
export interface GithubHistory { changes:ChangeFact[]|null; deployments:DeploymentFact[]|null; dependencies:Dependencies|null; gaps:string[]; note:string }
export async function readGithubHistory(client:Client,base:string,name:string):Promise<GithubHistory> {
 const root='/repos/'+name.split('/').map(encodeURIComponent).join('/'), gaps:string[]=[]
 async function list<T>(path:string,normalize:(row:unknown)=>T,property?:string):Promise<T[]> {
  const endpoint=new URL(base+path)
  return readPageStream('github-history:'+name+':'+path,path,async cursor=>{
   const url=new URL(cursor.startsWith('http')?cursor:base+cursor)
   if(url.origin!==endpoint.origin||url.pathname!==endpoint.pathname||url.username||url.password||url.hash||[...endpoint.searchParams].some(([k,v])=>k!=='page'&&url.searchParams.get(k)!==v)||[...url.searchParams.keys()].some(k=>!endpoint.searchParams.has(k)&&!['page','after','before'].includes(k)))throw new HistoryGap('pagination incomplete: unsafe history continuation')
   const reply=await client.get(url.href), rows=property&&record(reply.body)?reply.body[property]:reply.body
   if(reply.status!==200)throw new HistoryGap('history unreadable: GitHub answered '+reply.status)
   if(!Array.isArray(rows))throw new HistoryGap('schema drift: history array')
   return {items:rows.map(normalize),next:reply.next}
  },10,message=>new HistoryGap(message))
 }
 const attempt=async<T>(label:string,read:()=>Promise<T>):Promise<T|null>=>{try{return await read()}catch(e){if(!(e instanceof HistoryGap))throw e;gaps.push(label+': '+e.message);return null}}
 const changes=await attempt('merged changes',async()=>{
  const rows=await list(root+'/pulls?state=closed&sort=updated&direction=desc&per_page=100',value=>{
   if(!record(value)||!natural(value.number)||value.number<1||!(value.merged_at===null||date(value.merged_at))||!record(value.head)||!sha(value.head.sha)||!record(value.base)||!str(value.base.ref)||!(value.merge_commit_sha===null||sha(value.merge_commit_sha)))throw new HistoryGap('schema drift: pull request revision or merge time')
   return {number:value.number,merged_at:value.merged_at as string|null,source_revision:value.head.sha,merge_revision:value.merge_commit_sha as string|null,base:value.base.ref}
  })
  const merged=rows.filter(r=>r.merged_at!==null)
  if(merged.length>20)throw new HistoryGap('more than 20 merged changes; history incomplete, no clean review claim')
  const result:ChangeFact[]=[]
  for(const row of merged){
   if(!row.merge_revision)throw new HistoryGap('schema drift: merged change lacks merge revision')
   const reviews=await attempt('reviews for change '+row.number,()=>list(root+'/pulls/'+row.number+'/reviews?per_page=100',value=>{
    if(!record(value)||!natural(value.id)||!['APPROVED','CHANGES_REQUESTED','COMMENTED','DISMISSED','PENDING'].includes(String(value.state))||!sha(value.commit_id)||!date(value.submitted_at))throw new HistoryGap('schema drift: review')
    return {id:value.id,actor:actor(value.user),state:String(value.state),commit:value.commit_id,submitted_at:value.submitted_at}
   }))
   const checks=await attempt('checks for change '+row.number,()=>list(root+'/commits/'+row.source_revision+'/check-runs?per_page=100',value=>{
    if(!record(value)||!str(value.name)||!sha(value.head_sha)||!['queued','in_progress','completed','waiting','requested','pending'].includes(String(value.status))||!(value.conclusion===null||['success','failure','neutral','cancelled','skipped','timed_out','action_required','stale','startup_failure'].includes(String(value.conclusion)))||!(value.completed_at===null||date(value.completed_at)))throw new HistoryGap('schema drift: check run')
    if(value.head_sha!==row.source_revision)throw new HistoryGap('check run does not match the reviewed source revision')
    return {name:value.name,state:String(value.status),conclusion:value.conclusion as string|null,completed_at:value.completed_at as string|null,revision:value.head_sha}
   },'check_runs'))
   const statuses=await attempt('statuses for change '+row.number,()=>list(root+'/commits/'+row.source_revision+'/status?per_page=100',value=>{
    if(!record(value)||!str(value.context)||!['error','failure','pending','success'].includes(String(value.state))||!date(value.created_at))throw new HistoryGap('schema drift: commit status')
    return {context:value.context,state:String(value.state),created_at:value.created_at}
   },'statuses'))
   result.push({...row,merged_at:row.merged_at!,merge_revision:row.merge_revision,reviews,checks,statuses})
  }
  return result
 })
 const deployments=await attempt('deployments',async()=>{
  const rows=await list(root+'/deployments?per_page=100',value=>{
   if(!record(value)||!natural(value.id)||value.id<1||!sha(value.sha)||!str(value.environment)||typeof value.production_environment!=='boolean'||!date(value.created_at))throw new HistoryGap('schema drift: deployment')
   return {id:value.id,revision:value.sha,environment:value.environment,production:value.production_environment,created_at:value.created_at}
  })
  if(rows.length>20)throw new HistoryGap('more than 20 deployments; history incomplete, no clean deployment claim')
  const result:DeploymentFact[]=[]
  for(const row of rows){
   const statuses=await attempt('deployment '+row.id+' statuses',()=>list(root+'/deployments/'+row.id+'/statuses?per_page=100',value=>{
    if(!record(value)||!['error','failure','inactive','pending','success','queued','in_progress'].includes(String(value.state))||!date(value.created_at))throw new HistoryGap('schema drift: deployment status')
    return {state:String(value.state),created_at:value.created_at}
   }))
   result.push({...row,statuses,change_numbers:(changes??[]).filter(c=>c.merge_revision===row.revision&&Date.parse(c.merged_at)<=Date.parse(row.created_at)).map(c=>c.number)})
  }
  return result
 })
 const dependencies=await attempt('dependency export',async()=>{
  try{return await githubDependencies(client,name)}catch(e){if(e instanceof DependencyGap)throw new HistoryGap(e.message);throw e}
 })
 const result:GithubHistory={changes,deployments,dependencies,gaps,note:'Source metadata at read time; reviews retain their own commit and time. Current check results are not proof of their state before a merge. Deployment links require the exact merge revision and chronological order. Unmatched deployments and unavailable history remain unknown; empty history does not prove no changes occurred.'}
 if(new TextEncoder().encode(JSON.stringify(result)).length>50000)return {changes:null,deployments:null,dependencies:null,gaps:['history exceeds the 50,000-byte per-repository metadata bound; history incomplete'],note:result.note}
 return result
}
