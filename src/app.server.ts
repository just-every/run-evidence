import { authResponse, runtimeBindings, type Bindings } from './auth.server'
import { evidenceHandler } from './evidence/http'
import { reviewHandler } from './evidence/review/http'
import { archiveHandler } from './evidence/archive/http'
import { agentHandler } from './evidence/agent/http'
import { importHandler } from './evidence/import/http'
import { programHandler } from './evidence/program/http'
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
import { populationHandler } from './evidence/population/http'
import { lobbyResponse } from './base/lobby'
import { setupStateResponse } from './base/setup-state'
import { identity } from './identity'
// The production Worker and workerd harness share this complete owner HTTP door.
export function createAppResponse(clock: () => Date = () => new Date()) {
 const agents = agentHandler(clock)
 const imports = importHandler(clock)
 const evidence = evidenceHandler(clock)
 const review = reviewHandler(clock)
 const archive = archiveHandler(clock)
 const program = [programHandler(clock), testHandler(clock), remedyHandler(clock), connectHandler(clock), riskHandler(clock), policyHandler(clock), workHandler(clock), followupHandler(clock), identityHandler(clock), attestHandler(clock), recurringReviews(clock), populationHandler(clock)]
 const api = apiHandler(clock)
 const hooks = hookHandler(clock)
 const member = memberHandler(clock)
 return async (request: Request, env: Bindings) => {
  const path = new URL(request.url).pathname
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
  const auth = await authResponse(request,env)
  if (auth) return auth
  const prepared = await agents(request,env)
  if (prepared) return prepared
  const imported = await imports(request,env)
  if (imported) return imported
  const shared = await review(request,env)
  if (shared) return shared
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
