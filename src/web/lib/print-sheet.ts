import type { LogRecord } from '../../shared/types.ts'
import { formatClock, formatNumber, type Zone } from './format-time.ts'

export const PRINT_LINES_PER_PAGE = 40

export type PrintSheetData = {
  title: string
  meta: string
  pages: string[]
}

export function buildPrintPages(
  streamName: string,
  records: readonly LogRecord[],
  zone: Zone,
  cap: number,
): PrintSheetData {
  const pages: string[] = []
  for (let index = 0; index < records.length; index += PRINT_LINES_PER_PAGE) {
    pages.push(
      records
        .slice(index, index + PRINT_LINES_PER_PAGE)
        .map((record) => `${String(record.seq).padStart(6, ' ')}  ${record.raw}`)
        .join('\n'),
    )
  }
  if (pages.length === 0) pages.push('No lines in view.')
  return {
    title: `${streamName} · ${formatNumber(records.length)} lines`,
    meta: `${rangeLabel(records, zone)} · buffer cap ${formatNumber(cap)} lines`,
    pages,
  }
}

function rangeLabel(records: readonly LogRecord[], zone: Zone): string {
  if (records.length === 0) return 'no lines in view'
  let first: number | null = null
  let last: number | null = null
  for (const record of records) {
    if (record.ts === null) continue
    if (first === null || record.ts < first) first = record.ts
    if (last === null || record.ts > last) last = record.ts
  }
  if (first === null || last === null) return 'timestamps unavailable'
  return `${formatClock(first, zone)} to ${formatClock(last, zone)} ${zone.toUpperCase()}`
}
