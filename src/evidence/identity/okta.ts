import { readPageStream, retainFields } from '../connect/pages'
import { call, continuation, DirectoryFailure, nextLink, type Directory, type DirectoryAccount, type Population } from './directory'
// Okta Management API with a read-only administrator's API token (SSWS).
// Users, their enrolled factors and the users holding admin role assignments.
const label = 'Okta'
const headers = (token: string) => ({ authorization: 'SSWS ' + token, accept: 'application/json' })
const base = (config: Record<string, string>) => `https://${config.domain}`
const population = (type: unknown): Population => /contract/i.test(String(type ?? '')) ? 'contractor' : /guest|partner|external/i.test(String(type ?? '')) ? 'guest' : /service|bot|api/i.test(String(type ?? '')) ? 'service' : 'person'
const retained=['id','status','created','lastLogin','profile','email','login','firstName','lastName','userType','name']
async function arrays(url:string,token:string) {
 return readPageStream<Record<string,unknown>>(/\/users\/[^/]+\/(groups|factors)/.test(url)?'nested:'+url:url,url,async next=>{const reply=await call(next,{headers:headers(token)},label);return {items:retainFields(reply.body as unknown as Record<string,unknown>[],retained),next:continuation(nextLink(reply.link),url,new Set())}},50,m=>new DirectoryFailure('unavailable','Okta '+m))
}
export const okta: Directory = {
 name: 'Okta', credential: 'An Okta API token created by a Read-Only Administrator', permissions: ['Read-Only Administrator role (users, factors, role assignments)'],
 exposes: { mfa: true, groups: true, admin: 'users with any Okta admin role assignment', signIn: true, population: 'profile.userType: Contractor, Guest or Service; others are people' },
 fields: [{ key: 'domain', label: 'Okta domain (example.okta.com)', required: true, pattern: /^[a-z0-9-]+\.(okta|oktapreview|okta-emea)\.com$/ }],
 async verify(config, token) { const org = (await call(`${base(config)}/api/v1/org`, { headers: headers(token) }, label)).body; return { account: String(org.companyName ?? config.domain) } },
 async read(config, token) {
  const users=await arrays(`${base(config)}/api/v1/users?limit=200`,token)
  if(users.length>2000)throw new DirectoryFailure('unavailable','Okta user coverage incomplete: more than 2,000 factor reads')
  const gaps:string[]=[]
  let admins: Set<string> | null = new Set()
  try { const url=`${base(config)}/api/v1/iam/assignees/users?limit=200`;const assignments=await readPageStream<{id:string}>(url,url,async next=>{const page=await call(next,{headers:headers(token)},label);return {items:retainFields(page.body.value as {id:string}[],['id']),next:continuation(nextLink(page.link),url,new Set())}},50,m=>new DirectoryFailure('unavailable','Okta '+m));for(const a of assignments)admins.add(a.id) }
  catch (error) { if (!(error instanceof DirectoryFailure) || error.kind !== 'denied') throw error; admins = null; gaps.push('admin role assignments not readable') }
  const accounts: DirectoryAccount[] = []
  for (const u of users.slice(0, 2000)) {
   const profile = (u.profile ?? {}) as Record<string, unknown>, status = String(u.status ?? '')
   let mfa: boolean | null = null, groups: string[] | null = null
   try { groups = (await arrays(`${base(config)}/api/v1/users/${encodeURIComponent(String(u.id))}/groups`,token) as { profile?: { name?: string } }[]).map(g => String(g.profile?.name ?? '')).filter(Boolean) }
   catch (error) { if (!(error instanceof DirectoryFailure) || error.kind !== 'denied') throw error; if (!gaps.includes('group membership not readable')) gaps.push('group membership not readable') }
   try { mfa = (await arrays(`${base(config)}/api/v1/users/${encodeURIComponent(String(u.id))}/factors`,token) as { status:string }[]).some(f => f.status === 'ACTIVE') }
   catch (error) { if (!(error instanceof DirectoryFailure) || error.kind !== 'denied') throw error }
   accounts.push({ id: String(u.id), email: String(profile.email ?? profile.login ?? ''), name: `${profile.firstName ?? ''} ${profile.lastName ?? ''}`.trim() || String(profile.login ?? u.id), status: status === 'SUSPENDED' ? 'suspended' : status === 'DEPROVISIONED' ? 'deprovisioned' : status === 'STAGED' || status === 'PROVISIONED' ? 'staged' : 'active', population: population(profile.userType), admin: admins ? admins.has(String(u.id)) : null, roles: admins?.has(String(u.id)) ? ['Okta administrator'] : [], groups, mfa, lastSignIn: typeof u.lastLogin === 'string' ? u.lastLogin : null, created: typeof u.created === 'string' ? u.created : null })
  }
  if (users.length > 2000) gaps.push('more than 2,000 users: factors were read for the first 2,000')
  return { accounts, complete: !gaps.length, gaps }
 },
}
