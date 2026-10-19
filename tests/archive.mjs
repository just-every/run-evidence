process.env.RER_SERVER_JOURNEY='1'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { mkdtemp,readFile,writeFile,readdir,rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { spawn } from 'node:child_process'
import { runtime } from './helpers/runtime.mjs'
const require=createRequire(import.meta.url),dependency=createRequire(require.resolve('wrangler/package.json'))
const {unstable_splitSqlQuery}=dependency('wrangler')
const digest=bytes=>createHash('sha256').update(bytes).digest('hex')
const magic=Buffer.from('EVIDENCE-ARCHIVE\n'),u32=n=>{const b=Buffer.alloc(4);b.writeUInt32BE(n);return b}
function decode(bytes){let at=magic.length;const length=bytes.readUInt32BE(at);at+=4;const envelope=JSON.parse(bytes.subarray(at,at+length));at+=length;const manifest=JSON.parse(envelope.manifest),entries=[];while(at<bytes.length){const n=bytes.readUInt32BE(at);at+=4;const path=bytes.subarray(at,at+n).toString();at+=n;const size=bytes.readUInt32BE(at);at+=4;entries.push({path,bytes:bytes.subarray(at,at+size)});at+=size}return{envelope,manifest,entries}}
function encode(data,stale=false){const text=JSON.stringify(data.manifest),envelope=Buffer.from(JSON.stringify({manifest:text,sha256:stale?data.envelope.sha256:digest(text)}));return Buffer.concat([magic,u32(envelope.length),envelope,...data.entries.flatMap(e=>[u32(Buffer.byteLength(e.path)),Buffer.from(e.path),u32(e.bytes.length),e.bytes])])}
const tableNames=['controls','requirements','exhibits','receipts','receipt_actors','review_folders','review_folder_controls','review_events']
const rows=async(app,table)=>(await app.db.prepare(`SELECT * FROM ${table} ORDER BY 1${table==='review_folder_controls'?',2':''}`).all()).results
const snapshot=async app=>Object.fromEntries(await Promise.all(tableNames.map(async t=>[t,await rows(app,t)])))
const assertEmpty=async app=>{for(const t of tableNames)assert.equal((await rows(app,t)).length,0,t+' remains empty');assert.equal((await(await app.mf.getR2Bucket('EXHIBITS')).list()).objects.length,0)}
const restore=(app,bytes,dry=false)=>app.fetch('/api/archive/restore'+(dry?'?dry-run=1':''),{method:'POST',headers:{origin:app.origin,'content-type':'application/octet-stream','x-evidence-confirm':'restore'},body:bytes})
const createControl=async(app,name)=>{const res=await app.fetch('/app/controls',{method:'POST',headers:{origin:app.origin,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({name,group:'Access',proof:'Dated proof',cadence:'daily'})});assert.equal(res.status,303);return res.headers.get('location').split('/').at(-1)}
const upload=async(app,id,bytes,supersedes)=>{const form=new FormData();Object.entries({source:'archive source',covered_from:'2026-10-11',covered_to:'2026-10-11',...(supersedes?{supersedes}:{})}).forEach(([k,v])=>form.set(k,v));form.set('file',new File([bytes],'proof.html',{type:'text/html'}));const res=await app.fetch('/app/requirements/'+id+'/uploads',{method:'POST',headers:{origin:app.origin},body:form});assert.equal(res.status,303);return(await app.fetch(res.headers.get('location').replace('/app/','/api/'))).json()}
const stopForCLI=async app=>{await app.mf.dispose();app.close=()=>rm(app.persistencePath,{recursive:true,force:true})}
const cli=async args=>new Promise((resolve,reject)=>{const child=spawn(process.execPath,['scripts/archive.mjs',...args],{stdio:['ignore','pipe','pipe'],env:{...process.env,WRANGLER_SEND_METRICS:'false'}});let output='',error='';child.stdout.on('data',c=>output+=c);child.stderr.on('data',c=>error+=c);child.on('error',reject);child.on('exit',code=>resolve({code,output,error}))})
let app,target,dir,passed=0
const scenario=async(name,fn)=>{await fn();passed++;console.log('PASS '+name)}
try{
 dir=await mkdtemp(join(tmpdir(),'evidence-archive-proof-'))
 app=await runtime({migrationThrough:'0007'});await app.signin()
 let first,second,third,missing,raw,parsed,before,reviewPath
 await scenario('Prior r1 records and bytes survive additive migration and retain immutable facts',async()=>{
  const a=await createControl(app,'Access review'),b=await createControl(app,'Vendor review'),c=await createControl(app,'Data review')
  first=await upload(app,a,Buffer.alloc(2*1024*1024,11));second=await upload(app,a,Buffer.alloc(2*1024*1024,12),first.id);third=await upload(app,b,Buffer.alloc(2*1024*1024,13));missing=await upload(app,c,'missing original')
  const old=Object.fromEntries(await Promise.all(['controls','requirements','exhibits','receipts'].map(async t=>[t,await rows(app,t)])))
  for(const file of (await readdir('migrations/core')).filter(f=>f.endsWith('.sql') && f.slice(0,4)>'0007' && !/^00(1\d|2\d)_/.test(f)).sort())await app.db.batch(unstable_splitSqlQuery(await readFile(join('migrations/core',file),'utf8')).map(sql=>app.db.prepare(sql)))
  for(const [table,data]of Object.entries(old))assert.deepEqual(await rows(app,table),data)
  for(const r of [first,second,third,missing]){const response=await app.fetch('/api/receipts/'+r.id+'/download');assert.equal(response.status,200);assert.equal(digest(Buffer.from(await response.arrayBuffer())),r.sha256)}
  await assert.rejects(app.db.prepare('UPDATE receipts SET source=?').bind('changed').run(),/immutable_receipt/)
  await assert.rejects(app.db.prepare('DELETE FROM exhibits').run(),/immutable_exhibit/)
  // New native uploads still establish provenance through the migrated FK.
  await upload(app,c,'additional proof')
 })
 await scenario('Owner archive doors enforce native authentication and same-origin host boundary',async()=>{
  for(const path of ['/app/archive','/api/archive/manifest','/api/archive/export','/api/archive/restore']){
   const options=path.endsWith('restore')?{method:'POST',headers:{cookie:'',origin:app.origin}}:{headers:{cookie:''}}
   assert.equal((await app.fetch(path,options)).status,401)
   for(const headers of [{host:'evil.test'},{origin:'https://evil.test'},{'sec-fetch-site':'cross-site'}])assert.equal((await app.fetch(path,{headers})).status,403)
  }
  assert.equal((await app.fetch('/api/archive/restore',{method:'POST'})).status,403)
 })
 await scenario('Streamed archive retains every receipt and event; explicitly inventories missing bytes',async()=>{
  const controls=await rows(app,'controls')
  const issued=await app.fetch('/api/folders',{method:'POST',headers:{origin:app.origin,'content-type':'application/json'},body:JSON.stringify({reviewer_label:'Independent reviewer',period_from:'2026-10-11',period_to:'2026-10-11',expires_at:'2026-10-20T00:00:00Z',control_ids:controls.slice(0,2).map(c=>c.id)})});assert.equal(issued.status,201)
  const grant=await issued.json();reviewPath=new URL(grant.review_url).pathname
  for(const suffix of ['','/exhibits'])assert.equal((await app.fetch(reviewPath+suffix,{headers:{cookie:''}})).status,200)
  assert.equal((await app.fetch(reviewPath+'/receipts/unknown',{headers:{cookie:''}})).status,404)
  await(await app.mf.getR2Bucket('EXHIBITS')).delete(missing.object_key)
  before=await snapshot(app)
  const response=await app.fetch('/api/archive/export');assert.equal(response.status,200);assert.match(response.headers.get('content-disposition'),/^attachment/)
  const chunks=[];let total=0,firstChunk=0
  for await(const chunk of response.body){if(!chunks.length)firstChunk=chunk.length;chunks.push(Buffer.from(chunk));total+=chunk.length}
  assert.ok(chunks.length>3);assert.ok(firstChunk<total);assert.ok(total>first.size*2);raw=Buffer.concat(chunks);parsed=decode(raw)
  assert.equal(digest(parsed.envelope.manifest),parsed.envelope.sha256)
  assert.equal(parsed.manifest.rows.receipts.length,5);assert.deepEqual(parsed.manifest.rows.receipts,before.receipts)
  assert.ok(!parsed.envelope.manifest.includes('token_hash'));assert.ok(!parsed.envelope.manifest.includes(grant.review_url.split('/').at(-1)))
  assert.equal(parsed.manifest.files.filter(f=>!f.available).length,1);assert.equal(parsed.entries.length,4)
  for(const e of parsed.entries){const f=parsed.manifest.files.find(f=>f.path===e.path);assert.equal(digest(e.bytes),f.sha256);assert.equal(e.bytes.length,f.size)}
  const dry=await(await app.fetch('/api/archive/export?dry-run=1')).json();assert.equal(dry.available,4);assert.equal(dry.missing.length,1)
  console.log(JSON.stringify({stream_chunks:chunks.length,first_chunk:firstChunk,total_bytes:total,receipts:5,files:5,present:4,missing:1,view_events:before.review_events.length}))
 })
 target=await runtime();await target.signin()
 await scenario('All malformed archives refuse before any domain or bucket writes',async()=>{
  const cases=[
   ['manifest digest',d=>{d.manifest.created_at='2026-10-10T00:00:00Z'},true],['version',d=>{d.manifest.version=Number.MAX_SAFE_INTEGER}],
   ...['/absolute','files/../escape','C:drive','files\\escape','manifest'].map(path=>['unsafe '+path,d=>{d.manifest.files[0].path=path;d.entries[0].path=path}]),
   ['duplicate manifest path',d=>{d.manifest.files[1].path=d.manifest.files[0].path}],
   ['repeated entry',d=>{d.entries[1].path=d.entries[0].path}],
   ['file mismatch',d=>{d.entries.at(-1).bytes=Buffer.from('tampered')}],
   ['same-size digest mismatch',d=>{d.entries.at(-1).bytes=Buffer.alloc(d.entries.at(-1).bytes.length,27)}],
   ['metadata contradiction',d=>{d.manifest.rows.receipts[0].sha256='a'.repeat(64)}],
   ['receipt relationship',d=>{d.manifest.rows.receipts[0].requirement_id='unknown'}],
   ['duplicate receipt',d=>{d.manifest.rows.receipts.push(d.manifest.rows.receipts[0])}],
   ['missing entry',d=>{d.entries.pop()}],['extra entry',d=>{d.entries.push({path:'files/extra',bytes:Buffer.from('extra')})}],
   ['grant metadata injection',d=>{d.manifest.rows.review_folders[0].token_hash='forbidden'}],
  ]
  for(const [name,mutate,stale]of cases){const d=decode(raw);mutate(d);const response=await restore(target,encode(d,stale));assert.equal(response.status,400,name);assert.equal(typeof(await response.json()).error,'string');await assertEmpty(target)}
  assert.equal((await restore(target,raw.subarray(0,raw.length-1))).status,400);await assertEmpty(target)
  console.log('Malformed archives refused: '+(cases.length+1))
 })
 await scenario('Nonempty database and orphan bucket each refuse with no added business data',async()=>{
  assert.equal((await restore(app,raw)).status,400);assert.deepEqual(await snapshot(app),before)
  const bucket=await target.mf.getR2Bucket('EXHIBITS');await bucket.put('orphan','orphan');assert.equal((await restore(target,raw)).status,400);assert.equal((await bucket.list()).objects.length,1);await bucket.delete('orphan');await assertEmpty(target)
 })
 await scenario('Failed atomic D1 admission cleans its own verified bucket writes',async()=>{
  await target.db.prepare("CREATE TRIGGER archive_test_refusal BEFORE INSERT ON controls BEGIN SELECT RAISE(ABORT,'test admission failure'); END").run()
  assert.equal((await restore(target,raw)).status,503);await assertEmpty(target)
  await target.db.prepare('DROP TRIGGER archive_test_refusal').run()
 })
 await scenario('Dry-run is read-only; restore preserves exact receipts, bytes and logs with permanently closed folders',async()=>{
  const dry=await restore(target,raw,true);assert.equal(dry.status,200,await dry.clone().text());await assertEmpty(target)
  const ownersBefore=(await target.db.prepare('SELECT * FROM oa_operators ORDER BY id').all()).results
  const response=await restore(target,raw);assert.equal(response.status,200,await response.clone().text())
  const after=await snapshot(target)
  for(const table of tableNames.filter(t=>t!=='review_folders'))assert.deepEqual(after[table],before[table],table)
  assert.deepEqual((await target.db.prepare('SELECT * FROM oa_operators ORDER BY id').all()).results,ownersBefore)
  assert.ok(after.review_folders.every(f=>f.closed_at && f.token_hash===null))
  for(const folder of after.review_folders){const old=before.review_folders.find(x=>x.id===folder.id);assert.deepEqual({...folder,closed_at:old.closed_at,token_hash:old.token_hash},old)}
  for(const file of parsed.manifest.files){const exhibit=before.exhibits.find(e=>e.id===file.exhibit_id),stored=await(await target.mf.getR2Bucket('EXHIBITS')).get(exhibit.object_key);if(file.available){assert.ok(stored);assert.equal(digest(Buffer.from(await stored.arrayBuffer())),file.sha256)}else assert.equal(stored,null)}
  assert.equal((await target.fetch(reviewPath,{headers:{cookie:''}})).status,404)
  assert.equal((await target.fetch('/api/receipts/'+missing.id+'/download')).status,410)
  assert.equal((await target.fetch('/api/desk')).status,200)
  await assert.rejects(target.db.prepare('UPDATE review_folders SET closed_at=NULL').run(),/closed_review_folder/)
  console.log(JSON.stringify({round_trip:Object.fromEntries(tableNames.map(t=>[t,before[t].length])),receipt_differences:0,present_file_digest_differences:0,auth_operator_differences:0}))
 })
 await scenario('Public local CLI exports and restores the same portable file with complete comparison',async()=>{
  const sourceState=app.persistencePath,targetState=target.persistencePath
  assert.ok(sourceState && targetState,'harness exposes local store path')
  // Release workerd locks before the public offline CLI opens each local store.
  await stopForCLI(app);await stopForCLI(target)
  const config=join(dir,'wrangler.jsonc');await writeFile(config,JSON.stringify({name:'archive-proof',compatibility_date:'2026-09-08',compatibility_flags:['nodejs_compat'],d1_databases:[{binding:'DB',database_name:'evidence-tests',database_id:'evidence-tests'}],r2_buckets:[{binding:'EXHIBITS',bucket_name:'exhibits'}]}))
  const output=join(dir,'archive.evidence')
  const exported=await cli(['export','--output',output,'--state',sourceState,'--config',config]);assert.equal(exported.code,0,exported.error)
  const cliData=decode(await readFile(output));assert.deepEqual(cliData.manifest.rows,parsed.manifest.rows)
  // A separately initialized empty local database, with its own native owner.
  const empty=await runtime();await empty.signin();const emptyState=empty.persistencePath;await stopForCLI(empty)
  try{
   const checked=await cli(['restore','--input',output,'--dry-run','--state',emptyState,'--config',config]);assert.equal(checked.code,0,checked.error)
   const restored=await cli(['restore','--input',output,'--yes','--state',emptyState,'--config',config]);assert.equal(restored.code,0,restored.error)
   const reexport=join(dir,'roundtrip.evidence');const exportedAgain=await cli(['export','--output',reexport,'--state',emptyState,'--config',config]);assert.equal(exportedAgain.code,0,exportedAgain.error)
   const result=decode(await readFile(reexport))
   for(const table of tableNames.filter(t=>t!=='review_folders'))assert.deepEqual(result.manifest.rows[table],cliData.manifest.rows[table])
   assert.deepEqual(result.entries.map(e=>[e.path,digest(e.bytes)]),cliData.entries.map(e=>[e.path,digest(e.bytes)]))
   assert.ok(result.manifest.rows.review_folders.every(f=>f.closed_at))
   console.log('CLI round trip: exact receipt rows and four present file digests; missing entry retained; folders closed.')
  }finally{await empty.close()}
 })
 console.log(`${passed} archive public-door scenarios passed.`)
}finally{await app?.close();await target?.close();if(dir)await rm(dir,{recursive:true,force:true})}
