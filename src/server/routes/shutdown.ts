import type { Hono, MiddlewareHandler } from 'hono'

export function registerShutdownRoute(
  app: Hono,
  guard: MiddlewareHandler,
  shutdown: () => void,
): void {
  app.post('/api/shutdown', guard, (c) => {
    setTimeout(shutdown, 20)
    return c.body(null, 204)
  })
}
