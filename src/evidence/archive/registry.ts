import schemaData from './schema.json'
import { columns } from './format'
import { agentColumns } from '../agent/archive'
import { importTableColumns } from '../import/archive-schema'
import { programColumns } from './program'
import { fail } from './format'
import type { Bindings } from '../../auth.server'
export type Store = Pick<Bindings,'DB'|'EXHIBITS'> & {ARCHIVE_COPY?:(source:string,key:string,size:number,session:string)=>Promise<boolean>}
type Definition = {columns:{name:string;type:string;pk:number}[];foreignKeys:{id:number;seq:number;table:string;from:string;to:string}[];sql:string}
export const schema = schemaData as Record<string,Definition>
export const registry:Record<string,readonly string[]> = {...columns,...agentColumns,...importTableColumns,...programColumns,tests:[...programColumns.tests,'remediation']}
export const portableTables = Object.keys(registry)
export const localTables = Object.keys(schema).filter(t=>!Object.hasOwn(registry,t))
export const portableLocal:Record<string,string[]> = {
 portable_journal_stage:['session_id','lineage','sequence','recorded_at','receipt'],
 portable_state:['singleton','lineage','generation'], portable_journal:['lineage','sequence','recorded_at','receipt'],
 portable_history:['lineage','sequence','checked_at'], portable_capabilities:['capability','subject','authorized_by','authorized_at'],
 portable_sessions:['id','owner_id','created_at','updated_at','state','parts','bytes','header','result','error'],
 portable_parts:['session_id','ordinal','object_key','size','sha256'], portable_files:['session_id','ordinal','object_key','size','sha256','available','reason','staged_key','upload_id','written'],
}
const engineTables:Record<string,string[]> = { d1_migrations:['id','name','applied_at'], _cf_KV:['key','value'] }
export const quote=(s:string)=>'"'+s.replaceAll('"','""')+'"'
export const stagePrefix=(id:string)=>'portable_stage_'+id.replaceAll('-','')+'_'
export const staged=(id:string,t:string)=>quote(stagePrefix(id)+t)
export const blobColumn=(t:string,c:string)=>schema[t].columns.find(v=>v.name===c)?.type.toUpperCase()==='BLOB'
export const selectJSON=(t:string)=>`json_object(${registry[t].flatMap(c=>["'"+c+"'",blobColumn(t,c)?`CASE WHEN ${quote(c)} IS NULL THEN NULL ELSE hex(${quote(c)}) END`:quote(c)]).join(',')})`
export async function assertSchema(env:Store) {
 const found=(await env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all<{name:string}>()).results
 const sessions=(await env.DB.prepare('SELECT id FROM portable_sessions').all<{id:string}>()).results
 const staging = new Set(sessions.flatMap(s=>portableTables.map(t=>stagePrefix(s.id)+t)))
 for(const {name} of found) {
  // Cloudflare owns this exact internal table and denies PRAGMA table_info
  // with SQLITE_AUTH. It carries platform bookkeeping, never product data.
  if(name==='_cf_METADATA') continue
  const expected=schema[name]?.columns.map(c=>c.name) ?? portableLocal[name] ?? engineTables[name]
  if(!expected && !staging.has(name)) fail(`Unaccounted database table: ${name}. No partial archive is allowed.`)
  if(staging.has(name)) continue
  const actual=(await env.DB.prepare(`PRAGMA table_info(${quote(name)})`).all<{name:string}>()).results.map(c=>c.name)
  if(actual.length!==expected.length || actual.some(c=>!expected.includes(c))) fail(`Unaccounted database columns in ${name}.`)
 }
 for(const t of [...portableTables,...Object.keys(portableLocal)]) if(!found.some(v=>v.name===t)) fail(`Required archive table ${t} is absent. Apply all migrations.`)
}
export async function* pages(env:Store,table:string,source=quote(table)) {
 let position=0
 for(;;) {
  const rows=(await env.DB.prepare(`SELECT position,data FROM (SELECT position,data,sum(length(data)) OVER(ORDER BY position) AS bytes,row_number() OVER(ORDER BY position) AS n FROM (SELECT rowid AS position,${selectJSON(table)} AS data FROM ${source} WHERE rowid>? ORDER BY rowid LIMIT 128)) WHERE bytes<=524288 OR n=1`).bind(position).all<{position:number;data:string}>()).results
  if(!rows.length) break
  yield rows.map(r=>JSON.parse(r.data) as Record<string,string|number|null>)
  position=rows.at(-1)!.position
 }
}
