import { create } from 'zustand'
import { BUFFER_CAP_DEFAULT, normalizeBufferCap } from '../../shared/buffer-cap.ts'
import type { LevelCounts } from '../../shared/levels.ts'
import { allocateStreamName, uniqueStreamName } from '../../shared/name-allocator.ts'
import { streamNameProblem } from '../../shared/stream-name.ts'
import type {
  LogLevel,
  LogRecord,
  StreamMeta,
  StreamSnapshot,
  StreamStatus,
} from '../../shared/types.ts'
import { hasGap } from '../lib/stream-merge.ts'
import { clearStreamBuffer, deleteStream, fetchJson, patchStreamName } from './api.ts'
import { loadTabOrder, saveTabOrder } from './prefs.ts'
import { entryFromSnapshot, type StreamEntry, trimEntryToCap } from './stream-entry.ts'
import {
  addStreamEntry,
  appendRecords,
  applyPaused,
  applySnapshot,
  applyStreamUpdate,
  clearRecords,
  createManualEntry,
  moveStreamOrder,
  orderByStoredIds,
  removeStreamEntry,
} from './stream-reducers.ts'
import { type ConnectionPhase, createStreamSocket, type ServerEvent } from './ws-client.ts'

export type { StreamEntry, StreamKind } from './stream-entry.ts'

export type RenameResult = { ok: true } | { ok: false; error: string }

type StreamUpdatePayload = {
  id: string
  status: StreamStatus
  name?: string
  lineCount?: number
  dropped?: number
  levelCounts?: LevelCounts
}

type StoreState = {
  streams: StreamEntry[]
  activeId: string | null
  manualCounter: number
  cleared: string[]
  connection: ConnectionPhase
  simulatedLost: boolean
  bootError: string | null
  lastError: string | null
  bufferCap: number
}

type StoreActions = {
  applyEvent: (event: ServerEvent) => void
  boot: () => Promise<void>
  resync: (id: string) => Promise<void>
  setActive: (id: string | null) => void
  setSimulatedLost: (value: boolean) => void
  setBufferCap: (value: number) => void
  moveTab: (dragId: string, overId: string, before: boolean) => void
  addManual: (records: LogRecord[], totalLines: number, preferredName?: string) => void
  setPaused: (id: string, paused: boolean) => void
  renameStream: (id: string, name: string) => Promise<RenameResult>
  closeStream: (id: string) => Promise<void>
  closeAllStreams: () => Promise<void>
  clearStream: (id: string) => Promise<void>
  setLastError: (message: string | null) => void
}

function handleStreamCreated(event: ServerEvent): void {
  const meta = event.meta as StreamMeta | null
  if (meta === null) return
  const current = useStreams.getState()
  const next = addStreamEntry(current.streams, meta)
  if (next !== null) {
    saveTabOrder(next.map((item) => item.id))
    useStreams.setState({ streams: next, activeId: current.activeId ?? meta.id })
  }
  void current.resync(meta.id)
}

function handleStreamUpdated(event: ServerEvent): void {
  const payload = event.payload as StreamUpdatePayload | null
  if (payload === null) return
  useStreams.setState((state) => ({
    streams: state.streams.map((item) =>
      item.id === payload.id ? applyStreamUpdate(item, payload) : item,
    ),
  }))
}

function handleStreamRemoved(event: ServerEvent): void {
  const id = event.id as string | null
  if (id === null) return
  useStreams.setState((state) => {
    const next = removeStreamEntry(state.streams, id)
    saveTabOrder(next.map((item) => item.id))
    const activeId = state.activeId === id ? (next[0]?.id ?? null) : state.activeId
    return { streams: next, activeId }
  })
}

function handleLogsAppended(event: ServerEvent): void {
  const streamId = event.streamId as string | null
  const records = event.records as LogRecord[] | null
  if (streamId === null || records === null) return
  const dropped = event.dropped as number | undefined
  const current = useStreams.getState().streams.find((item) => item.id === streamId)
  const gap = current !== undefined && hasGap(current.records, records)
  const cap = useStreams.getState().bufferCap
  useStreams.setState((state) => ({
    streams: state.streams.map((item) =>
      item.id === streamId ? appendRecords(item, records, dropped, cap) : item,
    ),
  }))
  if (gap) setTimeout(() => void useStreams.getState().resync(streamId), 0)
}

function handleLogsCleared(event: ServerEvent): void {
  const id = event.streamId as string | null
  if (id === null) return
  useStreams.setState((state) => ({
    cleared: [...state.cleared.filter((item) => item !== id), id],
    streams: state.streams.map((item) => (item.id === id ? clearRecords(item) : item)),
  }))
}

function handleSettingsUpdated(event: ServerEvent): void {
  const cap = normalizeBufferCap(event.bufferCap)
  if (cap === null) return
  useStreams.getState().setBufferCap(cap)
}

const EVENT_HANDLERS: Record<string, (event: ServerEvent) => void> = {
  'stream:created': handleStreamCreated,
  'stream:updated': handleStreamUpdated,
  'stream:removed': handleStreamRemoved,
  'logs:appended': handleLogsAppended,
  'logs:cleared': handleLogsCleared,
  'settings:updated': handleSettingsUpdated,
}

export const useStreams = create<StoreState & StoreActions>((set, get) => ({
  streams: [],
  activeId: null,
  manualCounter: 0,
  cleared: [],
  connection: 'connecting',
  simulatedLost: false,
  bootError: null,
  lastError: null,

  setLastError: (message) => set({ lastError: message }),
  bufferCap: BUFFER_CAP_DEFAULT,

  applyEvent: (event) => {
    EVENT_HANDLERS[event.type]?.(event)
  },

  setActive: (id) => set({ activeId: id }),

  setSimulatedLost: (value) => set({ simulatedLost: value }),

  setBufferCap: (value) => {
    const cap = normalizeBufferCap(value)
    if (cap === null) return
    set((state) => ({
      bufferCap: cap,
      streams: state.streams.map((entry) => trimEntryToCap(entry, cap)),
    }))
  },

  moveTab: (dragId, overId, before) => {
    const ordered = moveStreamOrder(
      get().streams.map((entry) => entry.id),
      dragId,
      overId,
      before,
    )
    if (ordered === null) return
    applyOrder(ordered)
  },

  addManual: (records, totalLines, preferredName) => {
    const existing = get().streams.map((entry) => entry.name)
    const name =
      preferredName === undefined
        ? allocateStreamName(existing, 'manual')
        : uniqueStreamName(existing, preferredName)
    const entry = createManualEntry(
      records,
      totalLines,
      {
        id: crypto.randomUUID(),
        name,
        status: 'stopped',
        createdAt: Date.now(),
      },
      get().bufferCap,
    )
    set((state) => {
      const next = [...state.streams, entry]
      saveTabOrder(next.map((item) => item.id))
      return { streams: next, activeId: entry.id, manualCounter: state.manualCounter + 1 }
    })
  },

  setPaused: (id, paused) => {
    set((state) => ({
      streams: state.streams.map((item) => (item.id === id ? applyPaused(item, paused) : item)),
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
    const outcome = await patchStreamName(id, name)
    if (!outcome.ok) return { ok: false, error: outcome.error }
    set((state) => ({
      streams: state.streams.map((item) =>
        item.id === id ? { ...item, name: outcome.name } : item,
      ),
    }))
    return { ok: true }
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
    const outcome = await deleteStream(id)
    if (!outcome.ok) set({ lastError: outcome.error })
  },

  closeAllStreams: async () => {
    const entries = get().streams
    if (entries.length === 0) return
    const manualIds = entries.filter((entry) => entry.kind === 'manual').map((entry) => entry.id)
    const pipeIds = entries.filter((entry) => entry.kind === 'pipe').map((entry) => entry.id)
    const results = await Promise.allSettled(pipeIds.map((id) => deleteStream(id)))
    const failed = pipeIds.filter((_, index) => {
      const result = results[index]
      if (result === undefined) return true
      if (result.status === 'rejected') return true
      return !result.value.ok
    })
    const closed = new Set([...manualIds, ...pipeIds.filter((id) => !failed.includes(id))])
    set((state) => {
      const next = state.streams.filter((entry) => !closed.has(entry.id))
      saveTabOrder(next.map((item) => item.id))
      return {
        streams: next,
        activeId: closed.has(state.activeId ?? '') ? (next[0]?.id ?? null) : state.activeId,
        cleared: state.cleared.filter((item) => !closed.has(item)),
        lastError: failed.length === 0 ? null : 'Could not close every stream.',
      }
    })
  },

  clearStream: async (id) => {
    const entry = get().streams.find((item) => item.id === id)
    if (entry === undefined) return
    if (entry.kind === 'manual') {
      set((state) => ({
        cleared: [...state.cleared.filter((item) => item !== id), id],
        streams: state.streams.map((item) => (item.id === id ? clearRecords(item) : item)),
      }))
      return
    }
    try {
      await clearStreamBuffer(id)
    } catch {
      set({ lastError: 'Could not clear this stream.' })
    }
  },

  boot: async () => {
    const meta = await fetchJson<StreamMeta[]>('/api/streams')
    if (meta === null) {
      set({ bootError: 'The logdeck daemon is unreachable on this port.' })
      return
    }
    const settings = await fetchJson<{ bufferCap?: unknown }>('/api/settings')
    const cap = normalizeBufferCap(settings?.bufferCap) ?? get().bufferCap
    const previous = new Map(get().streams.map((entry) => [entry.id, entry]))
    const entries: StreamEntry[] = []
    for (const item of meta) {
      const snapshot = await fetchJson<StreamSnapshot>(`/api/streams/${item.id}/logs`)
      if (snapshot === null) continue
      const existing = previous.get(item.id)
      entries.push({
        ...entryFromSnapshot(item, snapshot, cap),
        pausedAt: existing?.pausedAt ?? null,
      })
    }
    for (const entry of previous.values()) {
      if (entry.kind === 'manual') entries.push(trimEntryToCap(entry, cap))
    }
    const ordered = orderByStoredIds(entries, loadTabOrder() ?? [])
    const current = get().activeId
    set({
      streams: ordered,
      activeId: ordered.some((entry) => entry.id === current) ? current : (ordered[0]?.id ?? null),
      bootError: null,
      bufferCap: cap,
    })
  },

  resync: async (id) => {
    const entry = get().streams.find((item) => item.id === id)
    const since = entry?.lastSeq ?? null
    const query = since === null ? '' : `?since=${String(since)}`
    const snapshot = await fetchJson<StreamSnapshot>(`/api/streams/${id}/logs${query}`)
    if (snapshot === null) return
    set((state) => ({
      streams: state.streams.map((item) =>
        item.id === id ? applySnapshot(item, snapshot, state.bufferCap) : item,
      ),
    }))
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

let streamSocket: ReturnType<typeof createStreamSocket> | null = null
let hasConnectedOnce = false

function ensureSocket(): void {
  if (streamSocket !== null) return
  streamSocket = createStreamSocket(handleSocketEvent, (phase) => {
    useStreams.setState({ connection: phase })
    if (phase !== 'connected') return
    if (hasConnectedOnce || useStreams.getState().bootError !== null) {
      void useStreams.getState().boot()
    }
    hasConnectedOnce = true
  })
}

function handleSocketEvent(event: ServerEvent): void {
  useStreams.getState().applyEvent(event)
}

export function openSocket(): void {
  ensureSocket()
}

export function reconnectNow(): void {
  streamSocket?.reconnect()
}

export function levelCountTotal(counts: LevelCounts): number {
  let total = 0
  for (const key of Object.keys(counts) as LogLevel[]) total += counts[key]
  return total
}
