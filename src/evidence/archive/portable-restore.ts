import { fail,pathOK,Reader } from './format'
import { assertSchema,portableTables,registry,quote,staged,type Store } from './registry'
import { backfillRunLibraryRevisions,libraryTables } from './program'
import { frame,newHash,readFrame,objectDigest } from './framing'
import { BlobStage } from './blob-stage'
import { createStages,stageRows,validateForeignKeys } from './staging'
import { validateRelationships } from './relationships'
import { emptyPortableTarget,cleanupSession,type Session } from './sessions'
import { checkHistory,type SourceLineage } from './journal'
import { barrierStatements } from './capabilities'
import { importRestoreTriggers } from '../import/archive-schema'
import { fileQuery,assertBucket } from './files'
export interface RestoreOptions {journal?:unknown;acceptUnverifiedHistory?:boolean}
export async function decodePortable(env:Store,session:Session,reader:Reader,first:{data:any;bytes:Uint8Array;prefix:Uint8Array},options:RestoreOptions={}) {
 const head=first.data
 if(head?.format!=='evidence-custody'||head.version!==10||!head.source||typeof head.source.lineage!=='string'||! /^[a-zA-Z0-9_-]{16,128}$/.test(head.source.lineage)||!Number.isSafeInteger(head.source.sequence)||head.source.sequence<0||!Number.isSafeInteger(head.source.generation)||!Number.isFinite(Date.parse(head.created_at))||![[],libraryTables,[...libraryTables,'inventory_decisions','inventory_group_events']].some(absent => JSON.stringify(head.tables)===JSON.stringify(Object.fromEntries(Object.entries(registry).filter(([t]) => !absent.includes(t))))))fail('Unsupported or incomplete portable archive registry.')
 const sourceTables=Object.keys(head.tables)
 await checkHistory(env,head.source,options.journal,options.acceptUnverifiedHistory)
 await env.DB.prepare("UPDATE portable_sessions SET state='validating',header=?,error=NULL WHERE id=?").bind(JSON.stringify(head),session.id).run()
 await cleanupSession(env,session.id,false);await createStages(env,session.id)
 const hash=newHash().update(first.prefix).update(first.bytes);let tableIndex=-1,current='',rowCount=0,fileCount=0,total=0,blob:BlobStage|null=null,activeFile:any=null,filesStarted=false
 const counts=Object.fromEntries(portableTables.map(t=>[t,0]));let available=0,missingCount=0;const missing:any[]=[]
 try{
  for(;;){const {data:f,bytes,prefix}=await readFrame(reader)
   if(f?.type==='end'){
    if(blob||tableIndex!==sourceTables.length-1||f.rows!==rowCount||f.files!==fileCount||f.bytes!==total||f.sha256!==hash.digest('hex'))fail('Archive end frame or complete-stream digest does not match.')
    await reader.end();break
   }
   hash.update(prefix).update(bytes)
   if(f?.type==='table') {if(blob||filesStarted||f.table!==sourceTables[++tableIndex])fail('Archive table order is incomplete or duplicated.');current=f.table}
   else if(f?.type==='rows'){if(blob||filesStarted||!current||f.table!==current)fail('Unexpected archive rows.');await stageRows(env,session.id,current,f.rows);rowCount+=f.rows.length;counts[current]+=f.rows.length}
   else if(f?.type==='journal'){
    if(filesStarted||tableIndex!==sourceTables.length-1||!Array.isArray(f.rows)||f.rows.length>128)fail('Invalid source erasure journal page.')
    for(const r of f.rows)if(!r||r.lineage!==head.source.lineage||!Number.isSafeInteger(r.sequence)||r.sequence<1||r.sequence>head.source.sequence||typeof r.recorded_at!=='string'||!Number.isFinite(Date.parse(r.recorded_at))||typeof r.receipt!=='string'||!r.receipt||r.receipt.length>1024)fail('Invalid source erasure journal receipt.')
    await env.DB.prepare("INSERT INTO portable_journal_stage(session_id,lineage,sequence,recorded_at,receipt) SELECT ?,json_extract(value,'$.lineage'),json_extract(value,'$.sequence'),json_extract(value,'$.recorded_at'),json_extract(value,'$.receipt') FROM json_each(?)").bind(session.id,JSON.stringify(f.rows)).run()
   }
   else if(f?.type==='file'){
    if(blob||tableIndex!==sourceTables.length-1)fail('Original bytes arrived before all tables.');filesStarted=true;const f0=f.file
    if(!f0||typeof f0.available!=='boolean'||!Number.isSafeInteger(f0.size)||f0.size<1||f0.size>20*1024*1024||typeof f0.sha256!=='string'||! /^[a-f0-9]{64}$/.test(f0.sha256)||(!f0.available&&(typeof f0.reason!=='string'||!f0.reason||f0.reason.length>300)))fail('Invalid original file inventory.')
    pathOK(f0.object_key);pathOK(f0.path);const bound=f0.path.startsWith('populations/')?5*1024*1024:f0.path.startsWith('import-sources/')?20*1024*1024:10*1024*1024;if(f0.size>bound)fail('Original exceeds its record-class size limit.');if(f0.object_key.startsWith('_portable/'))fail('Reserved object namespace.')
    const expected=await env.DB.prepare(`SELECT * FROM (${fileQuery(session.id)}) WHERE object_key=?`).bind(f0.object_key).first<{path:string;size:number;sha256:string}>()
    if(!expected||expected.path!==f0.path||expected.size!==f0.size||expected.sha256!==f0.sha256)fail('Original file contradicts its custody record.')
    const key=f0.available?`_portable/${session.id}/files/${fileCount}`:null
    await env.DB.prepare('INSERT INTO portable_files(session_id,ordinal,object_key,size,sha256,available,reason,staged_key) VALUES(?,?,?,?,?,?,?,?)').bind(session.id,fileCount++,f0.object_key,f0.size,f0.sha256,f0.available?1:0,f0.reason??null,key).run()
    if(f0.available){available++;activeFile=f0;blob=new BlobStage(env,key!,f0.size,f0.sha256);const uploadId=await blob.start();await env.DB.prepare('UPDATE portable_files SET upload_id=? WHERE session_id=? AND ordinal=?').bind(uploadId,session.id,fileCount-1).run()}else{missingCount++;if(missing.length<100)missing.push(f0)}
   }else if(f?.type==='file-part'){if(!blob)fail('Unlisted original byte frame.');await blob.part(f.index,f.data)}
   else if(f?.type==='file-end'){if(!blob)fail('Unexpected original end frame.');await blob.finish(f.size);await env.DB.prepare('UPDATE portable_files SET upload_id=NULL WHERE session_id=? AND ordinal=?').bind(session.id,fileCount-1).run();total+=activeFile.size;blob=null;activeFile=null}
   else fail('Unknown portable archive frame.')
  }
  await validateForeignKeys(env,session.id);await validateRelationships(env,session.id)
  const history=await checkHistory(env,head.source,options.journal,options.acceptUnverifiedHistory)
  const result={counts,bytes:total,files:fileCount,available,missing,missing_count:missingCount,missing_truncated:missingCount>missing.length,manifest_sha256:first.data.version===10?newHash().update(first.bytes).digest('hex'):'',dry_run:true,...history,source:head.source}
  await env.DB.prepare("UPDATE portable_sessions SET state='validated',result=?,updated_at=? WHERE id=?").bind(JSON.stringify(result),new Date().toISOString(),session.id).run()
  return result
 }catch(error){await blob?.abort();await cleanupSession(env,session.id,false);await env.DB.prepare("UPDATE portable_sessions SET state='failed',error=? WHERE id=?").bind(error instanceof Error?error.message:'Archive validation failed.',session.id).run();throw error}
 finally{await reader.close()}
}
export async function admitPortable(env:Store,session:Session,options:RestoreOptions={},now=new Date()) {
 if(session.state!=='validated'||!session.header||!session.result)fail('Run a successful complete dry run before restoring.')
 await assertSchema(env);await emptyPortableTarget(env)
 const header=JSON.parse(session.header),history=await checkHistory(env,header.source,options.journal,options.acceptUnverifiedHistory)
 if(history.requires_latest_journal)fail('Erasure history unverified. Supply the latest source journal, or explicitly acknowledge that later erasures cannot be checked.')
 const lock=await env.DB.prepare("UPDATE portable_sessions SET state='restoring',updated_at=? WHERE id=? AND state='validated'").bind(now.toISOString(),session.id).run();if(!lock.meta.changes)fail('This archive restore is already being admitted.')
 let after=-1
 try{
  for(;;){const files=(await env.DB.prepare('SELECT ordinal,object_key,size,sha256,staged_key FROM portable_files WHERE session_id=? AND available=1 AND ordinal>? ORDER BY ordinal LIMIT 100').bind(session.id,after).all<{ordinal:number;object_key:string;size:number;sha256:string;staged_key:string}>()).results;if(!files.length)break
   for(const file of files){const object=await env.EXHIBITS.get(file.staged_key);if(!object||object.size!==file.size)fail('Validated staging bytes are no longer available.');const check=await objectDigest(object.body);if(check.sha256!==file.sha256)fail('Validated staging bytes changed.');await env.DB.prepare('UPDATE portable_files SET written=1 WHERE session_id=? AND ordinal=?').bind(session.id,file.ordinal).run();const stored=env.ARCHIVE_COPY?await env.ARCHIVE_COPY(file.staged_key,file.object_key,file.size,session.id):await env.EXHIBITS.put(file.object_key,(await env.EXHIBITS.get(file.staged_key))!.body,{onlyIf:{etagDoesNotMatch:'*'},customMetadata:{portable_session:session.id},httpMetadata:{contentType:'application/octet-stream'}});if(!stored)fail('The destination bucket changed during restore.')}
   after=files.at(-1)!.ordinal
  }
  await assertBucket(env,true,session.id)
  const counts=portableTables.map(t=>`(SELECT COUNT(*) FROM ${quote(t)})`),groups:string[]=[];for(let i=0;i<counts.length;i+=10)groups.push('('+counts.slice(i,i+10).join('+')+')')
  const statements=[env.DB.prepare('PRAGMA defer_foreign_keys=ON'),env.DB.prepare(`INSERT INTO custody_admission(singleton,empty_check) VALUES(1,CASE WHEN (${groups.join('+')})=0 AND NOT EXISTS(SELECT 1 FROM portable_history WHERE lineage=? AND sequence>?) AND NOT EXISTS(SELECT 1 FROM portable_journal WHERE lineage=? AND sequence>?) THEN 1 ELSE 0 END)`).bind(header.source.lineage,header.source.sequence,header.source.lineage,header.source.sequence),...importRestoreTriggers.map(t=>env.DB.prepare('DROP TRIGGER IF EXISTS '+quote(t.name)))]
  for(const table of portableTables){const cols=registry[table];const values=cols.map(c=>table==='review_folders'&&c==='closed_at'?`COALESCE(closed_at,'${now.toISOString()}')`:['connections','tracker_destinations','followup_channels'].includes(table)&&c==='status'?"'inactive after restore'":table==='connections'&&c==='next_attempt_at'?'NULL':quote(c));statements.push(env.DB.prepare(`INSERT INTO ${quote(table)}(${cols.map(quote).join(',')}) SELECT ${values.join(',')} FROM ${staged(session.id,table)}`))}
  // Archives older than LIBRARY-001 revisions ran every test under revision 1.
  if(!Object.hasOwn(header.tables,'run_library_revisions'))statements.push(backfillRunLibraryRevisions(env))
  statements.push(...importRestoreTriggers.map(t=>env.DB.prepare(t.sql)),...barrierStatements(env),
   env.DB.prepare('INSERT INTO portable_journal(lineage,sequence,recorded_at,receipt) SELECT lineage,sequence,recorded_at,receipt FROM portable_journal_stage s WHERE session_id=? AND NOT EXISTS(SELECT 1 FROM portable_journal j WHERE j.lineage=s.lineage AND j.sequence=s.sequence)').bind(session.id),
   env.DB.prepare('UPDATE portable_state SET lineage=?,generation=generation+1 WHERE singleton=1').bind(header.source.lineage),
   env.DB.prepare('INSERT INTO portable_history(lineage,sequence,checked_at) VALUES(?,?,?) ON CONFLICT(lineage) DO UPDATE SET sequence=max(sequence,excluded.sequence),checked_at=excluded.checked_at').bind(header.source.lineage,history.sequence,now.toISOString()),
   env.DB.prepare('DELETE FROM custody_admission'),env.DB.prepare("UPDATE portable_sessions SET state='complete' WHERE id=?").bind(session.id),env.DB.prepare('UPDATE portable_files SET written=0 WHERE session_id=?').bind(session.id))
  await env.DB.batch(statements)
  const result={...JSON.parse(session.result),...history,dry_run:false,folders_closed:JSON.parse(session.result).counts.review_folders}
  await cleanupSession(env,session.id)
  return result
 }catch(error){const state=await env.DB.prepare('SELECT state FROM portable_sessions WHERE id=?').bind(session.id).first<{state:string}>();if(state?.state!=='complete'){await cleanupSession(env,session.id,false);await env.DB.prepare("UPDATE portable_sessions SET state='failed',error=? WHERE id=?").bind(error instanceof Error?error.message:'Admission failed.',session.id).run()}throw error}
}
