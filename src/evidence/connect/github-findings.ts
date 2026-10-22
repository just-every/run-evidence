import type {Client} from './github'
import {record,natural} from './github-schema'
import {sourceInstant} from './source-time'
import {readPageStream} from './pages'
// Official GitHub alert schemas. Normalize before any durable checkpoint;
// literal secrets, location content, comments and advisory prose are excluded.
// https://docs.github.com/en/rest/dependabot/alerts#list-dependabot-alerts-for-a-repository
// https://docs.github.com/en/rest/secret-scanning/secret-scanning#list-secret-scanning-alerts-for-a-repository
export interface CodeFinding {provider:string;repository:string;kind:string;number:number;state:string;severity:string|null;cve:string|null;ghsa:string|null;package:string|null;ecosystem:string|null;created_at:string;updated_at:string;resolved_at:string|null;source_url:string;readable:boolean}
class FindingGap extends Error {}
const safe=(v:unknown,max=200):v is string=>typeof v==='string'&&v.length>0&&v.length<=max&&/^[A-Za-z0-9_@.+/-]+$/.test(v)
const date=(v:unknown):v is string=>typeof v==='string'&&sourceInstant(v)!==null
export async function githubFindings(client:Client,base:string,repository:string){
 const root='/repos/'+repository.split('/').map(encodeURIComponent).join('/'),rows:CodeFinding[]=[],gaps:string[]=[],complete:string[]=[]
 for(const kind of ['dependabot','secret-scanning']){
  const path=root+'/'+kind+'/alerts?per_page=100'+(kind==='secret-scanning'?'&hide_secret=true':''),endpoint=new URL(base+path)
  try{
   const found=await readPageStream('github-findings:'+repository+':'+kind,path,async cursor=>{
    const url=new URL(cursor.startsWith('http')?cursor:base+cursor)
    if(url.origin!==endpoint.origin||url.pathname!==endpoint.pathname||url.username||url.password||url.hash||[...endpoint.searchParams].some(([k,v])=>url.searchParams.get(k)!==v)||[...url.searchParams.keys()].some(k=>!endpoint.searchParams.has(k)&&!['page','after','before'].includes(k)))throw new FindingGap('unsafe finding continuation')
    const response=await client.get(url.href)
    if(response.status!==200)throw new FindingGap('GitHub answered '+response.status)
    if(!Array.isArray(response.body))throw new FindingGap('schema drift: finding list')
    const items=response.body.map((v:unknown):CodeFinding=>{
     if(!record(v)||!natural(v.number)||v.number<1||!date(v.created_at)||!date(v.updated_at))throw new FindingGap('schema drift: finding identity or source time')
     const state=String(v.state),resolved=kind==='dependabot'?v.fixed_at:v.resolved_at
     if(!(resolved===null||resolved===undefined||date(resolved)))throw new FindingGap('schema drift: finding resolution time')
     let severity:string|null=null,cve:string|null=null,ghsa:string|null=null,pkg:string|null=null,ecosystem:string|null=null
     if(kind==='dependabot'){
      if(!['open','fixed','dismissed','auto_dismissed'].includes(state)||!record(v.security_advisory)||!record(v.dependency)||!record(v.dependency.package))throw new FindingGap('schema drift: dependency finding')
      const advisory=v.security_advisory,dependency=v.dependency.package
      if(!['critical','high','medium','low'].includes(String(advisory.severity))||!safe(dependency.name)||!safe(dependency.ecosystem)||!(advisory.cve_id===null||typeof advisory.cve_id==='string'&&/^CVE-[0-9]{4}-[0-9]{4,}$/.test(advisory.cve_id))||typeof advisory.ghsa_id!=='string'||!/^GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}$/i.test(advisory.ghsa_id))throw new FindingGap('schema drift: dependency advisory metadata')
      severity=String(advisory.severity);cve=advisory.cve_id as string|null;ghsa=advisory.ghsa_id;pkg=dependency.name;ecosystem=dependency.ecosystem
     }else if(!['open','resolved'].includes(state)||!safe(v.secret_type))throw new FindingGap('schema drift: secret finding metadata')
     const web=new URL(base).hostname==='api.github.com'?'https://github.com':new URL(base).origin
     return {provider:'github',repository,kind,number:v.number,state,severity,cve,ghsa,package:pkg,ecosystem,created_at:v.created_at,updated_at:v.updated_at,resolved_at:typeof resolved==='string'?resolved:null,source_url:web+'/'+repository.split('/').map(encodeURIComponent).join('/')+'/security/'+(kind==='dependabot'?'dependabot':'secret-scanning')+'/'+v.number,readable:true}
    })
    if(items.length>500)throw new FindingGap('finding page exceeds 500 rows')
    return {items,next:response.next}
   },10,message=>new FindingGap(message),r=>String(r.number))
   if(found.length>500)throw new FindingGap('finding class exceeds 500 rows; reduce source scope')
   rows.push(...found);complete.push(kind)
  }catch(e){if(!(e instanceof FindingGap))throw e;gaps.push(kind+' findings: '+e.message)}
 }
 return {rows,gaps,complete}
}
