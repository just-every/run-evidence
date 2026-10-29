import type { Bindings } from '../../auth.server'
import { authorize } from '../authz/gate'
import { active, grant } from '../agent/storage'
import { ToolRefusal, type ToolContext, type PeopleAdapter } from '../../modules/agent-door/index.ts'

export const specialist = 'Compliance operations lead'
export const scopes = ['evidence:read', 'proposals:read', 'proposals:prepare']

export async function localCredential(env: Bindings, people: PeopleAdapter, request: Request, now: Date) {
 const secret = /^Bearer ([a-f0-9]{64})$/.exec(request.headers.get('authorization') ?? '')?.[1]
 if (!secret) return null
 const token = await grant(env, secret)
 if (!active(token, now)) return null
 const person = await people.person(token.created_by)
 if (!person?.active || person.role !== 'owner') return null
 return { sponsor: { id: person.id }, clientId: token.id, agent: { id: token.id, name: token.label, specialist }, scopes: [...scopes] }
}

export async function owner(env: Bindings, ctx: ToolContext) {
 const verdict = await authorize(env, { id: ctx.person.id, email: ctx.person.email, displayName: ctx.person.name, role: ctx.person.role }, 'GET', '/api/agent')
 if (!verdict.ok) throw new ToolRefusal('forbidden')
}

// The native preparation grant remains a separate, possessed capability. A
// Business subject or token email cannot select or manufacture a native grant.
export async function preparationGrant(env: Bindings, ctx: ToolContext) {
 await owner(env, ctx)
 if (ctx.consent !== undefined) throw new ToolRefusal('native_credential_required')
 const token = ctx.clientId && ctx.agent.id === ctx.clientId
  ? await env.DB.prepare('SELECT * FROM agent_tokens WHERE id=? AND created_by=?').bind(ctx.clientId, ctx.person.id).first<import('../agent/types').TokenGrant>() : null
 if (!active(token, new Date(ctx.now()))) throw new ToolRefusal('native_credential_required')
 return token
}
