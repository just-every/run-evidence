import { AsyncLocalStorage } from 'node:async_hooks'
import type { Bindings } from '../../auth.server'
import type { Connection } from './storage'
import { collectionContext } from './run-context'
import { digest } from '../api/tokens'
interface Stream { items: unknown[]; next: string | null; complete: boolean; seen: string[] }
interface Snapshot { authority: string; started_at: string; pending: boolean; data: string; cursors:Record<string,string|null> }
interface Job { context: unknown; authority: string; started_at: string; streams: Record<string,Stream>; persist?:()=>Promise<void> }
const current = new AsyncLocalStorage<Job>()
const MAX_RAW = 8 * 1024 * 1024
const encode = (bytes:Uint8Array) => { let text=''; for(let i=0;i<bytes.length;i+=8192)text+=String.fromCharCode(...bytes.subarray(i,i+8192)); return btoa(text) }
async function packed(streams:Record<string,Stream>) {
 const raw=new TextEncoder().encode(JSON.stringify(streams))
 if(raw.byteLength>MAX_RAW)throw Error('Durable source cursor exceeds the 8 MiB decoded bound')
 const bytes=await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer()
 return encode(new Uint8Array(bytes))
}
async function unpacked(data:string) {
 if(data.length>240000)throw Error('Invalid source cursor')
 const bytes=Uint8Array.from(atob(data),c=>c.charCodeAt(0)), stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))
 const reader=stream.getReader(),parts:Uint8Array[]=[];let size=0
 for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>MAX_RAW){await reader.cancel();throw Error('Invalid source cursor')};parts.push(value)}
 const raw=new Uint8Array(size);let offset=0;for(const p of parts){raw.set(p,offset);offset+=p.length}
 const value=JSON.parse(new TextDecoder().decode(raw)) as Record<string,Stream>
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length>5000||Object.values(value).some(s=>!s||!Array.isArray(s.items)||!Array.isArray(s.seen)||typeof s.complete!=='boolean'||!(s.next===null||typeof s.next==='string')))throw Error('Invalid source cursor')
 return value
}
export async function withPages<T>(env:Bindings,connection:Connection,now:Date,work:()=>Promise<T>):Promise<T> {
 if(connection.provider==='private-git'||connection.status!=='active')return work()
 const context=await collectionContext(env,connection)
 const selected=connection.provider==='github' ? (await env.DB.prepare('SELECT full_name FROM connection_repositories WHERE connection_id=? AND selected=1 ORDER BY full_name').bind(connection.id).all()).results : []
 const authority=await digest(JSON.stringify([selected,connection.id,connection.provider,connection.secret_ciphertext,connection.secret_iv,connection.config_json,context]))
 const prior=await env.DB.prepare('SELECT coverage_json FROM collection_runs WHERE connection_id=? ORDER BY started_at DESC,rowid DESC LIMIT 1').bind(connection.id).first<{coverage_json:string}>()
 const saved=prior ? JSON.parse(prior.coverage_json).resume_pages as Snapshot|undefined : undefined
 let streams:Record<string,Stream>={},started=now.toISOString()
 if(saved?.pending && saved.authority===authority && Number.isFinite(Date.parse(saved.started_at)) && now.getTime()-Date.parse(saved.started_at)>=0 && now.getTime()-Date.parse(saved.started_at)<=3600000){
  try {streams=Object.fromEntries(Object.entries(await unpacked(saved.data)).filter(([key,s])=>!s.complete||key.startsWith('nested:')));started=saved.started_at}catch{/* An unusable checkpoint requires fresh authorized reads, never admitted cached facts. */}
 }
 return current.run({context,authority,started_at:started,streams},work)
}
export const pageContext=()=>current.getStore()?.context
export const sourceReadTime=(now:Date)=>current.getStore()?.started_at ?? now.toISOString()
export async function pageSnapshot():Promise<Snapshot|undefined> {
 const job=current.getStore();if(!job)return undefined
 const data=await packed(job.streams),cursors=Object.fromEntries(Object.entries(job.streams).filter(([,s])=>!s.complete).map(([key,s])=>[key,s.next])),budget=240000-JSON.stringify(job.context).length
 if(data.length+JSON.stringify(cursors).length>budget)throw Error('Durable source cursor exceeds the archive metadata bound')
 return {authority:job.authority,started_at:job.started_at,pending:Object.values(job.streams).some(s=>!s.complete),data,cursors}
}
export function attachPages(persist:()=>Promise<void>){const job=current.getStore();if(job)job.persist=persist}
export async function readPageStream<T>(key:string,initial:string,read:(cursor:string)=>Promise<{items:T[];next:string|null}>,limit:number,failure:(message:string)=>Error,identity?:(item:T)=>string):Promise<T[]> {
 const job=current.getStore(),state=job?.streams[key] ?? {items:[],next:initial,complete:false,seen:[]}
 if(state.complete)return state.items as T[]
 if(job)job.streams[key]=state
 const persist=async()=>{try{await job?.persist?.()}catch{if(job){job.streams={};await job.persist?.().catch(()=>{})}throw failure('pagination incomplete: durable cursor storage bound reached; reduce source scope')}}
 for(let page=0;state.next!==null&&page<limit;page++){
  const cursor=state.next
  if(state.seen.includes(cursor)){if(job)delete job.streams[key];await persist();throw failure('pagination incomplete: repeated continuation')}
  await persist()
  const result=await read(cursor)
  if(identity){const ids=new Set((state.items as T[]).map(identity));for(const item of result.items){const id=identity(item);if(ids.has(id))throw failure('pagination incomplete: repeated source identity');ids.add(id)}}
  state.items.push(...result.items);state.seen.push(cursor);state.next=result.next;state.complete=result.next===null
  await persist()
 }
 if(!state.complete)throw failure('pagination incomplete: page limit reached; durable cursor retained')
 return state.items as T[]
}

// Cache only fields consumed by a reader. Unexpected provider fields, secrets
// and complete opaque response objects never enter the durable journal.
export function retainFields<T>(value:T,keys:readonly string[]):T {
 const keep=new Set(keys)
 const visit=(v:unknown):unknown=>Array.isArray(v)?v.map(visit):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).filter(([k])=>keep.has(k)).map(([k,v])=>[k,visit(v)])):v
 return visit(value) as T
}
