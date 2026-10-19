import type { Bindings } from '../../auth.server'
import { auditStatement, oneOf, text, type Actor, type Input } from '../door'
import { cadences, groups } from '../model'
import { Refusal } from '../upload'
import { scheduleAt, type ScheduleRow } from '../cadence'
export interface Definition { id: string; control_id: string; revision: number; name: string; group_name: string; applicability: string; test_intent: string; evaluation_criteria: string; actor_id: string; actor_name: string; reason: string; effective_at: string }
export async function definitions(env: Bindings, id: string): Promise<Definition[]> {
 const rows = (await env.DB.prepare('SELECT * FROM control_revisions WHERE control_id=? ORDER BY revision').bind(id).all<Definition>()).results
 if (rows.length) return rows
 const row = await env.DB.prepare('SELECT * FROM controls WHERE id=?').bind(id).first<{name:string;group_name:string;created_at:string}>()
 if (!row) throw new Refusal('Control not found.',404)
 return [{ id:'', control_id:id, revision:1, name:row.name, group_name:row.group_name, applicability:'Included', test_intent:'', evaluation_criteria:'', actor_id:'not recorded', actor_name:'Not recorded in original definition', reason:'Original stored definition', effective_at:row.created_at }]
}
function definitionStatement(env: Bindings, row: Definition) {
 return env.DB.prepare('INSERT INTO control_revisions(id,control_id,revision,name,group_name,applicability,test_intent,evaluation_criteria,actor_id,actor_name,reason,effective_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').bind(row.id || crypto.randomUUID(),row.control_id,row.revision,row.name,row.group_name,row.applicability,row.test_intent,row.evaluation_criteria,row.actor_id,row.actor_name,row.reason,row.effective_at)
}
export async function reviseControl(env: Bindings, actor: Actor, id: string, input: Input, now: Date) {
 const rows=await definitions(env,id), prior=rows.at(-1)!, expected=Number(input.revision)
 if (expected!==prior.revision) throw new Refusal('The control changed; review its current revision.',409)
 const revision=prior.revision+1, row: Definition={id:crypto.randomUUID(),control_id:id,revision,name:text(input,'name'),group_name:oneOf(input,'group',groups),applicability:text(input,'applicability',1000),test_intent:text(input,'test_intent',3000),evaluation_criteria:text(input,'evaluation_criteria',3000),actor_id:actor.id,actor_name:actor.name,reason:text(input,'reason',500),effective_at:now.toISOString()}
 await env.DB.batch([...(rows[0].id ? [] : [definitionStatement(env,rows[0])]),definitionStatement(env,row),env.DB.prepare('UPDATE controls SET name=?,group_name=? WHERE id=?').bind(row.name,row.group_name,id),auditStatement(env,actor,'control.revised','control:'+id,now,'succeeded',row.reason)])
 return {revision}
}
export async function addRequirement(env: Bindings, actor: Actor, control: string, input: Input, now: Date) {
 await definitions(env,control)
 const id=crypto.randomUUID(), name=text(input,'name'), cadence=oneOf(input,'cadence',cadences),at=now.toISOString()
 await env.DB.batch([env.DB.prepare('INSERT INTO requirements(id,control_id,name,cadence,created_at) VALUES(?,?,?,?,?)').bind(id,control,name,cadence,at),env.DB.prepare('INSERT INTO requirement_revisions(id,requirement_id,revision,name,actor_id,actor_name,reason,effective_at) VALUES(?,?,1,?,?,?,?,?)').bind(crypto.randomUUID(),id,name,actor.id,actor.name,'Requirement created',at),auditStatement(env,actor,'requirement.created','control:'+control,now,'succeeded',name)])
 return {id}
}
export async function reviseRequirement(env: Bindings, actor: Actor, id: string, input: Input, now: Date) {
 const row=await env.DB.prepare('SELECT * FROM requirements WHERE id=?').bind(id).first<{name:string;created_at:string}>()
 if(!row)throw new Refusal('Requirement not found.',404)
 const prior=await env.DB.prepare('SELECT MAX(revision) AS revision FROM requirement_revisions WHERE requirement_id=?').bind(id).first<{revision:number|null}>(),name=text(input,'name'),reason=text(input,'reason',500)
 const insert=(revision:number,n:string,a:Actor,r:string,at:string)=>env.DB.prepare('INSERT INTO requirement_revisions(id,requirement_id,revision,name,actor_id,actor_name,reason,effective_at) VALUES(?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),id,revision,n,a.id,a.name,r,at)
 await env.DB.batch([...(prior?.revision ? [] : [insert(1,row.name,{id:'not recorded',name:'Not recorded in original definition'},'Original stored definition',row.created_at)]),insert((prior?.revision??1)+1,name,actor,reason,now.toISOString()),env.DB.prepare('UPDATE requirements SET name=? WHERE id=?').bind(name,id),auditStatement(env,actor,'requirement.revised','requirement:'+id,now,'succeeded',reason)])
}
// A run retains the actual control/evidence definitions and structured test
// criteria it evaluated. Future edits never reinterpret its earlier result.
export async function runDefinitions(env: Bindings, test: string, run: string, now: Date) {
 const links=(await env.DB.prepare('SELECT control_id FROM test_controls WHERE test_id=?').bind(test).all<{control_id:string}>()).results
 const out:D1PreparedStatement[]=[]
 for(const {control_id:id} of links){
  const definition=(await definitions(env,id)).at(-1)!
  const requirements=(await env.DB.prepare('SELECT * FROM requirements WHERE control_id=? ORDER BY created_at,id').bind(id).all<{id:string;name:string;cadence:string}>()).results
  const schedules=(await env.DB.prepare('SELECT s.* FROM requirement_schedules s JOIN requirements q ON q.id=s.requirement_id WHERE q.control_id=? ORDER BY s.effective_from,s.rowid').bind(id).all<ScheduleRow>()).results
  const snapshot={definition,requirements:requirements.map(q=>({...q,schedule:scheduleAt(q.cadence as Parameters<typeof scheduleAt>[0],schedules.filter(s=>s.requirement_id===q.id),now.getTime())}))}
  out.push(env.DB.prepare('INSERT INTO run_control_definitions(run_id,control_id,control_revision,snapshot_json) VALUES(?,?,?,?)').bind(run,id,definition.revision,JSON.stringify(snapshot)))
 }
 return out
}
