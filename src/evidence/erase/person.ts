import type { Bindings } from '../../auth.server'
import { sha } from '../archive/format'

// Keep identity custody separate from this partial business-record erasure.
// Active identities and attribution needed by retained originals stay visible
// in the reviewed plan; this workflow never disables a sign-in implicitly.
export async function personPlan(env:Bindings,id:string,holds:any[],retained:any[]) {
 const person=await env.DB.prepare('SELECT id,name,email,kind,role FROM people WHERE id=?').bind(id).first<any>()
 if(!person)return null
 const operators=(await env.DB.prepare('SELECT id,status FROM oa_operators WHERE lower(email)=lower(?) ORDER BY id').bind(person.email).all<{id:string;status:string}>()).results
 const actor_ids=operators.map(o=>o.id)
 const actorJSON=JSON.stringify(actor_ids)
 const product=(await env.DB.prepare('SELECT id FROM product_audit WHERE actor_id IN (SELECT value FROM json_each(?)) ORDER BY id').bind(actorJSON).all<{id:string}>()).results.map(r=>r.id)
 const reason=holds.length||retained.length?'Held originals retain the related person profile and actor attribution.':operators.some(o=>o.status!=='inactive')?'An active or invited sign-in identity retains the person profile and actor attribution. Deactivate it explicitly before another preview.':person.email===id+'@erased.invalid'?'This person profile is already anonymized.':''
 return {person_id:id,revision:await sha(new TextEncoder().encode(JSON.stringify(person))),actor_ids,product_audit:product,action:reason?'retain':'anonymize',reason}
}
export function personStatements(env:Bindings,plan:any) {
 if(!plan||plan.action!=='anonymize')return []
 return [
  env.DB.prepare("UPDATE people SET name='Erased person',email=id||'@erased.invalid',role=NULL WHERE id=?").bind(plan.person_id),
  env.DB.prepare("UPDATE product_audit SET actor_name='Anonymous actor' WHERE id IN (SELECT value FROM json_each(?))").bind(JSON.stringify(plan.product_audit)),
 ]
}
export const personCounts=(plan:any)=>({people:plan?.action==='anonymize'?1:0,product_audit:plan?.action==='anonymize'?plan.product_audit.length:0})
