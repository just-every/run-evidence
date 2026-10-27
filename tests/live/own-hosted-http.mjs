import assert from 'node:assert/strict'
import {readFile,writeFile} from 'node:fs/promises'
import {join} from 'node:path'
import {readArchive} from '../helpers/portable-journey.mjs'

export async function hostedSession(origin,env){
 let cookie=''
 const request=async(path,{body,method=body===undefined?'GET':'POST',headers={}}={})=>{
  const response=await fetch(origin+path,{method,redirect:'manual',headers:{origin,...(cookie?{cookie}:{}),...(body===undefined?{}:{'content-type':'application/json'}),...headers},...(body===undefined?{}:{body:typeof body==='string'||body instanceof Uint8Array?body:JSON.stringify(body)})})
  const values=response.headers.getSetCookie();if(values.length)cookie=values.map(x=>x.split(';')[0]).join('; ')
  return response
 }
 const json=async(path,body,status=200,headers={})=>{const r=await request(path,{body,headers});assert.equal(r.status,status,await r.clone().text());return r.json()}
 const since=new Date().toISOString()
 await json('/auth/magic-link',{email:env.TEST_MAIL_TO},202)
 let token
 for(let attempt=0;attempt<24&&!token;attempt++){
  const url=new URL('https://rer-qa-inbox.runeditrun.workers.dev/receipts')
  for(const [k,v] of Object.entries({to:env.TEST_MAIL_TO,since,limit:'50'}))url.searchParams.set(k,v)
  const r=await fetch(url,{headers:{authorization:'Bearer '+env.QA_INBOX_RECEIPT_TOKEN}});assert.equal(r.status,200)
  for(const row of (await r.json()).receipts){
   const raw=await fetch('https://rer-qa-inbox.runeditrun.workers.dev'+row.rawUrl,{headers:{authorization:'Bearer '+env.QA_INBOX_RECEIPT_TOKEN}});assert.equal(raw.status,200)
   const mime=(await raw.text()).replace(/=\r?\n/g,'').replace(/=3D/g,'=').replaceAll('&amp;','&')
   const match=mime.match(/https?:\/\/[^\s"<>]+\/auth\/confirm\?token=([A-Za-z0-9_-]+)/)
   if(match&&match[0].startsWith(origin+'/')){token=match[1];console.log(JSON.stringify({hostedSignInReceipt:row.id,receivedAt:row.receivedAt}));break}
  }
  if(!token)await new Promise(resolve=>setTimeout(resolve,5000))
 }
 assert.ok(token,'controlled inbox must receive the hosted sign-in link')
 const confirmed=await request('/auth/confirm',{body:{token}});assert.equal(confirmed.status,303)
 const setup=await request('/setup',{body:'confirm=yes',headers:{'content-type':'application/x-www-form-urlencoded'}});assert.equal(setup.status,303)
 return {origin,request,json}
}

export async function restoreLocalArchive(app,directory){
 const source=join(directory,'source.evidence'),journal=JSON.parse(await readFile(join(directory,'source-journal.json'),'utf8'))
 const expected=await readArchive(source),before=await app.json('/api/archive/manifest')
 assert.equal(before.counts.controls,0);assert.equal(before.available,0)
 const upload=await app.json('/api/archive/uploads',{},201),bytes=await readFile(source)
 for(let offset=0,ordinal=0;offset<bytes.length;offset+=1024*1024,ordinal++)await app.json(`/api/archive/uploads/${upload.id}/chunks/${ordinal}`,bytes.subarray(offset,offset+1024*1024),200,{'content-type':'application/octet-stream'})
 const dry=await app.json(`/api/archive/uploads/${upload.id}/validate`,{journal})
 assert.deepEqual(dry.counts,expected.counts);assert.equal(dry.bytes,expected.bytes)
 const result=await app.json(`/api/archive/uploads/${upload.id}/restore`,{journal},200,{'x-evidence-confirm':'restore'})
 assert.deepEqual(result.counts,expected.counts);assert.equal(result.bytes,expected.bytes)
 const response=await app.request('/api/archive/export');assert.equal(response.status,200)
 const target=join(directory,'hosted.evidence');await writeFile(target,Buffer.from(await response.arrayBuffer()),{mode:0o600})
 const actual=await readArchive(target)
 for(const [table,count] of Object.entries(expected.counts)){
  if(table==='product_audit'){assert.ok(actual.counts[table]>=count);continue}
  assert.equal(actual.counts[table],count,table+' row count');assert.equal(actual.rows[table],expected.rows[table],table+' exact records')
 }
 assert.deepEqual(actual.files,expected.files);assert.equal(actual.bytes,expected.bytes)
 // Audit rows include the destination's own authentication and restore actions;
 // every immutable source audit row must still occur byte for byte in the archive.
 const auditRows=buffer=>{let at=Buffer.byteLength('EVIDENCE-ARCHIVE\n'),rows=[];while(at<buffer.length){const size=buffer.readUInt32BE(at);at+=4;const frame=JSON.parse(buffer.subarray(at,at+size));at+=size;if(frame.type==='rows'&&frame.table==='product_audit')rows.push(...frame.rows)}return new Map(rows.map(row=>[row.id,JSON.stringify(row)]))}
 const from=auditRows(bytes),to=auditRows(await readFile(target));for(const [id,row] of from)assert.equal(to.get(id),row,'source audit row preserved')
 console.log(JSON.stringify({hostedRestore:true,tables:Object.keys(expected.counts).length,records:Object.values(expected.counts).reduce((a,b)=>a+b,0),originalBytes:expected.bytes,sourceAuditRows:from.size,everyRecordAndByteReconciled:true}))
}
