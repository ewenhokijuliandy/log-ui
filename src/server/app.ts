import { createNodeWebSocket } from '@hono/node-ws'
import { Hono, type MiddlewareHandler } from 'hono'
import type { ServerLifecycle } from './lifecycle.ts'
import { type HealthInfo, registerHealthRoutes } from './routes/health.ts'
import { registerShutdownRoute } from './routes/shutdown.ts'
import { registerStreamRoutes } from './routes/streams.ts'
import { registerStaticRoutes } from './static.ts'
import type { StreamRegistry } from './stream-registry.ts'
import type { BroadcastHub, BrowserSocket } from './ws/browser.ts'
import { buildIngestEvents } from './ws/ingest.ts'

export type AppDeps = {
  registry: StreamRegistry
  hub: BroadcastHub
  guard: MiddlewareHandler
  lifecycle: ServerLifecycle
  health: HealthInfo
  webRoot: string
}

export type BuiltApp = {
  app: Hono
  injectWs: ReturnType<typeof createNodeWebSocket>
}

export function buildApp(deps: AppDeps): BuiltApp {
  const app = new Hono()
  const injectWs = createNodeWebSocket({ app })

  registerHealthRoutes(app, deps.health, deps.guard)
  registerStreamRoutes(app, deps.registry, deps.guard, () => deps.hub.browserEligible())
  registerShutdownRoute(app, deps.guard, () => deps.lifecycle.shutdown())

  app.get(
    '/ingest',
    deps.guard,
    injectWs.upgradeWebSocket((context) => buildIngestEvents(context, deps.registry)),
  )

  app.get(
    '/ws',
    deps.guard,
    injectWs.upgradeWebSocket(() => {
      let browserSocket: BrowserSocket | null = null
      return {
        onOpen: (_evt, ws) => {
          browserSocket = ws as unknown as BrowserSocket
          deps.hub.register(browserSocket)
          deps.lifecycle.armIdleTimer()
        },
        onClose: () => {
          if (browserSocket === null) return
          deps.hub.unregister(browserSocket)
          deps.lifecycle.armIdleTimer()
        },
      }
    }),
  )

  registerStaticRoutes(app, deps.webRoot)

  return { app, injectWs }
}
