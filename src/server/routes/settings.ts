import type { Hono, MiddlewareHandler } from 'hono'
import { normalizeBufferCap } from '../../shared/buffer-cap.ts'
import type { SettingsStore } from '../settings.ts'
import type { StreamRegistry } from '../stream-registry.ts'
import type { BroadcastHub } from '../ws/browser.ts'

export function registerSettingsRoutes(
  app: Hono,
  settings: SettingsStore,
  registry: StreamRegistry,
  hub: BroadcastHub,
  guard: MiddlewareHandler,
): void {
  app.get('/api/settings', guard, (context) => context.json(settings.get()))

  app.patch('/api/settings', guard, async (context) => {
    let payload: unknown = null
    try {
      payload = await context.req.json()
    } catch {
      return context.json({ error: 'Invalid settings payload.' }, 400)
    }
    const bufferCap = normalizeBufferCap((payload as { bufferCap?: unknown } | null)?.bufferCap)
    if (bufferCap === null) {
      return context.json(
        { error: 'Buffer limit must be a whole number from 1,000 to 50,000.' },
        400,
      )
    }
    try {
      await settings.setBufferCap(bufferCap)
    } catch {
      return context.json({ error: 'Could not save settings.' }, 500)
    }
    registry.setBufferCap(bufferCap)
    hub.broadcast({ type: 'settings:updated', bufferCap })
    return context.json({ bufferCap })
  })
}
