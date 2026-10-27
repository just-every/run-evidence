import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
const digest=bytes=>createHash('sha256').update(bytes).digest('hex')
const base=['controls','requirements','exhibits','receipt_actors','receipts','review_folders','review_folder_controls','review_events']
const agents=['agent_tokens','agent_proposals','agent_decisions']
export function decodeArchive(bytes){
 let at=Buffer.byteLength('EVIDENCE-ARCHIVE\n')
 const take=n=>{assert.ok(at+n<=bytes.length,'complete archive frame');const b=bytes.subarray(at,at+n);at+=n;return b}
 const number=()=>take(4).readUInt32BE(0)
 const length=number(),initial=take(length),first=JSON.parse(initial)
 if(first.version!==10){const manifest=JSON.parse(first.manifest),entries=[];while(at<bytes.length){const path=take(number()).toString(),body=take(number());entries.push({path,bytes:body})}return {envelope:first,manifest,entries}}
 const allRows=Object.fromEntries(Object.keys(first.tables).map(t=>[t,[]])),entries=[],files=[]
 const h=createHash('sha256');h.update(bytes.subarray(Buffer.byteLength('EVIDENCE-ARCHIVE\n'),at))
 let file=null,parts=[],end
 while(at<bytes.length){const start=at,f=JSON.parse(take(number()));if(f.type==='end'){end=f;break}h.update(bytes.subarray(start,at));if(f.type==='rows')allRows[f.table].push(...f.rows);if(f.type==='file'){files.push(f.file);file=f.file;parts=[]}if(f.type==='file-part')parts.push(Buffer.from(f.data,'base64'));if(f.type==='file-end'){const body=Buffer.concat(parts);assert.equal(body.length,file.size);assert.equal(digest(body),file.sha256);entries.push({path:file.path,bytes:body})}}
 assert.ok(end,'complete end frame');assert.equal(end.sha256,h.digest('hex'),'complete stream digest');assert.equal(at,bytes.length,'no trailing frames')
 for(const [table,rows]of Object.entries(allRows))rows.sort((a,b)=>{for(const key of table==='review_folder_controls'?['folder_id','control_id']:[first.tables[table][0]]){if(a[key]<b[key])return -1;if(a[key]>b[key])return 1}return 0})
 const importNames=Object.keys(allRows).filter(t=>t.startsWith('ik_')||t.startsWith('import_')),programNames=Object.keys(allRows).filter(t=>!base.includes(t)&&!agents.includes(t)&&!importNames.includes(t)&&!(t.startsWith('promise_')||t.startsWith('trust_')||t.startsWith('audit_')||t.startsWith('code_manifest_')||t.startsWith('tailor')||t.startsWith('questionnaire')||t.startsWith('privacy_')||(t.startsWith('vendor_')&&t!=='vendors')||t.startsWith('program_document')||t.startsWith('iso_'))&&!['inventory_decisions','inventory_group_events','library_acceptances','run_library_revisions','operation_steps','period_investigations','period_investigation_decisions'].includes(t))
 const manifest={format:'evidence-custody',version:9,created_at:first.created_at,rows:Object.fromEntries(base.map(t=>[t,allRows[t]])),files:files.filter(f=>f.path.startsWith('files/')).map(({object_key,...f})=>({...f,exhibit_id:f.path.slice(6)})),extensions:{agent:{rows:Object.fromEntries(agents.map(t=>[t,allRows[t]]))},imports:{rows:Object.fromEntries(importNames.map(t=>[t,allRows[t]])),files:files.filter(f=>f.path.startsWith('import-sources/')).map(({reason,...f})=>f)},program:{rows:Object.fromEntries(programNames.map(t=>[t,allRows[t].map(r=>t==='tests'?Object.fromEntries(Object.entries(r).filter(([c])=>c!=='remediation')):r)])),files:files.filter(f=>!f.path.startsWith('files/')&&!f.path.startsWith('import-sources/'))}}}
 const text=JSON.stringify(manifest)
 return {header:first,allRows,envelope:{manifest:text,sha256:digest(text)},manifest,entries}
}

// The published pre-INVENTORY v10 registry has no inventory decision or library
// revision tables. Build that earlier format only from an archive where those
// tables are empty, except runs stamped with library revision 1, the only
// revision shipped then (restore stamps them again). Period investigations
// arrived later too; their tables must be absent and empty in this predecessor.
export function preInventoryArchive(bytes) {
 const magic=Buffer.from('EVIDENCE-ARCHIVE\n'),prefix=n=>{const b=Buffer.alloc(4);b.writeUInt32BE(n);return b},pack=v=>{const b=Buffer.from(JSON.stringify(v));return Buffer.concat([prefix(b.length),b])}
 let at=magic.length
 const next=()=>{const size=bytes.readUInt32BE(at);at+=4;const raw=bytes.subarray(at,at+size);at+=size;return JSON.parse(raw)}
 const head=next(),removed=new Set(['inventory_decisions','inventory_group_events','library_acceptances','run_library_revisions','operation_steps','period_investigations','period_investigation_decisions','code_manifest_grants','code_manifest_snapshots',...Object.keys(head.tables).filter(t=>t.startsWith('promise_')||t.startsWith('trust_')||t.startsWith('audit_')||t.startsWith('code_manifest_')||t.startsWith('tailor')||t.startsWith('questionnaire')||t.startsWith('privacy_')||t.startsWith('vendor_')||t.startsWith('program_document')||t.startsWith('iso_'))])
 let dropped=0
 assert.equal(head.version,10)
 const first=pack({...head,tables:Object.fromEntries(Object.entries(head.tables).filter(([t])=>!removed.has(t)))}),parts=[magic,first],hash=createHash('sha256').update(first)
 while(at<bytes.length){const f=next();if(f.type==='rows'&&removed.has(f.table)){if(f.table==='run_library_revisions'){assert.ok(f.rows.every(r=>r.library_revision===1),'only revision 1 runs predate library revisions');dropped+=f.rows.length}else if(f.table.startsWith('vendor_')||f.table.startsWith('program_document')||f.table.startsWith('iso_'))dropped+=f.rows.length;else assert.equal(f.rows.length,0,'never discard inventory decisions or library acceptances');continue}if(f.type==='table'&&removed.has(f.table))continue;if(f.type==='end'){parts.push(pack({...f,rows:f.rows-dropped,sha256:hash.digest('hex')}));assert.equal(at,bytes.length);return Buffer.concat(parts)}const framed=pack(f);hash.update(framed);parts.push(framed)}
 throw Error('Missing complete archive end frame')
}
