import { useEffect, useState } from 'react'
import { useAppInfo } from '../app/app-info.ts'
import { formatNumber } from '../lib/format-time.ts'
import { formatUptime } from '../lib/format-uptime.ts'
import { DialogFrame, Segment } from './dialog-frame.tsx'
import { Icon } from './icons.tsx'

type SettingsPrefs = {
  theme: 'system' | 'dark' | 'light'
  zone: 'utc' | 'local'
  autoscroll: boolean
  wrap: boolean
}

const PRESETS = [5_000, 10_000, 25_000, 50_000]

export function SettingsSheet({
  open,
  onClose,
  prefs,
  onSave,
  onOpenRules,
  onSaveBufferCap,
  port,
  bufferCap,
}: {
  open: boolean
  onClose: () => void
  prefs: SettingsPrefs
  onSave: (prefs: SettingsPrefs) => void
  onOpenRules: () => void
  onSaveBufferCap: (value: number) => Promise<string | null>
  port: string
  bufferCap: number
}) {
  const version = useAppInfo((state) => state.version)
  const pid = useAppInfo((state) => state.pid)
  const startedAt = useAppInfo((state) => state.startedAt)
  const loaded = useAppInfo((state) => state.loaded)
  const [draft, setDraft] = useState(prefs)
  const [capChoice, setCapChoice] = useState(String(bufferCap))
  const [customCap, setCustomCap] = useState(String(bufferCap))
  const [capError, setCapError] = useState('')

  useEffect(() => {
    if (!open) return
    setDraft(prefs)
    setCapChoice(PRESETS.includes(bufferCap) ? String(bufferCap) : 'custom')
    setCustomCap(String(bufferCap))
    setCapError('')
  }, [open, prefs, bufferCap])

  function readCap(): number | null {
    const selected = capChoice === 'custom' ? Number(customCap) : Number(capChoice)
    if (!Number.isInteger(selected) || selected < 1000 || selected > 50000) return null
    return selected
  }

  async function save(): Promise<void> {
    const cap = readCap()
    if (cap === null) {
      setCapError('Use a whole number from 1,000 to 50,000 lines.')
      return
    }
    const error = await onSaveBufferCap(cap)
    if (error !== null) {
      setCapError(error)
      return
    }
    onSave(draft)
  }

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
          <div className="name">Buffer limit</div>
          <div className="desc">
            Retained lines per stream. Applies live to every stream on this daemon; max 50,000.
          </div>
        </div>
        <div className="buffer-cap-control">
          <label className="select-wrap">
            <select
              aria-label="Buffer limit preset"
              value={capChoice}
              onChange={(event) => {
                setCapChoice(event.target.value)
                setCapError('')
              }}
            >
              {PRESETS.map((value) => (
                <option key={value} value={String(value)}>
                  {formatNumber(value)} lines
                </option>
              ))}
              <option value="custom">Custom…</option>
            </select>
            <Icon name="chevron" />
          </label>
          {capChoice === 'custom' ? (
            <input
              aria-label="Custom buffer limit"
              className="buffer-cap-input"
              type="number"
              min={1000}
              max={50000}
              step={1000}
              value={customCap}
              onChange={(event) => {
                setCustomCap(event.target.value)
                setCapError('')
              }}
            />
          ) : null}
        </div>
      </div>
      {capError === '' ? null : (
        <p className="guard buffer-cap-error" role="alert">
          {capError}
        </p>
      )}
      <div className="setting-row">
        <div className="setting-copy">
          <div className="name">Version</div>
          <div className="desc">The daemon serving this workspace.</div>
        </div>
        <div className="version-readout">
          {versionState(loaded, version)}
          <span className="version-sub">{daemonState(loaded, pid, startedAt)}</span>
        </div>
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
        <button className="btn primary" type="button" onClick={() => void save()}>
          Save settings
        </button>
      </div>
    </DialogFrame>
  )
}

function versionState(loaded: boolean, version: string | null): string {
  if (!loaded) return 'Checking…'
  if (version === null) return 'Unavailable'
  return `logdeck ${version}`
}

function daemonState(loaded: boolean, pid: number | null, startedAt: number | null): string {
  if (!loaded) return 'Reading daemon info'
  if (pid === null || startedAt === null) return 'Daemon unreachable'
  return `pid ${String(pid)} · up ${formatUptime(startedAt, Date.now())}`
}
