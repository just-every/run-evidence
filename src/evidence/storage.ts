import { activeControl, activeReceipt } from './visibility'
import type { Bindings } from '../auth.server'
import { gap, type Receipt, type Requirement } from './model'
const receiptSelect = `SELECT r.*, e.object_key,e.filename,e.size,e.media_type, (SELECT n.id FROM receipts n WHERE n.supersedes=r.id) AS superseded_by FROM receipts r JOIN exhibits e ON e.id=r.exhibit_id`
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
export async function desk(env: Bindings, selected: string, now: Date) {
 const { results } = await env.DB.prepare('SELECT r.*,c.name AS control_name,c.group_name FROM requirements r JOIN controls c ON c.id=r.control_id WHERE '+activeControl('c')+' ORDER BY c.created_at,c.id').all<Requirement>()
 const receipts = await history(env)
 return { selected, requirements: results.map(r => { const rows = receipts.filter(row => row.requirement_id === r.id); return { ...r, gap: gap(r.cadence, selected, rows, now), receipts: rows } }) }
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
