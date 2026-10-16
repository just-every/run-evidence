import { page, escape } from '../view'
import { slab, stateChip } from '../ui'
import { done, json, ownerRoutes, readInput, uuid, type Route } from '../door'
import { options, personOptions, table } from '../program/view'
import { people } from '../program/people'
import { decide, draftPolicy, policyList, publish, requireRevision, templateTitles } from './storage'
import { draftFromTemplate, factsFor, syncPolicies } from './builder'
import { templates } from './templates'
import { programs } from '../program/storage'
import { libraryControls } from '../library'
import { reassignOnPublish } from '../attest/storage'
import { Refusal } from '../upload'
import { validDate } from '../model'
const id = `(${uuid})`
const both = (path: string) => new RegExp(`^/(?:app|api)${path}$`)
export function policyHandler(clock: () => Date) {
 const routes: Route[] = [
  { method: 'GET', pattern: both('/policies'), run: async c => {
   const rows = await policyList(c.env, c.now)
   if (c.isApi) return json({ policies: rows, templates: templateTitles })
   const list = slab(`<section aria-labelledby="policies-title"><h2 id="policies-title">Policies</h2>${table(['Policy', 'Published', 'Review due', 'State', 'Revisions'], rows.map(p => [escape(p.title) + `<br><small>Owner: ${escape(p.owner_name ?? 'unassigned')}</small>`, escape(p.published ? `version ${p.published.version} from ${p.published.effective_date}` : '—'), escape(p.published?.review_due ?? '—'), stateChip(p.review_state === 'current' ? 'current' : p.review_state === 'review overdue' ? 'overdue' : 'missing'), p.revisions.map(r => `<a href="/app/policies/${p.id}/revisions/${r.id}">v${r.version} ${escape(r.status)}</a>`).join(', ')]), 'Policies')}</section>`)
   const draft = slab(`<section aria-labelledby="draft-title"><h2 id="draft-title">Draft a policy revision</h2><p class="panel-intro"><a href="/app/policies/builder">Policy builder</a>: tailored templates for every policy your programs call for. <a href="/app/attestations">Attestations</a>: who acknowledged which version. <a href="/app/reviews">Reviews</a>: each policy's review cycle. Each revision's text is fixed. A named reviewer approves that exact text before it can be published; a changed draft is a new revision. Templates need applicability review and are not legal advice.</p><form method="post" action="/app/policies"><label>Policy<input name="title" required maxlength="200" list="policy-titles"></label><datalist id="policy-titles">${templateTitles.map(t => `<option value="${escape(t)}">`).join('')}</datalist><label>Owner<select name="owner_person_id" aria-label="Owner">${personOptions(await people(c.env), '', 'Keep current owner')}</select></label><label>Text<textarea name="body" rows="10" required maxlength="200000"></textarea></label><button>Save draft revision</button></form></section>`)
   return page('Policies', `<div class="app-columns">${list}${draft}</div>`, 200, { owner: c.actor.name, active: 'programs' })
  } },
  { method: 'GET', pattern: both('/policies/builder'), run: async c => {
   const all = await programs(c.env), program = all.find(p => p.id === c.url.searchParams.get('program')) ?? all.find(p => p.framework === 'soc2' || p.framework === 'iso27001') ?? all[0]
   if (!program) throw new Refusal('Create a program first; the builder tailors templates from its scope.', 409)
   const facts = await factsFor(c.env, program.id, c.actor.name, c.now), register = await policyList(c.env, c.now)
   const rows = templates.map(t => { const p = register.find(x => x.template_id === t.id || x.title.toLowerCase() === t.title.toLowerCase()); return { id: t.id, title: t.title, audience: t.audience, hipaa: !!t.hipaa, controls: libraryControls.filter(x => x.policies.includes(t.title)).map(x => x.id), state: p?.review_state ?? 'not drafted', policy_id: p?.id ?? null } })
   if (c.isApi) return json({ program: { id: program.id, name: program.name, framework: program.framework }, facts, templates: rows })
   const factsTable = table(['Fact', 'Value used'], Object.entries(facts).map(([k, v]) => [escape(k), escape(v)]), 'Facts')
   const list = table(['Template', 'Audience', 'Controls', 'State', ''], rows.map(r => [escape(r.title) + (r.hipaa ? ' <small>HIPAA</small>' : ''), escape(r.audience), escape(r.controls.join(', ')), stateChip(r.state === 'current' ? 'current' : r.state === 'review overdue' ? 'overdue' : 'missing') + ` <small>${escape(r.state)}</small>`, `<form method="post" action="/app/policies/templates/${r.id}"><input type="hidden" name="program_id" value="${program.id}"><button class="button-secondary">${r.policy_id ? 'Draft a new revision' : 'Create draft'}</button></form>`]), 'Templates')
   return page('Policy builder', `${slab(`<section aria-labelledby="builder-title"><h2 id="builder-title">Policy builder · ${escape(program.name)}</h2><p class="panel-intro">Each template is tailored from this program's scope and the sources you have connected. Unknown facts stay generic. Review every draft for applicability; templates are not legal advice. A draft becomes policy only when a named reviewer approves its exact text and it is published.</p>${all.length > 1 ? `<form method="get" action="/app/policies/builder"><label>Program<select name="program" aria-label="Program">${options(all.map(p => [p.id, p.name] as [string, string]), program.id)}</select></label><button class="button-secondary">Use this program</button></form>` : ''}${factsTable}</section>`)}${slab(`<section aria-labelledby="templates-title"><h2 id="templates-title">Templates</h2>${list}</section>`)}`, 200, { owner: c.actor.name, active: 'programs' })
  } },
  { method: 'POST', pattern: both('/policies/templates/([a-z-]{3,40})'), run: async (c, m) => { const input = await readInput(c.request); const created = await draftFromTemplate(c.env, c.actor, m[1], typeof input.program_id === 'string' ? input.program_id : '', typeof input.owner_person_id === 'string' ? input.owner_person_id : '', c.now); return done(c, `/app/policies/${created.policy}/revisions/${created.revision}`, created, 201) } },
  { method: 'POST', pattern: both('/policies'), run: async c => { const created = await draftPolicy(c.env, c.actor, await readInput(c.request, 262144), c.now); return done(c, `/app/policies/${created.policy}/revisions/${created.revision}`, created, 201) } },
  { method: 'GET', pattern: both(`/policies/${id}/revisions/${id}`), run: async (c, m) => {
   const r = await requireRevision(c.env, m[1], m[2])
   if (c.isApi) return json(r)
   const decideForm = r.status === 'draft' ? `<form method="post" action="/app/policies/${m[1]}/revisions/${m[2]}/decision"><input type="hidden" name="body_sha256" value="${r.body_sha256}"><label>Decision<select name="decision" aria-label="Decision">${options(['approved', 'rejected'])}</select></label><label>Note<input name="note" maxlength="1000"></label><button>Record decision on this exact text</button></form>` : ''
   const publishForm = r.status === 'approved' ? `<form method="post" action="/app/policies/${m[1]}/revisions/${m[2]}/publish"><label>Effective date<input type="date" name="effective_date"></label><label>Material change<select name="material" aria-label="Material change"><option value="yes">Yes: everyone assigned an earlier version acknowledges this one</option><option value="no">No: earlier acknowledgments stand</option></select></label><label>Acknowledge by<input type="date" name="reassign_due"></label><button>Publish this revision</button></form>` : ''
   return page(`Policy version ${r.version}`, `${slab(`<section aria-labelledby="revision-title"><h2 id="revision-title">Version ${r.version} · ${escape(r.status)}</h2><p>Drafted by ${escape(r.drafted_by)} at ${escape(r.drafted_at)}. Fingerprint <code>${r.body_sha256}</code>.${r.decided_by ? ` ${escape(r.status === 'rejected' ? 'Rejected' : 'Approved')} by ${escape(r.decided_by)} at ${escape(r.decided_at)}${r.decision_note ? ': ' + escape(r.decision_note) : ''}.` : ''}${r.published_at ? ` Published ${escape(r.published_at)}, effective ${escape(r.effective_date)}, review due ${escape(r.review_due)}.` : ''}</p><pre>${escape(r.body)}</pre>${decideForm}${publishForm}<p><a href="/app/policies">All policies</a></p></section>`)}`, 200, { owner: c.actor.name, active: 'programs' })
  } },
  { method: 'POST', pattern: both(`/policies/${id}/revisions/${id}/decision`), run: async (c, m) => { await decide(c.env, c.actor, m[1], m[2], await readInput(c.request), c.now); await syncPolicies(c.env, c.now); return done(c, `/app/policies/${m[1]}/revisions/${m[2]}`, { decided: true }) } },
  // Publishing a material revision asks everyone who acknowledged an earlier one to acknowledge it again.
  { method: 'POST', pattern: both(`/policies/${id}/revisions/${id}/publish`), run: async (c, m) => {
   const input = await readInput(c.request), due = typeof input.reassign_due === 'string' && input.reassign_due ? input.reassign_due : new Date(c.now.getTime() + 30 * 86400000).toISOString().slice(0, 10)
   if (!validDate(due)) throw new Refusal('The acknowledgment due date must be a real date.')
   await publish(c.env, c.actor, m[1], m[2], input, c.now)
   const reassigned = input.material === 'no' ? 0 : await reassignOnPublish(c.env, c.actor, m[1], due, c.now)
   await syncPolicies(c.env, c.now)
   return done(c, '/app/policies', { published: true, reassigned })
  } },
 ]
 return ownerRoutes(routes, clock)
}
