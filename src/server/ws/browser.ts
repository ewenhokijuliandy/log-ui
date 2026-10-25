import type { LogRecord } from '../../shared/types.ts'

export type BrowserSocket = {
  send(data: string): void
  close(code?: number, reason?: string): void
  readyState: number
}

const OPEN_STATE = 1
const COALESCE_MS = 50
const BROWSER_RECENT_MS = 30_000

export class BroadcastHub {
  private sockets = new Set<BrowserSocket>()
  private pending = new Map<string, { records: LogRecord[]; dropped: number }>()
  private timer: ReturnType<typeof setTimeout> | null = null
  private lastClientAt = 0

  register(socket: BrowserSocket): void {
    this.sockets.add(socket)
    this.lastClientAt = Date.now()
  }

  unregister(socket: BrowserSocket): void {
    this.sockets.delete(socket)
    this.lastClientAt = Date.now()
  }

  clientCount(): number {
    return this.sockets.size
  }

  browserEligible(): boolean {
    if (this.clientCount() !== 0) return false
    return Date.now() - this.lastClientAt > BROWSER_RECENT_MS
  }

  append(streamId: string, records: LogRecord[], dropped: number): void {
    const slot = this.pending.get(streamId) ?? { records: [] as LogRecord[], dropped: 0 }
    for (const record of records) slot.records.push(record)
    slot.dropped = dropped
    this.pending.set(streamId, slot)
    this.schedule()
  }

  flush(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer)
      this.timer = null
    }
    for (const [streamId, slot] of this.pending) {
      this.broadcast({
        type: 'logs:appended',
        streamId,
        records: slot.records,
        dropped: slot.dropped,
      })
    }
    this.pending.clear()
  }

  broadcast(event: unknown): void {
    if (this.sockets.size === 0) return
    const text = JSON.stringify(event)
    for (const socket of this.sockets) {
      if (socket.readyState !== OPEN_STATE) continue
      try {
        socket.send(text)
      } catch {
        this.sockets.delete(socket)
      }
    }
  }

  closeAll(): void {
    for (const socket of this.sockets) {
      try {
        socket.close(1000, 'server-shutdown')
      } catch {
        socket.close()
      }
    }
    this.sockets.clear()
  }

  dispose(): void {
    this.flush()
    this.sockets.clear()
  }

  private schedule(): void {
    if (this.timer !== null) return
    this.timer = setTimeout(() => {
      this.timer = null
      this.flush()
    }, COALESCE_MS)
  }
}
