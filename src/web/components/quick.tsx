import { PIPE_EXAMPLES } from '../app/legacy-data.ts'
import { PipeRow } from './dialogs.tsx'
import { Icon } from './icons.tsx'

export function QuickStart({
  connected,
  onManual,
  onHelp,
}: {
  connected: boolean
  onManual: () => void
  onHelp: () => void
}) {
  return (
    <section className="view quick" aria-label="Quick start">
      <div className="quick-panel">
        <div className="quick-brand">
          <span className="quick-mark">
            <Icon name="mark" />
          </span>
          <h1>log-ui</h1>
        </div>
        <p className="quick-note">
          Pipe any command into log-ui and it opens this workspace with the stream in a tab.
        </p>
        <div className="quick-status">
          <span className="live-dot" />
          {connected ? 'Waiting for a stream on localhost' : 'Connecting to the daemon'}
        </div>
        <div className="pipe-list">
          {PIPE_EXAMPLES.map((command) => (
            <PipeRow key={command} command={command} />
          ))}
        </div>
        <div className="quick-actions">
          <button className="btn primary" type="button" onClick={onManual}>
            <Icon name="terminal" /> Manual mode
          </button>
          <button className="btn" type="button" onClick={onHelp}>
            <Icon name="help" /> Shortcuts
          </button>
        </div>
        <p className="quick-hint">The UI opens automatically as soon as a pipe connects.</p>
      </div>
    </section>
  )
}
