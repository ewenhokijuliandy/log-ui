import type { Hono, MiddlewareHandler } from 'hono'

export type HealthInfo = {
  pid: number
  version: string
  startedAt: number
  node: string
  portProvider: () => number
}

export function registerHealthRoutes(app: Hono, info: HealthInfo, guard: MiddlewareHandler): void {
  app.get('/api/health', guard, (context) =>
    context.json({
      ok: true,
      pid: info.pid,
      version: info.version,
      startedAt: info.startedAt,
      port: info.portProvider(),
      node: info.node,
    }),
  )
}
