import { call, DirectoryFailure, type Directory, type DirectoryAccount } from './directory'
// JumpCloud system users through the v1 API with a read-only administrator's
// API key. JumpCloud's user API exposes device administrator (sudo) rights but
// not console administrators, and no last sign-in time.
const label = 'JumpCloud'
const headers = (key: string, org: string) => ({ 'x-api-key': key, accept: 'application/json', ...(org ? { 'x-org-id': org } : {}) })
export const jumpcloud: Directory = {
 name: 'JumpCloud', credential: 'A JumpCloud API key of a Read Only administrator', permissions: ['Read Only administrator (system users)'],
 exposes: { mfa: true, groups: true, admin: 'device administrators (sudo); console administrators are not exposed', signIn: false, population: 'employeeType Contractor; others are people' },
 fields: [{ key: 'org_id', label: 'Organization ID (multi-tenant administrators only)', required: false, pattern: /^[0-9a-f]{24}$/ }],
 async verify(config, key) { await call('https://console.jumpcloud.com/api/systemusers?limit=1', { headers: headers(key, config.org_id ?? '') }, label); return { account: config.org_id || 'JumpCloud organization' } },
 async read(config, key) {
  const accounts: DirectoryAccount[] = []
  let skip = 0, total = Infinity
  while (skip < total && skip < 10000) {
   const page = (await call(`https://console.jumpcloud.com/api/systemusers?limit=100&skip=${skip}`, { headers: headers(key, config.org_id ?? '') }, label)).body as { totalCount?: number; results?: Record<string, unknown>[] }
   total = page.totalCount ?? 0
   for (const u of page.results ?? []) {
    const mfa = u.mfa as { configured?: boolean } | undefined, sudo = (u.sudo as { enabled?: boolean } | undefined)?.enabled === true
    accounts.push({ id: String(u._id), email: String(u.email ?? ''), name: `${u.firstname ?? ''} ${u.lastname ?? ''}`.trim() || String(u.username), status: u.suspended === true || u.state === 'SUSPENDED' ? 'suspended' : u.state === 'STAGED' || u.activated === false ? 'staged' : 'active', population: /contract/i.test(String(u.employeeType ?? '')) ? 'contractor' : 'person', admin: sudo, roles: sudo ? ['Device administrator (sudo)'] : [], groups: null, mfa: typeof mfa?.configured === 'boolean' ? mfa.configured || u.totp_enabled === true : null, lastSignIn: null, created: typeof u.created === 'string' ? u.created : null })
   }
   if (!page.results?.length) break
   skip += page.results.length
  }
  if (skip < total) throw new DirectoryFailure('unavailable', 'JumpCloud user pagination incomplete: count or page limit')
  const gaps: string[] = accounts.length > 2000 ? ['group membership not read beyond 2,000 accounts'] : []
  // User groups (v2 API): names once, then each user's memberships.
  try {
   const names = new Map<string,string>()
   for (let page = 0; ; page++) {
    if (page >= 20) throw new DirectoryFailure('unavailable', 'JumpCloud group pagination incomplete: page limit')
    const rows = (await call('https://console.jumpcloud.com/api/v2/usergroups?limit=100' + (page ? '&skip=' + page * 100 : ''), { headers: headers(key, config.org_id ?? '') }, label)).body as unknown as { id: string; name: string }[]
    for (const row of rows) names.set(row.id,row.name)
    if (rows.length < 100) break
   }
   for (const a of accounts.slice(0, 2000)) a.groups = ((await call(`https://console.jumpcloud.com/api/v2/users/${encodeURIComponent(a.id)}/memberof`, { headers: headers(key, config.org_id ?? '') }, label)).body as unknown as { id: string; type: string }[]).filter(m => m.type === 'user_group').map(m => names.get(m.id) ?? m.id)
  } catch (error) { if (!(error instanceof DirectoryFailure) || error.kind !== 'denied') throw error; for (const a of accounts) a.groups = null; gaps.push('user groups not readable') }
  return { accounts, complete: !gaps.length, gaps }
 },
}
