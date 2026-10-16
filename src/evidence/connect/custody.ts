import type { Bindings } from '../../auth.server'
// Installation-local credential custody: AES-256-GCM under a key derived from
// this installation's SESSION_SECRET. Rotating that secret makes stored
// credentials unreadable, and each connection then asks to be reconnected.
const encoder = new TextEncoder()
const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes))
const unb64 = (text: string) => Uint8Array.from(atob(text), c => c.charCodeAt(0))
async function key(env: Bindings) {
 if (!env.SESSION_SECRET || env.SESSION_SECRET.length < 32) throw new Error('SESSION_SECRET is required for connection custody.')
 const material = await crypto.subtle.importKey('raw', encoder.encode(env.SESSION_SECRET), 'HKDF', false, ['deriveKey'])
 return crypto.subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: encoder.encode('evidence-connections'), info: encoder.encode('aes-gcm-v1') }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
}
export async function seal(env: Bindings, secret: string, connection: string) {
 const iv = crypto.getRandomValues(new Uint8Array(12))
 const sealed = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: encoder.encode(connection) }, await key(env), encoder.encode(secret))
 return { ciphertext: b64(new Uint8Array(sealed)), iv: b64(iv) }
}
export async function unseal(env: Bindings, ciphertext: string, iv: string, connection: string) {
 const opened = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv), additionalData: encoder.encode(connection) }, await key(env), unb64(ciphertext))
 return new TextDecoder().decode(opened)
}
