import type {Bindings} from '../../auth.server'
import {Refusal} from '../upload'
import {auditStatement,text,type Actor,type Input} from '../door'
import {seal,unseal} from './custody'
import type {Connection} from './storage'
import {startRun,backoffUpdate,reconnectUpdate} from './runs'
import {catalogueStatements} from '../tests/storage'
import {runForType} from '../tests/engine'
import {sourceReadTime} from './pages'
import {upsertResources,upsertRegister,upsertCollectedResources,type ResourceSchema} from '../resources'
import {digest} from '../api/tokens'
import {bitbucketClient,bitbucketGroup,bitbucketProjects,bitbucketRepository,bitbucketMembers,bitbucketPermissions,BitbucketFailure} from './bitbucket'
export const bitbucketRevision='bitbucket-1'
async function verify(base:string,account:string,token:string,now:Date){
 try{const client=bitbucketClient(base,token,now),group=await bitbucketGroup(client,account),projects=await bitbucketProjects(client,account);return {group,projects}}
 catch(e){if(e instanceof BitbucketFailure)throw new Refusal(e.message,e.kind==='throttled'?429:400);throw e}
}
export async function connectBitbucket(env:Bindings,actor:Actor,input:Input,now:Date){
 const consentReason=text(input,'reason',500)
 if(input.admin_read_consent!=='yes')throw new Refusal('Explicit owner consent is required: Bitbucket requires a write-capable repository admin scope even to read branch restrictions. Evidence will only send GET requests.')
 const account=text(input,'account',100),token=text(input,'token',4000),base='https://api.bitbucket.org/2.0'
 if(!/^[A-Za-z0-9_-]{1,100}$/.test(account))throw new Refusal('Name the Bitbucket workspace slug.')
 if(await env.DB.prepare("SELECT 1 FROM connections WHERE provider='bitbucket' AND account=? AND api_base=? AND status!='revoked'").bind(account,base).first())throw new Refusal('This workspace is already connected; rotate or revoke it.',409)
 const checked=await verify(base,account,token,now),id=crypto.randomUUID(),sealed=await seal(env,token,id)
 await env.DB.batch([
  env.DB.prepare("INSERT INTO connections(id,provider,label,account,api_base,secret_ciphertext,secret_iv,granted_scopes,status,created_by,created_name,created_at,config_json) VALUES(?,'bitbucket',?,?,?,?,?,?,'active',?,?,?,?)").bind(id,text(input,'label',120,true)||'Bitbucket '+account,account,base,sealed.ciphertext,sealed.iv,JSON.stringify(bitbucketPermissions),actor.id,actor.name,now.toISOString(),JSON.stringify({workspace_id:checked.group.id,admin_read_consent:{by:actor.id,at:now.toISOString(),reason:consentReason}})),
  ...checked.projects.map(p=>env.DB.prepare('INSERT INTO connection_repositories(connection_id,full_name,selected) VALUES(?,?,0)').bind(id,p.name)),
  ...await catalogueStatements(env,'bitbucket',actor,now),auditStatement(env,actor,'connection.authorized','connection:'+id,now,'succeeded','bitbucket '+account+'; owner approved provider admin scope for GET-only collection',{reason:consentReason,revision:bitbucketRevision}),
 ])
 return {id,repositories:checked.projects.map(p=>p.name)}
}
export async function rotateBitbucket(env:Bindings,actor:Actor,c:Connection,input:Input,now:Date){
 const reason=text(input,'reason',500)
 if(input.admin_read_consent!=='yes')throw new Refusal('Reconfirm the Bitbucket admin-scope consent and reason when rotating authority.')
 const token=text(input,'token',4000),checked=await verify(c.api_base,c.account,token,now)
 if(checked.group.id!==JSON.parse(c.config_json).workspace_id)throw new Refusal('The authorized Bitbucket workspace identity changed. Revoke this connection and explicitly authorize the new workspace.',409)
 const sealed=await seal(env,token,c.id)
 await env.DB.batch([env.DB.prepare("UPDATE connections SET secret_ciphertext=?,secret_iv=?,status='active',config_json=json_set(config_json,'$.admin_read_consent',json(?)),rotated_at=?,revoked_at=NULL,last_error='',backoff_seconds=0,next_attempt_at=NULL WHERE id=?").bind(sealed.ciphertext,sealed.iv,JSON.stringify({by:actor.id,at:now.toISOString(),reason}),now.toISOString(),c.id),...checked.projects.map(p=>env.DB.prepare('INSERT OR IGNORE INTO connection_repositories(connection_id,full_name,selected) VALUES(?,?,0)').bind(c.id,p.name)),auditStatement(env,actor,c.status==='active'?'connection.rotated':'connection.reconnected','connection:'+c.id,now,'succeeded','GET-only Bitbucket admin-scope consent renewed',{reason,revision:bitbucketRevision})])
}
export async function runBitbucket(env:Bindings,c:Connection,trigger:'schedule'|'manual',now:Date){
 const started=await startRun(env,c,bitbucketRevision,trigger,now)
 if(!started)return {run:null,outcome:'already running'}
 const {finish}=started,at=now.toISOString()
 if(c.status!=='active'||!c.secret_ciphertext||!c.secret_iv)return finish('failed',{},'connection is '+c.status)
 let token:string
 try{token=await unseal(env,c.secret_ciphertext,c.secret_iv,c.id)}catch{return finish('failed',{},'credential unavailable',reconnectUpdate(env,c,'Stored credential cannot be decrypted; reconnect.',now))}
 const client=bitbucketClient(c.api_base,token,now),selected=(await env.DB.prepare('SELECT full_name FROM connection_repositories WHERE connection_id=? AND selected=1 ORDER BY full_name').bind(c.id).all<{full_name:string}>()).results.map(r=>r.full_name)
 const coverage={organization:'unread',repositories_selected:selected.length,repositories_read:[] as string[],unreadable:[] as {repository:string;reason:string}[],gaps:[] as {asset:string;reason:string}[],code_history:{} as Record<string,unknown>,source_members:undefined as unknown}
 const repoSchema:ResourceSchema={fields:{private:'boolean',archived:'boolean',default_branch:'string',branch_protection:'boolean',required_reviews:'number',required_status_checks:'number',readable:'boolean'},required:[]}
 const orgSchema:ResourceSchema={fields:{login:'string',two_factor_requirement_enabled:'boolean',departed_members:'number',readable:'boolean'},required:[]}
 const rows:{uniqueId:string;displayName:string;attributes:Record<string,unknown>}[]=[],packages:typeof rows=[],source={kind:'source-observed' as const,ref:'bitbucket:'+c.id,label:'Bitbucket '+c.account+' via '+c.label},dependencySource={...source,ref:'bitbucket-dependencies:'+c.id}
 let org:Record<string,unknown>={login:c.account,two_factor_requirement_enabled:null,readable:false},dependenciesComplete=true
 try{
  try{const group=await bitbucketGroup(client,c.account);if(group.id!==JSON.parse(c.config_json).workspace_id)throw new BitbucketFailure('Authorized Bitbucket workspace identity changed','unauthorized');org={...group,readable:true};delete org.id;coverage.organization='read'}catch(e){if(!(e instanceof BitbucketFailure)||e.kind!=='gap')throw e;coverage.gaps.push({asset:c.account,reason:e.message})}
  const members=await bitbucketMembers(env,c,client,now);coverage.source_members=members;org.departed_members=members.departed_members;coverage.gaps.push(...members.gaps.map(reason=>({asset:c.account,reason})))
  for(const name of selected){
   try{
    const read=await bitbucketRepository(client,name);rows.push({uniqueId:name,displayName:name,attributes:read.attributes});coverage.repositories_read.push(name)
    if(new TextEncoder().encode(JSON.stringify({...coverage.code_history,[name]:read.history})).length<=80000)coverage.code_history[name]=read.history
    else read.gaps.push('total source history exceeds 80,000 bytes; repository history not retained')
    for(const deployment of read.history.deployments??[]){deployment.environment_key=await digest(deployment.environment_key!);deployment.production=(JSON.parse(c.config_json).production_environments??[]).includes(deployment.environment_key)?true:null}
    coverage.gaps.push(...read.gaps.map(reason=>({asset:name,reason})))
    if(read.history.dependencies)for(const p of read.history.dependencies.packages)packages.push({uniqueId:await digest(name+':'+p.id),displayName:p.name,attributes:{repository:name,name:p.name,version:p.version,generated_at:null,source_revision:read.history.dependencies.source_revision??null,readable:true}})
    else dependenciesComplete=false
   }catch(e){if(!(e instanceof BitbucketFailure)||e.kind!=='gap')throw e;rows.push({uniqueId:name,displayName:name,attributes:{readable:false}});coverage.unreadable.push({repository:name,reason:e.message});coverage.gaps.push({asset:name,reason:e.message});dependenciesComplete=false}
  }
 }catch(e){
  if(e instanceof BitbucketFailure&&e.kind==='unauthorized')return finish('failed',coverage,e.message,reconnectUpdate(env,c,'Bitbucket rejected the credential; reconnect.',now))
  if(e instanceof BitbucketFailure&&e.kind==='throttled')return finish('throttled',coverage,e.message,backoffUpdate(env,c,e.reset,'Bitbucket',now))
  return finish('failed',coverage,'transport failure',env.DB.prepare('UPDATE connections SET last_attempt_at=?,last_error=? WHERE id=?').bind(at,'Bitbucket did not complete an authorized read.',c.id))
 }
 await upsertResources(env,'bitbucket.organization',orgSchema,[{uniqueId:c.account,displayName:c.account+' (group)',attributes:org}],source,false,now)
 const written=await upsertCollectedResources(env,'bitbucket.repository',repoSchema,rows,source,true,now),fresh=written.results.filter(r=>r.id&&r.outcome!=='removed'&&r.outcome!=='rejected'&&coverage.repositories_read.includes(r.uniqueId)).map(r=>r.id!)
 for(const r of written.results.filter(r=>r.outcome==='rejected'))coverage.gaps.push({asset:r.uniqueId,reason:(r.reasons??[]).join('; ')})
 if(fresh.length)await env.DB.prepare('UPDATE resources SET observed_at=? WHERE id IN (SELECT value FROM json_each(?))').bind(sourceReadTime(now),JSON.stringify(fresh)).run()
 if(coverage.organization==='read')await env.DB.prepare("UPDATE resources SET observed_at=? WHERE type='bitbucket.organization' AND source_ref=?").bind(sourceReadTime(now),source.ref).run()
 const dependencySchema:ResourceSchema={fields:{repository:'string',name:'string',version:'string',generated_at:'string',source_revision:'string',readable:'boolean'},required:[]}
 if(dependenciesComplete){await upsertRegister(env,'bitbucket.dependency',dependencySchema,packages,dependencySource,now);await env.DB.prepare("UPDATE resources SET observed_at=? WHERE type='bitbucket.dependency' AND source_ref=? AND removed_at IS NULL").bind(sourceReadTime(now),dependencySource.ref).run()}
 else{
  const known=(await env.DB.prepare("SELECT unique_id,display_name FROM resources WHERE type='bitbucket.dependency' AND source_ref=? AND removed_at IS NULL").bind(dependencySource.ref).all<{unique_id:string;display_name:string}>()).results
  for(let i=0;i<known.length;i+=200)await upsertResources(env,'bitbucket.dependency',dependencySchema,known.slice(i,i+200).map(d=>({uniqueId:d.unique_id,displayName:d.display_name,attributes:{readable:false}})),dependencySource,false,now)
 }
 const outcome=coverage.organization!=='read'&&!coverage.repositories_read.length?'failed':coverage.gaps.length?'partial':'complete'
 const result=await finish(outcome,coverage,'',env.DB.prepare("UPDATE connections SET last_attempt_at=?,last_success_at=CASE WHEN ?='failed' THEN last_success_at ELSE ? END,next_attempt_at=NULL,backoff_seconds=0,last_error=? WHERE id=?").bind(at,outcome,at,coverage.gaps.length+' source gaps',c.id))
 await runForType(env,'bitbucket.repository',now);await runForType(env,'bitbucket.organization',now);await runForType(env,'identity.account',now);return result
}
