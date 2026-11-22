import type { StreamEntry } from '../app/stream-entry.ts'

export function filterTabs(streams: readonly StreamEntry[], query: string): StreamEntry[] {
  const needle = query.trim().toLowerCase()
  if (needle === '') return [...streams]
  return streams.filter((entry) => entry.name.toLowerCase().includes(needle))
}
