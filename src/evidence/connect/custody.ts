import type { Bindings } from '../../auth.server'
// SECURE-001 key custody (documented in docs/KEY-CUSTODY.md). Every stored
// credential is AES-256-GCM ciphertext under a named installation key, with the
// key's name written beside the ciphertext. The key named 'session' is derived
// from SESSION_SECRET; CUSTODY_KEYS adds more named keys as a JSON object and
// CUSTODY_CURRENT names the one new secrets are sealed under. A secret whose key
// is not present cannot be opened: the caller gets an explicit CustodyUnavailable
// and the owner reconnects or restores the key. Nothing falls back to another key.
const encoder = new TextEncoder()
const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes))
const unb64 = (text: string) => Uint8Array.from(atob(text), c => c.charCodeAt(0))
export const LEGACY_KEY = 'session'
export class CustodyUnavailable extends Error { constructor(public keyId: string) { super(`Key custody unavailable: key "${keyId}" is not present.`) } }
function secrets(env: Bindings): Record<string, string> {
 const named: Record<string, string> = {}
 if (env.CUSTODY_KEYS) { try { for (const [id, secret] of Object.entries(JSON.parse(env.CUSTODY_KEYS) as Record<string, unknown>)) if (/^[a-z0-9-]{1,32}$/.test(id) && typeof secret === 'string' && secret.length >= 32) named[id] = secret } catch { /* an unreadable key list leaves only the session key */ } }
 if (env.SESSION_SECRET && env.SESSION_SECRET.length >= 32 && !env.CUSTODY_SESSION_KEY_RETIRED) named[LEGACY_KEY] = env.SESSION_SECRET
 return named
}
export const currentKey = (env: Bindings) => env.CUSTODY_CURRENT || LEGACY_KEY
export const presentKeys = (env: Bindings) => Object.keys(secrets(env)).sort()
async function key(env: Bindings, id: string) {
 const secret = secrets(env)[id]
 if (!secret) throw new CustodyUnavailable(id)
 const material = await crypto.subtle.importKey('raw', encoder.encode(secret), 'HKDF', false, ['deriveKey'])
 return crypto.subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: encoder.encode('evidence-connections'), info: encoder.encode('aes-gcm-v1') }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
}
// The iv field carries the key name before a colon; older rows have none and name the session key.
export const keyOf = (iv: string) => iv.includes(':') ? iv.slice(0, iv.indexOf(':')) : LEGACY_KEY
export async function seal(env: Bindings, secret: string, connection: string, keyId = currentKey(env)) {
 const iv = crypto.getRandomValues(new Uint8Array(12))
 const sealed = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: encoder.encode(connection) }, await key(env, keyId), encoder.encode(secret))
 return { ciphertext: b64(new Uint8Array(sealed)), iv: keyId === LEGACY_KEY ? b64(iv) : keyId + ':' + b64(iv) }
}
export async function unseal(env: Bindings, ciphertext: string, iv: string, connection: string) {
 const opened = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv.includes(':') ? iv.slice(iv.indexOf(':') + 1) : iv), additionalData: encoder.encode(connection) }, await key(env, keyOf(iv)), unb64(ciphertext))
 return new TextDecoder().decode(opened)
}
