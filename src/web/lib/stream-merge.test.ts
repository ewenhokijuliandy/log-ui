import { describe, expect, test } from 'vitest'
import type { LogLevel, LogRecord } from '../../shared/types.ts'
import { hasGap, mergeRecords } from './stream-merge.ts'

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

describe('mergeRecords', () => {
  test('keeps every existing record when incoming is empty', () => {
    const existing = [record(1), record(2), record(3)]
    const merged = mergeRecords(existing, [], CAP)
    expect(merged.map((item) => item.seq)).toEqual([1, 2, 3])
    expect(merged).not.toBe(existing)
  })

  test('keeps the incoming copies when sequences overlap', () => {
    const existing = [record(1), record(2), record(3)]
    const incoming = [record(2, 'error'), record(3, 'warn'), record(4, 'debug')]
    const merged = mergeRecords(existing, incoming, CAP)
    expect(merged.map((item) => item.seq)).toEqual([1, 2, 3, 4])
    expect(merged[1]).toBe(incoming[0])
    expect(merged[2]).toBe(incoming[1])
  })

  test('trims to the buffer cap keeping the newest records', () => {
    const existing = Array.from({ length: CAP }, (_, index) => record(index + 1))
    const incoming = [record(CAP + 1), record(CAP + 2)]
    const merged = mergeRecords(existing, incoming, CAP)
    expect(merged).toHaveLength(CAP)
    expect(merged[0]?.seq).toBe(3)
    expect(merged[merged.length - 1]?.seq).toBe(CAP + 2)
  })
})

describe('hasGap', () => {
  test('reports no gap for empty inputs', () => {
    expect(hasGap([], [record(1)])).toBe(false)
    expect(hasGap([record(1)], [])).toBe(false)
  })

  test('reports no gap for contiguous sequences', () => {
    expect(hasGap([record(1), record(2)], [record(3)])).toBe(false)
  })

  test('reports a gap when incoming skips ahead', () => {
    expect(hasGap([record(1), record(2)], [record(5)])).toBe(true)
  })
})
