import { createAgentDoor, CORE_CAPABILITIES } from '../../modules/agent-door/index.ts'
import { runtimeBindings, type Bindings } from '../../auth.server'
import { active } from '../agent/storage'
import { nativePeople } from './people'
import { businessSettings, doorTrust } from './business'
import { nativeTools } from './tools'
import { localCredential, scopes, specialist } from './native'

export function evidenceDoor(original: Bindings, clock: () => Date = () => new Date()) {
 const env = runtimeBindings(original), people = nativePeople(env)
 return createAgentDoor({ seed: 'evidence', name: 'Evidence', specialist, capabilities: CORE_CAPABILITIES,
  db: env.DB, origin: env.AUTH_ORIGIN, trust: doorTrust(env), people,
  tools: nativeTools(env), resources: [], now: () => clock().getTime(),
  notTools: [
   { clauses: ['DEVICE-001'], reason: 'device' }, { clauses: ['ANSWER-002', 'ANSWER-003'], reason: 'screen' },
   { clauses: ['CONNECT-001', 'API-001'], reason: 'connector' }, { clauses: ['MIGRATE-001'], reason: 'import-door' },
   { clauses: ['OPS-001', 'PORTABLE-001'], reason: 'installation' },
  ],
  localCredentials: request => localCredential(env, people, request, clock()),
  async currentScopes(principal) {
   if (principal.clientId !== principal.agent.id) return [...principal.scopes]
   const token = await env.DB.prepare('SELECT * FROM agent_tokens WHERE id=? AND created_by=?').bind(principal.clientId, principal.person.id).first<import('../agent/types').TokenGrant>()
   return active(token, clock()) ? [...scopes] : []
  },
 })
}

export async function sharedAgentResponse(request: Request, original: Bindings, clock: () => Date): Promise<Response | null> {
 const path = new URL(request.url).pathname
 if (!['/mcp', '/agents', '/api/rer/agent-policy', '/api/rer/business-settings', '/rer-business-logo', '/rer-business.css', '/.well-known/oauth-protected-resource', '/.well-known/oauth-protected-resource/mcp'].includes(path) && !path.startsWith('/agents/')) return null
 const env = runtimeBindings(original)
 if (new URL(request.url).origin !== env.AUTH_ORIGIN || request.headers.has('host') && request.headers.get('host')?.toLowerCase() !== new URL(env.AUTH_ORIGIN).host.toLowerCase() || request.headers.get('sec-fetch-site') === 'cross-site' || request.headers.has('origin') && request.headers.get('origin') !== env.AUTH_ORIGIN) return Response.json({ code: 'origin_refused' }, { status: 403 })
 const settings = await businessSettings(env).handle(request)
 return settings ?? evidenceDoor(env, clock).handle(request)
}
