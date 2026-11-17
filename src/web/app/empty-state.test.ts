import { describe, expect, it } from 'vitest'
import { emptyStateText } from './empty-state.ts'

const base = {
  cleared: false,
  activeKind: 'pipe' as const,
  filterProblem: null,
  filtersActive: false,
  bootError: null,
}

describe('emptyStateText', () => {
  it('reports a cleared pipe buffer', () => {
    expect(emptyStateText({ ...base, cleared: true })).toBe(
      'Buffer cleared. New lines will appear here.',
    )
  })

  it('reports a cleared manual buffer', () => {
    expect(emptyStateText({ ...base, cleared: true, activeKind: 'manual' })).toBe(
      'Parsed lines cleared.',
    )
  })

  it('reports a cleared manual stream with no active stream', () => {
    expect(emptyStateText({ ...base, cleared: true, activeKind: null })).toBe(
      'Buffer cleared. New lines will appear here.',
    )
  })

  it('reports a cleared buffer before an invalid pattern', () => {
    expect(
      emptyStateText({
        ...base,
        cleared: true,
        filterProblem: 'Invalid regular expression',
        filtersActive: true,
        bootError: 'daemon down',
      }),
    ).toBe('Buffer cleared. New lines will appear here.')
  })

  it('reports an invalid pattern before an active view or boot error', () => {
    expect(
      emptyStateText({
        ...base,
        filterProblem: 'Invalid regular expression',
        filtersActive: true,
        bootError: 'daemon down',
      }),
    ).toBe('This pattern is not a valid regular expression.')
  })

  it('reports an active view with no matches', () => {
    expect(emptyStateText({ ...base, filtersActive: true, bootError: 'daemon down' })).toBe(
      'No lines match this view.',
    )
  })

  it('falls back to the boot error', () => {
    expect(emptyStateText({ ...base, bootError: 'The logdeck daemon is unreachable.' })).toBe(
      'The logdeck daemon is unreachable.',
    )
  })

  it('falls back to the plain empty buffer copy', () => {
    expect(emptyStateText(base)).toBe('No lines in this buffer yet.')
  })
})
