import { fileURLToPath } from 'node:url'
import { type ServerType, serve } from '@hono/node-server'
import { createNodeWebSocket } from '@hono/node-ws'
import { Hono } from 'hono'
import { registerHealthRoutes } from './routes/health.ts'
import { registerShutdownRoute } from './routes/shutdown.ts'
import { registerStreamRoutes } from './routes/streams.ts'
import { sameOriginGuard } from './security.ts'
import { registerStaticRoutes } from './static.ts'
import { StreamRegistry } from './stream-registry.ts'
import { readVersion } from './version.ts'
import { BroadcastHub, type BrowserSocket } from './ws/browser.ts'
import { buildIngestEvents } from './ws/ingest.ts'

export type ServerOptions = {
  port: number
  idleTimeoutMs: number
  onExit: (code: number) => void
  webRoot?: string
}

export type StartedServer = {
  port: number
  registry: StreamRegistry
  hub: BroadcastHub
  shutdown: () => void
  close: () => Promise<void>
  httpServer: ServerType
}

export async function startServer(options: ServerOptions): Promise<StartedServer> {
  const app = new Hono()
  const registry = new StreamRegistry()
  const hub = new BroadcastHub()
  const injectWs = createNodeWebSocket({ app })
  const version = readVersion()
  const startedAt = Date.now()

  let port = options.port
  let shuttingDown = false
  let idleTimer: ReturnType<typeof setTimeout> | null = null
  let httpServer: ServerType | null = null

  const guard = sameOriginGuard(() => port)

  registry.subscribe((event) => {
    if (event.type === 'logs:appended') hub.append(event.streamId, event.records, event.dropped)
    if (event.type !== 'logs:appended') hub.broadcast(event)
    armIdleTimer()
  })

  registerHealthRoutes(app, {
    pid: process.pid,
    version,
    startedAt,
    portProvider: () => port,
  })
  registerStreamRoutes(app, registry, guard, () => hub.browserEligible())
  registerShutdownRoute(app, guard, () => shutdown('shutdown-requested'))

  app.get(
    '/ingest',
    guard,
    injectWs.upgradeWebSocket((c) => buildIngestEvents(c, registry)),
  )

  app.get(
    '/ws',
    guard,
    injectWs.upgradeWebSocket(() => ({
      onOpen: (_evt, ws) => {
        hub.register(ws as unknown as BrowserSocket)
        armIdleTimer()
      },
      onClose: (_evt, ws) => {
        hub.unregister(ws as unknown as BrowserSocket)
        armIdleTimer()
      },
    })),
  )

  registerStaticRoutes(app, resolveWebRoot(options.webRoot))

  function armIdleTimer(): void {
    if (options.idleTimeoutMs <= 0) return
    if (idleTimer !== null) clearTimeout(idleTimer)
    idleTimer = setTimeout(() => {
      idleTimer = null
      if (shuttingDown) return
      if (registry.activeCount() === 0 && hub.clientCount() === 0) shutdown('idle-exit')
    }, options.idleTimeoutMs)
  }

  function shutdown(_reason: string): void {
    if (shuttingDown) return
    shuttingDown = true
    hub.flush()

    if (idleTimer !== null) {
      clearTimeout(idleTimer)
      idleTimer = null
    }

    registry.stopAll()
    hub.closeAll()

    if (httpServer !== null) void httpServer.close()

    options.onExit(0)
  }

  async function close(): Promise<void> {
    hub.flush()
    hub.closeAll()
    hub.dispose()
    registry.dispose()

    if (idleTimer !== null) {
      clearTimeout(idleTimer)
      idleTimer = null
    }

    if (httpServer === null) return
    if (!httpServer.listening) return
    await new Promise<void>((resolve, reject) => {
      const active = httpServer as ServerType
      active.close((error) => {
        if (error instanceof Error) reject(error)
        else resolve()
      })
    })
  }

  const server = serve({ fetch: app.fetch, port: options.port, hostname: '127.0.0.1' })
  httpServer = server
  injectWs.injectWebSocket(server)

  await new Promise<void>((resolve, reject) => {
    const onError = (error: unknown) => reject(error)
    server.once('error', onError)
    server.once('listening', () => {
      server.off('error', onError)
      resolve()
    })
  })

  const address = server.address()
  if (typeof address === 'object' && address !== null) port = address.port
  armIdleTimer()

  return { port, registry, hub, shutdown: () => shutdown('manual'), close, httpServer }
}

function resolveWebRoot(override?: string): string {
  if (override !== undefined) return override
  return fileURLToPath(new URL('../../dist/web', import.meta.url))
}
