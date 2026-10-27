// Explicit held-key journey; credentials stay in process memory.
import assert from 'node:assert/strict'
import {spawn} from 'node:child_process'
import {randomBytes} from 'node:crypto'
import {stat} from 'node:fs/promises'
import {join} from 'node:path'
import {hostedSession,restoreLocalArchive} from './own-hosted-http.mjs'
import {archiveDiagnostics} from './own-hosted-tail.mjs'

const environment='own-i816-20261026',worker='evidence-'+environment
const account='b20c0ca9cab0c2b70e13d7cf724b89bd'
assert.equal(process.env.CLOUDFLARE_ACCOUNT_ID,account,'only the RunEditRun account is authorized')
for(const name of ['CLOUDFLARE_API_TOKEN','MAIL_API_KEY','MAIL_FROM','TEST_MAIL_TO','QA_INBOX_RECEIPT_TOKEN','EVIDENCE_OWN_ARTIFACTS'])assert.ok(process.env[name],name+' is required')
const env={...process.env,OWNER_EMAIL:process.env.TEST_MAIL_TO,MAIL_PROVIDER:'sendgrid',SESSION_SECRET:randomBytes(32).toString('hex'),SETUP_TOKEN:randomBytes(32).toString('hex'),CLOUDFLARE_INCLUDE_PROCESS_ENV:'false',CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV:'false',WRANGLER_SEND_METRICS:'false'}
const privateValues=Object.entries(env).filter(([name])=>/TOKEN|SECRET|KEY|EMAIL|MAIL_FROM|TEST_MAIL_TO/.test(name)).map(([,value])=>value).filter(Boolean)
const clean=text=>privateValues.reduce((text,value)=>text.replaceAll(value,'[private]'),text).replace(/https?:\/\/[^\s"<>]+[?][^\s"<>]+/g,'[private link]')
async function rer(args){
 const child=spawn('pnpm',['exec','rer','deploy','--environment',environment,'--non-interactive',...args],{env,stdio:['ignore','pipe','pipe']})
 let output='';child.stdout.on('data',b=>{output+=b});child.stderr.on('data',b=>{output+=b})
 const code=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('exit',resolve)})
 console.log(clean(output))
 assert.equal(code,0,'rer deploy '+args.join(' '))
}
async function cf(path,{method='GET',body}={}){
 const r=await fetch('https://api.cloudflare.com/client/v4/accounts/'+account+path,{method,headers:{authorization:'Bearer '+env.CLOUDFLARE_API_TOKEN,...(body?{'content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})})
 const response=await r.json();assert.equal(response.success,true,'Cloudflare readback '+path);return response.result
}
let deployed=false,closeDiagnostics
try{
 await rer(['--owner-name','Evidence acceptance']);deployed=true
 const settings=await cf('/workers/scripts/'+worker+'/settings')
 const db=settings.bindings.find(x=>x.name==='DB'),bucket=settings.bindings.find(x=>x.name==='EXHIBITS')
 assert.equal(db.type,'d1');assert.equal(bucket.type,'r2_bucket')
 const database=await cf('/d1/database/'+db.id)
 assert.equal(database.name,worker+'-db');assert.equal(bucket.bucket_name,worker+'-exhibits')
 const buckets=await cf('/r2/buckets');assert.ok(buckets.buckets.some(x=>x.name===bucket.bucket_name))
 const domain=await cf('/workers/subdomain'),origin='https://'+worker+'.'+domain.subdomain+'.workers.dev'
 console.log(JSON.stringify({deployed:true,worker,databaseId:db.id,database:database.name,bucket:bucket.bucket_name,origin,account}))
 const session=await hostedSession(origin,env)
 if(process.env.EVIDENCE_OWN_DIAGNOSTICS==='1')closeDiagnostics=await archiveDiagnostics(cf,worker,clean)
 const archive=join(env.EVIDENCE_OWN_ARTIFACTS,'source.evidence'),deadline=Date.now()+90*60000
 while(true){try{await stat(archive);break}catch(error){if(error.code!=='ENOENT')throw error;if(Date.now()>deadline)throw Error('Ubuntu local archive did not become available');await new Promise(resolve=>setTimeout(resolve,10000))}}
 await restoreLocalArchive(session,env.EVIDENCE_OWN_ARTIFACTS)
}finally{
 try{if(closeDiagnostics)await closeDiagnostics()}catch(error){console.log('Diagnostic stream cleanup: '+clean(error.message))}
 // The CLI owns these exact disposable resources, including partial deployments.
 try{await rer(['--remove','--yes']);console.log(JSON.stringify({cleanup:true,worker,deployed}))}catch(error){console.log('CLEANUP FAILED: '+clean(error.message));throw error}
}
