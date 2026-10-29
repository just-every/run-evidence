import type { Bindings } from '../../auth.server'
import { Refusal } from '../upload'
import { fail } from './format'
import { doorRestoreBarriers } from './door'
export const capabilities=['schedules','mail','collections','writes','shares'] as const
export type Capability=typeof capabilities[number]
export async function capabilityAllowed(env:Pick<Bindings,'DB'>,capability:Capability,subject='*') {
 const row=await env.DB.prepare('SELECT authorized_at FROM portable_capabilities WHERE capability=? AND subject IN (?,\'*\') ORDER BY CASE WHEN subject=? THEN 0 ELSE 1 END LIMIT 1').bind(capability,subject,subject).first<{authorized_at:string|null}>()
 return !row||row.authorized_at!==null
}
export async function requireCapability(env:Pick<Bindings,'DB'>,capability:Capability,subject='*') {if(!await capabilityAllowed(env,capability,subject))throw new Refusal('This restored capability is inactive. Reauthorize it in Evidence archive.',409)}
export const barrierStatements=(env:Pick<Bindings,'DB'>)=>[...capabilities.map(c=>env.DB.prepare('INSERT INTO portable_capabilities(capability,subject,authorized_by,authorized_at) VALUES(?,\'*\',NULL,NULL) ON CONFLICT(capability,subject) DO UPDATE SET authorized_by=NULL,authorized_at=NULL').bind(c)),...doorRestoreBarriers(env)]
export async function reauthorize(env:Pick<Bindings,'DB'>,actor:string,input:any,now:Date) {
 if(!input||!capabilities.includes(input.capability)||typeof input.subject!=='string'||! /^(\*|[a-zA-Z0-9_-]{1,128})$/.test(input.subject))fail('Choose a known capability and subject.')
 if(input.subject!=='*' && !['collections','writes'].includes(input.capability))fail('This capability applies to the whole installation.')
 if(input.subject!=='*'&&!await env.DB.prepare(`SELECT id FROM ${input.capability==='collections'?'connections':'tracker_destinations'} WHERE id=?`).bind(input.subject).first())fail('Unknown capability subject.')
 await env.DB.batch([
  env.DB.prepare('INSERT INTO portable_capabilities(capability,subject,authorized_by,authorized_at) VALUES(?,?,?,?) ON CONFLICT(capability,subject) DO UPDATE SET authorized_by=excluded.authorized_by,authorized_at=excluded.authorized_at').bind(input.capability,input.subject,actor,now.toISOString()),
  env.DB.prepare('INSERT INTO product_audit(id,actor_kind,actor_id,actor_name,action,subject,outcome,detail,at) VALUES(?,\'owner\',?,?,\'archive.reauthorized\',?,\'succeeded\',?,?)').bind(crypto.randomUUID(),actor,actor,input.subject,input.capability,now.toISOString()),
 ])
 return {reauthorized:input.capability,subject:input.subject}
}
