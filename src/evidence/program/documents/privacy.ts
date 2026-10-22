import { usDate } from '../../format'
import { states, obligations } from '../../library/extended/usdp-data'
import { programCite, programRevision, rows, type Ctx, type Generated } from './context'
import type { Section } from './model'
import type { Kind } from './kinds'
import { stateOf } from '../extended'
// PROGRAM-004 document records. The extended privacy programs keep their required records as versioned program
// documents: each revision is immutable, approval names a person, exports reuse the PROGRAM-003 renderers, and the
// documents travel in the custody archive. The owner writes the rows; Evidence flags what the dates say, never what the law decides.
const mk = (id: string, heading: string, statements: Section['statements'], extra: Partial<Section> = {}): Section => ({ id, heading, status: statements.length || extra.table ? 'prefilled' : 'owner-needed', statements, ...extra })
const lines = (v: unknown) => (Array.isArray(v) ? v.join('\n') : typeof v === 'string' ? v : '').split('\n').map(x => x.trim()).filter(Boolean)
const cols = (v: unknown, names: string[]) => lines(v).map(l => { const p = l.split('|').map(x => x.trim()); return Object.fromEntries(names.map((n, i) => [n, p[i] ?? ''])) })
// Statutory response windows differ by state and can be extended once; Evidence flags a request open past 45 days and leaves the legal deadline to counsel.
const WINDOW_DAYS = 45
const late = (received: string, answered: string, now: Date) => !answered && /^\d{4}-\d{2}-\d{2}$/.test(received) && (now.getTime() - Date.parse(received + 'T00:00:00Z')) / 86400000 > WINDOW_DAYS
export interface TableKind { key: string; names: string[]; label: string; kind: Omit<Kind, 'generate' | 'parse'> & { blurb: string } }
const table = (framework: Kind['framework'], title: string, blurb: string, key: string, names: string[], label: string, flag?: (r: Record<string, string>, now: Date) => string | null): [Kind, TableKind] => {
 const kind: Kind = { framework, title, blurb, parse: (f, cur) => f[key] !== undefined ? { ...cur, [key]: cols(f[key], names) } : cur,
  async generate(c: Ctx): Promise<Generated> {
   const given = rows(c.inputs[key]), revision = await programRevision(c.env, c.program.id), cite = programCite(c.program, revision)
   const flags = given.map(r => flag?.(r, c.now) ?? null)
   return { subtitle: `${c.program.legal_entity} · ${title} · ${given.length} record${given.length === 1 ? '' : 's'}`, facts: Object.fromEntries(given.map((r, i) => ['row:' + i, { label: `${title} row ${i + 1}`, value: names.map(n => r[n]).join('|') }])), sections: [
    mk('records', title, given.map((r, i) => ({ text: names.map((n, j) => `${n.replaceAll('_', ' ')}: ${r[n] || '—'}`).join('; ') + (flags[i] ? ` — ${flags[i]}` : '') + '.', cites: [cite] })), { table: given.length ? { head: names.map(n => n.replaceAll('_', ' ')), rows: given.map(r => names.map(n => r[n] ?? '')) } : undefined }),
   ] }
  } }
 return [kind, { key, names, label, kind }]
}
const defs: [Kind, TableKind][] = [
 table('usdp', 'Consumer-rights request records', 'Each request received, the state and right, its status and when it was answered. Requests open past 45 days are flagged.', 'requests', ['received', 'state', 'right', 'status', 'responded'], 'One per line: received (YYYY-MM-DD) | state | right | status | responded (YYYY-MM-DD)', (r, now) => late(r.received, r.responded, now) ? `open more than ${WINDOW_DAYS} days; counsel confirms the state's response deadline` : null),
 table('usdp', 'Privacy notice and opt-out evidence', 'The privacy notice revision, the opt-out mechanisms and the tests that universal opt-out signals are honored.', 'optouts', ['item', 'location_or_revision', 'verified_on', 'result'], 'One per line: item (notice, opt-out link, universal opt-out signal) | location or revision | verified on (YYYY-MM-DD) | result'),
 table('usdp', 'Data protection assessment records', 'High-risk processing activities, when each was assessed, the outcome and the reviewer.', 'assessments', ['activity', 'assessed_on', 'outcome', 'reviewer'], 'One per line: activity | assessed on (YYYY-MM-DD) | outcome | reviewer'),
 table('gdpr', 'Records of processing activities (Article 30)', 'Purposes, data subjects, categories of data, recipients, transfers and retention for each processing activity.', 'processing', ['activity', 'purpose', 'data_subjects', 'data_categories', 'recipients', 'transfers', 'retention'], 'One per line: activity | purpose | data subjects | data categories | recipients | transfers | retention'),
 table('gdpr', 'Data protection impact assessment records', 'Each assessment, its date, the residual risk and the data protection officer\'s advice.', 'dpias', ['activity', 'assessed_on', 'residual_risk', 'dpo_advice'], 'One per line: activity | assessed on (YYYY-MM-DD) | residual risk | DPO advice'),
 table('gdpr', 'Data-subject request evidence', 'Each request, the right exercised, its status and when it was answered. Requests open past 30 days are flagged.', 'requests', ['received', 'right', 'status', 'responded'], 'One per line: received (YYYY-MM-DD) | right | status | responded (YYYY-MM-DD)', (r, now) => late(r.received, r.responded, now) && (now.getTime() - Date.parse(r.received + 'T00:00:00Z')) / 86400000 > 30 ? 'open more than 30 days; Article 12(3) allows one month unless extended' : null),
 table('iso27701', 'PIMS records of PII processing', 'The PII processing the privacy information management system covers, in which role, for what purpose and to which recipients.', 'pii_processing', ['processing', 'role', 'purpose', 'recipients'], 'One per line: processing | role (controller or processor) | purpose | recipients'),
]
export const privacyKinds: Record<string, Kind> = {
 'usdp-self-attestation': { framework: 'usdp', title: 'Self-attestation', blurb: 'The states that apply on the recorded figures, the states excluded with those figures, and the obligations in scope. The officer\'s statement is the owner\'s to write; Evidence attests nothing.', parse: (f, cur) => f.statement !== undefined ? { ...cur, statement: String(f.statement).slice(0, 4000) } : cur,
  async generate(c: Ctx): Promise<Generated> {
   const u = (c.ready as unknown as { usdp?: { revision: number; figures: { annual_revenue_usd: number; sale_revenue_percent: number; small_business: boolean; sensitive_data: boolean } | null; states: { code: string; name: string; act: string; effective: string; threshold: string; applies: boolean; consumers: number; decision: string }[] } }).usdp
   if (!u?.figures) return { subtitle: 'No business figures recorded', facts: {}, sections: [mk('states', 'Applicable states', [])] }
   const revision = await programRevision(c.env, c.program.id), cite = programCite(c.program, revision)
   const mine = (code: string) => c.ready.requirements.filter(r => stateOf(r.ref) === code && r.state === 'included')
   const applicable = u.states.filter(s => s.decision === 'included'), excluded = u.states.filter(s => s.decision === 'excluded')
   const statement = typeof c.inputs.statement === 'string' ? c.inputs.statement.trim() : ''
   const facts: Generated['facts'] = { figures: { label: 'Recorded business figures', value: `${u.figures.annual_revenue_usd}|${u.figures.sale_revenue_percent}|${u.figures.small_business}|${u.figures.sensitive_data}` } }
   for (const s of u.states) facts['state:' + s.code] = { label: `${s.name} in the program`, value: s.decision + '|' + s.consumers }
   return { subtitle: `${c.program.legal_entity} · ${applicable.length} state${applicable.length === 1 ? '' : 's'} apply · self-attested`, facts, sections: [
    mk('applicable', 'Applicable states', applicable.map(s => ({ text: `${s.name}: ${s.act}, effective ${usDate(s.effective)}. Threshold: ${s.threshold}. Recorded consumers: ${s.consumers.toLocaleString('en-US')}.`, cites: [cite] })), { table: applicable.length ? { head: ['State', 'Effective', 'Obligations in scope', 'With current proof'], rows: applicable.map(s => [s.name, s.effective, String(mine(s.code).length), String(mine(s.code).filter(r => r.proof === 'current').length)]) } : undefined }),
    mk('excluded', 'States excluded, with the recorded figures', excluded.map(s => ({ text: c.ready.requirements.find(r => stateOf(r.ref) === s.code)?.rationale ?? `${s.name} is excluded.`, cites: [cite] }))),
    mk('obligations', 'Obligations in scope', obligations.filter(o => applicable.some(s => o.states.includes(s.code))).map(o => ({ text: `${o.title}: required in ${applicable.filter(s => o.states.includes(s.code)).map(s => s.name).join(', ')}.`, cites: [cite] }))),
    { id: 'statement', heading: 'Officer\'s self-attestation statement', status: statement ? 'owner-written' : 'owner-needed', statements: [], ...(statement ? { owner_text: statement } : {}) },
   ] }
  } },
 ...Object.fromEntries(defs.map(([k], i) => [['usdp-rights-requests', 'usdp-notice-optout', 'usdp-assessments', 'gdpr-ropa', 'gdpr-dpia', 'gdpr-dsr', 'pims-records'][i], k])),
}
export const privacyTables: Record<string, TableKind> = Object.fromEntries(defs.map(([, t], i) => [['usdp-rights-requests', 'usdp-notice-optout', 'usdp-assessments', 'gdpr-ropa', 'gdpr-dpia', 'gdpr-dsr', 'pims-records'][i], t]))
export { states }
