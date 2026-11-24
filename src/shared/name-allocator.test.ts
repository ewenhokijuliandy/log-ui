import { describe, expect, test } from 'vitest'
import { allocateStreamName, uniqueStreamName } from './name-allocator.ts'

describe('stream name allocator', () => {
  test('first default is log-viewer-1', () => {
    expect(allocateStreamName([])).toBe('log-viewer-1')
  })

  test('advances past taken defaults', () => {
    expect(allocateStreamName(['log-viewer-1', 'log-viewer-2'])).toBe('log-viewer-3')
  })

  test('fills gaps below the highest taken', () => {
    expect(allocateStreamName(['log-viewer-2', 'log-viewer-4'])).toBe('log-viewer-1')
  })

  test('ignores custom names when finding the next default', () => {
    expect(allocateStreamName(['api', 'payments'])).toBe('log-viewer-1')
  })

  test('manual prefix works for client-side tabs', () => {
    expect(allocateStreamName(['manual-1'], 'manual')).toBe('manual-2')
  })
})

describe('uniqueStreamName', () => {
  test('keeps the preferred name when it is free', () => {
    expect(uniqueStreamName([], 'worker-1')).toBe('worker-1')
    expect(uniqueStreamName(['api'], 'worker-1')).toBe('worker-1')
  })

  test('suffixes from 2 when the name is taken', () => {
    expect(uniqueStreamName(['worker-1'], 'worker-1')).toBe('worker-1-2')
    expect(uniqueStreamName(['worker-1', 'worker-1-2'], 'worker-1')).toBe('worker-1-3')
  })
})
