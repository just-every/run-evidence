// Harness edge only. Production has no time binding or caller-controlled clock.
import { createAppResponse } from '../../src/app.server'
import { scheduledWork } from '../../src/evidence/scheduler'
export default { async fetch(request: Request, env: any) {
 // Miniflare's HTTP proxy rewrites Host. Restore the harness transport envelope
 // so the same production admission code sees the exact intended URL and Host.
 const headers = new Headers(request.headers)
 const url = headers.get('x-harness-url')!
 headers.set('host', headers.get('x-harness-host')!)
 headers.delete('x-harness-url'); headers.delete('x-harness-host')
 request = new Request(url, { method:request.method, headers, body:request.body, redirect:'manual' })
 const response = await createAppResponse(() => new Date(env.HARNESS_NOW))(request, env)
 return response ?? new Response(null, { status:404 })
},
 // The Cron Trigger door under the harness clock.
 async scheduled(_controller: unknown, env: any) { await scheduledWork(env, new Date(env.HARNESS_NOW)) },
}
