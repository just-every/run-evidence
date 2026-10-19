import { definitions, reviseControl, addRequirement, reviseRequirement } from '../control-definition/storage'
import { definitionPanel } from '../control-definition/view'
import { populationMemberships } from '../population/storage'
import { day } from '../model'
import { desk } from '../storage'
import { done, json, ownerRoutes, readInput, uuid, type Route } from '../door'
import { latestResults } from '../tests/storage'
import { addPerson, people, type Person } from './people'
import { applicability, createProgram, decideApplicability, decideEdition, programHistory, programs, proposeEdition, recordReview, requireProgram, updateProgram } from './storage'
import { readiness } from './readiness'
import { addMapping, assignOwner, changeScope, controlMappings, ownership, periodReport, removeMapping, requireControl, scopeAt } from './control'
import { controlPage, peoplePage, programPage, programsPage, reportPage } from './view'
import { scheduleRequirement, overrideRenewal } from './schedule'
import { auditStatement } from '../door'
import { boardCsv, boardReport } from './board'
import { boardFilters } from './report-filters'
import { boardPage } from './board-view'
const id = `(${uuid})`
const both = (path: string) => new RegExp(`^/(?:app|api)${path}$`)

export function programHandler(clock: () => Date) {
 const routes: Route[] = [
  { method: 'GET', pattern: both('/programs'), run: async c => {
   const framework = c.url.searchParams.get('framework') || '', product = c.url.searchParams.get('product') || ''
   const selected = (await programs(c.env)).filter(p => (!framework || p.framework === framework) && (!product || JSON.parse(p.products).includes(product)))
   const rows = await Promise.all(selected.map(async p => ({ ...p, totals: (await readiness(c.env, p, c.now)).totals })))
   return c.isApi ? json({ programs: rows }) : programsPage(rows, await people(c.env), c.actor.name, {framework,product})
  } },
  { method: 'POST', pattern: both('/programs'), run: async c => {
   const input = await readInput(c.request)
   if (typeof input.framework_edition === 'string') { const [framework, edition] = input.framework_edition.split('|'); input.framework = framework; input.edition = edition ?? '' }
   const created = await createProgram(c.env, c.actor, input, c.now)
   return done(c, '/app/programs/' + created.id, created, 201)
  } },
  { method: 'GET', pattern: both(`/programs/${id}`), run: async (c, m) => {
   const row = await requireProgram(c.env, m[1]), ready = await readiness(c.env, row, c.now)
   if (c.isApi) return json({ program: row, readiness: ready, applicability: (await applicability(c.env, row.id)).history, history: await programHistory(c.env, row.id) })
   return programPage(row, ready, await programHistory(c.env, row.id), await people(c.env), c.url.searchParams.get('show') || 'all', c.actor.name)
  } },
  { method: 'POST', pattern: both(`/programs/${id}`), run: async (c, m) => { await updateProgram(c.env, c.actor, m[1], await readInput(c.request), c.now); return done(c, '/app/programs/' + m[1], { updated: true }) } },
  { method: 'POST', pattern: both(`/programs/${id}/applicability`), run: async (c, m) => { await decideApplicability(c.env, c.actor, m[1], await readInput(c.request), c.now); return done(c, `/app/programs/${m[1]}?show=excluded#requirements`, { recorded: true }) } },
  { method: 'POST', pattern: both(`/programs/${id}/reviews`), run: async (c, m) => done(c, '/app/programs/' + m[1], await recordReview(c.env, c.actor, m[1], await readInput(c.request), c.now)) },
  { method: 'POST', pattern: both(`/programs/${id}/editions`), run: async (c, m) => done(c, '/app/programs/' + m[1] + '#edition-title', await proposeEdition(c.env, c.actor, m[1], await readInput(c.request), c.now), 201) },
  { method: 'POST', pattern: both(`/programs/${id}/editions/${id}`), run: async (c, m) => { await decideEdition(c.env, c.actor, m[1], m[2], await readInput(c.request), c.now); return done(c, '/app/programs/' + m[1], { decided: true }) } },
  // The program export: scope, owners, exclusions, edition history and every
  // unresolved obligation, with no certification asserted.
  { method: 'GET', pattern: both(`/programs/${id}/export`), run: async (c, m) => {
   const row = await requireProgram(c.env, m[1]), ready = await readiness(c.env, row, c.now), history = await programHistory(c.env, row.id), { history: decisions } = await applicability(c.env, row.id)
   const owners = await Promise.all([...new Set(ready.requirements.flatMap(r => r.controls.map(x => x.id)))].map(async control => ({ control, owner: (await ownership(c.env, control)).at(-1) ?? null })))
   const body = { format: 'evidence-program', version: 1, exported_at: c.now.toISOString(), certification: 'None asserted. ' + ready.framework.assessor, program: row, readiness: ready.totals, calculation: ready.calculation, requirements: ready.requirements, checklist: ready.checklist, applicability_history: decisions, owners, history, unresolved: ready.requirements.filter(r => r.state === 'included' && (r.proof !== 'current' || r.testing === 'failing' || r.testing === 'unknown')).map(r => ({ ref: r.ref, title: r.title, proof: r.proof, testing: r.testing })) }
   await c.env.DB.prepare("INSERT INTO product_audit(id,actor_kind,actor_id,actor_name,action,subject,outcome,detail,at) VALUES(?,'owner',?,?,'program.exported',?,'succeeded','',?)").bind(crypto.randomUUID(), c.actor.id, c.actor.name, 'program:' + row.id, c.now.toISOString()).run()
   return new Response(JSON.stringify(body, null, 1), { headers: { 'content-type': 'application/json; charset=utf-8', 'content-disposition': `attachment; filename="program-${row.id}.json"`, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } })
  } },
  { method: 'GET', pattern: both(`/programs/${id}/board`), run: async (c, m) => {
   const row = await requireProgram(c.env, m[1]), report = await boardReport(c.env, row, boardFilters(c.url), c.now)
   if (!c.isApi) return boardPage(report, await people(c.env), c.actor.name)
   await auditStatement(c.env, c.actor, 'program.board-exported', 'program:' + row.id, c.now, 'succeeded', 'json').run()
   return json(report)
  } },
  { method: 'GET', pattern: new RegExp(`^/app/programs/${id}/board\\.csv$`), run: async (c, m) => {
   const row = await requireProgram(c.env, m[1]), report = await boardReport(c.env, row, boardFilters(c.url), c.now)
   await auditStatement(c.env, c.actor, 'program.board-exported', 'program:' + row.id, c.now, 'succeeded', 'csv').run()
   return new Response(boardCsv(report), { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="board-report-${row.id}.csv"`, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } })
  } },
  { method: 'GET', pattern: both(`/controls/${id}`), run: async (c, m) => {
   const control = await requireControl(c.env, m[1]), data = await desk(c.env, day(c.now), c.now)
   const requirements = data.requirements.filter(r => r.control_id === control.id).map(r => ({ id: r.id, name: r.name, cadence: r.cadence, gap: r.gap, receipts: r.receipts.length }))
   const linked = (await c.env.DB.prepare('SELECT t.id,t.name FROM test_controls l JOIN tests t ON t.id=l.test_id WHERE l.control_id=?').bind(control.id).all<{ id: string; name: string }>()).results
   const latest = await latestResults(c.env)
   const tests = linked.map(t => { const results = latest.filter(o => o.test_id === t.id).map(o => o.result); return { ...t, status: results.includes('fail') ? 'failing' : results.includes('unknown') ? 'unknown' : results.length ? 'passing' : 'never run' } })
   const mappings = await controlMappings(c.env, control.id, control.library_id), owners = await ownership(c.env, control.id), scope = await scopeAt(c.env, control.id, c.now.toISOString())
   const revisions = await definitions(c.env,control.id)
   return c.isApi ? json({ control, mappings, owners, scope, requirements, tests, revisions }) : controlPage(control, mappings, owners, scope, requirements, tests, await people(c.env), c.actor.name, definitionPanel(control.id,revisions))
  } },
  { method: 'POST', pattern: both(`/controls/${id}/revisions`), run: async (c,m) => done(c,'/app/controls/'+m[1],await reviseControl(c.env,c.actor,m[1],await readInput(c.request),c.now)) },
  { method: 'POST', pattern: both(`/controls/${id}/requirements`), run: async (c,m) => { const result=await addRequirement(c.env,c.actor,m[1],await readInput(c.request),c.now); return done(c,'/app/requirements/'+result.id,result,201) } },
  { method: 'POST', pattern: both(`/requirements/${id}/revisions`), run: async (c,m) => { await reviseRequirement(c.env,c.actor,m[1],await readInput(c.request),c.now); return done(c,'/app/requirements/'+m[1],{revised:true}) } },
  { method: 'GET', pattern: both(`/controls/${id}/export`), run: async (c,m) => { const control=await requireControl(c.env,m[1]); return json({control,revisions:await definitions(c.env,m[1]),mappings:await controlMappings(c.env,m[1],control.library_id)}) } },
  { method: 'POST', pattern: both(`/controls/${id}/owners`), run: async (c, m) => { await assignOwner(c.env, c.actor, m[1], await readInput(c.request), c.now); return done(c, '/app/controls/' + m[1], { assigned: true }) } },
  { method: 'POST', pattern: both(`/controls/${id}/mappings`), run: async (c, m) => done(c, '/app/controls/' + m[1], { id: await addMapping(c.env, c.actor, m[1], await readInput(c.request), c.now) }, 201) },
  { method: 'POST', pattern: both(`/controls/${id}/mappings/${id}/remove`), run: async (c, m) => { await removeMapping(c.env, c.actor, m[1], m[2], await readInput(c.request), c.now); return done(c, '/app/controls/' + m[1], { removed: true }) } },
  { method: 'POST', pattern: both(`/controls/${id}/scope`), run: async (c, m) => { await changeScope(c.env, c.actor, m[1], await readInput(c.request), c.now); return done(c, '/app/controls/' + m[1], { recorded: true }) } },
  { method: 'GET', pattern: both(`/controls/${id}/report`), run: async (c, m) => {
   const control = await requireControl(c.env, m[1]), report = await periodReport(c.env, m[1], c.url.searchParams.get('from') ?? '', c.url.searchParams.get('to') ?? '')
   return c.isApi ? json(report) : reportPage(control.name, report, c.actor.name)
  } },
  { method: 'GET', pattern: both('/people'), run: async c => { const rows = (await c.env.DB.prepare('SELECT p.id,p.name,p.email,p.kind,p.created_at,d.departed_at,d.access_outcome FROM people p LEFT JOIN people_departures d ON d.person_id=p.id ORDER BY p.name,p.id').all<Person & { departed_at: string | null; access_outcome: string | null }>()).results; return c.isApi ? json({ people: rows }) : peoplePage(rows, c.actor.name, await populationMemberships(c.env, c.now)) } },
  { method: 'POST', pattern: both('/people'), run: async c => done(c, '/app/people', await addPerson(c.env, c.actor, await readInput(c.request), c.now), 201) },
  { method: 'POST', pattern: both(`/requirements/${id}/schedule`), run: async (c, m) => { await scheduleRequirement(c.env, c.actor, m[1], await readInput(c.request), c.now); return done(c, '/app/requirements/' + m[1], { scheduled: true }) } },
  { method: 'POST', pattern: both(`/requirements/${id}/renewal-date`), run: async (c, m) => { await overrideRenewal(c.env, c.actor, m[1], await readInput(c.request), c.now); return done(c, '/app/requirements/' + m[1], { overridden: true }) } },
 ]
 return ownerRoutes(routes, clock)
}
