import { fail,stream,sha } from './format'
import { PART_BYTES } from './framing'
import { assertSchema,businessRows,portableTables,staged,type Store } from './registry'
import { assertBucket } from './files'
import { dropStages } from './staging'
export interface Session {id:string;owner_id:string;state:string;parts:number;bytes:number;created_at:string;updated_at:string;header:string|null;result:string|null;error:string|null}
export async function emptyPortableTarget(env:Store){
 for(let i=0;i<portableTables.length;i+=25){
  const counts=await env.DB.batch<{n:number}>(portableTables.slice(i,i+25).map(t=>env.DB.prepare(`SELECT ${businessRows(t)} AS n`)))
  if(counts.some(r=>r.results[0].n>0))fail('Restore requires an empty Evidence database. Destination authentication is allowed.')
 }
 await assertBucket(env,true)
}
export async function createSession(env:Store,owner:string,now=new Date()) {
 await assertSchema(env);await emptyPortableTarget(env)
 const id=crypto.randomUUID(),at=now.toISOString()
 await env.DB.prepare("INSERT INTO portable_sessions(id,owner_id,created_at,updated_at,state) VALUES(?,?,?,?,'uploading')").bind(id,owner,at,at).run()
 return {id,part_bytes:PART_BYTES,state:'uploading',parts:0,bytes:0}
}
export async function ownedSession(env:Store,id:string,owner:string){const s=await env.DB.prepare('SELECT * FROM portable_sessions WHERE id=? AND owner_id=?').bind(id,owner).first<Session>();if(!s)fail('Archive upload session was not found for this owner.');return s}
export async function uploadPart(env:Store,s:Session,ordinal:number,body:ReadableStream<Uint8Array>,now:Date){
 if(s.state!=='uploading'||!Number.isSafeInteger(ordinal)||ordinal<0||ordinal>s.parts)fail('Archive chunk is out of order or session is closed.')
 const r=body.getReader(),chunks:Uint8Array[]=[];let size=0
 try{for(;;){const next=await r.read();if(next.done)break;size+=next.value.length;if(size>PART_BYTES)fail('Upload chunks are limited to 1 MiB.');chunks.push(next.value)}}finally{r.releaseLock()}
 if(!size)fail('Archive upload chunk is empty.')
 const bytes=new Uint8Array(size);let at=0;for(const c of chunks){bytes.set(c,at);at+=c.length}const digest=await sha(bytes)
 if(ordinal<s.parts){const old=await env.DB.prepare('SELECT sha256 FROM portable_parts WHERE session_id=? AND ordinal=?').bind(s.id,ordinal).first<{sha256:string}>();if(old?.sha256!==digest)fail('A resumed upload chunk differs from the original.');return {parts:s.parts,bytes:s.bytes}}
 const key=`_portable/${s.id}/parts/${ordinal}`
 // Durable ownership precedes the object write, so interrupted puts have an
 // explicit cleanup/resume owner and never become unexplained business data.
 await env.DB.prepare('INSERT INTO portable_parts(session_id,ordinal,object_key,size,sha256) VALUES(?,?,?,?,?) ON CONFLICT(session_id,ordinal) DO UPDATE SET size=excluded.size,sha256=excluded.sha256').bind(s.id,ordinal,key,size,digest).run()
 await env.EXHIBITS.put(key,bytes)
 await env.DB.prepare('UPDATE portable_sessions SET parts=parts+1,bytes=bytes+?,updated_at=? WHERE id=? AND parts=? AND state=\'uploading\'').bind(size,now.toISOString(),s.id,ordinal).run()
 return {parts:s.parts+1,bytes:s.bytes+size}
}
export function uploadedBody(env:Store,s:Session) {
 async function* chunks(){for(let n=0;n<s.parts;n++){const part=await env.DB.prepare('SELECT object_key,size,sha256 FROM portable_parts WHERE session_id=? AND ordinal=?').bind(s.id,n).first<{object_key:string;size:number;sha256:string}>();if(!part)fail('Archive upload has a missing chunk.');const object=await env.EXHIBITS.get(part.object_key);if(!object||object.size!==part.size)fail('Archive upload chunk is missing.');const bytes=new Uint8Array(await object.arrayBuffer());if(await sha(bytes)!==part.sha256)fail('Archive upload chunk changed.');yield bytes}}
 return stream(chunks())
}
export async function cleanupSession(env:Store,id:string,remove=true){
 let after=-1
 for(;;){const rows=(await env.DB.prepare('SELECT ordinal,object_key,staged_key,upload_id,written FROM portable_files WHERE session_id=? AND ordinal>? ORDER BY ordinal LIMIT 100').bind(id,after).all<{ordinal:number;object_key:string;staged_key:string|null;upload_id:string|null;written:number}>()).results;if(!rows.length)break;for(const f of rows){if(f.staged_key){if(f.upload_id)await env.EXHIBITS.resumeMultipartUpload(f.staged_key,f.upload_id).abort().catch(()=>{});await env.EXHIBITS.delete(f.staged_key);}if(f.written){const object=await env.EXHIBITS.head(f.object_key);if(object?.customMetadata?.portable_session===id)await env.EXHIBITS.delete(f.object_key)}}after=rows.at(-1)!.ordinal}
 await env.DB.prepare('DELETE FROM portable_journal_stage WHERE session_id=?').bind(id).run()
 await dropStages(env,id)
 await env.DB.prepare('DELETE FROM portable_files WHERE session_id=?').bind(id).run()
 if(remove){let n=-1;for(;;){const parts=(await env.DB.prepare('SELECT ordinal,object_key FROM portable_parts WHERE session_id=? AND ordinal>? ORDER BY ordinal LIMIT 100').bind(id,n).all<{ordinal:number;object_key:string}>()).results;if(!parts.length)break;await env.EXHIBITS.delete(parts.map(p=>p.object_key));n=parts.at(-1)!.ordinal}await env.DB.prepare('DELETE FROM portable_sessions WHERE id=?').bind(id).run()}
}
