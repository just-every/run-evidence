import type { Bindings } from '../../auth.server'
import { text,oneOf,auditStatement,type Actor,type Input } from '../door'
import { Refusal } from '../upload'
import { sha } from '../archive/format'
export interface Source {id:string;kind:string;source_id:string;quote:string;revision:string;period_from:string;period_to:string;state:string;href:string;fingerprint:string}
export async function resolveSource(env:Bindings,kind:string,id:string,quote:string):Promise<Omit<Source,'id'>> {
 let body='',revision='',from='',to='',state='',href=''
 if(kind==='policy'){
  const p=await env.DB.prepare("SELECT r.*,p.title FROM policy_revisions r JOIN policies p ON p.id=r.policy_id WHERE r.id=? AND r.status IN ('approved','published') AND r.approved_sha256=r.body_sha256 AND NOT EXISTS(SELECT 1 FROM policy_revisions n WHERE n.policy_id=r.policy_id AND n.version>r.version AND n.status IN ('approved','published'))").bind(id).first<any>()
  if(!p)throw new Refusal('Select an exact approved policy revision.',409)
  body=p.body;revision=p.body_sha256;from=p.effective_date??p.decided_at.slice(0,10);to=p.review_due??'';state='approved';href=`/app/policies/${p.policy_id}/revisions/${p.id}`
 }else if(kind==='observation'){
  const o=await env.DB.prepare('SELECT * FROM observations WHERE id=?').bind(id).first<any>();if(!o)throw new Refusal('Observation not found.',404)
  body=JSON.stringify({result:o.result,expected:o.expected_json,actual:o.actual_json,reason:o.reason});revision=await sha(new TextEncoder().encode(JSON.stringify(o)));from=o.interval_from??o.observed_at;to=o.observed_at;state=o.result;href='/app/tests/'+o.test_id
 }else throw new Refusal('Only approved policy and original observation sources are implemented. Audit-report and approved-answer sources remain unavailable.')
 if(!body.includes(quote))throw new Refusal('The passage is not present in this authorized source revision.')
 const value={kind,source_id:id,quote,revision,period_from:from,period_to:to,state,href};return {...value,fingerprint:await sha(new TextEncoder().encode(JSON.stringify(value)))}
}
export async function addSource(env:Bindings,input:Input,actor:Actor,now:Date){const kind=oneOf(input,'kind',['policy','observation'] as const),sid=text(input,'source_id',128),quote=text(input,'quote',10000);await resolveSource(env,kind,sid,quote);const id=crypto.randomUUID();await env.DB.batch([env.DB.prepare('INSERT INTO questionnaire_sources VALUES(?,?,?,?,?,?)').bind(id,kind,sid,quote,actor.name,now.toISOString()),auditStatement(env,actor,'questionnaire.source-selected','questionnaire-source:'+id,now)]);return {id}}
export async function sources(env:Bindings):Promise<Source[]> {
 const rows=(await env.DB.prepare('SELECT * FROM questionnaire_sources ORDER BY registered_at,rowid').all<any>()).results,out:Source[]=[]
 for(const r of rows){try{out.push({id:r.id,...await resolveSource(env,r.kind,r.source_id,r.quote)})}catch(error){if(!(error instanceof Refusal))throw error}}
 return out
}
export async function assertSources(env:Bindings,citations:Source[]) {for(const c of citations){let live;try{live=await resolveSource(env,c.kind,c.source_id,c.quote)}catch{throw new Refusal('A cited source is no longer approved or available. Draft again and obtain a new decision.',409)}if(live.fingerprint!==c.fingerprint)throw new Refusal('A cited revision or period changed. Draft again and obtain a new decision.',409)}}
