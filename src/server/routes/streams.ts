import type { Hono, MiddlewareHandler } from 'hono'
import type { StreamRegistry } from '../stream-registry.ts'
import { readStreamNameBody } from './body.ts'

export function registerStreamRoutes(
  app: Hono,
  registry: StreamRegistry,
  guard: MiddlewareHandler,
  browserEligible: () => boolean,
): void {
  app.post('/api/streams', guard, async (context) => {
    const entry = registry.create(await readStreamNameBody(context))
    return context.json(
      {
        id: entry.id,
        name: entry.name,
        ingestToken: entry.token,
        shouldOpenBrowser: browserEligible(),
      },
      201,
    )
  })

  app.get('/api/streams', guard, (context) => context.json(registry.list()))

  app.get('/api/streams/:id/logs', guard, (context) => {
    const rawSince = context.req.query('since')
    let since: number | null = null
    if (rawSince !== undefined) {
      const parsed = Number(rawSince)
      if (!Number.isInteger(parsed)) return context.text('invalid since', 400)
      since = parsed
    }
    const snapshot = registry.snapshot(context.req.param('id'), since)
    if (snapshot === null) return context.text('stream not found', 404)
    return context.json(snapshot)
  })

  app.post('/api/streams/:id/clear', guard, (context) => {
    const wasCleared = registry.clearBuffer(context.req.param('id'))
    if (!wasCleared) return context.text('stream not found', 404)
    return context.json({ ok: true })
  })

  app.patch('/api/streams/:id', guard, async (context) => {
    const id = context.req.param('id')
    if (registry.entry(id) === null) return context.text('stream not found', 404)
    const name = await readStreamNameBody(context)
    if (name === null) return context.json({ error: 'Name is required.' }, 400)
    const outcome = registry.rename(id, name)
    if (!outcome.ok) return context.json({ error: outcome.error }, outcome.status)
    return context.json(outcome.meta)
  })

  app.delete('/api/streams/:id', guard, (context) => {
    const found = registry.removeStream(context.req.param('id'))
    if (!found) return context.text('stream not found', 404)
    return context.body(null, 204)
  })
}
