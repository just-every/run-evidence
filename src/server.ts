import start from '@tanstack/react-start/server-entry'
import { Hono } from 'hono'
import { dispatch } from './base/dispatch'
import { staticAssetResponse } from './base/static-assets'
import { deploymentHealth } from './base/deployment-health'
import type { Bindings } from './auth.server'
import { createAppResponse } from './app.server'

const app = createAppResponse()

const api = new Hono<{ Bindings: Bindings }>()
api.get('/health', (context) => context.json({ status: 'ok', ...deploymentHealth(context.env) }))

export default {
  async fetch(request, env, execution) {
    const asset = await staticAssetResponse(request,env)
    if (asset) return asset
    const response = await app(request,env)
    if (response) return response
    return dispatch(request, () => api.fetch(request, env, execution), () => start.fetch(request))
  },
} satisfies ExportedHandler<Bindings>
