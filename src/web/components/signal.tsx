import type { LogRecord } from '../../shared/types.ts'
import { buildSignal } from '../lib/filters.ts'
import type { Zone } from '../lib/format-time.ts'
import { formatClock } from '../lib/format-time.ts'

const TICK_KINDS = new Set(['warn', 'error', 'fatal', 'trace'])

export function SignalStrip({ records, zone }: { records: readonly LogRecord[]; zone: Zone }) {
  const signal = buildSignal(records)
  return (
    <div className="signal" aria-label="Log density over the last 60 seconds">
      <span className="signal-label">Last 60 s</span>
      <div className="signal-ticks">
        {signal.bins.map((level, index) => (
          <span key={index} className={`signal-tick${TICK_KINDS.has(level) ? ` ${level}` : ''}`} />
        ))}
      </div>
      <span className="signal-note">
        {signal.noteTs !== null ? `${formatClock(signal.noteTs, zone)} · ${signal.noteLabel}` : ''}
      </span>
    </div>
  )
}
