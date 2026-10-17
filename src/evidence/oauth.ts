// Service-to-service OAuth for read-only provider APIs: Google's JWT bearer
// grant signed with a service account key (RS256), and Microsoft identity
// platform client credentials. Failures name the cause without the secret.
export class OAuthFailure extends Error { constructor(public kind: 'unauthorized' | 'unavailable', message: string) { super(message) } }
const b64url = (bytes: Uint8Array | string) => btoa(typeof bytes === 'string' ? bytes : String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
export interface ServiceAccount { client_email: string; private_key: string; project_id?: string }
export function serviceAccount(secret: string): ServiceAccount {
 let key: ServiceAccount
 try { key = JSON.parse(secret) } catch { throw new OAuthFailure('unauthorized', 'Paste the service account key file (JSON).') }
 if (!key.client_email || !/-----BEGIN PRIVATE KE[Y]-----/.test(key.private_key ?? '')) throw new OAuthFailure('unauthorized', 'The key file needs client_email and a private_key.')
 return key
}
async function exchange(url: string, body: URLSearchParams, provider: string, refusal: string) {
 let response: Response
 try { response = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body, signal: AbortSignal.timeout(20000) }) } catch { throw new OAuthFailure('unavailable', `${provider} could not be reached`) }
 if (response.status === 400 || response.status === 401) throw new OAuthFailure('unauthorized', refusal)
 if (response.status !== 200) throw new OAuthFailure('unavailable', `${provider} answered ${response.status}`)
 return String((await response.json() as { access_token?: string }).access_token ?? '')
}
// Google: a short-lived assertion for exactly the read-only scope asked for (sub only with domain-wide delegation).
export async function googleToken(secret: string, scope: string, sub: string | null, now: Date, refusal: string) {
 const key = serviceAccount(secret), iat = Math.floor(now.getTime() / 1000)
 const der = Uint8Array.from(atob(key.private_key.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '')), c => c.charCodeAt(0))
 const signer = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'])
 const unsigned = `${b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${b64url(JSON.stringify({ iss: key.client_email, ...(sub ? { sub } : {}), scope, aud: 'https://oauth2.googleapis.com/token', iat, exp: iat + 600 }))}`
 const signature = b64url(new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', signer, new TextEncoder().encode(unsigned))))
 return exchange('https://oauth2.googleapis.com/token', new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${signature}` }), 'Google', refusal)
}
// Microsoft: client credentials for one resource (Graph or Azure Resource Manager).
export const microsoftToken = (tenant: string, client: string, secret: string, resource: string) => exchange(`https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`, new URLSearchParams({ client_id: client, client_secret: secret, scope: resource + '/.default', grant_type: 'client_credentials' }), 'Microsoft', 'Microsoft refused the app credentials')
