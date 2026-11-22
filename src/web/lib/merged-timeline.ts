import { chipShowsRecord } from '../../shared/levels.ts'
import type { ParseRules } from '../../shared/parse-rules.ts'
import type { LogRecord } from '../../shared/types.ts'
import type { StreamEntry } from '../app/stream-entry.ts'
import {
  bufferNow,
  compileSearch,
  type FilterState,
  filterError,
  rangeWindow,
  type SortKey,
  searchTextOf,
} from './filters.ts'
import { reparseRecords } from './reparse.ts'

export type MergedRow = {
  key: string
  streamId: string
  streamName: string
  record: LogRecord
}

type IndexedRow = {
  row: MergedRow
  entryIndex: number
}

function compareTies(left: IndexedRow, right: IndexedRow): number {
  if (left.entryIndex !== right.entryIndex) return left.entryIndex - right.entryIndex
  return left.row.record.seq - right.row.record.seq
}

function compareIndexedRows(left: IndexedRow, right: IndexedRow): number {
  const leftTs = left.row.record.ts
  const rightTs = right.row.record.ts
  if (leftTs === null && rightTs === null) return compareTies(left, right)
  if (leftTs === null) return 1
  if (rightTs === null) return -1
  if (leftTs !== rightTs) return leftTs - rightTs
  return compareTies(left, right)
}

function rowsForEntry(entry: StreamEntry, entryIndex: number, rules: ParseRules): IndexedRow[] {
  return reparseRecords(entry.records, rules).map((record) => ({
    entryIndex,
    row: {
      key: `${entry.id}:${record.seq}`,
      streamId: entry.id,
      streamName: entry.name,
      record,
    },
  }))
}

export function mergeStreamRecords(
  entries: readonly StreamEntry[],
  rules: ParseRules,
  cap: number,
): { rows: MergedRow[]; truncated: boolean } {
  const indexed = entries.flatMap((entry, entryIndex) => rowsForEntry(entry, entryIndex, rules))
  const ordered = indexed.sort(compareIndexedRows).map((item) => item.row)
  const rows = cap > 0 ? ordered.slice(-cap) : []
  return { rows, truncated: ordered.length > cap }
}

function mergedHaystack(row: MergedRow): string {
  return `${row.streamName.toLowerCase()} ${searchTextOf(row.record)}`
}

export function orderMergedRows(rows: readonly MergedRow[], sort: SortKey): MergedRow[] {
  if (sort === 'oldest') return [...rows]
  return rows.slice().reverse()
}

export function visibleMergedRows(
  rows: readonly MergedRow[],
  filter: FilterState,
  isolateTrace: string | null,
  sort: SortKey,
): MergedRow[] {
  if (filterError(filter) !== null) return []
  const matcher = compileSearch(filter)
  const window = rangeWindow(filter, bufferNow(rows.map((row) => row.record)))
  const result: MergedRow[] = []
  for (const row of rows) {
    if (isolateTrace !== null && !row.record.ids.includes(isolateTrace)) continue
    if (!chipShowsRecord(filter.chips, row.record.level)) continue
    if (filter.range !== 'all') {
      if (row.record.ts === null) continue
      if (window !== null && row.record.ts < window.floor) continue
      if (window !== null && row.record.ts > window.ceiling) continue
    }
    if (matcher !== null && !matcher.test(mergedHaystack(row))) continue
    result.push(row)
  }
  return orderMergedRows(result, sort)
}

export function mergedPauseKeys(rows: readonly MergedRow[]): Set<string> {
  return new Set(rows.map((row) => row.key))
}

export function mergedExportText(rows: readonly MergedRow[]): string {
  return rows.map((row) => `[${row.streamName}] ${row.record.raw}`).join('\n')
}
