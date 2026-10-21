import type { DestinationRow } from './storage'
import { hookEncoder, hookHmac, hookId, hookIdentity, sameHookValue, type HookPayload, type VerifiedHook } from './hook-security'
// Board webhooks created with an integration app OAuth token carry a JWT
// signed with that app's Signing Secret. Personal-token webhooks are unsigned.
// https://developer.monday.com/api-reference/reference/webhooks
// https://developer.monday.com/apps/docs/integration-authorization
function jwtObject(part: string): HookPayload | null {
 try {
  if (!/^[A-Za-z0-9_-]+$/.test(part)) return null
  const value: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(atob(part.replaceAll('-', '+').replaceAll('_', '/')), c => c.charCodeAt(0))))
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as HookPayload : null
 } catch { return null }
}
export async function verifyMonday(d: DestinationRow, secret: string, request: Request, payload: HookPayload, now: Date, callback: string): Promise<VerifiedHook | null> {
 const token = request.headers.get('authorization') ?? '', parts = token.split('.')
 if (parts.length !== 3 || !/^[A-Za-z0-9_-]+$/.test(parts[2])) return null
 const header = jwtObject(parts[0]), claims = jwtObject(parts[1]), seconds = now.getTime() / 1000
 if (header?.alg !== 'HS256' || header.crit !== undefined || !claims || claims.aud !== callback || typeof claims.exp !== 'number' || !Number.isFinite(claims.exp) || claims.exp <= seconds || claims.nbf !== undefined && (typeof claims.nbf !== 'number' || !Number.isFinite(claims.nbf) || claims.nbf > seconds) || claims.iat !== undefined && (typeof claims.iat !== 'number' || !Number.isFinite(claims.iat) || claims.iat > seconds)) return null
 const digest = await hookHmac(hookEncoder.encode(secret), hookEncoder.encode(parts[0] + '.' + parts[1]))
 const signature = btoa(String.fromCharCode(...digest.match(/../g)!.map(v => parseInt(v, 16)))).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
 if (!sameHookValue(parts[2], signature)) return null
 const e = payload.event, delivery = hookIdentity(e?.triggerUuid)
 if (!delivery || !hookId(e?.boardId) || typeof e?.type !== 'string') return null
 const ref = String(e.boardId) === d.project ? hookId(e.pulseId ?? e.itemId) : null
 return { delivery, ref }
}
// URL verification only reflects a bounded challenge. It grants no authority,
// stores no secret, admits no delivery and never reads or changes a ticket.
export function mondayChallenge(payload: HookPayload | null): string | null {
 return payload && Object.keys(payload).length === 1 && typeof payload.challenge === 'string' && payload.challenge.length > 0 && payload.challenge.length <= 512 ? payload.challenge : null
}
