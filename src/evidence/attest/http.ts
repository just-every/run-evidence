import { page, escape } from '../view'
import { when } from '../format'
import { slab, stateChip } from '../ui'
import { done, json, ownerRoutes, readInput, text, uuid, type Route } from '../door'
import { options, personOptions, table } from '../program/view'
import { people } from '../program/people'
import { addException, assign, depart, invite } from './storage'
const id = `(${uuid})`
const both = (path: string) => new RegExp(`^/(?:app|api)${path}$`)
// Owners track who has acknowledged which exact version, who is overdue and why.
export function attestHandler(clock: () => Date) {
 const routes: Route[] = [
  { method: 'GET', pattern: both('/attestations'), run: async c => {
   const today = c.now.toISOString().slice(0, 10)
   const rows = (await c.env.DB.prepare("SELECT a.id,a.policy_id,a.state,a.due_date,a.assigned_at,a.closed_at,po.title,r.version,p.id AS person_id,p.name,p.email,p.kind,k.acknowledged_at,k.operator_email,k.body_sha256,(SELECT 1 FROM people_departures d WHERE d.person_id=p.id) AS departed FROM policy_assignments a JOIN policies po ON po.id=a.policy_id JOIN policy_revisions r ON r.id=a.revision_id JOIN people p ON p.id=a.person_id LEFT JOIN policy_acknowledgments k ON k.assignment_id=a.id ORDER BY po.title,r.version DESC,p.name").all<{ id: string; policy_id: string; state: string; due_date: string; assigned_at: string; closed_at: string | null; title: string; version: number; person_id: string; name: string; email: string; kind: string; acknowledged_at: string | null; operator_email: string | null; body_sha256: string | null; departed: number | null }>()).results
   const exceptions = (await c.env.DB.prepare('SELECT e.*,po.title,p.name FROM policy_exceptions e JOIN policies po ON po.id=e.policy_id LEFT JOIN people p ON p.id=e.person_id ORDER BY e.approved_at DESC').all<{ id: string; policy_id: string; person_id: string | null; reason: string; approved_by: string; approved_at: string; expires_at: string; title: string; name: string | null }>()).results
   const status = (r: typeof rows[number]) => r.state === 'pending' && r.due_date < today ? 'overdue' : r.state
   const policies = (await c.env.DB.prepare("SELECT p.id,p.title,r.version FROM policies p JOIN policy_revisions r ON r.policy_id=p.id AND r.status='published' ORDER BY p.title").all<{ id: string; title: string; version: number }>()).results
   if (c.isApi) return json({ assignments: rows.map(r => ({ ...r, status: status(r) })), exceptions, published: policies })
   const folks = await people(c.env)
   const assignForm = slab(`<section aria-labelledby="assign-title"><h2 id="assign-title">Assign a published policy</h2><p class="panel-intro">People acknowledge the exact published version themselves after signing in; assigning or publishing never records anyone's assent. Invite people to sign in from <a href="/app/people">People</a>.</p>${policies.length ? `<form method="post" action="/app/attestations/assign"><label>Policy<select name="policy_id" aria-label="Policy">${options(policies.map(p => [p.id, `${p.title} (version ${p.version})`] as [string, string]))}</select></label><label>Audience<select name="audience" aria-label="Audience">${options([['everyone', 'Employees and contractors'], ['employees', 'Employees'], ['contractors', 'Contractors'], ['selected', 'Selected people']])}</select></label><label>Selected people<select name="people[]" multiple aria-label="Selected people">${options(folks.map(p => [p.id, `${p.name} · ${p.email}`] as [string, string]))}</select></label><label>Due date<input type="date" name="due_date" required></label><button>Assign</button></form>` : '<p class="empty-copy">Publish a policy first.</p>'}</section>`)
   const exceptionForm = slab(`<section aria-labelledby="exception-title"><h2 id="exception-title">Exceptions</h2>${table(['Policy', 'Person', 'Reason', 'Approved', 'Expires'], exceptions.map(e => [escape(e.title), escape(e.name ?? 'Everyone'), escape(e.reason), escape(`${e.approved_by} at ${e.approved_at}`), escape(e.expires_at.slice(0, 10))]), 'Exceptions')}${policies.length ? `<form method="post" action="/app/attestations/exceptions"><label>Policy<select name="policy_id" aria-label="Policy">${options(policies.map(p => [p.id, p.title] as [string, string]))}</select></label><label>Person<select name="person_id" aria-label="Person">${personOptions(folks, '', 'Everyone')}</select></label><label>Reason<input name="reason" required maxlength="500"></label><label>Expires<input type="date" name="expires_at" required></label><button class="button-secondary">Approve exception</button></form>` : ''}</section>`)
   const list = slab(`<section aria-labelledby="attest-title"><h2 id="attest-title">Acknowledgments</h2>${table(['Policy', 'Person', 'Status', 'Due', 'Acknowledged'], rows.map(r => [escape(`${r.title} v${r.version}`), escape(`${r.name} (${r.kind})`) + (r.departed ? ' ' + stateChip('departed') : ''), stateChip(status(r)), when(r.due_date), escape(r.acknowledged_at ? `${r.acknowledged_at} as ${r.operator_email}, text ${r.body_sha256!.slice(0, 12)}…` : '—')]), 'Acknowledgments')}</section>`)
   return page('Attestations', `<div class="app-columns">${assignForm}${exceptionForm}</div>${list}`, 200, { owner: c.actor.name, active: 'people' })
  } },
  { method: 'POST', pattern: both('/attestations/assign'), run: async c => { const input = await readInput(c.request); return done(c, '/app/attestations', await assign(c.env, c.actor, text(input, 'policy_id', 36), input, c.now), 201) } },
  { method: 'POST', pattern: both('/attestations/exceptions'), run: async c => { const input = await readInput(c.request); await addException(c.env, c.actor, text(input, 'policy_id', 36), input, c.now); return done(c, '/app/attestations#exception-title', { approved: true }, 201) } },
  { method: 'POST', pattern: both(`/people/${id}/invite`), run: async (c, m) => { await invite(c.env, c.request, c.actor, m[1], c.now); return done(c, '/app/people', { invited: true }, 202) } },
  { method: 'POST', pattern: both(`/people/${id}/depart`), run: async (c, m) => done(c, '/app/people', await depart(c.env, c.actor, c.request, m[1], text(await readInput(c.request), 'reason', 500, true), c.now)) },
 ]
 return ownerRoutes(routes, clock)
}
