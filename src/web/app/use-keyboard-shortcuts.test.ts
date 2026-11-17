import { describe, expect, it } from 'vitest'
import type { LogRecord } from '../../shared/types.ts'
import { nextVisibleSeq } from './use-keyboard-shortcuts.ts'

function record(seq: number): LogRecord {
  return {
    seq,
    ts: 1_700_000_000_000,
    level: 'info',
    message: `line ${String(seq)}`,
    raw: `line ${String(seq)}`,
    json: null,
    ids: [],
    truncated: false,
  }
}

const VISIBLE = [record(10), record(11), record(12), record(13)]

describe('nextVisibleSeq', () => {
  it('returns null for an empty view', () => {
    expect(nextVisibleSeq([], null, 1)).toBeNull()
    expect(nextVisibleSeq([], 10, -1)).toBeNull()
  })

  it('selects the first row when nothing is selected and moving down', () => {
    expect(nextVisibleSeq(VISIBLE, null, 1)).toBe(10)
  })

  it('selects the last row when nothing is selected and moving up', () => {
    expect(nextVisibleSeq(VISIBLE, null, -1)).toBe(13)
  })

  it('moves down one row', () => {
    expect(nextVisibleSeq(VISIBLE, 11, 1)).toBe(12)
  })

  it('moves up one row', () => {
    expect(nextVisibleSeq(VISIBLE, 11, -1)).toBe(10)
  })

  it('clamps at the first row', () => {
    expect(nextVisibleSeq(VISIBLE, 10, -1)).toBe(10)
  })

  it('clamps at the last row', () => {
    expect(nextVisibleSeq(VISIBLE, 13, 1)).toBe(13)
  })

  it('treats a stale selection like no selection', () => {
    expect(nextVisibleSeq(VISIBLE, 99, 1)).toBe(10)
    expect(nextVisibleSeq(VISIBLE, 99, -1)).toBe(13)
  })
})
