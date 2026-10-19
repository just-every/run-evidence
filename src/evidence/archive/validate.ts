import { validDate,groups,cadences } from '../model'
import { columns,tables,fail,pathOK,MAX_FILE,MAX_METADATA,VERSION,type Manifest,type Row,type Table } from './format'
const object = (v:unknown): v is Record<string,unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const exact = (v:Record<string,unknown>, keys:readonly string[]) => Object.keys(v).length === keys.length && keys.every(k=>Object.hasOwn(v,k))
const timestamp = (v:unknown) => typeof v === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().replace('.000Z','Z') === v.replace('.000Z','Z')
const nullable = new Set(['receipts.supersedes','review_folders.closed_at','review_events.folder_id','review_events.exhibit_id'])
const id = (value:unknown) => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value)
export function validateManifest(value:unknown): asserts value is Manifest {
 if(!object(value) || !exact(value,Number(value.version)>=2 ? ['format','version','created_at','rows','files','extensions'] : ['format','version','created_at','rows','files']) || value.format !== 'evidence-custody' || ![1,2,3,4,5,VERSION].includes(Number(value.version))) fail('Unsupported archive format or version.')
 if(!timestamp(value.created_at) || !object(value.rows) || !exact(value.rows,tables) || !Array.isArray(value.files)) fail('Invalid archive metadata.')
 const rows = value.rows as Record<Table,Row[]>, sets = {} as Record<Table,Map<string,Row>>
 let rowCount = 0
 for(const table of tables) {
  if(!Array.isArray(rows[table])) fail('Invalid table inventory.')
  sets[table] = new Map()
  for(const row of rows[table]) {
   if(++rowCount > 20000 || !object(row) || !exact(row,columns[table])) fail('Invalid or excessive metadata rows.')
   for(const column of columns[table]) {
    const field = row[column]
    if(nullable.has(table+'.'+column) && field === null) continue
    if(table === 'exhibits' && column === 'size') { if(!Number.isSafeInteger(field) || Number(field)<1 || Number(field)>MAX_FILE) fail('Invalid exhibit size.'); continue }
    if(typeof field !== 'string' || !field || field.length > (column==='source' ? 1000 : 1024)) fail('Invalid metadata field.')
    if((column === 'id' || column.endsWith('_id') || ['added_by','supersedes'].includes(column)) && !id(field)) fail('Invalid record identity.')
    if(column.endsWith('_at') && !timestamp(field)) fail('Invalid UTC timestamp.')
   }
   const key = table === 'review_folder_controls' ? row.folder_id+'\0'+row.control_id : String(row.id)
   if(sets[table].has(key)) fail('Duplicate metadata identity.'); sets[table].set(key,row)
  }
 }
 const has = (table:Table,key:unknown) => typeof key==='string' && sets[table].has(key)
 for(const r of rows.controls) if(!(groups as readonly unknown[]).includes(r.group_name)) fail('Unknown control group.')
 for(const r of rows.requirements) if(!has('controls',r.control_id) || !(cadences as readonly unknown[]).includes(r.cadence)) fail('Invalid requirement relationship or cadence.')
 const usedExhibits = new Set(), usedOld = new Set(), objectKeys = new Set()
 for(const r of rows.exhibits) { pathOK(r.object_key); if(objectKeys.has(r.object_key)) fail('Duplicate object path.'); objectKeys.add(r.object_key) }
 for(const r of rows.receipts) {
  if(!has('requirements',r.requirement_id) || !has('exhibits',r.exhibit_id) || !has('receipt_actors',r.added_by) || usedExhibits.has(r.exhibit_id)) fail('Invalid receipt relationship.')
  usedExhibits.add(r.exhibit_id)
  if(!['source-observed','manually-asserted','imported'].includes(String(r.origin)) || !validDate(r.covered_from) || !validDate(r.covered_to) || r.covered_from>r.covered_to || !/^[a-f0-9]{64}$/.test(String(r.sha256))) fail('Invalid receipt facts.')
  if(r.supersedes !== null) {
   const old = sets.receipts.get(String(r.supersedes))
   if(!old || old.requirement_id !== r.requirement_id || old.id === r.id || usedOld.has(old.id)) fail('Invalid supersession relationship.')
   usedOld.add(old.id)
   const chain = new Set([r.id]); let cursor:Row|undefined = old
   while(cursor) { if(chain.has(cursor.id)) fail('Cyclic receipt supersession.'); chain.add(cursor.id); cursor = cursor.supersedes ? sets.receipts.get(String(cursor.supersedes)) : undefined }
  }
 }
 if(usedExhibits.size !== rows.exhibits.length) fail('Exhibit without an immutable receipt.')
 for(const r of rows.review_folders) if(!validDate(r.period_from) || !validDate(r.period_to) || r.period_from>r.period_to || String(r.expires_at)<=String(r.created_at)) fail('Invalid review folder dates.')
 for(const r of rows.review_folder_controls) if(!has('review_folders',r.folder_id) || !has('controls',r.control_id)) fail('Invalid folder control relationship.')
 for(const r of rows.review_folders) if(!rows.review_folder_controls.some(s=>s.folder_id===r.id)) fail('Review folder has no selected controls.')
 for(const r of rows.review_events) if((r.folder_id!==null && !has('review_folders',r.folder_id)) || (r.exhibit_id!==null && !has('exhibits',r.exhibit_id)) || !['page','list','receipt','download','unknown'].includes(String(r.action)) || !['allowed','refused'].includes(String(r.outcome))) fail('Invalid review event.')
 const paths = new Set(['manifest']), exhibits = new Set()
 for(const file of value.files) {
  if(!object(file) || !exact(file,file.available === true ? ['path','exhibit_id','size','sha256','available'] : ['path','exhibit_id','size','sha256','available','reason'])) fail('Invalid file inventory.')
  pathOK(file.path)
  if(paths.has(file.path) || exhibits.has(file.exhibit_id)) fail('Duplicate archive path or exhibit.')
  paths.add(file.path); exhibits.add(file.exhibit_id)
  const exhibit=sets.exhibits.get(String(file.exhibit_id)), receipt=rows.receipts.find(r=>r.exhibit_id===file.exhibit_id)
  if(!exhibit || !receipt || file.size!==exhibit.size || file.sha256!==receipt.sha256 || typeof file.available!=='boolean' || (!file.available && (typeof file.reason!=='string' || !file.reason || file.reason.length>300))) fail('File inventory contradicts receipt facts.')
 }
 if(exhibits.size!==rows.exhibits.length) fail('File inventory is incomplete.')
 // The same bound applies independently of framing and caller.
 if(new TextEncoder().encode(JSON.stringify(value)).length>MAX_METADATA) fail('Archive metadata exceeds 8 MiB.')
}
