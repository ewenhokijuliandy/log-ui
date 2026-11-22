import { useAppInfo } from '../app/app-info.ts'
import { CLI_FLAGS, LEVEL_FILTER_TIPS, PIPE_EXAMPLES, SHORTCUTS } from '../app/legacy-data.ts'
import { formatUptime } from '../lib/format-uptime.ts'
import { DialogFrame, PipeRow } from './dialog-frame.tsx'

export function HelpSheet({
  open,
  onClose,
  onQuickStart,
}: {
  open: boolean
  onClose: () => void
  onQuickStart: () => void
}) {
  const version = useAppInfo((state) => state.version)
  const pid = useAppInfo((state) => state.pid)
  const startedAt = useAppInfo((state) => state.startedAt)
  const port = useAppInfo((state) => state.port)
  const node = useAppInfo((state) => state.node)
  const loaded = useAppInfo((state) => state.loaded)

  return (
    <DialogFrame open={open} className="help-dialog" label="Help and shortcuts" onClose={onClose}>
      <div className="help-body">
        <h2>Help and shortcuts</h2>

        <section className="help-section">
          <h3>Get started</h3>
          <p>Pipe a command into logdeck, or load a file in manual mode.</p>
          <div className="pipe-list">
            {PIPE_EXAMPLES.map((command) => (
              <PipeRow key={command} command={command} />
            ))}
          </div>
        </section>

        <section className="help-section">
          <h3>Find what matters</h3>
          <p>The severity bar filters by level. Its segments are sized by the full buffer.</p>
          <div className="mini-level-bar" aria-hidden="true">
            <span className="error" />
            <span className="warn" />
            <span className="info" />
            <span className="debug" />
            <span className="unknown" />
          </div>
          <ul className="help-tips">
            {LEVEL_FILTER_TIPS.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        </section>

        <section className="help-section">
          <h3>Keyboard shortcuts</h3>
          <div className="shortcut-list">
            {SHORTCUTS.map((shortcut) => (
              <div className="shortcut-row" key={shortcut.keys}>
                <kbd>{shortcut.keys}</kbd>
                <span>{shortcut.label}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="help-section">
          <h3>CLI flags</h3>
          <div className="help-table">
            {CLI_FLAGS.map((item) => (
              <div className="help-table-row" key={item.flag}>
                <code>{item.flag}</code>
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="help-section">
          <h3>About</h3>
          <p className="help-about-main">{aboutVersion(loaded, version)}</p>
          <p className="help-about-sub">{aboutDaemon(loaded, port, pid, startedAt, node)}</p>
          <p className="help-about-sub">
            Loopback only. No telemetry, no accounts, no logs written to disk.
          </p>
        </section>
      </div>

      <div className="help-footer">
        <button className="btn" type="button" onClick={onQuickStart}>
          Open quick start
        </button>
        <button className="btn primary" type="button" onClick={onClose}>
          Close
        </button>
      </div>
    </DialogFrame>
  )
}

function aboutVersion(loaded: boolean, version: string | null): string {
  if (!loaded) return 'Checking…'
  if (version === null) return 'logdeck · unavailable'
  return `logdeck ${version}`
}

function aboutDaemon(
  loaded: boolean,
  port: number | null,
  pid: number | null,
  startedAt: number | null,
  node: string | null,
): string {
  if (!loaded) return 'Reading daemon info'
  if (pid === null || startedAt === null) return 'Daemon unreachable'
  const parts = [
    port === null ? 'daemon' : `daemon 127.0.0.1:${String(port)}`,
    `pid ${String(pid)}`,
    `up ${formatUptime(startedAt, Date.now())}`,
  ]
  if (node !== null) parts.push(`Node ${node}`)
  return parts.join(' · ')
}
