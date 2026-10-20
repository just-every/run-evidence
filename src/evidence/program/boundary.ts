import type { Bindings } from '../../auth.server'
import { escape } from '../view'
import { slab } from '../ui'
import { parseList } from '../door'
import { day } from '../model'
import { desk } from '../storage'
import { costRows, providerCosts } from '../costs'
import { folders } from '../review/storage'
import type { FrameworkId } from '../library'
import type { ProgramRow } from './storage'
import type { readiness } from './readiness'
type Readiness = Awaited<ReturnType<typeof readiness>>

// BOUNDARY-001. Evidence prepares evidence; the named specialists decide,
// operate and sign. Prerequisites are shown, never verified by Evidence.
export interface Prerequisite { kind: 'agreement' | 'regional' | 'licensed content'; title: string; detail: string }
const unverified = 'Not verified by Evidence. Keep the signed record as an exhibit; your counsel or assessor decides whether it is sufficient.'
const prerequisites: Record<FrameworkId, Prerequisite[]> = {
 soc2: [
  { kind: 'agreement', title: 'Data processing agreements (DPAs)', detail: 'A DPA with each customer whose personal data you process and with each subprocessor that processes it for you.' },
  { kind: 'licensed content', title: 'AICPA Trust Services Criteria', detail: 'Evidence ships criterion ids and short summaries only; read the criteria text and points of focus from your licensed AICPA copy.' },
 ],
 iso27001: [
  { kind: 'agreement', title: 'Data processing agreements (DPAs)', detail: 'A DPA with each processor of personal data in scope, and the supplier agreements Annex A expects.' },
  { kind: 'licensed content', title: 'ISO/IEC 27001 standard', detail: 'Evidence ships clause and control ids with short summaries; buy the standard from ISO or your national standards body.' },
 ],
 hipaa: [
  { kind: 'agreement', title: 'Business associate agreements (BAAs)', detail: 'A signed BAA with each business associate that creates, receives, maintains or transmits ePHI for you (45 CFR 164.308(b)(1), 164.314(a)), including the hosting account this installation runs on before any exhibit holds ePHI.' },
 ],
 pci: [
  { kind: 'agreement', title: 'Third-party service provider agreements', detail: 'Written agreements in which each service provider acknowledges responsibility for the account data it handles (PCI DSS requirement 12.8).' },
  { kind: 'licensed content', title: 'PCI DSS standard', detail: 'Evidence ships requirement numbers with short summaries; read the standard from your copy under the PCI SSC license.' },
 ],
}
// A region counts as US when its name starts with "us" followed by a separator
// or digit (us-east-1, us-central1, US), names the United States, or is an Azure
// US region (eastus, westus2, centralus). Any other named region is non-US.
export const usRegion = (region: string) => /^us(?:$|[-_\s\d])|united states|^(?:east|west|central|north ?central|south ?central|west ?central)\s?us\d?$/i.test(region.trim())
export function programPrerequisites(row: ProgramRow) {
 const regions = parseList(row.regions), abroad = regions.filter(r => !usRegion(r))
 const regional: Prerequisite = abroad.length
  ? { kind: 'regional', title: 'Regional controls outside the US', detail: `Regions outside the US are in scope: ${abroad.join(', ')}. Confirm data residency, transfer terms and local-law obligations for them with counsel before processing data there; they stay in the program.` }
  : { kind: 'regional', title: 'US-first regional scope', detail: regions.length ? `Every region in scope is in the US: ${regions.join(', ')}. Which US state privacy laws apply is for your counsel to decide.` : 'No region is recorded yet. Name the regions in scope; which US state privacy laws apply is for your counsel to decide.' }
 return [...prerequisites[row.framework], regional].map(p => ({ ...p, status: 'not verified by Evidence' as const }))
}

// The specialists who decide, operate and sign, and where their records enter Evidence.
export const specialists = [
 { role: 'Independent penetration testers', evidence: 'Their findings and retest letters are imported, never performed by Evidence.', href: '/app/vulnerabilities' },
 { role: 'Cloud, identity, code and training providers', evidence: 'Their read-only source checks are collected from the named provider; Evidence does not operate those systems.', href: '/app/connections' },
 { role: 'Vector and your other trackers', evidence: 'Remediation work is linked to tickets there; general project work stays in Vector.', href: '/app/remediation' },
 { role: 'Your incident tooling', evidence: 'Incident response stays in your tracker and incident tools; Evidence keeps their records as exhibits.', href: '/app/tests' },
] as const

export function costsFor(env: Bindings, providers: string[]) {
 const mail = env.MAIL_PROVIDER === 'cloudflare' ? 'cloudflare_mail' : env.MAIL_PROVIDER === 'resend' || env.MAIL_PROVIDER === 'sendgrid' ? env.MAIL_PROVIDER : null
 return [...new Set(['cloudflare', ...(mail ? [mail] : []), ...providers])]
}
const connectedProviders = async (env: Bindings) => [
 ...(await env.DB.prepare("SELECT DISTINCT provider FROM connections WHERE status!='revoked' ORDER BY provider").all<{ provider: string }>()).results.map(r => r.provider),
 ...(await env.DB.prepare('SELECT DISTINCT provider FROM tracker_destinations ORDER BY provider').all<{ provider: string }>()).results.map(r => r.provider),
]

export async function boundaryPanel(env: Bindings, row: ProgramRow, assessor: string) {
 const providers = costsFor(env, await connectedProviders(env))
 return slab(`<section aria-labelledby="boundary-title" id="boundary"><h2 id="boundary-title">Prerequisites and assessor handoff</h2><p class="panel-intro">${escape(assessor)} Evidence prepares the evidence; no template, score or export here certifies you, establishes legal sufficiency or authorizes regulated data.</p><h3>Data-processing prerequisites</h3><ul class="plain-list">${programPrerequisites(row).map(p => `<li data-prerequisite="${escape(p.kind)}"><strong>${escape(p.title)}</strong> · ${escape(p.kind)}: ${escape(p.detail)} <small>${escape(unverified)}</small></li>`).join('')}</ul><h3>Who does the work Evidence does not</h3><ul class="plain-list">${specialists.map(s => `<li><a href="${s.href}">${escape(s.role)}</a>: ${escape(s.evidence)}</li>`).join('')}</ul><p>Assessor and counsel fees are set by them; Evidence does not set or collect them.</p>${providerCosts(providers)}<p class="actions-row"><a class="button button-secondary" href="/api/programs/${row.id}/handoff">Export assessor handoff pack (JSON)</a> <a class="button button-secondary" href="/app/folders">Share files through a review folder</a></p></section>`)
}

// The pack an independent assessor receives: scope, prerequisites, who
// decides, USD costs, readiness with every unresolved item, and a fingerprinted
// index of the current exhibits behind each included requirement. Files are
// shared through expiring review folders, never inside the pack.
export async function handoffPack(env: Bindings, row: ProgramRow, ready: Readiness, now: Date) {
 const controls = new Set(ready.requirements.filter(r => r.state === 'included').flatMap(r => r.controls.map(c => c.id)))
 const evidence = (await desk(env, day(now), now)).requirements.filter(r => controls.has(r.control_id)).map(r => ({
  control: r.control_name, library_id: r.library_id, requirement: r.name, gap: r.gap,
  exhibits: r.receipts.filter(x => !x.superseded_by).map(x => ({ receipt: x.id, filename: x.filename, sha256: x.sha256, covered_from: x.covered_from, covered_to: x.covered_to, source: x.source, origin: x.origin, available: x.available })),
 }))
 return {
  format: 'evidence-assessor-handoff', version: 1, exported_at: now.toISOString(),
  certification: 'None asserted. ' + ready.framework.assessor,
  boundary: 'Evidence prepares evidence. It does not certify, establish legal sufficiency, authorize regulated data or operate the external systems it reads.',
  program: { id: row.id, name: row.name, framework: ready.framework.name, edition: row.edition, legal_entity: row.legal_entity, report_type: row.report_type, products: parseList(row.products), regions: parseList(row.regions), systems: parseList(row.systems), audit_from: row.audit_from, audit_to: row.audit_to, assessor: row.assessor },
  assessor: { named: row.assessor || null, decides: ready.framework.assessor, licensed_text: ready.framework.licence },
  prerequisites: programPrerequisites(row),
  specialists: specialists.map(({ role, evidence }) => ({ role, evidence })),
  costs: { evidence: 'USD 0', assessor_fees: 'Set by your assessor; Evidence does not set or collect them.', providers: costRows(costsFor(env, await connectedProviders(env))) },
  readiness: ready.totals, calculation: ready.calculation,
  requirements: ready.requirements.map(r => ({ ref: r.ref, title: r.title, state: r.state, rationale: r.rationale, ready: r.ready, proof: r.proof, testing: r.testing, failing_sources: r.failing_sources, controls: r.controls.map(c => c.library_id ?? c.name) })),
  unresolved: ready.requirements.filter(r => r.state === 'included' && !r.ready).map(r => ({ ref: r.ref, title: r.title, proof: r.proof, testing: r.testing, policy: r.policy })),
  evidence,
  review_folders: (await folders(env)).map(f => ({ id: f.id, reviewer: f.reviewer_label, period_from: f.period_from, period_to: f.period_to, expires_at: f.expires_at, open: !f.closed_at && now.getTime() < Date.parse(f.expires_at) })),
 }
}
