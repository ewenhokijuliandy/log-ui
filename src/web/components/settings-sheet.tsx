import { useEffect, useState } from 'react'
import { formatNumber } from '../lib/format-time.ts'
import { DialogFrame, Segment } from './dialog-frame.tsx'
import { Icon } from './icons.tsx'

type SettingsPrefs = {
  theme: 'system' | 'dark' | 'light'
  zone: 'utc' | 'local'
  autoscroll: boolean
  wrap: boolean
}

export function SettingsSheet({
  open,
  onClose,
  prefs,
  onSave,
  onOpenRules,
  port,
  bufferCap,
}: {
  open: boolean
  onClose: () => void
  prefs: SettingsPrefs
  onSave: (prefs: SettingsPrefs) => void
  onOpenRules: () => void
  port: string
  bufferCap: number
}) {
  const [draft, setDraft] = useState(prefs)

  useEffect(() => {
    if (open) setDraft(prefs)
  }, [open, prefs])

  return (
    <DialogFrame open={open} wide label="Settings" onClose={onClose}>
      <h2>Settings</h2>
      <p>One save applies every setting to the current view.</p>
      <div className="setting-row">
        <div className="setting-copy">
          <div className="name">Theme</div>
          <div className="desc">System follows the operating system.</div>
        </div>
        <Segment
          label="Theme"
          value={draft.theme}
          options={[
            { value: 'system', label: 'System' },
            { value: 'dark', label: 'Dark' },
            { value: 'light', label: 'Light' },
          ]}
          onChange={(value) => setDraft({ ...draft, theme: value as SettingsPrefs['theme'] })}
        />
      </div>
      <div className="setting-row">
        <div className="setting-copy">
          <div className="name">Timestamp zone</div>
          <div className="desc">Applies to rows, the inspector and exports.</div>
        </div>
        <Segment
          label="Timestamp zone"
          value={draft.zone}
          options={[
            { value: 'utc', label: 'UTC' },
            { value: 'local', label: 'Local' },
          ]}
          onChange={(value) => setDraft({ ...draft, zone: value as SettingsPrefs['zone'] })}
        />
      </div>
      <div className="setting-row">
        <div className="setting-copy">
          <div className="name">Auto-scroll</div>
          <div className="desc">Keeps the newest line in view while a stream is live.</div>
        </div>
        <Segment
          label="Auto-scroll"
          value={draft.autoscroll ? 'on' : 'off'}
          options={[
            { value: 'on', label: 'On' },
            { value: 'off', label: 'Off' },
          ]}
          onChange={(value) => setDraft({ ...draft, autoscroll: value === 'on' })}
        />
      </div>
      <div className="setting-row">
        <div className="setting-copy">
          <div className="name">Word wrap</div>
          <div className="desc">Off keeps long lines on one row, truncated at the panel edge.</div>
        </div>
        <Segment
          label="Word wrap"
          value={draft.wrap ? 'on' : 'off'}
          options={[
            { value: 'on', label: 'On' },
            { value: 'off', label: 'Off' },
          ]}
          onChange={(value) => setDraft({ ...draft, wrap: value === 'on' })}
        />
      </div>
      <div className="setting-row">
        <div className="setting-copy">
          <div className="name">Parsing rules</div>
          <div className="desc">
            JSON level and time keys, numeric levels. Applies in this browser only.
          </div>
        </div>
        <button className="btn" type="button" onClick={onOpenRules}>
          <Icon name="settings" /> Edit rules
        </button>
      </div>
      <div className="setting-row">
        <div className="setting-copy">
          <div className="name">Buffer cap</div>
          <div className="desc">Retained lines per stream, fixed in this build.</div>
        </div>
        <span className="readout">{formatNumber(bufferCap)} lines</span>
      </div>
      <div className="setting-row">
        <div className="setting-copy">
          <div className="name">Daemon port</div>
          <div className="desc">Set with logdeck --port when the daemon starts.</div>
        </div>
        <span className="readout">{port}</span>
      </div>
      <div className="dialog-actions">
        <button className="btn" type="button" onClick={onClose}>
          Cancel
        </button>
        <button className="btn primary" type="button" onClick={() => onSave(draft)}>
          Save settings
        </button>
      </div>
    </DialogFrame>
  )
}
