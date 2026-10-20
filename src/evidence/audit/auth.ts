import type { Bindings } from '../../auth.server'
import { auditStatement, type Actor } from '../door'

// LOG-001. Authentication and authorization changes made through the shared
// sign-in doors (Base operator auth, first run, owner claim) are recorded in
// the product audit. Each write is compared before and after: sessions started
// or ended, operators added, and role, status, email or name changes, each
// attributed to the operator concerned or the signed-in requester. A write
// that changes none of these is recorded by its door and answer. Only the
// method and path are kept: never a query, body, token or link.
type Operator = { id: string; display_name: string; role: string; status: string; email: string; version: number }
type Session = { id: string; operator_id: string; kind: string }
type Entry = { actor: Actor & { kind?: 'owner' | 'system' }; action: string; subject: string; outcome: 'succeeded' | 'refused' | 'failed'; detail: string; revision?: number }
const anonymous = { id: 'unauthenticated', name: 'Unauthenticated request', kind: 'system' as const }

async function snapshot(env: Bindings) {
 const [operators, sessions] = await env.DB.batch<Operator | Session>([env.DB.prepare('SELECT id,display_name,role,status,email,version FROM oa_operators'), env.DB.prepare('SELECT id,operator_id,kind FROM oa_sessions WHERE revoked_at IS NULL')])
 return { operators: new Map((operators.results as Operator[]).map(o => [o.id, o])), sessions: new Map((sessions.results as Session[]).map(s => [s.id, s])) }
}

async function answerCode(response: Response) {
 if (!(response.headers.get('content-type') ?? '').includes('json')) return ''
 const body = await response.clone().json().catch(() => null) as { error?: unknown } | null
 return typeof body?.error === 'string' && /^[a-z_]{1,60}$/.test(body.error) ? ' (' + body.error + ')' : ''
}

export async function auditedAuthentication(env: Bindings, request: Request, requester: Actor | null, clock: () => Date, answer: () => Promise<Response | null>) {
 const before = await snapshot(env), response = await answer()
 if (!response) return response
 try {
  const after = await snapshot(env), path = new URL(request.url).pathname, door = `${request.method} ${path}`, entries: Entry[] = []
  const operator = (id: string) => after.operators.get(id) ?? before.operators.get(id)
  const as = (id: string): Actor => ({ id, name: operator(id)?.display_name ?? 'Unknown operator' })
  for (const [id, s] of after.sessions) if (!before.sessions.has(id)) entries.push({ actor: as(s.operator_id), action: 'auth.signed-in', subject: 'operator:' + s.operator_id, outcome: 'succeeded', detail: `${s.kind} session via ${door}`, revision: operator(s.operator_id)?.version })
  for (const [id, s] of before.sessions) if (!after.sessions.has(id)) entries.push({ actor: requester ?? as(s.operator_id), action: requester?.id === s.operator_id && path === '/auth/signout' ? 'auth.signed-out' : 'auth.session-revoked', subject: 'operator:' + s.operator_id, outcome: 'succeeded', detail: `${s.kind} session via ${door}`, revision: operator(s.operator_id)?.version })
  for (const [id, o] of after.operators) {
   const prior = before.operators.get(id)
   if (!prior) { entries.push({ actor: requester ?? as(id), action: 'auth.operator-added', subject: 'operator:' + id, outcome: 'succeeded', detail: `${o.role}, ${o.status} via ${door}`, revision: o.version }); continue }
   const changes = [prior.role !== o.role ? `role ${prior.role} -> ${o.role}` : '', prior.status !== o.status ? `status ${prior.status} -> ${o.status}` : '', prior.email !== o.email ? 'email changed' : '', prior.display_name !== o.display_name ? 'display name changed' : ''].filter(Boolean)
   if (changes.length) entries.push({ actor: requester ?? as(id), action: 'auth.operator-changed', subject: 'operator:' + id, outcome: 'succeeded', detail: `${changes.join('; ')} via ${door}`, revision: o.version })
  }
  if (!entries.length) entries.push({ actor: requester ?? anonymous, action: 'auth.' + (path.replace(/^\/(?:auth\/)?/, '').replaceAll('/', '.') || 'request'), subject: door, outcome: response.status >= 500 ? 'failed' : response.status >= 400 ? 'refused' : 'succeeded', detail: `answered ${response.status}${await answerCode(response)}` })
  const at = clock()
  await env.DB.batch(entries.map(e => auditStatement(env, e.actor, e.action, e.subject, at, e.outcome, e.detail, { revision: e.revision })))
 } catch (failure) { console.error('Evidence authentication audit failed', failure instanceof Error ? failure.message : '') }
 return response
}
