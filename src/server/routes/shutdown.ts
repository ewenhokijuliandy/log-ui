import type { Hono, MiddlewareHandler } from 'hono'

const SHUTDOWN_RESPONSE_DELAY_MS = 20

export function registerShutdownRoute(
  app: Hono,
  guard: MiddlewareHandler,
  shutdown: () => void,
): void {
  app.post('/api/shutdown', guard, (context) => {
    setTimeout(shutdown, SHUTDOWN_RESPONSE_DELAY_MS)
    return context.body(null, 204)
  })
}
