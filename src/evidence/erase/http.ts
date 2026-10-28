import { done,json,ownerRoutes,readInput,uuid,type Route,type OwnerContext } from '../door'
import { requirePrivacy,privacyRows } from './authority'
import { page,escape } from '../view'
import { privacy,preview,hold,release,requestOf,execute,classify,kinds,type Erasure } from './storage'
const both=(p:string)=>new RegExp(`^/(?:app|api)/privacy${p}$`),id=`(${uuid})`
async function scopedInput(c:OwnerContext) {
 const input=await readInput(c.request)
 await requirePrivacy(c.env,c.delegate,String(input.kind),input.kind==='business'?'business':String(input.subject_id))
 return input
}
async function scopedRequest(c:OwnerContext,id:string) {
 const row=await requestOf(c.env,id)
 await requirePrivacy(c.env,c.delegate,row.kind,row.subject_id)
 return row
}
const options=kinds.map(k=>`<option>${k}</option>`).join('')
const scope=`<label>Scope<select name="kind">${options}</select></label><label>Subject ID<input name="subject_id" maxlength="128"></label><label>Reason<input name="reason" required maxlength="500"></label>`
const details=(row:Erasure)=>{const plan=JSON.parse(row.snapshot_json);return `<h2>Erasure ${escape(row.state)}</h2><p>${escape(row.kind)} · ${escape(row.subject_id)}</p><p>${escape(row.reason)}</p><p>Fingerprint <code>${escape(row.snapshot_hash)}</code></p><pre>${escape(JSON.stringify(plan,null,2))}</pre>${!['complete','partial'].includes(row.state)&&plan.supported?`<form method="post" action="/app/privacy/requests/${row.id}/confirm"><input type="hidden" name="snapshot_hash" value="${row.snapshot_hash}"><label>Type ERASE<input name="confirm" required autocomplete="off"></label><button>${row.state==='pending'?'Retry pending deletion':'Confirm erasure'}</button></form>`:''}<p>${escape(row.state==='complete'?'Storage absence verified. The receipt retains opaque custody facts.':row.state==='partial'?'Classified exhibit storage absence verified. Other entity records remain; no completed entity erasure is claimed.':'No completed erasure is claimed.')}</p><p><a href="/app/privacy">Privacy requests and holds</a></p>`}
export function privacyHandler(clock:()=>Date) {
 const routes:Route[]=[
  {method:'GET',pattern:both(''),run:async c=>{const d=await privacy(c.env,c.now);
 d.requests=await privacyRows(c.env,c.delegate,d.requests)
 d.holds=await privacyRows(c.env,c.delegate,d.holds as any[])
 d.overdue_holds=await privacyRows(c.env,c.delegate,d.overdue_holds)
 d.classifications=await privacyRows(c.env,c.delegate,d.classifications as any[])
 return c.isApi?json(d):page('Privacy',`<p>Owner-authorized, scoped privacy work. Holds never expire automatically. Standalone exhibits can be erased. Entity requests erase their listed classified exhibits while retaining held originals; other entity records remain and the receipt stays partial. External downloads and offline copies cannot be recalled.</p><h2>Classify an exhibit</h2><p>Link a person, vendor or engagement to an exhibit before reviewing erasure. Classifications are retained; related legal holds protect the original. Classification grants no access.</p><form method="post" action="/app/privacy/classifications"><label>Scope<select name="kind"><option>person</option><option>vendor</option><option>engagement</option></select></label><label>Subject ID<input name="subject_id" required maxlength="128"></label><label>Exhibit ID<input name="exhibit_id" required maxlength="128"></label><label>Classification reason<input name="reason" required maxlength="500"></label><button>Retain classification</button></form><h3>Retained classifications</h3><ul>${d.classifications.map((s:any)=>`<li>${escape(s.kind)} · ${escape(s.subject_id)} · exhibit ${escape(s.exhibit_id)} · ${escape(s.reason)} · classified by ${escape(s.classified_name)}</li>`).join('')}</ul><h2>Preview erasure</h2><form method="post" action="/app/privacy/requests">${scope}<button>Preview affected stores</button></form><h2>Requests</h2><ul>${d.requests.map(r=>`<li><a href="/app/privacy/requests/${r.id}">${escape(r.kind)} · ${escape(r.state)} · ${escape(r.requested_at)}</a></li>`).join('')}</ul><h2>Authorize a legal hold</h2><form method="post" action="/app/privacy/holds">${scope}<label>Review on<input type="date" name="review_on" required></label><button>Authorize hold</button></form><h2>Hold history</h2>${d.holds.map((h:any)=>`<section><h3>${escape(h.kind)} · ${escape(h.subject_id)}</h3><p>${escape(h.reason)} · authorized by ${escape(h.authorized_name)} · review ${escape(h.review_on)} · ${h.released_at?'released':h.review_on<c.now.toISOString().slice(0,10)?'overdue review · still active':'active'}</p>${!h.released_at?`<form method="post" action="/app/privacy/holds/${h.id}/release"><label>Release reason<input name="reason" required maxlength="500"></label><button>Release hold</button></form>`:''}</section>`).join('')}`,200,{owner:c.actor.name,active:'archive',className:'privacy-page',styles:['/privacy.css']})}},
  {method:'POST',pattern:both('/classifications'),run:async c=>{
   const input=await scopedInput(c)
   await requirePrivacy(c.env,c.delegate,'exhibit',String(input.exhibit_id))
   return done(c,'/app/privacy',await classify(c.env,input,c.actor,c.now),201)
  }},
  {method:'POST',pattern:both('/requests'),run:async c=>{const r=await preview(c.env,await scopedInput(c),c.actor,c.now);return done(c,'/app/privacy/requests/'+r.id,r,201)}},
  {method:'GET',pattern:both(`/requests/${id}`),run:async(c,m)=>{const r=await scopedRequest(c,m[1]);return c.isApi?json(r):page('Erasure review',details(r),200,{owner:c.actor.name,active:'archive',className:'privacy-page',styles:['/privacy.css']})}},
  {method:'POST',pattern:both(`/requests/${id}/confirm`),run:async(c,m)=>{
   await scopedRequest(c,m[1])
   return done(c,'/app/privacy/requests/'+m[1],await execute(c.env,m[1],await readInput(c.request),c.actor,c.now))
  }},
  {method:'POST',pattern:both('/holds'),run:async c=>done(c,'/app/privacy',await hold(c.env,await scopedInput(c),c.actor,c.now),201)},
  {method:'POST',pattern:both(`/holds/${id}/release`),run:async(c,m)=>{
   const h=await c.env.DB.prepare('SELECT kind,subject_id FROM privacy_holds WHERE id=?').bind(m[1]).first<{kind:string;subject_id:string}>()
   if(h)await requirePrivacy(c.env,c.delegate,h.kind,h.subject_id)
   await release(c.env,m[1],await readInput(c.request),c.actor,c.now);return done(c,'/app/privacy',{released:true})}},
 ];return ownerRoutes(routes,clock)
}
