import { fail,pathOK } from './format'
import { objectDigest } from './framing'
import { quote,staged,type Store } from './registry'
export interface PortableFile {path:string;object_key:string;size:number;sha256:string;available:boolean;reason?:string}
export function fileQuery(session?:string) {
 const t=(name:string)=>session?staged(session,name):quote(name)
 return `SELECT e.object_key,e.size,r.sha256,'files/'||e.id AS path FROM ${t('exhibits')} e JOIN ${t('receipts')} r ON r.exhibit_id=e.id
 UNION ALL SELECT object_key,archive_size AS size,archive_sha256 AS sha256,'import-sources/'||id AS path FROM ${t('import_reviews')}
 UNION ALL SELECT object_key,size,sha256,'populations/'||id AS path FROM ${t('population_uploads')}
 UNION ALL SELECT object_key,size,sha256,'vulns/'||id AS path FROM ${t('vuln_documents')}
 UNION ALL SELECT object_key,size,sha256,'framework-originals/'||id AS path FROM ${t('custom_framework_revisions')} WHERE object_key IS NOT NULL`
}
export async function* filePages(env:Store,session?:string) {
 let after=''
 for(;;) {
  const result=(await env.DB.prepare(`SELECT * FROM (${fileQuery(session)}) WHERE object_key>? ORDER BY object_key LIMIT 100`).bind(after).all<Omit<PortableFile,'available'>>()).results
  if(!result.length)break
  yield result;after=result.at(-1)!.object_key
 }
}
export async function inspectFile(env:Store,file:Omit<PortableFile,'available'>):Promise<PortableFile> {
 pathOK(file.object_key);pathOK(file.path)
 if(file.object_key.startsWith('_portable/'))fail('A business object uses the reserved archive staging namespace.')
 let available=false
 try{const object=await env.EXHIBITS.get(file.object_key);if(object && object.size===file.size){const got=await objectDigest(object.body);available=got.size===file.size&&got.sha256===file.sha256}}catch{/* Missing or changed originals remain explicitly unavailable. */}
 return {...file,available,...(!available?{reason:'Original bytes are missing, unreadable or changed.'}:{})}
}
export async function assertBucket(env:Store,empty=false,admission?:string) {
 let cursor:string|undefined
 do {
  const objects=await env.EXHIBITS.list({limit:1000,...(cursor?{cursor}:{})})
  if(objects.objects.length){
   const keys=JSON.stringify(objects.objects.map(o=>o.key))
   const unknown=await env.DB.prepare(`SELECT value AS key FROM json_each(?) WHERE value NOT IN (${empty?'SELECT NULL WHERE 0':`SELECT object_key FROM (${fileQuery()})`}) ${admission?`AND value NOT IN (SELECT object_key FROM portable_files WHERE session_id='${admission}' AND written=1)`:''} AND value NOT IN (SELECT object_key FROM portable_parts) AND value NOT IN (SELECT staged_key FROM portable_files WHERE staged_key IS NOT NULL) LIMIT 1`).bind(keys).first<{key:string}>()
   if(unknown)fail(empty?'Restore requires an empty exhibit bucket.':'Unaccounted bucket object or namespace: '+unknown.key)
  }
  cursor=objects.truncated?objects.cursor:undefined
 }while(cursor)
}
