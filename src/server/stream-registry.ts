import { randomUUID } from 'node:crypto'
import type { LevelCounts } from '../shared/levels.ts'
import { allocateStreamName } from '../shared/name-allocator.ts'
import { parseLine } from '../shared/parse-line.ts'
import { LogRing } from '../shared/ring-buffer.ts'
import type { LogRecord, StreamMeta, StreamSnapshot, StreamStatus } from '../shared/types.ts'

export type WsLike = {
  close(code?: number, reason?: string): void
  terminate?(): void
  readyState?: number
}

export type StreamEntry = {
  id: string
  name: string
  status: StreamStatus
  createdAt: number
  token: string
  ring: LogRing
  ingestSocket: WsLike | null
}

export type StreamUpdatedPayload = {
  id: string
  status: StreamStatus
  name: string
  lineCount: number
  dropped: number
  levelCounts: LevelCounts
}

export type RegistryEvent =
  | { type: 'stream:created'; meta: StreamMeta }
  | { type: 'stream:updated'; payload: StreamUpdatedPayload }
  | { type: 'stream:removed'; id: string }
  | { type: 'logs:appended'; streamId: string; records: LogRecord[]; dropped: number }
  | { type: 'logs:cleared'; streamId: string }

export class StreamRegistry {
  private entries = new Map<string, StreamEntry>()
  private listeners = new Set<(event: RegistryEvent) => void>()

  subscribe(listener: (event: RegistryEvent) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private emit(event: RegistryEvent): void {
    for (const listener of [...this.listeners]) listener(event)
  }

  entry(id: string): StreamEntry | null {
    return this.entries.get(id) ?? null
  }

  meta(entry: StreamEntry): StreamMeta {
    return {
      id: entry.id,
      name: entry.name,
      status: entry.status,
      createdAt: entry.createdAt,
    }
  }

  list(): StreamMeta[] {
    return [...this.entries.values()].map((entry) => this.meta(entry))
  }

  activeCount(): number {
    let active = 0
    for (const entry of this.entries.values()) if (entry.status === 'active') active += 1
    return active
  }

  create(requestedName: string | null): StreamEntry {
    const clean = requestedName?.trim() ?? ''
    const taken = [...this.entries.values()].map((entry) => entry.name)
    const name = clean.length > 0 ? clean : allocateStreamName(taken)
    const entry: StreamEntry = {
      id: randomUUID(),
      name,
      status: 'active',
      createdAt: Date.now(),
      token: randomUUID().replace(/-/g, ''),
      ring: new LogRing(),
      ingestSocket: null,
    }
    this.entries.set(entry.id, entry)
    this.emit({ type: 'stream:created', meta: this.meta(entry) })
    return entry
  }

  ingest(id: string, lines: string[]): LogRecord[] | null {
    const entry = this.entries.get(id)
    if (entry === undefined) return null
    const records: LogRecord[] = []
    for (const text of lines) records.push(entry.ring.push(parseLine(text)))
    if (records.length === 0) return []
    this.emit({
      type: 'logs:appended',
      streamId: id,
      records,
      dropped: entry.ring.stats.dropped,
    })
    return records
  }

  setIngestSocket(id: string, socket: WsLike): void {
    const entry = this.entries.get(id)
    if (entry === undefined) return
    entry.ingestSocket = socket
  }

  closeIngest(id: string): void {
    const entry = this.entries.get(id)
    if (entry === undefined || entry.ingestSocket === null) return
    const socket = entry.ingestSocket
    entry.ingestSocket = null
    try {
      socket.close(1000, 'stream-closed')
    } catch {
      socket.close()
    }
  }

  stop(id: string): boolean {
    const entry = this.entries.get(id)
    if (entry === undefined) return false
    this.closeIngest(id)
    entry.status = 'stopped'
    this.emit({ type: 'stream:updated', payload: this.updated(entry) })
    return true
  }

  clearBuffer(id: string): boolean {
    const entry = this.entries.get(id)
    if (entry === undefined) return false
    entry.ring.clear()
    this.emit({ type: 'logs:cleared', streamId: id })
    return true
  }

  removeStream(id: string): boolean {
    const entry = this.entries.get(id)
    if (entry === undefined) return false
    this.closeIngest(id)
    this.entries.delete(id)
    this.emit({ type: 'stream:removed', id })
    return true
  }

  stopAll(): void {
    for (const entry of [...this.entries.keys()]) this.stop(entry)
  }

  closeAllIngest(): void {
    for (const entry of [...this.entries.keys()]) this.closeIngest(entry)
  }

  dispose(): void {
    this.closeAllIngest()
    this.entries.clear()
    this.listeners.clear()
  }

  snapshot(id: string, since: number | null): StreamSnapshot | null {
    const entry = this.entries.get(id)
    if (entry === undefined) return null
    const slice = entry.ring.sliceSince(since)
    const stats = entry.ring.stats
    return {
      records: slice.records,
      dropped: stats.dropped,
      firstSeq: entry.ring.firstSeq,
      lastSeq: entry.ring.lastSeq,
      gap: slice.gap,
      status: entry.status,
    }
  }

  private updated(entry: StreamEntry): StreamUpdatedPayload {
    const stats = entry.ring.stats
    return {
      id: entry.id,
      status: entry.status,
      name: entry.name,
      lineCount: stats.lineCount,
      dropped: stats.dropped,
      levelCounts: stats.levelCounts,
    }
  }
}
