import type { Bindings } from '../auth.server'
import { seal, unseal } from './connect/custody'
import { headers } from './view'
interface DisplayContext {
 env: Bindings
 sessionId: string
 actor: { id: string }
 now: Date
 request: Request
 url: URL
}
// A redirect carries only a random locator. The encrypted secret is bound to
// the exact issuing session and destination, then deleted by its first GET.
export async function showOnce(c: DisplayContext, destination: string, value: unknown) {
 const id = crypto.randomUUID(), aad = `${id}:${c.sessionId}:${c.actor.id}:${destination}`
 const sealed = await seal(c.env, JSON.stringify(value), aad)
 await c.env.DB.batch([
  c.env.DB.prepare('DELETE FROM credential_displays WHERE expires_at<=?').bind(c.now.toISOString()),
  c.env.DB.prepare('INSERT INTO credential_displays(id,session_id,operator_id,destination,ciphertext,iv,expires_at) VALUES(?,?,?,?,?,?,?)').bind(id, c.sessionId, c.actor.id, destination, sealed.ciphertext, sealed.iv, new Date(c.now.getTime() + 5 * 60000).toISOString()),
 ])
 return new Response(null, { status: 303, headers: { ...headers, 'referrer-policy': 'no-referrer', location: destination + '?issued=' + id } })
}
export async function takeOnce<T>(c: DisplayContext): Promise<T | null> {
 const id = c.url.searchParams.get('issued')
 if (c.request.method !== 'GET' || !id || !/^[a-f0-9-]{36}$/.test(id)) return null
 const row = await c.env.DB.prepare('DELETE FROM credential_displays WHERE id=? AND session_id=? AND operator_id=? AND destination=? AND expires_at>? RETURNING ciphertext,iv').bind(id, c.sessionId, c.actor.id, c.url.pathname, c.now.toISOString()).first<{ ciphertext: string; iv: string }>()
 if (!row) return null
 return JSON.parse(await unseal(c.env, row.ciphertext, row.iv, `${id}:${c.sessionId}:${c.actor.id}:${c.url.pathname}`)) as T
}
