import { chipShowsLevel, type LevelChipKey } from '../../shared/levels.ts'
import type { LogLevel, LogRecord } from '../../shared/types.ts'
import { pad2 } from './format-time.ts'

export type RangeKey = '5m' | '15m' | '1h' | 'all' | 'custom'

export type RelativeRangeKey = Exclude<RangeKey, 'all' | 'custom'>

export const RANGE_LABELS: Record<RangeKey, string> = {
  '5m': 'Last 5 min',
  '15m': 'Last 15 min',
  '1h': 'Last 1 hour',
  all: 'All time',
  custom: 'Custom range',
}

export const RANGE_MS: Record<RelativeRangeKey, number> = {
  '5m': 300_000,
  '15m': 900_000,
  '1h': 3_600_000,
}

export type SortKey = 'newest' | 'oldest'

export const SORT_LABELS: Record<SortKey, string> = {
  newest: 'Newest first',
  oldest: 'Oldest first',
}

export function orderRecords(records: readonly LogRecord[], sort: SortKey): LogRecord[] {
  if (sort === 'oldest') return [...records]
  return records.slice().reverse()
}

export const MAX_PATTERN_LENGTH = 1_000

export type FilterState = {
  query: string
  regexMode: boolean
  chip: LevelChipKey
  range: RangeKey
  from: number | null
  to: number | null
}

export const DEFAULT_FILTER: FilterState = {
  query: '',
  regexMode: false,
  chip: 'all',
  range: 'all',
  from: null,
  to: null,
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

const searchIndex = new WeakMap<LogRecord, string>()

export function searchTextOf(record: LogRecord): string {
  const cached = searchIndex.get(record)
  if (cached !== undefined) return cached
  const text = [
    record.message,
    record.level,
    record.ids.join(' '),
    record.json === null ? '' : JSON.stringify(record.json),
  ]
    .join(' ')
    .toLowerCase()
  searchIndex.set(record, text)
  return text
}

export function bufferNow(records: readonly LogRecord[]): number {
  let newest = 0
  for (const record of records) {
    if (record.ts !== null && record.ts > newest) newest = record.ts
  }
  return newest
}

export type SearchMatcher = {
  test: (haystack: string) => boolean
}

export function compileSearch(
  state: Pick<FilterState, 'query' | 'regexMode'>,
): SearchMatcher | null {
  const query = state.query.trim()
  if (query === '') return null
  if (!state.regexMode) {
    const needle = query.toLowerCase()
    return { test: (haystack) => haystack.includes(needle) }
  }
  try {
    const expression = new RegExp(query, 'i')
    return { test: (haystack) => expression.test(haystack) }
  } catch {
    return { test: () => false }
  }
}

export function filterError(state: Pick<FilterState, 'query' | 'regexMode'>): string | null {
  const query = state.query.trim()
  if (query.length > MAX_PATTERN_LENGTH) {
    return `Search is limited to ${MAX_PATTERN_LENGTH.toLocaleString('en-US')} characters`
  }
  if (!state.regexMode) return null
  if (query === '') return null
  try {
    new RegExp(query, 'i')
    return null
  } catch {
    return 'Invalid regular expression'
  }
}

export function rangeError(state: Pick<FilterState, 'range' | 'from' | 'to'>): string | null {
  if (state.range !== 'custom') return null
  if (state.from === null || state.to === null) return 'Choose a start and end time'
  if (state.from > state.to) return 'Start must be before end'
  return null
}

export type RangeWindow = {
  floor: number
  ceiling: number
}

export function rangeWindow(
  state: Pick<FilterState, 'range' | 'from' | 'to'>,
  now: number,
): RangeWindow | null {
  if (state.range === 'all') return null
  if (state.range === 'custom') {
    if (state.from === null || state.to === null) return null
    if (state.from > state.to) return null
    return { floor: state.from, ceiling: state.to }
  }
  return { floor: now - RANGE_MS[state.range], ceiling: Number.POSITIVE_INFINITY }
}

export function toDateTimeInput(ts: number | null): string {
  if (ts === null) return ''
  const date = new Date(ts)
  return `${String(date.getFullYear())}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`
}

export function parseDateTimeInput(value: string): number | null {
  if (value.trim() === '') return null
  const stamp = new Date(value).getTime()
  if (!Number.isFinite(stamp)) return null
  return stamp
}

export function customRangeError(from: number | null, to: number | null): string | null {
  if (from === null || to === null) return 'Choose a start and end time'
  if (from > to) return 'Start must be before end'
  return null
}

export function visibleRecords(
  records: readonly LogRecord[],
  state: FilterState,
  isolateTrace: string | null,
): LogRecord[] {
  if (filterError(state) !== null) return []
  const matcher = compileSearch(state)
  const window = rangeWindow(state, bufferNow(records))
  const result: LogRecord[] = []
  for (const record of records) {
    if (isolateTrace !== null && !record.ids.includes(isolateTrace)) continue
    if (!chipShowsLevel(state.chip, record.level)) continue
    if (state.range !== 'all') {
      if (record.ts === null) continue
      if (window !== null && record.ts < window.floor) continue
      if (window !== null && record.ts > window.ceiling) continue
    }
    if (matcher !== null && !matcher.test(searchTextOf(record))) continue
    result.push(record)
  }
  return result
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
