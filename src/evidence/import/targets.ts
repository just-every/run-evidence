import type { D1TargetAdapter, D1Sql, D1Database } from './base/d1/types'
import type { TargetRow } from './base/types'
import { canonicalJson } from './base/provenance/identity'
import type { ControlValue, ReceiptValue } from './types'
const q=(sql:string,...params:unknown[]):D1Sql=>({sql,params})
const decode=(row:any):TargetRow=>({destination:'evidence',targetKind:row.kind,targetId:row.id,revision:row.revision,value:JSON.parse(row.value_json)})
// The owned native effect is a live link. Custody facts and any later business
// decisions are separate immutable records, deliberately outside reversal.
export const targets:D1TargetAdapter={
 async read(db,destination,kind,id){const row=await db.prepare('SELECT * FROM import_active WHERE kind=? AND id=?').bind(kind,id).first();return row?decode(row):undefined},
 matches(row,destination,kind,id){return row?q('EXISTS(SELECT 1 FROM import_active WHERE kind=? AND id=? AND revision=? AND value_json=?)',kind,id,row.revision,canonicalJson(row.value)):q('NOT EXISTS(SELECT 1 FROM import_active WHERE kind=? AND id=?)',kind,id)},
 matchesCount(count){return q('(SELECT COUNT(*) FROM import_active)=?',count)},
 write(row){
  const value=canonicalJson(row.value),v=row.value as unknown as ControlValue&ReceiptValue,statements:D1Sql[]=[]
  if(row.targetKind==='control'){
   statements.push(q('INSERT OR IGNORE INTO controls(id,name,group_name,created_at) VALUES(?,?,?,?)',v.control_id,v.name,v.group,v.created_at),q('INSERT OR IGNORE INTO requirements(id,control_id,name,cadence,created_at) VALUES(?,?,?,?,?)',v.requirement_id,v.control_id,v.proof,v.cadence,v.created_at))
  }else if(row.targetKind==='receipt'){
   statements.push(q('INSERT OR IGNORE INTO exhibits(id,object_key,filename,size,media_type) VALUES(?,?,?,?,?)',v.exhibit_id,v.object_key,v.filename,v.size,'application/octet-stream'),q('INSERT OR IGNORE INTO receipts(id,requirement_id,exhibit_id,origin,source,covered_from,covered_to,added_by,added_by_name,added_at,sha256,supersedes) VALUES(?,?,?,?,?,?,?,?,?,?,?,NULL)',v.receipt_id,v.requirement_id,v.exhibit_id,'imported',v.source,v.covered_from,v.covered_to,v.added_by,v.added_by_name,v.added_at,v.sha256))
  }else throw new Error('Unsupported import target')
  statements.push(q('INSERT OR IGNORE INTO import_additions(kind,id,review_id,value_json) VALUES(?,?,?,?)',row.targetKind,row.targetId,v.review_id,value),q('INSERT INTO import_active(kind,id,revision,value_json) VALUES(?,?,?,?) ON CONFLICT(kind,id) DO UPDATE SET revision=excluded.revision,value_json=excluded.value_json',row.targetKind,row.targetId,row.revision,value))
  return statements
 },
 remove(destination,kind,id){return[q('DELETE FROM import_active WHERE kind=? AND id=?',kind,id)]},
 async list(db:D1Database){const {results}=await db.prepare('SELECT * FROM import_active ORDER BY kind,id').all();return results.map(decode)},
}
