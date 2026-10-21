import { usDate } from '../../format'
import { implementation, programCite, programRevision, record, rows, scope, type Ctx, type Generated } from './context'
import type { Section } from './model'
const natural = (a: string, b: string) => a.localeCompare(b, 'en', { numeric: true })
const mk = (id: string, heading: string, statements: Section['statements'], extra: Partial<Section> = {}): Section => ({ id, heading, status: statements.length || extra.table ? 'prefilled' : 'owner-needed', statements, ...extra })
// ISO/IEC 27001 Statement of Applicability: every Annex A control with its
// included or excluded state, justification, implementation status and the
// controls and evidence behind it. Exclusions are the program's applicability
// decisions, never a separate list.
export async function isoSoa(c: Ctx): Promise<Generated> {
 const p = c.program, revision = await programRevision(c.env, p.id), annex = c.ready.requirements.filter(r => r.ref.startsWith('A.')).sort((a, b) => natural(a.ref, b.ref)), written = record(c.inputs.justifications), facts: Generated['facts'] = {}
 const table = annex.map(r => {
  const status = implementation(r), controls = r.controls.map(x => x.name).join('; ') || 'none mapped', tests = r.controls.reduce((n, x) => n + (x.tests?.pass ?? 0), 0), failing = r.controls.flatMap(x => x.tests?.failingSources ?? [])
  const justification = written[r.ref] || (r.state === 'excluded' ? r.rationale : r.controls.length ? `Included: addressed by ${controls}.` : 'Included: no control is mapped yet.')
  facts['soa:' + r.ref] = { label: `${r.ref} ${r.title}`, value: `${r.state}|${status}` }
  return [r.ref, r.title, r.state === 'excluded' ? 'Excluded' : 'Included', justification, status, controls, r.state === 'excluded' ? '—' : `${tests} passing result${tests === 1 ? '' : 's'}${failing.length ? `; failing: ${failing.slice(0, 3).join(', ')}` : ''}; proof ${r.proof}`]
 })
 const scopeCite = programCite(p, revision), included = annex.filter(r => r.state === 'included').length
 const sections: Section[] = [
  mk('scope', 'Scope of the Statement of Applicability', [{ text: `${p.legal_entity}: ${scope(p).products.join(', ') || 'products not yet recorded'}; ISO/IEC 27001 edition ${p.edition}.`, cites: [scopeCite] }, { text: `${annex.length} Annex A controls are listed: ${included} included and ${annex.length - included} excluded. Exclusions are the applicability decisions recorded on the program.`, cites: [scopeCite] }]),
  mk('soa', 'Statement of Applicability', [], { table: { head: ['Control', 'Title', 'Applicability', 'Justification', 'Implementation status', 'Linked controls', 'Evidence'], rows: table } }),
 ]
 return { subtitle: `${p.legal_entity} · ISO/IEC 27001:${p.edition} · ${annex.length} Annex A controls`, facts, sections }
}
export async function isoRiskTreatment(c: Ctx): Promise<Generated> {
 const p = c.program, facts: Generated['facts'] = {}
 const method = await c.env.DB.prepare('SELECT MAX(revision) AS n FROM risk_methods').first<{ n: number | null }>()
 const risks = (await c.env.DB.prepare(`SELECT r.id,r.title,r.treatment,pe.name AS owner,
  (SELECT level||' ('||score||', method '||method_revision||')' FROM risk_assessments a WHERE a.risk_id=r.id AND a.kind='inherent' ORDER BY a.at DESC,a.rowid DESC LIMIT 1) AS inherent,
  (SELECT level||' ('||score||', method '||method_revision||')' FROM risk_assessments a WHERE a.risk_id=r.id AND a.kind='residual' ORDER BY a.at DESC,a.rowid DESC LIMIT 1) AS residual,
  (SELECT group_concat(t.title||' ['||t.status||']','; ') FROM risk_treatments t WHERE t.risk_id=r.id) AS plan,
  (SELECT MAX(a.expires_at) FROM risk_acceptances a WHERE a.risk_id=r.id) AS accepted_until
  FROM risks r LEFT JOIN people pe ON pe.id=r.owner_person_id ORDER BY r.created_at,r.id`).all<{ id: string; title: string; treatment: string; owner: string | null; inherent: string | null; residual: string | null; plan: string | null; accepted_until: string | null }>()).results
 for (const r of risks) facts['risk:' + r.id] = { label: `Risk ${r.title}`, value: [r.inherent, r.residual, r.treatment, r.plan, r.accepted_until].join('|') }
 const cite = (r: { id: string; title: string }) => ({ kind: 'risk', ref: r.id, label: `Risk: ${r.title}` })
 return { subtitle: `${p.legal_entity} · ISO/IEC 27001 clause 6.1 and 8.2/8.3`, facts, sections: [
  mk('method', 'Risk assessment method', [{ text: `Risks are scored under the risk-scoring method at revision ${method?.n ?? 'shipped default'}; each assessment records the revision it used.`, cites: [{ kind: 'risk-method', ref: String(method?.n ?? 1), revision: method?.n ?? 1, label: 'Risk scoring method' }] }]),
  mk('register', 'Risk assessment and treatment plan', risks.length ? [{ text: `${risks.length} risk${risks.length === 1 ? '' : 's'} are assessed and treated. Each row cites its risk record.`, cites: risks.slice(0, 5).map(cite) }] : [], { table: risks.length ? { head: ['Risk', 'Inherent', 'Residual', 'Treatment option', 'Owner', 'Treatment plan', 'Accepted until'], rows: risks.map(r => [r.title, r.inherent ?? 'not assessed', r.residual ?? 'not assessed', r.treatment, r.owner ?? 'unowned', r.plan ?? 'none', r.accepted_until ?? '—']) } : undefined }),
 ] }
}
export async function isoAuditProgramme(c: Ctx): Promise<Generated> {
 const p = c.program, facts: Generated['facts'] = {}
 const audits = (await c.env.DB.prepare('SELECT * FROM iso_internal_audits WHERE program_id=? ORDER BY performed_on,rowid').bind(p.id).all<{ id: string; title: string; auditor_name: string; independence: string; scope: string; performed_on: string; summary: string }>()).results
 const findings = (await c.env.DB.prepare('SELECT f.*,pe.name AS owner,a.title AS audit FROM iso_audit_findings f JOIN iso_internal_audits a ON a.id=f.audit_id LEFT JOIN people pe ON pe.id=f.owner_person_id WHERE a.program_id=? ORDER BY f.recorded_at,f.rowid').bind(p.id).all<{ id: string; audit_id: string; audit: string; kind: string; ref: string; description: string; corrective_action: string; owner: string | null; due_date: string | null; state: string }>()).results
 for (const a of audits) facts['audit:' + a.id] = { label: `Internal audit ${a.title}`, value: `${a.performed_on}` }
 for (const f of findings) facts['finding:' + f.id] = { label: `Audit finding ${f.description.slice(0, 60)}`, value: f.state }
 const cite = (a: { id: string; title: string }) => ({ kind: 'internal-audit', ref: a.id, label: `Internal audit: ${a.title}` })
 return { subtitle: `${p.legal_entity} · ISO/IEC 27001 clause 9.2`, facts, sections: [
  mk('programme', 'Internal audit programme', audits.map(a => ({ text: `${usDate(a.performed_on)}: ${a.title}, by ${a.auditor_name} (${a.independence}). Scope: ${a.scope}.${a.summary ? ' ' + a.summary : ''}`, cites: [cite(a)] })), { table: audits.length ? { head: ['Date', 'Audit', 'Independent auditor', 'Independence', 'Scope', 'Findings'], rows: audits.map(a => [usDate(a.performed_on), a.title, a.auditor_name, a.independence, a.scope, String(findings.filter(f => f.audit_id === a.id).length)]) } : undefined }),
  mk('findings', 'Findings, nonconformities and corrective actions', findings.map(f => ({ text: `${f.kind}${f.ref ? ' against ' + f.ref : ''}: ${f.description}${f.corrective_action ? ' Corrective action: ' + f.corrective_action : ''} (${f.state}).`, cites: [{ kind: 'audit-finding', ref: f.id, label: `Finding from ${f.audit}` }] })), { table: findings.length ? { head: ['Audit', 'Kind', 'Reference', 'Finding', 'Corrective action', 'Owner', 'Due', 'State'], rows: findings.map(f => [f.audit, f.kind, f.ref, f.description, f.corrective_action, f.owner ?? '—', f.due_date ?? '—', f.state]) } : undefined }),
 ] }
}
export const reviewInputs = ['previous actions', 'external and internal issues', 'performance feedback', 'interested parties feedback', 'risk assessment results and treatment status', 'continual improvement opportunities'] as const
export async function isoManagementReview(c: Ctx): Promise<Generated> {
 const p = c.program, facts: Generated['facts'] = {}
 const reviews = (await c.env.DB.prepare('SELECT * FROM iso_management_reviews WHERE program_id=? ORDER BY held_on,rowid').bind(p.id).all<{ id: string; held_on: string; attendees: string; inputs_json: string; decisions: string; actions_json: string }>()).results
 for (const r of reviews) facts['review:' + r.id] = { label: `Management review ${r.held_on}`, value: r.held_on }
 return { subtitle: `${p.legal_entity} · ISO/IEC 27001 clause 9.3`, facts, sections: [
  mk('reviews', 'Management reviews', reviews.map(r => ({ text: `${usDate(r.held_on)}: attended by ${r.attendees}. Decisions: ${r.decisions}`, cites: [{ kind: 'management-review', ref: r.id, label: `Management review ${r.held_on}` }] })), { table: reviews.length ? { head: ['Date', 'Attendees', ...reviewInputs.map(i => i[0].toUpperCase() + i.slice(1)), 'Decisions', 'Actions'], rows: reviews.map(r => { const inputs = record(JSON.parse(r.inputs_json)); return [usDate(r.held_on), r.attendees, ...reviewInputs.map(i => inputs[i] ?? ''), r.decisions, rows(JSON.parse(r.actions_json)).map(a => `${a.action} (${a.owner ?? ''}${a.due ? ', ' + a.due : ''})`).join('; ')] }) } : undefined }),
 ] }
}
