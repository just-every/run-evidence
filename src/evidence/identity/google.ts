import { call, DirectoryFailure, singlePage, type Directory, type DirectoryAccount } from './directory'
import { googleToken, OAuthFailure } from '../oauth'
// Google Workspace Admin SDK Directory API through a service account with
// domain-wide delegation for one read-only scope, acting as a named admin.
const label = 'Google Workspace'
const scope = 'https://www.googleapis.com/auth/admin.directory.user.readonly https://www.googleapis.com/auth/admin.directory.group.readonly'
// The directory read needs domain-wide delegation, acting as a named administrator.
async function token(config: Record<string, string>, secret: string, now: Date) {
 try { return await googleToken(secret, scope, config.admin_email, now, 'Google refused the service account (check domain-wide delegation for the read-only directory scope)') }
 catch (error) { if (error instanceof OAuthFailure) throw new DirectoryFailure(error.kind, error.message); throw error }
}
export const google: Directory = {
 name: 'Google Workspace', credential: 'A service account key (JSON) with domain-wide delegation for the scope ' + scope, permissions: [...scope.split(' ').map(s => s + ' (delegated from a super administrator named below)')],
 exposes: { mfa: true, groups: true, admin: 'super administrators and delegated administrators', signIn: true, population: 'Google Workspace has no guest or service users; every account is a person unless matched otherwise' },
 fields: [{ key: 'domain', label: 'Primary domain', required: true, pattern: /^[a-z0-9.-]+\.[a-z]{2,}$/ }, { key: 'admin_email', label: 'Administrator to act as', required: true, pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ }],
 async verify(config, secret, now) { const access = await token(config, secret, now); await call(`https://admin.googleapis.com/admin/directory/v1/users?customer=my_customer&maxResults=1`, { headers: { authorization: 'Bearer ' + access } }, label); return { account: config.domain } },
 async read(config, secret, now) {
  const access = await token(config, secret, now), accounts: DirectoryAccount[] = []
  const seen = new Set<string>()
  let page: string | null = '', pages = 0
  while (page !== null && pages++ < 40) {
   if (seen.has(page)) throw new DirectoryFailure('unavailable', 'Google Workspace pagination incomplete: repeated page token')
   seen.add(page)
   const reply = (await call(`https://admin.googleapis.com/admin/directory/v1/users?customer=my_customer&maxResults=500&projection=basic${page ? '&pageToken=' + encodeURIComponent(page) : ''}`, { headers: { authorization: 'Bearer ' + access } }, label)).body as { users?: Record<string, unknown>[]; nextPageToken?: string }
   for (const u of reply.users ?? []) {
    const last = typeof u.lastLoginTime === 'string' && !u.lastLoginTime.startsWith('1970') ? u.lastLoginTime : null
    accounts.push({ id: String(u.id), email: String(u.primaryEmail ?? ''), name: String((u.name as { fullName?: string } | undefined)?.fullName ?? u.primaryEmail), status: u.archived ? 'deprovisioned' : u.suspended ? 'suspended' : 'active', population: 'person', admin: u.isAdmin === true || u.isDelegatedAdmin === true, roles: [...(u.isAdmin ? ['Super administrator'] : []), ...(u.isDelegatedAdmin ? ['Delegated administrator'] : [])], groups: null, mfa: typeof u.isEnrolledIn2Sv === 'boolean' ? u.isEnrolledIn2Sv : null, lastSignIn: last, created: typeof u.creationTime === 'string' ? u.creationTime : null })
   }
   page = reply.nextPageToken ?? null
  }
  if (page !== null) throw new DirectoryFailure('unavailable', 'Google Workspace pagination incomplete: page limit reached')
  const gaps: string[] = accounts.length > 2000 ? ['group membership not read beyond 2,000 accounts'] : []
  // Group membership per user (the group read-only scope); a refusal leaves groups unknown.
  try { for (const a of accounts.slice(0, 2000)) a.groups = ((singlePage(await call(`https://admin.googleapis.com/admin/directory/v1/groups?userKey=${encodeURIComponent(a.email)}&maxResults=200`, { headers: { authorization: 'Bearer ' + access } }, label), label).groups as { name?: string; email?: string }[] | undefined) ?? []).map(g => String(g.name ?? g.email)) }
  catch (error) { if (!(error instanceof DirectoryFailure) || error.kind !== 'denied') throw error; for (const a of accounts) a.groups = null; gaps.push('group membership not readable (needs the group read-only scope)') }
  return { accounts, complete: !gaps.length, gaps }
 },
}
