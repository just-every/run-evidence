import { usDate } from '../format'
import type { Bindings } from '../../auth.server'
import { Refusal } from '../upload'
import { parseList, type Actor } from '../door'
import { requireProgram } from '../program/storage'
import { upsertResources } from '../resources'
import { catalogueStatements } from '../tests/storage'
import { runForType } from '../tests/engine'
import { slaFor } from '../remedy/storage'
import { settings } from '../followup/settings'
import { draftPolicy, policyList } from './storage'
import { render, templates, type Facts } from './templates'
// The guided policy builder (POLICY-001) for SOC 2 and ISO 27001: templates
// tailored from program scope and the facts of connected sources. Unknown
// facts stay generic wording; nothing is invented about the business.
const listed = (values: string[], fallback: string) => values.length ? values.join(', ') : fallback
export async function factsFor(env: Bindings, programId: string, ownerName: string, now: Date): Promise<Facts> {
 const p = await requireProgram(env, programId)
 const connections = (await env.DB.prepare("SELECT provider,account,label FROM connections WHERE status='active' ORDER BY created_at").all<{ provider: string; account: string; label: string }>()).results
 const names: Record<string, string> = { okta: 'Okta', google: 'Google Workspace', entra: 'Microsoft Entra ID', jumpcloud: 'JumpCloud' }
 const trackers = (await env.DB.prepare("SELECT label FROM tracker_destinations WHERE status='active' ORDER BY created_at").all<{ label: string }>()).results.map(t => t.label)
 const lead = p.lead_person_id ? (await env.DB.prepare('SELECT name FROM people WHERE id=?').bind(p.lead_person_id).first<{ name: string }>())?.name : null
 const sla = await Promise.all((['critical', 'high', 'medium', 'low'] as const).map(async s => `${s} ${(await slaFor(env, 'vulnerability', s, now)).days} days`))
 return {
  company: p.legal_entity, products: listed(parseList(p.products), 'the company\'s products'), systems: listed(parseList(p.systems), 'the production systems'), regions: listed(parseList(p.regions), 'the regions where the company operates'),
  owner: lead ?? ownerName, effective: usDate(now.toISOString().slice(0, 10)),
  identity: listed(connections.filter(c => names[c.provider]).map(c => names[c.provider]), 'the company identity provider'), cloud: listed(connections.filter(c => c.provider === 'aws').map(c => `AWS (account ${c.account})`), 'the cloud provider'),
  code: listed(connections.filter(c => c.provider === 'github').map(c => `the GitHub organization ${c.account}`), 'the code host'), trackers: listed(trackers, 'the issue tracker'), sla: sla.join(', '), timezone: (await settings(env)).timezone,
 }
}
export async function draftFromTemplate(env: Bindings, actor: Actor, templateId: string, programId: string, ownerPersonId: string, now: Date) {
 const template = templates.find(t => t.id === templateId)
 if (!template) throw new Refusal('Template not found.', 404)
 const facts = await factsFor(env, programId, actor.name, now)
 const created = await draftPolicy(env, actor, { title: template.title, body: render(template, facts), owner_person_id: ownerPersonId }, now)
 await env.DB.batch([env.DB.prepare('UPDATE policies SET template_id=? WHERE id=?').bind(template.id, created.policy), ...await catalogueStatements(env, 'policies', actor, now)])
 await syncPolicies(env, now)
 return { ...created, facts }
}
// Each template's policy test reads the register: approved, published and
// within its review deadline is current; anything else is not.
export async function syncPolicies(env: Bindings, now: Date) {
 if (!await env.DB.prepare("SELECT 1 FROM tests WHERE catalogue_id LIKE 'policy.%' LIMIT 1").first()) return 0
 const register = await policyList(env, now), at = now.toISOString(), source = { kind: 'source-observed' as const, ref: 'policies:register', label: 'Evidence policy register' }
 for (const t of templates) {
  const p = register.find(x => x.template_id === t.id || x.title.toLowerCase() === t.title.toLowerCase()), published = p?.published ?? null
  const written = await upsertResources(env, 'policy.' + t.id, { fields: { published: 'boolean', review_current: 'boolean', current: 'boolean', version: 'number', review_due: 'string' }, required: [] }, [{ uniqueId: t.id, displayName: t.title, attributes: { published: !!published, review_current: p?.review_state === 'current', current: p?.review_state === 'current', version: published?.version ?? null, review_due: published?.review_due ?? null } }], source, false, now)
  const id = written.results[0]?.id
  if (id) await env.DB.prepare('UPDATE resources SET observed_at=? WHERE id=?').bind(at, id).run()
  if (written.changed.length) await runForType(env, 'policy.' + t.id, now)
 }
 return templates.length
}
