import { authResponse, type Bindings } from './auth.server'
import { evidenceHandler } from './evidence/http'
import { reviewHandler } from './evidence/review/http'
import { archiveHandler } from './evidence/archive/http'
import { agentHandler } from './evidence/agent/http'
import { importHandler } from './evidence/import/http'
// The production Worker and workerd harness share this complete owner HTTP door.
export function createAppResponse(clock: () => Date = () => new Date()) {
 const agents = agentHandler(clock)
 const imports = importHandler(clock)
 const evidence = evidenceHandler(clock)
 const review = reviewHandler(clock)
 const archive = archiveHandler(clock)
 return async (request: Request, env: Bindings) => {
  const path = new URL(request.url).pathname
  if (request.headers.has('authorization') && (path.startsWith('/app') || path.startsWith('/api')) && !path.startsWith('/api/agent')) return Response.json({error:'Agent credentials cannot use owner doors.'}, {status:403,headers:{'cache-control':'no-store'}})
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
  const response = await evidence(request,env)
  if (response) return response
  if (new URL(request.url).pathname === '/') return new Response(null,{status:303,headers:{location:'/app'}})
  return null
 }
}
