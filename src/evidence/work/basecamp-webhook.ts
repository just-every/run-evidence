import type { Bindings } from '../../auth.server'
import { auditStatement, type Actor } from '../door'
import { seal } from '../connect/custody'
import { Refusal } from '../upload'
import { call } from './client'
import { hookId, hookPayload, sameHookValue, type VerifiedHook } from './hook-security'
import { requireDestination, secretOf, hookSecretOf, type DestinationRow } from './storage'
// Basecamp webhooks are unsigned. The ct-approved boundary is an Evidence-
// registered, per-destination 256-bit secret address, never a provider signature.
// https://github.com/basecamp/bc3-api/blob/master/sections/webhooks.md
const hour=60*60*1000
const headers=(token:string)=>({authorization:'Bearer '+token,'content-type':'application/json','user-agent':'Evidence remediation (https://github.com/just-every/run-evidence)'})
const registration=(d:DestinationRow)=>/^basecamp:([1-9]\d*):(.*)$/.exec(d.hook_audience)
const target=(env:Bindings,d:DestinationRow,secret:string)=>`${env.AUTH_ORIGIN}/hooks/trackers/${d.id}?secret=${secret}`
const matches=(row:Record<string,unknown>,url:string)=>row.active===true&&row.payload_url===url&&Array.isArray(row.types)&&['Todo','Comment'].every(t=>(row.types as unknown[]).includes(t)|| (row.types as unknown[]).includes('all'))
export async function registerBasecampWebhook(env:Bindings,actor:Actor,id:string,now:Date) {
 const d=await requireDestination(env,id)
 if(d.provider!=='basecamp'||d.status!=='active')throw new Refusal('An active Basecamp destination is required.',409)
 if(new URL(env.AUTH_ORIGIN).protocol!=='https:')throw new Refusal('Basecamp registration needs a publicly reachable HTTPS installation address.',409)
 if(d.hook_ciphertext)throw new Refusal('This Basecamp callback is already registered.',409)
 if(d.hook_audience.startsWith('basecamp-register:')&&now.getTime()-Date.parse(d.hook_audience.slice(18))<hour)throw new Refusal('Basecamp registration is already in progress; check again after one hour.',409)
 const claim='basecamp-register:'+now.toISOString()
 const claimed=await env.DB.prepare("UPDATE tracker_destinations SET hook_audience=? WHERE id=? AND status='active' AND hook_ciphertext IS NULL AND hook_audience=?").bind(claim,id,d.hook_audience).run()
 if(!claimed.meta.changes)throw new Refusal('Basecamp registration changed; reload before retrying.',409)
 const secret=Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join(''),url=target(env,d,secret)
 try {
  const [account,project]=d.project.split('/')
  const response=await call(`${d.api_base}/${account}/buckets/${project}/webhooks.json`,{method:'POST',headers:headers(await secretOf(env,d)),body:JSON.stringify({payload_url:url,types:['Todo','Comment']}),label:'Basecamp'})
  const hook=hookId(response.body?.id)
  if(response.status!==201||!hook||!matches(response.body,url))throw new Error('Registration not confirmed')
  const sealed=await seal(env,secret,id+':hook')
  const saved=await env.DB.prepare("UPDATE tracker_destinations SET hook_ciphertext=?,hook_iv=?,hook_audience=?,last_error='' WHERE id=? AND status='active' AND hook_audience=? AND hook_ciphertext IS NULL").bind(sealed.ciphertext,sealed.iv,`basecamp:${hook}:${now.toISOString()}`,id,claim).run()
  if(!saved.meta.changes)throw new Error('Destination changed during registration')
  await auditStatement(env,actor,'tracker.webhook-registered','tracker:'+id,now,'succeeded','Basecamp secret-address callback; unsigned provider events').run()
  return {registered:true,id:hook}
 } catch {
  await env.DB.batch([env.DB.prepare("UPDATE tracker_destinations SET hook_audience='',last_error='Basecamp registration not confirmed; polling remains active. Check provider registrations before retrying.' WHERE id=? AND hook_audience=?").bind(id,claim),auditStatement(env,actor,'tracker.webhook-registered','tracker:'+id,now,'failed','Basecamp registration not confirmed; polling remains active')])
  // Provider errors may echo payload_url. Never disclose or audit their body.
  throw new Refusal('Basecamp registration not confirmed; polling remains active. Check provider registrations before retrying.',502)
 }
}
export function verifyBasecampHook(d:DestinationRow,secret:string,request:Request,bytes:Uint8Array<ArrayBuffer>,now:Date):VerifiedHook|null {
 const registered=registration(d),provided=new URL(request.url).searchParams.getAll('secret')
 if(!registered||provided.length!==1||!sameHookValue(provided[0],secret)||!Number.isFinite(Date.parse(registered[2]))||now.getTime()-Date.parse(registered[2])>hour+5*60000)return null
 const p=hookPayload(bytes),record=p?.recording,delivery=hookId(p?.id),[account,project]=d.project.split('/')
 if(!delivery||!record||hookId(record.bucket?.id)!==project)return null
 const resource=record.type==='Todo'?record:record.type==='Comment'&&record.parent?.type==='Todo'?record.parent:null
 const ref=hookId(resource?.id)
 if(!ref)return null
 // The account is carried in canonical URLs, not as a separate payload field.
 // Check both the recording and its task parent; never fetch a payload URL.
 const valid=(value:unknown,path:string)=>typeof value==='string'&&value===d.api_base+path
 if(!valid(resource.url,`/${account}/buckets/${project}/todos/${ref}.json`))return null
 if(record.type==='Comment'&&!valid(record.url,`/${account}/buckets/${project}/comments/${hookId(record.id)}.json`))return null
 return {delivery,ref}
}
export async function checkBasecampWebhooks(env:Bindings,now:Date) {
 const rows=(await env.DB.prepare("SELECT * FROM tracker_destinations WHERE provider='basecamp' AND status='active' AND hook_ciphertext IS NOT NULL").all<DestinationRow>()).results
 let checked=0
 for(const d of rows) {
  const registered=registration(d)
  if(!registered||now.getTime()-Date.parse(registered[2])<hour)continue
  checked++
  try {
   const token=await secretOf(env,d),account=d.project.split('/')[0]
   const response=await call(`${d.api_base}/${account}/webhooks/${registered[1]}.json`,{headers:headers(token),label:'Basecamp'})
   const secret=await hookSecretOf(env,d)
   if(!secret||hookId(response.body?.id)!==registered[1]||!matches(response.body,target(env,d,secret)))throw new Error('Deactivated or changed')
   await env.DB.prepare("UPDATE tracker_destinations SET hook_audience=? WHERE id=? AND status='active' AND hook_audience=?").bind(`basecamp:${registered[1]}:${now.toISOString()}`,d.id,d.hook_audience).run()
  } catch {
   await env.DB.batch([env.DB.prepare("UPDATE tracker_destinations SET hook_ciphertext=NULL,hook_iv=NULL,hook_audience='basecamp-disabled',last_error='Basecamp callback deactivated, changed or unavailable; register again. Polling remains active.' WHERE id=? AND hook_audience=?").bind(d.id,d.hook_audience),auditStatement(env,{id:'scheduler',name:'Scheduler',kind:'system'},'tracker.webhook-check','tracker:'+d.id,now,'failed','Basecamp callback deactivated, changed or unavailable; polling remains active')])
  }
 }
 return checked
}
