import type { Context } from 'hono'
import type { WSEvents } from 'hono/ws'
import type { StreamRegistry, WsLike } from '../stream-registry.ts'

function toText(data: unknown): string {
  if (typeof data === 'string') return data
  if (data instanceof ArrayBuffer) return Buffer.from(new Uint8Array(data)).toString('utf8')
  return ''
}

export function buildIngestEvents(context: Context, registry: StreamRegistry): WSEvents {
  const streamId = context.req.query('stream') ?? ''
  const token = context.req.query('token') ?? ''
  let authorizedSocket: WsLike | null = null

  return {
    onOpen: (_evt, ws) => {
      const entry = registry.entry(streamId)
      if (entry === null || entry.token !== token) {
        ws.close(1008, 'invalid-stream')
        return
      }
      authorizedSocket = ws as unknown as WsLike
      registry.setIngestSocket(streamId, authorizedSocket)
    },
    onMessage: (evt, ws) => {
      let payload: unknown = null
      try {
        payload = JSON.parse(toText(evt.data))
      } catch {
        ws.close(1003, 'invalid-json')
        return
      }

      const kind = (payload as { t?: unknown } | null)?.t
      if (kind === 'lines') {
        const lines = (payload as { lines?: unknown }).lines
        if (!Array.isArray(lines)) return
        registry.ingest(
          streamId,
          lines.map((line) => String(line)),
        )
        return
      }
      if (kind === 'end') registry.stop(streamId)
    },
    onClose: () => {
      if (authorizedSocket === null) return
      if (!registry.isCurrentIngest(streamId, authorizedSocket)) return
      registry.stop(streamId)
    },
  }
}
