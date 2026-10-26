import { linkDependency,assertDependencies,replacement } from '../agent/promises'
import { done,json,ownerRoutes,readInput,uuid,type Route } from '../door'
import { reviewFrame,escape } from '../review/frame'
import { settings,saveSettings,addCategory,requireUpdate } from './model'
import { trustOverview } from './data'
import { addSubscriptions,subscriberExport } from './subscribers'
import { grantCustomer,revokeCustomer } from './grants'
import { draftUpdate,draftSubprocessor,approveUpdate,publishUpdate,subprocessorList,updateExport } from './updates'
import { configureWebhook } from './events'
import { flushTrustDeliveries } from './delivery'
import { ownerTrustPage,ownerUpdatePage } from './owner-view'
const both=(p:string)=>new RegExp(`^/(?:app|api)/trust${p}$`),id=`(${uuid})`
export function trustHandler(clock:()=>Date=()=>new Date()) {
 const routes:Route[]=[
  {method:'GET',pattern:both(''),run:async c=>{const data=await trustOverview(c.env,c.now);return c.isApi?json(data):ownerTrustPage(data,c.actor.name,new URL(c.env.AUTH_ORIGIN).protocol==='https:')}},
  {method:'POST',pattern:both('/settings'),run:async c=>done(c,'/app/trust',await saveSettings(c.env,c.actor,await readInput(c.request),c.now))},
  {method:'POST',pattern:both('/categories'),run:async c=>done(c,'/app/trust',await addCategory(c.env,c.actor,await readInput(c.request),c.now),201)},
  {method:'POST',pattern:both('/subscribers'),run:async c=>done(c,'/app/trust',await addSubscriptions(c.env,c.actor,await readInput(c.request),c.now),201)},
  {method:'GET',pattern:both('/subscribers/export'),run:async c=>json(await subscriberExport(c.env))},
  {method:'POST',pattern:both('/customers'),run:async c=>{const result=await grantCustomer(c.env,c.actor,await readInput(c.request),c.now);return c.isApi?json(result,201):reviewFrame('Customer access issued',`<h1>Customer access issued</h1><p>${escape(result.email)} · expires ${escape(result.expires_at)}</p><p>${escape(result.reason)}</p><ul>${result.records.map(r=>`<li>${escape(r.title)} · read${r.submit?' and submit':''}</li>`).join('')}</ul><p>Copy this link for the approved recipient. It is shown once.</p><p><a href="${escape(result.url)}">${escape(result.url)}</a></p><p><a href="/app/trust">Trust updates</a></p>`,true,c.actor.name)}},
  {method:'POST',pattern:both(`/customers/${id}/revoke`),run:async(c,m)=>done(c,'/app/trust',await revokeCustomer(c.env,c.actor,m[1],c.now))},
  {method:'POST',pattern:both('/updates'),run:async c=>{const update=await draftUpdate(c.env,c.actor,await readInput(c.request),c.now);return done(c,'/app/trust/updates/'+update.id,update,201)}},
  {method:'GET',pattern:both(`/updates/${id}`),run:async(c,m)=>{const data=await updateExport(c.env,m[1],c.now);return c.isApi?json(data):ownerUpdatePage(data,c.actor.name,new URL(c.env.AUTH_ORIGIN).protocol==='https:')}},
  {method:'GET',pattern:both(`/updates/${id}/export`),run:async(c,m)=>{await assertDependencies(c.env,'trust',m[1],c.now);return json(await updateExport(c.env,m[1],c.now))}},
  {method:'POST',pattern:both(`/updates/${id}/refresh-source`),run:async(c,m)=>{const prior=await requireUpdate(c.env,m[1]),input=await readInput(c.request),source=await replacement(c.env,'trust',prior.id,input,c.actor,c.now),update=await draftUpdate(c.env,c.actor,{category:prior.category,title:prior.title,body:input.body,visibility:prior.visibility},c.now,{id:prior.id,replacement:source});return done(c,'/app/trust/updates/'+update.id,update,201)}},
  {method:'POST',pattern:both(`/updates/${id}/dependencies`),run:async(c,m)=>done(c,'/app/trust/updates/'+m[1],await linkDependency(c.env,'trust',m[1],await readInput(c.request),c.actor,c.now),201)},
  {method:'POST',pattern:both(`/updates/${id}/approve`),run:async(c,m)=>done(c,'/app/trust/updates/'+m[1],await approveUpdate(c.env,c.actor,m[1],await readInput(c.request),c.now))},
  {method:'POST',pattern:both(`/updates/${id}/publish`),run:async(c,m)=>done(c,'/app/trust/updates/'+m[1],await publishUpdate(c.env,c.actor,m[1],await readInput(c.request),c.now))},
  {method:'GET',pattern:both('/subprocessors'),run:async c=>json(await subprocessorList(c.env,c.now))},
  {method:'POST',pattern:both('/subprocessors'),run:async c=>{const result=await draftSubprocessor(c.env,c.actor,await readInput(c.request),c.now);return done(c,'/app/trust/updates/'+result.update.id,result,201)}},
  {method:'POST',pattern:both('/mail-webhooks'),run:async c=>done(c,'/app/trust',await configureWebhook(c.env,c.actor,await readInput(c.request),c.now))},
  {method:'POST',pattern:both('/deliveries/dispatch'),run:async c=>done(c,'/app/trust',{processed:await flushTrustDeliveries(c.env,c.now)})},
 ]
 return ownerRoutes(routes,clock)
}
