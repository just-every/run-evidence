import { tailoringHandler } from './evidence/agent/tailoring-http'
import { answerHandler } from './evidence/answer/http'
import { vendorReviewHandler } from './evidence/vendor/review-http'
import { privacyHandler } from './evidence/erase/http'
import { configurationFailures, configurationRefusal } from './evidence/ops/configuration'
import { operationsHandler } from './evidence/ops/http'
import { frameworkHandler } from './evidence/framework/http'
import { collectorHandler } from './evidence/collector/ingest'
import { collectorOwnerHandler } from './evidence/collector/http'
import { authResponse, runtimeBindings, type Bindings } from './auth.server'
import { evidenceHandler } from './evidence/http'
import { reviewHandler } from './evidence/review/http'
import { vendorHandler } from './evidence/vendor/http'
import { documentHandler } from './evidence/program/documents/http'
import { supplierHandler } from './evidence/vendor/supplier'
import { archiveHandler } from './evidence/archive/http'
import { periodAgentHandler } from './evidence/agent/period-http'
import { agentHandler } from './evidence/agent/http'
import { importHandler } from './evidence/import/http'
import { programHandler } from './evidence/program/http'
import { auditHandler } from './evidence/audit/http'
import { testHandler } from './evidence/tests/http'
import { remedyHandler } from './evidence/remedy/http'
import { connectHandler } from './evidence/connect/http'
import { riskHandler } from './evidence/risk/http'
import { apiHandler } from './evidence/api/http'
import { policyHandler } from './evidence/policy/http'
import { workHandler } from './evidence/work/http'
import { hookHandler } from './evidence/work/hooks'
import { followupHandler } from './evidence/followup/http'
import { identityHandler } from './evidence/identity/http'
import { attestHandler } from './evidence/attest/http'
import { memberHandler } from './evidence/me/http'
import { reviewHandler as recurringReviews } from './evidence/reviews/http'
import { inventoryHandler } from './evidence/inventory/http'
import { populationHandler } from './evidence/population/http'
import { accessHandler } from './evidence/access/http'
import { trainingHandler } from './evidence/training/http'
import { handoverHandler } from './evidence/handover/http'
import { vulnHandler } from './evidence/vuln/http'
import { lobbyResponse } from './base/lobby'
import { setupStateResponse } from './base/setup-state'
import { identity } from './identity'
import { shellFacts, withShellScope } from './evidence/shell-context'
import { provideShellFacts } from './evidence/shell'
// The production Worker and workerd harness share this complete owner HTTP door.
export function createAppResponse(clock: () => Date = () => new Date()) {
 provideShellFacts(shellFacts)
 const collectors = collectorHandler(clock)
 const agents = agentHandler(clock)
 const imports = importHandler(clock)
 const evidence = evidenceHandler(clock)
 const review = reviewHandler(clock)
 const supplier = supplierHandler(clock)
 const archive = archiveHandler(clock)
 const program = [privacyHandler(clock), tailoringHandler(clock), answerHandler(clock), vendorReviewHandler(clock), periodAgentHandler(clock), operationsHandler(clock), frameworkHandler(clock), collectorOwnerHandler(clock), programHandler(clock), documentHandler(clock), auditHandler(clock), testHandler(clock), remedyHandler(clock), connectHandler(clock), riskHandler(clock), vendorHandler(clock), policyHandler(clock), workHandler(clock), followupHandler(clock), identityHandler(clock), attestHandler(clock), recurringReviews(clock), populationHandler(clock), inventoryHandler(clock), accessHandler(clock), trainingHandler(clock), handoverHandler(clock), vulnHandler(clock)]
 const api = apiHandler(clock)
 const hooks = hookHandler(clock)
 const member = memberHandler(clock)
 return (request: Request, env: Bindings) => withShellScope(request, env, () => respond(request, env))
 async function respond(request: Request, env: Bindings) {
  const path = new URL(request.url).pathname
  if (/^\/(?:app(?:\/|$)|api(?:\/|$)|auth(?:\/|$)|v1(?:\/|$)|collectors\/|hooks\/|signin$|setup$)/.test(path)) {
   const missing = configurationFailures(runtimeBindings(env))
   if (missing.length) return configurationRefusal(missing)
  }
  if (path.startsWith('/collectors/')) return collectors(request, env)
  // The public API takes Bearer tokens only, outside every owner door.
  if (path.startsWith('/v1/')) return api(request,env)
  // Tracker webhooks verify their own signatures; they carry no owner session.
  if (path.startsWith('/hooks/')) return hooks(request,env)
  if (request.headers.has('authorization') && (path.startsWith('/app') || path.startsWith('/api')) && !path.startsWith('/api/agent')) return Response.json({error:'Agent credentials cannot use owner doors.'}, {status:403,headers:{'cache-control':'no-store'}})
  const installed = runtimeBindings(env)
  const state = await setupStateResponse(request,installed)
  if (state) return state
  const lobby = await lobbyResponse(request,installed,identity)
  if (lobby) return lobby
  const auth = await authResponse(request,env,clock)
  if (auth) return auth
  const prepared = await agents(request,env)
  if (prepared) return prepared
  const imported = await imports(request,env)
  if (imported) return imported
  const shared = await review(request,env)
  if (shared) return shared
  const suppliers = await supplier(request,env)
  if (suppliers) return suppliers
  const custody = await archive(request,env)
  if (custody) return custody
  for (const handler of program) { const handled = await handler(request,env); if (handled) return handled }
  const mine = await member(request,env)
  if (mine) return mine
  const response = await evidence(request,env)
  if (response) return response
  return null
 }
}
