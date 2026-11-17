import { PIPE_EXAMPLES, SHORTCUTS } from '../app/legacy-data.ts'
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
  return (
    <DialogFrame open={open} wide label="Help and shortcuts" onClose={onClose}>
      <h2>Help and shortcuts</h2>
      <p>Pipe a command into logdeck, or load a file in manual mode.</p>
      <div className="pipe-list">
        {PIPE_EXAMPLES.map((command) => (
          <PipeRow key={command} command={command} />
        ))}
      </div>
      <div className="shortcut-list">
        {SHORTCUTS.map((shortcut) => (
          <div className="shortcut-row" key={shortcut.keys}>
            <kbd>{shortcut.keys}</kbd>
            <span>{shortcut.label}</span>
          </div>
        ))}
      </div>
      <div className="dialog-actions">
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
