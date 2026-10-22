import type {Bindings} from '../../auth.server'
import {Refusal} from '../upload'
import {auditStatement,list,text,type Actor,type Input} from '../door'
import {requireConnection} from './storage'
import {digest} from '../api/tokens'
export async function productionEnvironments(env:Bindings,actor:Actor,id:string,input:Input,now:Date){
 const c=await requireConnection(env,id);if(c.provider!=='bitbucket')throw new Refusal('Production environment review is not available for this provider.')
 const latest=await env.DB.prepare('SELECT id,coverage_json FROM collection_runs WHERE connection_id=? AND outcome IS NOT NULL ORDER BY started_at DESC,rowid DESC LIMIT 1').bind(id).first<{id:string;coverage_json:string}>()
 if(!latest||input.source_run!==latest.id)throw new Refusal('Review the latest source history before classifying environments.',409)
 const history=JSON.parse(latest.coverage_json).code_history??{},known=new Set(Object.values(history).flatMap((h:any)=>(h.deployments??[]).map((d:any)=>d.environment_key)))
 const selected=list(input,'production_environments',50),reason=text(input,'reason',500)
 if(selected.some(key=>!known.has(key)))throw new Refusal('Choose only an environment in this exact source snapshot.')
 const revision=await digest(JSON.stringify(selected.sort())),same="EXISTS(SELECT 1 FROM collection_runs r WHERE r.id=? AND r.id=(SELECT id FROM collection_runs WHERE connection_id=? AND outcome IS NOT NULL ORDER BY started_at DESC,rowid DESC LIMIT 1))"
 const changed=await env.DB.batch([
  env.DB.prepare(`UPDATE connections SET config_json=json_set(config_json,'$.production_environments',json(?)) WHERE id=? AND ${same}`).bind(JSON.stringify(selected),id,latest.id,id),
  env.DB.prepare(`INSERT INTO product_audit(id,actor_kind,actor_id,actor_name,action,subject,outcome,detail,at,reason,revision) SELECT ?,'owner',?,?,'code.environments-reviewed',?,'succeeded',?,?,?,? WHERE ${same}`).bind(crypto.randomUUID(),actor.id,actor.name,'connection:'+id,'Owner-classified production environments; source run '+latest.id,now.toISOString(),reason,revision,latest.id,id),
 ])
 if(!changed[0].meta.changes)throw new Refusal('Source history changed during review; reload and review it again.',409)
 return {saved:true,production_environments:selected,source_run:latest.id}
}
