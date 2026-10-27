import type { Bindings } from '../../auth.server'
import { Refusal } from '../upload'
import { auditStatement, type Actor, type Input } from '../door'
import { controlsFor, edition, frameworks, mappedControls } from '../library'
import { statesAt, states, type Figures } from '../library/extended/usdp-data'
import { acceptedLibraryRevision } from './library-revision'
import type { ProgramRow } from './storage'
// PROGRAM-004: what the extended programs add to the shared program model. Business figures, the SPRS
// qualifiers and the ISO/IEC 27701 roles are inputs kept in the program's own revision snapshots; nothing here
// certifies, attests or scores on the assessor's behalf.
export interface SprsInputs { mfa: 'all' | 'privileged-remote' | 'none'; fips: 'validated' | 'not-validated' | 'none' }
export interface ProgramInputs { figures?: Figures; sprs?: SprsInputs }
export const isUsdp = (row: { framework: string }) => row.framework === 'usdp'
export const isCmmc2 = (row: { framework: string; edition: string }) => row.framework === 'cmmc' && row.edition === 'level-2'
export async function programInputs(env: Bindings, id: string): Promise<{ inputs: ProgramInputs; revision: number }> {
 const rows = (await env.DB.prepare('SELECT revision,snapshot_json FROM program_revisions WHERE program_id=? ORDER BY revision DESC').bind(id).all<{ revision: number; snapshot_json: string }>()).results
 for (const r of rows) { const snap = JSON.parse(r.snapshot_json) as { inputs?: ProgramInputs }; if (snap.inputs) return { inputs: snap.inputs, revision: r.revision } }
 return { inputs: {}, revision: 0 }
}
const money = (v: number) => '$' + v.toLocaleString('en-US')
export function parseFigures(input: Input): Figures {
 const json = (v: unknown) => { if (typeof v !== 'string' || !v.trim().startsWith('{')) return v; try { return JSON.parse(v) } catch { throw new Refusal('Figures must be valid JSON or form fields.') } }
 const raw = (json(input.figures) && typeof json(input.figures) === 'object' ? json(input.figures) : input) as Record<string, unknown>
 const num = (v: unknown, label: string, max: number) => { const n = typeof v === 'number' ? v : Number(String(v ?? '').replace(/[$,\s]/g, '')); if (!Number.isFinite(n) || n < 0 || n > max) throw new Refusal(`${label} must be a number from 0 to ${max.toLocaleString('en-US')}.`); return n }
 const flag = (v: unknown) => v === true || v === 'true' || v === 'on' || v === 'yes'
 const consumers: Record<string, number> = {}
 const given = json(raw.consumers)
 if (given && typeof given === 'object' && !Array.isArray(given)) for (const [k, v] of Object.entries(given as Record<string, unknown>)) consumers[k] = num(v, 'Consumers in ' + k, 1e10)
 else for (const line of String(raw.consumers ?? raw.usdp_consumers ?? '').split(/\r?\n|;/).map(l => l.trim()).filter(Boolean)) { const m = /^([A-Za-z]{2})\s*[:=]?\s*([\d,]+)$/.exec(line); if (!m) throw new Refusal('Write consumers as a state code and a count per line, such as CA 12000.'); consumers[m[1].toUpperCase()] = num(m[2], 'Consumers in ' + m[1], 1e10) }
 for (const code of Object.keys(consumers)) if (!states.some(s => s.code === code)) throw new Refusal(`${code} is not a state with a comprehensive privacy law in this library.`)
 return { annual_revenue_usd: num(raw.annual_revenue_usd ?? raw.usdp_revenue ?? 0, 'Annual gross revenue', 1e13), small_business: flag(raw.small_business ?? raw.usdp_small_business), sale_revenue_percent: num(raw.sale_revenue_percent ?? raw.usdp_sale_percent ?? 0, 'Revenue from selling personal data (percent)', 100), sensitive_data: flag(raw.sensitive_data ?? raw.usdp_sensitive), consumers }
}
export function stateRationale(f: Figures, code: string, rev: number, libraryRevision = 1) {
 const s = statesAt(libraryRevision).find(x => x.code === code)!, c = f.consumers[code] ?? 0
 return `${s.name} does not apply on the recorded figures (revision ${rev}): its threshold is ${s.threshold}. Recorded: ${c.toLocaleString('en-US')} ${s.name} consumers, ${money(f.annual_revenue_usd)} annual gross revenue, ${f.sale_revenue_percent}% of revenue from selling personal data, ${f.small_business ? 'a small business' : 'not a small business'}, ${f.sensitive_data ? 'processes' : 'does not process'} sensitive data.`.slice(0, 1000)
}
export const stateOf = (ref: string) => ref.split('.')[0]
export interface StateLine { code: string; name: string; act: string; effective: string; threshold: string; applies: boolean; consumers: number; decision: 'included' | 'excluded'; pending: 'include' | 'exclude' | null }
// The state review: the thresholds evaluated on the recorded figures, set against the program's current applicability decisions.
export async function stateReview(env: Bindings, row: ProgramRow, current: Map<string, { state: string }>): Promise<{ figures: Figures | null; revision: number; states: StateLine[] }> {
 const { inputs, revision } = await programInputs(env, row.id), f = inputs.figures ?? null, laws = statesAt(await acceptedLibraryRevision(env))
 const refs = edition(row.framework, row.edition)!.requirements.map(r => r.ref)
 return { figures: f, revision, states: laws.map(s => {
  const mine = refs.filter(r => stateOf(r) === s.code), excluded = mine.filter(r => current.get(r)?.state === 'excluded').length, decision = excluded === mine.length ? 'excluded' as const : 'included' as const
  const applies = f ? s.applies(f, f.consumers[s.code] ?? 0) : false
  return { code: s.code, name: s.name, act: s.act, effective: s.effective, threshold: s.threshold, applies, consumers: f?.consumers[s.code] ?? 0, decision, pending: f && applies && decision === 'excluded' ? 'include' : f && !applies && decision === 'included' ? 'exclude' : null }
 }) }
}
export async function recordInputs(env: Bindings, actor: Actor, id: string, row: ProgramRow, input: Input, now: Date) {
 const reason = String(input.reason ?? '').trim().slice(0, 500)
 if (!reason) throw new Refusal('Give the reason for this change (up to 500 characters).')
 const { inputs } = await programInputs(env, id), next: ProgramInputs = { ...inputs }
 if (isUsdp(row)) next.figures = parseFigures(input)
 else if (isCmmc2(row)) {
  const mfa = String(input.mfa ?? ''), fips = String(input.fips ?? '')
  if (!['all', 'privileged-remote', 'none'].includes(mfa) || !['validated', 'not-validated', 'none'].includes(fips)) throw new Refusal('Choose the MFA coverage and the cryptography status.')
  next.sprs = { mfa: mfa as SprsInputs['mfa'], fips: fips as SprsInputs['fips'] }
 } else throw new Refusal('This program records no business figures.')
 const revision = Number((await env.DB.prepare('SELECT MAX(revision) AS n FROM program_revisions WHERE program_id=?').bind(id).first<{ n: number }>())?.n ?? 0) + 1
 await env.DB.batch([
  env.DB.prepare('INSERT INTO program_revisions(id,program_id,revision,snapshot_json,actor_id,actor_name,reason,at) VALUES(?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(), id, revision, JSON.stringify({ ...row, inputs: next, updated_at: now.toISOString() }), actor.id, actor.name, 'Figures recorded: ' + reason, now.toISOString()),
  auditStatement(env, actor, 'program.inputs', 'program:' + id, now, 'succeeded', isUsdp(row) ? 'business figures' : 'SPRS qualifiers', { reason, revision }),
 ])
 return { revision }
}
// Accepting a state change is the owner's reviewed decision: it includes (or excludes) that state's obligations with the figures that justify it.
export async function decideStateChange(env: Bindings, actor: Actor, id: string, row: ProgramRow, current: Map<string, { state: string }>, input: Input, now: Date) {
 const code = String(input.state ?? '').toUpperCase(), reason = String(input.reason ?? '').trim().slice(0, 500)
 if (!reason) throw new Refusal('Give the reason for accepting this change (up to 500 characters).')
 const review = await stateReview(env, row, current), line = review.states.find(s => s.code === code)
 if (!line?.pending || !review.figures) throw new Refusal('That state has no pending applicability change.', 409)
 const refs = edition(row.framework, row.edition)!.requirements.map(r => r.ref).filter(r => stateOf(r) === code), include = line.pending === 'include'
 const rationale = include ? `${line.name} now applies on the recorded figures (revision ${review.revision}): ${line.threshold}. Accepted by ${actor.name}: ${reason}`.slice(0, 1000) : stateRationale(review.figures, code, review.revision, await acceptedLibraryRevision(env))
 const data = JSON.stringify(refs), at = now.toISOString()
 await env.DB.batch([
  env.DB.prepare("INSERT INTO program_applicability(id,program_id,ref,state,rationale,actor_id,actor_name,decided_at) SELECT lower(hex(randomblob(16))),?,value,?,?,?,?,? FROM json_each(?)").bind(id, include ? 'included' : 'excluded', rationale, actor.id, actor.name, at, data),
  auditStatement(env, actor, 'program.state-change', 'program:' + id, now, 'succeeded', `${code} ${include ? 'included' : 'excluded'}`, { reason, revision: review.revision }),
 ])
 return { state: code, decision: include ? 'included' : 'excluded' }
}
// SPRS worksheet (DoD Assessment Methodology v1.2.1): 110 less the weight of every included requirement not implemented.
// Implemented here means mapped, proof current, no failing or unknown test and no missing policy; a plan of action never substitutes.
export function sprs(row: ProgramRow, requirements: { ref: string; title: string; state: string; proof: string; testing: string; policy: string }[], inputs: SprsInputs | undefined) {
 const weights = new Map(edition(row.framework, row.edition)!.requirements.map(r => [r.ref, r.weight ?? 1]))
 const lines = requirements.map(r => {
  const implemented = r.state === 'excluded' || (r.proof === 'current' && r.testing !== 'failing' && r.testing !== 'unknown' && r.policy !== 'missing')
  const full = weights.get(r.ref) ?? 1
  const deduction = implemented || r.ref === '3.12.4' ? 0 : r.ref === '3.5.3' && inputs?.mfa === 'privileged-remote' ? 3 : r.ref === '3.13.11' && inputs?.fips === 'not-validated' ? 3 : full
  return { ref: r.ref, title: r.title, weight: full, implemented, excluded: r.state === 'excluded', deduction }
 })
 const sspMissing = lines.find(l => l.ref === '3.12.4' && !l.implemented && !l.excluded)
 return { score: 110 - lines.reduce((n, l) => n + l.deduction, 0), maximum: 110, minimum: -203, deductions: lines.filter(l => l.deduction > 0), implemented: lines.filter(l => l.implemented && !l.excluded).length, excluded: lines.filter(l => l.excluded).length, qualifiers: inputs ?? null, blocked: sspMissing ? 'No current system security plan (3.12.4): DoD cannot complete an assessment without one, so a score is not valid to submit.' : null,
  note: 'Self-assessed score for the business to submit in SPRS; Evidence derives it from live proof and tests and does not submit or attest it. A plan of action does not make a requirement implemented (3.12.2). MFA for remote and privileged users only deducts 3; encryption that is not FIPS-validated deducts 3.' }
}
// The evidence this program shares with the other programs on the installation, through the library controls they both map.
export async function reuse(env: Bindings, row: ProgramRow, others: ProgramRow[], states: Map<string, { proof: string; evidence: { id: string }[]; library_id: string | null }>, revision: number) {
 const mine = new Set(mappedControls(row.framework, row.edition, revision).map(c => c.id))
 const owned = [...states.values()].filter(s => s.library_id && mine.has(s.library_id))
 return others.filter(p => p.id !== row.id && p.framework !== row.framework).map(p => {
  const theirs = new Set(mappedControls(p.framework, p.edition, revision).map(c => c.id)), shared = owned.filter(s => theirs.has(s.library_id!))
  const requirements = edition(row.framework, row.edition)!.requirements.filter(r => controlsFor(row.framework, row.edition, r.ref, revision).some(c => theirs.has(c.id))).length
  return { program_id: p.id, program: p.name, framework: frameworks[p.framework].name, shared_controls: shared.length, requirements_covered: requirements, evidence_items: shared.reduce((n, s) => n + s.evidence.length, 0), proof_current: shared.filter(s => s.proof === 'current').length }
 }).filter(r => r.shared_controls > 0)
}
export const roleSummary = (ready: { requirements: { ref: string; state: string }[] }, row: ProgramRow) => {
 if (row.framework !== 'iso27701') return null
 const roles = new Map(edition(row.framework, row.edition)!.requirements.map(r => [r.ref, r.optional ?? 'both']))
 const out: Record<string, { included: number; excluded: number }> = {}
 for (const r of ready.requirements) { const role = roles.get(r.ref) ?? 'both', o = (out[role] ??= { included: 0, excluded: 0 }); o[r.state === 'excluded' ? 'excluded' : 'included']++ }
 return out
}

// The extended parts of a readiness result, as the program export carries them (null for the core programs).
export const extendedExport = (ready: object) => { const r = ready as { dependency?: string; reuse?: unknown; usdp?: unknown; sprs?: unknown; roles?: unknown }; return r.dependency === undefined ? null : { dependency: r.dependency, reuse: r.reuse, usdp: r.usdp, sprs: r.sprs, roles: r.roles } }
