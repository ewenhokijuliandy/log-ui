import type { Hono, MiddlewareHandler } from 'hono'
import { createSaved, deleteSaved, listSaved, readSaved, renameSaved } from '../saved-store.ts'
import type { StreamRegistry } from '../stream-registry.ts'

type SavedDeps = {
  registry: StreamRegistry
  stateDir: () => string | null
  bufferCap: () => number
}

function resolveStateDir(deps: SavedDeps): string | null {
  return deps.stateDir()
}

async function readJsonBody(context: {
  req: { json: () => Promise<unknown> }
}): Promise<Record<string, unknown> | null> {
  try {
    const parsed = await context.req.json()
    if (parsed === null || typeof parsed !== 'object') return null
    return parsed as Record<string, unknown>
  } catch {
    return null
  }
}

export function registerSavedRoutes(app: Hono, deps: SavedDeps, guard: MiddlewareHandler): void {
  app.get('/api/saved', guard, async (context) => {
    const stateDir = resolveStateDir(deps)
    if (stateDir === null) return context.text('saved logs need a state directory', 503)
    return context.json(await listSaved(stateDir))
  })

  app.get('/api/saved/:id', guard, async (context) => {
    const stateDir = resolveStateDir(deps)
    if (stateDir === null) return context.text('saved logs need a state directory', 503)
    const envelope = await readSaved(stateDir, context.req.param('id'))
    if (envelope === null) return context.text('saved log not found', 404)
    return context.json(envelope)
  })

  app.post('/api/saved', guard, async (context) => {
    const body = await readJsonBody(context)
    if (body === null) return context.text('invalid body', 400)
    const streamId = typeof body.streamId === 'string' ? body.streamId : null
    if (streamId === null) return context.text('streamId is required', 400)
    const entry = deps.registry.entry(streamId)
    if (entry === null) return context.text('stream not found', 404)
    const snapshot = deps.registry.snapshot(streamId, null)
    const rows = snapshot === null ? [] : snapshot.records
    if (rows.length === 0) return context.text('stream has no lines to save', 409)
    const name = typeof body.name === 'string' ? body.name : entry.name
    const zone = body.zone === 'local' ? 'local' : 'utc'
    const stateDir = resolveStateDir(deps)
    if (stateDir === null) return context.text('saved logs need a state directory', 503)
    const envelope = await createSaved(stateDir, {
      name,
      streamName: entry.name,
      zone,
      rules: body.rules ?? null,
      rows,
      bufferCap: deps.bufferCap(),
    })
    return context.json(
      {
        id: envelope.id,
        name: envelope.name,
        streamName: envelope.streamName,
        savedAt: envelope.savedAt,
        rowCount: envelope.rowCount,
      },
      201,
    )
  })

  app.patch('/api/saved/:id', guard, async (context) => {
    const body = await readJsonBody(context)
    if (body === null) return context.text('invalid body', 400)
    if (typeof body.name !== 'string') return context.text('name is required', 400)
    const stateDir = resolveStateDir(deps)
    if (stateDir === null) return context.text('saved logs need a state directory', 503)
    const meta = await renameSaved(stateDir, context.req.param('id'), body.name)
    if (meta === null) return context.text('saved log not found', 404)
    return context.json(meta)
  })

  app.delete('/api/saved/:id', guard, async (context) => {
    const stateDir = resolveStateDir(deps)
    if (stateDir === null) return context.text('saved logs need a state directory', 503)
    const removed = await deleteSaved(stateDir, context.req.param('id'))
    if (!removed) return context.text('saved log not found', 404)
    return context.json({ ok: true })
  })
}
