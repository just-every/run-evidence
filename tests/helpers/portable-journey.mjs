import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { createReadStream,createWriteStream } from 'node:fs'
import { open,writeFile,rm,copyFile,stat } from 'node:fs/promises'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { portableFixture } from './portable-fixture.mjs'
const MAGIC_BYTES=Buffer.byteLength('EVIDENCE-ARCHIVE\n')
const hash=()=>createHash('sha256')
const digest=b=>hash().update(b).digest('hex')
const normal=(table,row)=>Object.fromEntries(Object.entries(row).map(([k,v])=>[k,table==='review_folders'&&k==='closed_at'?'closed':['connections','tracker_destinations','followup_channels'].includes(table)&&k==='status'?'inactive after restore':table==='connections'&&k==='next_attempt_at'?null:table==='agent_door_agents'&&k==='revoked'?'revoked after restore':v]))
// skip: audit entry ids of the destination's own sign-in (LOG-001), which a
// restored installation records before the source history it receives.
async function readArchive(path,skip=new Set()){
 const fd=await open(path),size=(await fd.stat()).size;let at=MAGIC_BYTES,header,fileHash,fileBytes=0,bytes=0,count=0;const rows={},counts={},files={},h=hash()
 const read=async n=>{const b=Buffer.alloc(n);let offset=0;while(offset<n){const r=await fd.read(b,offset,n-offset,at);if(!r.bytesRead)throw Error('truncated portable file');offset+=r.bytesRead;at+=r.bytesRead}return b}
 try{while(at<size){const prefix=await read(4),body=await read(prefix.readUInt32BE(0)),f=JSON.parse(body);if(f.type==='end'){assert.equal(f.sha256,h.digest('hex'));assert.equal(f.bytes,bytes);assert.equal(f.rows,count);assert.equal(at,size);break}h.update(prefix).update(body);if(!header){header=f;for(const t of Object.keys(f.tables)){rows[t]=hash();counts[t]=0}}if(f.type==='rows')for(const row of f.rows){if(f.table==='product_audit'&&skip.has(row.id)){count++;continue}rows[f.table].update(JSON.stringify(normal(f.table,row))+'\n');counts[f.table]++;count++}if(f.type==='file'){if(f.file.available){fileHash=hash();fileBytes=0}files[f.file.object_key]={...f.file}}if(f.type==='file-part'){const b=Buffer.from(f.data,'base64');fileHash.update(b);fileBytes+=b.length}if(f.type==='file-end'){const file=Object.values(files).at(-1);assert.equal(fileHash.digest('hex'),file.sha256);assert.equal(fileBytes,file.size);bytes+=fileBytes}}
 return {header,counts,rows:Object.fromEntries(Object.entries(rows).map(([t,h])=>[t,h.digest('hex')])),files,bytes}
 }finally{await fd.close()}
}
async function initialFrame(path){const fd=await open(path);try{const first=Buffer.alloc(MAGIC_BYTES+4);await fd.read(first,0,first.length,0);const n=first.readUInt32BE(MAGIC_BYTES),header=Buffer.alloc(n);await fd.read(header,0,n,first.length);return Buffer.concat([first,header])}finally{await fd.close()}}
async function download(app,path){const response=await app.fetch('/api/archive/export');if(response.status!==200)assert.fail(await response.text());await pipeline(Readable.fromWeb(response.body),createWriteStream(path,{mode:0o600}))}
async function json(app,path,body,status=200,headers={}){const r=await app.fetch(path,{method:body===undefined?'GET':'POST',headers:{...(body===undefined?{}:{origin:app.origin,'content-type':'application/json'}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});assert.equal(r.status,status,await r.clone().text());return r.json()}
async function parts(app,id,path,start=0,stop=Infinity){let ordinal=0;for await(const chunk of createReadStream(path,{highWaterMark:1024*1024})){if(ordinal>=start&&ordinal<stop){const r=await app.fetch(`/api/archive/uploads/${id}/chunks/${ordinal}`,{method:'POST',headers:{origin:app.origin,'content-type':'application/octet-stream'},body:chunk});assert.equal(r.status,200,await r.text())}ordinal++}return ordinal}
async function empty(app){assert.equal((await app.db.prepare('SELECT count(*) AS n FROM controls').first()).n,0);assert.equal((await app.db.prepare('SELECT count(*) AS n FROM resources').first()).n,0);const bucket=await app.mf.getR2Bucket('EXHIBITS');assert.ok((await bucket.list()).objects.every(o=>o.key.startsWith('_portable/')))}
async function authFingerprint(app){const out=hash();for(const t of ['oa_operators','oa_sessions','oa_tokens','oa_bootstrap','oa_auth_settings','oa_identity_providers'])out.update(JSON.stringify((await app.db.prepare(`SELECT * FROM ${t} ORDER BY rowid`).all()).results));return out.digest('hex')}
async function stop(app){await app.mf.dispose();app.close=()=>rm(app.persistencePath,{recursive:true,force:true})}
export async function portableJourney({runtime,cli,dir}){
 let source,target,offline
 try{
  source=await runtime();await source.signin();const fixture=await portableFixture(source)
  await json(source,`/api/tests/${fixture.ids.test}/revisions`,{reason:'Retain precise remediation instructions',remediation:'Require MFA on each production administrator before verifying the next read.'})
  const connectors=[];for(const label of ['portable-first','portable-second'])connectors.push(await json(source,'/api/collectors',{label,reviewed:'yes'},201))
  const journal=await json(source,'/api/archive/journal'),journalPath=join(dir,'portable-journal.json');await writeFile(journalPath,JSON.stringify(journal))
  await source.db.prepare('CREATE TABLE future_portable_record(id TEXT PRIMARY KEY)').run();assert.equal((await source.fetch('/api/archive/export')).status,400);await source.db.prepare('DROP TABLE future_portable_record').run()
  const bucket=await source.mf.getR2Bucket('EXHIBITS');await bucket.put('future-namespace/retained','unregistered');assert.equal((await source.fetch('/api/archive/export')).status,400);await bucket.delete('future-namespace/retained')
  const path=join(dir,'portable-large.evidence');await download(source,path);const expected=await readArchive(path)
  assert.ok(expected.counts.resources>20000);assert.ok(expected.bytes>64*1024*1024);assert.ok(expected.counts.control_revisions&&expected.counts.custom_framework_revisions&&expected.counts.import_reviews&&expected.counts.agent_decisions)
  // The journal is an independently retained later recovery input. The erasure
  // operation itself is ERASE-001; this door proves its monotonic restore fence.
  target=await runtime({ownerEmail:'fence@portable.test'});await target.signin();const first=await initialFrame(path),later={...journal,sequence:journal.sequence+1}
  const direct=async header=>target.fetch('/api/archive/restore',{method:'POST',headers:{origin:target.origin,'content-type':'application/octet-stream','x-evidence-confirm':'restore','x-evidence-erasure-history':'unverified acknowledged',...header},body:first})
  let refused=await direct({'x-evidence-journal':JSON.stringify(later)});assert.equal(refused.status,400);assert.match((await refused.json()).error,/later source erasure journal/);await empty(target)
  refused=await direct({});assert.equal(refused.status,400);assert.match((await refused.json()).error,/later source erasure journal/);await empty(target);await target.close();target=null
  target=await runtime({ownerEmail:'receiver@portable.test'});await target.signin();const receiving=await authFingerprint(target),destinationAudit=new Set((await target.db.prepare("SELECT id FROM product_audit WHERE action LIKE 'auth.%'").all()).results.map(r=>r.id))
  assert.notEqual((await source.db.prepare('SELECT id FROM oa_operators WHERE role=\'owner\'').first()).id,(await target.db.prepare('SELECT id FROM oa_operators WHERE role=\'owner\'').first()).id)
  // A late digest failure has already staged every row and original, but must
  // admit none. The complete upload survives a Worker restart between chunks.
  const corrupt=join(dir,'portable-corrupt.evidence');await copyFile(path,corrupt);const fd=await open(corrupt,'r+');const pos=(await fd.stat()).size-3,b=Buffer.alloc(1);await fd.read(b,0,1,pos);b[0]=b[0]===97?98:97;await fd.write(b,0,1,pos);await fd.close()
  const bad=await json(target,'/api/archive/uploads',{},201);await parts(target,bad.id,corrupt);const failed=await json(target,`/api/archive/uploads/${bad.id}/validate`,{},400);assert.match(failed.error,/digest/);await empty(target);await target.fetch('/api/archive/uploads/'+bad.id,{method:'DELETE',headers:{origin:target.origin}})
  const upload=await json(target,'/api/archive/uploads',{},201);await parts(target,upload.id,path,0,20);await target.clock('2026-10-11T12:00:00Z');assert.equal((await json(target,'/api/archive/uploads/'+upload.id)).parts,20);await parts(target,upload.id,path,20)
  const dry=await json(target,`/api/archive/uploads/${upload.id}/validate`,{});assert.equal(dry.erasure_history,'unverified');assert.equal(dry.requires_latest_journal,true);await empty(target)
  const missingHistory=await json(target,`/api/archive/uploads/${upload.id}/restore`,{},400,{'x-evidence-confirm':'restore'});assert.match(missingHistory.error,/history unverified/);await empty(target)
  const restored=await json(target,`/api/archive/uploads/${upload.id}/restore`,{journal},200,{'x-evidence-confirm':'restore'});assert.equal(restored.bytes,expected.bytes);assert.deepEqual(restored.counts,expected.counts);assert.equal(await authFingerprint(target),receiving)
  // Retain exact agent history while deliberately revoking restored authority.
  const agents=(await json(target,'/agents/api/agents')).agents
  assert.equal(agents.find(agent=>agent.id===fixture.ids.agentToken)?.revoked,true)
  assert.ok(agents.every(agent=>agent.revoked))
  const agentState=await json(target,'/agents/api/state')
  assert.equal(agentState.paused.local,true);assert.equal(agentState.policy.complete,false)
  const actualPath=join(dir,'portable-http-roundtrip.evidence');await download(target,actualPath);assert.ok(destinationAudit.size>0);const actual=await readArchive(actualPath,destinationAudit);assert.deepEqual(actual.rows,expected.rows);assert.deepEqual(actual.files,expected.files)
  for(const file of fixture.files){
   const r=await target.fetch(file.url)
   if(file.kind==='import'){
    // Import custody stays bound to its original owner identity. The receiving
    // owner can recover the original through the archive without inheriting
    // authority to read or operate the historical import itself.
    assert.equal(r.status,403,file.kind)
    const retained=actual.files[file.object_key]
    assert.equal(retained.available,true)
    assert.equal(retained.sha256,file.sha256)
    assert.equal(retained.size,file.size)
    continue
   }
   assert.equal(r.status,200,file.kind);const h=hash();let size=0;for await(const c of r.body){h.update(c);size+=c.length}assert.equal(h.digest('hex'),file.sha256,file.kind);assert.equal(size,file.size)
  }
  const messages=target.messages.length,followups=(await target.db.prepare('SELECT count(*) AS n FROM followups').first()).n;await target.tick();assert.equal(target.messages.length,messages);assert.equal((await target.db.prepare('SELECT count(*) AS n FROM followups').first()).n,followups)
  // Fresh private-collector tokens still cannot execute until that one subject
  // is reauthorized. Authorizing it leaves the other connector and mail inert.
  const rotated=[];for(const c of connectors)rotated.push(await json(target,`/api/collectors/${c.id}/rotate`,{}))
  const report=async(i,token)=>target.fetch(`/collectors/${connectors[i].id}/observations`,{method:'POST',headers:{origin:target.origin,cookie:'',authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify({revision:'private-git/v1',outcome:'failed',observedAt:'2026-10-11T12:00:00.000Z',error:'repository_unreadable'})})
  assert.equal((await report(0,rotated[0].token)).status,401);await json(target,'/api/archive/reauthorize',{capability:'collections',subject:connectors[0].id});assert.equal((await report(0,rotated[0].token)).status,202);assert.equal((await report(1,rotated[1].token)).status,401)
  assert.ok((await json(target,'/api/archive/capabilities')).capabilities.some(c=>c.capability==='mail'&&c.authorized_at===null));assert.equal(target.messages.length,messages)
  const sourceState=source.persistencePath;await stop(source);await stop(target)
  const config=join(dir,'portable-wrangler.jsonc');await writeFile(config,JSON.stringify({name:'portable-proof',compatibility_date:'2026-09-08',compatibility_flags:['nodejs_compat'],d1_databases:[{binding:'DB',database_name:'evidence-tests',database_id:'evidence-tests'}],r2_buckets:[{binding:'EXHIBITS',bucket_name:'exhibits'}]}))
  const cliPath=join(dir,'portable-cli.evidence'),exported=await cli(['export','--output',cliPath,'--state',sourceState,'--config',config]);assert.equal(exported.code,0,exported.error);const cliSource=await readArchive(cliPath);assert.deepEqual(cliSource.rows,expected.rows);assert.deepEqual(cliSource.files,expected.files)
  offline=await runtime({ownerEmail:'offline-receiver@portable.test'});await offline.signin();const state=offline.persistencePath,offlineAudit=new Set((await offline.db.prepare("SELECT id FROM product_audit WHERE action LIKE 'auth.%'").all()).results.map(r=>r.id));await stop(offline)
  const flags=['--input',cliPath,'--state',state,'--config',config]
  const check=await cli(['restore',...flags,'--dry-run']);assert.equal(check.code,0,check.error);assert.equal(JSON.parse(check.output).erasure_history,'unverified')
  const denied=await cli(['restore',...flags,'--yes']);assert.equal(denied.code,1);assert.match(denied.error,/history unverified/)
  const admitted=await cli(['restore',...flags,'--yes','--journal',journalPath]);assert.equal(admitted.code,0,admitted.error)
  const roundtrip=join(dir,'portable-cli-roundtrip.evidence'),again=await cli(['export','--output',roundtrip,'--state',state,'--config',config]);assert.equal(again.code,0,again.error);assert.ok(offlineAudit.size>0);const last=await readArchive(roundtrip,offlineAudit);assert.deepEqual(last.rows,expected.rows);assert.deepEqual(last.files,expected.files)
  console.log(JSON.stringify({portable_native_resources:expected.counts.resources,portable_actual_original_bytes:expected.bytes,portable_tables:Object.keys(expected.counts).length,http_roundtrip:true,offline_cli_roundtrip:true,late_corruption_refused:true,known_later_erasure_refused:true,selective_collection_reauthorization:true}))
 }finally{await source?.close();await target?.close();await offline?.close()}
}
export { readArchive }
