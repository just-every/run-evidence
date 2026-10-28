import type { Bindings } from '../../auth.server'
import type { Delegate } from '../authz/roles'
import { Refusal } from '../upload'

// AUTH-001 area grants are issued only by the owner. A general administrator
// or compliance grant never implies privacy authority.
export const privacyScope = (ref:string) => /^privacy:(?:business|(?:person|vendor|engagement|exhibit):[a-f0-9-]{36})$/.test(ref)
export const privacyGrants = (who:Delegate) => who.grants.filter(g=>g.source==='owner' && g.scope_kind==='area' && ['administrator','compliance_manager'].includes(g.role) && privacyScope(g.scope_ref))
export async function withinPrivacy(env:Bindings,who:Delegate|undefined,kind:string,subject:string) {
 if(!who)return true
 const grants=privacyGrants(who)
 if(grants.some(g=>g.scope_ref==='privacy:business'||g.scope_ref==='privacy:'+kind+':'+subject))return true
 if(kind!=='exhibit')return false
 for(const grant of grants) {
  const [,scope,id]=grant.scope_ref.split(':')
  if(await env.DB.prepare(`SELECT 1 FROM privacy_exhibit_scopes WHERE exhibit_id=? AND kind=? AND subject_id=?
   UNION ALL SELECT 1 FROM privacy_exhibit_engagements WHERE exhibit_id=? AND engagement_id=? AND ?='engagement' LIMIT 1`).bind(subject,scope,id,subject,id,scope).first())return true
 }
 return false
}
export async function requirePrivacy(env:Bindings,who:Delegate|undefined,kind:string,subject:string) {
 if(!await withinPrivacy(env,who,kind,subject))throw new Refusal('This record is outside your owner-authorized privacy scope.',403)
}
export async function privacyRows<T extends {kind:string;subject_id:string}>(env:Bindings,who:Delegate|undefined,rows:T[]) {
 const allowed=await Promise.all(rows.map(row=>withinPrivacy(env,who,row.kind,row.subject_id)))
 return rows.filter((_,index)=>allowed[index])
}
