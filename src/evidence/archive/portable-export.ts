import { MAGIC,encoder,fail,stream } from './format'
import { assertSchema,pages,portableTables,registry,type Store,quote } from './registry'
import { assertBucket,filePages,inspectFile } from './files'
import { frame,newHash,objectDigest } from './framing'
import { sourceLineage } from './journal'
export interface PortableInventory {format:'evidence-custody';version:10;created_at:string;source:{lineage:string;sequence:number;generation:number};counts:Record<string,number>;bytes:number;files:number;available:number;missing:{path:string;object_key:string;size:number;sha256:string;available:boolean;reason?:string}[];missing_count:number;missing_truncated:boolean}
export async function portableInventory(env:Store,now=new Date()):Promise<PortableInventory> {
 await assertSchema(env);await assertBucket(env)
 if(await env.DB.prepare("SELECT 1 FROM privacy_requests WHERE state='pending' LIMIT 1").first())fail('An erasure is pending. Finish or retry its storage deletion before exporting an archive.')
 const source=await sourceLineage(env),counts:Record<string,number>={}
 for(let i=0;i<portableTables.length;i+=30){const names=portableTables.slice(i,i+30),r=await env.DB.batch<{total:number}>(names.map(t=>env.DB.prepare(`SELECT count(*) AS total FROM ${quote(t)}`)));names.forEach((t,k)=>{counts[t]=r[k].results[0].total})}
 const result:PortableInventory={format:'evidence-custody',version:10,created_at:now.toISOString(),source,counts,bytes:0,files:0,available:0,missing:[],missing_count:0,missing_truncated:false}
 for await(const group of filePages(env))for(const ref of group){const f=await inspectFile(env,ref);result.files++;if(f.available){result.available++;result.bytes+=f.size}else{result.missing_count++;if(result.missing.length<100)result.missing.push(f);else result.missing_truncated=true}}
 if((await sourceLineage(env)).generation!==source.generation)fail('Business data changed during inventory; request a fresh archive.')
 return result
}
export const portableSummary=(i:PortableInventory)=>({counts:i.counts,bytes:i.bytes,files:i.files,available:i.available,missing:i.missing,missing_count:i.missing_count,missing_truncated:i.missing_truncated,source:i.source})
export function portableExport(env:Store,inventory:PortableInventory) {
 async function* generate(){
  yield MAGIC
  const hash=newHash();let rowCount=0,fileCount=0,total=0
  const send=function*(v:unknown){for(const b of frame(v)){hash.update(b);yield b}}
  yield* send({format:'evidence-custody',version:10,created_at:inventory.created_at,source:inventory.source,tables:registry})
  for(const table of portableTables){yield* send({type:'table',table});for await(const rows of pages(env,table)){yield* send({type:'rows',table,rows});rowCount+=rows.length}}
  let journalAfter=0
  for(;;){const rows=(await env.DB.prepare('SELECT lineage,sequence,recorded_at,receipt FROM portable_journal WHERE lineage=? AND sequence>? ORDER BY sequence LIMIT 128').bind(inventory.source.lineage,journalAfter).all<{lineage:string;sequence:number;recorded_at:string;receipt:string}>()).results;if(!rows.length)break;yield* send({type:'journal',rows});journalAfter=rows.at(-1)!.sequence}
  for await(const group of filePages(env))for(const ref of group){
   const f=await inspectFile(env,ref);yield* send({type:'file',file:f});fileCount++
   if(!f.available)continue
   const object=await env.EXHIBITS.get(f.object_key);if(!object||object.size!==f.size)fail('Stored original changed during export.')
   const h=newHash();let size=0,index=0;const reader=object.body.getReader()
   try{for(;;){const r=await reader.read();if(r.done)break;for(let at=0;at<r.value.length;at+=256*1024){const part=r.value.subarray(at,at+256*1024);h.update(part);size+=part.length;yield* send({type:'file-part',index:index++,data:Buffer.from(part).toString('base64')})}}}finally{reader.releaseLock()}
   if(size!==f.size||h.digest('hex')!==f.sha256)fail('Stored original changed during export.')
   total+=size;yield* send({type:'file-end',size})
  }
  await assertBucket(env)
  const finalSource=await sourceLineage(env)
  if(finalSource.generation!==inventory.source.generation||finalSource.sequence!==inventory.source.sequence)fail('Business data changed during export. No valid end frame was produced; export again.')
  yield* frame({type:'end',rows:rowCount,files:fileCount,bytes:total,sha256:hash.digest('hex')})
 }
 return stream(generate())
}
