// Official Bitbucket Cloud OpenAPI shapes, read 22 Oct 2026:
// https://dac-static.atlassian.com/cloud/bitbucket/swagger.v3.json
export function bitbucketFixture(){
 const id=n=>'{00000000-0000-4000-8000-'+String(n).padStart(12,'0')+'}',head='a'.repeat(40),merge='b'.repeat(40),base='https://api.bitbucket.org/2.0'
 const edge={token:'synthetic-evidence-1',requests:[],overrides:new Map(),hidden:new Set(),workspace:id(1),repos:{'northstar/web':{id:id(2),private:true,protected:true},'northstar/site':{id:id(3),private:false,protected:false}}}
 const reply=(body,status=200,headers={})=>Response.json(body,{status,headers}),page=(values,next)=>({pagelen:100,values,...(next?{next}:{})})
 async function outbound(request){
  const u=new URL(request.url);if(u.origin!=='https://api.bitbucket.org')return null
  edge.requests.push({path:u.pathname+u.search,method:request.method})
  if(request.headers.get('authorization')!=='Bearer '+edge.token)return reply({error:{message:'Unauthorized'}},401)
  const path=decodeURIComponent(u.pathname.replace('/2.0','')),override=edge.overrides.get(path+u.search)??edge.overrides.get(path)
  if(override)return reply(override.body,override.status??200,override.headers??{})
  if(path==='/workspaces/northstar')return reply({uuid:edge.workspace,slug:'northstar',name:'Northstar'})
  if(path==='/workspaces/northstar/permissions')return reply(page([]))
  if(path==='/repositories/northstar'){
   const names=Object.keys(edge.repos),number=Number(u.searchParams.get('page')??1)
   return reply(page(names.slice(number-1,number).map(name=>({uuid:edge.repos[name].id,full_name:name,description:'synthetic-evidence-private-description'})),number<names.length?base+path+'?pagelen=100&page='+(number+1):null))
  }
  const match=/^\/repositories\/(northstar\/(?:web|site))(\/.*)?$/.exec(path),name=match?.[1],p=edge.repos[name],tail=match?.[2]
  if(!p||edge.hidden.has(name))return reply({error:{message:'Not found'}},404)
  if(!tail)return reply({uuid:p.id,full_name:name,is_private:p.private,mainbranch:{name:'main',type:'branch'},description:'synthetic-evidence-private-description'})
  if(tail==='/branch-restrictions')return reply(page(p.protected?['push','enforce_merge_checks','require_approvals_to_merge','require_passing_builds_to_merge'].map((kind,i)=>({id:i+1,kind,branch_match_kind:'glob',pattern:'main',...(/require_/.test(kind)?{value:1}:{})})):[]))
  if(tail==='/pullrequests')return reply(page(name==='northstar/web'?[{id:17,state:'MERGED',source:{commit:{hash:head}},merge_commit:{hash:merge},destination:{branch:{name:'main'}},updated_on:'2026-10-11T11:00:00Z',description:'synthetic-evidence-private-change-body'}]:[]))
  if(tail==='/pullrequests/17/activity')return reply(page([{update:{state:'MERGED',date:'2026-10-10T15:00:00.000100+00:00',title:'synthetic-evidence-private-change-title'}},{approval:{date:'2026-10-10T14:45:00Z',user:{uuid:id(20),display_name:'Reviewer'}}},{comment:{content:{raw:'synthetic-evidence-private-comment'}}}]))
  if(tail==='/commit/'+head+'/statuses')return reply(page([{key:'security',state:'FAILED',created_on:'2026-10-10T14:00:00Z',updated_on:'2026-10-10T14:30:00Z',description:'synthetic-evidence-private-check-description'}]))
  if(tail==='/deployments')return reply(page(name==='northstar/web'?[21,22].map(n=>({uuid:id(n),state:{name:'COMPLETED',start_date:n===21?'2026-10-10T15:30:00Z':'2026-10-10T15:00:00.000050+00:00',completion_date:'2026-10-10T15:35:00Z',status:{name:'SUCCESSFUL'}},environment:{uuid:id(30),name:'Production'},release:{uuid:id(40),commit:{hash:merge},url:'https://bitbucket.org/northstar/web/pipelines/results/12'}})):[]))
  if(tail==='/pipelines/'+id(40))return reply({uuid:id(40),repository:{full_name:name},target:{commit:{hash:merge}},state:{name:'COMPLETED',result:{name:'FAILED'}},completed_on:'2026-10-10T15:40:00Z',variables:[{key:'PRIVATE',value:'synthetic-evidence-private-pipeline-value'}]})
  if(tail==='/refs/branches/main')return reply({name:'main',target:{hash:head}})
  if(tail==='/src/'+head+'/package.json')return reply({name:'synthetic-evidence-app',dependencies:name==='northstar/web'?{openai:'6.0.0'}:{},scripts:{private:'synthetic-evidence-private-script'}})
  return reply({error:{message:'Not found'}},404)
 }
 return {edge,outbound,head,merge,id,page,base}
}
