import type {Bindings} from '../../auth.server'
import type {Connection} from './storage'
import {schema} from '../identity/collect'
import {upsertResources,upsertRegister} from '../resources'
import {sourceReadTime} from './pages'
export interface CodeMember {id:string;name:string;status:string;admin:boolean|null;roles:string;mfa:boolean|null;service:boolean}
// Source identities remain connection-qualified; only an explicit existing
// identity-match decision links them to People. No source login grants access.
export async function persistCodeMembers(env:Bindings,c:Connection,members:CodeMember[]|null,gaps:string[],now:Date){
 const source={kind:'source-observed' as const,ref:'directory:'+c.id,label:c.provider+' '+c.account+' members via '+c.label}
 if(!members){
  const known=(await env.DB.prepare("SELECT unique_id,display_name FROM resources WHERE type='identity.account' AND source_ref=? AND removed_at IS NULL").bind(source.ref).all<{unique_id:string;display_name:string}>()).results
  for(let i=0;i<known.length;i+=200)await upsertResources(env,'identity.account',schema,known.slice(i,i+200).map(m=>({uniqueId:m.unique_id,displayName:m.display_name,attributes:{readable:false}})),source,false,now)
  return {members:null,departed_members:null,unmatched_members:null,gaps}
 }
 const items=members.map(m=>({uniqueId:c.provider+':'+c.id+':'+m.id,displayName:m.name,attributes:{email:'',status:m.status,population:m.service?'service':'person',active:m.status==='active',admin:m.admin,roles:m.roles,groups:null,mfa_enrolled:m.mfa,last_sign_in:null,mfa_ok:m.status==='active'?m.mfa:true,admin_mfa_ok:m.status!=='active'||m.admin===false?true:m.admin===null?null:m.mfa,guest_admin:false,inactive_days:null,readable:true}}))
 const written=await upsertRegister(env,'identity.account',schema,items,source,now),fresh=written.results.filter(r=>r.id&&r.outcome!=='removed').map(r=>r.id!)
 if(fresh.length)await env.DB.prepare('UPDATE resources SET observed_at=? WHERE id IN (SELECT value FROM json_each(?))').bind(sourceReadTime(now),JSON.stringify(fresh)).run()
 const rows=(await env.DB.prepare("SELECT r.id,r.unique_id,r.display_name,m.state AS match_state,m.person_id,d.departed_at FROM resources r LEFT JOIN identity_matches m ON m.resource_id=r.id LEFT JOIN people_departures d ON d.person_id=m.person_id WHERE r.type='identity.account' AND r.source_ref=? AND r.removed_at IS NULL ORDER BY r.unique_id").bind(source.ref).all<{id:string;unique_id:string;display_name:string;match_state:string|null;person_id:string|null;departed_at:string|null}>()).results
 const unmatched=rows.filter(r=>r.match_state!=='approved').length
 if(unmatched)gaps.push(unmatched+' source memberships have no owner-approved People match; departure coverage is unknown.')
 return {members:rows,departed_members:unmatched?null:rows.filter(r=>r.departed_at).length,unmatched_members:unmatched,gaps}
}
