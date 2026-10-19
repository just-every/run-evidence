import type { Bindings } from '../../auth.server'
import { Refusal } from '../upload'
import { auditStatement, done, json, oneOf, ownerRoutes, readInput, text, uuid, type Route } from '../door'
import { escape } from '../ui'
import { validDate } from '../model'
import { people } from '../program/people'
import { acceptResidual, addFromLibrary, addTreatment, assess, completeTreatment, createRisk, currentMethod, link, methods, requireRisk, setMethod } from './storage'
import { confirmImport, dryRun, readImport } from './import'
import { dryRunPage, registerPage, riskPage, type RiskRow, type Vendor, vendorsPage } from './view'
const id = `(${uuid})`
const both = (path: string) => new RegExp(`^/(?:app|api)${path}$`)
const register = async (env: Bindings) => (await env.DB.prepare(`SELECT r.id,r.title,r.origin,r.source_label,p.name AS owner_name,r.treatment,r.review_due,
 (SELECT level||' ('||score||', method '||method_revision||')' FROM risk_assessments a WHERE a.risk_id=r.id AND a.kind='inherent' ORDER BY a.at DESC,a.rowid DESC LIMIT 1) AS level,
 (SELECT level||' ('||score||', method '||method_revision||')' FROM risk_assessments a WHERE a.risk_id=r.id AND a.kind='residual' ORDER BY a.at DESC,a.rowid DESC LIMIT 1) AS residual,
 (SELECT MAX(expires_at) FROM risk_acceptances x WHERE x.risk_id=r.id) AS accepted_until
 FROM risks r LEFT JOIN people p ON p.id=r.owner_person_id ORDER BY r.created_at,r.id`).all<RiskRow>()).results
const vendors = async (env: Bindings) => (await env.DB.prepare('SELECT v.id,v.name,v.criticality,v.data_access,v.review_due,p.name AS owner_name FROM vendors v LEFT JOIN people p ON p.id=v.owner_person_id ORDER BY v.name').all<Vendor>()).results
const csv = (value: unknown) => { const s = String(value ?? ''); return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s }
export function riskHandler(clock: () => Date) {
 const routes: Route[] = [
  { method: 'GET', pattern: both('/risks'), run: async c => {
   const risks = await register(c.env), history = await methods(c.env), method = history.at(-1)!
   const prefill = Object.fromEntries(['title', 'scenario', 'controls', 'test_id'].map(k => [k, c.url.searchParams.get(k) ?? '']))
   return c.isApi ? json({ risks, method, methods: history }) : registerPage(risks, await people(c.env), method, history as never, prefill, c.actor.name)
  } },
  { method: 'POST', pattern: both('/risks'), run: async c => {
   const input = await readInput(c.request), created = await createRisk(c.env, c.actor, input, 'form', c.now)
   if (typeof input.test_id === 'string' && input.test_id) await link(c.env, c.actor, created.id, { kind: 'test', target: input.test_id }, c.now)
   return done(c, '/app/risks/' + created.id, created, 201)
  } },
  { method: 'POST', pattern: both('/risks/library'), run: async c => { const created = await addFromLibrary(c.env, c.actor, text(await readInput(c.request), 'scenario', 40), c.now); return done(c, '/app/risks/' + created.id, created, 201) } },
  { method: 'POST', pattern: both('/risks/method'), run: async c => done(c, '/app/risks#method-title', { revision: await setMethod(c.env, c.actor, await readInput(c.request), c.now) }, 201) },
  { method: 'POST', pattern: both('/risks/import'), run: async c => {
   const file = await readImport(c.request)
   if (file.confirm) return c.isApi ? json(await confirmImport(c.env, c.actor, file, c.now), 201) : done(c, '/app/risks', await confirmImport(c.env, c.actor, file, c.now))
   const plan = await dryRun(c.env, file.filename, file.bytes, file.mapping)
   const report = { ...plan, rows: plan.rows.map(({ input: _input, ...r }) => r), sha256: file.sha256, admitted: 0 }
   return c.isApi ? json(report) : dryRunPage(plan, file.sha256, file.filename, c.actor.name)
  } },
  { method: 'GET', pattern: both('/risks/export'), run: async c => {
   const rows = (await c.env.DB.prepare(`SELECT r.id,r.title,r.origin,r.source_label,p.email AS owner,r.treatment,a.kind,a.method_revision,a.likelihood,a.likelihood_label,a.impact,a.impact_label,a.score,a.level,a.actor_name,a.at,(SELECT approver_name||' until '||expires_at FROM risk_acceptances x WHERE x.assessment_id=a.id ORDER BY approved_at DESC LIMIT 1) AS acceptance FROM risks r JOIN risk_assessments a ON a.risk_id=r.id LEFT JOIN people p ON p.id=r.owner_person_id ORDER BY r.created_at,r.id,a.at,a.rowid`).all<Record<string, unknown>>()).results
   const head = ['risk_id', 'title', 'origin', 'source', 'owner', 'treatment', 'assessment', 'method_revision', 'likelihood', 'likelihood_label', 'impact', 'impact_label', 'score', 'level', 'assessed_by', 'assessed_at', 'acceptance']
   const body = [head.join(','), ...rows.map(r => Object.values(r).map(csv).join(','))].join('\r\n') + '\r\n'
   await auditStatement(c.env, c.actor, 'risk.register-exported', 'risks', c.now).run()
   return new Response(body, { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="risk-register.csv"', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } })
  } },
  { method: 'GET', pattern: both(`/risks/${id}`), run: async (c, m) => {
   const risk = await requireRisk(c.env, m[1])
   const [assessments, links, treatments, acceptances] = await c.env.DB.batch([
    c.env.DB.prepare('SELECT * FROM risk_assessments WHERE risk_id=? ORDER BY at,rowid').bind(m[1]),
    c.env.DB.prepare('SELECT kind,target FROM risk_links WHERE risk_id=? ORDER BY added_at').bind(m[1]),
    c.env.DB.prepare('SELECT * FROM risk_treatments WHERE risk_id=? ORDER BY due_date').bind(m[1]),
    c.env.DB.prepare('SELECT * FROM risk_acceptances WHERE risk_id=? ORDER BY approved_at').bind(m[1]),
   ])
   const names = new Map([...(await c.env.DB.prepare("SELECT c.id,c.name FROM controls c").all<{ id: string; name: string }>()).results.map(x => [x.id, `<a href="/app/controls/${x.id}">${escape(x.name)}</a>`] as [string, string]), ...(await c.env.DB.prepare('SELECT id,name FROM tests').all<{ id: string; name: string }>()).results.map(x => [x.id, `<a href="/app/tests/${x.id}">${escape(x.name)}</a>`] as [string, string]), ...(await vendors(c.env)).map(v => [v.id, escape(v.name)] as [string, string])])
   const owner = risk.owner_person_id ? (await c.env.DB.prepare('SELECT name FROM people WHERE id=?').bind(risk.owner_person_id).first<{ name: string }>())?.name ?? null : null
   const detail = { risk, owner_name: owner, assessments: assessments.results as Record<string, string | number>[], links: (links.results as { kind: string; target: string }[]).map(l => ({ ...l, label: names.get(l.target) ?? escape(l.target) })), treatments: treatments.results as Record<string, string>[], acceptances: acceptances.results as Record<string, string>[] }
   return c.isApi ? json({ ...detail, links: (links.results as { kind: string; target: string }[]) }) : riskPage(detail, await people(c.env), (await c.env.DB.prepare('SELECT id,name FROM tests ORDER BY name').all<{ id: string; name: string }>()).results, await vendors(c.env), c.now, c.actor.name)
  } },
  { method: 'POST', pattern: both(`/risks/${id}/assessments`), run: async (c, m) => done(c, '/app/risks/' + m[1], { id: await assess(c.env, c.actor, m[1], await readInput(c.request), c.now), method_revision: (await currentMethod(c.env)).revision }, 201) },
  { method: 'POST', pattern: both(`/risks/${id}/links`), run: async (c, m) => { await link(c.env, c.actor, m[1], await readInput(c.request), c.now); return done(c, '/app/risks/' + m[1], { linked: true }, 201) } },
  { method: 'POST', pattern: both(`/risks/${id}/treatments`), run: async (c, m) => { await addTreatment(c.env, c.actor, m[1], await readInput(c.request), c.now); return done(c, '/app/risks/' + m[1], { added: true }, 201) } },
  { method: 'POST', pattern: both(`/risks/${id}/treatments/${id}/done`), run: async (c, m) => { await completeTreatment(c.env, c.actor, m[1], m[2], await readInput(c.request), c.now); return done(c, '/app/risks/' + m[1], { done: true }) } },
  { method: 'POST', pattern: both(`/risks/${id}/acceptances`), run: async (c, m) => { await acceptResidual(c.env, c.actor, m[1], await readInput(c.request), c.now); return done(c, '/app/risks/' + m[1], { accepted: true }, 201) } },
  { method: 'POST', pattern: both('/vendors'), run: async c => {
   const input = await readInput(c.request), name = text(input, 'name', 200), criticality = oneOf(input, 'criticality', ['low', 'medium', 'high', 'critical'] as const), due = typeof input.review_due === 'string' && input.review_due ? input.review_due : null
   if (due && !validDate(due)) throw new Refusal('The review date must be a real date.')
   if (await c.env.DB.prepare('SELECT 1 FROM vendors WHERE name=?').bind(name).first()) throw new Refusal('That vendor already exists.', 409)
   const vendor = crypto.randomUUID(), owner = typeof input.owner_person_id === 'string' && input.owner_person_id ? input.owner_person_id : null
   if (owner && !await c.env.DB.prepare('SELECT 1 FROM people WHERE id=?').bind(owner).first()) throw new Refusal('Choose a business owner from People.')
   await c.env.DB.batch([c.env.DB.prepare('INSERT INTO vendors(id,name,owner_person_id,data_access,criticality,review_due,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)').bind(vendor, name, owner, text(input, 'data_access', 500, true), criticality, due, c.now.toISOString(), c.now.toISOString()), auditStatement(c.env, c.actor, 'vendor.added', 'vendor:' + vendor, c.now)])
   return done(c, '/app/vendors', { id: vendor }, 201)
  } },
  { method: 'GET', pattern: both('/vendors'), run: async c => c.isApi ? json({ vendors: await vendors(c.env) }) : vendorsPage(await vendors(c.env), await people(c.env), c.actor.name) },
 ]
 return ownerRoutes(routes, clock)
}
