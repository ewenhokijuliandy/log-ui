import type { ServerType } from '@hono/node-server'
import type { StreamRegistry } from './stream-registry.ts'
import type { BroadcastHub } from './ws/browser.ts'

export type IdleTimer = {
  arm: () => void
  cancel: () => void
}

export type IdleTimerOptions = {
  idleTimeoutMs: number
  isIdle: () => boolean
  onIdle: () => void
}

export function createIdleTimer(options: IdleTimerOptions): IdleTimer {
  let timer: ReturnType<typeof setTimeout> | null = null

  const cancel = (): void => {
    if (timer === null) return
    clearTimeout(timer)
    timer = null
  }

  const arm = (): void => {
    if (options.idleTimeoutMs <= 0) return
    cancel()
    timer = setTimeout(() => {
      timer = null
      if (options.isIdle()) options.onIdle()
    }, options.idleTimeoutMs)
  }

  return { arm, cancel }
}

export type ServerLifecycle = {
  shutdown: () => void
  close: () => Promise<void>
  armIdleTimer: () => void
}

export type ServerLifecycleOptions = {
  registry: StreamRegistry
  hub: BroadcastHub
  idleTimeoutMs: number
  serverProvider: () => ServerType | null
  onExit: (code: number) => void
}

export function createServerLifecycle(options: ServerLifecycleOptions): ServerLifecycle {
  let shuttingDown = false
  let idleTimer: IdleTimer | null = null

  function shutdown(): void {
    if (shuttingDown) return
    shuttingDown = true
    idleTimer?.cancel()
    options.hub.flush()
    options.registry.stopAll()
    options.hub.closeAll()
    const server = options.serverProvider()
    if (server !== null) void server.close()
    options.onExit(0)
  }

  async function close(): Promise<void> {
    options.hub.flush()
    options.hub.closeAll()
    options.hub.dispose()
    options.registry.dispose()
    idleTimer?.cancel()

    const server = options.serverProvider()
    if (server === null) return
    if (!server.listening) return
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error instanceof Error) {
          reject(error)
          return
        }
        resolve()
      })
    })
  }

  idleTimer = createIdleTimer({
    idleTimeoutMs: options.idleTimeoutMs,
    isIdle: () =>
      !shuttingDown && options.registry.activeCount() === 0 && options.hub.clientCount() === 0,
    onIdle: shutdown,
  })

  return { shutdown, close, armIdleTimer: () => idleTimer?.arm() }
}

export function waitForListening(server: ServerType): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const onError = (error: unknown) => reject(error)
    server.once('error', onError)
    server.once('listening', () => {
      server.off('error', onError)
      resolve()
    })
  })
}
