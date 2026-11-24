import { describe, expect, test } from 'vitest'
import { formatSavedAt } from './format-time.ts'

const NOW = Date.UTC(2026, 10, 24, 12, 0, 0)

describe('formatSavedAt', () => {
  test('drops the date for today', () => {
    expect(formatSavedAt(Date.UTC(2026, 10, 24, 8, 5), 'utc', NOW)).toBe('Today 08:05')
  })

  test('names yesterday instead of the date', () => {
    expect(formatSavedAt(Date.UTC(2026, 10, 23, 22, 41), 'utc', NOW)).toBe('Yesterday 22:41')
  })

  test('shows the day and month earlier in the same year', () => {
    expect(formatSavedAt(Date.UTC(2026, 10, 20, 7, 24), 'utc', NOW)).toBe('20 Nov 07:24')
    expect(formatSavedAt(Date.UTC(2026, 0, 2, 9, 0), 'utc', NOW)).toBe('2 Jan 09:00')
  })

  test('adds the year for older snapshots', () => {
    expect(formatSavedAt(Date.UTC(2025, 11, 31, 23, 15), 'utc', NOW)).toBe('31 Dec 2025')
  })

  test('handles the local zone', () => {
    const value = formatSavedAt(NOW - 60 * 60 * 1000, 'local', NOW)
    expect(value.startsWith('Today ')).toBe(true)
  })

  test('treats a null timestamp as unknown', () => {
    expect(formatSavedAt(null, 'utc', NOW)).toBe('-')
  })
})
