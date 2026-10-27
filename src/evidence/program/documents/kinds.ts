import type { FrameworkId } from '../../library'
import type { Ctx, Generated, Inputs } from './context'
import { list, record } from './context'
import { soc2Description } from './soc2'
import { isoAuditProgramme, isoManagementReview, isoRiskTreatment, isoSoa } from './iso'
import { hipaaBaaInventory, hipaaPolicySet, hipaaRiskAnalysis } from './hipaa'
import { pciAocHandoff, pciCdeScope, pciSaq, answerOptions, responses } from './pci'
import { privacyKinds } from './privacy'
import { regulatedKinds } from './regulated'
// The documents each core program generates, versions and exports.
export interface Kind { framework: FrameworkId; title: string; blurb: string; generate: (c: Ctx) => Promise<Generated>; parse: (form: Record<string, string | string[]>, current: Inputs) => Inputs }
const keep = (_: Record<string, string | string[]>, current: Inputs) => current
const lines = (v: unknown) => (Array.isArray(v) ? v.join('\n') : typeof v === 'string' ? v : '').split('\n').map(x => x.trim()).filter(Boolean)
const cols = (v: unknown, names: string[]) => lines(v).map(l => { const p = l.split('|').map(x => x.trim()); return Object.fromEntries(names.map((n, i) => [n, p[i] ?? ''])) })
export const kinds: Record<string, Kind> = {
 'soc2-description': { framework: 'soc2', title: 'SOC 2 system description', blurb: 'AICPA description criteria: services, commitments, infrastructure, software, people, data, procedures, subservice organizations, complementary user entity controls and changes in the period.', generate: soc2Description,
  parse: (f, cur) => ({ ...cur, ...(f.cuec !== undefined ? { cuec: lines(f.cuec).map(control => ({ control })) } : {}), ...(Object.keys(f).some(k => k.startsWith('subservice.')) ? { subservice: { ...record(cur.subservice), ...Object.fromEntries(Object.entries(f).filter(([k]) => k.startsWith('subservice.')).map(([k, v]) => [k.slice(11), String(v)])) } } : {}) }) },
 'iso-soa': { framework: 'iso27001', title: 'Statement of Applicability', blurb: 'Every Annex A control with its included or excluded state, justification, implementation status and linked controls and evidence.', generate: isoSoa,
  parse: (f, cur) => f.control_ref && f.justification !== undefined ? { ...cur, justifications: { ...record(cur.justifications), [String(f.control_ref)]: String(f.justification) } } : cur },
 'iso-risk-treatment': { framework: 'iso27001', title: 'Risk assessment and treatment plan (clause 6.1)', blurb: 'The risk register assessed and treated, from the risk records.', generate: isoRiskTreatment, parse: keep },
 'iso-internal-audit': { framework: 'iso27001', title: 'Internal audit programme (clause 9.2)', blurb: 'Independent audits, findings, nonconformities and corrective actions.', generate: isoAuditProgramme, parse: keep },
 'iso-management-review': { framework: 'iso27001', title: 'Management review (clause 9.3)', blurb: 'Required inputs, decisions and actions of each management review.', generate: isoManagementReview, parse: keep },
 'hipaa-risk-analysis': { framework: 'hipaa', title: 'Security Rule risk analysis', blurb: '45 CFR 164.308(a)(1)(ii)(A): ePHI systems and flows, threats and vulnerabilities, likelihood and impact, current safeguards and the remediation plan.', generate: hipaaRiskAnalysis,
  parse: (f, cur) => f.ephi_systems !== undefined ? { ...cur, ephi_systems: cols(f.ephi_systems, ['system', 'ephi', 'flow']) } : cur },
 'hipaa-policy-set': { framework: 'hipaa', title: 'HIPAA policy set', blurb: 'The policies the HIPAA controls call for and the approved revision of each.', generate: hipaaPolicySet, parse: keep },
 'hipaa-baa-inventory': { framework: 'hipaa', title: 'Business associate agreement inventory', blurb: 'Every supplier that handles ePHI with the state of its BAA, from Vendors.', generate: hipaaBaaInventory, parse: keep },
 'pci-cde-scope': { framework: 'pci', title: 'Cardholder data environment scope', blurb: 'CDE systems, data-flow and network diagrams attached as exhibits, and service providers with cardholder data.', generate: pciCdeScope,
  parse: (f, cur) => f.cde_systems !== undefined ? { ...cur, cde_systems: cols(f.cde_systems, ['system', 'role', 'location']) } : cur },
 'pci-saq': { framework: 'pci', title: 'SAQ selection and worksheet', blurb: 'Guided SAQ type selection with recorded answers and a requirement-by-requirement worksheet.', generate: pciSaq,
  parse: (f, cur) => {
   const answers = { ...((cur.saq_answers ?? {}) as Record<string, unknown>) }
   for (const k of Object.keys(answerOptions)) if (f['answer.' + k] !== undefined) answers[k] = k === 'channels' ? list(f['answer.' + k]) : String(f['answer.' + k])
   const given = { ...record(cur.saq_responses) }, explanations = { ...record(cur.saq_explanations) }
   for (const [k, v] of Object.entries(f)) if (k.startsWith('response.') && (responses as readonly string[]).includes(String(v))) given[k.slice(9)] = String(v)
   for (const [k, v] of Object.entries(f)) if (k.startsWith('explanation.')) explanations[k.slice(12)] = String(v).trim().slice(0, 8000)
   return { ...cur, saq_answers: answers, saq_responses: given, saq_explanations: explanations }
  } },
 'pci-aoc-handoff': { framework: 'pci', title: 'Attestation of Compliance handoff package', blurb: 'The package the merchant or QSA signs. Evidence signs nothing.', generate: pciAocHandoff, parse: keep },
}
Object.assign(kinds, privacyKinds, regulatedKinds)
export const kindsFor = (framework: FrameworkId) => Object.entries(kinds).filter(([, k]) => k.framework === framework).map(([id, k]) => ({ id, ...k }))

