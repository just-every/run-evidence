import { call, DirectoryFailure, type Directory, type DirectoryAccount } from './directory'
// Google Workspace Admin SDK Directory API through a service account with
// domain-wide delegation for one read-only scope, acting as a named admin.
const label = 'Google Workspace'
const scope = 'https://www.googleapis.com/auth/admin.directory.user.readonly'
const b64url = (bytes: Uint8Array | string) => btoa(typeof bytes === 'string' ? bytes : String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
interface ServiceAccount { client_email: string; private_key: string; token_uri?: string }
function parseKey(secret: string): ServiceAccount {
 let key: ServiceAccount
 try { key = JSON.parse(secret) } catch { throw new DirectoryFailure('unauthorized', 'Paste the service account key file (JSON).') }
 if (!key.client_email || !/-----BEGIN PRIVATE KEY-----/.test(key.private_key ?? '')) throw new DirectoryFailure('unauthorized', 'The key file needs client_email and a private_key.')
 return key
}
// OAuth 2.0 JWT bearer grant signed RS256 with the service account's key.
async function token(config: Record<string, string>, secret: string, now: Date) {
 const key = parseKey(secret), iat = Math.floor(now.getTime() / 1000)
 const der = Uint8Array.from(atob(key.private_key.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '')), c => c.charCodeAt(0))
 const signer = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'])
 const unsigned = `${b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${b64url(JSON.stringify({ iss: key.client_email, sub: config.admin_email, scope, aud: 'https://oauth2.googleapis.com/token', iat, exp: iat + 600 }))}`
 const signature = b64url(new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', signer, new TextEncoder().encode(unsigned))))
 let response: Response
 try { response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${signature}` }), signal: AbortSignal.timeout(20000) }) } catch { throw new DirectoryFailure('unavailable', 'Google could not be reached') }
 if (response.status === 400 || response.status === 401) throw new DirectoryFailure('unauthorized', 'Google refused the service account (check domain-wide delegation for the read-only directory scope)')
 if (response.status !== 200) throw new DirectoryFailure('unavailable', `Google answered ${response.status}`)
 return String((await response.json() as { access_token?: string }).access_token ?? '')
}
export const google: Directory = {
 name: 'Google Workspace', credential: 'A service account key (JSON) with domain-wide delegation for the scope ' + scope, permissions: [scope + ' (delegated from a super administrator named below)'],
 exposes: { mfa: true, admin: 'super administrators and delegated administrators', signIn: true, population: 'Google Workspace has no guest or service users; every account is a person unless matched otherwise' },
 fields: [{ key: 'domain', label: 'Primary domain', required: true, pattern: /^[a-z0-9.-]+\.[a-z]{2,}$/ }, { key: 'admin_email', label: 'Administrator to act as', required: true, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ }],
 async verify(config, secret, now) { const access = await token(config, secret, now); await call(`https://admin.googleapis.com/admin/directory/v1/users?customer=my_customer&maxResults=1`, { headers: { authorization: 'Bearer ' + access } }, label); return { account: config.domain } },
 async read(config, secret, now) {
  const access = await token(config, secret, now), accounts: DirectoryAccount[] = []
  let page: string | null = '', pages = 0
  while (page !== null && pages++ < 40) {
   const reply = (await call(`https://admin.googleapis.com/admin/directory/v1/users?customer=my_customer&maxResults=500&projection=basic${page ? '&pageToken=' + encodeURIComponent(page) : ''}`, { headers: { authorization: 'Bearer ' + access } }, label)).body as { users?: Record<string, unknown>[]; nextPageToken?: string }
   for (const u of reply.users ?? []) {
    const last = typeof u.lastLoginTime === 'string' && !u.lastLoginTime.startsWith('1970') ? u.lastLoginTime : null
    accounts.push({ id: String(u.id), email: String(u.primaryEmail ?? ''), name: String((u.name as { fullName?: string } | undefined)?.fullName ?? u.primaryEmail), status: u.archived ? 'deprovisioned' : u.suspended ? 'suspended' : 'active', population: 'person', admin: u.isAdmin === true || u.isDelegatedAdmin === true, roles: [...(u.isAdmin ? ['Super administrator'] : []), ...(u.isDelegatedAdmin ? ['Delegated administrator'] : [])], mfa: typeof u.isEnrolledIn2Sv === 'boolean' ? u.isEnrolledIn2Sv : null, lastSignIn: last, created: typeof u.creationTime === 'string' ? u.creationTime : null })
   }
   page = reply.nextPageToken ?? null
  }
  return { accounts, complete: page === null, gaps: page === null ? [] : ['more than 20,000 users: the rest were not read'] }
 },
}
