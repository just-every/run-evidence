import { Refusal } from '../../upload'
import { sha256 } from '../base/provenance/identity'
import { unzip } from '../zip'
import { emailKey, parseJson } from './check'
import { classes, type AbsentField, type ClassId, type Provider, type SourceRow } from './classes'
import { Rows } from './rows'
import { parseSecureframe } from './secureframe'
import { parseVanta } from './vanta'
export interface ClassSummary { id: ClassId; label: string; source: number; admitted: number; unsupported: number; refused: number; types: Record<string, number>; fields: Record<string, string[]>; issues: { id: string; type: string; verdict: string; reason: string }[]; absent: (AbsentField & { manual: string })[] }
export interface IdentityGroup { key: string; email: string; members: { id: string; name: string }[]; existing?: { id: string; name: string } | null }
export interface BundleSummary {
 provider: Provider; shape: string; archive_sha256: string; exported_at: string | null; files: number; warnings: string[]
 classes: ClassSummary[]; identity_groups: IdentityGroup[]; exhibits: { id: string; name: string; size: number; sha256: string }[]
 bytes: { source: number; admitted: number }
}
export interface ParsedBundle { provider: Provider; archive: Uint8Array; files: Map<string, Uint8Array>; rows: SourceRow[]; summary: BundleSummary }
const MAX_ENTRIES = 3000
export function detectProvider(files: Map<string, Uint8Array>): Provider | null {
 const found = (['Vanta', 'Secureframe'] as const).filter(p => [...files.keys()].some(path => path.startsWith(p.toLowerCase() + '/')))
 if (found.length > 1) throw new Refusal('This ZIP mixes Vanta and Secureframe files. Upload one incumbent per ZIP.')
 return found[0] ?? null
}
export function summarize(provider: Provider, rows: Rows, shape: string, archive: Uint8Array, exportedAt: string | null): BundleSummary {
 const absent = rows.absent
 const summaries = classes.map(c => {
  const mine = rows.rows.filter(r => r.class === c.id), types: Record<string, number> = {}
  for (const r of mine) types[r.type] = (types[r.type] ?? 0) + 1
  const count = (v: string) => mine.filter(r => r.verdict === v).length, fields: Record<string, string[]> = {}
  for (const r of mine) if (r.verdict === 'admit') fields[r.type] = [...new Set([...(fields[r.type] ?? []), ...Object.keys(r.fields as object)])].sort()
  return { id: c.id, label: c.label, source: mine.length, admitted: count('admit'), unsupported: count('unsupported'), refused: count('refused'), types, fields, issues: mine.filter(r => r.verdict !== 'admit').slice(0, 50).map(r => ({ id: r.id, type: r.type, verdict: r.verdict, reason: r.reason ?? '' })), absent: absent.filter(a => a.class === c.id).map(a => ({ ...a, manual: c.manual })) } as ClassSummary
 })
 const files = rows.rows.filter(r => r.file)
 return {
  provider, shape, archive_sha256: sha256(archive), exported_at: exportedAt, files: rows.files.size, warnings: rows.warnings, classes: summaries, identity_groups: identityGroups(rows.rows),
  exhibits: files.filter(r => r.verdict === 'admit').slice(0, 200).map(r => ({ id: r.type + ':' + r.id, name: r.file!.name, size: r.file!.size, sha256: r.file!.sha256 })),
  bytes: { source: files.reduce((n, r) => n + r.file!.size, 0), admitted: files.filter(r => r.verdict === 'admit').reduce((n, r) => n + r.file!.size, 0) },
 }
}
// People sharing a normalized email are one reviewed group; nothing merges until the owner decides.
export function identityGroups(rows: SourceRow[]): IdentityGroup[] {
 const by = new Map<string, IdentityGroup>()
 for (const r of rows) if (r.class === 'people' && r.type === 'person' && r.verdict === 'admit') {
  const f = r.fields as { email: string; display_name?: string; name?: string }, key = 'email:' + emailKey(f.email), g = by.get(key) ?? { key, email: emailKey(f.email), members: [] }
  g.members.push({ id: r.id, name: f.display_name ?? f.name ?? r.id }); by.set(key, g)
 }
 return [...by.values()].filter(g => g.members.length > 1)
}
export function parseBundle(archive: Uint8Array, expected?: Provider): ParsedBundle {
 const files = unzip(archive, { maxEntries: MAX_ENTRIES }), provider = detectProvider(files)
 if (!provider) throw new Refusal('This ZIP has no vanta/ or secureframe/ folder of API pages. See "Supported export shape".')
 if (expected && provider !== expected) throw new Refusal('This ZIP holds ' + provider + ' pages, not ' + expected + '.')
 let exportedAt: string | null = null
 const info = files.get('export-info.json')
 if (info) { const j = parseJson('export-info.json', info) as any; if (j && typeof j.exported_at === 'string' && !Number.isNaN(Date.parse(j.exported_at))) exportedAt = j.exported_at; else throw new Refusal('export-info.json needs an exported_at date-time.') }
 const rows = new Rows(files)
 if (provider === 'Vanta') parseVanta(rows); else parseSecureframe(rows)
 if (!rows.rows.length) throw new Refusal('No ' + provider + ' API pages with records were found under ' + provider.toLowerCase() + '/.')
 if (rows.rows.length > 20000) throw new Refusal('At most 20,000 records per ZIP; split larger exports by resource.')
 return { provider, archive, files, rows: rows.rows, summary: summarize(provider, rows, provider === 'Vanta' ? 'vanta-api-pages' : 'secureframe-api-pages', archive, exportedAt) }
}
// Drata's evidence package holds controls and their evidence files only; every other class is named as absent.
export function drataClasses(controls: number, evidence: { available: boolean; path: string }[]): ClassSummary[] {
 return classes.map(c => {
  const source = c.id === 'frameworks_controls' ? controls : c.id === 'exhibits' ? evidence.length : 0
  const refused = c.id === 'exhibits' ? evidence.filter(e => !e.available).length : 0
  return { id: c.id, label: c.label, source, admitted: source - refused, unsupported: 0, refused, types: source ? { [c.id === 'exhibits' ? 'evidence file' : 'control']: source } : {}, fields: source ? { [c.id === 'exhibits' ? 'evidence file' : 'control']: c.id === 'exhibits' ? ['file', 'requirement', 'source path', 'sha256', 'size'] : ['name', 'requirement'] } : {}, issues: c.id === 'exhibits' ? evidence.filter(e => !e.available).map(e => ({ id: e.path, type: 'evidence file', verdict: 'refused', reason: 'Referenced bytes are missing from the ZIP; no receipt is issued.' })) : [], absent: source ? (c.id === 'frameworks_controls' ? [{ class: c.id, what: 'Control-to-requirement mappings: the package lists a requirement per file; Controls-to-Requirements.csv stays in the retained ZIP', route: 'Map controls to requirements in Evidence.', manual: c.manual }] : []) : [{ class: c.id, what: 'Not part of Drata\'s evidence package, which holds controls and their evidence files', route: 'Use an authorized Drata API read, or the manual route below.', manual: c.manual }] } as ClassSummary
 })
}
