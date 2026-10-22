import { implementation, programCite, programRevision, rows, type Ctx, type Generated } from './context'
import type { Section } from './model'
import type { Kind } from './kinds'
// PROGRAM-004 records for the government, AI and sector programs. A status record (system security plan, framework profile,
// readiness summary) states each included requirement's implementation from the live controls, never typed: implemented needs
// every mapped control's proof current and any mapped test passing now. A plan of action lists what is not implemented and
// the owner's planned action; a plan of action never makes a requirement implemented.
const mk = (id: string, heading: string, statements: Section['statements'], extra: Partial<Section> = {}): Section => ({ id, heading, status: statements.length || extra.table ? 'prefilled' : 'owner-needed', statements, ...extra })
type Framework = Kind['framework']
export interface Form { key: string; title: string; label: string; names?: string[] }
const status = (framework: Framework, title: string, blurb: string, key: string, boundaryLabel: string): [Kind, Form] => {
 const kind: Kind = { framework, title, blurb, parse: (f, cur) => f[key] !== undefined ? { ...cur, [key]: String(f[key]).slice(0, 4000) } : cur,
  async generate(c: Ctx): Promise<Generated> {
   const revision = await programRevision(c.env, c.program.id), cite = programCite(c.program, revision), text = typeof c.inputs[key] === 'string' ? c.inputs[key].trim() : ''
   const reqs = c.ready.requirements.map(r => ({ r, state: implementation(r) }))
   const facts: Generated['facts'] = Object.fromEntries(reqs.map(({ r, state }) => ['req:' + r.ref, { label: `${r.ref} ${r.title}`, value: state }]))
   const counts = (s: string) => reqs.filter(x => x.state === s).length
   return { subtitle: `${c.program.legal_entity} · ${reqs.length} requirements · ${counts('implemented')} implemented`, facts, sections: [
    { id: 'boundary', heading: boundaryLabel, status: text ? 'owner-written' : 'owner-needed', statements: [], ...(text ? { owner_text: text } : {}) },
    mk('status', 'Implementation of each requirement', [{ text: `${counts('implemented')} implemented, ${counts('partially implemented')} partially implemented, ${counts('not implemented') + counts('not implemented (no mapped control)')} not implemented, ${counts('not applicable (excluded)')} excluded with a rationale.`, cites: [cite] }], { table: { head: ['Requirement', 'Title', 'Implementation', 'Controls'], rows: reqs.map(({ r, state }) => [r.ref, r.title, state, r.controls.map(x => x.name).join('; ') || '—']) } }),
   ] }
  } }
 return [kind, { key, title, label: boundaryLabel }]
}
const poam = (framework: Framework, title: string, blurb: string): [Kind, Form] => {
 const names = ['requirement', 'planned_action', 'owner', 'due'], key = 'plans'
 const kind: Kind = { framework, title, blurb, parse: (f, cur) => f[key] !== undefined ? { ...cur, [key]: String(f[key]).split('\n').map(l => l.trim()).filter(Boolean).map(l => { const p = l.split('|').map(x => x.trim()); return Object.fromEntries(names.map((n, i) => [n, p[i] ?? ''])) }) } : cur,
  async generate(c: Ctx): Promise<Generated> {
   const revision = await programRevision(c.env, c.program.id), cite = programCite(c.program, revision), plans = rows(c.inputs[key])
   const open = c.ready.requirements.filter(r => r.state === 'included' && implementation(r) !== 'implemented')
   const facts: Generated['facts'] = Object.fromEntries(open.map(r => ['open:' + r.ref, { label: `${r.ref} not implemented`, value: implementation(r) }]))
   return { subtitle: `${c.program.legal_entity} · ${open.length} requirement${open.length === 1 ? '' : 's'} not implemented`, facts, sections: [
    mk('plan', 'Plan of action', open.map(r => { const p = plans.find(x => x.requirement === r.ref); return { text: `${r.ref} ${r.title}: ${implementation(r)}. ${p ? `Planned action: ${p.planned_action || '—'}; owner ${p.owner || '—'}; due ${p.due || '—'}.` : 'No plan of action recorded.'} A plan of action does not make a requirement implemented.`, cites: [cite] } }), { table: open.length ? { head: ['Requirement', 'Implementation', 'Planned action', 'Owner', 'Due'], rows: open.map(r => { const p = plans.find(x => x.requirement === r.ref); return [r.ref, implementation(r), p?.planned_action ?? '', p?.owner ?? '', p?.due ?? ''] }) } : undefined }),
   ] }
  } }
 return [kind, { key, names, title, label: 'One per line: requirement | planned action | owner | due (YYYY-MM-DD)' }]
}
const entries: [string, [Kind, Form]][] = [
 ['cmmc-ssp', status('cmmc', 'System security plan (3.12.4)', 'The system boundary and environment you write, with each NIST SP 800-171 requirement\'s implementation derived from live proof and tests.', 'boundary', 'System boundary, environment of operation and connections to other systems')],
 ['cmmc-poam', poam('cmmc', 'Plan of action and milestones (3.12.2)', 'Each requirement not implemented, with your planned action, owner and due date.')],
 ['nist80053-ssp', status('nist80053', 'System security plan', 'The system description you write, with each NIST SP 800-53 control\'s implementation derived from live proof and tests.', 'boundary', 'System description, boundary and authorization context')],
 ['nist80053-poam', poam('nist80053', 'Plan of action and milestones', 'Each control not implemented, with your planned action, owner and due date.')],
 ['fedramp-ssp', status('fedramp', 'System security plan', 'The system description and authorization boundary you write, with each FedRAMP Moderate control\'s implementation derived from live proof and tests.', 'boundary', 'System description, authorization boundary and leveraged authorizations')],
 ['fedramp-poam', poam('fedramp', 'Plan of action and milestones', 'Each control not implemented, with your planned action, owner and due date.')],
 ['nistcsf-profile', status('nistcsf', 'Current profile', 'Each CSF 2.0 subcategory with its derived implementation, as the organization\'s current profile.', 'scope', 'Profile scope and target outcomes')],
 ['nistairmf-profile', status('nistairmf', 'AI RMF profile', 'Each AI RMF subcategory with its derived implementation, as the organization\'s current profile.', 'scope', 'AI systems in scope and target outcomes')],
 ['iso42001-soa', status('iso42001', 'AI management system statement of applicability', 'Every clause and Annex A control with its derived implementation and any exclusion rationale.', 'scope', 'Scope of the AI management system')],
 ['hitrust-readiness', status('hitrust', 'HITRUST readiness summary', 'Each assessment domain with its derived implementation. An authorized HITRUST External Assessor validates and submits the assessment.', 'scope', 'Assessment scope and the in-scope systems')],
]
export const regulatedKinds: Record<string, Kind> = Object.fromEntries(entries.map(([id, [k]]) => [id, k]))
export const regulatedForms: Record<string, Form> = Object.fromEntries(entries.map(([id, [, t]]) => [id, t]))
