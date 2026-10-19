import type { Bindings } from '../../auth.server'
import { libraryControl } from '../library'
import { policyList } from '../policy/storage'
import { controlStates } from '../program/readiness'
import { requirements, requireFramework } from './storage'
// Custom frameworks share the live proof/test/policy state used by core programs.
export async function frameworkReadiness(env: Bindings, id: string, now: Date) {
 const framework = await requireFramework(env,id), rows = await requirements(env,id), { states } = await controlStates(env,now)
 const library = new Map([...states.values()].filter(c=>c.library_id).map(c=>[c.library_id!,c.id])), policies = new Map((await policyList(env,now)).map(p=>[p.title.toLowerCase(),p.review_state]))
 const result = rows.map(row=>{
  const controls = row.mappings.map(target=>({ target, state:states.get(library.get(target) ?? target) ?? null }))
  const proof = !controls.length ? 'unmapped' : controls.every(c=>c.state?.proof==='current') ? 'current' : 'not current'
  const testing = controls.some(c=>c.state?.tests?.fail) ? 'failing' : controls.some(c=>!c.state?.tests || c.state.tests.unknown || c.state.tests.untested || !c.state.tests.pass) ? 'unknown' : !controls.length ? 'untested' : 'passing'
  const required = [...new Set(row.mappings.flatMap(target=>libraryControl(target)?.policies ?? libraryControl(states.get(target)?.library_id ?? '')?.policies ?? []))], policies_missing=required.filter(p=>policies.get(p.toLowerCase())!=='current')
  return { ...row, controls, proof, testing, policies_missing, ready:!row.removed_at && proof==='current' && testing==='passing' && !policies_missing.length }
 })
 const active=result.filter(r=>!r.removed_at), ready=active.filter(r=>r.ready).length
 return { framework, requirements:result, totals:{requirements:active.length,removed:result.length-active.length,unmapped:active.filter(r=>r.proof==='unmapped').length,mapped:active.filter(r=>r.proof!=='unmapped').length,ready,not_ready:active.length-ready,readiness_percent:active.length?Math.floor(100*ready/active.length):null}, calculation:'Readiness is floor(100 × ready ÷ active requirements). A requirement needs a mapping, current proof, fresh passing tests for every mapped control, and all required policies current. Imported definitions are never proof that a control operated. Removed requirements retain history and are excluded prospectively.' }
}
