import type { Bindings } from '../../auth.server'
import { auditStatement, list, text, type Actor, type Input } from '../door'
import { Refusal } from '../upload'
import { tokenDigest } from '../review/storage'
export const builtinCategories = [
 { slug:'compliance',name:'Compliance' },{ slug:'incidents',name:'Incidents' },
 { slug:'security',name:'Security' },{ slug:'privacy',name:'Privacy' },{ slug:'subprocessors',name:'Subprocessors' },
]
export interface Settings { postal_address:string;notice_days:number;public_enabled:number;confirmations_enabled:number;updated_by?:string;updated_name?:string;updated_at?:string }
export interface Subscriber { id:string;email:string;created_at:string;unsubscribed_at:string|null }
export interface Subscription { subscriber_id:string;category:string;state:'pending'|'active'|'unsubscribed';source:string;reason:string;confirmation_id:string|null;confirmed_at:string|null;updated_at:string }
export interface Update { id:string;category:string;title:string;body:string;visibility:'public'|'customers';drafted_by:string;drafted_name:string;drafted_at:string;approved_by:string|null;approved_name:string|null;approved_at:string|null;notification_approved:number;published_at:string|null;notification_started_at:string|null }
export interface Change { id:string;update_id:string;subprocessor_id:string;action:'add'|'change'|'remove';name:string;purpose:string;data_categories:string;location:string;effective_on:string;notice_days:number;created_at:string }
export interface Delivery { id:string;update_id:string|null;subscriber_id:string;kind:'confirmation'|'update';recipient:string;state:'pending'|'delivered'|'bounced'|'failed'|'uncertain';detail:string;provider:string;provider_message_id:string|null;queued_at:string;attempted_at:string|null;accepted_at:string|null;outcome_at:string|null;provider_event_at:number|null }
export interface CustomerGrant { id:string;subscriber_id:string;reason:string;approved_by:string;approved_name:string;approved_at:string;expires_at:string;revoked_at:string|null;revoked_by:string|null }
export interface Credential { id:string;kind:string;subject_id:string;created_at:string;expires_at:string|null;used_at:string|null }
export const flag=(value:unknown)=>['1','true','on','yes'].includes(String(value))
export const settings=async(env:Bindings):Promise<Settings>=>await env.DB.prepare('SELECT * FROM trust_settings WHERE singleton=1').first<Settings>()??{postal_address:'',notice_days:30,public_enabled:0,confirmations_enabled:0}
export const categories=async(env:Bindings)=>[...builtinCategories,...(await env.DB.prepare('SELECT slug,name FROM trust_categories ORDER BY name').all<{slug:string;name:string}>()).results]
export async function selectedCategories(env:Bindings,input:Input) { const chosen=list(input,'categories',30),known=await categories(env);if(!chosen.length||chosen.some(x=>!known.some(k=>k.slug===x)))throw new Refusal('Choose at least one listed category.');return chosen }
export function emailOf(input:Input) { const email=text(input,'email',254).toLowerCase();if(!/^[^\s@<>\x00-\x1f]+@[^\s@<>\x00-\x1f]+\.[^\s@<>\x00-\x1f]+$/.test(email))throw new Refusal('Provide a valid email address.');return email }
export async function requireUpdate(env:Bindings,id:string) { const row=await env.DB.prepare('SELECT * FROM trust_updates WHERE id=?').bind(id).first<Update>();if(!row)throw new Refusal('Update not found.',404);return row }
export async function requireSubscriber(env:Bindings,id:string) { const row=await env.DB.prepare('SELECT * FROM trust_subscribers WHERE id=?').bind(id).first<Subscriber>();if(!row)throw new Refusal('Subscriber not found.',404);return row }
export async function subscriberFor(env:Bindings,email:string,now:Date) {
 await env.DB.prepare('INSERT INTO trust_subscribers(id,email,created_at) VALUES(?,?,?) ON CONFLICT(email) DO NOTHING').bind(crypto.randomUUID(),email,now.toISOString()).run()
 return (await env.DB.prepare('SELECT * FROM trust_subscribers WHERE email=?').bind(email).first<Subscriber>())!
}
export const consent=(env:Bindings,subscriber:string,category:string|null,action:string,source:string,reason:string,actor:Actor,now:Date)=>env.DB.prepare('INSERT INTO trust_consent_events(id,subscriber_id,category,action,source,reason,actor_id,actor_name,at) VALUES(?,?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),subscriber,category,action,source,reason,actor.id,actor.name,now.toISOString())
export const visitor:Actor={id:'visitor',name:'Email subscriber'}
export async function issueCredential(env:Bindings,kind:'confirmation'|'unsubscribe'|'customer',subject:string,now:Date,expires:string|null=null) {
 const token=Array.from(crypto.getRandomValues(new Uint8Array(32))).map(x=>x.toString(16).padStart(2,'0')).join(''),id=crypto.randomUUID()
 await env.DB.prepare('INSERT INTO trust_credentials(id,kind,subject_id,token_hash,created_at,expires_at) VALUES(?,?,?,?,?,?)').bind(id,kind,subject,await tokenDigest(token),now.toISOString(),expires).run()
 return {id,token}
}
export async function credential(env:Bindings,kind:string,token:string,now:Date) {
 if(!/^[a-f0-9]{64}$/.test(token))return null
 const row=await env.DB.prepare('SELECT id,kind,subject_id,created_at,expires_at,used_at FROM trust_credentials WHERE kind=? AND token_hash=?').bind(kind,await tokenDigest(token)).first<Credential>()
 return row&&(!row.expires_at||row.expires_at>now.toISOString())?row:null
}
export async function saveSettings(env:Bindings,actor:Actor,input:Input,now:Date) {
 const address=text(input,'postal_address',1000),days=Number(text(input,'notice_days',3))
 if(!Number.isInteger(days)||days<0||days>365)throw new Refusal('Notice period must be a whole number of days from 0 to 365.')
 await env.DB.batch([env.DB.prepare('INSERT INTO trust_settings(singleton,postal_address,notice_days,public_enabled,confirmations_enabled,updated_by,updated_name,updated_at) VALUES(1,?,?,?,?,?,?,?) ON CONFLICT(singleton) DO UPDATE SET postal_address=excluded.postal_address,notice_days=excluded.notice_days,public_enabled=excluded.public_enabled,confirmations_enabled=excluded.confirmations_enabled,updated_by=excluded.updated_by,updated_name=excluded.updated_name,updated_at=excluded.updated_at').bind(address,days,flag(input.public_enabled)?1:0,flag(input.confirmations_enabled)?1:0,actor.id,actor.name,now.toISOString()),auditStatement(env,actor,'trust.settings','trust',now)])
 return settings(env)
}
export async function addCategory(env:Bindings,actor:Actor,input:Input,now:Date) {
 const name=text(input,'name',80),slug=text(input,'slug',80)
 if(!/^[a-z][a-z0-9-]{0,79}$/.test(slug)||(await categories(env)).some(c=>c.slug===slug))throw new Refusal('Choose a new lowercase category slug using letters, digits and hyphens.')
 await env.DB.batch([env.DB.prepare('INSERT INTO trust_categories(slug,name,created_by,created_at) VALUES(?,?,?,?)').bind(slug,name,actor.id,now.toISOString()),auditStatement(env,actor,'trust.category-created',slug,now)])
 return {slug,name}
}
