import { done, json, ownerRoutes, readInput, text, uuid, type Route } from '../door'
import { Refusal } from '../upload'
import { operatorAuth } from '../../auth.server'
import { page, escape } from '../view'
import { slab } from '../ui'
import { table, options } from '../program/view'
import { roles } from './roles'
import { endSessions, grant, issueScimToken, revoke, revokeScimToken, setMfa, setTeam, snapshot, type AccessSnapshot } from './storage'
const id = `(${uuid})`
const both = (path: string) => new RegExp(`^/(?:app|api)${path}$`)
const ownerOnly = (c: { delegate?: unknown }) => { if (c.delegate) throw new Refusal('Only the owner does this.', 403) }
const hidden = (name: string, value: string) => `<input type="hidden" name="${name}" value="${escape(value)}">`

function view(data: AccessSnapshot, owner: string, notice = '') {
 const active = data.grants.filter(g => !g.revoked_at)
 const grants = table(['Person', 'Role', 'Scope', 'Reason', ''], active.map(g => [escape(g.email), escape(g.role.replaceAll('_', ' ')), escape(g.scope_kind === 'business' ? (['control_owner', 'contributor'].includes(g.role) ? 'Their assigned controls' : 'Whole business') : g.scope_kind + ' ' + g.scope_ref), escape(g.reason), `<form method="post" action="/app/roles/grants/${g.id}/revoke" class="inline-form">${hidden('reason', 'Revoked from the access page')}<button type="submit">Revoke</button></form>`]), 'Granted roles')
 const grantForm = `<form method="post" action="/app/roles/grants"><label>Account email<input name="email" type="email" required></label><label>Role<select name="role" aria-label="Role">${options(roles.map(r => [r, r.replaceAll('_', ' ')] as [string, string]))}</select></label><label>Scope<select name="scope_kind" aria-label="Scope">${options([['business', 'Business or assigned controls'], ['team', 'A team'], ['control', 'One control'], ['area', 'Restricted area: personnel, findings or connector-data']])}</select></label><label>Team, control or area<input name="scope_ref" placeholder="Team name, control id or area"></label><label>Reason<input name="reason" required></label><button type="submit">Grant role</button></form>`
 const providers = data.providers.length ? data.providers.map(p => escape(p)).join(', ') : 'None configured'
 const tokens = table(['Name', 'Provider', 'Expires', 'Status', ''], data.tokens.map(t => [escape(t.name), escape(t.provider), escape(t.expires_at.slice(0, 10)), t.revoked_at ? 'Revoked' : 'Active', t.revoked_at ? '' : `<form method="post" action="/app/roles/scim-tokens/${t.id}/revoke" class="inline-form"><button type="submit">Revoke</button></form>`]), 'SCIM tokens')
 const users = table(['Provisioned person', 'Provider', 'State'], data.users.map(u => [escape(u.email), escape(u.provider), u.active ? 'Active' : 'Deprovisioned']), 'SCIM users')
 const body = (notice ? `<p role="status">${escape(notice)}</p>` : '')
  + slab(`<section aria-labelledby="roles-title"><h2 id="roles-title">Roles</h2><p class="panel-intro">The owner holds every door. Each other role opens only the doors it names; employees reach their own tasks and auditors reach only their engagement.</p>${grants || '<p>No delegated roles yet.</p>'}${grantForm}</section>`)
  + slab(`<section aria-labelledby="sso-title"><h2 id="sso-title">Single sign-on and SCIM</h2><p class="panel-intro">Providers offered at sign-in: ${providers}. The owner's email link remains the audited break-glass door. SCIM-provisioned people sign in only through their provider.</p><form method="post" action="/app/roles/mfa"><label>Require a second factor<select name="require_mfa" aria-label="Require a second factor">${options([['no', 'No'], ['yes', 'Yes']], data.mfa_required ? 'yes' : 'no')}</select></label><button type="submit">Save</button></form>${tokens || '<p>No SCIM tokens issued.</p>'}<form method="post" action="/app/roles/scim-tokens"><label>Token name<input name="name" required></label><label>Provider<select name="provider" aria-label="Provider">${options(['okta', 'microsoft', 'google'])}</select></label><label>Days valid<input name="days" type="number" min="1" max="365" value="90"></label><button type="submit">Issue SCIM token</button></form>${users || '<p>No people provisioned by SCIM.</p>'}</section>`)
 return page('Access', body, 200, { owner, active: 'roles' })
}

// AUTH-001: roles, single sign-on and SCIM administration. The owner and an
// administrator reach it; owner-only actions refuse a delegate by name.
export function rolesHandler(clock: () => Date) {
 const routes: Route[] = [
  { method: 'GET', pattern: both('/roles'), run: async c => { const data = await snapshot(c.env); return c.isApi ? json(data) : view(data, c.actor.name, c.url.searchParams.get('notice') ?? '') } },
  { method: 'POST', pattern: both('/roles/grants'), run: async c => done(c, '/app/roles?notice=Role+granted', await grant(c.env, c.actor, c.delegate, await readInput(c.request), c.now), 201) },
  { method: 'POST', pattern: both(`/roles/grants/${id}/revoke`), run: async (c, m) => done(c, '/app/roles?notice=Role+revoked', await revoke(c.env, c.actor, c.delegate, m[1], await readInput(c.request), c.now)) },
  { method: 'POST', pattern: both('/roles/teams'), run: async c => done(c, '/app/roles', await setTeam(c.env, c.actor, await readInput(c.request), c.now)) },
  { method: 'POST', pattern: both('/roles/sessions/end'), run: async c => done(c, '/app/roles?notice=Sessions+ended', await endSessions(c.env, c.actor, await readInput(c.request), c.now)) },
  { method: 'POST', pattern: both('/roles/invitations'), run: async c => {
   ownerOnly(c)
   const input = await readInput(c.request), email = text(input, 'email', 254).toLowerCase(), displayName = text(input, 'display_name', 120)
   await operatorAuth(c.env).invite(c.request, { email, displayName, role: 'member', returnTo: '/me' })
   return done(c, '/app/roles?notice=Invitation+sent', { invited: true }, 202)
  } },
  { method: 'POST', pattern: both('/roles/mfa'), run: async c => { ownerOnly(c); return done(c, '/app/roles', await setMfa(c.env, c.actor, await readInput(c.request), c.now)) } },
  { method: 'POST', pattern: both('/roles/scim-tokens'), run: async c => {
   ownerOnly(c)
   const issued = await issueScimToken(c.env, c.actor, await readInput(c.request), c.now)
   // The secret appears once, on this response only.
   return c.isApi ? json(issued, 201) : page('SCIM token issued', slab(`<section><h2>SCIM token issued</h2><p>Copy this token into your identity provider now. It is not shown again.</p><p><code>${escape(issued.token)}</code></p><p><a href="/app/roles">Back to access</a></p></section>`), 201, { active: 'roles' })
  } },
  { method: 'POST', pattern: both(`/roles/scim-tokens/${id}/revoke`), run: async (c, m) => { ownerOnly(c); return done(c, '/app/roles?notice=Token+revoked', await revokeScimToken(c.env, c.actor, m[1], c.now)) } },
 ]
 return ownerRoutes(routes, clock)
}
