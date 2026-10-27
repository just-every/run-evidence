// Source schemas: developer.okta.com/docs/api/openapi/okta-management/;
// developers.google.com/admin-sdk/directory/reference/rest/v1/users;
// learn.microsoft.com/graph/api/resources/user and authenticationMethodsRoot;
// docs.jumpcloud.com/api/1.0/index.html (systemusers), api/2.0 (groups).
// Validate the documented fields the directory readers actually consume.
// Optional MFA/timestamps remain unknown; malformed security facts never
// collapse into false, active, an empty membership or an empty inventory.
const record = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v)
const named = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0
const email = (v: unknown) => named(v) && /^[^\s@]+@[^\s@]+$/.test(v)
const date = (v: unknown) => v === undefined || v === null || typeof v === 'string' && Number.isFinite(Date.parse(v))
const optionalBool = (v: unknown) => v === undefined || typeof v === 'boolean'
const list = (v: unknown, check: (row: Record<string, any>) => boolean = () => true): boolean => Array.isArray(v) && v.every(row => record(row) && check(row))
export function directoryShape(label: string, url: URL, body: unknown): string | null {
 const path = url.pathname
 let valid = true, field = 'response'
 if (label === 'Okta') {
  if (path === '/api/v1/users') {
   field = 'users, status, profile or timestamps'
   valid = list(body, u => named(u.id) && ['ACTIVE','RECOVERY','LOCKED_OUT','PASSWORD_EXPIRED','SUSPENDED','DEPROVISIONED','STAGED','PROVISIONED'].includes(u.status) && record(u.profile) && email(u.profile.email ?? u.profile.login) && date(u.lastLogin) && date(u.created))
  } else if (path === '/api/v1/iam/assignees/users') { field = 'admin assignments'; valid = record(body) && list(body.value, a => named(a.id)) }
  else if (path.endsWith('/groups')) { field = 'user groups'; valid = list(body, g => record(g.profile) && named(g.profile.name)) }
  else if (path.endsWith('/factors')) { field = 'factor status'; valid = list(body, f => ['ACTIVE','PENDING_ACTIVATION','INACTIVE','NOT_SETUP','ENROLLED','DISABLED','EXPIRED'].includes(f.status)) }
  else valid = record(body)
 } else if (label === 'Google Workspace') {
  valid = record(body)
  if (valid && path.endsWith('/users')) {
   field = 'users, security flags or timestamps'
   valid = list((body as Record<string, any>).users, u => named(u.id) && email(u.primaryEmail) && typeof u.isAdmin === 'boolean' && typeof u.isDelegatedAdmin === 'boolean' && typeof u.suspended === 'boolean' && typeof u.archived === 'boolean' && optionalBool(u.isEnrolledIn2Sv) && date(u.lastLoginTime) && date(u.creationTime))
  } else if (valid && path.endsWith('/groups')) { field = 'groups'; valid = list((body as Record<string, any>).groups ?? [], g => named(g.name ?? g.email)) }
  if (valid && (body as Record<string, any>).nextPageToken !== undefined && !named((body as Record<string, any>).nextPageToken)) { valid = false; field = 'nextPageToken' }
 } else if (label === 'Microsoft Entra ID') {
  field = 'Graph value list'
  valid = record(body) && list(body.value)
  if (valid && path === '/v1.0/users') { field = 'user identity, lifecycle or timestamps'; valid = list((body as Record<string, any>).value, u => named(u.id) && named(u.displayName ?? u.userPrincipalName) && email(u.mail ?? u.userPrincipalName) && typeof u.accountEnabled === 'boolean' && ['Member','Guest'].includes(u.userType) && date(u.createdDateTime) && (u.signInActivity === undefined || u.signInActivity === null || record(u.signInActivity) && date(u.signInActivity.lastSignInDateTime))) }
  else if (valid && path.includes('/userRegistrationDetails')) { field = 'MFA registration'; valid = list((body as Record<string, any>).value, u => named(u.id) && typeof u.isMfaRegistered === 'boolean') }
  else if (valid && path === '/v1.0/directoryRoles') { field = 'role members'; valid = list((body as Record<string, any>).value, r => named(r.displayName) && list(r.members, m => named(m.id)) && !r['members' + '@odata.nextLink']) }
  else if (valid && path.includes('/memberOf/')) { field = 'group names'; valid = list((body as Record<string, any>).value, g => named(g.displayName)) }
 } else if (label === 'JumpCloud') {
  if (path === '/api/systemusers') {
   field = 'system users, population or security flags'
   valid = record(body) && Number.isSafeInteger(body.totalCount) && body.totalCount >= 0 && list(body.results, u => named(u._id) && email(u.email) && ['ACTIVATED','STAGED','SUSPENDED'].includes(u.state) && optionalBool(u.activated) && optionalBool(u.suspended) && record(u.sudo) && typeof u.sudo.enabled === 'boolean' && (u.mfa === undefined || record(u.mfa) && optionalBool(u.mfa.configured)) && optionalBool(u.totp_enabled) && date(u.created))
  } else if (path === '/api/v2/usergroups') { field = 'group identity'; valid = list(body, g => named(g.id) && named(g.name)) }
  else { field = 'membership identity'; valid = list(body, m => named(m.id) && named(m.type)) }
 }
 return valid ? null : `${label} schema drift: ${field}`
}
