import type { Bindings } from '../../../auth.server'
import { parseList } from '../../door'
import { day } from '../../model'
import { policyList } from '../../policy/storage'
import { documents as vendorDocuments, profileOf, kindLabels } from '../../vendor/storage'
import { needs, requestsOf } from '../../vendor/diligence'
import { readiness } from '../readiness'
import type { ProgramRow } from '../storage'
import type { Cite, Section } from './model'
// What every generator reads: the live program state, never a copy. A fact is
// the comparable value a document asserted when its revision was written.
export type Inputs = Record<string, unknown>
export interface Fact { label: string; value: string }
export interface Generated { subtitle: string; sections: Section[]; facts: Record<string, Fact> }
export interface Ctx { env: Bindings; program: ProgramRow; ready: Awaited<ReturnType<typeof readiness>>; now: Date; inputs: Inputs; documentId: string }
export const list = (value: unknown): string[] => Array.isArray(value) ? value.map(String) : []
export const rows = (value: unknown): Record<string, string>[] => Array.isArray(value) ? value.filter(v => v && typeof v === 'object').map(v => Object.fromEntries(Object.entries(v as object).map(([k, x]) => [k, String(x ?? '')]))) : []
export const record = (value: unknown): Record<string, string> => value && typeof value === 'object' && !Array.isArray(value) ? Object.fromEntries(Object.entries(value as object).map(([k, x]) => [k, String(x ?? '')])) : {}
export const scope = (p: ProgramRow) => ({ products: parseList(p.products), teams: parseList(p.teams), regions: parseList(p.regions), systems: parseList(p.systems), categories: parseList(p.categories) })
export async function programRevision(env: Bindings, program: string) { return Number((await env.DB.prepare('SELECT MAX(revision) AS n FROM program_revisions WHERE program_id=?').bind(program).first<{ n: number }>())?.n ?? 0) }
export const programCite = (p: ProgramRow, revision: number): Cite => ({ kind: 'program', ref: p.id, revision, label: `Program scope: ${p.name}` })
export async function inventory(env: Bindings) {
 return (await env.DB.prepare('SELECT type,COUNT(*) AS n,group_concat(DISTINCT source_label) AS sources,MAX(updated_at) AS latest FROM resources WHERE removed_at IS NULL GROUP BY type ORDER BY type').all<{ type: string; n: number; sources: string; latest: string }>()).results
}
export const inventoryCite = (r: { type: string; n: number; latest: string }): Cite => ({ kind: 'inventory', ref: r.type, revision: `${r.n}@${r.latest}`, label: `Inventory: ${r.n} ${r.type.replaceAll('_', ' ')} resource${r.n === 1 ? '' : 's'}` })
export async function headcount(env: Bindings) {
 return (await env.DB.prepare("SELECT p.kind,COUNT(*) AS n FROM people p LEFT JOIN people_departures d ON d.person_id=p.id WHERE d.person_id IS NULL AND p.kind IN ('employee','contractor') GROUP BY p.kind").all<{ kind: string; n: number }>()).results
}
// Published policy revisions: the approved text a document may cite.
export async function publishedPolicies(env: Bindings, now: Date) {
 return (await policyList(env, now)).filter(p => p.published).map(p => ({ id: p.id, title: p.title, version: p.published!.version, effective: p.published!.effective_date ?? p.published!.published_at?.slice(0, 10) ?? '', sha: p.published!.body_sha256, state: p.review_state }))
}
export const policyCite = (p: { id: string; title: string; version: number }): Cite => ({ kind: 'policy', ref: p.id, revision: p.version, label: `Policy: ${p.title}` })
export interface VendorLine { id: string; name: string; criticality: string; tier: string; data_types: string[]; region: string; service: string; contact: string; approval: string; baa: { state: string; effective: string; expires: string; ref: string; sha: string }; soc: string }
export async function vendorLines(env: Bindings, now: Date): Promise<VendorLine[]> {
 const vendors = (await env.DB.prepare('SELECT id,name,criticality FROM vendors ORDER BY name').all<{ id: string; name: string; criticality: string }>()).results
 return Promise.all(vendors.map(async v => {
  const profile = await profileOf(env, v.id), docs = await vendorDocuments(env, v.id), reqs = await requestsOf(env, v.id), n = needs(profile, docs, reqs, now)
  const baa = docs.filter(d => d.kind === 'baa' && d.review_state !== 'rejected' && !docs.some(x => x.supersedes === d.id)).at(-1)
  const approval = (await env.DB.prepare('SELECT decision FROM vendor_approvals WHERE vendor_id=? ORDER BY decided_at DESC,rowid DESC LIMIT 1').bind(v.id).first<{ decision: string }>())?.decision ?? 'not assessed'
  const baaNeed = n.find(x => x.key === 'baa')!, soc = n.find(x => x.key === 'soc2')!
  return { id: v.id, name: v.name, criticality: v.criticality, tier: profile?.risk_tier ?? 'unassessed', data_types: profile?.data_types ?? [], region: profile?.region ?? '', service: profile?.service ?? '', contact: profile?.contact_email ?? '', approval,
   baa: baa ? { state: baa.expires_on && baa.expires_on < day(now) ? 'expired' : baa.review_state === 'verified' ? 'verified' : 'received', effective: baa.effective_on ?? '', expires: baa.expires_on ?? '', ref: baa.id, sha: baa.sha256 } : { state: baaNeed.state === 'not required' ? 'not on file' : baaNeed.state, effective: '', expires: '', ref: '', sha: '' }, soc: soc.state }
 }))
}
export const vendorCite = (v: VendorLine): Cite => ({ kind: 'vendor', ref: v.id, label: `Vendor: ${v.name}` })
export const baaCite = (v: VendorLine): Cite | null => v.baa.ref ? { kind: 'vendor-document', ref: v.baa.ref, revision: v.baa.sha.slice(0, 12), label: `${kindLabels.baa} from ${v.name}` } : null
// Implementation status of a requirement from the live controls: implemented
// needs every mapped control's proof current and any test passing now.
export function implementation(r: Ctx['ready']['requirements'][number]) {
 if (r.state === 'excluded') return 'not applicable (excluded)'
 if (!r.controls.length) return 'not implemented (no mapped control)'
 const ok = (c: typeof r.controls[number]) => c.proof === 'current' && (!c.tests || !c.tests.tests || (c.tests.pass > 0 && !c.tests.fail && !c.tests.unknown))
 if (r.controls.every(ok)) return 'implemented'
 return r.controls.some(ok) ? 'partially implemented' : 'not implemented'
}
export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
