import { describe, expect, test } from 'vitest'
import {
  BUFFER_CAP_DEFAULT,
  BUFFER_CAP_MAX,
  BUFFER_CAP_MIN,
  normalizeBufferCap,
} from './buffer-cap.ts'

describe('buffer cap', () => {
  test('exposes the approved default and bounds', () => {
    expect(BUFFER_CAP_DEFAULT).toBe(10_000)
    expect(BUFFER_CAP_MIN).toBe(1_000)
    expect(BUFFER_CAP_MAX).toBe(50_000)
  })

  test('accepts integers inside the range', () => {
    expect(normalizeBufferCap(1_000)).toBe(1_000)
    expect(normalizeBufferCap(25_000)).toBe(25_000)
    expect(normalizeBufferCap(50_000)).toBe(50_000)
  })

  test('rejects out-of-range, fractional and non-numeric values', () => {
    expect(normalizeBufferCap(999)).toBeNull()
    expect(normalizeBufferCap(50_001)).toBeNull()
    expect(normalizeBufferCap(10_000.5)).toBeNull()
    expect(normalizeBufferCap('10000')).toBeNull()
    expect(normalizeBufferCap(null)).toBeNull()
    expect(normalizeBufferCap(Number.NaN)).toBeNull()
  })
})
