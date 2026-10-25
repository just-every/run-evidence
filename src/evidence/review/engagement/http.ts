import {evidenceDecision,evidenceReply} from './decisions'
import { shareEvidence,unshareEvidence,sharedEvidence,previewEvidence } from './sharing'
import { operatorAuth,runtimeBindings,type Bindings } from '../../../auth.server'
import { ownerRoutes,json,readInput,text,auditStatement,type Route } from '../../door'
import { Refusal } from '../../upload'
import { storedBytes } from '../../storage'
import { rows,engagement,requestOf,authorized,auditIdentity,createEngagement,importRequests,submit,projection,auditorWrite,invite,scopedSubmissionReceipt } from './storage'
const id='([a-f0-9-]{36})',owner=(tail='')=>new RegExp('^/api/audit-engagements'+tail+'$')
export function engagementHandler(clock:()=>Date){
 const routes:Route[]=[
 {method:'GET',pattern:owner(),run:async c=>json({engagements:await rows(c.env,'SELECT * FROM audit_engagements ORDER BY created_at,id')})},
 {method:'POST',pattern:owner(),run:async c=>json(await createEngagement(c.env,await readInput(c.request),c.actor,c.now),201)},
 {method:'GET',pattern:owner('/'+id+'(?:/pack)?'),run:async(c,m)=>{const result=await projection(c.env,await engagement(c.env,m[1]));await auditStatement(c.env,c.actor,c.url.pathname.endsWith('/pack')?'audit.pack.exported':'audit.engagement.viewed',m[1],c.now).run();return json(result)}},
 {method:'POST',pattern:owner('/'+id+'/evidence/'+id+'/replies'),run:async(c,m)=>json(await evidenceReply(c.env,await engagement(c.env,m[1]),m[2],await readInput(c.request),c.actor,c.now),201)},
 {method:'POST',pattern:owner('/'+id+'/shares'),run:async(c,m)=>json(await shareEvidence(c.env,await engagement(c.env,m[1]),await readInput(c.request),c.actor,c.now),201)},
 {method:'POST',pattern:owner('/'+id+'/shares/'+id+'/unshare'),run:async(c,m)=>json(await unshareEvidence(c.env,await engagement(c.env,m[1]),m[2],await readInput(c.request),c.actor,c.now))},
 {method:'GET',pattern:owner('/'+id+'/evidence(?:/'+id+')?'),run:async(c,m)=>json(await previewEvidence(c.env,await engagement(c.env,m[1]),c.actor,c.now,m[2]))},
 {method:'POST',pattern:owner('/'+id+'/auditors'),run:async(c,m)=>json(await invite(c.env,await engagement(c.env,m[1]),await readInput(c.request),c.actor,c.now,(email,displayName)=>operatorAuth(c.env).invite(c.request,{email,displayName,role:'member',returnTo:'/api/auditor/'+m[1]})),201)},
 {method:'POST',pattern:owner('/'+id+'/auditors/'+id+'/revoke'),run:async(c,m)=>{await engagement(c.env,m[1]);const reason=text(await readInput(c.request),'reason',1000);await c.env.DB.batch([c.env.DB.prepare('UPDATE audit_grants SET revoked_at=COALESCE(revoked_at,?) WHERE engagement_id=? AND id=?').bind(c.now.toISOString(),m[1],m[2]),auditStatement(c.env,c.actor,'audit.auditor.revoked',m[1],c.now,'succeeded','',{reason,revision:m[2]})]);return json({revoked:true})}},
 {method:'POST',pattern:owner('/'+id+'/close'),run:async(c,m)=>{const e=await engagement(c.env,m[1]),reason=text(await readInput(c.request),'reason',1000);if(e.closed_at)return json({closed:true});const result=await c.env.DB.prepare('UPDATE audit_engagements SET closed_at=? WHERE id=? AND closed_at IS NULL AND EXISTS(SELECT 1 FROM audit_requests WHERE engagement_id=?) AND NOT EXISTS(SELECT 1 FROM audit_requests WHERE engagement_id=? AND closed_at IS NULL)').bind(c.now.toISOString(),e.id,e.id,e.id).run();if(!result.meta.changes)throw new Refusal('Close every accepted request before the engagement.',409);await auditStatement(c.env,c.actor,'audit.engagement.closed',e.id,c.now,'succeeded','',{reason}).run();return json({closed:true})}},
 {method:'POST',pattern:owner('/'+id+'/requests'),run:async(c,m)=>json(await importRequests(c.env,await engagement(c.env,m[1]),await readInput(c.request),c.actor,c.now),201)},
 {method:'POST',pattern:owner('/'+id+'/requests/'+id+'/submissions'),run:async(c,m)=>json(await submit(c.env,await engagement(c.env,m[1]),await requestOf(c.env,m[1],m[2]),await readInput(c.request),c.actor,c.now),201)},
 {method:'POST',pattern:owner('/'+id+'/requests/'+id+'/comments'),run:async(c,m)=>{const e=await engagement(c.env,m[1]),r=await requestOf(c.env,m[1],m[2]);if(e.closed_at||r.closed_at)throw new Refusal('Request is closed.',409);const body=text(await readInput(c.request),'body',5000),comment=crypto.randomUUID();await c.env.DB.batch([c.env.DB.prepare("INSERT INTO audit_comments VALUES(?,?,?,?,?,'owner',?)").bind(comment,r.id,body,c.actor.id,c.actor.name,c.now.toISOString()),auditStatement(c.env,c.actor,'audit.owner.comment',r.id,c.now,'succeeded','',{revision:comment})]);return json({id:comment},201)}},
 {method:'POST',pattern:owner('/'+id+'/requests/'+id+'/close'),run:async(c,m)=>{const r=await requestOf(c.env,m[1],m[2]);const reason=text(await readInput(c.request),'reason',1000);const result=await c.env.DB.prepare("UPDATE audit_requests SET closed_at=? WHERE id=? AND closed_at IS NULL AND EXISTS(SELECT 1 FROM audit_decisions d WHERE d.request_id=? AND d.revision=(SELECT MAX(revision) FROM audit_decisions WHERE request_id=?) AND d.state='accepted' AND d.submission_id=(SELECT id FROM audit_submissions WHERE request_id=? ORDER BY revision DESC LIMIT 1))").bind(c.now.toISOString(),r.id,r.id,r.id,r.id).run();if(!result.meta.changes)throw new Refusal('Latest submission must be accepted before close-out.',409);await auditStatement(c.env,c.actor,'audit.request.closed',r.id,c.now,'succeeded','',{reason}).run();return json({closed:true})}},
 ];const owners=ownerRoutes(routes,clock)
 return async(request:Request,original:Bindings):Promise<Response|null>=>{
 const url=new URL(request.url),env=runtimeBindings(original)
 if(url.pathname.startsWith('/api/audit-engagements'))return owners(request,env)
 if(!url.pathname.startsWith('/api/auditor'))return null
 if(url.origin!==env.AUTH_ORIGIN||(request.headers.has('host')&&request.headers.get('host')?.toLowerCase()!==url.host.toLowerCase())||request.headers.get('sec-fetch-site')==='cross-site'||(request.headers.has('origin')&&request.headers.get('origin')!==url.origin)||(request.method==='POST'&&request.headers.get('origin')!==url.origin))return json({error:'Same-origin request required.'},403)
 const session=await operatorAuth(env).getSession(request)
 if(!session)return json({error:'Auditor sign-in required.'},401)
 const email=session.operator.email.toLowerCase(),actor={id:session.operator.id,name:session.operator.displayName}
 if(session.kind!=='native'||session.operator.role!=='member'||!await auditIdentity(env,email))return json({error:'Dedicated native auditor session required.'},403)
 // Explicit route parsing avoids accepting unknown tails as a read.
 const parts=url.pathname.split('/').slice(3),eid=parts[0]
 if(!eid||!await authorized(env,eid,email,clock()))return json({error:'Engagement not found.'},404)
 try{
  const e=await engagement(env,eid);let response:Response
  if((parts.length===1||parts.length===2&&parts[1]==='pack')&&['GET','HEAD'].includes(request.method))response=json(await projection(env,e))
  else if((parts.length===2||parts.length===3)&&parts[1]==='evidence'&&['GET','HEAD'].includes(request.method))response=json(await sharedEvidence(env,e,parts[2]))
  else if(parts.length===5&&parts[1]==='evidence'&&parts[3]==='observations'&&['GET','HEAD'].includes(request.method)){const data=await sharedEvidence(env,e,parts[2]),observation=data.shares[0].observations.find(o=>o.id===parts[4]);if(!observation)throw new Refusal('Shared observation not found.',404);response=json(observation)}
  else if(parts.length===4&&parts[1]==='evidence'&&parts[3]==='decisions'&&request.method==='POST')response=json(await evidenceDecision(env,e,parts[2],await readInput(request),actor,email,session.id,clock()),201)
  else if(parts.length===5&&parts[1]==='requests'){
   const r=await requestOf(env,eid,parts[2])
   if(!['receipts','observations'].includes(parts[3])||!['GET','HEAD'].includes(request.method))return json({error:'Not found.'},404)
   if(parts[3]==='observations'){const data=await projection(env,e),observation=data.requests.find(q=>q.id===r.id)?.observations.find(o=>o.id===parts[4]);if(!observation)return json({error:'Not found.'},404);response=json(observation)}else {
   if(!await env.DB.prepare('SELECT 1 FROM audit_submissions WHERE request_id=? AND receipt_id=?').bind(r.id,parts[4]).first())return json({error:'Not found.'},404)
   const row=await scopedSubmissionReceipt(env,e,r,parts[4]),bytes=await storedBytes(env,row);if(!bytes)return json({error:'Retained bytes unavailable.'},404)
   response=new Response(bytes,{headers:{'cache-control':'no-store','content-type':'application' + '/' + 'octet-stream','content-disposition':'attachment; filename="exhibit"','x-content-type-options':'nosniff','content-security-policy':"default-src 'none'; sandbox",'referrer-policy':'no-referrer'}})
   }
  }else if(parts.length===4&&parts[1]==='requests'&&['comments','decisions'].includes(parts[3])&&request.method==='POST')response=json(await auditorWrite(env,e,await requestOf(env,eid,parts[2]),await readInput(request),actor,email,clock(),parts[3]==='decisions',session.id),201)
  else return json({error:'Not found.'},404)
  await auditStatement(env,{...actor,kind:'system'},'audit.auditor.viewed',eid,clock(),'succeeded','Authenticated auditor').run()
  if(parts[1]==='evidence'&&['GET','HEAD'].includes(request.method)){const data=await sharedEvidence(env,e,parts[2]);if(parts.length===5){const observation=data.shares[0].observations.find(o=>o.id===parts[4]);if(!observation)throw new Refusal('Shared observation not found.',404);response=json(observation)}else response=json(data)}
  else if(parts.length===1||parts.length===2&&parts[1]==='pack')response=json(await projection(env,e))
  if(!await authorized(env,eid,email,clock())||!await operatorAuth(env).getSession(request))return json({error:'Engagement not found.'},404)
  return request.method==='HEAD'?new Response(null,{status:response.status,headers:response.headers}):response
 }catch(error){return error instanceof Refusal?json({error:error.message},error.status):json({error:'Auditor operation unavailable.'},503)}
 }
}
