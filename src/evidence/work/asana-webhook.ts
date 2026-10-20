import type { Bindings } from '../../auth.server'
import { auditStatement, type Actor } from '../door'
import { seal } from '../connect/custody'
import { Refusal } from '../upload'
import { TrackerFailure, call } from './client'
import { requireDestination, secretOf } from './storage'
const digest = async (value: string) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))), b=>b.toString(16).padStart(2,'0')).join('')
// Asana returns its signing secret in an unsigned handshake. Only the opaque,
// one-use target created by an authenticated owner registration may accept it.
// https://developers.asana.com/docs/webhooks-guide
export async function registerAsanaWebhook(env: Bindings, actor: Actor, id: string, now: Date) {
 const d=await requireDestination(env,id)
 if(d.provider!=='asana'||d.status!=='active') throw new Refusal('An active Asana destination is required.',409)
 if(d.hook_ciphertext) throw new Refusal('This Asana webhook is already registered.',409)
 const token=crypto.randomUUID()+crypto.randomUUID(), audience='asana-register:'+await digest(token)
 const claim=await env.DB.prepare("UPDATE tracker_destinations SET hook_audience=? WHERE id=? AND hook_audience='' AND hook_ciphertext IS NULL").bind(audience,id).run()
 if(!claim.meta.changes) throw new Refusal('An Asana registration is already in progress.',409)
 try {
  const response=await call(d.api_base+'/webhooks',{method:'POST',headers:{authorization:'Bearer '+await secretOf(env,d),'content-type':'application/json'},body:JSON.stringify({data:{resource:d.project,target:`${env.AUTH_ORIGIN}/hooks/trackers/${id}?handshake=${token}`}}),label:'Asana'})
  const registered=await requireDestination(env,id)
  if(!registered.hook_ciphertext) throw new Refusal('Asana did not complete the webhook handshake; polling remains active.',502)
  const data=response.body.data as {gid?:string}|undefined
  if(!data?.gid) throw new Refusal('Asana returned no webhook identity; polling remains active.',502)
  await env.DB.batch([env.DB.prepare("UPDATE tracker_destinations SET hook_audience='' WHERE id=?").bind(id),auditStatement(env,actor,'tracker.webhook-registered','tracker:'+id,now,'succeeded','Asana project webhook')])
  return {registered:true,id:data.gid}
 } catch(error) {
  await env.DB.batch([env.DB.prepare("UPDATE tracker_destinations SET hook_ciphertext=NULL,hook_iv=NULL,hook_audience='' WHERE id=?").bind(id),auditStatement(env,actor,'tracker.webhook-registered','tracker:'+id,now,'failed','Asana registration did not complete; polling remains active')])
  if(error instanceof TrackerFailure) throw new Refusal(error.message,502)
  throw error
 } finally {
  await env.DB.prepare("UPDATE tracker_destinations SET hook_audience='' WHERE id=? AND hook_audience=?").bind(id,audience).run()
 }
}
export async function asanaHandshake(env:Bindings,d:{id:string;hook_audience:string;hook_ciphertext:string|null},request:Request) {
 const nonce=new URL(request.url).searchParams.get('handshake'),secret=request.headers.get('x-hook-secret')
 if(!secret||secret.length>200||!nonce||d.hook_ciphertext||d.hook_audience!=='asana-register:'+await digest(nonce))return null
 const sealed=await seal(env,secret,d.id+':hook')
 const accepted=await env.DB.prepare("UPDATE tracker_destinations SET hook_ciphertext=?,hook_iv=?,hook_audience='' WHERE id=? AND hook_audience=? AND hook_ciphertext IS NULL").bind(sealed.ciphertext,sealed.iv,d.id,d.hook_audience).run()
 return accepted.meta.changes?new Response(null,{status:200,headers:{'x-hook-secret':secret,'cache-control':'no-store'}}):null
}
