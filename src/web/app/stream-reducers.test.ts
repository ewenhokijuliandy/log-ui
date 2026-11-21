import { describe, expect, test } from 'vitest'
import type {
  LogLevel,
  LogRecord,
  StreamMeta,
  StreamSnapshot,
  StreamStatus,
} from '../../shared/types.ts'
import { createEmptyEntry, type StreamEntry } from './stream-entry.ts'
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

const CAP = 10_000

function record(seq: number, level: LogLevel = 'info'): LogRecord {
  return {
    raw: `line ${seq}`,
    truncated: false,
    ts: null,
    level,
    message: `line ${seq}`,
    json: null,
    ids: [],
    seq,
  }
}

function meta(id: string, status: StreamStatus = 'active'): StreamMeta {
  return { id, name: id, status, createdAt: 1 }
}

function snapshot(records: LogRecord[], gap = false): StreamSnapshot {
  return {
    records,
    dropped: 0,
    firstSeq: records[0]?.seq ?? null,
    lastSeq: records.length > 0 ? (records[records.length - 1]?.seq ?? null) : null,
    gap,
    status: 'active',
  }
}

function entry(id: string, records: LogRecord[] = []): StreamEntry {
  const base = createEmptyEntry(meta(id), 'pipe')
  return {
    ...base,
    records,
    lineCount: records.length,
    lastSeq: records.length > 0 ? (records[records.length - 1]?.seq ?? null) : null,
    firstSeq: records[0]?.seq ?? null,
  }
}

describe('appendRecords', () => {
  test('appends new records and recomputes derived fields', () => {
    const start = entry('a', [record(1, 'info'), record(2, 'warn')])
    const next = appendRecords(start, [record(3, 'error')], undefined, CAP)
    expect(next.records.map((item) => item.seq)).toEqual([1, 2, 3])
    expect(next.lineCount).toBe(3)
    expect(next.levelCounts.error).toBe(1)
    expect(next.levelCounts.warn).toBe(1)
    expect(next.lastSeq).toBe(3)
    expect(next.firstSeq).toBe(1)
    expect(start.records).toHaveLength(2)
  })

  test('uses the provided dropped count when present', () => {
    const start = entry('a', [record(1)])
    start.dropped = 5
    expect(appendRecords(start, [record(2)], 9, CAP).dropped).toBe(9)
    expect(appendRecords(start, [record(2)], undefined, CAP).dropped).toBe(5)
  })

  test('keeps the previous lastSeq when the merged buffer is empty', () => {
    const start = entry('a', [])
    start.lastSeq = 42
    const next = appendRecords(start, [], undefined, CAP)
    expect(next.records).toEqual([])
    expect(next.lastSeq).toBe(42)
    expect(next.firstSeq).toBeNull()
  })
})

describe('applyStreamUpdate', () => {
  test('applies provided fields and keeps the rest', () => {
    const start = entry('a', [record(1)])
    start.name = 'old'
    const next = applyStreamUpdate(start, {
      status: 'stopped',
      name: 'new',
      lineCount: 7,
      dropped: 3,
      levelCounts: { ...start.levelCounts, error: 2 },
    })
    expect(next.status).toBe('stopped')
    expect(next.name).toBe('new')
    expect(next.lineCount).toBe(7)
    expect(next.dropped).toBe(3)
    expect(next.levelCounts.error).toBe(2)
    expect(next.records).toBe(start.records)
  })

  test('falls back to existing values for omitted fields', () => {
    const start = entry('a', [record(1)])
    start.name = 'keep'
    start.lineCount = 4
    const next = applyStreamUpdate(start, { status: 'stopped' })
    expect(next.status).toBe('stopped')
    expect(next.name).toBe('keep')
    expect(next.lineCount).toBe(4)
  })
})

describe('clearRecords', () => {
  test('empties the buffer but keeps the sequence bounds', () => {
    const start = entry('a', [record(1), record(2), record(3)])
    start.dropped = 8
    start.pausedAt = 2
    const next = clearRecords(start)
    expect(next.records).toEqual([])
    expect(next.lineCount).toBe(0)
    expect(next.dropped).toBe(0)
    expect(next.levelCounts.info).toBe(0)
    expect(next.firstSeq).toBe(start.firstSeq)
    expect(next.lastSeq).toBe(start.lastSeq)
    expect(next.pausedAt).toBeNull()
  })
})

describe('addStreamEntry', () => {
  test('appends a fresh empty entry for a new stream', () => {
    const next = addStreamEntry([], meta('s1'))
    expect(next).toHaveLength(1)
    expect(next?.[0]).toMatchObject({ id: 's1', kind: 'pipe', records: [], lastSeq: null })
  })

  test('returns null when the stream already exists', () => {
    expect(addStreamEntry([entry('s1')], meta('s1'))).toBeNull()
  })
})

describe('removeStreamEntry', () => {
  test('removes only the matching stream', () => {
    const streams = [entry('a'), entry('b'), entry('c')]
    expect(removeStreamEntry(streams, 'b').map((item) => item.id)).toEqual(['a', 'c'])
  })

  test('returns a new array even when nothing matches', () => {
    const streams = [entry('a')]
    const next = removeStreamEntry(streams, 'z')
    expect(next).toEqual(streams)
    expect(next).not.toBe(streams)
  })
})

describe('moveStreamOrder', () => {
  test('moves a tab before the target', () => {
    expect(moveStreamOrder(['a', 'b', 'c'], 'c', 'a', true)).toEqual(['c', 'a', 'b'])
  })

  test('moves a tab after the target', () => {
    expect(moveStreamOrder(['a', 'b', 'c'], 'a', 'c', false)).toEqual(['b', 'c', 'a'])
  })

  test('ignores a drag onto itself', () => {
    expect(moveStreamOrder(['a', 'b'], 'a', 'a', true)).toBeNull()
  })

  test('ignores unknown ids', () => {
    expect(moveStreamOrder(['a', 'b'], 'x', 'a', true)).toBeNull()
    expect(moveStreamOrder(['a', 'b'], 'a', 'y', true)).toBeNull()
  })
})

describe('applySnapshot', () => {
  test('replaces the buffer when the snapshot reports a gap', () => {
    const start = entry('a', [record(1), record(2)])
    const next = applySnapshot(start, snapshot([record(9), record(10)], true), CAP)
    expect(next.records.map((item) => item.seq)).toEqual([9, 10])
    expect(next.firstSeq).toBe(9)
    expect(next.lastSeq).toBe(10)
    expect(next.lineCount).toBe(2)
  })

  test('merges without a gap and keeps a null lastSeq from the old entry', () => {
    const start = entry('a', [record(1)])
    const noSeq = { ...snapshot([record(2)]), lastSeq: null }
    const next = applySnapshot(start, noSeq, CAP)
    expect(next.records.map((item) => item.seq)).toEqual([1, 2])
    expect(next.lastSeq).toBe(1)
  })

  test('keeps every record when a resync returns no new lines', () => {
    const start = entry('a', [record(1), record(2)])
    const next = applySnapshot(start, snapshot([]), CAP)
    expect(next.records.map((item) => item.seq)).toEqual([1, 2])
    expect(next.lineCount).toBe(2)
  })
})

describe('createManualEntry', () => {
  test('builds a stopped manual entry with trimmed records', () => {
    const created = createManualEntry(
      [record(1), record(2)],
      5,
      {
        id: 'm1',
        name: 'manual 1',
        status: 'stopped',
        createdAt: 1,
      },
      CAP,
    )
    expect(created).toMatchObject({
      id: 'm1',
      kind: 'manual',
      lineCount: 2,
      firstSeq: 1,
      lastSeq: 2,
    })
    expect(created.dropped).toBe(3)
  })

  test('keeps only the newest records beyond the cap', () => {
    const many = Array.from({ length: 10 }, (_, index) => record(index + 1))
    const created = createManualEntry(
      many,
      10,
      {
        id: 'm1',
        name: 'manual 1',
        status: 'stopped',
        createdAt: 1,
      },
      CAP,
    )
    expect(created.records).toHaveLength(10)
    expect(created.lineCount).toBe(10)
    expect(created.dropped).toBe(0)
  })
})

describe('applyPaused', () => {
  test('clears the pause boundary when unpausing', () => {
    const start = entry('a', [record(1)])
    start.pausedAt = 1
    expect(applyPaused(start, false).pausedAt).toBeNull()
  })

  test('does not move an existing pause boundary', () => {
    const start = entry('a', [record(1), record(2)])
    start.pausedAt = 1
    expect(applyPaused(start, true)).toBe(start)
  })

  test('freezes at the newest sequence when pausing', () => {
    const start = entry('a', [record(1), record(2)])
    expect(applyPaused(start, true).pausedAt).toBe(2)
  })

  test('falls back to the last record sequence', () => {
    const start = entry('a', [record(4)])
    start.lastSeq = null
    expect(applyPaused(start, true).pausedAt).toBe(4)
  })
})

describe('orderByStoredIds', () => {
  test('honours the stored order and appends the rest', () => {
    const streams = [entry('a'), entry('b'), entry('c')]
    expect(orderByStoredIds(streams, ['c', 'a']).map((item) => item.id)).toEqual(['c', 'a', 'b'])
  })

  test('ignores stored ids that no longer exist', () => {
    const streams = [entry('a')]
    expect(orderByStoredIds(streams, ['gone', 'a']).map((item) => item.id)).toEqual(['a'])
  })
})
