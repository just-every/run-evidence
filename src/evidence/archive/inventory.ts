import type { Bindings } from '../../auth.server'
import { inventoryExtensions, validateExtensions, archiveFiles } from './extensions'
import { validateManifest } from './validate'
import { columns,tables,sha,encoder,MAX_METADATA,MAX_FILE,VERSION,fail,type Manifest,type Row } from './format'
export async function bytesFor(env: Pick<Bindings,'DB'|'EXHIBITS'>, key:string, size:number, digest:string, maxSize=MAX_FILE) {
 try { const object = await env.EXHIBITS.get(key); if (!object || object.size !== size || size > maxSize) return null; const bytes = new Uint8Array(await object.arrayBuffer()); return bytes.length === size && await sha(bytes) === digest ? bytes : null } catch { return null }
}
export async function inventory(env: Pick<Bindings,'DB'|'EXHIBITS'>, now = new Date()): Promise<Manifest> {
 const counts=await env.DB.batch<{total:number}>(tables.map(table=>env.DB.prepare(`SELECT COUNT(*) AS total FROM ${table}`)))
 if(counts.reduce((sum,result)=>sum+Number(result.results[0].total),0)>20000) fail('Archive metadata exceeds 20,000 rows; no incomplete archive was produced.')
 const result = await env.DB.batch(tables.map(table => env.DB.prepare(`SELECT ${columns[table].join(',')} FROM ${table} ORDER BY ${columns[table][0]}${table === 'review_folder_controls' ? ',control_id' : ''} LIMIT 20001`)))
 const rows = Object.fromEntries(tables.map((table,i)=>[table,result[i].results])) as Record<keyof typeof columns,Row[]>
 const manifest:Manifest = {format:'evidence-custody',version:VERSION,created_at:now.toISOString(),rows,files:[],extensions:await inventoryExtensions(env)}
 for (const exhibit of rows.exhibits) {
  const receipt = rows.receipts.find(row=>row.exhibit_id === exhibit.id); if(!receipt) fail('Exhibit has no receipt; archive cannot establish custody.')
  const available = !!await bytesFor(env,String(exhibit.object_key),Number(exhibit.size),String(receipt.sha256))
  manifest.files.push({path:'files/'+exhibit.id,exhibit_id:String(exhibit.id),size:Number(exhibit.size),sha256:String(receipt.sha256),available,...(!available ? {reason:'Missing, unreadable or changed stored bytes.'} : {})})
 }
 if(encoder.encode(JSON.stringify(manifest)).length > MAX_METADATA) fail('Archive metadata exceeds 8 MiB; no incomplete archive was produced.')
 validateManifest(manifest)
 await validateExtensions(manifest)
 return manifest
}
export function summary(manifest:Manifest) {
 const files=archiveFiles(manifest)
 return { counts:Object.fromEntries([...tables.map(t=>[t,manifest.rows[t].length]), ...Object.entries(manifest.extensions?.agent.rows??{}).map(([t,r])=>[t,r.length]), ...Object.entries(manifest.extensions?.imports.rows??{}).map(([t,r])=>[t,r.length]), ...Object.entries(manifest.extensions?.program?.rows??{}).map(([t,r])=>[t,r.length])]), bytes:files.filter(f=>f.available).reduce((sum,f)=>sum+f.size,0), files:files.length, available:files.filter(f=>f.available).length, missing:files.filter(f=>!f.available).map(({object_key,...file})=>file) }
}
