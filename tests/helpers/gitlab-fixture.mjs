// GitLab's published REST schemas (read 22 Oct 2026):
// https://docs.gitlab.com/api/groups/
// https://docs.gitlab.com/api/projects/
// https://docs.gitlab.com/api/protected_branches/
// https://docs.gitlab.com/api/merge_request_approvals/
// https://docs.gitlab.com/api/merge_requests/
// https://docs.gitlab.com/api/deployments/
// https://docs.gitlab.com/api/dependencies/
export function gitlabFixture(){
 const base='https://gitlab.com/api/v4',head='a'.repeat(40),merge='b'.repeat(40)
 const edge={token:'synthetic-evidence-1',requests:[],overrides:new Map(),hidden:new Set(),group:{id:1,full_path:'northstar',require_two_factor_authentication:true},projects:{'northstar/web':{id:2,private:true,protected:true,reviews:2},'northstar/site':{id:3,private:false,protected:false,reviews:0}}}
 const response=(body,status=200,headers={})=>Response.json(body,{status,headers})
 async function outbound(request){
  const url=new URL(request.url);if(url.origin!=='https://gitlab.com')return null
  edge.requests.push({path:url.pathname+url.search,method:request.method})
  if(request.headers.get('authorization')!=='Bearer '+edge.token)return response({message:'Unauthorized'},401)
  const path=decodeURIComponent(url.pathname.replace('/api/v4','')),override=edge.overrides.get(path+url.search)??edge.overrides.get(path)
  if(override)return response(override.body,override.status??200,override.headers??{})
  if(path==='/groups/northstar/members/all')return response([])
  if(path==='/groups/northstar')return response(edge.group)
  if(path==='/groups/northstar/projects'){
   const names=Object.keys(edge.projects),page=Number(url.searchParams.get('page')??1)
   return response(names.slice(page-1,page).map(name=>({id:edge.projects[name].id,path_with_namespace:name,description:'synthetic-evidence-private-project-description'})),200,page<names.length?{'x-next-page':String(page+1)}:{})
  }
  const match=/^\/projects\/(northstar\/(?:web|site))(\/.*)?$/.exec(path),p=match&&edge.projects[match[1]],name=match?.[1],tail=match?.[2]
  if(!p||edge.hidden.has(name))return response({message:'Not found'},404)
  if(!tail)return response({id:p.id,path_with_namespace:name,visibility:p.private?'private':'public',default_branch:'main',archived:false,only_allow_merge_if_pipeline_succeeds:true,allow_merge_on_skipped_pipeline:false,runners_token:'synthetic-evidence-private-runner-field'})
  if(tail==='/protected_branches')return response(p.protected?[{id:9,name:'main',push_access_levels:[{access_level:0}],merge_access_levels:[{access_level:40}],allow_force_push:false}]:[])
  if(tail==='/approval_rules')return response(p.reviews?[{id:5,rule_type:'regular',approvals_required:p.reviews,applies_to_all_protected_branches:true,protected_branches:[]}]:[])
  if(tail==='/merge_requests')return response(name==='northstar/web'?[{iid:31,sha:head,merge_commit_sha:merge,merged_at:'2026-10-10T15:00:00Z',target_branch:'main',description:'synthetic-evidence-private-change-description'}]:[])
  if(tail==='/merge_requests/31/approvals')return response({approved:true,approved_by:[],approvals_required:0})
  if(tail==='/pipelines/6')return response({id:6,sha:head,status:'failed',finished_at:'2026-10-10T14:50:00Z'})
  if(tail==='/merge_requests/31')return response({iid:31,sha:head,head_pipeline:{id:6,sha:head,status:'failed'}})
  if(tail==='/deployments')return response(name==='northstar/web'?[{id:8,sha:merge,created_at:'2026-10-10T15:30:00Z',status:'success',environment:{id:4,name:'production'},deployable:null}]:[])
  if(tail==='/dependencies')return response(name==='northstar/web'?[{name:'openai',version:'6.0.0',package_manager:'npm',dependency_file_path:'package-lock.json',vulnerabilities:[],licenses:[],downloadLocation:'synthetic-evidence-private-package-field'}]:[])
  return response({message:'Not found'},404)
 }
 return {edge,outbound,base,head,merge}
}
