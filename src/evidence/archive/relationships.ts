import { validateFeatureRecords } from './feature-records'
import { validatePeriodInvestigations } from '../agent/period-archive'
import { fail,columns,type Row } from './format'
import { groups,cadences,validDate } from '../model'
import { validateAgentArchive } from '../agent/archive'
import { staged,pages,type Store } from './registry'
import { fileQuery } from './files'
import { validatePlans } from './plan-stream'
const nullable=new Set(['receipts.supersedes','review_folders.closed_at','review_events.folder_id','review_events.exhibit_id'])
const timestamp=(v:unknown)=>typeof v==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().replace('.000Z','Z')===v.replace('.000Z','Z')
export function baseRow(table:string,row:Record<string,any>) {
 if(!Object.hasOwn(columns,table))return
 for(const c of columns[table as keyof typeof columns]){const v=row[c];if(v===null&&nullable.has(table+'.'+c))continue;if(table==='exhibits'&&c==='size'){if(!Number.isSafeInteger(v)||v<1||v>10*1024*1024)fail('Invalid exhibit size.');continue}if(typeof v!=='string'||!v||v.length>(c==='source'?1000:1024))fail('Invalid custody field.');if((c==='id'||c.endsWith('_id')||['added_by','supersedes'].includes(c))&&!/^[A-Za-z0-9_-]{1,128}$/.test(v))fail('Invalid record identity.');if(c.endsWith('_at')&&!timestamp(v))fail('Invalid custody timestamp.')}
 if(table==='controls'&&!(groups as readonly unknown[]).includes(row.group_name))fail('Unknown control group.')
 if(table==='requirements'&&!(cadences as readonly unknown[]).includes(row.cadence))fail('Unknown requirement cadence.')
 if(table==='receipts'&&(!['source-observed','manually-asserted','imported'].includes(row.origin)||!validDate(row.covered_from)||!validDate(row.covered_to)||row.covered_from>row.covered_to||! /^[a-f0-9]{64}$/.test(row.sha256)))fail('Invalid immutable receipt facts.')
 if(table==='review_folders'&&(!validDate(row.period_from)||!validDate(row.period_to)||row.period_from>row.period_to||row.expires_at<=row.created_at))fail('Invalid review folder dates.')
 if(table==='review_events'&&(!['page','list','receipt','download','unknown'].includes(row.action)||!['allowed','refused'].includes(row.outcome)))fail('Invalid review event.')
}
export async function validateRelationships(env:Store,id:string) {
 const t=(name:string)=>staged(id,name)
 const invalid=async(sql:string,message:string)=>{if(await env.DB.prepare(sql).first())fail(message)}
 await invalid(`SELECT 1 FROM ${t('exhibits')} e WHERE NOT EXISTS(SELECT 1 FROM ${t('receipts')} r WHERE r.exhibit_id=e.id) LIMIT 1`,'Exhibit has no immutable receipt.')
 await invalid(`SELECT 1 FROM ${t('receipts')} r JOIN ${t('receipts')} old ON old.id=r.supersedes WHERE old.requirement_id<>r.requirement_id OR old.id=r.id LIMIT 1`,'Invalid receipt supersession.')
 await invalid(`WITH RECURSIVE chain(start,id) AS (SELECT id,supersedes FROM ${t('receipts')} WHERE supersedes IS NOT NULL UNION SELECT chain.start,r.supersedes FROM chain JOIN ${t('receipts')} r ON r.id=chain.id WHERE r.supersedes IS NOT NULL) SELECT 1 FROM chain WHERE start=id LIMIT 1`,'Cyclic receipt supersession.')
 await invalid(`SELECT 1 FROM ${t('review_folders')} f WHERE NOT EXISTS(SELECT 1 FROM ${t('review_folder_controls')} c WHERE c.folder_id=f.id) LIMIT 1`,'Review folder has no selected controls.')
 await invalid(`SELECT object_key FROM (${fileQuery(id)}) GROUP BY object_key HAVING count(*)<>1 LIMIT 1`,'Duplicate original object key.')
 await invalid(`SELECT 1 FROM (${fileQuery(id)}) expected LEFT JOIN portable_files f ON f.session_id='${id}' AND f.object_key=expected.object_key WHERE f.ordinal IS NULL OR f.size<>expected.size OR f.sha256<>expected.sha256 LIMIT 1`,'Original file inventory contradicts custody.')
 await invalid(`SELECT 1 FROM portable_files f WHERE session_id='${id}' AND NOT EXISTS(SELECT 1 FROM (${fileQuery(id)}) e WHERE e.object_key=f.object_key) LIMIT 1`,'Unlisted original file.')
 await invalid(`SELECT 1 FROM ${t('import_reviews')} r WHERE r.object_key<>'import-sources/'||r.id OR r.archive_sha256<>json_extract(r.summary_json,'$.archive_sha256') OR (r.job_id IS NOT NULL AND r.approved_at IS NULL) LIMIT 1`,'Invalid import original custody.')
 await invalid(`SELECT 1 FROM ${t('import_additions')} a WHERE a.kind NOT IN ('control','receipt') OR json_extract(a.value_json,'$.review_id') IS NOT a.review_id OR json_extract(a.value_json,CASE a.kind WHEN 'control' THEN '$.control_id' ELSE '$.receipt_id' END) IS NOT a.id LIMIT 1`,'Invalid retained import addition.')
 await invalid(`SELECT 1 FROM ${t('import_active')} a JOIN ${t('import_additions')} b ON a.kind=b.kind AND a.id=b.id WHERE a.value_json IS NOT b.value_json OR typeof(a.revision)<>'text' LIMIT 1`,'Invalid import active custody.')
 await invalid(`SELECT 1 FROM ${t('import_additions')} a LEFT JOIN ${t('controls')} c ON c.id=a.id LEFT JOIN ${t('requirements')} r ON r.id=json_extract(a.value_json,'$.requirement_id') WHERE a.kind='control' AND (c.id IS NULL OR r.id IS NULL OR c.name IS NOT json_extract(a.value_json,'$.name') OR c.group_name IS NOT json_extract(a.value_json,'$.group') OR r.control_id IS NOT c.id OR r.name IS NOT json_extract(a.value_json,'$.proof') OR r.cadence IS NOT json_extract(a.value_json,'$.cadence')) LIMIT 1`,'Import control custody contradicts native records.')
 await invalid(`SELECT 1 FROM ${t('import_additions')} a LEFT JOIN ${t('receipts')} r ON r.id=a.id LEFT JOIN ${t('exhibits')} e ON e.id=json_extract(a.value_json,'$.exhibit_id') WHERE a.kind='receipt' AND (r.id IS NULL OR e.id IS NULL OR r.origin<>'imported' OR r.sha256 IS NOT json_extract(a.value_json,'$.sha256') OR r.requirement_id IS NOT json_extract(a.value_json,'$.requirement_id') OR r.exhibit_id IS NOT e.id OR e.object_key IS NOT json_extract(a.value_json,'$.object_key') OR e.size IS NOT json_extract(a.value_json,'$.size')) LIMIT 1`,'Import receipt custody contradicts native records.')
 await invalid(`SELECT 1 FROM ${t('resources')} WHERE source_kind='source-reported' GROUP BY type,unique_id HAVING count(*)>1 LIMIT 1`,'Duplicate public API resource identity.')
 await validatePlans(env,id)
 await validatePeriodInvestigations(env,id)
 await validateFeatureRecords(env,id)
 const empty={controls:[],agent_tokens:[],agent_proposals:[],agent_decisions:[],review_folders:[],review_folder_controls:[]} as Record<string,Row[]>
 for await(const tokens of pages(env,'agent_tokens',t('agent_tokens')))await validateAgentArchive({...empty,agent_tokens:tokens})
 for await(const proposals of pages(env,'agent_proposals',t('agent_proposals')))for(const p of proposals){
  let input:any;try{input=JSON.parse(String(p.input_json))}catch{fail('Invalid proposal input.')}
  if(!Array.isArray(input.control_ids)||input.control_ids.length>500)fail('Invalid proposal scope.')
  const controls=(await env.DB.prepare(`SELECT * FROM ${t('controls')} WHERE id IN (SELECT value FROM json_each(?))`).bind(JSON.stringify(input.control_ids)).all<Row>()).results
  const token=await env.DB.prepare(`SELECT * FROM ${t('agent_tokens')} WHERE id=?`).bind(p.token_id).first<Row>()
  const decision=await env.DB.prepare(`SELECT * FROM ${t('agent_decisions')} WHERE proposal_id=?`).bind(p.id).first<Row>()
  const folders=decision?.folder_id?(await env.DB.prepare(`SELECT * FROM ${t('review_folders')} WHERE id=?`).bind(decision.folder_id).all<Row>()).results:[]
  const selections=decision?.folder_id?(await env.DB.prepare(`SELECT * FROM ${t('review_folder_controls')} WHERE folder_id=?`).bind(decision.folder_id).all<Row>()).results:[]
  await validateAgentArchive({...empty,controls,agent_tokens:token?[token]:[],agent_proposals:[p],agent_decisions:decision?[decision]:[],review_folders:folders,review_folder_controls:selections})
 }
}
