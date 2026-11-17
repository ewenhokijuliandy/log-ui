import { countLevels, emptyLevelCounts, type LevelCounts } from '../../shared/levels.ts'
import type { LogRecord, StreamMeta, StreamSnapshot, StreamStatus } from '../../shared/types.ts'
import { BUFFER_CAP } from '../lib/stream-merge.ts'

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

export function createEmptyEntry(meta: StreamMeta, kind: StreamKind): StreamEntry {
  return {
    id: meta.id,
    name: meta.name,
    kind,
    status: meta.status,
    createdAt: meta.createdAt,
    records: [],
    dropped: 0,
    lineCount: 0,
    levelCounts: emptyLevelCounts(),
    lastSeq: null,
    firstSeq: null,
    pausedAt: null,
  }
}

export function entryFromSnapshot(meta: StreamMeta, snapshot: StreamSnapshot): StreamEntry {
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
