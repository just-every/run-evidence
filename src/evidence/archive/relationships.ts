import { validateEngagements } from '../review/engagement/validate'
import { classIds } from '../import/bundle/classes'
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
 if(table==='promise_dependencies'){
  let source:any;try{source=JSON.parse(row.source_json)}catch{fail('Invalid promise source snapshot.')}
  if(!['answer','trust'].includes(row.subject_kind)||!source||typeof source.kind!=='string'||typeof source.source_id!=='string'||typeof source.quote!=='string'||typeof source.href!=='string'||!/^\/app\//.test(source.href)||! /^[a-f0-9]{64}$/.test(source.fingerprint))fail('Invalid promise dependency.')
 }
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
 const checks:{statement:D1PreparedStatement;message:string}[]=[]
 const invalid=(sql:string,message:string)=>{checks.push({statement:env.DB.prepare(sql),message})}
 invalid(`SELECT 1 FROM ${t('promise_dependencies')} d WHERE (d.subject_kind='answer' AND NOT EXISTS(SELECT 1 FROM ${t('questionnaire_drafts')} a WHERE a.id=d.subject_id)) OR (d.subject_kind='trust' AND NOT EXISTS(SELECT 1 FROM ${t('trust_updates')} u WHERE u.id=d.subject_id)) LIMIT 1`,'Promise dependency has no exact subject revision.')
 invalid(`SELECT 1 FROM ${t('exhibits')} e WHERE NOT EXISTS(SELECT 1 FROM ${t('receipts')} r WHERE r.exhibit_id=e.id) LIMIT 1`,'Exhibit has no immutable receipt.')
 invalid(`SELECT 1 FROM ${t('receipts')} r JOIN ${t('receipts')} old ON old.id=r.supersedes WHERE old.requirement_id<>r.requirement_id OR old.id=r.id LIMIT 1`,'Invalid receipt supersession.')
 invalid(`WITH RECURSIVE chain(start,id) AS (SELECT id,supersedes FROM ${t('receipts')} WHERE supersedes IS NOT NULL UNION SELECT chain.start,r.supersedes FROM chain JOIN ${t('receipts')} r ON r.id=chain.id WHERE r.supersedes IS NOT NULL) SELECT 1 FROM chain WHERE start=id LIMIT 1`,'Cyclic receipt supersession.')
 invalid(`SELECT 1 FROM ${t('review_folders')} f WHERE NOT EXISTS(SELECT 1 FROM ${t('review_folder_controls')} c WHERE c.folder_id=f.id) LIMIT 1`,'Review folder has no selected controls.')
 invalid(`SELECT object_key FROM (${fileQuery(id)}) GROUP BY object_key HAVING count(*)<>1 LIMIT 1`,'Duplicate original object key.')
 invalid(`SELECT 1 FROM (${fileQuery(id)}) expected LEFT JOIN portable_files f ON f.session_id='${id}' AND f.object_key=expected.object_key WHERE f.ordinal IS NULL OR f.size<>expected.size OR f.sha256<>expected.sha256 LIMIT 1`,'Original file inventory contradicts custody.')
 invalid(`SELECT 1 FROM portable_files f WHERE session_id='${id}' AND NOT EXISTS(SELECT 1 FROM (${fileQuery(id)}) e WHERE e.object_key=f.object_key) LIMIT 1`,'Unlisted original file.')
 invalid(`SELECT 1 FROM ${t('import_reviews')} r WHERE r.object_key<>'import-sources/'||r.id OR r.archive_sha256<>json_extract(r.summary_json,'$.archive_sha256') OR (r.job_id IS NOT NULL AND r.approved_at IS NULL) LIMIT 1`,'Invalid import original custody.')
 invalid(`SELECT 1 FROM ${t('import_additions')} a WHERE a.kind NOT IN ('control','receipt','record') OR json_extract(a.value_json,'$.review_id') IS NOT a.review_id OR (a.kind='record' AND (json_extract(a.value_json,'$.origin') IS NOT 'imported' OR json_extract(a.value_json,'$.verified') IS NOT 0 OR json_extract(a.value_json,'$.source_id') IS NULL OR json_extract(a.value_json,'$.class') NOT IN (${classIds.map(c=>`'${c}'`).join(',')}))) OR (a.kind<>'record' AND json_extract(a.value_json,CASE a.kind WHEN 'control' THEN '$.control_id' ELSE '$.receipt_id' END) IS NOT a.id) LIMIT 1`,'Invalid retained import addition.')
 invalid(`SELECT 1 FROM ${t('import_active')} a JOIN ${t('import_additions')} b ON a.kind=b.kind AND a.id=b.id WHERE a.value_json IS NOT b.value_json OR typeof(a.revision)<>'text' LIMIT 1`,'Invalid import active custody.')
 invalid(`SELECT 1 FROM ${t('import_additions')} a LEFT JOIN ${t('controls')} c ON c.id=a.id LEFT JOIN ${t('requirements')} r ON r.id=json_extract(a.value_json,'$.requirement_id') WHERE a.kind='control' AND (c.id IS NULL OR r.id IS NULL OR c.name IS NOT json_extract(a.value_json,'$.name') OR c.group_name IS NOT json_extract(a.value_json,'$.group') OR r.control_id IS NOT c.id OR r.name IS NOT json_extract(a.value_json,'$.proof') OR r.cadence IS NOT json_extract(a.value_json,'$.cadence')) LIMIT 1`,'Import control custody contradicts native records.')
 invalid(`SELECT 1 FROM ${t('import_additions')} a LEFT JOIN ${t('receipts')} r ON r.id=a.id LEFT JOIN ${t('exhibits')} e ON e.id=json_extract(a.value_json,'$.exhibit_id') WHERE a.kind='receipt' AND (r.id IS NULL OR e.id IS NULL OR r.origin<>'imported' OR r.sha256 IS NOT json_extract(a.value_json,'$.sha256') OR r.requirement_id IS NOT json_extract(a.value_json,'$.requirement_id') OR r.exhibit_id IS NOT e.id OR e.object_key IS NOT json_extract(a.value_json,'$.object_key') OR e.size IS NOT json_extract(a.value_json,'$.size')) LIMIT 1`,'Import receipt custody contradicts native records.')
 invalid(`SELECT 1 FROM ${t('resources')} WHERE source_kind='source-reported' GROUP BY type,unique_id HAVING count(*)>1 LIMIT 1`,'Duplicate public API resource identity.')
 for(let offset=0;offset<checks.length;offset+=100){
  const group=checks.slice(offset,offset+100)
  const results=await env.DB.batch(group.map(check=>check.statement))
  for(let i=0;i<group.length;i++)if(results[i].results.length)fail(group[i].message)
 }
 await validatePlans(env,id)
 await validatePeriodInvestigations(env,id)
 await validateFeatureRecords(env,id)
 await validateEngagements(env,id)
 const empty={controls:[],agent_tokens:[],agent_proposals:[],agent_decisions:[],review_folders:[],review_folder_controls:[]} as Record<string,Row[]>
 for await(const tokens of pages(env,'agent_tokens',t('agent_tokens')))await validateAgentArchive({...empty,agent_tokens:tokens})
 for await(const proposals of pages(env,'agent_proposals',t('agent_proposals')))for(const p of proposals){
  let input:any;try{input=JSON.parse(String(p.input_json))}catch{fail('Invalid proposal input.')}
  if(!Array.isArray(input.control_ids)||input.control_ids.length>500)fail('Invalid proposal scope.')
  const [controlRows,tokenRows,decisionRows]=await env.DB.batch<Row>([
   env.DB.prepare(`SELECT * FROM ${t('controls')} WHERE id IN (SELECT value FROM json_each(?))`).bind(JSON.stringify(input.control_ids)),
   env.DB.prepare(`SELECT * FROM ${t('agent_tokens')} WHERE id=?`).bind(p.token_id),
   env.DB.prepare(`SELECT * FROM ${t('agent_decisions')} WHERE proposal_id=?`).bind(p.id),
  ])
  const controls=controlRows.results,token=tokenRows.results[0],decision=decisionRows.results[0]
  const [folderRows,selectionRows]=decision?.folder_id?await env.DB.batch<Row>([
   env.DB.prepare(`SELECT * FROM ${t('review_folders')} WHERE id=?`).bind(decision.folder_id),
   env.DB.prepare(`SELECT * FROM ${t('review_folder_controls')} WHERE folder_id=?`).bind(decision.folder_id),
  ]):[]
  const folders=folderRows?.results??[],selections=selectionRows?.results??[]
  await validateAgentArchive({...empty,controls,agent_tokens:token?[token]:[],agent_proposals:[p],agent_decisions:decision?[decision]:[],review_folders:folders,review_folder_controls:selections})
 }
}
