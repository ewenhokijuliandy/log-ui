import { describe, expect, test } from 'vitest'
import { countLevels } from '../../shared/levels.ts'
import { DEFAULT_PARSE_RULES } from '../../shared/parse-rules.ts'
import type { LogLevel, LogRecord } from '../../shared/types.ts'
import type { StreamEntry } from '../app/stream-entry.ts'
import { DEFAULT_FILTER, type FilterState } from './filters.ts'
import {
  mergedExportText,
  mergedPauseKeys,
  mergeStreamRecords,
  orderMergedRows,
  visibleMergedRows,
} from './merged-timeline.ts'

const CAP = 10_000

function record(seq: number, ts: number | null, overrides: Partial<LogRecord> = {}): LogRecord {
  return {
    raw: `line ${String(seq)}`,
    truncated: false,
    ts,
    level: 'info',
    message: `line ${String(seq)}`,
    json: null,
    ids: [],
    seq,
    ...overrides,
  }
}

function entry(id: string, name: string, records: LogRecord[]): StreamEntry {
  return {
    id,
    name,
    kind: 'pipe',
    status: 'active',
    createdAt: 0,
    records,
    dropped: 0,
    lineCount: records.length,
    levelCounts: countLevels(records),
    lastSeq: records.length > 0 ? (records[records.length - 1]?.seq ?? null) : null,
    firstSeq: records.length > 0 ? (records[0]?.seq ?? null) : null,
    pausedAt: null,
  }
}

function keysOf(rows: readonly { key: string }[]): string[] {
  return rows.map((row) => row.key)
}

function filterWith(overrides: Partial<FilterState>): FilterState {
  return { ...DEFAULT_FILTER, ...overrides }
}

describe('mergeStreamRecords ordering', () => {
  test('interleaves two streams into one ascending timeline', () => {
    const alpha = entry('a', 'alpha', [record(1, 1_000), record(2, 3_000), record(3, 5_000)])
    const beta = entry('b', 'beta', [record(1, 2_000), record(2, 4_000), record(3, 6_000)])
    const { rows, truncated } = mergeStreamRecords([alpha, beta], DEFAULT_PARSE_RULES, CAP)
    expect(rows.map((row) => row.record.ts)).toEqual([1_000, 2_000, 3_000, 4_000, 5_000, 6_000])
    expect(rows.map((row) => row.streamId)).toEqual(['a', 'b', 'a', 'b', 'a', 'b'])
    expect(truncated).toBe(false)
  })

  test('builds keys, stream ids and stream names per row', () => {
    const alpha = entry('a', 'alpha', [record(7, 1_000)])
    const { rows } = mergeStreamRecords([alpha], DEFAULT_PARSE_RULES, CAP)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.key).toBe('a:7')
    expect(rows[0]?.streamId).toBe('a')
    expect(rows[0]?.streamName).toBe('alpha')
    expect(rows[0]?.record.seq).toBe(7)
  })

  test('sorts rows without timestamps last', () => {
    const alpha = entry('a', 'alpha', [record(1, null), record(2, 2_000), record(3, null)])
    const beta = entry('b', 'beta', [record(1, 1_000)])
    const { rows } = mergeStreamRecords([alpha, beta], DEFAULT_PARSE_RULES, CAP)
    expect(rows.map((row) => row.record.ts)).toEqual([1_000, 2_000, null, null])
    expect(keysOf(rows)).toEqual(['b:1', 'a:2', 'a:1', 'a:3'])
  })

  test('breaks timestamp ties by selection order then sequence', () => {
    const alpha = entry('a', 'alpha', [record(3, 1_000), record(1, 1_000)])
    const beta = entry('b', 'beta', [record(2, 1_000)])
    const { rows } = mergeStreamRecords([alpha, beta], DEFAULT_PARSE_RULES, CAP)
    expect(keysOf(rows)).toEqual(['a:1', 'a:3', 'b:2'])
  })

  test('selection order decides ties between streams', () => {
    const alpha = entry('a', 'alpha', [record(9, 1_000)])
    const beta = entry('b', 'beta', [record(1, 1_000)])
    const forward = mergeStreamRecords([alpha, beta], DEFAULT_PARSE_RULES, CAP)
    const reversed = mergeStreamRecords([beta, alpha], DEFAULT_PARSE_RULES, CAP)
    expect(keysOf(forward.rows)).toEqual(['a:9', 'b:1'])
    expect(keysOf(reversed.rows)).toEqual(['b:1', 'a:9'])
  })

  test('keeps the newest rows up to the cap and flags truncation', () => {
    const alpha = entry(
      'a',
      'alpha',
      [1, 2, 3, 4, 5].map((seq) => record(seq, seq * 1_000)),
    )
    const { rows, truncated } = mergeStreamRecords([alpha], DEFAULT_PARSE_RULES, 3)
    expect(rows.map((row) => row.record.seq)).toEqual([3, 4, 5])
    expect(truncated).toBe(true)
  })

  test('does not flag truncation when the merged set fits the cap', () => {
    const alpha = entry('a', 'alpha', [record(1, 1_000), record(2, 2_000)])
    const { rows, truncated } = mergeStreamRecords([alpha], DEFAULT_PARSE_RULES, 2)
    expect(rows).toHaveLength(2)
    expect(truncated).toBe(false)
  })

  test('returns an empty timeline for no entries', () => {
    const { rows, truncated } = mergeStreamRecords([], DEFAULT_PARSE_RULES, CAP)
    expect(rows).toEqual([])
    expect(truncated).toBe(false)
  })
})

describe('orderMergedRows', () => {
  test('oldest keeps the given order and newest reverses it', () => {
    const alpha = entry('a', 'alpha', [record(1, 1_000), record(2, 2_000), record(3, 3_000)])
    const { rows } = mergeStreamRecords([alpha], DEFAULT_PARSE_RULES, CAP)
    expect(orderMergedRows(rows, 'oldest').map((row) => row.record.seq)).toEqual([1, 2, 3])
    expect(orderMergedRows(rows, 'newest').map((row) => row.record.seq)).toEqual([3, 2, 1])
    expect(rows.map((row) => row.record.seq)).toEqual([1, 2, 3])
  })

  test('returns a copy rather than the same array', () => {
    const alpha = entry('a', 'alpha', [record(1, 1_000)])
    const { rows } = mergeStreamRecords([alpha], DEFAULT_PARSE_RULES, CAP)
    expect(orderMergedRows(rows, 'oldest')).not.toBe(rows)
    expect(orderMergedRows(rows, 'newest')).not.toBe(rows)
  })
})

describe('visibleMergedRows search', () => {
  test('matches the source stream name', () => {
    const alpha = entry('a', 'ms-user-1ahdss', [record(1, 1_000, { message: 'boot ok' })])
    const beta = entry('b', 'ms-catalog-9zz', [record(1, 2_000, { message: 'boot ok' })])
    const { rows } = mergeStreamRecords([alpha, beta], DEFAULT_PARSE_RULES, CAP)
    const visible = visibleMergedRows(rows, filterWith({ query: 'ms-user' }), null, 'oldest')
    expect(keysOf(visible)).toEqual(['a:1'])
  })

  test('matches the stream name case-insensitively and in regex mode', () => {
    const alpha = entry('a', 'MS-User-1ahdss', [record(1, 1_000, { message: 'boot ok' })])
    const { rows } = mergeStreamRecords([alpha], DEFAULT_PARSE_RULES, CAP)
    expect(visibleMergedRows(rows, filterWith({ query: 'ms-user' }), null, 'oldest')).toHaveLength(
      1,
    )
    const regex = filterWith({ query: '^ms-user-\\w+ ', regexMode: true })
    expect(visibleMergedRows(rows, regex, null, 'oldest')).toHaveLength(1)
  })

  test('still matches the record search text', () => {
    const alpha = entry('a', 'alpha', [
      record(1, 1_000, { message: 'checkout completed' }),
      record(2, 2_000, { message: 'catalog fetched' }),
    ])
    const { rows } = mergeStreamRecords([alpha], DEFAULT_PARSE_RULES, CAP)
    const visible = visibleMergedRows(rows, filterWith({ query: 'checkout' }), null, 'oldest')
    expect(keysOf(visible)).toEqual(['a:1'])
  })

  test('returns an empty array for an invalid regular expression', () => {
    const alpha = entry('a', 'alpha', [record(1, 1_000)])
    const { rows } = mergeStreamRecords([alpha], DEFAULT_PARSE_RULES, CAP)
    const broken = filterWith({ query: '(', regexMode: true })
    expect(visibleMergedRows(rows, broken, null, 'oldest')).toEqual([])
  })

  test('applies the requested sort after filtering', () => {
    const alpha = entry('a', 'alpha', [record(1, 1_000), record(2, 2_000), record(3, 3_000)])
    const { rows } = mergeStreamRecords([alpha], DEFAULT_PARSE_RULES, CAP)
    const visible = visibleMergedRows(rows, DEFAULT_FILTER, null, 'newest')
    expect(visible.map((row) => row.record.seq)).toEqual([3, 2, 1])
  })
})

describe('visibleMergedRows level chips', () => {
  test('keeps only the levels selected by the chips', () => {
    const alpha = entry('a', 'alpha', [
      record(1, 1_000, { level: 'fatal' }),
      record(2, 2_000, { level: 'error' }),
      record(3, 3_000, { level: 'warn' }),
      record(4, 4_000, { level: 'debug' }),
      record(5, 5_000, { level: 'trace' }),
      record(6, 6_000, { level: 'unknown' }),
    ])
    const { rows } = mergeStreamRecords([alpha], DEFAULT_PARSE_RULES, CAP)
    const errors = visibleMergedRows(rows, filterWith({ chips: ['error'] }), null, 'oldest')
    expect(errors.map((row) => row.record.level)).toEqual(['fatal', 'error'])
    const debug = visibleMergedRows(rows, filterWith({ chips: ['debug'] }), null, 'oldest')
    expect(debug.map((row) => row.record.level)).toEqual(['debug', 'trace'])
    const unknown = visibleMergedRows(rows, filterWith({ chips: ['unknown'] }), null, 'oldest')
    expect(unknown.map((row) => row.record.level)).toEqual(['unknown'])
    expect(visibleMergedRows(rows, DEFAULT_FILTER, null, 'oldest')).toHaveLength(6)
  })

  test('filters chips across streams', () => {
    const alpha = entry('a', 'alpha', [record(1, 1_000, { level: 'error' })])
    const beta = entry('b', 'beta', [record(1, 2_000, { level: 'info' })])
    const { rows } = mergeStreamRecords([alpha, beta], DEFAULT_PARSE_RULES, CAP)
    const visible = visibleMergedRows(rows, filterWith({ chips: ['error'] }), null, 'oldest')
    expect(keysOf(visible)).toEqual(['a:1'])
  })
})

describe('visibleMergedRows isolateTrace', () => {
  test('keeps only rows carrying the isolated trace id', () => {
    const alpha = entry('a', 'alpha', [
      record(1, 1_000, { ids: ['trace-1'] }),
      record(2, 2_000, { ids: ['trace-2'] }),
    ])
    const beta = entry('b', 'beta', [record(1, 3_000, { ids: ['trace-1', 'trace-9'] })])
    const { rows } = mergeStreamRecords([alpha, beta], DEFAULT_PARSE_RULES, CAP)
    const visible = visibleMergedRows(rows, DEFAULT_FILTER, 'trace-1', 'oldest')
    expect(keysOf(visible)).toEqual(['a:1', 'b:1'])
    expect(visibleMergedRows(rows, DEFAULT_FILTER, 'missing', 'oldest')).toEqual([])
  })
})

describe('visibleMergedRows time ranges', () => {
  test('relative ranges measure from the newest timestamp in the merged set', () => {
    const newest = 1_700_000_000_000
    const alpha = entry('a', 'alpha', [record(1, newest - 600_000), record(2, newest - 120_000)])
    const beta = entry('b', 'beta', [record(1, newest), record(2, null)])
    const { rows } = mergeStreamRecords([alpha, beta], DEFAULT_PARSE_RULES, CAP)
    const visible = visibleMergedRows(rows, filterWith({ range: '5m' }), null, 'oldest')
    expect(keysOf(visible)).toEqual(['a:2', 'b:1'])
  })

  test('custom ranges are inclusive and drop rows without timestamps', () => {
    const alpha = entry('a', 'alpha', [
      record(1, 1_000),
      record(2, 2_000),
      record(3, 3_000),
      record(4, null),
    ])
    const { rows } = mergeStreamRecords([alpha], DEFAULT_PARSE_RULES, CAP)
    const filter = filterWith({ range: 'custom', from: 1_000, to: 2_000 })
    expect(keysOf(visibleMergedRows(rows, filter, null, 'oldest'))).toEqual(['a:1', 'a:2'])
  })
})

describe('mergedPauseKeys', () => {
  test('returns every row key', () => {
    const alpha = entry('a', 'alpha', [record(1, 1_000), record(2, 2_000)])
    const beta = entry('b', 'beta', [record(1, 3_000)])
    const { rows } = mergeStreamRecords([alpha, beta], DEFAULT_PARSE_RULES, CAP)
    const keys = mergedPauseKeys(rows)
    expect(keys).toBeInstanceOf(Set)
    expect(keys.size).toBe(3)
    expect([...keys]).toEqual(['a:1', 'a:2', 'b:1'])
    expect(mergedPauseKeys([]).size).toBe(0)
  })
})

describe('mergedExportText', () => {
  test('prefixes each line with the stream name', () => {
    const alpha = entry('a', 'alpha', [record(1, 1_000, { raw: 'first' })])
    const beta = entry('b', 'beta', [record(1, 2_000, { raw: 'second' })])
    const { rows } = mergeStreamRecords([alpha, beta], DEFAULT_PARSE_RULES, CAP)
    expect(mergedExportText(rows)).toBe('[alpha] first\n[beta] second')
  })

  test('returns an empty string for no rows', () => {
    expect(mergedExportText([])).toBe('')
  })
})

describe('mergeStreamRecords level typing', () => {
  test('keeps the record level on each row', () => {
    const levels: LogLevel[] = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'unknown']
    const alpha = entry(
      'a',
      'alpha',
      levels.map((level, index) => record(index + 1, (index + 1) * 1_000, { level })),
    )
    const { rows } = mergeStreamRecords([alpha], DEFAULT_PARSE_RULES, CAP)
    expect(rows.map((row) => row.record.level)).toEqual(levels)
  })
})
