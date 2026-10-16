import { call, DirectoryFailure, type Directory, type DirectoryAccount } from './directory'
import { microsoftToken, OAuthFailure } from '../oauth'
// Microsoft Entra ID (Microsoft 365) through Microsoft Graph with an app
// registration's client credentials and read-only application permissions.
// Sign-in activity and MFA registration need Entra ID P1; without it those
// classes are recorded as unreadable, never as passing.
const label = 'Microsoft Entra ID'
async function token(config: Record<string, string>, secret: string) {
 try { return await microsoftToken(config.tenant_id, config.client_id, secret, 'https://graph.microsoft.com') }
 catch (error) { if (error instanceof OAuthFailure) throw new DirectoryFailure(error.kind, error.message); throw error }
}
async function all(access: string, url: string, limit = 50) {
 const out: Record<string, unknown>[] = []
 let next: string | null = url, pages = 0
 while (next && pages++ < limit) { const page = (await call(next, { headers: { authorization: 'Bearer ' + access, accept: 'application/json' } }, label)).body as { value?: Record<string, unknown>[]; '@odata.nextLink'?: string }; out.push(...(page.value ?? [])); next = page['@odata.nextLink']?.startsWith('https://graph.microsoft.com/') ? page['@odata.nextLink'] : null }
 return { items: out, complete: !next }
}
export const entra: Directory = {
 name: 'Microsoft Entra ID', credential: 'An app registration client secret', permissions: ['User.Read.All', 'AuditLog.Read.All (sign-in activity and MFA registration; Entra ID P1)', 'RoleManagement.Read.Directory'],
 exposes: { mfa: true, admin: 'members of any directory role', signIn: true, population: 'userType Guest; employeeType Contractor; others are people' },
 fields: [{ key: 'tenant_id', label: 'Directory (tenant) ID', required: true, pattern: /^[0-9a-f-]{36}$/ }, { key: 'client_id', label: 'Application (client) ID', required: true, pattern: /^[0-9a-f-]{36}$/ }],
 async verify(config, secret) { const access = await token(config, secret); const org = (await call('https://graph.microsoft.com/v1.0/organization?$select=displayName', { headers: { authorization: 'Bearer ' + access } }, label)).body as { value?: { displayName?: string }[] }; return { account: org.value?.[0]?.displayName ?? config.tenant_id } },
 async read(config, secret) {
  const access = await token(config, secret), gaps: string[] = []
  const select = 'id,displayName,userPrincipalName,mail,accountEnabled,userType,employeeType,createdDateTime'
  let users: { items: Record<string, unknown>[]; complete: boolean }, signIns = true
  try { users = await all(access, `https://graph.microsoft.com/v1.0/users?$select=${select},signInActivity&$top=999`) }
  catch (error) { if (!(error instanceof DirectoryFailure) || error.kind !== 'denied') throw error; signIns = false; gaps.push('sign-in activity not readable (needs AuditLog.Read.All and Entra ID P1)'); users = await all(access, `https://graph.microsoft.com/v1.0/users?$select=${select}&$top=999`) }
  let mfa: Map<string, boolean> | null = new Map()
  try { for (const r of (await all(access, 'https://graph.microsoft.com/v1.0/reports/authenticationMethods/userRegistrationDetails?$top=999')).items) mfa.set(String(r.id), r.isMfaRegistered === true) }
  catch (error) { if (!(error instanceof DirectoryFailure) || error.kind !== 'denied') throw error; mfa = null; gaps.push('MFA registration not readable (needs AuditLog.Read.All and Entra ID P1)') }
  let roles: Map<string, string[]> | null = new Map()
  try { for (const role of (await all(access, 'https://graph.microsoft.com/v1.0/directoryRoles?$expand=members($select=id)')).items) for (const m of (role.members as { id: string }[] | undefined) ?? []) roles.set(m.id, [...(roles.get(m.id) ?? []), String(role.displayName)]) }
  catch (error) { if (!(error instanceof DirectoryFailure) || error.kind !== 'denied') throw error; roles = null; gaps.push('directory roles not readable (needs RoleManagement.Read.Directory)') }
  if (!users.complete) gaps.push('more users than were read')
  const accounts: DirectoryAccount[] = users.items.map(u => ({ id: String(u.id), email: String(u.mail ?? u.userPrincipalName ?? ''), name: String(u.displayName ?? u.userPrincipalName), status: u.accountEnabled === false ? 'suspended' : 'active', population: u.userType === 'Guest' ? 'guest' : /contract/i.test(String(u.employeeType ?? '')) ? 'contractor' : 'person', admin: roles ? roles.has(String(u.id)) : null, roles: roles?.get(String(u.id)) ?? [], mfa: mfa ? mfa.get(String(u.id)) ?? null : null, lastSignIn: signIns ? String((u.signInActivity as { lastSignInDateTime?: string } | undefined)?.lastSignInDateTime ?? '') || null : null, created: typeof u.createdDateTime === 'string' ? u.createdDateTime : null }))
  return { accounts, complete: !gaps.length, gaps }
 },
}
