import { describe, expect, test } from 'vitest'
import { formatUptime } from './format-uptime.ts'

const START = 1_700_000_000_000

describe('formatUptime', () => {
  test('renders just now below one minute', () => {
    expect(formatUptime(START, START)).toBe('just now')
    expect(formatUptime(START, START + 59_999)).toBe('just now')
  })

  test('renders whole minutes below one hour', () => {
    expect(formatUptime(START, START + 60_000)).toBe('1m')
    expect(formatUptime(START, START + 14 * 60_000)).toBe('14m')
    expect(formatUptime(START, START + 3_599_999)).toBe('59m')
  })

  test('renders hours and minutes below one day', () => {
    expect(formatUptime(START, START + 3_600_000)).toBe('1h')
    expect(formatUptime(START, START + 2 * 3_600_000 + 14 * 60_000)).toBe('2h 14m')
    expect(formatUptime(START, START + 86_399_999)).toBe('23h 59m')
  })

  test('renders days and hours from one day', () => {
    expect(formatUptime(START, START + 86_400_000)).toBe('1d')
    expect(formatUptime(START, START + 3 * 86_400_000 + 4 * 3_600_000)).toBe('3d 4h')
  })

  test('omits a zero trailing unit', () => {
    expect(formatUptime(START, START + 2 * 3_600_000)).toBe('2h')
    expect(formatUptime(START, START + 5 * 86_400_000)).toBe('5d')
  })

  test('treats clock skew and non-finite input as just now', () => {
    expect(formatUptime(START, START - 5_000)).toBe('just now')
    expect(formatUptime(Number.NaN, START)).toBe('just now')
    expect(formatUptime(START, Number.POSITIVE_INFINITY)).toBe('just now')
  })
})
