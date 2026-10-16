// IDENTITY-001 directory readers share one shape: every account with its
// status, population (person, guest, service, contractor), admin roles, MFA
// and last sign-in. An attribute a directory does not expose is null and
// never passes a test.
export type Population = 'person' | 'contractor' | 'guest' | 'service'
export interface DirectoryAccount { id: string; email: string; name: string; status: 'active' | 'suspended' | 'deprovisioned' | 'staged'; population: Population; admin: boolean | null; roles: string[]; mfa: boolean | null; lastSignIn: string | null; created: string | null }
export interface DirectoryRead { accounts: DirectoryAccount[]; complete: boolean; gaps: string[] }
export class DirectoryFailure extends Error { constructor(public kind: 'unauthorized' | 'denied' | 'throttled' | 'unavailable', message: string) { super(message) } }
export interface Directory {
 name: string; credential: string; permissions: string[]; exposes: { mfa: boolean; admin: string; signIn: boolean; population: string }
 // Configuration fields the owner gives, beyond the secret.
 fields: { key: string; label: string; required: boolean; pattern: RegExp }[]
 verify(config: Record<string, string>, secret: string, now: Date): Promise<{ account: string }>
 read(config: Record<string, string>, secret: string, now: Date): Promise<DirectoryRead>
}
// One directory HTTP call: 401 is a lost credential, 403 a missing permission.
export async function call(url: string, init: RequestInit, label: string) {
 let response: Response
 try { response = await fetch(url, { ...init, redirect: 'manual', signal: AbortSignal.timeout(20000) }) } catch { throw new DirectoryFailure('unavailable', `${label} could not be reached`) }
 if (response.status === 401) throw new DirectoryFailure('unauthorized', `${label} rejected the credential`)
 if (response.status === 403) throw new DirectoryFailure('denied', `${label} refused the read (403): a permission is missing`)
 if (response.status === 429) throw new DirectoryFailure('throttled', `${label} is rate limiting this credential`)
 if (response.status !== 200) throw new DirectoryFailure('unavailable', `${label} answered ${response.status}`)
 return { body: await response.json() as Record<string, unknown>, link: response.headers.get('link') ?? '' }
}
export const nextLink = (link: string) => /<([^>]+)>;\s*rel="next"/.exec(link)?.[1] ?? null
