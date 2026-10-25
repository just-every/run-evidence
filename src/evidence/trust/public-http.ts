import { runtimeBindings,type Bindings } from '../../auth.server'
import { readInput } from '../door'
import { safeHeaders } from '../review/frame'
import { capabilityAllowed } from '../archive/capabilities'
import { Refusal } from '../upload'
import { categories,credential,settings } from './model'
import { confirm,subscribe,unsubscribe,customerAccess } from './subscribers'
import { publicFeed } from './data'
import { subprocessorList } from './updates'
import { deliveryWebhook } from './events'
import { confirmationPage,trustMessage,trustPublicPage } from './public-view'
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:safeHeaders})
export function trustPublicHandler(clock:()=>Date=()=>new Date()) {
 return async(request:Request,original:Bindings):Promise<Response|null>=>{
  const url=new URL(request.url),path=url.pathname
  if(path!=='/trust'&&!path.startsWith('/trust/'))return null
  const env=runtimeBindings(original),now=clock(),wantsJson=path.endsWith('/feed')||(request.headers.get('accept')??'').includes('application'+'/'+'json')||(request.headers.get('content-type')??'').startsWith('application'+'/'+'json')
  try {
   if(url.origin!==env.AUTH_ORIGIN||(request.headers.has('host')&&request.headers.get('host')?.toLowerCase()!==url.host.toLowerCase()))throw new Refusal('Invalid host.',403)
   const webhook=/^\/trust\/mail\/events\/(resend|sendgrid)$/.exec(path)
   if(webhook){if(request.method!=='POST')throw new Refusal('Method not allowed.',405);return json(await deliveryWebhook(env,request,webhook[1] as 'resend'|'sendgrid',now),202)}
   const tokenRoute=/^\/trust\/(confirm|unsubscribe)\/([a-f0-9]{64})$/.exec(path)
   if(tokenRoute) {
    const [,action,token]=tokenRoute
    if(!['GET','HEAD','POST'].includes(request.method))throw new Refusal('Method not allowed.',405)
    if(action==='unsubscribe') {
     // RFC 8058 POSTs come from mailbox providers, with no owner session or Origin.
     if(request.method==='HEAD')return new Response(null,{status:200,headers:safeHeaders})
     const result=await unsubscribe(env,token,now)
     return wantsJson?json(result):trustMessage('Unsubscribed','You will no longer receive any trust updates. Your withdrawal takes effect immediately.')
    }
    if(!await credential(env,'confirmation',token,now))throw new Refusal('Confirmation link is invalid or expired.',404)
    if(request.method!=='POST')return confirmationPage(token)
    if(request.headers.get('sec-fetch-site')==='cross-site'||request.headers.has('origin')&&!['null',env.AUTH_ORIGIN].includes(request.headers.get('origin')!))throw new Refusal('Same-origin confirmation required.',403)
    const result=await confirm(env,token,now)
    return wantsJson?json(result):trustMessage('Subscription confirmed','You will receive updates in the categories you selected.')
   }
   const rules=await settings(env)
   if(!rules.public_enabled||!await capabilityAllowed(env,'shares'))throw new Refusal('Trust center is unavailable.',404)
   if(path==='/trust/subscribe') {
    if(request.method!=='POST')throw new Refusal('Method not allowed.',405)
    // Bearer-free sign-up is same-origin. Public pages use no-referrer, which
    // permits Origin:null on the in-product form without accepting foreign sites.
    if(![env.AUTH_ORIGIN,'null'].includes(request.headers.get('origin')??'')||request.headers.get('sec-fetch-site')==='cross-site')throw new Refusal('Same-origin request required.',403)
    const result=await subscribe(env,await readInput(request),now)
    return wantsJson?json(result,202):trustMessage('Check your email','If confirmation is needed, a link has been sent to that address. Confirm it to start receiving updates.')
   }
   if(!['GET','HEAD'].includes(request.method))throw new Refusal('Method not allowed.',405)
   const customer=/^\/trust\/customer\/([a-f0-9]{64})(?:\/feed)?$/.exec(path)
   if(path!=='/trust'&&path!=='/trust/feed'&&path!=='/trust/subprocessors'&&!customer)throw new Refusal('Not found.',404)
   const grant=customer?await customerAccess(env,customer[1],now):null
   if(customer&&!grant)throw new Refusal('Not found.',404)
   const category=url.searchParams.get('category'),categoryRows=await categories(env)
   if(category&&!categoryRows.some(c=>c.slug===category))throw new Refusal('Choose a listed category.')
   const [updates,subprocessors]=await Promise.all([publicFeed(env,!!grant,category),subprocessorList(env,now)])
   if(path==='/trust/subprocessors')return json(subprocessors)
   return wantsJson?json({updates,subprocessors,categories:categoryRows}):trustPublicPage(updates,subprocessors,categoryRows,!!grant,!!rules.confirmations_enabled)
  }catch(error) {
   if(error instanceof Refusal)return wantsJson?json({error:error.message},error.status):new Response(error.message+'\n',{status:error.status,headers:{...safeHeaders,'content-type':'text'+'/'+'plain; charset=utf-8'}})
   return json({error:'Trust storage unavailable; no result is claimed.'},503)
  }
 }
}
