import type { Bindings } from '../../auth.server'
import { Refusal } from '../upload'
import { auditStatement, text, type Actor, type Input } from '../door'
import { seal, unseal } from '../connect/custody'
import { reconnectUpdate, startRun } from '../connect/runs'
import type { Connection } from '../connect/storage'
import { course } from './courses'
import { importKnowBe4 } from './storage'
// KnowBe4 Reporting API (read-only API key): training enrollments become
// source-reported completions, mapped to a shipped course by module name.
const regions = ['us', 'eu', 'ca', 'uk', 'de'] as const
const base = (region: string) => `https://${region}.api.knowbe4.com`
async function get(url: string, key: string) {
 let response: Response
 try { response = await fetch(url, { headers: { authorization: 'Bearer ' + key, accept: 'application/json' }, redirect: 'manual', signal: AbortSignal.timeout(20000) }) } catch { return { status: 0, body: null } }
 return { status: response.status, body: response.status === 200 ? await response.json() as unknown : null }
}
const config = (c: Pick<Connection, 'config_json'>) => { try { return JSON.parse(c.config_json) as { region: string; modules: Record<string, string> } } catch { return { region: 'us', modules: {} } } }
function parseModules(value: unknown) {
 const modules: Record<string, string> = {}
 for (const line of String(value ?? '').split('\n').map(l => l.trim()).filter(Boolean)) {
  const m = /^(.{1,200}?)\s*=\s*([a-z-]{3,40})$/.exec(line)
  if (!m || !course(m[2])) throw new Refusal('Map each KnowBe4 module as "Module name = course id" (security-awareness, hipaa-workforce or secure-coding).')
  modules[m[1].toLowerCase()] = m[2]
 }
 return modules
}
export async function connectKnowBe4(env: Bindings, actor: Actor, input: Input, now: Date) {
 const region = String(input.region || 'us'), key = text(input, 'secret', 2000), modules = parseModules(input.module_map)
 if (!(regions as readonly string[]).includes(region)) throw new Refusal('Choose the KnowBe4 region: us, eu, ca, uk or de.')
 const account = await get(`${base(region)}/v1/account`, key)
 if (account.status === 401 || account.status === 403) throw new Refusal('KnowBe4 refused the API key.')
 if (account.status !== 200) throw new Refusal(`KnowBe4 answered ${account.status || 'nothing'}.`)
 const name = String((account.body as { name?: string }).name ?? 'KnowBe4 account'), id = crypto.randomUUID(), sealed = await seal(env, key, id)
 await env.DB.batch([env.DB.prepare("INSERT INTO connections(id,provider,label,account,api_base,secret_ciphertext,secret_iv,granted_scopes,status,created_by,created_name,created_at,config_json) VALUES(?,'knowbe4',?,?,?,?,?,'[\"Reporting API (read)\"]','active',?,?,?,?)").bind(id, text(input, 'label', 120, true) || 'KnowBe4 ' + name, name, base(region), sealed.ciphertext, sealed.iv, actor.id, actor.name, now.toISOString(), JSON.stringify({ region, modules })), auditStatement(env, actor, 'connection.authorized', 'connection:' + id, now, 'succeeded', 'knowbe4 ' + name)])
 return { id, account: name }
}
export async function rotateKnowBe4(env: Bindings, actor: Actor, row: Connection, input: Input, now: Date) {
 const key = text(input, 'secret', 2000), check = await get(`${base(config(row).region)}/v1/account`, key)
 if (check.status !== 200) throw new Refusal('KnowBe4 refused the API key.')
 const sealed = await seal(env, key, row.id)
 await env.DB.batch([env.DB.prepare("UPDATE connections SET secret_ciphertext=?,secret_iv=?,status='active',rotated_at=?,revoked_at=NULL,last_error='' WHERE id=?").bind(sealed.ciphertext, sealed.iv, now.toISOString(), row.id), auditStatement(env, actor, 'connection.rotated', 'connection:' + row.id, now)])
}
export async function runKnowBe4(env: Bindings, connection: Connection, trigger: 'schedule' | 'manual', now: Date) {
 const started = await startRun(env, connection, 'knowbe4-1', trigger, now)
 if (!started) return { run: null, outcome: 'already running' }
 const { finish } = started, at = now.toISOString(), c = config(connection)
 if (connection.status !== 'active' || !connection.secret_ciphertext || !connection.secret_iv) return finish('failed', {}, 'connection is ' + connection.status)
 const key = await unseal(env, connection.secret_ciphertext, connection.secret_iv, connection.id).catch(() => null)
 if (!key) return finish('failed', {}, 'credential unreadable', reconnectUpdate(env, connection, 'Stored credential cannot be decrypted; reconnect.', now))
 const rows: { enrollment_id: string; module: string; email: string; completed: string; status: string }[] = []
 for (let page = 1; page <= 50; page++) {
  const reply = await get(`${base(c.region)}/v1/training/enrollments?page=${page}&per_page=500`, key)
  if (reply.status === 401 || reply.status === 403) return finish('failed', { pages: page - 1 }, 'credential rejected', reconnectUpdate(env, connection, 'KnowBe4 refused the API key; reconnect.', now))
  if (reply.status !== 200 || !Array.isArray(reply.body)) return finish('failed', { pages: page - 1 }, `KnowBe4 answered ${reply.status}`, env.DB.prepare('UPDATE connections SET last_attempt_at=?,last_error=? WHERE id=?').bind(at, `KnowBe4 answered ${reply.status}`, connection.id))
  for (const e of reply.body as { enrollment_id: number; module_name: string; user?: { email?: string }; completion_date?: string | null; status?: string }[]) if (e.completion_date && /passed|completed/i.test(e.status ?? '') && e.user?.email) rows.push({ enrollment_id: String(e.enrollment_id), module: e.module_name, email: e.user.email, completed: new Date(e.completion_date).toISOString(), status: String(e.status) })
  if ((reply.body as unknown[]).length < 500) break
 }
 const added = await importKnowBe4(env, rows, c.modules, connection.id, now)
 return finish('complete', { completions_read: rows.length, added }, '', env.DB.prepare('UPDATE connections SET last_attempt_at=?,last_success_at=?,last_error=? WHERE id=?').bind(at, at, '', connection.id))
}
