import type { Bindings } from '../../auth.server'
import { fail, sha, type Row } from './format'
import type { PopulationFile } from './populations'
export async function frameworkFiles(env:Pick<Bindings,'EXHIBITS'>,rows:Row[]):Promise<PopulationFile[]> {
 return Promise.all(rows.filter(r=>r.object_key!==null).map(async r=>{
  let available=false
  try{const o=await env.EXHIBITS.get(String(r.object_key));available=!!o&&o.size===r.size&&await sha(await o.arrayBuffer())===r.sha256}catch{/* Missing bytes stay explicit. */}
  return {path:'framework-originals/'+r.id,object_key:String(r.object_key),size:Number(r.size),sha256:String(r.sha256),available,...(!available?{reason:'Original framework import is missing, unreadable or changed.'}:{})}
 }))
}
export function validateFrameworkFiles(files:unknown,rows:Row[]) {
 const originals=rows.filter(r=>r.object_key!==null)
 if(!Array.isArray(files)||files.length!==originals.length)fail('Framework original inventory is incomplete.')
 const seen=new Set<string>()
 for(const f of files){
  const r=originals.find(r=>f?.path==='framework-originals/'+r.id)
  const keys=['path','object_key','size','sha256','available',...(f?.available===false?['reason']:[])]
  if(!r||!f||Object.keys(f).length!==keys.length||keys.some(k=>!Object.hasOwn(f,k))||seen.has(f.path)||!/^framework-originals\/[a-f0-9-]{36}$/.test(f.object_key)||f.object_key!==r.object_key||f.size!==r.size||!Number.isSafeInteger(f.size)||f.size<1||f.size>10*1024*1024||f.sha256!==r.sha256||!/^[a-f0-9]{64}$/.test(f.sha256)||typeof f.available!=='boolean'||(!f.available&&(typeof f.reason!=='string'||!f.reason||f.reason.length>300)))fail('Framework original contradicts its retained revision.')
  seen.add(f.path)
 }
}
