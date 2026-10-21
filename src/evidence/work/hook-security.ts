export type HookPayload = Record<string, any>
export interface VerifiedHook { delivery: string; ref: string | null; refs?: string[] }
export const hookEncoder = new TextEncoder()
export const hookHex = (bytes: ArrayBuffer) => Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('')
export async function hookHmac(key: Uint8Array<ArrayBuffer>, data: Uint8Array<ArrayBuffer>) {
 return hookHex(await crypto.subtle.sign('HMAC', await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']), data))
}
export function sameHookValue(a: string, b: string) {
 if (a.length !== b.length) return false
 let diff = 0
 for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
 return diff === 0
}
export function hookPayload(bytes: Uint8Array<ArrayBuffer>): HookPayload | null {
 try {
  // Numeric provider IDs must retain their original decimal spelling, even
  // beyond Number.MAX_SAFE_INTEGER. Quoted strings are never rewritten.
  const raw = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  const safe = raw.replace(/"(?:\\.|[^"\\])*"|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g, (token, number: string | undefined) => number && /^-?\d+$/.test(number) && !Number.isSafeInteger(Number(number)) ? JSON.stringify(number) : token)
  const parsed: unknown = JSON.parse(safe)
  return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as HookPayload : null
 } catch { return null }
}
export const hookId = (value: unknown): string | null => typeof value === 'string' && /^[1-9]\d{0,39}$/.test(value) ? value : typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? String(value) : null
export const hookIdentity = (value: unknown): string | null => typeof value === 'string' && value.length > 0 && value.length <= 200 && !/[\x00-\x20\x7f]/.test(value) ? value : null
