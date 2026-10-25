import type { Bindings } from '../../auth.server'
import { auditStatement, list, text, type Actor, type Input } from '../door'
import { requireCapability } from '../archive/capabilities'
import { Refusal } from '../upload'
import { tokenDigest } from '../review/storage'
import { emailOf, flag, issueCredential, requireUpdate, subscriberFor, type CustomerGrant } from './model'
import { addSubscriptions } from './subscribers'
export interface GrantRecord { grant_id:string;update_id:string;can_read:number;can_submit:number }
export interface Submission { id:string;grant_id:string;update_id:string;body:string;submitted_at:string }
export async function grantCustomer(env:Bindings,actor:Actor,input:Input,now:Date) {
 await requireCapability(env,'shares')
 const reason=text(input,'reason',1000),email=emailOf(input),raw=text(input,'expires_at',30),date=new Date(raw.length===10?raw+'T23:59:59.999Z':raw)
 if(!Number.isFinite(date.getTime())||date.getTime()<=now.getTime())throw new Refusal('Give a future customer-grant expiry date.')
 const reads=list(input,'read_records',100),submits=list(input,'submit_records',100)
 if(!reads.length||submits.some(id=>!reads.includes(id)))throw new Refusal('Choose named records to read. Submit permission also requires read permission.')
 for(const id of reads)if(!(await requireUpdate(env,id)).approved_at)throw new Refusal('Only owner-approved records may be granted.',409)
 const expires=date.toISOString(),subscriber=await subscriberFor(env,email,now),id=crypto.randomUUID(),at=now.toISOString()
 await env.DB.batch([
  env.DB.prepare('INSERT INTO trust_customer_grants(id,subscriber_id,reason,approved_by,approved_name,approved_at,expires_at) VALUES(?,?,?,?,?,?,?)').bind(id,subscriber.id,reason,actor.id,actor.name,at,expires),
  ...reads.map(record=>env.DB.prepare('INSERT INTO trust_grant_records(grant_id,update_id,can_read,can_submit) VALUES(?,?,1,?)').bind(id,record,submits.includes(record)?1:0)),
  auditStatement(env,actor,'trust.customer-approved',id,now,'succeeded','Named records and explicit permissions',{reason}),
 ])
 if(flag(input.subscribe_subprocessors)&&!subscriber.unsubscribed_at)await addSubscriptions(env,actor,{email,categories:['subprocessors'],reason},now,'customer-grant')
 const issued=await issueCredential(env,'customer',id,now,expires)
 return {id,subscriber_id:subscriber.id,expires_at:expires,url:env.AUTH_ORIGIN+'/trust/customer/'+issued.token}
}
export async function revokeCustomer(env:Bindings,actor:Actor,id:string,now:Date) {
 const row=await env.DB.prepare('SELECT * FROM trust_customer_grants WHERE id=?').bind(id).first<CustomerGrant>()
 if(!row)throw new Refusal('Customer grant not found.',404)
 await env.DB.batch([env.DB.prepare('UPDATE trust_customer_grants SET revoked_at=?,revoked_by=? WHERE id=? AND revoked_at IS NULL').bind(now.toISOString(),actor.id,id),auditStatement(env,actor,'trust.customer-revoked',id,now)])
 return {revoked:true}
}
export const grantActor=(grant:CustomerGrant)=>({id:grant.id,name:'Approved customer',kind:'token' as const})
export async function customerAccess(env:Bindings,token:string,now:Date) {
 await requireCapability(env,'shares')
 if(!/^[a-f0-9]{64}$/.test(token))return null
 // Lookup also identifies expired uses for the audit; only the digest is queried.
 const grant=await env.DB.prepare("SELECT g.* FROM trust_customer_grants g JOIN trust_credentials c ON c.subject_id=g.id WHERE c.kind='customer' AND c.token_hash=?").bind(await tokenDigest(token)).first<CustomerGrant>()
 if(!grant)return null
 if(grant.revoked_at||grant.expires_at<=now.toISOString()) {
  await auditStatement(env,grantActor(grant),'trust.customer-use',grant.id,now,'refused','Expired or revoked grant').run()
  return null
 }
 await auditStatement(env,grantActor(grant),'trust.customer-use',grant.id,now,'succeeded','Live named-record grant presented').run()
 return grant
}
export const grantRecords=async(env:Bindings,id:string)=>(await env.DB.prepare('SELECT * FROM trust_grant_records WHERE grant_id=? ORDER BY update_id').bind(id).all<GrantRecord>()).results
export async function submitToRecord(env:Bindings,grant:CustomerGrant,id:string,input:Input,now:Date) {
 const body=text(input,'body',10000),submission=crypto.randomUUID(),at=now.toISOString()
 // Authority is rechecked in the write, so revocation cannot race admission.
 const [inserted]=await env.DB.batch([
  env.DB.prepare(`INSERT INTO trust_submissions(id,grant_id,update_id,body,submitted_at)
   SELECT ?,g.id,r.update_id,?,? FROM trust_customer_grants g JOIN trust_grant_records r ON r.grant_id=g.id JOIN trust_updates u ON u.id=r.update_id
   WHERE g.id=? AND r.update_id=? AND r.can_read=1 AND r.can_submit=1 AND g.revoked_at IS NULL AND g.expires_at>? AND u.approved_at IS NOT NULL AND u.published_at IS NOT NULL`).bind(submission,body,at,grant.id,id,at),
  env.DB.prepare("INSERT INTO product_audit(id,actor_kind,actor_id,actor_name,action,subject,outcome,detail,at,reason,revision) SELECT ?,'token',?,'Approved customer','trust.customer-submit',?,CASE WHEN EXISTS(SELECT 1 FROM trust_submissions WHERE id=?) THEN 'succeeded' ELSE 'refused' END,'Named-record customer submission',?,'',''").bind(crypto.randomUUID(),grant.id,id,submission,at),
 ])
 if(!inserted.meta.changes) {
  throw new Refusal('Named-record submit permission required.',403)
 }
 return {id:submission,grant_id:grant.id,update_id:id,body,submitted_at:at}
}
