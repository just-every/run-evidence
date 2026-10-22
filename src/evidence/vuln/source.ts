import type {Bindings} from '../../auth.server'
import type {Connection} from '../connect/storage'
import type {CodeFinding} from '../connect/github-findings'
import {sourceReadTime} from '../connect/pages'
import {sourceAuthorities,sourceAuthorityGap} from '../connect/source-authority'
import {digest} from '../api/tokens'
import {upsertResources,type ResourceSchema} from '../resources'
const schema:ResourceSchema={fields:{provider:'string',repository:'string',kind:'string',number:'number',state:'string',severity:'string',cve:'string',ghsa:'string',package:'string',ecosystem:'string',created_at:'string',updated_at:'string',resolved_at:'string',source_url:'string',readable:'boolean'},required:[]}
// Source findings never enter the manual penetration-test closure path. A
// provider's fixed/dismissed/resolved state is not an independent verified retest.
export async function retainSourceFindings(env:Bindings,c:Connection,rows:CodeFinding[],now:Date){
 const ref='github-findings:'+c.id,source={kind:'source-observed' as const,ref,label:'GitHub '+c.account+' alert metadata via '+c.label}
 const known=(await env.DB.prepare("SELECT unique_id,display_name,attributes_json FROM resources WHERE type='code.finding' AND source_ref=? AND removed_at IS NULL").bind(ref).all<{unique_id:string;display_name:string;attributes_json:string}>()).results
 const items=await Promise.all(rows.map(async r=>({uniqueId:await digest(r.repository+':'+r.kind+':'+r.number),displayName:r.repository+' '+r.kind+' #'+r.number,attributes:{...r}})))
 const current=new Set(items.map(r=>r.uniqueId))
 // An absent or unreadable alert stays in the denominator, with its previous
 // fact/history retained. Absence never fabricates closure or verification.
 for(const old of known)if(!current.has(old.unique_id))items.push({uniqueId:old.unique_id,displayName:old.display_name,attributes:{...JSON.parse(old.attributes_json),readable:false}})
 const ids:string[]=[]
 for(let i=0;i<items.length;i+=200){const written=await upsertResources(env,'code.finding',schema,items.slice(i,i+200),source,false,now);if(written.results.some(r=>r.outcome==='rejected'))throw Error('Normalized source finding refused');ids.push(...written.results.filter(r=>r.id&&current.has(r.uniqueId)).map(r=>r.id!))}
 if(ids.length)await env.DB.prepare('UPDATE resources SET observed_at=? WHERE id IN (SELECT value FROM json_each(?))').bind(sourceReadTime(now),JSON.stringify(ids)).run()
 return {read:rows.length,unavailable:known.filter(r=>!current.has(r.unique_id)).length}
}
export async function sourceFindings(env:Bindings,now:Date){
 const attempts=new Map((await env.DB.prepare('SELECT c.id,(SELECT outcome FROM collection_runs r WHERE r.connection_id=c.id ORDER BY started_at DESC,rowid DESC LIMIT 1) AS outcome FROM connections c').all<{id:string;outcome:string|null}>()).results.map(r=>[r.id,r.outcome]))
 const rows=(await env.DB.prepare("SELECT id,source_ref,source_label,attributes_json,observed_at FROM resources WHERE type='code.finding' AND removed_at IS NULL ORDER BY source_ref,unique_id").all<{id:string;source_ref:string;source_label:string;attributes_json:string;observed_at:string|null}>()).results,authorities=await sourceAuthorities(env)
 return rows.map(r=>{const a=JSON.parse(r.attributes_json) as CodeFinding,authority=sourceAuthorityGap(r.source_ref,authorities),attempt=attempts.get(r.source_ref.split(':').at(-1)!),failure=attempt!=='complete'&&attempt!=='partial'?'Latest source attempt is '+(attempt??'incomplete')+'; previous finding facts do not establish current coverage':null,gap=authority??failure??(!r.observed_at||now.getTime()-Date.parse(r.observed_at)>150*60000?'Source read is stale; a fresh authorized read is required':null),available=a.readable&&!gap;return {id:r.id,source_ref:r.source_ref,source_label:r.source_label,observed_at:r.observed_at,...a,readable:!!available,current_state:available?a.state:'unknown',collection_gap:gap??(a.readable?null:'Not returned by the latest readable source scope; prior facts are retained, never verified closed'),verification:'Provider state only; no independent retest or verified closure'}})
}
