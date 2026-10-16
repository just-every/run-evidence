import { page, escape } from '../view'
import { slab, stateChip } from '../ui'
import { done, json, ownerRoutes, readInput, uuid, type Route } from '../door'
import { options, personOptions, table } from '../program/view'
import { people } from '../program/people'
import { decide, draftPolicy, policyList, publish, requireRevision, templateTitles } from './storage'
const id = `(${uuid})`
const both = (path: string) => new RegExp(`^/(?:app|api)${path}$`)
export function policyHandler(clock: () => Date) {
 const routes: Route[] = [
  { method: 'GET', pattern: both('/policies'), run: async c => {
   const rows = await policyList(c.env, c.now)
   if (c.isApi) return json({ policies: rows, templates: templateTitles })
   const list = slab(`<section aria-labelledby="policies-title"><h2 id="policies-title">Policies</h2>${table(['Policy', 'Published', 'Review due', 'State', 'Revisions'], rows.map(p => [escape(p.title) + `<br><small>Owner: ${escape(p.owner_name ?? 'unassigned')}</small>`, escape(p.published ? `version ${p.published.version} from ${p.published.effective_date}` : '—'), escape(p.published?.review_due ?? '—'), stateChip(p.review_state === 'current' ? 'current' : p.review_state === 'review overdue' ? 'overdue' : 'missing'), p.revisions.map(r => `<a href="/app/policies/${p.id}/revisions/${r.id}">v${r.version} ${escape(r.status)}</a>`).join(', ')]), 'Policies')}</section>`)
   const draft = slab(`<section aria-labelledby="draft-title"><h2 id="draft-title">Draft a policy revision</h2><p class="panel-intro">Each revision's text is fixed. A named reviewer approves that exact text before it can be published; a changed draft is a new revision. Templates need applicability review and are not legal advice.</p><form method="post" action="/app/policies"><label>Policy<input name="title" required maxlength="200" list="policy-titles"></label><datalist id="policy-titles">${templateTitles.map(t => `<option value="${escape(t)}">`).join('')}</datalist><label>Owner<select name="owner_person_id" aria-label="Owner">${personOptions(await people(c.env), '', 'Keep current owner')}</select></label><label>Text<textarea name="body" rows="10" required maxlength="200000"></textarea></label><button>Save draft revision</button></form></section>`)
   return page('Policies', `<div class="app-columns">${list}${draft}</div>`, 200, { owner: c.actor.name, active: 'programs' })
  } },
  { method: 'POST', pattern: both('/policies'), run: async c => { const created = await draftPolicy(c.env, c.actor, await readInput(c.request, 262144), c.now); return done(c, `/app/policies/${created.policy}/revisions/${created.revision}`, created, 201) } },
  { method: 'GET', pattern: both(`/policies/${id}/revisions/${id}`), run: async (c, m) => {
   const r = await requireRevision(c.env, m[1], m[2])
   if (c.isApi) return json(r)
   const decideForm = r.status === 'draft' ? `<form method="post" action="/app/policies/${m[1]}/revisions/${m[2]}/decision"><input type="hidden" name="body_sha256" value="${r.body_sha256}"><label>Decision<select name="decision" aria-label="Decision">${options(['approved', 'rejected'])}</select></label><label>Note<input name="note" maxlength="1000"></label><button>Record decision on this exact text</button></form>` : ''
   const publishForm = r.status === 'approved' ? `<form method="post" action="/app/policies/${m[1]}/revisions/${m[2]}/publish"><label>Effective date<input type="date" name="effective_date"></label><button>Publish this revision</button></form>` : ''
   return page(`Policy version ${r.version}`, `${slab(`<section aria-labelledby="revision-title"><h2 id="revision-title">Version ${r.version} · ${escape(r.status)}</h2><p>Drafted by ${escape(r.drafted_by)} at ${escape(r.drafted_at)}. Fingerprint <code>${r.body_sha256}</code>.${r.decided_by ? ` ${escape(r.status === 'rejected' ? 'Rejected' : 'Approved')} by ${escape(r.decided_by)} at ${escape(r.decided_at)}${r.decision_note ? ': ' + escape(r.decision_note) : ''}.` : ''}${r.published_at ? ` Published ${escape(r.published_at)}, effective ${escape(r.effective_date)}, review due ${escape(r.review_due)}.` : ''}</p><pre>${escape(r.body)}</pre>${decideForm}${publishForm}<p><a href="/app/policies">All policies</a></p></section>`)}`, 200, { owner: c.actor.name, active: 'programs' })
  } },
  { method: 'POST', pattern: both(`/policies/${id}/revisions/${id}/decision`), run: async (c, m) => { await decide(c.env, c.actor, m[1], m[2], await readInput(c.request), c.now); return done(c, `/app/policies/${m[1]}/revisions/${m[2]}`, { decided: true }) } },
  { method: 'POST', pattern: both(`/policies/${id}/revisions/${id}/publish`), run: async (c, m) => { await publish(c.env, c.actor, m[1], m[2], await readInput(c.request), c.now); return done(c, '/app/policies', { published: true }) } },
 ]
 return ownerRoutes(routes, clock)
}
