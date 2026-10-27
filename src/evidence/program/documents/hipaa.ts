import { usDate } from '../../format'
import { riskLibrary } from '../../risk/library'
import { libraryControls } from '../../library'
import { publishedPolicies, policyCite, rows, vendorCite, vendorLines, baaCite, type Ctx, type Generated } from './context'
import type { Section } from './model'
const mk = (id: string, heading: string, statements: Section['statements'], extra: Partial<Section> = {}): Section => ({ id, heading, status: statements.length || extra.table ? 'prefilled' : 'owner-needed', statements, ...extra })
// The shipped scenarios that bear on ePHI: added to the analysis from inside
// the document, each becoming a RISK-001 risk the owner can change.
export const ephiScenarios = riskLibrary.filter(s => /ePHI|\bPHI\b|HIPAA/i.test(`${s.title} ${s.threat} ${s.vulnerability}`))
const ephiIds = new Set(ephiScenarios.map(s => s.id))
export async function hipaaRiskAnalysis(c: Ctx): Promise<Generated> {
 const p = c.program, facts: Generated['facts'] = {}, systems = rows(c.inputs.ephi_systems), vendors = (await vendorLines(c.env, c.now)).filter(v => v.data_types.includes('PHI'))
 const risks = (await c.env.DB.prepare(`SELECT r.id,r.title,r.scenario,r.library_id,r.library_revision,r.treatment,
  (SELECT id||'|'||likelihood||'|'||impact||'|'||score||'|'||level||'|'||method_revision FROM risk_assessments a WHERE a.risk_id=r.id AND a.kind='inherent' ORDER BY a.at DESC,a.rowid DESC LIMIT 1) AS inherent,
  (SELECT level||' ('||score||')' FROM risk_assessments a WHERE a.risk_id=r.id AND a.kind='residual' ORDER BY a.at DESC,a.rowid DESC LIMIT 1) AS residual
  FROM risks r ORDER BY r.created_at,r.id`).all<{ id: string; title: string; scenario: string; library_id: string | null; library_revision: number | null; treatment: string; inherent: string | null; residual: string | null }>()).results.filter(r => (r.library_id && ephiIds.has(r.library_id)) || /ePHI|\bPHI\b/.test(r.title + ' ' + r.scenario))
 const links = (await c.env.DB.prepare("SELECT risk_id,target FROM risk_links WHERE kind='control'").all<{ risk_id: string; target: string }>()).results
 const treatments = (await c.env.DB.prepare('SELECT t.id,t.risk_id,t.title,t.due_date,t.status,p.name AS owner FROM risk_treatments t LEFT JOIN people p ON p.id=t.owner_person_id ORDER BY t.due_date').all<{ id: string; risk_id: string; title: string; due_date: string; status: string; owner: string | null }>()).results
 const controlState = new Map(c.ready.requirements.flatMap(r => r.controls).map(x => [x.id, x])), controlName = new Map((await c.env.DB.prepare('SELECT id,name FROM controls').all<{ id: string; name: string }>()).results.map(x => [x.id, x.name]))
 const safeguard = (risk: string) => links.filter(l => l.risk_id === risk).map(l => { const s = controlState.get(l.target); return `${controlName.get(l.target) ?? l.target}: ${s ? (s.proof === 'current' ? 'proof current' : 'proof not current') + (s.tests?.tests ? `, ${s.tests.pass}/${s.tests.tests} tests passing` : '') : l.target.startsWith('library:') ? 'library control not adopted' : 'not in this program'}` })
 for (const r of risks) facts['risk:' + r.id] = { label: `Risk ${r.title}`, value: [r.inherent, r.residual, r.treatment, treatments.filter(t => t.risk_id === r.id).map(t => t.status).join(','), safeguard(r.id).join(',')].join('|') }
 for (const v of vendors) facts['baa:' + v.id] = { label: `BAA of ${v.name}`, value: v.baa.state }
 const riskCite = (r: { id: string; title: string; library_id: string | null; library_revision: number | null }) => ({ kind: 'risk', ref: r.id, revision: r.library_revision ?? undefined, label: `Risk: ${r.title}` })
 const flows = [...systems.map(s => ({ text: `${s.system} ${s.ephi ? 'holds ' + s.ephi : 'handles ePHI'}${s.flow ? '; flow: ' + s.flow : ''}.`, cites: [] as Section['statements'][number]['cites'] })), ...vendors.map(v => ({ text: `ePHI flows to business associate ${v.name} (${v.service || 'service not recorded'}); BAA ${v.baa.state}.`, cites: [vendorCite(v), baaCite(v)].filter((x): x is NonNullable<typeof x> => !!x) }))]
 const analysed = risks.map(r => { const [id, l, i, score, level, method] = (r.inherent ?? '').split('|'); return { r, id, l, i, score, level, method } })
 return { subtitle: `${p.legal_entity} · 45 CFR 164.308(a)(1)(ii)(A) · ${risks.length} ePHI risk${risks.length === 1 ? '' : 's'}`, facts, sections: [
  mk('ephi', 'ePHI systems and flows', flows, { table: systems.length ? { head: ['System', 'ePHI held or handled', 'Flow'], rows: systems.map(s => [s.system, s.ephi, s.flow]) } : undefined }),
  mk('threats', 'Threats and vulnerabilities', risks.map(r => ({ text: r.scenario, cites: [riskCite(r)] }))),
  mk('likelihood', 'Likelihood and impact', [], { table: analysed.length ? { head: ['Risk', 'Likelihood', 'Impact', 'Score', 'Level', 'Method revision', 'Residual'], rows: analysed.map(a => [a.r.title, a.l ?? '', a.i ?? '', a.score ?? '', a.level ?? 'not assessed', a.method ?? '', a.r.residual ?? 'not assessed']) } : undefined }),
  mk('safeguards', 'Current safeguards', risks.flatMap(r => safeguard(r.id).map(text => ({ text: `${r.title}: ${text}.`, cites: [riskCite(r)] })))),
  mk('remediation', 'Remediation plan', treatments.filter(t => risks.some(r => r.id === t.risk_id)).map(t => ({ text: `${t.title} (${t.owner ?? 'unowned'}, due ${usDate(t.due_date)}, ${t.status}).`, cites: [{ kind: 'risk-treatment', ref: t.id, label: `Treatment of ${risks.find(r => r.id === t.risk_id)!.title}` }] })), { table: treatments.some(t => risks.some(r => r.id === t.risk_id)) ? { head: ['Risk', 'Treatment', 'Owner', 'Due', 'Status'], rows: treatments.filter(t => risks.some(r => r.id === t.risk_id)).map(t => [risks.find(r => r.id === t.risk_id)!.title, t.title, t.owner ?? '—', usDate(t.due_date), t.status]) } : undefined }),
 ] }
}
export async function hipaaPolicySet(c: Ctx): Promise<Generated> {
 const p = c.program, published = new Map((await publishedPolicies(c.env, c.now)).map(x => [x.title.toLowerCase(), x])), facts: Generated['facts'] = {}
 const hipaa = new Set(libraryControls.filter(l => (l.maps.hipaa ?? []).length).flatMap(l => l.policies)), titles = [...hipaa].sort()
 for (const t of titles) facts['policy:' + t] = { label: `Policy ${t}`, value: published.has(t.toLowerCase()) ? String(published.get(t.toLowerCase())!.version) : 'none' }
 return { subtitle: `${p.legal_entity} · HIPAA policy set`, facts, sections: [
  mk('policies', 'HIPAA policy set', titles.flatMap(t => { const x = published.get(t.toLowerCase()); return x ? [{ text: `${t} is in force as revision ${x.version}.`, cites: [policyCite(x)] }] : [{ text: `${t}: no approved and published policy yet.`, cites: [] }] }), { table: { head: ['Policy', 'State', 'Revision', 'Effective'], rows: titles.map(t => { const x = published.get(t.toLowerCase()); return [t, x ? x.state : 'not published', x ? String(x.version) : '—', x?.effective ? usDate(x.effective) : '—'] }) } }),
 ] }
}
export async function hipaaBaaInventory(c: Ctx): Promise<Generated> {
 const p = c.program, vendors = await vendorLines(c.env, c.now), facts: Generated['facts'] = {}
 const relevant = vendors.filter(v => v.data_types.includes('PHI') || v.baa.ref)
 for (const v of relevant) facts['baa:' + v.id] = { label: `BAA of ${v.name}`, value: `${v.baa.state}|${v.baa.sha}` }
 return { subtitle: `${p.legal_entity} · business associate agreement inventory (from Vendors)`, facts, sections: [
  mk('baas', 'Business associate agreements', relevant.map(v => ({ text: `${v.name}: ${v.data_types.includes('PHI') ? 'handles ePHI' : 'no ePHI recorded'}; BAA ${v.baa.state}${v.baa.effective ? ', effective ' + usDate(v.baa.effective) : ''}${v.baa.expires ? ', expires ' + usDate(v.baa.expires) : ''}.`, cites: [vendorCite(v), baaCite(v)].filter((x): x is NonNullable<typeof x> => !!x) })), { table: relevant.length ? { head: ['Business associate', 'Service', 'Handles ePHI', 'BAA state', 'Effective', 'Expires', 'Not verified by Evidence'], rows: relevant.map(v => [v.name, v.service, v.data_types.includes('PHI') ? 'yes' : 'no', v.baa.state, v.baa.effective ? usDate(v.baa.effective) : '—', v.baa.expires ? usDate(v.baa.expires) : '—', 'Counsel decides whether each agreement is sufficient']) } : undefined }),
 ] }
}
