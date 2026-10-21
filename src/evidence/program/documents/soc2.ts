import { usDate } from '../../format'
import { headcount, inventory, inventoryCite, policyCite, programCite, programRevision, publishedPolicies, rows, scope, vendorCite, vendorLines, baaCite, type Ctx, type Generated, record } from './context'
import type { Section } from './model'
// SOC 2 system description following the AICPA description criteria (DC 200).
// Sections pre-fill only from records Evidence holds and cite them; the rest
// stay marked for the owner.
const infra = /cloud|aws|gcp|azure|network|database|db|server|host|storage|identity|idp|directory/, software = /repo|application|service|app|api|model|ai_/
export async function soc2Description(c: Ctx): Promise<Generated> {
 const p = c.program, s = scope(p), revision = await programRevision(c.env, p.id), inv = await inventory(c.env), people = await headcount(c.env), policies = await publishedPolicies(c.env, c.now), vendors = await vendorLines(c.env, c.now)
 const facts: Generated['facts'] = {}
 const inventoryRows = (pattern: RegExp) => inv.filter(r => pattern.test(r.type))
 const section = (id: string, heading: string, statements: Section['statements'], extra: Partial<Section> = {}): Section => ({ id, heading, status: statements.length ? 'prefilled' : 'owner-needed', statements, ...extra })
 const cite = programCite(p, revision)
 facts.scope = { label: 'Program scope (products, teams, regions, systems, period)', value: JSON.stringify([p.legal_entity, s.products, s.teams, s.regions, s.systems, p.audit_from, p.audit_to, p.report_type, s.categories]) }
 const services = section('services', 'Services provided', s.products.length ? [{ text: `${p.legal_entity} provides ${s.products.join(', ')}.`, cites: [cite] }, { text: `This description covers the ${p.report_type ?? 'SOC 2'} period ${usDate(p.audit_from)} to ${usDate(p.audit_to)}${s.categories.length ? ` and the trust services categories ${s.categories.join(', ')}` : ''}.`, cites: [cite] }] : [])
 const commitments = section('commitments', 'Principal service commitments and system requirements', [])
 const infraRows = inventoryRows(infra), systems = s.systems
 for (const r of inv) facts['inventory:' + r.type] = { label: `Inventory of ${r.type.replaceAll('_', ' ')}`, value: String(r.n) }
 const infrastructure = section('infrastructure', 'Infrastructure', [...infraRows.map(r => ({ text: `${r.n} ${r.type.replaceAll('_', ' ')} resource${r.n === 1 ? '' : 's'} reported by ${r.sources || 'the inventory'}.`, cites: [inventoryCite(r)] })), ...(systems.length ? [{ text: `Systems in scope: ${systems.join(', ')}.`, cites: [cite] }] : [])])
 const softwareRows = inventoryRows(software)
 const softwareSection = section('software', 'Software', softwareRows.map(r => ({ text: `${r.n} ${r.type.replaceAll('_', ' ')} resource${r.n === 1 ? '' : 's'} reported by ${r.sources || 'the inventory'}.`, cites: [inventoryCite(r)] })))
 for (const k of people) facts['people:' + k.kind] = { label: `${k.kind} headcount`, value: String(k.n) }
 const peopleSection = section('people', 'People', [...people.map(k => ({ text: `${k.n} current ${k.kind}${k.n === 1 ? '' : 's'} are recorded in People.`, cites: [{ kind: 'people', ref: k.kind, revision: k.n, label: `People: ${k.n} ${k.kind}s` }] })), ...(s.teams.length ? [{ text: `Teams in scope: ${s.teams.join(', ')}.`, cites: [cite] }] : [])])
 const data = section('data', 'Data', [])
 for (const x of policies) facts['policy:' + x.id] = { label: `Policy ${x.title}`, value: String(x.version) }
 const procedures = section('procedures', 'Procedures', policies.length ? [{ text: `${policies.length} approved and published polic${policies.length === 1 ? 'y' : 'ies'} govern the system.`, cites: [] }] : [], { table: policies.length ? { head: ['Policy', 'Revision', 'Effective', 'Review'], rows: policies.map(x => [x.title, String(x.version), x.effective ? usDate(x.effective) : '', x.state]) } : undefined })
 if (policies.length) procedures.statements.push(...policies.map(x => ({ text: `${x.title} is in force as revision ${x.version}.`, cites: [policyCite(x)] })))
 const treatment = record(c.inputs.subservice), subservice = vendors.filter(v => v.tier === 'high' || ['high', 'critical'].includes(v.criticality))
 for (const v of subservice) facts['subservice:' + v.id] = { label: `Subservice organization ${v.name}`, value: `${v.approval}|${v.soc}|${treatment[v.name] ?? 'carved-out'}` }
 const subSection = section('subservice', 'Subservice organizations', subservice.length ? [{ text: 'Suppliers with a high risk tier or high criticality are listed with their treatment (carved-out or inclusive, default carved-out; set it in the document inputs).', cites: [] }, ...subservice.flatMap(v => [{ text: `${v.name} provides ${v.service || 'a supporting service'} and is treated as ${treatment[v.name] ?? 'carved-out'}; its assurance report is ${v.soc}.`, cites: [vendorCite(v), baaCite(v)].filter((x): x is NonNullable<typeof x> => !!x) }])] : [], { table: subservice.length ? { head: ['Subservice organization', 'Service', 'Treatment', 'Approval', 'Assurance report'], rows: subservice.map(v => [v.name, v.service, treatment[v.name] ?? 'carved-out', v.approval, v.soc]) } : undefined })
 const cuec = rows(c.inputs.cuec)
 const cuecSection = section('cuec', 'Complementary user entity controls', cuec.map(x => ({ text: `${x.control}`, cites: [] })))
 const changes = (await c.env.DB.prepare('SELECT revision,reason,at FROM program_revisions WHERE program_id=? AND revision>1 AND at>=? AND at<=? ORDER BY revision').bind(p.id, p.audit_from, p.audit_to + 'T23:59:59Z').all<{ revision: number; reason: string; at: string }>()).results
 const editions = (await c.env.DB.prepare('SELECT edition,effective_at FROM program_editions WHERE program_id=? AND change_id IS NOT NULL AND effective_at>=? AND effective_at<=?').bind(p.id, p.audit_from, p.audit_to + 'T23:59:59Z').all<{ edition: string; effective_at: string }>()).results
 facts.changes = { label: 'Changes recorded during the period', value: String(changes.length + editions.length) }
 const changeSection = section('changes', 'Changes to the system during the period', changes.length || editions.length ? [...changes.map(x => ({ text: `${usDate(x.at)}: program scope revision ${x.revision}${x.reason ? ' (' + x.reason + ')' : ''}.`, cites: [{ kind: 'program', ref: p.id, revision: x.revision, label: 'Program scope change' }] })), ...editions.map(x => ({ text: `${usDate(x.effective_at)}: framework edition ${x.edition} took effect.`, cites: [cite] }))] : [{ text: 'No program scope or edition change is recorded during the period.', cites: [cite] }])
 return { subtitle: `${p.legal_entity} · ${p.report_type ?? 'SOC 2'} · ${usDate(p.audit_from)} to ${usDate(p.audit_to)}`, facts, sections: [services, commitments, infrastructure, softwareSection, peopleSection, data, procedures, subSection, cuecSection, changeSection] }
}
