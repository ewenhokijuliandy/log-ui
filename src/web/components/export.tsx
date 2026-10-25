import type { LogRecord } from '../../shared/types.ts'
import type { FilterState, RangeKey, SortKey } from '../lib/filters.ts'
import { RANGE_LABELS, visibleRecords } from '../lib/filters.ts'
import { MenuItem } from './toolbar.tsx'

export function ExportMenuContent({
  count,
  onTxt,
  onPdf,
}: {
  count: number
  onTxt: () => void
  onPdf: () => void
}) {
  return (
    <>
      <MenuItem label="Raw .txt" note={`${count} lines`} onPress={onTxt} />
      <MenuItem label="Formatted .pdf" onPress={onPdf} />
      <p className="menu-note">Exports respect the active filters and stop at the buffer cap.</p>
    </>
  )
}

export function exportRecords(
  records: readonly LogRecord[],
  filter: FilterState,
  isolateTrace: string | null,
  sort: SortKey,
): LogRecord[] {
  const visible = visibleRecords(records, filter, isolateTrace)
  if (sort === 'newest') return visible
  return visible.slice().reverse()
}

export function exportText(records: readonly LogRecord[]): string {
  return records.map((record) => record.raw).join('\n')
}

export function downloadText(name: string, text: string): void {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${name}.txt`
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

const LINES_PER_PAGE = 58

export function buildPrintPages(
  streamName: string,
  records: readonly LogRecord[],
  range: RangeKey,
  zone: 'utc' | 'local',
): { title: string; meta: string; pages: string[] } {
  const pages: string[] = []
  for (let index = 0; index < records.length; index += LINES_PER_PAGE) {
    const slice = records.slice(index, index + LINES_PER_PAGE)
    pages.push(slice.map((record) => `${formatSeq(record)}  ${record.raw}`).join('\n'))
  }
  return {
    title: `log-ui · ${streamName}`,
    meta: `${String(new Date().toISOString())} · ${RANGE_LABELS[range]} · ${zone.toUpperCase()} · ${String(records.length)} lines`,
    pages,
  }
}

function formatSeq(record: LogRecord): string {
  return String(record.seq).padStart(6, ' ')
}
