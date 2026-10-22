import { page, escape } from '../view'
import { slab, stateChip } from '../ui'
import { done, json, ownerRoutes, readInput, uuid, type Route } from '../door'
import { personOptions, table } from '../program/view'
import { people } from '../program/people'
import { decideMatch } from './collect'
const id = `(${uuid})`
const both = (path: string) => new RegExp(`^/(?:app|api)${path}$`)
export const populations = ['person', 'contractor', 'guest', 'service', 'suspended'] as const
interface Row { id: string; display_name: string; source_label: string; attributes_json: string; observed_at: string | null; person_id: string | null; state: string | null; basis: string | null; decided_by: string | null; person_name: string | null }
// Directory accounts as explicit populations, with reviewable matches to People.
// The same email in two directories is shown as a duplicate for one human decision each.
export function identityHandler(clock: () => Date) {
 const routes: Route[] = [
  { method: 'GET', pattern: both('/identities'), run: async c => {
   const rows = (await c.env.DB.prepare("SELECT r.id,r.display_name,r.source_label,r.attributes_json,r.observed_at,m.person_id,m.state,m.basis,m.decided_by,p.name AS person_name FROM resources r LEFT JOIN identity_matches m ON m.resource_id=r.id LEFT JOIN people p ON p.id=m.person_id WHERE r.type='identity.account' AND r.removed_at IS NULL ORDER BY r.display_name").all<Row>()).results
   const accounts = rows.map(r => { const a = JSON.parse(r.attributes_json) as Record<string, unknown>; return { id: r.id, name: r.display_name, source: r.source_label, email: String(a.email ?? ''), status: String(a.status ?? 'unread'), population: a.status && a.status !== 'active' && a.status !== 'unknown' ? 'suspended' : String(a.population ?? 'person'), admin: a.admin as boolean | null, roles: String(a.roles ?? ''), groups: a.groups === null || a.groups === undefined ? null : String(a.groups), mfa: a.mfa_enrolled as boolean | null, last_sign_in: a.last_sign_in as string | null, observed_at: r.observed_at, match: r.state ? { state: r.state, person_id: r.person_id, person: r.person_name, basis: r.basis, decided_by: r.decided_by } : null } })
   const counts = Object.fromEntries(populations.map(p => [p, accounts.filter(a => a.population === p).length]))
   const duplicates = [...new Set(accounts.map(a => a.email).filter((e, i, all) => e && all.indexOf(e) !== i))]
   if (c.isApi) return json({ accounts, populations: counts, duplicates, unmatched: accounts.filter(a => a.match?.state !== 'approved').length })
   const show = c.url.searchParams.get('population') ?? ''
   const folks = await people(c.env)
   const list = accounts.filter(a => !show || a.population === show)
   const nav = `<nav class="filter-row" aria-label="Populations"><a href="/app/identities"${!show ? ' aria-current="true"' : ''}>All (${accounts.length})</a>${populations.map(p => ` · <a href="/app/identities?population=${p}"${show === p ? ' aria-current="true"' : ''}>${p === 'person' ? 'People' : p[0].toUpperCase() + p.slice(1) + 's'} (${counts[p]})</a>`).join('')}</nav>`
   const body = slab(`<section aria-labelledby="identities-title"><h2 id="identities-title">Directory accounts</h2><p class="panel-intro">Accounts from connected directories. A proposed match is only a suggestion until an owner approves it; an unmatched account stays listed. An attribute a directory does not expose shows as not exposed and never passes.</p>${nav}${duplicates.length ? `<p role="status">${duplicates.length} email ${duplicates.length === 1 ? 'address appears' : 'addresses appear'} in more than one directory: ${escape(duplicates.join(', '))}. Decide each match.</p>` : ''}${table(['Account', 'Source', 'Status', 'Admin', 'Groups', 'MFA', 'Last sign-in', 'Person'], list.map(a => [escape(a.name) + (duplicates.includes(a.email) ? ' ' + stateChip('duplicate') : ''), escape(a.source), stateChip(a.status === 'active' ? 'active' : a.status), escape(a.admin === null ? 'not exposed' : a.admin ? a.roles || 'yes' : 'no'), escape(a.groups === null ? 'not read' : a.groups || 'none'), escape(a.mfa === null || a.mfa === undefined ? 'not exposed' : a.mfa ? 'enrolled' : 'none'), escape(a.last_sign_in ?? 'not exposed'), `${a.match ? `${stateChip(a.match.state)} ${escape(a.match.person ?? '—')}<br><small>${escape(a.match.basis ?? '')}${a.match.decided_by ? ' · ' + escape(a.match.decided_by) : ''}</small>` : stateChip('unmatched')}<form method="post" action="/app/identities/${a.id}/match"><select name="person_id" aria-label="Person for ${escape(a.name)}">${personOptions(folks, a.match?.person_id ?? '', 'Proposed person')}</select><select name="decision" aria-label="Decision for ${escape(a.name)}"><option value="approved">Approve</option><option value="rejected">Reject</option></select><button class="button-secondary">Decide</button></form>`]), 'Directory accounts')}</section>`)
   return page('Identities', body, 200, { owner: c.actor.name, active: 'connections' })
  } },
  { method: 'POST', pattern: both(`/identities/${id}/match`), run: async (c, m) => { await decideMatch(c.env, c.actor, m[1], await readInput(c.request), c.now); return done(c, '/app/identities', { decided: true }) } },
 ]
 return ownerRoutes(routes, clock)
}
