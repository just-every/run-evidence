import { withDemo } from './modules/demo/index.mjs'
import start from '@tanstack/react-start/server-entry'
import { Hono } from 'hono'
import { dispatch } from './base/dispatch'
import { staticAssetResponse } from './base/static-assets'
import { deploymentHealth } from './base/deployment-health'
import type { Bindings } from './auth.server'
import { createAppResponse } from './app.server'
import { seedDemo } from './demo'
import { scheduledWork } from './evidence/scheduler'
import { runtimeBindings } from './auth.server'

const app = createAppResponse()

const api = new Hono<{ Bindings: Bindings }>()
api.get('/health', (context) => context.json({ status: 'ok', ...deploymentHealth(context.env) }))

export default withDemo({
  async fetch(request, env, execution) {
    const asset = await staticAssetResponse(request,env)
    if (asset) return asset
    const response = await app(request,env)
    if (response) return response
    return dispatch(request, () => api.fetch(request, env, execution), () => start.fetch(request))
  },
  // Cron Trigger: collections, due tests, re-tests and follow-ups (src/evidence/scheduler.ts).
  async scheduled(controller, env) {
    await scheduledWork(runtimeBindings(env), new Date(controller.scheduledTime))
  },
} satisfies ExportedHandler<Bindings>, { seed: seedDemo })
