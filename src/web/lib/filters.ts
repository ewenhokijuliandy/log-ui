import { chipShowsLevel, type LevelChipKey } from '../../shared/levels.ts'
import type { LogLevel, LogRecord } from '../../shared/types.ts'

export type RangeKey = '5m' | '15m' | '1h' | 'all'

export const RANGE_LABELS: Record<RangeKey, string> = {
  '5m': 'Last 5 min',
  '15m': 'Last 15 min',
  '1h': 'Last 1 hour',
  all: 'All time',
}

export const RANGE_MS: Record<Exclude<RangeKey, 'all'>, number> = {
  '5m': 300_000,
  '15m': 900_000,
  '1h': 3_600_000,
}

export type SortKey = 'newest' | 'oldest'

export const SORT_LABELS: Record<SortKey, string> = {
  newest: 'Newest first',
  oldest: 'Oldest first',
}

export type FilterState = {
  query: string
  regexMode: boolean
  chip: LevelChipKey
  range: RangeKey
}

const SEVERITY: Record<LogLevel, number> = {
  fatal: 4,
  error: 3,
  warn: 2,
  trace: 1,
  info: 0,
  debug: 0,
  unknown: 0,
}

export function searchTextOf(record: LogRecord): string {
  return [
    record.message,
    record.level,
    record.ids.join(' '),
    record.json === null ? '' : JSON.stringify(record.json),
  ]
    .join(' ')
    .toLowerCase()
}

export function bufferNow(records: readonly LogRecord[]): number {
  let newest = 0
  for (const record of records) {
    if (record.ts !== null && record.ts > newest) newest = record.ts
  }
  return newest
}

export function filterError(state: FilterState): string | null {
  if (!state.regexMode) return null
  const query = state.query.trim()
  if (query === '') return null
  try {
    new RegExp(query, 'i')
    return null
  } catch {
    return 'Invalid regular expression'
  }
}

export function matchRecord(record: LogRecord, state: FilterState): boolean {
  if (!chipShowsLevel(state.chip, record.level)) return false
  const query = state.query.trim()
  if (query === '') return true
  const haystack = searchTextOf(record)
  if (!state.regexMode) return haystack.includes(query.toLowerCase())
  try {
    return new RegExp(query, 'i').test(haystack)
  } catch {
    return false
  }
}

export function visibleRecords(
  records: readonly LogRecord[],
  state: FilterState,
  isolateTrace: string | null,
): LogRecord[] {
  const error = filterError(state)
  if (error !== null) return []
  const now = bufferNow(records)
  const floor = state.range === 'all' ? Number.NEGATIVE_INFINITY : now - RANGE_MS[state.range]
  const result: LogRecord[] = []
  for (const record of records) {
    if (isolateTrace !== null && !record.ids.includes(isolateTrace)) continue
    if (!matchRecord(record, state)) continue
    if (state.range !== 'all') {
      if (record.ts === null) continue
      if (record.ts < floor) continue
    }
    result.push(record)
  }
  return result
}

export function countOut(
  record: LogRecord,
  state: FilterState,
  isolateTrace: string | null,
): boolean {
  if (isolateTrace !== null && !record.ids.includes(isolateTrace)) return true
  return !matchRecord(record, state)
}

export function filtersActive(
  state: Pick<FilterState, 'query' | 'chip' | 'range'>,
  isolateTrace: string | null,
): boolean {
  return (
    state.query.trim().length > 0 ||
    state.chip !== 'all' ||
    state.range !== 'all' ||
    isolateTrace !== null
  )
}

export type SignalView = {
  bins: string[]
  noteTs: number | null
  noteLabel: string
}

export function buildSignal(records: readonly LogRecord[]): SignalView {
  const now = bufferNow(records)
  const bins = new Array(60).fill('none') as string[]
  let noteTs: number | null = null
  let noteLabel = ''
  let noteSeverity = -1
  for (const record of records) {
    if (record.ts === null) continue
    const age = Math.floor((now - record.ts) / 1000)
    if (age < 0 || age > 59) continue
    const index = 59 - age
    const current = bins[index] === 'none' ? -1 : (SEVERITY[bins[index] as LogLevel] ?? -1)
    if (SEVERITY[record.level] > current) bins[index] = record.level
    const weight = SEVERITY[record.level] ?? -1
    if (weight >= 2 && weight > noteSeverity) {
      noteSeverity = weight
      noteTs = record.ts
      noteLabel = record.message.length > 46 ? `${record.message.slice(0, 46)}…` : record.message
    }
  }
  return { bins, noteTs, noteLabel }
}
