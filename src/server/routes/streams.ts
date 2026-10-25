import type { Hono, MiddlewareHandler } from 'hono'
import type { StreamRegistry } from '../stream-registry.ts'

export function registerStreamRoutes(
  app: Hono,
  registry: StreamRegistry,
  guard: MiddlewareHandler,
  browserEligible: () => boolean,
): void {
  app.post('/api/streams', guard, async (c) => {
    let name: string | null = null
    const raw = await c.req.text()
    if (raw !== '') {
      try {
        const parsed = JSON.parse(raw) as { name?: unknown }
        if (typeof parsed.name === 'string') name = parsed.name
      } catch {}
    }
    const entry = registry.create(name)
    return c.json(
      {
        id: entry.id,
        name: entry.name,
        ingestToken: entry.token,
        shouldOpenBrowser: browserEligible(),
      },
      201,
    )
  })

  app.get('/api/streams', (c) => c.json(registry.list()))

  app.get('/api/streams/:id/logs', (c) => {
    const rawSince = c.req.query('since')
    let since: number | null = null
    if (rawSince !== undefined) {
      const parsed = Number(rawSince)
      if (!Number.isInteger(parsed)) return c.text('invalid since', 400)
      since = parsed
    }
    const snapshot = registry.snapshot(c.req.param('id'), since)
    if (snapshot === null) return c.text('stream not found', 404)
    return c.json(snapshot)
  })

  app.post('/api/streams/:id/clear', guard, (c) => {
    const ok = registry.clearBuffer(c.req.param('id'))
    if (!ok) return c.text('stream not found', 404)
    return c.json({ ok: true })
  })

  app.delete('/api/streams/:id', guard, (c) => {
    const ok = registry.removeStream(c.req.param('id'))
    if (!ok) return c.text('stream not found', 404)
    return c.body(null, 204)
  })
}
