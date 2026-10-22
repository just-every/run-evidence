import type { Bindings } from '../../auth.server'
import type { Connection } from './storage'
import type { Client } from './github'
import { record, natural } from './github-schema'
import { readPageStream, sourceReadTime } from './pages'
import { upsertRegister, upsertResources } from '../resources'
import { schema as identitySchema } from '../identity/collect'
class MemberGap extends Error {}
interface Member {id:number;login:string;type:string}
// https://docs.github.com/en/rest/orgs/members#list-organization-members
// A full authorized 2fa_disabled list establishes enrollment at this read;
// organization enforcement and a member's actual enrollment are separate facts.
export async function collectGithubMembers(env:Bindings,c:Connection,client:Client,now:Date){
 const root='/orgs/'+encodeURIComponent(c.account)+'/members',gaps:string[]=[]
 async function list(query:string){
  const path=root+'?per_page=100&'+query,endpoint=new URL(c.api_base+path)
  return readPageStream<Member>('github-members:'+path,path,async cursor=>{
   const url=new URL(cursor.startsWith('http')?cursor:c.api_base+cursor)
   if(url.origin!==endpoint.origin||url.pathname!==endpoint.pathname||url.username||url.password||url.hash)throw new MemberGap('unsafe membership continuation')
   const reply=await client.get(url.href)
   if(reply.status!==200)throw new MemberGap('GitHub answered '+reply.status)
   if(!Array.isArray(reply.body)||!reply.body.every(v=>record(v)&&natural(v.id)&&v.id>0&&typeof v.login==='string'&&/^[A-Za-z0-9-]{1,100}$/.test(v.login)&&['User','Bot'].includes(String(v.type))))throw new MemberGap('schema drift: organization members')
   return {items:reply.body.map(v=>({id:v.id as number,login:v.login as string,type:v.type as string})),next:reply.next}
  },10,m=>new MemberGap(m),m=>String(m.id))
 }
 const read=async(label:string,query:string)=>{try{return await list(query)}catch(e){if(!(e instanceof MemberGap))throw e;gaps.push(label+': '+e.message);return null}}
 const members=await read('membership','role=all'),source={kind:'source-observed' as const,ref:'directory:'+c.id,label:'GitHub '+c.account+' members via '+c.label}
 if(!members){
  const known=(await env.DB.prepare("SELECT unique_id,display_name FROM resources WHERE type='identity.account' AND source_ref=? AND removed_at IS NULL").bind(source.ref).all<{unique_id:string;display_name:string}>()).results
  for(let i=0;i<known.length;i+=200)await upsertResources(env,'identity.account',identitySchema,known.slice(i,i+200).map(m=>({uniqueId:m.unique_id,displayName:m.display_name,attributes:{readable:false}})),source,false,now)
  return {members:null,departed_members:null,unmatched_members:null,gaps}
 }
 const admins=await read('administrators','role=admin'),disabled=await read('two-factor enrollment','filter=2fa_disabled&role=all'),ids=new Set(members.map(m=>m.id))
 if(admins?.some(m=>!ids.has(m.id))||disabled?.some(m=>!ids.has(m.id)))gaps.push('Membership changed between source lists; administrator and MFA facts are unknown until a coherent fresh read.')
 const coherent=!gaps.some(g=>g.startsWith('Membership changed'))
 const items=members.map(m=>{
  const admin=coherent&&admins?admins.some(a=>a.id===m.id):null,mfa=coherent&&disabled&&m.type==='User'?!disabled.some(a=>a.id===m.id):null
  return {uniqueId:'github:'+c.id+':'+m.id,displayName:m.login,attributes:{email:'',status:'active',population:m.type==='Bot'?'service':'person',active:true,admin,roles:admin===null?null:admin?'organization admin':'organization member',groups:null,mfa_enrolled:mfa,last_sign_in:null,mfa_ok:mfa,admin_mfa_ok:admin===false?true:admin===null?null:mfa,guest_admin:false,inactive_days:null,readable:true}}
 })
 const written=await upsertRegister(env,'identity.account',identitySchema,items,source,now),fresh=written.results.filter(r=>r.id&&r.outcome!=='removed').map(r=>r.id!)
 if(fresh.length)await env.DB.prepare('UPDATE resources SET observed_at=? WHERE id IN (SELECT value FROM json_each(?))').bind(sourceReadTime(now),JSON.stringify(fresh)).run()
 const rows=(await env.DB.prepare("SELECT r.id,r.unique_id,r.display_name,m.state AS match_state,m.person_id,d.departed_at FROM resources r LEFT JOIN identity_matches m ON m.resource_id=r.id LEFT JOIN people_departures d ON d.person_id=m.person_id WHERE r.type='identity.account' AND r.source_ref=? AND r.removed_at IS NULL ORDER BY r.unique_id").bind(source.ref).all<{id:string;unique_id:string;display_name:string;match_state:string|null;person_id:string|null;departed_at:string|null}>()).results
 const unmatched=rows.filter(r=>r.match_state!=='approved').length
 if(unmatched)gaps.push(unmatched+' GitHub memberships have no owner-approved People match; departure coverage is unknown.')
 return {members:rows,departed_members:unmatched?null:rows.filter(r=>r.departed_at).length,unmatched_members:unmatched,gaps}
}
