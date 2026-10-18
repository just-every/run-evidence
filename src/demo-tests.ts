import type { Bindings } from './auth.server'
import { day } from './evidence/model'
import { addPerson } from './evidence/program/people'
import { createProgram } from './evidence/program/storage'
import { assignOwner } from './evidence/program/control'
import { issueApiToken } from './evidence/api/tokens'
import { declareType, upsertResources, type ResourceSchema } from './evidence/resources'
import { defineTest } from './evidence/tests/storage'
import { runTest } from './evidence/tests/engine'
import { assign } from './evidence/remedy/storage'
import { sampleTests, samplePeople } from './demo-data'

// Illustrative Northstar Studio program: a SOC 2 Type II audit period for this
// year, the people who own its controls, and continuous tests over resources
// pushed through named API tokens (source-reported, never observed by Evidence).
// One laptop drifted off disk encryption yesterday; its failure opens remediation.
export async function seedTests(env: Bindings, actor: { id: string; name: string }, now: Date) {
 if (await env.DB.prepare('SELECT 1 FROM tests LIMIT 1').first()) return
 const hours = (h: number) => new Date(now.getTime() - h * 3600000), year = now.getUTCFullYear()
 const people = new Map<string, string>()
 for (const p of samplePeople) people.set(p.name, (await addPerson(env, actor, { name: p.name, email: p.email, kind: 'employee', role: p.role }, hours(24 * 120))).id)
 await createProgram(env, actor, { framework: 'soc2', name: `SOC 2 Type II ${year}`, legal_entity: 'Northstar Studio, Inc.', report_type: 'Type II', categories: ['Availability'], products: ['Northstar web app', 'Public API'], teams: ['Engineering', 'IT', 'People'], regions: ['us-east-1', 'us-west-2'], systems: ['AWS production', 'GitHub', 'Okta', 'Jamf'], audit_from: `${year}-01-01`, audit_to: `${year}-12-31`, assessor: 'Harbor Assurance LLP', lead_person_id: people.get('Maria Alvarez')!, milestones: [`${year}-11-02 Fieldwork starts`, `${year + 1}-01-29 Report issued`] }, hours(24 * 100))
 const tokens = new Map<string, string>()
 for (const name of [...new Set(sampleTests.map(t => t.source))]) tokens.set(name, (await issueApiToken(env, actor, { name, scopes: ['resource-push', 'test-write'], expires_at: new Date(now.getTime() + 300 * 86400000).toISOString() }, hours(24 * 30))).grant.id)
 for (const [index, t] of sampleTests.entries()) {
  const token = tokens.get(t.source)!, source = { kind: 'source-reported' as const, ref: 'api:' + token, label: `Source-reported via API token "${t.source}" (owner ${actor.name})` }
  const schema: ResourceSchema = { fields: { [t.field]: typeof t.value === 'number' ? 'number' : 'boolean' }, required: [] }
  const items = (drift: boolean) => Array.from({ length: t.count }, (_, i) => ({ uniqueId: `${t.type}-${String(i + 1).padStart(3, '0')}`, displayName: i === 0 && t.first ? t.first : `${t.noun} ${String(i + 1).padStart(3, '0')}`, attributes: { [t.field]: drift && i === 0 ? t.drifted : t.value } }))
  await declareType(env, t.type, schema, 'api:' + token, hours(24 * 21))
  await upsertResources(env, t.type, schema, items(false), source, false, hours(24 * 21))
  const { id } = await defineTest(env, { name: t.name, resourceType: t.type, criteria: [{ attribute: t.field, op: typeof t.value === 'number' ? 'min' : 'equals', value: t.value }], cadence: t.cadence, category: t.category, severity: t.severity, controls: [t.control] }, 'api', 'api:' + token, { id: token, name: t.source, kind: 'token' }, hours(24 * 20 - index / 60))
  await assignOwner(env, actor, (await env.DB.prepare('SELECT control_id FROM library_adoptions WHERE library_id=?').bind(t.control).first<{ control_id: string }>())!.control_id, { owner_person_id: people.get(t.owner)!, reason: 'Control owner' }, hours(24 * 20))
  for (const at of t.runs) {
   if (t.drift && at <= t.drift) await upsertResources(env, t.type, schema, items(true), source, false, hours(t.drift))
   await runTest(env, id, 'schedule', hours(at))
  }
 }
 // The failing laptop's remediation: its owner, the next action and a target date.
 const open = await env.DB.prepare("SELECT o.id FROM obligations o JOIN tests t ON t.id=o.test_id WHERE o.state='open' ORDER BY o.clock_started_at LIMIT 1").first<{ id: string }>()
 if (open) await assign(env, actor, open.id, people.get('Maria Alvarez')!, "Turn on FileVault for Maria Alvarez's MacBook Pro and re-test", day(new Date(now.getTime() + 86400000)), hours(18))
}
