import { usDate } from '../../format'
import { implementation, list, programCite, programRevision, record, rows, scope, vendorCite, vendorLines, type Ctx, type Generated } from './context'
import type { Section } from './model'
const mk = (id: string, heading: string, statements: Section['statements'], extra: Partial<Section> = {}): Section => ({ id, heading, status: statements.length || extra.table ? 'prefilled' : 'owner-needed', statements, ...extra })
export const saqTypes = ['A', 'A-EP', 'B', 'B-IP', 'C-VT', 'C', 'P2PE', 'D-Merchant', 'D-Service Provider'] as const
export type Saq = typeof saqTypes[number]
const rank: Saq[] = ['A', 'P2PE', 'B', 'C-VT', 'A-EP', 'B-IP', 'C', 'D-Merchant', 'D-Service Provider']
export const answerOptions = { role: ['merchant', 'service-provider'], channels: ['card-present', 'e-commerce', 'mail-telephone'], stores_chd: ['yes', 'no'], p2pe: ['yes', 'no'], terminals: ['standalone-dial-out', 'ip-connected', 'payment-application', 'virtual-terminal', 'none'], ecommerce: ['fully-outsourced', 'partially-outsourced', 'self-hosted', 'none'] } as const
// Guided SAQ selection from recorded answers. This is Evidence's working
// selection; the merchant or QSA confirms the type against the PCI SSC criteria.
export function selectSaq(raw: Record<string, unknown>) {
 const role = String(raw.role ?? ''), channels = list(raw.channels), stores = String(raw.stores_chd ?? ''), p2pe = String(raw.p2pe ?? ''), terminals = String(raw.terminals ?? 'none'), shop = String(raw.ecommerce ?? 'none')
 if (!role || !stores) return { type: null as Saq | null, rationale: 'Answer the selection questions to choose an SAQ type.' }
 if (role === 'service-provider') return { type: 'D-Service Provider' as Saq, rationale: 'Service providers complete SAQ D for Service Providers.' }
 if (stores === 'yes') return { type: 'D-Merchant' as Saq, rationale: 'Electronic storage of cardholder data requires SAQ D for Merchants.' }
 if (!channels.length) return { type: null, rationale: 'Choose at least one payment channel.' }
 const found: [Saq, string][] = []
 if (channels.includes('card-present')) found.push(p2pe === 'yes' ? ['P2PE', 'All card-present payments use a validated P2PE solution.'] : terminals === 'standalone-dial-out' ? ['B', 'Card-present payments use standalone dial-out terminals with no electronic storage.'] : terminals === 'ip-connected' ? ['B-IP', 'Card-present payments use IP-connected PTS terminals with no electronic storage.'] : terminals === 'payment-application' ? ['C', 'Card-present payments use a payment application system connected to the internet.'] : ['D-Merchant', 'The card-present setup does not fit a shorter SAQ; use SAQ D for Merchants.'])
 if (channels.includes('e-commerce')) found.push(shop === 'fully-outsourced' ? ['A', 'All e-commerce payment pages are fully outsourced and the merchant site receives no cardholder data.'] : shop === 'partially-outsourced' ? ['A-EP', 'The merchant website affects the security of the outsourced payment page.'] : ['D-Merchant', 'A self-hosted payment page requires SAQ D for Merchants.'])
 if (channels.includes('mail-telephone')) found.push(terminals === 'virtual-terminal' ? ['C-VT', 'Mail or telephone orders are keyed into a web virtual terminal on an isolated computer.'] : terminals === 'payment-application' ? ['C', 'Mail or telephone orders go through a payment application system connected to the internet.'] : terminals === 'standalone-dial-out' ? ['B', 'Mail or telephone orders use a standalone dial-out terminal.'] : shop === 'fully-outsourced' ? ['A', 'Mail or telephone orders are fully outsourced.'] : ['D-Merchant', 'The mail or telephone setup does not fit a shorter SAQ; use SAQ D for Merchants.'])
 const top = found.reduce((a, b) => rank.indexOf(b[0]) > rank.indexOf(a[0]) ? b : a)
 return { type: top[0], rationale: top[1] + (found.length > 1 ? ' The most demanding channel decides the type.' : '') }
}
// The principal requirements each type addresses (Evidence's working summary;
// the exact sub-requirement list is in the licensed PCI SSC SAQ for the type).
export const coverage: Record<Saq, number[]> = { 'A': [2, 3, 6, 8, 9, 11, 12], 'A-EP': [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], 'B': [3, 4, 7, 9, 12], 'B-IP': [1, 2, 3, 4, 6, 7, 8, 9, 11, 12], 'C-VT': [2, 3, 4, 6, 7, 8, 9, 12], 'C': [1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 12], 'P2PE': [3, 9, 12], 'D-Merchant': [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], 'D-Service Provider': [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] }
export const responses = ['in place', 'in place with CCW', 'not applicable', 'not tested', 'not in place'] as const
const principal = (ref: string) => Number(/^(\d+)\./.exec(ref)?.[1] ?? 0)
export async function exhibitsOf(c: Ctx) { return (await c.env.DB.prepare('SELECT id,label,filename,size,sha256,uploaded_at FROM program_document_exhibits WHERE document_id=? ORDER BY uploaded_at,rowid').bind(c.documentId).all<{ id: string; label: string; filename: string; size: number; sha256: string; uploaded_at: string }>()).results }
export async function pciCdeScope(c: Ctx): Promise<Generated> {
 const p = c.program, revision = await programRevision(c.env, p.id), s = scope(p), facts: Generated['facts'] = {}, cite = programCite(p, revision)
 const exhibits = await exhibitsOf(c), vendors = (await vendorLines(c.env, c.now)).filter(v => v.data_types.includes('cardholder data')), cde = rows(c.inputs.cde_systems)
 const kinds = ['data-flow diagram', 'network diagram']
 for (const e of exhibits) facts['exhibit:' + e.id] = { label: `Exhibit ${e.label}`, value: e.sha256 }
 facts.scope = { label: 'Program scope', value: JSON.stringify([s.products, s.systems, s.regions, p.audit_from, p.audit_to]) }
 for (const v of vendors) facts['provider:' + v.id] = { label: `Service provider ${v.name}`, value: v.approval }
 const diagrams = kinds.map(k => ({ k, e: exhibits.filter(x => x.label === k) }))
 return { subtitle: `${p.legal_entity} · PCI DSS ${p.edition} cardholder data environment`, facts, sections: [
  mk('scope', 'Cardholder data environment scope', [...(s.systems.length ? [{ text: `Systems in scope: ${s.systems.join(', ')}; regions: ${s.regions.join(', ') || 'not recorded'}.`, cites: [cite] }] : []), ...cde.map(x => ({ text: `${x.system}: ${x.role}${x.location ? ' (' + x.location + ')' : ''}.`, cites: [] }))], { table: cde.length ? { head: ['CDE system', 'Role', 'Location'], rows: cde.map(x => [x.system, x.role, x.location]) } : undefined }),
  mk('diagrams', 'Data-flow and network diagrams', exhibits.length ? diagrams.flatMap(d => d.e.length ? d.e.map(e => ({ text: `${d.k}: ${e.filename} (${e.size} bytes, uploaded ${usDate(e.uploaded_at)}).`, cites: [{ kind: 'exhibit', ref: e.id, revision: e.sha256.slice(0, 12), label: `Exhibit ${e.filename}` }] })) : [{ text: `No ${d.k} is attached yet.`, cites: [] }]) : [], { table: exhibits.length ? { head: ['Exhibit', 'Kind', 'Size', 'SHA-256', 'Uploaded'], rows: exhibits.map(e => [e.filename, e.label, String(e.size), e.sha256, usDate(e.uploaded_at)]) } : undefined }),
  mk('providers', 'Third-party service providers with cardholder data', vendors.map(v => ({ text: `${v.name} (${v.service || 'service not recorded'}) is recorded as handling cardholder data; approval: ${v.approval}.`, cites: [vendorCite(v)] }))),
 ] }
}
export async function pciSaq(c: Ctx): Promise<Generated> {
 const p = c.program, answers = record(c.inputs.saq_answers), channels = list((c.inputs.saq_answers as Record<string, unknown> | undefined)?.channels), selection = selectSaq({ ...answers, channels }), facts: Generated['facts'] = {}
 const given = record(c.inputs.saq_responses), covered = selection.type ? coverage[selection.type] : []
 const reqs = c.ready.requirements.filter(r => /^\d/.test(r.ref) ? covered.includes(principal(r.ref)) : selection.type === 'D-Service Provider').sort((a, b) => a.ref.localeCompare(b.ref, 'en', { numeric: true }))
 facts['saq:type'] = { label: 'Selected SAQ type', value: selection.type ?? 'none' }
 const table = reqs.map(r => { const status = implementation(r); facts['saq:' + r.ref] = { label: `Requirement ${r.ref} ${r.title}`, value: `${r.state}|${status}` }; return [r.ref, r.title, status, given[r.ref] ?? 'unanswered', r.controls.map(x => x.name).join('; ') || 'none mapped'] })
 const asked = [...Object.entries(answers).filter(([k]) => k !== 'channels').map(([k, v]) => `${k.replaceAll('_', ' ')}: ${v}`), ...(channels.length ? [`payment channels: ${channels.join(', ')}`] : [])]
 return { subtitle: `${p.legal_entity} · PCI DSS ${p.edition} · ${selection.type ? 'SAQ ' + selection.type : 'SAQ not selected'}`, facts, sections: [
  mk('answers', 'Recorded SAQ selection answers', asked.map(text => ({ text, cites: [] }))),
  mk('selected', 'Selected SAQ type', [{ text: selection.type ? `SAQ ${selection.type}. ${selection.rationale} The merchant or QSA confirms the type against the PCI SSC criteria.` : selection.rationale, cites: [] }]),
  mk('worksheet', 'Requirement-by-requirement worksheet', [{ text: selection.type ? `Evidence's working scope for SAQ ${selection.type} covers principal requirements ${covered.join(', ')}; confirm the exact sub-requirements in your licensed SAQ. "Evidence records" is derived from linked controls and tests and is not an assessment.` : 'Select an SAQ type to produce its worksheet.', cites: [] }], { table: selection.type ? { head: ['Requirement', 'Title', 'Evidence records', 'Owner response', 'Linked controls'], rows: table } : undefined }),
 ] }
}
export async function pciAocHandoff(c: Ctx): Promise<Generated> {
 const p = c.program, facts: Generated['facts'] = {}
 const saq = await c.env.DB.prepare("SELECT d.id,r.revision,r.inputs_json,r.facts_json FROM program_documents d JOIN program_document_revisions r ON r.document_id=d.id WHERE d.program_id=? AND d.kind='pci-saq' ORDER BY r.revision DESC LIMIT 1").bind(p.id).first<{ id: string; revision: number; inputs_json: string; facts_json: string }>()
 const inputs = saq ? JSON.parse(saq.inputs_json) as Record<string, unknown> : {}, selection = selectSaq({ ...record(inputs.saq_answers), channels: list((inputs.saq_answers as Record<string, unknown> | undefined)?.channels) }), given = record(inputs.saq_responses)
 const counts = Object.fromEntries(responses.map(r => [r, Object.values(given).filter(v => v === r).length]))
 facts['saq:type'] = { label: 'Selected SAQ type', value: selection.type ?? 'none' }
 facts['saq:responses'] = { label: 'Worksheet responses', value: JSON.stringify(counts) }
 const cite = saq ? [{ kind: 'program-document', ref: saq.id, revision: saq.revision, label: 'SAQ worksheet' }] : []
 return { subtitle: `${p.legal_entity} · PCI DSS ${p.edition} · Attestation of Compliance handoff`, facts, sections: [
  mk('merchant', 'Part 1 - assessed entity', [{ text: `${p.legal_entity}; assessor: ${p.assessor || 'not recorded'}; reporting period ${usDate(p.audit_from)} to ${usDate(p.audit_to)}.`, cites: [programCite(p, await programRevision(c.env, p.id))] }]),
  mk('saq', 'Part 2 - validation type', [{ text: selection.type ? `Validation uses SAQ ${selection.type}.` : 'No SAQ type is selected in the SAQ worksheet yet.', cites: cite }, { text: `Worksheet responses: ${responses.map(r => `${counts[r]} ${r}`).join(', ')}.`, cites: cite }]),
  mk('signatures', 'Part 3 - signatures', [{ text: 'Evidence has not signed and cannot sign this Attestation of Compliance. The merchant executive officer signs Part 3, and a QSA signs where one assessed the entity. Unsigned: merchant executive officer; QSA.', cites: [] }], { table: { head: ['Signatory', 'Name', 'Signature', 'Date'], rows: [['Merchant executive officer', '', 'NOT SIGNED', ''], ['Qualified Security Assessor (if used)', '', 'NOT SIGNED', '']] } }),
 ] }
}
