import type { LogRecord } from '../../shared/types.ts'
import type { Zone } from '../lib/format-time.ts'
import { formatNumber } from '../lib/format-time.ts'
import { DialogFrame } from './dialog-frame.tsx'
import { Inspector } from './inspector.tsx'

const noop = (): void => {}

export function DetailSheet({
  record,
  zone,
  source,
  onClose,
  onShowAll,
  showAllCount,
}: {
  record: LogRecord
  zone: Zone
  source: string | null
  onClose: () => void
  onShowAll?: () => void
  showAllCount?: number
}) {
  return (
    <DialogFrame
      open
      wide
      className="detail-sheet"
      label={`Line ${formatNumber(record.seq)}`}
      onClose={onClose}
    >
      <Inspector
        record={record}
        zone={zone}
        source={source}
        width={0}
        onWidth={noop}
        onResetWidth={noop}
        onShowAll={onShowAll}
        showAllCount={showAllCount}
        sheet
      />
    </DialogFrame>
  )
}
