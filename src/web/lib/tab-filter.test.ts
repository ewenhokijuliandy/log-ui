import { describe, expect, test } from 'vitest'
import { emptyLevelCounts } from '../../shared/levels.ts'
import type { StreamEntry } from '../app/stream-entry.ts'
import { filterTabs } from './tab-filter.ts'

function stream(id: string, name: string): StreamEntry {
  return {
    id,
    name,
    kind: 'pipe',
    status: 'active',
    createdAt: 1_700_000_000_000,
    records: [],
    dropped: 0,
    lineCount: 0,
    levelCounts: emptyLevelCounts(),
    lastSeq: null,
    firstSeq: null,
    pausedAt: null,
  }
}

function names(entries: readonly StreamEntry[]): string[] {
  return entries.map((entry) => entry.name)
}

const tabs: StreamEntry[] = [
  stream('s1', 'ms-user-1ahdss'),
  stream('s2', 'api'),
  stream('s3', 'worker-queue'),
  stream('s4', 'api-gateway'),
]

describe('filterTabs', () => {
  test('empty query returns every stream in order', () => {
    const result = filterTabs(tabs, '')
    expect(result).toHaveLength(tabs.length)
    expect(names(result)).toEqual(['ms-user-1ahdss', 'api', 'worker-queue', 'api-gateway'])
  })

  test('whitespace-only query returns every stream', () => {
    expect(names(filterTabs(tabs, '   '))).toEqual(names(tabs))
    expect(names(filterTabs(tabs, '\t\n '))).toEqual(names(tabs))
  })

  test('matches case-insensitively', () => {
    expect(names(filterTabs(tabs, 'MS-USER'))).toEqual(['ms-user-1ahdss'])
    expect(names(filterTabs(tabs, 'Ms-UsEr-1AhDsS'))).toEqual(['ms-user-1ahdss'])
  })

  test('matches a substring in the middle of the name', () => {
    expect(names(filterTabs(tabs, 'gate'))).toEqual(['api-gateway'])
    expect(names(filterTabs(tabs, 'user'))).toEqual(['ms-user-1ahdss'])
  })

  test('returns an empty array when nothing matches', () => {
    expect(filterTabs(tabs, 'checkout')).toEqual([])
  })

  test('preserves input order when several streams match', () => {
    const ordered = [stream('a', 'zeta-api'), stream('b', 'api'), stream('c', 'mid-api-x')]
    expect(names(filterTabs(ordered, 'api'))).toEqual(['zeta-api', 'api', 'mid-api-x'])
  })

  test('trims the query before matching', () => {
    expect(names(filterTabs(tabs, '  api  '))).toEqual(['api', 'api-gateway'])
    expect(names(filterTabs(tabs, '\tapi\n'))).toEqual(['api', 'api-gateway'])
  })

  test('returns a new array rather than the input reference', () => {
    expect(filterTabs(tabs, '')).not.toBe(tabs)
    expect(filterTabs(tabs, 'api')).not.toBe(tabs)
    expect(filterTabs(tabs, 'missing')).not.toBe(tabs)
  })

  test('does not mutate the input streams', () => {
    const snapshot = names(tabs)
    filterTabs(tabs, 'api')
    expect(names(tabs)).toEqual(snapshot)
  })
})
