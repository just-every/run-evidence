import {withCollectionClock} from '../../src/evidence/connect/clock'
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
 // Substitute only the storage-provider deletion edge. Native reads, writes,
 // authorization and durable admission still run unchanged in workerd.
 if(env.HARNESS_R2_DELETE_FAILURE==='true')env={...env,EXHIBITS:new Proxy(env.EXHIBITS,{get(target,key){
  if(key==='delete')return async()=>{throw new Error('synthetic-evidence-provider-delete-interruption')}
  const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value
 }})}
 const response = await withCollectionClock(()=>new Date(Date.parse(env.HARNESS_NOW)+Number(env.HARNESS_RECEIPT_OFFSET_MS??0)),()=>createAppResponse(() => new Date(env.HARNESS_NOW))(request, env))
 return response ?? new Response(null, { status:404 })
},
 // The Cron Trigger door under the harness clock.
 async scheduled(_controller: unknown, env: any) { await withCollectionClock(()=>new Date(Date.parse(env.HARNESS_NOW)+Number(env.HARNESS_RECEIPT_OFFSET_MS??0)),()=>scheduledWork(env, new Date(env.HARNESS_NOW))) },
}
