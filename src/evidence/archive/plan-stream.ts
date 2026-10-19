import { newHash } from './framing'
import { fail } from './format'
import { staged,type Store } from './registry'
// Canonical import plans can be hundreds of megabytes. Validate their token
// stream, canonical key order, job binding and fingerprint without joining it.
export class PlanStream {
 private stack:{kind:string;expect:string;key:string;last:string;count:number;skip:boolean;entries:boolean;emitted:number}[]=[]
 private pending='';private quoted=false;private escaped=false;private primitive=false;private done=false
 private digest=newHash();private fields:Record<string,unknown>={};private entries=-1
 push(chunk:string) {
  for(let i=0;i<chunk.length;i++){
   const c=chunk[i]
   if(this.quoted){this.pending+=c;if(this.pending.length>16*1024*1024)fail('Import plan scalar exceeds the bounded record size.');if(this.escaped)this.escaped=false;else if(c==='\\')this.escaped=true;else if(c==='"'){this.quoted=false;this.token(this.pending);this.pending=''};continue}
   if(this.primitive){if(/[0-9a-zE+.-]/.test(c)){this.pending+=c;continue}this.primitive=false;this.token(this.pending);this.pending=''}
   if(c==='"'){this.quoted=true;this.pending=c}else if(/[0-9tfn-]/.test(c)){this.primitive=true;this.pending=c}else if('{}[],:'.includes(c))this.token(c);else fail('Retained import plan is not canonical JSON.')
  }
 }
 private token(token:string) {
  const s=this.stack.at(-1)
  if(!s){if(this.done||token!=='{')fail('Invalid retained import plan.');this.digest.update('{');this.stack.push({kind:'object',expect:'key',key:'',last:'',count:0,skip:false,entries:false,emitted:0});return}
  const root=this.stack.length===1
  if((token==='}'&&s.kind==='object')||(token===']'&&s.kind==='array')){
   if(!['key','value','comma'].includes(s.expect)||((s.expect==='key'||s.expect==='value')&&s.count))fail('Truncated retained import plan.')
   if(!s.skip)this.digest.update(token);this.stack.pop();if(s.entries)this.entries=s.count
   if(!this.stack.length)this.done=true;else this.complete();return
  }
  if(s.expect==='key'){
   let key:unknown;try{key=JSON.parse(token)}catch{fail('Invalid plan key.')}
   if(typeof key!=='string'||JSON.stringify(key)!==token||s.count&&key<=s.last)fail('Noncanonical or duplicate plan key.')
   s.key=key;s.last=key;s.expect='colon';const skip=s.skip||(root&&key==='fingerprint')
   if(!skip){if(root&&s.emitted++)this.digest.update(',');this.digest.update(token)}return
  }
  const skipped=s.skip||(root&&s.key==='fingerprint')
  if(s.expect==='colon'){if(token!==':')fail('Invalid import plan separator.');if(!skipped)this.digest.update(token);s.expect='value';return}
  if(s.expect==='comma'){if(token!==',')fail('Invalid import plan separator.');if(!root&&!s.skip)this.digest.update(token);s.expect=s.kind==='object'?'key':'value';return}
  if(s.expect!=='value')fail('Invalid import plan token.')
  if(token==='{'||token==='['){if(!skipped)this.digest.update(token);this.stack.push({kind:token==='{'?'object':'array',expect:token==='{'?'key':'value',key:'',last:'',count:0,skip:skipped,entries:root&&s.key==='entries',emitted:0});return}
  let value:unknown;try{value=JSON.parse(token)}catch{fail('Invalid import plan scalar.')}
  if(JSON.stringify(value)!==token)fail('Noncanonical import plan scalar.')
  if(root)this.fields[s.key]=value
  if(!skipped)this.digest.update(token);this.complete()
 }
 private complete(){const s=this.stack.at(-1)!;s.count++;s.expect='comma'}
 finish(job:Record<string,any>){
  if(this.primitive){this.token(this.pending);this.primitive=false}
  if(!this.done||this.quoted||this.stack.length)fail('Truncated import plan.')
  const f=this.fields
  if(f.version!==1||f.destination!==job.destination||f.namespace!==job.namespace||f.mappingVersion!==job.mapping_version||f.principalId!==job.principal_id||f.fingerprint!==job.fingerprint||this.entries!==job.total||this.digest.digest('hex')!==job.fingerprint)fail('Retained import plan contradicts its job or fingerprint.')
 }
}
export async function validatePlans(env:Store,id:string) {
 let after=''
 for(;;){
  const jobs=(await env.DB.prepare(`SELECT * FROM ${staged(id,'ik_jobs')} WHERE id>? ORDER BY id LIMIT 1`).bind(after).all<Record<string,any>>()).results
  if(!jobs.length)break
  const job=jobs[0];after=job.id;let envelope:any;try{envelope=JSON.parse(job.plan_json)}catch{fail('Invalid retained import plan.')}
  const parser=new PlanStream()
  if(envelope?.d1Plan===1){
   if(!Number.isSafeInteger(envelope.chunks)||envelope.chunks<1||!Number.isSafeInteger(envelope.size)||envelope.size<1)fail('Invalid import plan chunks.')
   let ordinal=0,size=0;const hash=newHash()
   for(;;){const parts=(await env.DB.prepare(`SELECT ordinal,body FROM ${staged(id,'ik_d1_plan_chunks')} WHERE job_id=? AND ordinal>=? ORDER BY ordinal LIMIT 3`).bind(job.id,ordinal).all<{ordinal:number;body:string}>()).results;if(!parts.length)break;for(const part of parts){if(part.ordinal!==ordinal++)fail('Missing import plan chunk.');hash.update(part.body);size+=Buffer.byteLength(part.body);parser.push(part.body)}}
   if(ordinal!==envelope.chunks||size!==envelope.size||hash.digest('hex')!==envelope.sha256)fail('Retained import plan chunk fingerprint mismatch.')
  }else parser.push(job.plan_json)
  parser.finish(job)
 }
}
