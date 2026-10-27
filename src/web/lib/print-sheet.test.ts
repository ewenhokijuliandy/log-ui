import { describe, expect, test } from 'vitest'
import type { LogRecord } from '../../shared/types.ts'
import { buildPrintPages, PRINT_LINES_PER_PAGE } from './print-sheet.ts'

function record(seq: number, ts: number | null = 1_700_000_000_000 + seq * 1_000): LogRecord {
  return {
    seq,
    raw: `line ${String(seq)}`,
    truncated: false,
    ts,
    level: 'info',
    message: `line ${String(seq)}`,
    json: null,
    ids: [],
  }
}

describe('print sheet', () => {
  test('paginates at the design line count and keeps order', () => {
    const records = Array.from({ length: 100 }, (_, index) => record(index + 1))
    const sheet = buildPrintPages('api', records, 'utc', 10_000)
    expect(sheet.pages).toHaveLength(3)
    expect(sheet.pages[0]?.split('\n')[0]).toContain('line 1')
    expect(sheet.pages[1]?.split('\n')[0]).toContain(`line ${String(PRINT_LINES_PER_PAGE + 1)}`)
    expect(sheet.pages[2]?.split('\n').at(-1)).toContain('line 100')
    expect(sheet.title).toBe('api · 100 lines')
  })

  test('handles the 40/41 line page boundaries', () => {
    const forty = Array.from({ length: 40 }, (_, index) => record(index + 1))
    expect(buildPrintPages('api', forty, 'utc', 10_000).pages).toHaveLength(1)
    expect(buildPrintPages('api', [...forty, record(41)], 'utc', 10_000).pages).toHaveLength(2)
  })

  test('labels the range and buffer cap', () => {
    const records = [
      record(1, Date.UTC(2026, 9, 22, 14, 36, 0)),
      record(2, Date.UTC(2026, 9, 22, 14, 36, 2)),
    ]
    const sheet = buildPrintPages('api', records, 'utc', 10_000)
    expect(sheet.meta).toBe('14:36:00 to 14:36:02 UTC · buffer cap 10,000 lines')
  })

  test('renders an empty page when nothing is in view', () => {
    const sheet = buildPrintPages('api', [], 'local', 10_000)
    expect(sheet.pages).toEqual(['No lines in view.'])
    expect(sheet.title).toBe('api · 0 lines')
    expect(sheet.meta).toBe('no lines in view · buffer cap 10,000 lines')
  })

  test('marks rows without timestamps', () => {
    const sheet = buildPrintPages('api', [record(1, null), record(2, null)], 'utc', 10_000)
    expect(sheet.meta).toContain('timestamps unavailable')
  })
})
