import { tokenDigest } from '../review/storage'
import { validDate } from '../model'
import { fail } from '../archive/format'
import { pages,staged,type Store } from '../archive/registry'
export async function validatePeriodInvestigations(env:Store,session:string) {
 const t=(name:string)=>staged(session,name)
 for await(const rows of pages(env,'period_investigations',t('period_investigations')))for(const row of rows) {
  if(!validDate(row.period_from)||!validDate(row.period_to)||String(row.period_from)>String(row.period_to)||typeof row.snapshot_json!=='string'||new TextEncoder().encode(row.snapshot_json).length>512*1024||await tokenDigest(row.snapshot_json)!==row.snapshot_hash)fail('Invalid retained period investigation.')
  let snapshot:any;try{snapshot=JSON.parse(row.snapshot_json)}catch{fail('Invalid period investigation JSON.')}
  if(snapshot.control_id!==row.control_id||snapshot.from!==row.period_from||snapshot.to!==row.period_to||!Array.isArray(snapshot.findings)||!Array.isArray(snapshot.observations)||!Array.isArray(snapshot.changes)||!Array.isArray(snapshot.definitions)||!Array.isArray(snapshot.scope))fail('Period investigation contradicts its scope.')
 }
 if(await env.DB.prepare(`SELECT 1 FROM ${t('period_investigation_decisions')} d JOIN ${t('period_investigations')} i ON i.id=d.investigation_id WHERE d.snapshot_hash<>i.snapshot_hash OR d.decided_at<i.created_at OR d.action NOT IN ('reviewed','rejected') OR length(d.reason)=0 LIMIT 1`).first())fail('Invalid period investigation decision.')
}
