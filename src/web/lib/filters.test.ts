import { describe, expect, test } from 'vitest'
import type { LogRecord } from '../../shared/types.ts'
import {
  DEFAULT_FILTER,
  filterError,
  filtersActive,
  MAX_PATTERN_LENGTH,
  parseDateTimeInput,
  rangeError,
  rangeWindow,
  toDateTimeInput,
  visibleRecords,
} from './filters.ts'

function record(seq: number, overrides: Partial<LogRecord> = {}): LogRecord {
  return {
    seq,
    raw: `raw ${String(seq)}`,
    truncated: false,
    ts: 1_700_000_000_000 + seq * 1_000,
    level: 'info',
    message: `line ${String(seq)}`,
    json: null,
    ids: [],
    ...overrides,
  }
}

function bulk(count: number): LogRecord[] {
  const base = Date.now()
  const records: LogRecord[] = []
  for (let index = 0; index < count; index += 1) {
    const level =
      index % 97 === 0 ? 'error' : index % 13 === 0 ? 'warn' : index % 3 === 0 ? 'debug' : 'info'
    records.push({
      seq: index + 1,
      raw: `request ${String(index)} trace=5b8e1f0c9a2d4e7f8b1c3d5e7a9f0b2d`,
      truncated: false,
      ts: base - (count - index) * 200,
      level,
      message:
        index % 5 === 0
          ? `checkout completed order=${String(index)} id=5b8e1f0c9a2d4e7f8b1c3d5e7a9f0b2d`
          : `catalog fetched item=${String(index)}`,
      json:
        index % 11 === 0
          ? { msg: 'checkout', request_id: `req-${String(index)}`, nested: { ok: true } }
          : null,
      ids: index % 17 === 0 ? ['5b8e1f0c9a2d4e7f8b1c3d5e7a9f0b2d'] : [],
    })
  }
  return records
}

describe('search', () => {
  test('plain search is case-insensitive across message, level, ids and json', () => {
    const records = [
      record(1, { message: 'GET /v1/Catalog' }),
      record(2, { level: 'error', message: 'boom' }),
      record(3, { ids: ['abc123def'] }),
      record(4, { message: 'payload', json: { order: 'ord_8841' } }),
    ]
    const filter = { ...DEFAULT_FILTER, query: 'catalog' }
    expect(visibleRecords(records, filter, null).map((item) => item.seq)).toEqual([1])
    expect(
      visibleRecords(records, { ...filter, query: 'ERROR' }, null).map((item) => item.seq),
    ).toEqual([2])
    expect(
      visibleRecords(records, { ...filter, query: 'abc123' }, null).map((item) => item.seq),
    ).toEqual([3])
    expect(
      visibleRecords(records, { ...filter, query: 'ord_8841' }, null).map((item) => item.seq),
    ).toEqual([4])
  })

  test('regex search matches and invalid patterns hide every row with an inline error', () => {
    const records = [
      record(1, { message: 'checkout completed' }),
      record(2, { message: 'catalog' }),
    ]
    const filter = { ...DEFAULT_FILTER, query: 'checkout|latency', regexMode: true }
    expect(visibleRecords(records, filter, null).map((item) => item.seq)).toEqual([1])

    const broken = { ...DEFAULT_FILTER, query: '(', regexMode: true }
    expect(filterError(broken)).toBe('Invalid regular expression')
    expect(visibleRecords(records, broken, null)).toEqual([])
  })

  test('rejects patterns over the 1k cap', () => {
    const query = 'a'.repeat(MAX_PATTERN_LENGTH + 1)
    const filter = { ...DEFAULT_FILTER, query }
    expect(filterError(filter)).toBe('Search is limited to 1,000 characters')
    expect(visibleRecords([record(1)], filter, null)).toEqual([])
    expect(filterError({ ...filter, query: 'a'.repeat(MAX_PATTERN_LENGTH) })).toBeNull()
  })
})

describe('level chips', () => {
  test('error merges fatal, debug merges trace, unknown stays visible', () => {
    const records = [
      record(1, { level: 'fatal' }),
      record(2, { level: 'error' }),
      record(3, { level: 'warn' }),
      record(4, { level: 'debug' }),
      record(5, { level: 'trace' }),
      record(6, { level: 'unknown' }),
    ]
    expect(
      visibleRecords(records, { ...DEFAULT_FILTER, chip: 'error' }, null).map((item) => item.seq),
    ).toEqual([1, 2, 6])
    expect(
      visibleRecords(records, { ...DEFAULT_FILTER, chip: 'debug' }, null).map((item) => item.seq),
    ).toEqual([4, 5, 6])
  })
})

describe('time ranges', () => {
  test('relative ranges measure from the newest buffered line and hide rows without timestamps', () => {
    const newest = 1_700_000_000_000
    const records = [
      record(1, { ts: newest - 600_000 }),
      record(2, { ts: newest - 120_000 }),
      record(3, { ts: newest }),
      record(4, { ts: null }),
    ]
    const filter = { ...DEFAULT_FILTER, range: '5m' as const }
    expect(visibleRecords(records, filter, null).map((item) => item.seq)).toEqual([2, 3])
    expect(visibleRecords(records, DEFAULT_FILTER, null)).toHaveLength(4)
  })

  test('custom ranges are inclusive and validate start against end', () => {
    const records = [record(1), record(2), record(3)]
    const from = records[0]?.ts ?? 0
    const to = records[1]?.ts ?? 0
    const filter = { ...DEFAULT_FILTER, range: 'custom' as const, from, to }
    expect(visibleRecords(records, filter, null).map((item) => item.seq)).toEqual([1, 2])
    expect(rangeWindow(filter, 0)).toEqual({ floor: from, ceiling: to })
    expect(rangeError(filter)).toBeNull()

    const reversed = { ...filter, from: to, to: from }
    expect(rangeError(reversed)).toBe('Start must be before end')
    expect(rangeWindow(reversed, 0)).toBeNull()
    expect(rangeError({ ...DEFAULT_FILTER, range: 'custom' })).toBe('Choose a start and end time')
    expect(
      visibleRecords([record(1, { ts: null })], { ...DEFAULT_FILTER, range: 'custom' }, null),
    ).toEqual([])
  })

  test('datetime inputs roundtrip epoch stamps through the local clock', () => {
    const stamp = new Date(2026, 9, 22, 14, 36, 12).getTime()
    expect(parseDateTimeInput(toDateTimeInput(stamp))).toBe(stamp)
    expect(toDateTimeInput(null)).toBe('')
    expect(parseDateTimeInput('')).toBeNull()
  })
})

describe('filter state', () => {
  test('detects active filters', () => {
    expect(filtersActive(DEFAULT_FILTER, null)).toBe(false)
    expect(filtersActive({ ...DEFAULT_FILTER, query: 'x' }, null)).toBe(true)
    expect(filtersActive({ ...DEFAULT_FILTER, range: 'custom' }, null)).toBe(true)
    expect(filtersActive(DEFAULT_FILTER, 'trace-id')).toBe(true)
  })
})

describe('performance', () => {
  test('filters a 10k buffer in under 16 ms after the search index warms', () => {
    const records = bulk(10_000)
    const filter = {
      ...DEFAULT_FILTER,
      query: 'checkout|latency',
      regexMode: true,
      range: '15m' as const,
    }
    visibleRecords(records, filter, null)
    const samples: number[] = []
    for (let run = 0; run < 7; run += 1) {
      const started = performance.now()
      const visible = visibleRecords(records, filter, null)
      samples.push(performance.now() - started)
      expect(visible.length).toBeGreaterThan(0)
    }
    samples.sort((left, right) => left - right)
    const median = samples[Math.floor(samples.length / 2)] ?? Number.POSITIVE_INFINITY
    expect(median).toBeLessThan(16)
  })
})
