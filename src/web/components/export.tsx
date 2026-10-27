import type { LogRecord } from '../../shared/types.ts'
import type { FilterState, SortKey } from '../lib/filters.ts'
import { orderRecords, visibleRecords } from '../lib/filters.ts'
import { formatNumber } from '../lib/format-time.ts'
import { MenuItem } from './toolbar.tsx'

export function ExportMenuContent({
  count,
  cap,
  onTxt,
  onPdf,
}: {
  count: number
  cap: number
  onTxt: () => void
  onPdf: () => void
}) {
  return (
    <>
      <MenuItem label="Raw .txt" note={`${count} lines`} onPress={onTxt} />
      <MenuItem label="Formatted .pdf" onPress={onPdf} />
      <p className="menu-note">
        Exports respect the active filters and stop at the {formatNumber(cap)} line buffer cap.
      </p>
    </>
  )
}

export function exportRecords(
  records: readonly LogRecord[],
  filter: FilterState,
  isolateTrace: string | null,
  sort: SortKey,
): LogRecord[] {
  return orderRecords(visibleRecords(records, filter, isolateTrace), sort)
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
  window.setTimeout(() => URL.revokeObjectURL(url), 2_000)
}
