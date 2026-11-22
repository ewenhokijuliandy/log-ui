import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { type ServerType, serve } from '@hono/node-server'
import { normalizeBufferCap } from '../shared/buffer-cap.ts'
import { buildApp } from './app.ts'
import { createServerLifecycle, waitForListening } from './lifecycle.ts'
import { sameOriginGuard } from './security.ts'
import { createSettingsStore } from './settings.ts'
import { StreamRegistry } from './stream-registry.ts'
import { readVersion } from './version.ts'
import { BroadcastHub } from './ws/browser.ts'

export type ServerOptions = {
  port: number
  idleTimeoutMs: number
  onExit: (code: number) => void
  webRoot?: string
  stateDir?: string
  bufferCap?: number
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
  const settings = createSettingsStore(options.stateDir)
  await settings.load()
  if (options.bufferCap !== undefined) {
    const bufferCap = normalizeBufferCap(options.bufferCap)
    if (bufferCap === null) throw new Error('invalid buffer cap')
    await settings.setBufferCap(bufferCap)
  }
  const registry = new StreamRegistry(settings.get().bufferCap)
  const hub = new BroadcastHub()

  let port = options.port
  let httpServer: ServerType | null = null

  const lifecycle = createServerLifecycle({
    registry,
    hub,
    idleTimeoutMs: options.idleTimeoutMs,
    serverProvider: () => httpServer,
    onExit: options.onExit,
  })
  wireRegistryEvents(registry, hub, () => lifecycle.armIdleTimer())

  const { app, injectWs } = buildApp({
    registry,
    hub,
    guard: sameOriginGuard(() => port),
    lifecycle,
    settings,
    health: {
      pid: process.pid,
      version: readVersion(),
      startedAt: Date.now(),
      node: process.version,
      portProvider: () => port,
    },
    webRoot: resolveWebRoot(options.webRoot),
  })

  const server = serve({ fetch: app.fetch, port: options.port, hostname: '127.0.0.1' })
  httpServer = server
  injectWs.injectWebSocket(server)
  await waitForListening(server)

  const address = server.address()
  if (typeof address === 'object' && address !== null) port = address.port
  lifecycle.armIdleTimer()

  return {
    port,
    registry,
    hub,
    shutdown: lifecycle.shutdown,
    close: lifecycle.close,
    httpServer: server,
  }
}

function wireRegistryEvents(
  registry: StreamRegistry,
  hub: BroadcastHub,
  onEvent: () => void,
): void {
  registry.subscribe((event) => {
    if (event.type === 'logs:appended') hub.append(event.streamId, event.records, event.dropped)
    if (event.type === 'logs:cleared') hub.flushStream(event.streamId)
    if (event.type !== 'logs:appended') hub.broadcast(event)
    onEvent()
  })
}

function resolveWebRoot(override?: string): string {
  if (override !== undefined) return override
  const candidates = [
    fileURLToPath(new URL('./web', import.meta.url)),
    fileURLToPath(new URL('../../dist/web', import.meta.url)),
  ]
  for (const candidate of candidates) {
    if (existsSync(join(candidate, 'index.html'))) return candidate
  }
  return candidates[0]
}
