import { describe, expect, test } from 'vitest'
import { MAX_STREAM_NAME } from '../shared/stream-name.ts'
import { resolveCreatedName } from './stream-name-create.ts'

describe('resolveCreatedName', () => {
  test('keeps a free name unchanged', () => {
    expect(resolveCreatedName('orders', ['api'])).toBe('orders')
  })

  test('trims the requested name', () => {
    expect(resolveCreatedName('  orders  ', [])).toBe('orders')
  })

  test('allocates a default when the name is missing or blank', () => {
    expect(resolveCreatedName(null, [])).toBe('log-viewer-1')
    expect(resolveCreatedName('', [])).toBe('log-viewer-1')
    expect(resolveCreatedName('   ', [])).toBe('log-viewer-1')
  })

  test('allocates the next free default when defaults are taken', () => {
    expect(resolveCreatedName(null, ['log-viewer-1', 'log-viewer-2'])).toBe('log-viewer-3')
  })

  test('suffixes duplicates from two upward', () => {
    expect(resolveCreatedName('dup', ['dup'])).toBe('dup (2)')
    expect(resolveCreatedName('dup', ['dup', 'dup (2)'])).toBe('dup (3)')
    expect(resolveCreatedName('dup', ['dup', 'dup (2)', 'dup (3)'])).toBe('dup (4)')
  })

  test('truncates names over the limit', () => {
    const long = 'x'.repeat(300)
    expect(resolveCreatedName(long, [])).toBe('x'.repeat(MAX_STREAM_NAME))
    expect(resolveCreatedName(long, []).length).toBe(MAX_STREAM_NAME)
  })

  test('keeps a suffixed duplicate within the limit', () => {
    const base = 'y'.repeat(MAX_STREAM_NAME)
    const resolved = resolveCreatedName(base, [base])
    expect(resolved.length).toBe(MAX_STREAM_NAME)
    expect(resolved.endsWith(' (2)')).toBe(true)
  })

  test('finds a free suffix when earlier suffixes are taken', () => {
    const base = 'z'.repeat(MAX_STREAM_NAME)
    const taken = [base, resolveCreatedName(base, [base])]
    const resolved = resolveCreatedName(base, taken)
    expect(resolved.length).toBe(MAX_STREAM_NAME)
    expect(resolved.endsWith(' (3)')).toBe(true)
  })

  test('never returns a blank name', () => {
    expect(resolveCreatedName('   ', []).length).toBeGreaterThan(0)
  })
})
