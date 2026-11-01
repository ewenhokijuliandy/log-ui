import { describe, expect, test } from 'vitest'
import {
  copyCounts,
  countForChip,
  emptyLevelCounts,
  type LevelCounts,
  levelFromNumeric,
  sumCounts,
} from './levels.ts'
import type { LogLevel } from './types.ts'

function counts(values: Partial<Record<LogLevel, number>>): LevelCounts {
  return { ...emptyLevelCounts(), ...values }
}

describe('numeric level bands', () => {
  test('maps pino and bunyan bands', () => {
    expect(levelFromNumeric(10)).toBe('trace')
    expect(levelFromNumeric(20)).toBe('debug')
    expect(levelFromNumeric(30)).toBe('info')
    expect(levelFromNumeric(40)).toBe('warn')
    expect(levelFromNumeric(50)).toBe('error')
    expect(levelFromNumeric(60)).toBe('fatal')
  })

  test('maps syslog severities', () => {
    expect(levelFromNumeric(0)).toBe('fatal')
    expect(levelFromNumeric(1)).toBe('fatal')
    expect(levelFromNumeric(2)).toBe('fatal')
    expect(levelFromNumeric(3)).toBe('error')
    expect(levelFromNumeric(4)).toBe('warn')
    expect(levelFromNumeric(5)).toBe('info')
    expect(levelFromNumeric(6)).toBe('info')
    expect(levelFromNumeric(7)).toBe('debug')
  })

  test('accepts numeric strings', () => {
    expect(levelFromNumeric('30')).toBe('info')
    expect(levelFromNumeric(' 40 ')).toBe('warn')
  })

  test('rejects out-of-band, fractional and named values', () => {
    expect(levelFromNumeric(200)).toBeNull()
    expect(levelFromNumeric(30.5)).toBeNull()
    expect(levelFromNumeric(-1)).toBeNull()
    expect(levelFromNumeric('info')).toBeNull()
    expect(levelFromNumeric('30.5')).toBeNull()
  })
})

describe('level chips', () => {
  test('all chip shows every level', () => {
    const all: LevelCounts = counts({
      fatal: 2,
      error: 48,
      warn: 213,
      info: 6820,
      debug: 2878,
      trace: 39,
      unknown: 5,
    })
    expect(countForChip(all, 'all')).toBe(10_005)
  })

  test('error chip merges fatal plus error', () => {
    const all: LevelCounts = counts({ fatal: 2, error: 48 })
    expect(countForChip(all, 'error')).toBe(50)
  })

  test('debug chip merges debug plus trace', () => {
    const all: LevelCounts = counts({ debug: 100, trace: 3 })
    expect(countForChip(all, 'debug')).toBe(103)
  })

  test('unknown rows are always visible on every chip', () => {
    const all: LevelCounts = counts({ error: 4, unknown: 7 })
    expect(countForChip(all, 'error')).toBe(11)
    expect(countForChip(all, 'info')).toBe(7)
    expect(countForChip(all, 'warn')).toBe(7)
    expect(countForChip(all, 'debug')).toBe(7)
  })
})

describe('count helpers', () => {
  test('empty counts are all zero', () => {
    const fresh = emptyLevelCounts()
    for (const key of Object.keys(fresh)) expect(fresh[key as LogLevel]).toBe(0)
  })

  test('copy is independent', () => {
    const source = counts({ error: 2 })
    const copy = copyCounts(source)
    copy.error = 9
    expect(source.error).toBe(2)
  })

  test('sum accumulates into the target', () => {
    const target = counts({ error: 1, info: 4 })
    sumCounts(target, counts({ error: 2, warn: 3 }))
    expect(target.error).toBe(3)
    expect(target.info).toBe(4)
    expect(target.warn).toBe(3)
  })
})
