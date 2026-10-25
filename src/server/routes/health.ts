import type { Hono } from 'hono'

export type HealthInfo = {
  pid: number
  version: string
  startedAt: number
  portProvider: () => number
}

export function registerHealthRoutes(app: Hono, info: HealthInfo): void {
  app.get('/api/health', (c) =>
    c.json({
      ok: true,
      pid: info.pid,
      version: info.version,
      startedAt: info.startedAt,
      port: info.portProvider(),
    }),
  )
}
