import type { Bindings } from '../../auth.server'
import { validDate } from '../model'
import { Refusal, MAX_FILE } from '../upload'
import { auditStatement, list, oneOf, parseList, text, type Actor, type Input } from '../door'
import { requirePerson } from '../program/people'
// VENDOR-001 supplier register: profile, subprocessors, retained documents and
// the marketing claims that stay apart from verified evidence.
export const criticalities = ['low', 'medium', 'high', 'critical'] as const
export const dataTypes = ['PHI', 'cardholder data', 'personal data', 'credentials', 'confidential business data'] as const
export const tiers = ['low', 'medium', 'high'] as const
export const documentKinds = ['soc2', 'soc1', 'iso27001', 'pentest', 'baa', 'dpa', 'contract', 'bridge', 'other'] as const
export const kindLabels: Record<string, string> = { soc2: 'SOC 2 report', soc1: 'SOC 1 report', iso27001: 'ISO 27001 certificate', pentest: 'Penetration-test summary', baa: 'Business associate agreement (BAA)', dpa: 'Data processing agreement (DPA)', contract: 'Contract', bridge: 'Bridge letter', other: 'Other document', questionnaire: 'Security questionnaire' }
export interface Profile { vendor_id: string; website: string; service: string; contact_name: string; contact_email: string; data_types: string[]; region: string; annual_cost_usd: number | null; risk_tier: typeof tiers[number]; tier_basis: string; renewal_date: string | null; revision: number; updated_by: string; updated_at: string }
// A suggested tier from criticality and the data the supplier touches; the
// owner may set a different tier and the basis is recorded either way.
export function suggestTier(criticality: string, types: string[]) {
 const sensitive = types.some(t => t === 'PHI' || t === 'cardholder data' || t === 'credentials')
 if (criticality === 'critical' || criticality === 'high' || sensitive) return { tier: 'high' as const, basis: `Suggested high: ${sensitive ? 'handles ' + types.filter(t => ['PHI', 'cardholder data', 'credentials'].includes(t)).join(', ') : criticality + ' criticality'}` }
 if (criticality === 'medium' || types.length) return { tier: 'medium' as const, basis: `Suggested medium: ${criticality} criticality${types.length ? ', handles ' + types.join(', ') : ''}` }
 return { tier: 'low' as const, basis: 'Suggested low: low criticality and no recorded sensitive data' }
}
function profileFields(input: Input, criticality: string, now: Date) {
 const types = list(input, 'data_types', 10), bad = types.find(t => !(dataTypes as readonly string[]).includes(t))
 if (bad) throw new Refusal(`Unknown data type "${bad}".`)
 const email = text(input, 'contact_email', 254, true).toLowerCase()
 if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Refusal('Enter a real contact email address.')
 const website = text(input, 'website', 300, true)
 if (website && !/^https:\/\/[^\s]+$/.test(website)) throw new Refusal('The supplier website must be an https address.')
 const renewal = typeof input.renewal_date === 'string' && input.renewal_date ? input.renewal_date : null
 if (renewal && !validDate(renewal)) throw new Refusal('The renewal date must be a real date.')
 const cost = typeof input.annual_cost_usd === 'string' && input.annual_cost_usd.trim() ? Number(input.annual_cost_usd.replace(/[$,\s]/g, '')) : null
 if (cost !== null && (!Number.isInteger(cost) || cost < 0 || cost > 1e9)) throw new Refusal('The annual cost is whole US dollars.')
 const suggested = suggestTier(criticality, types), tier = typeof input.risk_tier === 'string' && input.risk_tier ? oneOf(input, 'risk_tier', tiers) : suggested.tier
 return { website, service: text(input, 'service', 500, true), contact_name: text(input, 'contact_name', 200, true), contact_email: email, data_types: types, region: text(input, 'region', 100, true) || 'US', annual_cost_usd: cost, risk_tier: tier, tier_basis: tier === suggested.tier ? suggested.basis : `Set by owner to ${tier}; ${suggested.basis.toLowerCase()}`, renewal_date: renewal, at: now.toISOString() }
}
export async function onboardVendor(env: Bindings, actor: Actor, input: Input, now: Date) {
 const name = text(input, 'name', 200), criticality = oneOf(input, 'criticality', criticalities), due = typeof input.review_due === 'string' && input.review_due ? input.review_due : null
 if (due && !validDate(due)) throw new Refusal('The review date must be a real date.')
 if (await env.DB.prepare('SELECT 1 FROM vendors WHERE name=?').bind(name).first()) throw new Refusal('That vendor already exists.', 409)
 const owner = typeof input.owner_person_id === 'string' && input.owner_person_id ? (await requirePerson(env, input.owner_person_id, 'business owner')).id : null
 const f = profileFields(input, criticality, now), id = crypto.randomUUID(), at = now.toISOString()
 await env.DB.batch([
  env.DB.prepare('INSERT INTO vendors(id,name,owner_person_id,data_access,criticality,review_due,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)').bind(id, name, owner, text(input, 'data_access', 500, true), criticality, due, at, at),
  env.DB.prepare('INSERT INTO vendor_profiles(vendor_id,website,service,contact_name,contact_email,data_types,region,annual_cost_usd,risk_tier,tier_basis,renewal_date,revision,updated_by,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id, f.website, f.service, f.contact_name, f.contact_email, JSON.stringify(f.data_types), f.region, f.annual_cost_usd, f.risk_tier, f.tier_basis, f.renewal_date, 1, actor.name, at),
  auditStatement(env, actor, 'vendor.added', 'vendor:' + id, now, 'succeeded', `${criticality}, tier ${f.risk_tier}`, { revision: 1 }),
 ])
 return { id, risk_tier: f.risk_tier, tier_basis: f.tier_basis }
}
export const profileOf = async (env: Bindings, vendor: string): Promise<Profile | null> => {
 const row = await env.DB.prepare('SELECT * FROM vendor_profiles WHERE vendor_id=?').bind(vendor).first<Omit<Profile, 'data_types'> & { data_types: string }>()
 return row ? { ...row, data_types: parseList(row.data_types) } : null
}
export async function requireVendor(env: Bindings, id: string) {
 const row = await env.DB.prepare('SELECT * FROM vendors WHERE id=?').bind(id).first<{ id: string; name: string; owner_person_id: string | null; data_access: string; criticality: typeof criticalities[number]; review_due: string | null }>()
 if (!row) throw new Refusal('Vendor not found.', 404)
 return row
}
export async function updateProfile(env: Bindings, actor: Actor, id: string, input: Input, now: Date) {
 const vendor = await requireVendor(env, id), criticality = typeof input.criticality === 'string' && input.criticality ? oneOf(input, 'criticality', criticalities) : vendor.criticality
 const prior = await profileOf(env, id), reason = text(input, 'reason', 500)
 const f = profileFields(input, criticality, now), revision = (prior?.revision ?? 0) + 1
 const owner = typeof input.owner_person_id === 'string' && input.owner_person_id ? (await requirePerson(env, input.owner_person_id, 'business owner')).id : vendor.owner_person_id
 const values = [f.website, f.service, f.contact_name, f.contact_email, JSON.stringify(f.data_types), f.region, f.annual_cost_usd, f.risk_tier, f.tier_basis, f.renewal_date, revision, actor.name, f.at] as const
 await env.DB.batch([
  env.DB.prepare('UPDATE vendors SET criticality=?,owner_person_id=?,data_access=?,updated_at=? WHERE id=?').bind(criticality, owner, typeof input.data_access === 'string' ? input.data_access.trim().slice(0, 500) : vendor.data_access, f.at, id),
  prior ? env.DB.prepare('UPDATE vendor_profiles SET website=?,service=?,contact_name=?,contact_email=?,data_types=?,region=?,annual_cost_usd=?,risk_tier=?,tier_basis=?,renewal_date=?,revision=?,updated_by=?,updated_at=? WHERE vendor_id=?').bind(...values, id)
   : env.DB.prepare('INSERT INTO vendor_profiles(website,service,contact_name,contact_email,data_types,region,annual_cost_usd,risk_tier,tier_basis,renewal_date,revision,updated_by,updated_at,vendor_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(...values, id),
  auditStatement(env, actor, 'vendor.profile-updated', 'vendor:' + id, now, 'succeeded', `tier ${f.risk_tier}, renewal ${f.renewal_date ?? 'none'}`, { reason, revision }),
 ])
 return { revision, risk_tier: f.risk_tier }
}
export async function addSubprocessor(env: Bindings, actor: Actor, id: string, input: Input, now: Date) {
 await requireVendor(env, id)
 const name = text(input, 'name', 200), sid = crypto.randomUUID()
 if (await env.DB.prepare('SELECT 1 FROM vendor_subprocessors WHERE vendor_id=? AND name=? COLLATE NOCASE AND removed_at IS NULL').bind(id, name).first()) throw new Refusal('That subprocessor is already listed.', 409)
 await env.DB.batch([env.DB.prepare('INSERT INTO vendor_subprocessors(id,vendor_id,name,purpose,region,added_by,added_at) VALUES(?,?,?,?,?,?,?)').bind(sid, id, name, text(input, 'purpose', 300, true), text(input, 'region', 100, true), actor.name, now.toISOString()), auditStatement(env, actor, 'vendor.subprocessor-added', 'vendor:' + id, now, 'succeeded', name)])
 return sid
}
export async function removeSubprocessor(env: Bindings, actor: Actor, id: string, sid: string, input: Input, now: Date) {
 const reason = text(input, 'reason', 500)
 const changed = await env.DB.prepare('UPDATE vendor_subprocessors SET removed_at=?,removed_by=? WHERE id=? AND vendor_id=? AND removed_at IS NULL').bind(now.toISOString(), actor.name, sid, id).run()
 if (!changed.meta.changes) throw new Refusal('Subprocessor not found.', 404)
 await auditStatement(env, actor, 'vendor.subprocessor-removed', 'vendor:' + id, now, 'succeeded', sid, { reason }).run()
}
export interface DocumentRow { id: string; vendor_id: string; request_id: string | null; kind: string; filename: string; media_type: string; size: number; sha256: string; object_key: string; origin: 'supplier' | 'owner'; provided_by: string; link_id: string | null; effective_on: string | null; expires_on: string | null; supersedes: string | null; added_at: string; review_state: 'received' | 'verified' | 'rejected'; reviewed_by: string | null; reviewed_at: string | null; review_notes: string | null }
export const sha256 = async (bytes: ArrayBuffer) => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))).map(n => n.toString(16).padStart(2, '0')).join('')
// Custody: write fresh bytes, read them back, digest what was stored, then append
// the immutable document row. A newer document of the same kind supersedes the
// earlier one without touching it.
export async function storeDocument(env: Bindings, actor: Actor & { kind?: 'owner' | 'token' }, d: { vendor: string; request: string | null; kind: typeof documentKinds[number]; file: File; origin: 'supplier' | 'owner'; providedBy: string; link: string | null; effective: string | null; expires: string | null }, now: Date) {
 if (!(d.file instanceof File) || d.file.size === 0) throw new Refusal('Choose a nonempty file.')
 if (d.file.size > MAX_FILE) throw new Refusal('File exceeds 10 MiB.', 413)
 for (const date of [d.effective, d.expires]) if (date && !validDate(date)) throw new Refusal('Dates must be real dates.')
 const id = crypto.randomUUID(), key = 'vendor-documents/' + id, bytes = await d.file.arrayBuffer()
 if (!await env.EXHIBITS.put(key, bytes, { onlyIf: { etagDoesNotMatch: '*' }, httpMetadata: { contentType: 'application/octet-stream' } })) throw new Refusal('Object key conflict; nothing was stored.', 409)
 const stored = await env.EXHIBITS.get(key)
 if (!stored) throw new Refusal('Stored bytes could not be read; nothing was recorded.', 503)
 const actual = await stored.arrayBuffer(), digest = await sha256(actual)
 const prior = await env.DB.prepare(`SELECT id FROM vendor_documents d WHERE vendor_id=? AND kind=? AND (?<>'bridge' OR EXISTS(SELECT 1 FROM vendor_bridge_letters b WHERE b.document_id=d.id)) AND NOT EXISTS(SELECT 1 FROM vendor_documents n WHERE n.supersedes=d.id) ORDER BY added_at DESC,rowid DESC LIMIT 1`).bind(d.vendor, d.kind==='bridge'?'other':d.kind,d.kind).first<{ id: string }>()
 const filename = d.file.name.replace(/[\x00-\x1f\x7f]/g, '').slice(0, 240) || 'document'
 await env.DB.batch([
  env.DB.prepare('INSERT INTO vendor_documents(id,vendor_id,request_id,kind,filename,media_type,size,sha256,object_key,origin,provided_by,link_id,effective_on,expires_on,supersedes,added_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id, d.vendor, d.request, d.kind==='bridge'?'other':d.kind, filename, (d.file.type || 'application/octet-stream').slice(0, 100), actual.byteLength, digest, key, d.origin, d.providedBy, d.link, d.effective, d.expires, prior?.id ?? null, now.toISOString()),
  ...(d.kind==='bridge'?[env.DB.prepare('INSERT INTO vendor_bridge_letters(document_id) VALUES(?)').bind(id)]:[]),
  auditStatement(env, actor, d.origin === 'supplier' ? 'vendor.supplier-document' : 'vendor.document-added', 'vendor:' + d.vendor, now, 'succeeded', `${d.kind} ${filename} sha256 ${digest.slice(0, 16)}`, { revision: id }),
 ])
 return { id, sha256: digest, supersedes: prior?.id ?? null }
}
export async function addOwnerDocument(env: Bindings, actor: Actor, id: string, form: FormData, now: Date) {
 await requireVendor(env, id)
 const kind = form.get('kind'), file = form.get('file')
 if (typeof kind !== 'string' || !(documentKinds as readonly string[]).includes(kind)) throw new Refusal('Choose a listed document kind.')
 const date = (k: string) => { const v = form.get(k); return typeof v === 'string' && v ? v : null }
 return storeDocument(env, actor, { vendor: id, request: null, kind: kind as typeof documentKinds[number], file: file as File, origin: 'owner', providedBy: actor.name, link: null, effective: date('effective_on'), expires: date('expires_on') }, now)
}
export const documents = async (env: Bindings, vendor: string):Promise<DocumentRow[]> => (await env.DB.prepare('SELECT d.*,EXISTS(SELECT 1 FROM vendor_bridge_letters b WHERE b.document_id=d.id) AS is_bridge FROM vendor_documents d WHERE vendor_id=? ORDER BY added_at,rowid').bind(vendor).all<DocumentRow & {is_bridge:number}>()).results.map(({is_bridge,...d})=>({...d,kind:is_bridge?'bridge':d.kind}))
export async function reviewDocument(env: Bindings, actor: Actor, vendor: string, doc: string, input: Input, now: Date) {
 const decision = oneOf(input, 'decision', ['verified', 'rejected'] as const), notes = text(input, 'notes', 1000)
 const changed = await env.DB.prepare("UPDATE vendor_documents SET review_state=?,reviewed_by=?,reviewed_at=?,review_notes=? WHERE id=? AND vendor_id=? AND review_state='received'").bind(decision, actor.name, now.toISOString(), notes, doc, vendor).run()
 if (!changed.meta.changes) throw new Refusal('Document not found or already reviewed.', 404)
 await auditStatement(env, actor, 'vendor.document-reviewed', 'vendor:' + vendor, now, 'succeeded', decision, { reason: notes, revision: doc }).run()
}
// A download re-reads the stored bytes and refuses a changed or missing object.
export async function documentBytes(env: Bindings, row: DocumentRow) {
 const object = await env.EXHIBITS.get(row.object_key)
 if (!object) return null
 const bytes = await object.arrayBuffer()
 return bytes.byteLength === row.size && await sha256(bytes) === row.sha256 ? bytes : null
}
export async function addAssertion(env: Bindings, actor: Actor, vendor: string, input: Input, now: Date) {
 await requireVendor(env, vendor)
 const url = text(input, 'source_url', 300, true)
 if (url && !/^https:\/\/\S+$/.test(url)) throw new Refusal('The source must be an https address.')
 const id = crypto.randomUUID()
 await env.DB.batch([env.DB.prepare('INSERT INTO vendor_assertions(id,vendor_id,claim,source_url,recorded_by,recorded_at) VALUES(?,?,?,?,?,?)').bind(id, vendor, text(input, 'claim', 500), url, actor.name, now.toISOString()), auditStatement(env, actor, 'vendor.assertion-recorded', 'vendor:' + vendor, now, 'succeeded', 'unverified supplier claim')])
 return id
}
export async function verifyAssertion(env: Bindings, actor: Actor, vendor: string, id: string, input: Input, now: Date) {
 const doc = text(input, 'document_id', 80)
 const found = await env.DB.prepare("SELECT 1 FROM vendor_documents WHERE id=? AND vendor_id=? AND review_state='verified'").bind(doc, vendor).first()
 if (!found) throw new Refusal('Verify with a document of this vendor that you have reviewed and marked verified.')
 const changed = await env.DB.prepare('UPDATE vendor_assertions SET verified_document_id=?,verified_by=?,verified_at=? WHERE id=? AND vendor_id=? AND verified_document_id IS NULL').bind(doc, actor.name, now.toISOString(), id, vendor).run()
 if (!changed.meta.changes) throw new Refusal('Claim not found or already verified.', 404)
 await auditStatement(env, actor, 'vendor.assertion-verified', 'vendor:' + vendor, now, 'succeeded', id, { revision: doc }).run()
}
