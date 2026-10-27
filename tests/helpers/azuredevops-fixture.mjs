// Microsoft REST 7.1 official schemas, read 22 Oct 2026:
// https://learn.microsoft.com/en-us/rest/api/azure/devops/{core/projects,git/repositories,git/policy-configurations,git/pull-requests,git/statuses,git/items,git/refs,graph/users,release/deployments,release/releases,build/builds}
export function azuredevopsFixture(){
 const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0'),head='a'.repeat(40),merge='b'.repeat(40)
 const edge={token:'synthetic-evidence-1',requests:[],overrides:new Map(),hidden:new Set(),repos:{[id(1)+'/'+id(2)]:{name:'Web',project:'Engineering',private:true,protected:true},[id(4)+'/'+id(3)]:{name:'Site',project:'Marketing',private:false,protected:false},[id(1)+'/'+id(5)]:{name:'Unselected',project:'Engineering',private:true,protected:true}}}
 const page=values=>({count:values.length,value:values}),reply=(body,status=200,headers={})=>Response.json(body,{status,headers})
 async function outbound(request){
  const u=new URL(request.url);if(!['dev.azure.com','vssps.dev.azure.com','vsrm.dev.azure.com'].includes(u.hostname))return null
  edge.requests.push({host:u.hostname,path:u.pathname+u.search,method:request.method})
  if(request.headers.get('authorization')!=='Basic '+Buffer.from(':'+edge.token).toString('base64'))return reply({message:'Unauthorized'},401)
  const path=decodeURIComponent(u.pathname.replace('/northstar','')),override=edge.overrides.get(u.hostname+path+u.search)??edge.overrides.get(u.hostname+path)??edge.overrides.get(path+u.search)??edge.overrides.get(path)
  if(override)return reply(override.body,override.status??200,override.headers??{})
  if(path==='/_apis/projects')return reply(page([1,4].map(n=>({id:id(n),name:n===1?'Engineering':'Marketing'}))))
  if(path==='/_apis/git/repositories')return reply(page(Object.entries(edge.repos).map(([key,r])=>({id:key.split('/')[1],name:r.name,project:{id:key.split('/')[0],name:r.project}}))))
  if(path==='/_apis/graph/users')return reply(page([]))
  const project=/^\/_apis\/projects\/([^/]+)$/.exec(path)
  if(project){const r=Object.entries(edge.repos).find(([key])=>key.startsWith(project[1]+'/'))?.[1];return r?reply({id:project[1],name:r.project,visibility:r.private?'private':'public'}):reply({message:'Not found'},404)}
  const policies=/^\/([^/]+)\/_apis\/git\/policy\/configurations$/.exec(path)
  if(policies){const repo=u.searchParams.get('repositoryId'),r=edge.repos[policies[1]+'/'+repo],scope=[{repositoryId:repo,refName:'refs/heads/main',matchKind:'Exact'}]
   return reply(page(r?.protected?[
    {id:1,isEnabled:true,isBlocking:true,type:{id:'fa4e907d-c16b-4a4c-9dfa-4906e5d171dd'},settings:{scope,minimumApproverCount:2,creatorVoteCounts:false}},
    {id:2,isEnabled:true,isBlocking:true,type:{id:'0609b952-1397-4640-95ec-e00a01b2c241'},settings:{scope:[{repositoryId:null,refName:'refs/heads/',matchKind:'Prefix'}],buildDefinitionId:7}},
    {id:3,isEnabled:false,isBlocking:true,type:{id:'fa4e907d-c16b-4a4c-9dfa-4906e5d171dd'},settings:{scope,minimumApproverCount:99,creatorVoteCounts:false}},
    {id:4,isEnabled:true,isBlocking:false,type:{id:'0609b952-1397-4640-95ec-e00a01b2c241'},settings:{scope,buildDefinitionId:8}},
    {id:5,isEnabled:true,isBlocking:true,type:{id:'fa4e907d-c16b-4a4c-9dfa-4906e5d171dd'},settings:{scope:[{repositoryId:id(99),refName:'refs/heads/main',matchKind:'Exact'}],minimumApproverCount:99,creatorVoteCounts:false}},
   ]:[]))
  }
  const repo=/^\/([^/]+)\/_apis\/git\/repositories\/([^/]+)(\/.*)?$/.exec(path),key=repo?repo[1]+'/'+repo[2]:null,r=edge.repos[key],tail=repo?.[3]
  if(repo){if(!r||edge.hidden.has(key))return reply({message:'Not found'},404)
   if(!tail)return reply({id:repo[2],name:r.name,project:{id:repo[1],name:r.project},defaultBranch:'refs/heads/main',isDisabled:false,description:'synthetic-evidence-private-repo-description'})
   if(tail==='/pullrequests')return reply(page(repo[2]===id(2)?[{pullRequestId:19,status:'completed',closedDate:'2026-10-10T15:00:00.0000001Z',targetRefName:'refs/heads/main',lastMergeSourceCommit:{commitId:head},lastMergeCommit:{commitId:merge},reviewers:[{id:id(80),vote:10},{id:id(81),vote:-10}],description:'synthetic-evidence-private-change-description'}]:[]))
   if(tail==='/commits/'+head+'/statuses')return reply(page([{id:1,state:'failed',context:{name:'security',genre:'ci'},updatedDate:'2026-10-10T14:30:00Z',description:'synthetic-evidence-private-check-description'}]))
   if(tail==='/refs')return reply(page([{name:'refs/heads/main',objectId:head}]))
   if(tail==='/items')return reply({path:'/package.json',commitId:head,content:JSON.stringify({name:'synthetic-evidence-app',dependencies:repo[2]===id(2)?{openai:'6.0.0'}:{},scripts:{private:'synthetic-evidence-private-script'}})})
  }
  const deployments=/^\/([^/]+)\/_apis\/release\/deployments$/.exec(path)
  if(deployments)return reply(page(deployments[1]===id(1)?[{id:21,release:{id:11},releaseDefinition:{id:5},definitionEnvironmentId:7,releaseEnvironment:{id:31,name:'Production'},startedOn:'2026-10-10T15:30:00Z',deploymentStatus:'succeeded',lastModifiedOn:'2026-10-10T15:40:00Z'}]:[]))
  if(path==='/'+id(1)+'/_apis/release/releases/11')return reply({id:11,artifacts:[101,102].map(n=>({type:'Build',definitionReference:{project:{id:id(1)},version:{id:String(n)}}})),variables:{SECRET:{isSecret:true,value:'synthetic-evidence-private-release-variable'}},description:'synthetic-evidence-private-release-description'})
  const build=/^\/([^/]+)\/_apis\/build\/builds\/(\d+)$/.exec(path)
  if(build)return reply({id:Number(build[2]),repository:{id:build[2]==='101'?id(2):id(5),type:'TfsGit'},sourceVersion:merge,result:'failed',finishTime:'2026-10-10T14:45:00Z',parameters:'synthetic-evidence-private-build-parameters'})
  return reply({message:'Not found'},404)
 }
 return {edge,outbound,id,page,head,merge,web:id(1)+'/'+id(2),site:id(4)+'/'+id(3)}
}
