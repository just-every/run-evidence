import { barrierStatements } from './capabilities'
/// <reference types="node" />
import { mkdtemp,writeFile,readFile,rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Bindings } from '../../auth.server'
import { MAGIC,Reader,decoder,encoder,sha,fail,MAX_METADATA,MAX_TOTAL,pathOK,columns,tables } from './format'
import { archiveFiles, extensionTables, validateExtensions, extensionStatements } from './extensions'
import { validateManifest } from './validate'
import { summary } from './inventory'
import { businessRows } from './registry'
type Store = Pick<Bindings,'DB'|'EXHIBITS'>
export async function emptyTarget(env:Store) {
 for(const table of [...tables,...extensionTables]) if((await env.DB.prepare(`SELECT ${businessRows(table,table)} AS n`).first<{n:number}>())!.n) fail('Restore requires an empty Evidence database. Destination authentication is allowed.')
 if((await env.EXHIBITS.list({limit:1})).objects.length) fail('Restore requires an empty exhibit bucket.')
}
export async function restoreArchive(env:Store, body:ReadableStream<Uint8Array>, dryRun=false, now=new Date(), maxTotal=MAX_TOTAL) {
 await emptyTarget(env)
 const reader = new Reader(body), staged = await mkdtemp(join(tmpdir(),'evidence-restore-'))
 const written:string[]=[]
 try {
  if(decoder.decode(await reader.read(MAGIC.length))!==decoder.decode(MAGIC)) fail('Not an Evidence custody archive.')
  const length=await reader.number(); if(length<1 || length>MAX_METADATA*2+1024) fail('Invalid manifest envelope size.')
  let envelope:unknown
  try { envelope=JSON.parse(decoder.decode(await reader.read(length))) } catch { fail('Invalid manifest envelope.') }
  if(!envelope || typeof envelope!=='object' || !('manifest' in envelope) || typeof envelope.manifest!=='string' || !('sha256' in envelope) || typeof envelope.sha256!=='string' || Object.keys(envelope).sort().join(',')!=='manifest,sha256' || encoder.encode(envelope.manifest).length>MAX_METADATA || await sha(encoder.encode(envelope.manifest))!==envelope.sha256) fail('Manifest digest does not match.')
  let manifest:unknown
  try { manifest=JSON.parse(envelope.manifest) } catch { fail('Invalid manifest JSON.') }
  validateManifest(manifest)
  await validateExtensions(manifest)
  const files=archiveFiles(manifest)
  let total=0,index=0
  const seen = new Set(['manifest'])
  for(const file of files.filter(f=>f.available)) {
   const pathLength=await reader.number(); if(pathLength<1 || pathLength>500) fail('Invalid archive path length.')
   const path=decoder.decode(await reader.read(pathLength)); pathOK(path)
   if(seen.has(path)) fail('Duplicate archive entry.'); seen.add(path)
   if(path!==file.path) fail('Unexpected or missing archive entry.')
   const size=await reader.number(); if(size!==file.size) fail('File size does not match manifest.')
   total+=size; if(total>maxTotal) fail('Restore exceeds the 64 MiB local staging limit. No records were admitted.')
   const bytes=await reader.read(size); if(await sha(bytes)!==file.sha256) fail('File digest does not match immutable receipt.')
   await writeFile(join(staged,String(index++)),bytes,{mode:0o600})
  }
  await reader.end()
  if(dryRun) return { ...summary(manifest), manifest_sha256:envelope.sha256, dry_run:true }
  await emptyTarget(env)
  index=0
  for(const file of files.filter(f=>f.available)) {
   const key=file.object_key
   const bytes=await readFile(join(staged,String(index++)))
   const result=await env.EXHIBITS.put(key,bytes,{onlyIf:{etagDoesNotMatch:'*'},httpMetadata:{contentType:'application/octet-stream'}})
   if(!result) fail('Exhibit bucket changed during restore; admission refused.')
   written.push(key)
   const stored=await env.EXHIBITS.get(key)
   if(!stored || stored.size!==file.size || await sha(await stored.arrayBuffer())!==file.sha256) fail('Restored bytes could not be verified.')
  }
  const expected=new Set(written); let cursor:string|undefined, objectCount=0
  do {
   const bucket=await env.EXHIBITS.list({limit:1000,...(cursor ? {cursor} : {})})
   objectCount+=bucket.objects.length
   if(bucket.objects.some(o=>!expected.has(o.key))) fail('Exhibit bucket changed during restore; admission refused.')
   cursor=bucket.truncated ? bucket.cursor : undefined
  } while(cursor)
  if(objectCount!==written.length) fail('Exhibit bucket changed during restore; admission refused.')
  // D1 batch is transactional. Check emptiness again inside that transaction,
  // so a concurrent upload/control creation cannot admit a mixed installation.
  // Sums grouped by ten keep the expression within SQLite's depth limit.
  const counts=[...tables,...extensionTables].map(t=>businessRows(t,t)), groups:string[]=[]
  for(let i=0;i<counts.length;i+=10) groups.push('('+counts.slice(i,i+10).join('+')+')')
  const statements=[env.DB.prepare(`INSERT INTO custody_admission(singleton,empty_check) VALUES(1,CASE WHEN (${groups.join('+')})=0 THEN 1 ELSE 0 END)`)]
  for(const table of tables) for(const row of manifest.rows[table]) {
   const values=columns[table].map(c=>table==='review_folders' && c==='closed_at' ? row[c] || now.toISOString() : row[c])
   statements.push(env.DB.prepare(`INSERT INTO ${table}(${columns[table].join(',')}) VALUES(${columns[table].map(()=>'?').join(',')})`).bind(...values))
  }
  statements.push(...extensionStatements(env,manifest))
  // Self-referential receipt foreign keys are checked at transaction completion.
  statements.splice(1,0,env.DB.prepare('PRAGMA defer_foreign_keys=ON'))
  statements.push(...barrierStatements(env),env.DB.prepare('DELETE FROM custody_admission'))
  await env.DB.batch(statements)
  written.length=0
  return {...summary(manifest),manifest_sha256:envelope.sha256,dry_run:false,folders_closed:manifest.rows.review_folders.length}
 } catch(error) {
  if(written.length) {
   try { for(let offset=0;offset<written.length;offset+=1000) await env.EXHIBITS.delete(written.slice(offset,offset+1000)); for(const key of written) if(await env.EXHIBITS.head(key)) fail('Restore cleanup could not be verified.') }
   catch { fail('Restore failed and exhibit cleanup failed. No business rows were admitted; remove the reported restore objects before retrying.') }
  }
  throw error
 } finally { await reader.close(); await rm(staged,{recursive:true,force:true}) }
}
