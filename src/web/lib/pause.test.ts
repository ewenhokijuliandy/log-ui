import { describe, expect, test } from 'vitest'
import { frozenRecords, pendingCount } from './pause.ts'

const records = Array.from({ length: 10 }, (_, index) => ({ seq: index + 1 }))

describe('pause buffering', () => {
  test('returns every record when not paused', () => {
    expect(frozenRecords(records, null)).toBe(records)
    expect(pendingCount(records, null)).toBe(0)
  })

  test('freezes at the boundary while new records buffer', () => {
    expect(frozenRecords(records, 4).map((record) => record.seq)).toEqual([1, 2, 3, 4])
    expect(pendingCount(records, 4)).toBe(6)
  })

  test('a zero boundary hides every incoming record', () => {
    expect(frozenRecords(records, 0)).toEqual([])
    expect(pendingCount(records, 0)).toBe(10)
  })

  test('boundaries beyond the buffer freeze everything', () => {
    expect(frozenRecords(records, 99).map((record) => record.seq)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    ])
    expect(pendingCount(records, 99)).toBe(0)
  })

  test('empty buffers stay empty', () => {
    expect(frozenRecords([], 0)).toEqual([])
    expect(pendingCount([], 12)).toBe(0)
  })
})
