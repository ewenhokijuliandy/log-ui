import { create } from 'zustand'
import type { LevelChipKey } from '../../shared/levels.ts'
import { EMPTY_LEVEL_COUNTS, type LevelCounts } from '../../shared/levels.ts'
import { allocateStreamName } from '../../shared/name-allocator.ts'
import { streamNameProblem } from '../../shared/stream-name.ts'
import type {
  LogLevel,
  LogRecord,
  StreamMeta,
  StreamSnapshot,
  StreamStatus,
} from '../../shared/types.ts'
import { loadTabOrder, saveTabOrder } from './prefs.ts'
import { type ConnectionPhase, createStreamSocket, type ServerEvent } from './ws-client.ts'

export const BUFFER_CAP = 10_000

export type StreamKind = 'pipe' | 'manual'

export type StreamEntry = {
  id: string
  name: string
  kind: StreamKind
  status: StreamStatus
  createdAt: number
  records: LogRecord[]
  dropped: number
  lineCount: number
  levelCounts: LevelCounts
  lastSeq: number | null
  firstSeq: number | null
  pausedAt: number | null
}

export type RenameResult = { ok: true } | { ok: false; error: string }

type StoreState = {
  streams: StreamEntry[]
  activeId: string | null
  manualCounter: number
  cleared: string[]
  connection: ConnectionPhase
  simulatedLost: boolean
  bootError: string | null
}

type StoreActions = {
  applyEvent: (event: ServerEvent) => void
  boot: () => Promise<void>
  resync: (id: string) => Promise<void>
  setActive: (id: string | null) => void
  setSimulatedLost: (value: boolean) => void
  moveTab: (dragId: string, overId: string, before: boolean) => void
  addManual: (records: LogRecord[], totalLines: number) => void
  setPaused: (id: string, paused: boolean) => void
  renameStream: (id: string, name: string) => Promise<RenameResult>
  closeStream: (id: string) => Promise<void>
  clearStream: (id: string) => Promise<void>
}

const joinPath = (path: string): string => `${window.location.origin}${path}`

async function fetchJson<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(joinPath(path), { signal: AbortSignal.timeout(4000) })
    if (!response.ok) return null
    return (await response.json()) as T
  } catch {
    return null
  }
}

function entryFromSnapshot(meta: StreamMeta, snapshot: StreamSnapshot): StreamEntry {
  const records = [...snapshot.records]
  if (records.length > BUFFER_CAP) records.splice(0, records.length - BUFFER_CAP)
  return {
    id: meta.id,
    name: meta.name,
    kind: 'pipe',
    status: snapshot.status,
    createdAt: meta.createdAt,
    records,
    dropped: snapshot.dropped,
    lineCount: records.length,
    levelCounts: countLevels(records),
    lastSeq: snapshot.lastSeq,
    firstSeq: records.length > 0 ? (records[0]?.seq ?? null) : null,
    pausedAt: null,
  }
}

function countLevels(records: readonly LogRecord[]): LevelCounts {
  const counts: LevelCounts = { ...EMPTY_LEVEL_COUNTS }
  for (const record of records) counts[record.level] += 1
  return counts
}

function orderEntries(entries: readonly StreamEntry[]): StreamEntry[] {
  const stored = loadTabOrder() ?? []
  const held = new Set(stored)
  const ordered: StreamEntry[] = []
  for (const id of stored) {
    const entry = entries.find((item) => item.id === id)
    if (entry !== undefined) ordered.push(entry)
  }
  for (const entry of entries) {
    if (held.has(entry.id)) continue
    ordered.push(entry)
  }
  return ordered
}

export const useStreams = create<StoreState & StoreActions>((set, get) => ({
  streams: [],
  activeId: null,
  manualCounter: 0,
  cleared: [],
  connection: 'connecting',
  simulatedLost: false,
  bootError: null,

  setActive: (id) => set({ activeId: id }),

  setSimulatedLost: (value) => set({ simulatedLost: value }),

  moveTab: (dragId, overId, before) => {
    const streams = get().streams
    if (dragId === overId) return
    const ordered = streams.map((entry) => entry.id)
    const from = ordered.indexOf(dragId)
    if (from === -1) return
    ordered.splice(from, 1)
    const to = ordered.indexOf(overId)
    if (to === -1) return
    ordered.splice(before ? to : to + 1, 0, dragId)
    applyOrder(ordered)
  },

  addManual: (records, totalLines) => {
    const existing = get().streams.map((entry) => entry.name)
    const name = allocateStreamName(existing, 'manual')
    const kept =
      records.length > BUFFER_CAP ? records.slice(records.length - BUFFER_CAP) : [...records]
    const dropped = Math.max(0, Math.max(totalLines, records.length) - kept.length)
    const entry: StreamEntry = {
      id: crypto.randomUUID(),
      name,
      kind: 'manual',
      status: 'stopped',
      createdAt: Date.now(),
      records: kept,
      dropped,
      lineCount: kept.length,
      levelCounts: countLevels(kept),
      lastSeq: kept.length > 0 ? (kept[kept.length - 1]?.seq ?? null) : null,
      firstSeq: kept[0]?.seq ?? null,
      pausedAt: null,
    }
    set((state) => {
      const next = [...state.streams, entry]
      saveTabOrder(next.map((item) => item.id))
      return { streams: next, activeId: entry.id, manualCounter: state.manualCounter + 1 }
    })
  },

  setPaused: (id, paused) => {
    set((state) => ({
      streams: state.streams.map((item) => {
        if (item.id !== id) return item
        if (!paused) return { ...item, pausedAt: null }
        if (item.pausedAt !== null) return item
        const newest = item.lastSeq ?? item.records[item.records.length - 1]?.seq ?? 0
        return { ...item, pausedAt: newest }
      }),
    }))
  },

  renameStream: async (id, requestedName) => {
    const entry = get().streams.find((item) => item.id === id)
    if (entry === undefined) return { ok: false, error: 'Stream not found.' }
    const name = requestedName.trim()
    const taken = get()
      .streams.filter((item) => item.id !== id)
      .map((item) => item.name)
    const problem = streamNameProblem(name, taken)
    if (problem !== null) return { ok: false, error: problem.message }
    if (entry.kind === 'manual') {
      set((state) => ({
        streams: state.streams.map((item) => (item.id === id ? { ...item, name } : item)),
      }))
      return { ok: true }
    }
    try {
      const response = await fetch(joinPath(`/api/streams/${id}`), {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name }),
        signal: AbortSignal.timeout(4000),
      })
      if (!response.ok) {
        const raw = await response.text()
        let error = 'Could not rename this stream.'
        try {
          const parsed = JSON.parse(raw) as { error?: unknown }
          if (typeof parsed.error === 'string') error = parsed.error
        } catch {}
        return { ok: false, error }
      }
      const meta = (await response.json()) as StreamMeta
      set((state) => ({
        streams: state.streams.map((item) =>
          item.id === id ? { ...item, name: meta.name } : item,
        ),
      }))
      return { ok: true }
    } catch {
      return { ok: false, error: 'Could not rename this stream.' }
    }
  },

  closeStream: async (id) => {
    const entry = get().streams.find((item) => item.id === id)
    if (entry === undefined) return
    if (entry.kind === 'manual') {
      set((state) => {
        const next = state.streams.filter((item) => item.id !== id)
        saveTabOrder(next.map((item) => item.id))
        return {
          streams: next,
          activeId: state.activeId === id ? (next[0]?.id ?? null) : state.activeId,
          cleared: state.cleared.filter((item) => item !== id),
        }
      })
      return
    }
    try {
      await fetch(joinPath(`/api/streams/${id}`), { method: 'DELETE' })
    } catch {}
  },

  clearStream: async (id) => {
    const entry = get().streams.find((item) => item.id === id)
    if (entry === undefined) return
    if (entry.kind === 'manual') {
      set((state) => ({
        cleared: [...state.cleared.filter((item) => item !== id), id],
        streams: state.streams.map((item) => {
          if (item.id !== id) return item
          return {
            ...item,
            records: [],
            dropped: 0,
            lineCount: 0,
            levelCounts: { ...EMPTY_LEVEL_COUNTS },
            pausedAt: null,
          }
        }),
      }))
      return
    }
    try {
      await fetch(joinPath(`/api/streams/${id}/clear`), { method: 'POST' })
    } catch {}
  },

  boot: async () => {
    const meta = await fetchJson<StreamMeta[]>('/api/streams')
    if (meta === null) {
      set({ bootError: 'The log-ui daemon is unreachable on this port.' })
      return
    }
    const entries: StreamEntry[] = []
    for (const item of meta) {
      const snapshot = await fetchJson<StreamSnapshot>(`/api/streams/${item.id}/logs`)
      if (snapshot === null) continue
      entries.push(entryFromSnapshot(item, snapshot))
    }
    const ordered = orderEntries(entries)
    set({
      streams: ordered,
      activeId: ordered[0]?.id ?? null,
      bootError: null,
    })
  },

  resync: async (id) => {
    const entry = get().streams.find((item) => item.id === id)
    const since = entry?.lastSeq ?? null
    const query = since === null ? '' : `?since=${String(since)}`
    const snapshot = await fetchJson<StreamSnapshot>(`/api/streams/${id}/logs${query}`)
    if (snapshot === null) return
    set((state) => ({
      streams: state.streams.map((item) => {
        if (item.id !== id) return item
        if (snapshot.gap) {
          return {
            ...item,
            records: [...snapshot.records],
            dropped: snapshot.dropped,
            lineCount: snapshot.records.length,
            levelCounts: countLevels(snapshot.records),
            lastSeq: snapshot.lastSeq,
            firstSeq: snapshot.records[0]?.seq ?? null,
          }
        }
        const merged = mergeRecords(item.records, snapshot.records)
        return {
          ...item,
          records: merged,
          dropped: snapshot.dropped,
          lineCount: merged.length,
          levelCounts: countLevels(merged),
          lastSeq: snapshot.lastSeq ?? item.lastSeq,
          firstSeq: merged[0]?.seq ?? null,
        }
      }),
    }))
  },

  applyEvent: (event) => {
    switch (event.type) {
      case 'stream:created': {
        const meta = event.meta as StreamMeta | null
        if (meta === null) return
        set((state) => {
          if (state.streams.some((item) => item.id === meta.id)) return state
          const entry: StreamEntry = {
            id: meta.id,
            name: meta.name,
            kind: 'pipe',
            status: meta.status,
            createdAt: meta.createdAt,
            records: [],
            dropped: 0,
            lineCount: 0,
            levelCounts: { ...EMPTY_LEVEL_COUNTS },
            lastSeq: null,
            firstSeq: null,
            pausedAt: null,
          }
          const next = [...state.streams, entry]
          saveTabOrder(next.map((item) => item.id))
          return { streams: next, activeId: state.activeId ?? entry.id }
        })
        void get().resync(meta.id)
        return
      }
      case 'stream:updated': {
        const payload = event.payload as {
          id: string
          status: StreamStatus
          name?: string
          lineCount?: number
          dropped?: number
          levelCounts?: LevelCounts
        } | null
        if (payload === null) return
        set((state) => ({
          streams: state.streams.map((item) => {
            if (item.id !== payload.id) return item
            return {
              ...item,
              status: payload.status,
              name: payload.name ?? item.name,
              lineCount: payload.lineCount ?? item.lineCount,
              dropped: payload.dropped ?? item.dropped,
              levelCounts: payload.levelCounts ?? item.levelCounts,
              lastSeq: payload.status === 'stopped' ? item.lastSeq : item.lastSeq,
            }
          }),
        }))
        return
      }
      case 'stream:removed': {
        const id = event.id as string | null
        if (id === null) return
        set((state) => {
          const next = state.streams.filter((item) => item.id !== id)
          saveTabOrder(next.map((item) => item.id))
          const activeId = state.activeId === id ? (next[0]?.id ?? null) : state.activeId
          return { streams: next, activeId }
        })
        return
      }
      case 'logs:appended': {
        const streamId = event.streamId as string | null
        const records = event.records as LogRecord[] | null
        if (streamId === null || records === null) return
        set((state) => ({
          streams: state.streams.map((item) => {
            if (item.id !== streamId) return item
            const merged = mergeRecords(item.records, records)
            if (hasGap(item.records, records)) setTimeout(() => void get().resync(streamId), 0)
            return {
              ...item,
              records: merged,
              dropped: (event.dropped as number | undefined) ?? item.dropped,
              lineCount: merged.length,
              levelCounts: countLevels(merged),
              lastSeq: merged[merged.length - 1]?.seq ?? item.lastSeq,
              firstSeq: merged[0]?.seq ?? null,
            }
          }),
        }))
        return
      }
      case 'logs:cleared': {
        const id = event.streamId as string | null
        if (id === null) return
        set((state) => ({
          cleared: [...state.cleared.filter((item) => item !== id), id],
          streams: state.streams.map((item) => {
            if (item.id !== id) return item
            return {
              ...item,
              records: [],
              dropped: 0,
              lineCount: 0,
              levelCounts: { ...EMPTY_LEVEL_COUNTS },
              firstSeq: item.firstSeq,
              lastSeq: item.lastSeq,
              pausedAt: null,
            }
          }),
        }))
        return
      }
      default:
        return
    }
  },
}))

function applyOrder(orderedIds: readonly string[]): void {
  const map = new Map(useStreams.getState().streams.map((entry) => [entry.id, entry]))
  const next = orderedIds
    .map((id) => map.get(id))
    .filter((entry) => entry !== undefined) as StreamEntry[]
  saveTabOrder(orderedIds)
  useStreams.setState({ streams: next })
}

function hasGap(existing: readonly LogRecord[], incoming: readonly LogRecord[]): boolean {
  if (existing.length === 0 || incoming.length === 0) return false
  const lastExisting = existing[existing.length - 1]?.seq ?? null
  const firstIncoming = incoming[0]?.seq ?? null
  if (lastExisting === null || firstIncoming === null) return false
  return firstIncoming > lastExisting + 1
}

function mergeRecords(existing: readonly LogRecord[], incoming: readonly LogRecord[]): LogRecord[] {
  const deduped = existing.filter((record) => {
    const firstIncoming = incoming.length > 0 ? (incoming[0]?.seq ?? 0) : 0
    return record.seq < firstIncoming
  })
  const merged = [...deduped, ...incoming]
  if (merged.length > BUFFER_CAP) merged.splice(0, merged.length - BUFFER_CAP)
  return merged
}

type SocketHolder = { socket: ReturnType<typeof createStreamSocket> | null }

const holder: SocketHolder = { socket: null }

function ensureSocket(): void {
  if (holder.socket !== null) return
  holder.socket = createStreamSocket(handleSocketEvent, (phase) => {
    useStreams.setState({ connection: phase })
  })
}

function handleSocketEvent(event: ServerEvent): void {
  useStreams.getState().applyEvent(event)
}

export function openSocket(): void {
  ensureSocket()
}

export function levelCountTotal(counts: LevelCounts): number {
  let total = 0
  for (const key of Object.keys(counts) as LogLevel[]) total += counts[key]
  return total
}

export function chipCount(counts: LevelCounts, chip: Exclude<LevelChipKey, 'all'>): number {
  const PER_CHIP: Record<Exclude<LevelChipKey, 'all'>, readonly LogLevel[]> = {
    error: ['fatal', 'error'],
    warn: ['warn'],
    info: ['info'],
    debug: ['debug', 'trace'],
  }
  let total = 0
  for (const level of PER_CHIP[chip]) total += counts[level]
  return total
}
