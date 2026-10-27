import type { MiddlewareHandler } from 'hono'

export function sameOriginGuard(portProvider: () => number): MiddlewareHandler {
  return async (c, next) => {
    const port = portProvider()
    const host = c.req.header('host')
    if (host !== undefined) {
      const allowed = allowedHosts(port).includes(host)
      if (!allowed) return c.text('forbidden host', 403)
    }

    const origin = c.req.header('origin')
    if (origin !== undefined) {
      const allowed = allowedOrigins(port).includes(origin)
      if (!allowed) return c.text('forbidden origin', 403)
    }

    await next()
  }
}

export function allowedHosts(port: number): string[] {
  return [`127.0.0.1:${port}`, `localhost:${port}`, `[::1]:${port}`]
}

export function allowedOrigins(port: number): string[] {
  return [`http://127.0.0.1:${port}`, `http://localhost:${port}`, `http://[::1]:${port}`]
}
