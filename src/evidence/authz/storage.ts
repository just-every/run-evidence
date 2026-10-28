import { auditStatement, oneOf, text, type Actor, type Input } from '../door'
import type { Bindings } from '../../auth.server'
import { Refusal } from '../upload'
import { delegableByAdministrator, restrictedClasses, roles, scopedRoles, scopeKinds, type Delegate, type Grant } from './roles'
import { digest } from './scim'
import { ssoProviders } from './sso'
import { privacyScope } from '../erase/authority'

export interface AccessSnapshot { grants: (Grant & { revoked_at: string | null; revoke_reason: string | null })[]; teams: { control_id: string; team: string }[]; tokens: { id: string; name: string; provider: string; created_name: string; created_at: string; expires_at: string; revoked_at: string | null; last_used_at: string | null }[]; users: { id: string; provider: string; email: string; display_name: string; active: number }[]; mfa_required: boolean; providers: string[] }
export async function snapshot(env: Bindings): Promise<AccessSnapshot> {
 const [grants, teams, tokens, users, policy] = await env.DB.batch([
  env.DB.prepare('SELECT id,email,role,scope_kind,scope_ref,source,granted_name,reason,granted_at,revoked_at,revoke_reason FROM access_grants ORDER BY granted_at DESC,id'),
  env.DB.prepare('SELECT control_id,team FROM control_teams ORDER BY team,control_id'),
  env.DB.prepare('SELECT id,name,provider,created_name,created_at,expires_at,revoked_at,last_used_at FROM scim_tokens ORDER BY created_at DESC,id'),
  env.DB.prepare('SELECT id,provider,email,display_name,active FROM scim_users ORDER BY email'),
  env.DB.prepare('SELECT require_mfa FROM sso_policy WHERE singleton=1'),
 ])
 return { grants: grants.results as AccessSnapshot['grants'], teams: teams.results as AccessSnapshot['teams'], tokens: tokens.results as AccessSnapshot['tokens'], users: users.results as AccessSnapshot['users'], mfa_required: !!(policy.results[0] as { require_mfa: number } | undefined)?.require_mfa, providers: ssoProviders(env).map(p => p.id) }
}

// A role goes to a signed-in-capable account only, with a stated reason; only the
// owner hands out administrator, and nobody grants themselves a role.
export async function grant(env: Bindings, actor: Actor, delegate: Delegate | undefined, input: Input, now: Date) {
 const email = text(input, 'email', 254).toLowerCase(), role = oneOf(input, 'role', roles), reason = text(input, 'reason', 500)
 const kind = oneOf(input, 'scope_kind', scopeKinds), ref = kind === 'business' ? '' : text(input, 'scope_ref', 200)
 if (role === 'administrator' && delegate) throw new Refusal('Only the owner grants administrator.', 403)
 if (delegate && !delegableByAdministrator.includes(role)) throw new Refusal('Your role cannot grant that role.', 403)
 if (delegate && delegate.email === email) throw new Refusal('You cannot grant a role to yourself.', 403)
 if (kind === 'area') {
  if (delegate) throw new Refusal('Only the owner grants a restricted record area.', 403)
  if ((!(restrictedClasses as readonly string[]).includes(ref) && !privacyScope(ref)) || !['administrator', 'compliance_manager'].includes(role)) throw new Refusal('Name a restricted record area or an exact privacy scope for an administrator or compliance manager.')
 } else if (!scopedRoles.includes(role) && kind !== 'business') throw new Refusal('That role applies to the whole business.')
 if (kind === 'control' && !await env.DB.prepare('SELECT 1 FROM controls WHERE id=?').bind(ref).first()) throw new Refusal('Choose an existing control.', 404)
 if (kind === 'team' && !await env.DB.prepare('SELECT 1 FROM control_teams WHERE team=?').bind(ref).first()) throw new Refusal('Name a team that has controls.', 404)
 const operator = await env.DB.prepare('SELECT role,status FROM oa_operators WHERE email=?').bind(email).first<{ role: string; status: string }>()
 if (!operator) throw new Refusal('Invite that person first: they need an account to sign in.', 409)
 if (operator.role === 'owner') throw new Refusal('The owner already holds every role.', 409)
 const id = crypto.randomUUID()
 try {
  await env.DB.batch([
   env.DB.prepare("INSERT INTO access_grants(id,email,role,scope_kind,scope_ref,source,granted_by,granted_name,reason,granted_at) VALUES(?,?,?,?,?,'owner',?,?,?,?)").bind(id, email, role, kind, ref, actor.id, actor.name, reason, now.toISOString()),
   auditStatement(env, actor, 'access.granted', 'access:' + id, now, 'succeeded', `${role} for ${email}, ${kind}${ref ? ' ' + ref : ''}`, { reason }),
  ])
 } catch { throw new Refusal('That role is already granted.', 409) }
 return { id, email, role, scope_kind: kind, scope_ref: ref }
}
export async function revoke(env: Bindings, actor: Actor, delegate: Delegate | undefined, id: string, input: Input, now: Date) {
 const reason = text(input, 'reason', 500), row = await env.DB.prepare('SELECT email,role FROM access_grants WHERE id=? AND revoked_at IS NULL').bind(id).first<{ email: string; role: string }>()
 if (!row) throw new Refusal('Grant not found.', 404)
 if (delegate && row.role === 'administrator') throw new Refusal('Only the owner revokes administrator.', 403)
 await env.DB.batch([
  env.DB.prepare('UPDATE access_grants SET revoked_at=?,revoked_by=?,revoke_reason=? WHERE id=? AND revoked_at IS NULL').bind(now.toISOString(), actor.id, reason, id),
  auditStatement(env, actor, 'access.revoked', 'access:' + id, now, 'succeeded', `${row.role} for ${row.email}`, { reason }),
 ])
 return { revoked: true }
}
export async function setTeam(env: Bindings, actor: Actor, input: Input, now: Date) {
 const control = text(input, 'control_id', 40), team = text(input, 'team', 100)
 if (!await env.DB.prepare('SELECT 1 FROM controls WHERE id=?').bind(control).first()) throw new Refusal('Choose an existing control.', 404)
 await env.DB.batch([
  env.DB.prepare('INSERT INTO control_teams(control_id,team,set_by,set_at) VALUES(?,?,?,?) ON CONFLICT(control_id) DO UPDATE SET team=excluded.team,set_by=excluded.set_by,set_at=excluded.set_at').bind(control, team, actor.id, now.toISOString()),
  auditStatement(env, actor, 'access.team-set', 'control:' + control, now, 'succeeded', team),
 ])
 return { control_id: control, team }
}
// A SCIM token is shown once; only its digest is stored. It expires, and it opens only the SCIM door.
export async function issueScimToken(env: Bindings, actor: Actor, input: Input, now: Date) {
 const name = text(input, 'name', 100), provider = oneOf(input, 'provider', ['okta', 'microsoft', 'google'] as const), days = Number(input.days ?? 90)
 if (!Number.isInteger(days) || days < 1 || days > 365) throw new Refusal('Choose an expiry of 1 to 365 days.')
 const bytes = crypto.getRandomValues(new Uint8Array(32)), secret = btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')
 const id = crypto.randomUUID(), expires = new Date(now.getTime() + days * 86400000).toISOString()
 await env.DB.batch([
  env.DB.prepare('INSERT INTO scim_tokens(id,name,provider,token_sha256,created_by,created_name,created_at,expires_at) VALUES(?,?,?,?,?,?,?,?)').bind(id, name, provider, await digest(secret), actor.id, actor.name, now.toISOString(), expires),
  auditStatement(env, actor, 'scim.token.issued', 'scim-token:' + id, now, 'succeeded', `${provider}, expires ${expires}`),
 ])
 return { id, provider, token: secret, expires_at: expires }
}
export async function revokeScimToken(env: Bindings, actor: Actor, id: string, now: Date) {
 const done = await env.DB.prepare('UPDATE scim_tokens SET revoked_at=? WHERE id=? AND revoked_at IS NULL').bind(now.toISOString(), id).run()
 if (!done.meta.changes) throw new Refusal('Token not found or already revoked.', 404)
 await auditStatement(env, actor, 'scim.token.revoked', 'scim-token:' + id, now).run()
 return { revoked: true }
}
export async function setMfa(env: Bindings, actor: Actor, input: Input, now: Date) {
 const on = oneOf(input, 'require_mfa', ['yes', 'no'] as const) === 'yes'
 await env.DB.batch([
  env.DB.prepare('INSERT INTO sso_policy(singleton,require_mfa,changed_by,changed_at) VALUES(1,?,?,?) ON CONFLICT(singleton) DO UPDATE SET require_mfa=excluded.require_mfa,changed_by=excluded.changed_by,changed_at=excluded.changed_at').bind(on ? 1 : 0, actor.id, now.toISOString()),
  auditStatement(env, actor, 'sso.mfa-policy', 'sso:mfa', now, 'succeeded', on ? 'required' : 'not required'),
 ])
 return { require_mfa: on }
}
// Ends every session of one delegated person; the next request from any of them fails.
export async function endSessions(env: Bindings, actor: Actor, input: Input, now: Date) {
 const email = text(input, 'email', 254).toLowerCase(), reason = text(input, 'reason', 500)
 const operator = await env.DB.prepare('SELECT id,role FROM oa_operators WHERE email=?').bind(email).first<{ id: string; role: string }>()
 if (!operator || operator.role === 'owner') throw new Refusal('Choose a delegated account.', 404)
 const result = await env.DB.prepare('UPDATE oa_sessions SET revoked_at=? WHERE operator_id=? AND revoked_at IS NULL').bind(now.getTime(), operator.id).run()
 await auditStatement(env, actor, 'access.sessions-ended', 'operator:' + operator.id, now, 'succeeded', `${result.meta.changes} sessions`, { reason }).run()
 return { ended: result.meta.changes }
}
