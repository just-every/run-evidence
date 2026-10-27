import type { Bindings } from '../../../auth.server'
import { Refusal } from '../../upload'
import type { ImportMapping, Json, SourceBundle } from '../base/types'
import { sha256 } from '../base/provenance/identity'
import { artifact, payloadHash } from '../manifest'
import { targetId } from '../plan'
import type { Review } from '../types'
import { emailKey } from './check'
import type { IdentityGroup, ParsedBundle } from './parse'
import { identityGroups } from './parse'
export const BUNDLE_MAPPING_VERSION = 'move-in-records-1'
export interface IdentityDecision { group: string; decision: 'same' | 'separate' | 'link-existing' }
export interface BundleMapping { identity: IdentityDecision[] }
export interface RecordValue {
 review_id: string; incumbent: string; class: string; type: string; source_id: string; source_path: string; source_hash: string
 exported_at: string | null; received_at: string; origin: 'imported'; verified: false; fields: Json
 file: { path: string; size: number; sha256: string; name: string } | null
 identity: { id: string; decision: string; group: string; linked_person_id: string | null } | null
}
// Groups that need the owner's decision: people sharing an email in the export, and any person whose
// email already belongs to a person in this installation. Nothing is matched or merged automatically.
export async function existingPeople(env: Bindings): Promise<Map<string, string>> {
 return new Map((await env.DB.prepare('SELECT id,email FROM people').all<{ id: string; email: string }>()).results.map(p => [emailKey(p.email), p.id]))
}
export async function identityReview(env: Bindings, parsed: Pick<ParsedBundle, 'rows'>): Promise<IdentityGroup[]> {
 const existing = new Map((await env.DB.prepare('SELECT id,name,email FROM people').all<{ id: string; name: string; email: string }>()).results.map(p => [emailKey(p.email), { id: p.id, name: p.name }]))
 const groups = new Map(identityGroups(parsed.rows).map(g => [g.key, g]))
 for (const r of parsed.rows) if (r.class === 'people' && r.type === 'person' && r.verdict === 'admit') {
  const f = r.fields as { email: string; display_name?: string; name?: string }, key = 'email:' + emailKey(f.email)
  if (existing.has(emailKey(f.email)) && !groups.has(key)) groups.set(key, { key, email: emailKey(f.email), members: [{ id: r.id, name: f.display_name ?? f.name ?? r.id }] })
 }
 return [...groups.values()].map(g => ({ ...g, existing: existing.get(g.email) ?? null })).sort((a, b) => a.key.localeCompare(b.key))
}
export async function validateBundleMapping(env: Bindings, parsed: ParsedBundle, input: unknown): Promise<BundleMapping> {
 const groups = await identityReview(env, parsed), given = (input && typeof input === 'object' ? (input as { identity?: unknown }).identity : undefined)
 if (!Array.isArray(given)) throw new Refusal('Send one identity decision for every person group.')
 const seen = new Set<string>(), identity: IdentityDecision[] = []
 for (const d of given) {
  const group = groups.find(g => g.key === d?.group)
  if (!group || seen.has(group.key)) throw new Refusal('Identity decision names an unknown or repeated group.')
  const allowed = group.members.length > 1 ? ['same', 'separate', ...(group.existing ? ['link-existing'] : [])] : ['separate', 'link-existing']
  if (!allowed.includes(d.decision) || (d.decision === 'link-existing' && !group.existing)) throw new Refusal('Choose one of: ' + allowed.join(', ') + ' for ' + group.email + '.')
  seen.add(group.key); identity.push({ group: group.key, decision: d.decision })
 }
 if (groups.some(g => !seen.has(g.key))) throw new Refusal('Resolve every duplicate or matching identity before saving: ' + groups.filter(g => !seen.has(g.key)).map(g => g.email).join(', ') + '.')
 return { identity: identity.sort((a, b) => a.group.localeCompare(b.group)) }
}
export function bundleInputs(review: Review, parsed: ParsedBundle, mapping: BundleMapping, existing: Map<string, string>) {
 const namespace = parsed.provider.toLowerCase() + '-package:' + review.archive_sha256
 const source: SourceBundle = { records: [], artifacts: [artifact('export.zip', parsed.archive)], diagnostics: parsed.summary.warnings.map(message => ({ severity: 'warning' as const, code: 'EXPORT_WARNING', message })) }
 const artifactHash = sha256(parsed.archive)
 for (const row of parsed.rows) {
  const kind = row.class + ':' + row.type
  const payload = { class: row.class, type: row.type, id: row.id, path: row.path, fields: row.fields, verdict: row.verdict, reason: row.reason ?? null, file: row.file ?? null }
  source.records.push({ namespace, kind, sourceId: row.id, payload: payload as unknown as Json, payloadHash: payloadHash(payload), artifactHash, location: { artifact: 'export.zip', pointer: row.path } })
 }
 const decision = (email: string) => mapping.identity.find(d => d.group === 'email:' + emailKey(email))
 const importer: ImportMapping = { version: BUNDLE_MAPPING_VERSION, map(record) {
  const p = record.payload as unknown as { class: string; type: string; fields: Json; verdict: string; reason: string | null; path: string; file: RecordValue['file'] }
  if (p.verdict === 'refused') return { effects: [], rejection: p.reason ?? 'Refused.' }
  if (p.verdict === 'unsupported') return { effects: [], unmapped: [{ reason: p.reason ?? 'Unsupported.' }] }
  let identity: RecordValue['identity'] = null
  if (p.class === 'people' && p.type === 'person') {
   const email = (p.fields as { email: string }).email, d = decision(email)
   // A person nobody shares an email with has no group to decide: their own imported identity.
   const merged = !!d && d.decision !== 'separate'
   identity = { id: targetId(review.id, 'identity', merged ? d!.group : record.sourceId), decision: d?.decision ?? 'unique', group: 'email:' + emailKey(email), linked_person_id: d?.decision === 'link-existing' ? existing.get(emailKey(email)) ?? null : null }
   if (d?.decision === 'link-existing' && !identity.linked_person_id) throw new Error('IDENTITY_LINK_MISSING')
  }
  const id = targetId(review.id, 'record', record.kind + '\u0000' + record.sourceId)
  const value: RecordValue = { review_id: review.id, incumbent: parsed.provider, class: p.class, type: p.type, source_id: record.sourceId, source_path: p.path, source_hash: record.payloadHash, exported_at: parsed.summary.exported_at, received_at: review.staged_at, origin: 'imported', verified: false, fields: p.fields, file: p.file, identity }
  return { effects: [{ targetKind: 'record', targetId: id, value: value as unknown as Json }] }
 } }
 return { source, mapping: importer, namespace }
}
