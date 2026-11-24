import type { StreamEntry } from '../app/store.ts'
import { formatNumber } from '../lib/format-time.ts'

export function StreamHeader({
  entry,
  totalLines,
  droppedLines,
  bootError,
  onClearBuffer,
  onSave,
  canSave = true,
  saveDisabled = false,
}: {
  entry: StreamEntry
  totalLines: number
  droppedLines: number
  bootError: string | null
  onClearBuffer: () => void
  onSave: () => void
  canSave?: boolean
  saveDisabled?: boolean
}) {
  return (
    <div className="title-row">
      <div className="title-block">
        <div className="title-line">
          <h1>{entry.name}</h1>
          <span
            className={`status-pill${
              entry.kind === 'manual' || entry.status === 'stopped' ? ' stopped' : ''
            }`}
          >
            <span className="dot" />
            {entry.kind === 'manual' ? 'MANUAL' : entry.status === 'stopped' ? 'STOPPED' : 'ACTIVE'}
          </span>
        </div>
        <p className="finding">
          {entry.kind === 'manual'
            ? 'Parsed in this browser. Filters, inspection and export work on these lines.'
            : (bootError ?? '')}
        </p>
      </div>
      <div className="title-meta">
        <span className="retained">
          <span className="num">
            {formatNumber(totalLines)}
            {droppedLines > 0 ? ` retained · ${formatNumber(droppedLines)} dropped` : ' retained'}
          </span>
        </span>
        <span className="title-sep" aria-hidden="true" />
        {canSave ? (
          <button
            className="btn ghost"
            type="button"
            disabled={saveDisabled}
            title={saveDisabled ? 'Nothing to save yet' : 'Save this log'}
            onClick={onSave}
          >
            Save log
          </button>
        ) : null}
        <button
          className="btn ghost btn-destructive"
          type="button"
          title="Discard the buffered lines for this stream"
          onClick={onClearBuffer}
        >
          Clear buffer
        </button>
      </div>
    </div>
  )
}
