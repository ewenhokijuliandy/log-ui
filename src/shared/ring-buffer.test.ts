import { describe, expect, test } from 'vitest'
import { LogRing } from './ring-buffer.ts'
import type { LogLevel, ParsedLine } from './types.ts'

function line(level: LogLevel, message: string): ParsedLine {
  return {
    raw: message,
    truncated: false,
    ts: null,
    level,
    message,
    json: null,
    ids: [],
  }
}

describe('ring buffer', () => {
  test('fresh ring reports null bounds', () => {
    const ring = new LogRing(4)
    expect(ring.lineCount).toBe(0)
    expect(ring.firstSeq).toBeNull()
    expect(ring.lastSeq).toBeNull()
    expect(ring.stats).toEqual({
      lineCount: 0,
      dropped: 0,
      levelCounts: expect.objectContaining({ info: 0 }),
    })
  })

  test('seq assignment is monotonic', () => {
    const ring = new LogRing(8)
    ring.push(line('info', 'a'))
    ring.push(line('warn', 'b'))
    const records = ring.all()
    expect(records.map((record) => record.seq)).toEqual([1, 2])
  })

  test('eviction keeps the newest capacity and counts drops', () => {
    const ring = new LogRing(4)
    for (let i = 1; i <= 7; i += 1) ring.push(line('info', `line-${String(i)}`))
    expect(ring.lineCount).toBe(4)
    expect(ring.stats.dropped).toBe(3)
    expect(ring.firstSeq).toBe(4)
    expect(ring.lastSeq).toBe(7)
    expect(ring.all().map((record) => record.message)).toEqual([
      'line-4',
      'line-5',
      'line-6',
      'line-7',
    ])
  })

  test('level counts track pushes and evictions', () => {
    const ring = new LogRing(3)
    ring.push(line('fatal', 'f'))
    ring.push(line('error', 'e1'))
    ring.push(line('error', 'e2'))
    ring.push(line('warn', 'w'))
    expect(ring.stats.levelCounts.error).toBe(2)
    expect(ring.stats.levelCounts.fatal).toBe(0)
    expect(ring.stats.levelCounts.warn).toBe(1)
  })

  test('sliceSince returns deltas and all-when-evicted', () => {
    const ring = new LogRing(3)
    ring.push(line('info', 'one'))
    ring.push(line('info', 'two'))
    ring.push(line('info', 'three'))

    expect(ring.sliceSince(null)).toEqual({ records: ring.all(), gap: false })
    expect(ring.sliceSince(2).records.map((record) => record.seq)).toEqual([3])
    expect(ring.sliceSince(2).gap).toBe(false)
    expect(ring.sliceSince(3)).toEqual({ records: [], gap: false })

    ring.push(line('info', 'four'))
    ring.push(line('info', 'five'))
    expect(ring.firstSeq).toBe(3)
    expect(ring.sliceSince(1)).toEqual({ records: ring.all(), gap: true })
  })

  test('empty ring never claims a gap', () => {
    const ring = new LogRing(3)
    expect(ring.sliceSince(0)).toEqual({ records: [], gap: false })
  })

  test('clear frees buffer without resetting sequence numbering', () => {
    const ring = new LogRing(4)
    ring.push(line('error', 'old'))
    ring.clear()
    expect(ring.stats.lineCount).toBe(0)
    expect(ring.stats.dropped).toBe(0)
    expect(ring.stats.levelCounts.error).toBe(0)
    const record = ring.push(line('info', 'new'))
    expect(record.seq).toBe(2)
  })

  test('sequence stays contiguous under heavy eviction', () => {
    const ring = new LogRing(64)
    for (let i = 0; i < 130; i += 1) ring.push(line('debug', `d${String(i)}`))
    const records = ring.all()
    expect(records).toHaveLength(64)
    const first = records[0]
    expect(first?.seq).toBe(67)
    for (let i = 1; i < records.length; i += 1) {
      expect(records[i]?.seq).toBe((records[i - 1]?.seq ?? 0) + 1)
    }
  })
})
