import { countLevels, emptyLevelCounts, type LevelCounts } from '../../shared/levels.ts'
import type { LogRecord, StreamMeta, StreamSnapshot, StreamStatus } from '../../shared/types.ts'
import { BUFFER_CAP, mergeRecords } from '../lib/stream-merge.ts'
import { createEmptyEntry, type StreamEntry } from './stream-entry.ts'

export type StreamUpdate = {
  status: StreamStatus
  name?: string
  lineCount?: number
  dropped?: number
  levelCounts?: LevelCounts
}

export function appendRecords(
  entry: StreamEntry,
  records: readonly LogRecord[],
  dropped?: number,
): StreamEntry {
  const merged = mergeRecords(entry.records, records)
  return {
    ...entry,
    records: merged,
    dropped: dropped ?? entry.dropped,
    lineCount: merged.length,
    levelCounts: countLevels(merged),
    lastSeq: merged[merged.length - 1]?.seq ?? entry.lastSeq,
    firstSeq: merged[0]?.seq ?? null,
  }
}

export function applyStreamUpdate(entry: StreamEntry, update: StreamUpdate): StreamEntry {
  return {
    ...entry,
    status: update.status,
    name: update.name ?? entry.name,
    lineCount: update.lineCount ?? entry.lineCount,
    dropped: update.dropped ?? entry.dropped,
    levelCounts: update.levelCounts ?? entry.levelCounts,
  }
}

export function clearRecords(entry: StreamEntry): StreamEntry {
  return {
    ...entry,
    records: [],
    dropped: 0,
    lineCount: 0,
    levelCounts: emptyLevelCounts(),
    pausedAt: null,
  }
}

export function addStreamEntry(
  streams: readonly StreamEntry[],
  meta: StreamMeta,
): StreamEntry[] | null {
  if (streams.some((item) => item.id === meta.id)) return null
  return [...streams, createEmptyEntry(meta, 'pipe')]
}

export function removeStreamEntry(streams: readonly StreamEntry[], id: string): StreamEntry[] {
  return streams.filter((item) => item.id !== id)
}

export function applySnapshot(entry: StreamEntry, snapshot: StreamSnapshot): StreamEntry {
  if (snapshot.gap) {
    return {
      ...entry,
      records: [...snapshot.records],
      dropped: snapshot.dropped,
      lineCount: snapshot.records.length,
      levelCounts: countLevels(snapshot.records),
      lastSeq: snapshot.lastSeq,
      firstSeq: snapshot.records[0]?.seq ?? null,
    }
  }
  const merged = mergeRecords(entry.records, snapshot.records)
  return {
    ...entry,
    records: merged,
    dropped: snapshot.dropped,
    lineCount: merged.length,
    levelCounts: countLevels(merged),
    lastSeq: snapshot.lastSeq ?? entry.lastSeq,
    firstSeq: merged[0]?.seq ?? null,
  }
}

export function createManualEntry(
  records: readonly LogRecord[],
  totalLines: number,
  meta: StreamMeta,
): StreamEntry {
  const kept =
    records.length > BUFFER_CAP ? records.slice(records.length - BUFFER_CAP) : [...records]
  const dropped = Math.max(0, Math.max(totalLines, records.length) - kept.length)
  return {
    ...createEmptyEntry(meta, 'manual'),
    records: kept,
    dropped,
    lineCount: kept.length,
    levelCounts: countLevels(kept),
    lastSeq: kept.length > 0 ? (kept[kept.length - 1]?.seq ?? null) : null,
    firstSeq: kept[0]?.seq ?? null,
  }
}

export function applyPaused(entry: StreamEntry, paused: boolean): StreamEntry {
  if (!paused) return { ...entry, pausedAt: null }
  if (entry.pausedAt !== null) return entry
  const newest = entry.lastSeq ?? entry.records[entry.records.length - 1]?.seq ?? 0
  return { ...entry, pausedAt: newest }
}

export function orderByStoredIds(
  entries: readonly StreamEntry[],
  storedIds: readonly string[],
): StreamEntry[] {
  const held = new Set(storedIds)
  const ordered: StreamEntry[] = []
  for (const id of storedIds) {
    const entry = entries.find((item) => item.id === id)
    if (entry !== undefined) ordered.push(entry)
  }
  for (const entry of entries) {
    if (held.has(entry.id)) continue
    ordered.push(entry)
  }
  return ordered
}

export function moveStreamOrder(
  ids: readonly string[],
  dragId: string,
  overId: string,
  before: boolean,
): string[] | null {
  if (dragId === overId) return null
  const ordered = [...ids]
  const from = ordered.indexOf(dragId)
  if (from === -1) return null
  ordered.splice(from, 1)
  const targetIndex = ordered.indexOf(overId)
  if (targetIndex === -1) return null
  ordered.splice(before ? targetIndex : targetIndex + 1, 0, dragId)
  return ordered
}
