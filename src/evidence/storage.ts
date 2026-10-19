import { activeControl, activeReceipt } from './visibility'
import type { Bindings } from '../auth.server'
import { day, type Receipt, type Requirement } from './model'
import { renewal, scheduleAt, type Override, type ScheduleRow } from './cadence'
const receiptSelect = `SELECT r.*, e.object_key,e.filename,e.size,e.media_type, (SELECT n.id FROM receipts n WHERE n.supersedes=r.id) AS superseded_by, (SELECT d.effective_date FROM receipt_effective_dates d WHERE d.receipt_id=r.id) AS effective_date, (SELECT a.token_name FROM api_evidence a WHERE a.receipt_id=r.id) AS pushed_by_token FROM receipts r JOIN exhibits e ON e.id=r.exhibit_id`
export async function storedBytes(env: Bindings, row: Receipt): Promise<ArrayBuffer | null> {
 try {
  const object = await env.EXHIBITS.get(row.object_key)
  if (!object) return null
  const bytes = await object.arrayBuffer()
  const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(n => n.toString(16).padStart(2,'0')).join('')
  return digest === row.sha256 && bytes.byteLength === row.size ? bytes : null
 } catch { return null }
}
export async function history(env: Bindings, requirement?: string): Promise<Receipt[]> {
 const sql = receiptSelect + ' WHERE '+activeReceipt('r')+(requirement ? ' AND r.requirement_id=?' : '') + ' ORDER BY r.added_at DESC, r.id'
 const statement = env.DB.prepare(sql)
 const { results } = await (requirement ? statement.bind(requirement) : statement).all<Receipt>()
 return Promise.all(results.map(async r => ({ ...r, available: !!await storedBytes(env,r) })))
}
// Each requirement's state at the selected date under the schedule in force
// then; calendar anchors on the four desk periods keep the GAP-001 logic.
export async function desk(env: Bindings, selected: string, now: Date) {
 const [requirements, schedules, overrides, adoptions, controlsHistory, requirementHistory] = await env.DB.batch([
  env.DB.prepare('SELECT r.*,c.name AS control_name,c.group_name FROM requirements r JOIN controls c ON c.id=r.control_id WHERE '+activeControl('c')+' ORDER BY c.created_at,c.id'),
  env.DB.prepare('SELECT * FROM requirement_schedules ORDER BY effective_from,rowid'),
  env.DB.prepare('SELECT requirement_id,cycle_due,due_date,reason,actor_name FROM renewal_overrides ORDER BY at,rowid'),
  env.DB.prepare('SELECT control_id,library_id FROM library_adoptions'),
  env.DB.prepare('SELECT control_id,name,group_name,effective_at FROM control_revisions ORDER BY revision'),
  env.DB.prepare('SELECT requirement_id,name,effective_at FROM requirement_revisions ORDER BY revision'),
 ])
 const receipts = await history(env)
 const instant = selected === day(now) ? now.getTime() : Math.min(now.getTime(), Date.parse(selected + 'T00:00:00Z') + 86399999)
 const library = new Map((adoptions.results as { control_id: string; library_id: string }[]).map(a => [a.control_id, a.library_id]))
 return { selected, requirements: (requirements.results as Requirement[]).map(original => {
  const r={...original}
  const priorControl=(controlsHistory.results as {control_id:string;name:string;group_name:string;effective_at:string}[]).filter(d=>d.control_id===r.control_id&&Date.parse(d.effective_at)<=instant).at(-1)
  const priorRequirement=(requirementHistory.results as {requirement_id:string;name:string;effective_at:string}[]).filter(d=>d.requirement_id===r.id&&Date.parse(d.effective_at)<=instant).at(-1)
  if(priorControl){r.control_name=priorControl.name;r.group_name=priorControl.group_name as Requirement['group_name']}
  if(priorRequirement)r.name=priorRequirement.name
  const rows = receipts.filter(row => row.requirement_id === r.id)
  const schedule = scheduleAt(r.cadence, (schedules.results as ScheduleRow[]).filter(s => s.requirement_id === r.id), instant)
  const state = renewal(schedule, selected, rows, (overrides.results as (Override & { requirement_id: string })[]).filter(o => o.requirement_id === r.id), now)
  return { ...r, library_id: library.get(r.control_id) ?? null, gap: state.gap, renewal: state, receipts: rows }
 }) }
}
export async function receipt(env: Bindings, id: string) {
 return env.DB.prepare(receiptSelect + ' WHERE r.id=?').bind(id).first<Receipt>()
}
export async function createControl(env: Bindings, name: string, group: string, proof: string, cadence: string, now: Date) {
 const id = crypto.randomUUID(), requirement = crypto.randomUUID(), created = now.toISOString()
 await env.DB.batch([
  env.DB.prepare('INSERT INTO controls(id,name,group_name,created_at) VALUES(?,?,?,?)').bind(id,name,group,created),
  env.DB.prepare('INSERT INTO requirements(id,control_id,name,cadence,created_at) VALUES(?,?,?,?,?)').bind(requirement,id,proof,cadence,created),
 ])
 return { id, requirement }
}
