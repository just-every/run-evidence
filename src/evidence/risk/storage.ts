import type { Bindings } from '../../auth.server'
import { validDate } from '../model'
import { Refusal } from '../upload'
import { auditStatement, list, oneOf, text, type Actor, type Input } from '../door'
import { libraryControl } from '../library'
import { sendFollowup, sent as delivered } from '../followup/send'
import { latestResults } from '../tests/storage'
import { riskScenario, riskLibraryRevision } from './library'
// RISK-001/002. Assessments are append-only and record the scoring-method
// revision they used; changing the method never rescores history.
export const treatments = ['mitigate', 'accept', 'transfer', 'avoid'] as const
export interface Method { revision: number; scale: number; likelihood_labels: string[]; impact_labels: string[]; likelihood_definitions: string[]; impact_definitions: string[]; formula: 'product' | 'matrix'; matrix: string[][]; thresholds: { level: string; max: number }[] }
interface MethodRow { revision: number; scale: number; likelihood_labels: string; impact_labels: string; likelihood_definitions: string; impact_definitions: string; formula: 'product' | 'matrix'; matrix_json: string; thresholds_json: string; actor_name: string; at: string }
export { shippedMethod } from './method-default'
import { shippedMethod, retainDefaultMethod } from './method-default'
const fromRow = (r: MethodRow): Method => ({ revision: r.revision, scale: r.scale, likelihood_labels: JSON.parse(r.likelihood_labels), impact_labels: JSON.parse(r.impact_labels), likelihood_definitions: JSON.parse(r.likelihood_definitions), impact_definitions: JSON.parse(r.impact_definitions), formula: r.formula, matrix: JSON.parse(r.matrix_json), thresholds: JSON.parse(r.thresholds_json) })
export async function methods(env: Bindings) {
 const rows = (await env.DB.prepare('SELECT * FROM risk_methods ORDER BY revision').all<MethodRow>()).results
 return rows.length ? rows.map(r => ({ ...fromRow(r), actor_name: r.actor_name, at: r.at })) : [{ ...shippedMethod, actor_name: 'Evidence (shipped default)', at: '' }]
}
export const currentMethod = async (env: Bindings) => (await methods(env)).at(-1)!
export const methodByRevision = async (env: Bindings, revision: number) => (await methods(env)).find(m => m.revision === revision)
export function score(method: Method, likelihood: number, impact: number) {
 if (!Number.isInteger(likelihood) || !Number.isInteger(impact) || likelihood < 1 || impact < 1 || likelihood > method.scale || impact > method.scale) throw new Refusal(`Likelihood and impact are whole numbers from 1 to ${method.scale}.`)
 const value = likelihood * impact
 const level = method.formula === 'matrix' ? method.matrix[likelihood - 1][impact - 1] : (method.thresholds.find(t => value <= t.max) ?? method.thresholds.at(-1)!).level
 return { score: value, level, likelihood_label: method.likelihood_labels[likelihood - 1], impact_label: method.impact_labels[impact - 1] }
}
export async function setMethod(env: Bindings, actor: Actor, input: Input, now: Date) {
 const scale = Number(input.scale), formula = oneOf(input, 'formula', ['product', 'matrix'] as const)
 if (!Number.isInteger(scale) || scale < 3 || scale > 5) throw new Refusal('The scale is 3×3 to 5×5.')
 const likelihood = list(input, 'likelihood_labels', 5), impact = list(input, 'impact_labels', 5)
 const definitions = (key: string) => { const value = input[key]; const rows = Array.isArray(value) ? value : typeof value === 'string' ? value.split('\n').map(x => x.trim()).filter(Boolean) : []; if (rows.length !== scale || rows.some(x => !x || x.length > 500)) throw new Refusal(`Give exactly ${scale} ${key.replaceAll('_', ' ')} (up to 500 characters each).`); return rows }
 const likelihoodDefinitions = definitions('likelihood_definitions'), impactDefinitions = definitions('impact_definitions')
 if (likelihood.length !== scale || impact.length !== scale) throw new Refusal(`Give exactly ${scale} likelihood and ${scale} impact labels.`)
 let matrix: string[][] = [], thresholds: { level: string; max: number }[] = []
 if (formula === 'matrix') {
  try { matrix = JSON.parse(text(input, 'matrix', 4000)) } catch { throw new Refusal('The matrix is JSON rows of level names.') }
  if (!Array.isArray(matrix) || matrix.length !== scale || matrix.some(row => !Array.isArray(row) || row.length !== scale || row.some(cell => typeof cell !== 'string' || !cell))) throw new Refusal(`The matrix needs ${scale} rows of ${scale} level names.`)
 } else {
  thresholds = list(input, 'thresholds', 6).map(t => { const [level, max] = t.split(':'); if (!level || !Number.isInteger(Number(max))) throw new Refusal('Write thresholds as Level:max, such as Low:4.'); return { level: level.trim(), max: Number(max) } }).sort((a, b) => a.max - b.max)
  if (!thresholds.length || thresholds.at(-1)!.max < scale * scale) throw new Refusal(`The highest threshold must reach ${scale * scale}.`)
 }
 const revision = (await currentMethod(env)).revision + 1
 const statements = []
 // The shipped default becomes revision 1 the first time an owner changes the method.
 if (!await env.DB.prepare('SELECT 1 FROM risk_methods LIMIT 1').first()) statements.push(env.DB.prepare('INSERT INTO risk_methods(id,revision,scale,likelihood_labels,impact_labels,formula,matrix_json,thresholds_json,actor_name,at,likelihood_definitions,impact_definitions) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(), 1, shippedMethod.scale, JSON.stringify(shippedMethod.likelihood_labels), JSON.stringify(shippedMethod.impact_labels), 'product', '[]', JSON.stringify(shippedMethod.thresholds), 'Evidence (shipped default)', now.toISOString(), JSON.stringify(shippedMethod.likelihood_definitions), JSON.stringify(shippedMethod.impact_definitions)))
 statements.push(env.DB.prepare('INSERT INTO risk_methods(id,revision,scale,likelihood_labels,impact_labels,formula,matrix_json,thresholds_json,actor_name,at,likelihood_definitions,impact_definitions) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(), revision, scale, JSON.stringify(likelihood), JSON.stringify(impact), formula, JSON.stringify(matrix), JSON.stringify(thresholds), actor.name, now.toISOString(), JSON.stringify(likelihoodDefinitions), JSON.stringify(impactDefinitions)), auditStatement(env, actor, 'risk.method-revised', 'risk-method:' + revision, now))
 await env.DB.batch(statements)
 return revision
}
const assessmentStatement = (env: Bindings, risk: string, kind: 'inherent' | 'residual', method: Method, likelihood: number, impact: number, notes: string, actor: Actor, now: Date) => {
 const s = score(method, likelihood, impact), id = crypto.randomUUID()
 return { id, statement: env.DB.prepare('INSERT INTO risk_assessments(id,risk_id,kind,method_revision,likelihood,impact,score,level,likelihood_label,impact_label,notes,actor_name,at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id, risk, kind, method.revision, likelihood, impact, s.score, s.level, s.likelihood_label, s.impact_label, notes, actor.name, now.toISOString()) }
}
export async function controlTargets(env: Bindings, refs: string[]) {
 const out: string[] = []
 for (const ref of refs) {
  const adopted = await env.DB.prepare('SELECT control_id FROM library_adoptions WHERE library_id=?').bind(ref).first<{ control_id: string }>()
  if (adopted) out.push(adopted.control_id)
  else if (libraryControl(ref)) out.push('library:' + ref)
  else if (await env.DB.prepare('SELECT 1 FROM controls WHERE id=?').bind(ref).first()) out.push(ref)
  else throw new Refusal(`Unknown control ${ref}.`)
 }
 return out
}
// In-scope assets of a matching type: resources whose type names the asset kind.
const assetPatterns: Record<string, RegExp> = { repository: /repo/, application: /service|application|app/, database: /database|db/, laptop: /device|laptop|endpoint/, 'cloud account': /cloud|aws|gcp|azure|account/, network: /network|firewall|zone/, 'identity provider': /identity|idp|directory/, 'AI system': /ai_|model|llm/, person: /person|employee|contractor/, facility: /facility|office|building/, vendor: /vendor|supplier/ }
async function matchingAssets(env: Bindings, kinds: string[]) {
 const resources = (await env.DB.prepare('SELECT id,type FROM resources WHERE removed_at IS NULL').all<{ id: string; type: string }>()).results
 const matched = resources.filter(r => kinds.some(k => assetPatterns[k]?.test(r.type))).map(r => r.id)
 if (kinds.includes('person')) matched.push(...(await env.DB.prepare('SELECT p.id FROM people p LEFT JOIN people_departures d ON d.person_id=p.id WHERE d.person_id IS NULL').all<{id: string}>()).results.map(p => p.id))
 if (kinds.includes('vendor')) matched.push(...(await env.DB.prepare('SELECT id FROM vendors').all<{id: string}>()).results.map(v => v.id))
 return [...new Set(matched)]
}
export interface RiskInput { title: string; scenario: string; likelihood: number; impact: number; treatment: typeof treatments[number]; owner: string | null; review_due: string | null; controls: string[]; assets: string[]; library_id?: string }
export async function validateRisk(env: Bindings, input: Record<string, unknown>): Promise<RiskInput> {
 const title = typeof input.title === 'string' ? input.title.trim() : '', scenario = typeof input.scenario === 'string' && input.scenario.trim() ? input.scenario.trim() : title
 if (!title || title.length > 300 || scenario.length > 4000) throw new Refusal('A risk needs a title (up to 300 characters) and a scenario.')
 const treatment = (typeof input.treatment === 'string' && input.treatment ? input.treatment : 'mitigate') as RiskInput['treatment']
 if (!treatments.includes(treatment)) throw new Refusal('Treatment is mitigate, accept, transfer or avoid.')
 let owner: string | null = null
 if (typeof input.owner_person_id === 'string' && input.owner_person_id) owner = (await env.DB.prepare('SELECT id FROM people WHERE id=?').bind(input.owner_person_id).first<{ id: string }>())?.id ?? null
 else if (typeof input.owner_email === 'string' && input.owner_email) owner = (await env.DB.prepare('SELECT id FROM people WHERE email=?').bind(input.owner_email.trim().toLowerCase()).first<{ id: string }>())?.id ?? null
 const due = typeof input.review_due === 'string' && input.review_due ? input.review_due : null
 if (due && !validDate(due)) throw new Refusal('The review date must be a real date.')
 const asList = (v: unknown) => Array.isArray(v) ? v.map(String) : typeof v === 'string' && v ? v.split(/[\s,]+/).filter(Boolean) : []
 return { title, scenario, likelihood: Number(input.likelihood), impact: Number(input.impact), treatment, owner, review_due: due, controls: asList(input.controls), assets: asList(input.assets) }
}
export async function createRisk(env: Bindings, actor: Actor & { kind?: 'owner' | 'token' }, raw: Record<string, unknown>, origin: 'form' | 'api' | 'library', now: Date, extra: { library_id?: string; library_revision?: number; import_id?: string; source_label?: string } = {}) {
 const input = await validateRisk(env, raw), method = await currentMethod(env)
 score(method, input.likelihood, input.impact)
 return insertRisk(env, actor, input, method, origin, now, extra)
}
export async function insertRisk(env: Bindings, actor: Actor & { kind?: 'owner' | 'token' | 'system' }, input: RiskInput, method: Method, origin: 'form' | 'api' | 'library' | 'import', now: Date, extra: { library_id?: string; library_revision?: number; import_id?: string; source_label?: string }) {
 const id = crypto.randomUUID(), at = now.toISOString(), controls = await controlTargets(env, input.controls)
 const assessment = assessmentStatement(env, id, 'inherent', method, input.likelihood, input.impact, 'Initial assessment', actor, now)
 const label = extra.source_label ?? (origin === 'api' ? `Pushed by ${actor.name}` : origin === 'library' ? `Shipped risk library ${extra.library_id}, revision ${extra.library_revision}` : `Entered by ${actor.name}`)
 await env.DB.batch([
  env.DB.prepare('INSERT INTO risks(id,title,scenario,library_id,origin,import_id,source_label,owner_person_id,assets,treatment,review_due,created_at,updated_at,library_revision) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id, input.title, input.scenario, extra.library_id ?? null, origin, extra.import_id ?? null, label, input.owner, JSON.stringify(input.assets), input.treatment, input.review_due, at, at, extra.library_revision ?? null),
  ...(method.revision === 1 ? [retainDefaultMethod(env)] : []),
  assessment.statement,
  ...controls.map(c => env.DB.prepare("INSERT OR IGNORE INTO risk_links(risk_id,kind,target,added_at) VALUES(?,'control',?,?)").bind(id, c, at)),
  ...input.assets.map(a => env.DB.prepare("INSERT OR IGNORE INTO risk_links(risk_id,kind,target,added_at) VALUES(?,'asset',?,?)").bind(id, a, at)),
  auditStatement(env, actor, 'risk.created', 'risk:' + id, now, 'succeeded', origin),
 ])
 return { id, origin, source_label: label, method_revision: method.revision }
}
export async function addFromLibrary(env: Bindings, actor: Actor, scenarioId: string, now: Date) {
 const scenario = riskScenario(scenarioId); if (!scenario) throw new Refusal('Choose a scenario from the shipped library.')
 const method = await currentMethod(env), clamp = (n: number) => Math.max(1, Math.min(method.scale, Math.round(n * method.scale / 5)))
 const assets = await matchingAssets(env, scenario.assets)
 return insertRisk(env, actor, { title: scenario.title, scenario: `Threat: ${scenario.threat}. Vulnerability: ${scenario.vulnerability}. Asset types: ${scenario.assets.join(', ')}.`, likelihood: clamp(scenario.likelihood), impact: clamp(scenario.impact), treatment: scenario.treatment, owner: null, review_due: null, controls: scenario.controls, assets }, method, 'library', now, { library_id: scenario.id, library_revision: riskLibraryRevision })
}
export async function assess(env: Bindings, actor: Actor, risk: string, input: Input, now: Date) {
 await requireRisk(env, risk)
 const kind = oneOf(input, 'kind', ['inherent', 'residual'] as const), method = await currentMethod(env)
 const a = assessmentStatement(env, risk, kind, method, Number(input.likelihood), Number(input.impact), text(input, 'notes', 2000, true), actor, now)
 await env.DB.batch([a.statement, env.DB.prepare('UPDATE risks SET updated_at=? WHERE id=?').bind(now.toISOString(), risk), auditStatement(env, actor, 'risk.assessed', 'risk:' + risk, now, 'succeeded', `${kind} under method ${method.revision}`)])
 return a.id
}
export async function requireRisk(env: Bindings, id: string) { const row = await env.DB.prepare('SELECT * FROM risks WHERE id=?').bind(id).first<Record<string, string>>(); if (!row) throw new Refusal('Risk not found.', 404); return row }
export async function link(env: Bindings, actor: Actor, risk: string, input: Input, now: Date) {
 await requireRisk(env, risk)
 const kind = oneOf(input, 'kind', ['control', 'test', 'vendor', 'incident', 'asset'] as const), target = text(input, 'target', 300)
 const resolved = kind === 'control' ? (await controlTargets(env, [target]))[0] : target
 if (kind === 'test' && !await env.DB.prepare('SELECT 1 FROM tests WHERE id=?').bind(target).first()) throw new Refusal('Choose an existing test.')
 if (kind === 'vendor' && !await env.DB.prepare('SELECT 1 FROM vendors WHERE id=?').bind(target).first()) throw new Refusal('Choose an existing vendor.')
 await env.DB.batch([env.DB.prepare('INSERT OR IGNORE INTO risk_links(risk_id,kind,target,added_at) VALUES(?,?,?,?)').bind(risk, kind, resolved, now.toISOString()), env.DB.prepare("UPDATE risks SET assets=(SELECT json_group_array(target) FROM risk_links WHERE risk_id=? AND kind='asset'),updated_at=? WHERE id=?").bind(risk, now.toISOString(), risk), auditStatement(env, actor, 'risk.linked', 'risk:' + risk, now, 'succeeded', kind)])
}
export async function addTreatment(env: Bindings, actor: Actor, risk: string, input: Input, now: Date) {
 await requireRisk(env, risk)
 const due = text(input, 'due_date', 10); if (!validDate(due)) throw new Refusal('Choose a real due date.')
 const test = typeof input.verification_test_id === 'string' && input.verification_test_id ? input.verification_test_id : null
 if (test && !await env.DB.prepare('SELECT 1 FROM tests WHERE id=?').bind(test).first()) throw new Refusal('Choose an existing test to verify the treatment.')
 const owner = typeof input.owner_person_id === 'string' && input.owner_person_id ? input.owner_person_id : null
 await env.DB.batch([env.DB.prepare("INSERT INTO risk_treatments(id,risk_id,title,owner_person_id,due_date,verification_test_id,status,updated_at) VALUES(?,?,?,?,?,?,'open',?)").bind(crypto.randomUUID(), risk, text(input, 'title', 300), owner, due, test, now.toISOString()), auditStatement(env, actor, 'risk.treatment-added', 'risk:' + risk, now)])
}
export async function completeTreatment(env: Bindings, actor: Actor, risk: string, treatment: string, input: Input, now: Date) {
 const changed = await env.DB.prepare("UPDATE risk_treatments SET status='done',evidence=?,updated_at=? WHERE id=? AND risk_id=? AND status='open'").bind(text(input, 'evidence', 1000), now.toISOString(), treatment, risk).run()
 if (!changed.meta.changes) throw new Refusal('Open treatment not found.', 404)
 await auditStatement(env, actor, 'risk.treatment-done', 'risk:' + risk, now).run()
}
// Residual-risk acceptance is time-bounded and names its approver.
export async function acceptResidual(env: Bindings, actor: Actor, risk: string, input: Input, now: Date) {
 await requireRisk(env, risk)
 const residual = await env.DB.prepare("SELECT id FROM risk_assessments WHERE risk_id=? AND kind='residual' ORDER BY at DESC,rowid DESC LIMIT 1").bind(risk).first<{ id: string }>()
 if (!residual) throw new Refusal('Record a residual assessment before accepting it.', 409)
 const until = text(input, 'expires_at', 40), expires = Date.parse(until.length === 10 ? until + 'T00:00:00Z' : until.endsWith('Z') ? until : until + 'Z')
 if (!(expires > now.getTime())) throw new Refusal('An acceptance needs a future expiry.')
 await env.DB.batch([env.DB.prepare('INSERT INTO risk_acceptances(id,risk_id,assessment_id,rationale,approver_name,approved_by,approved_at,expires_at) VALUES(?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(), risk, residual.id, text(input, 'rationale', 2000), actor.name, actor.id, now.toISOString(), new Date(expires).toISOString()), env.DB.prepare('UPDATE risks SET updated_at=? WHERE id=?').bind(now.toISOString(), risk), auditStatement(env, actor, 'risk.accepted', 'risk:' + risk, now, 'succeeded', 'until ' + new Date(expires).toISOString())])
}
// Expired acceptances escalate to the risk owner once; passing verification
// tests mark done treatments verified without touching any assessment.
export async function escalateRiskAcceptances(env: Bindings, now: Date) {
 let count = 0
 const expired = (await env.DB.prepare('SELECT a.id,a.risk_id,a.expires_at,r.title,p.email FROM risk_acceptances a JOIN risks r ON r.id=a.risk_id LEFT JOIN people p ON p.id=r.owner_person_id WHERE a.expires_at<=? AND a.escalated_at IS NULL').bind(now.toISOString()).all<{ id: string; risk_id: string; expires_at: string; title: string; email: string | null }>()).results
 for (const a of expired) {
  const result = await sendFollowup(env, { link: `${env.AUTH_ORIGIN}/app/risks/${a.risk_id}`, kind: 'risk-acceptance-expired', subject: a.id, cycle: a.expires_at, recipient: a.email ?? env.OWNER_EMAIL, title: `Risk acceptance expired: ${a.title}`, text: `The residual-risk acceptance for "${a.title}" expired at ${a.expires_at}. Reassess, treat or approve a new acceptance: ${env.AUTH_ORIGIN}/app/risks/${a.risk_id}` }, now)
  if (!delivered(result) && result !== 'duplicate') continue
  await env.DB.prepare('UPDATE risk_acceptances SET escalated_at=? WHERE id=? AND escalated_at IS NULL').bind(now.toISOString(), a.id).run(); count++
 }
 const done = (await env.DB.prepare("SELECT t.id,t.verification_test_id,x.name FROM risk_treatments t JOIN tests x ON x.id=t.verification_test_id WHERE t.status='done'").all<{ id: string; verification_test_id: string; name: string }>()).results
 if (done.length) {
  const latest = await latestResults(env)
  for (const t of done) { const results = latest.filter(o => o.test_id === t.verification_test_id); if (results.length && results.every(o => o.result === 'pass' || o.result === 'not applicable')) { await env.DB.prepare("UPDATE risk_treatments SET status='verified',evidence=evidence||?,updated_at=? WHERE id=? AND status='done'").bind(` · Verified by passing test "${t.name}" at ${now.toISOString()}`, now.toISOString(), t.id).run(); count++ } }
 }
 return count
}
