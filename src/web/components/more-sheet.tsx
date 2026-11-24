import { DialogFrame } from './dialog-frame.tsx'
import { Icon } from './icons.tsx'

export function MoreSheet({ open, onView, onManual, onSettings, onHelp, onClose }: MoreSheetProps) {
  return (
    <DialogFrame open={open} label="More" onClose={onClose} className="more-dialog">
      <div className="more-head">
        <h2>More</h2>
        <button
          className="dialog-close"
          type="button"
          aria-label="Close more menu"
          onClick={onClose}
        >
          <Icon name="x" />
        </button>
      </div>
      <div className="more-list">
        <button className="more-item" type="button" onClick={() => onView('graphql')}>
          <Icon name="terminal" />
          <span className="grow">GraphQL</span>
          <span className="note">Formatter</span>
        </button>
        <button className="more-item" type="button" onClick={() => onView('saved')}>
          <Icon name="bookmark" />
          <span className="grow">Saved logs</span>
          <span className="note">Snapshots</span>
        </button>
        <button className="more-item" type="button" onClick={onManual}>
          <Icon name="terminal" />
          <span className="grow">Manual mode</span>
        </button>
        <button className="more-item" type="button" onClick={onSettings}>
          <Icon name="settings" />
          <span className="grow">Settings</span>
        </button>
        <button className="more-item" type="button" onClick={onHelp}>
          <Icon name="help" />
          <span className="grow">Help and shortcuts</span>
          <span className="note">?</span>
        </button>
      </div>
    </DialogFrame>
  )
}

export type MoreSheetProps = {
  open: boolean
  onView: (view: 'graphql' | 'saved') => void
  onManual: () => void
  onSettings: () => void
  onHelp: () => void
  onClose: () => void
}
