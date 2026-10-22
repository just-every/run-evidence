import type {Bindings} from '../../auth.server'
import {Refusal} from '../upload'
import {auditStatement,text,type Actor,type Input} from '../door'
import {publicBase} from '../net'
import {seal,unseal} from './custody'
import type {Connection} from './storage'
import {startRun,backoffUpdate,reconnectUpdate} from './runs'
import {catalogueStatements} from '../tests/storage'
import {runForType} from '../tests/engine'
import {sourceReadTime} from './pages'
import {upsertResources,upsertRegister,type ResourceSchema} from '../resources'
import {digest} from '../api/tokens'
import {gitlabClient,gitlabGroup,gitlabProjects,gitlabRepository,gitlabMembers,gitlabPermissions,GitlabFailure} from './gitlab'
export const gitlabRevision='gitlab-1'
async function verify(base:string,account:string,token:string,now:Date){
 try{const client=gitlabClient(base,token,now),group=await gitlabGroup(client,account),projects=await gitlabProjects(client,account);return {group,projects}}
 catch(e){if(e instanceof GitlabFailure)throw new Refusal(e.message,e.kind==='throttled'?429:400);throw e}
}
export async function connectGitlab(env:Bindings,actor:Actor,input:Input,now:Date){
 const account=text(input,'account',100),token=text(input,'token',4000),base=publicBase(input.api_base,'https://gitlab.com/api/v4')
 if(!/^[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*$/.test(account)||account.split('/').some(p=>p==='.'||p==='..'))throw new Refusal('Name the GitLab group path.')
 if(await env.DB.prepare("SELECT 1 FROM connections WHERE provider='gitlab' AND account=? AND api_base=? AND status!='revoked'").bind(account,base).first())throw new Refusal('This group is already connected; rotate or revoke it.',409)
 const checked=await verify(base,account,token,now),id=crypto.randomUUID(),sealed=await seal(env,token,id)
 await env.DB.batch([
  env.DB.prepare("INSERT INTO connections(id,provider,label,account,api_base,secret_ciphertext,secret_iv,granted_scopes,status,created_by,created_name,created_at) VALUES(?,'gitlab',?,?,?,?,?,?,'active',?,?,?)").bind(id,text(input,'label',120,true)||'GitLab '+account,account,base,sealed.ciphertext,sealed.iv,JSON.stringify(gitlabPermissions),actor.id,actor.name,now.toISOString()),
  ...checked.projects.map(p=>env.DB.prepare('INSERT INTO connection_repositories(connection_id,full_name,selected) VALUES(?,?,0)').bind(id,p.name)),
  ...await catalogueStatements(env,'gitlab',actor,now),auditStatement(env,actor,'connection.authorized','connection:'+id,now,'succeeded','gitlab '+account),
 ])
 return {id,repositories:checked.projects.map(p=>p.name)}
}
export async function rotateGitlab(env:Bindings,actor:Actor,c:Connection,input:Input,now:Date){
 const token=text(input,'token',4000),checked=await verify(c.api_base,c.account,token,now),sealed=await seal(env,token,c.id)
 await env.DB.batch([env.DB.prepare("UPDATE connections SET secret_ciphertext=?,secret_iv=?,status='active',rotated_at=?,revoked_at=NULL,last_error='',backoff_seconds=0,next_attempt_at=NULL WHERE id=?").bind(sealed.ciphertext,sealed.iv,now.toISOString(),c.id),...checked.projects.map(p=>env.DB.prepare('INSERT OR IGNORE INTO connection_repositories(connection_id,full_name,selected) VALUES(?,?,0)').bind(c.id,p.name)),auditStatement(env,actor,c.status==='active'?'connection.rotated':'connection.reconnected','connection:'+c.id,now)])
}
export async function runGitlab(env:Bindings,c:Connection,trigger:'schedule'|'manual',now:Date){
 const started=await startRun(env,c,gitlabRevision,trigger,now)
 if(!started)return {run:null,outcome:'already running'}
 const {finish}=started,at=now.toISOString()
 if(c.status!=='active'||!c.secret_ciphertext||!c.secret_iv)return finish('failed',{},'connection is '+c.status)
 let token:string
 try{token=await unseal(env,c.secret_ciphertext,c.secret_iv,c.id)}catch{return finish('failed',{},'credential unavailable',reconnectUpdate(env,c,'Stored credential cannot be decrypted; reconnect.',now))}
 const client=gitlabClient(c.api_base,token,now),selected=(await env.DB.prepare('SELECT full_name FROM connection_repositories WHERE connection_id=? AND selected=1 ORDER BY full_name').bind(c.id).all<{full_name:string}>()).results.map(r=>r.full_name)
 const coverage={organization:'unread',repositories_selected:selected.length,repositories_read:[] as string[],unreadable:[] as {repository:string;reason:string}[],gaps:[] as {asset:string;reason:string}[],code_history:{} as Record<string,unknown>,source_members:undefined as unknown}
 const repoSchema:ResourceSchema={fields:{private:'boolean',archived:'boolean',default_branch:'string',branch_protection:'boolean',required_reviews:'number',required_status_checks:'number',readable:'boolean'},required:[]}
 const orgSchema:ResourceSchema={fields:{login:'string',two_factor_requirement_enabled:'boolean',departed_members:'number',readable:'boolean'},required:[]}
 const rows:{uniqueId:string;displayName:string;attributes:Record<string,unknown>}[]=[],packages:typeof rows=[],source={kind:'source-observed' as const,ref:'gitlab:'+c.id,label:'GitLab '+c.account+' via '+c.label},dependencySource={...source,ref:'gitlab-dependencies:'+c.id}
 let org:Record<string,unknown>={login:c.account,two_factor_requirement_enabled:null,readable:false},dependenciesComplete=true
 try{
  try{org={...await gitlabGroup(client,c.account),readable:true};delete org.id;coverage.organization='read'}catch(e){if(!(e instanceof GitlabFailure)||e.kind!=='gap')throw e;coverage.gaps.push({asset:c.account,reason:e.message})}
  const members=await gitlabMembers(env,c,client,now);coverage.source_members=members;org.departed_members=members.departed_members;coverage.gaps.push(...members.gaps.map(reason=>({asset:c.account,reason})))
  for(const name of selected){
   try{
    const read=await gitlabRepository(client,name);rows.push({uniqueId:name,displayName:name,attributes:read.attributes});coverage.repositories_read.push(name)
    if(new TextEncoder().encode(JSON.stringify({...coverage.code_history,[name]:read.history})).length<=80000)coverage.code_history[name]=read.history
    else read.gaps.push('total source history exceeds 80,000 bytes; repository history not retained')
    coverage.gaps.push(...read.gaps.map(reason=>({asset:name,reason})))
    if(read.history.dependencies)for(const p of read.history.dependencies.packages)packages.push({uniqueId:await digest(name+':'+p.id),displayName:p.name,attributes:{repository:name,name:p.name,version:p.version,generated_at:null,source_revision:null,readable:true}})
    else dependenciesComplete=false
   }catch(e){if(!(e instanceof GitlabFailure)||e.kind!=='gap')throw e;rows.push({uniqueId:name,displayName:name,attributes:{readable:false}});coverage.unreadable.push({repository:name,reason:e.message});coverage.gaps.push({asset:name,reason:e.message});dependenciesComplete=false}
  }
 }catch(e){
  if(e instanceof GitlabFailure&&e.kind==='unauthorized')return finish('failed',coverage,e.message,reconnectUpdate(env,c,'GitLab rejected the credential; reconnect.',now))
  if(e instanceof GitlabFailure&&e.kind==='throttled')return finish('throttled',coverage,e.message,backoffUpdate(env,c,e.reset,'GitLab',now))
  return finish('failed',coverage,'transport failure',env.DB.prepare('UPDATE connections SET last_attempt_at=?,last_error=? WHERE id=?').bind(at,'GitLab did not complete an authorized read.',c.id))
 }
 await upsertResources(env,'gitlab.organization',orgSchema,[{uniqueId:c.account,displayName:c.account+' (group)',attributes:org}],source,false,now)
 const written=await upsertResources(env,'gitlab.repository',repoSchema,rows,source,'source',now),fresh=written.results.filter(r=>r.id&&r.outcome!=='removed'&&coverage.repositories_read.includes(r.uniqueId)).map(r=>r.id!)
 if(fresh.length)await env.DB.prepare('UPDATE resources SET observed_at=? WHERE id IN (SELECT value FROM json_each(?))').bind(sourceReadTime(now),JSON.stringify(fresh)).run()
 if(coverage.organization==='read')await env.DB.prepare("UPDATE resources SET observed_at=? WHERE type='gitlab.organization' AND source_ref=?").bind(sourceReadTime(now),source.ref).run()
 const dependencySchema:ResourceSchema={fields:{repository:'string',name:'string',version:'string',generated_at:'string',source_revision:'string',readable:'boolean'},required:[]}
 if(dependenciesComplete){await upsertRegister(env,'gitlab.dependency',dependencySchema,packages,dependencySource,now);await env.DB.prepare("UPDATE resources SET observed_at=? WHERE type='gitlab.dependency' AND source_ref=? AND removed_at IS NULL").bind(sourceReadTime(now),dependencySource.ref).run()}
 else{
  const known=(await env.DB.prepare("SELECT unique_id,display_name FROM resources WHERE type='gitlab.dependency' AND source_ref=? AND removed_at IS NULL").bind(dependencySource.ref).all<{unique_id:string;display_name:string}>()).results
  for(let i=0;i<known.length;i+=200)await upsertResources(env,'gitlab.dependency',dependencySchema,known.slice(i,i+200).map(d=>({uniqueId:d.unique_id,displayName:d.display_name,attributes:{readable:false}})),dependencySource,false,now)
 }
 const outcome=coverage.organization!=='read'&&!coverage.repositories_read.length?'failed':coverage.gaps.length?'partial':'complete'
 const result=await finish(outcome,coverage,'',env.DB.prepare("UPDATE connections SET last_attempt_at=?,last_success_at=CASE WHEN ?='failed' THEN last_success_at ELSE ? END,next_attempt_at=NULL,backoff_seconds=0,last_error=? WHERE id=?").bind(at,outcome,at,coverage.gaps.length+' source gaps',c.id))
 await runForType(env,'gitlab.repository',now);await runForType(env,'gitlab.organization',now);await runForType(env,'identity.account',now);return result
}
