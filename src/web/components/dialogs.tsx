import { type ReactNode, useEffect, useRef, useState } from 'react'
import type { LogRecord } from '../../shared/types.ts'
import { MANUAL_SAMPLE, PIPE_EXAMPLES, SHORTCUTS } from '../app/legacy-data.ts'
import { copyText } from '../lib/clipboard.ts'
import { formatNumber } from '../lib/format-time.ts'
import { MANUAL_FILE_LIMIT, parseManual } from '../lib/manual.ts'
import { Icon } from './icons.tsx'

export function DialogFrame({
  open,
  wide = false,
  className,
  onClose,
  children,
}: {
  open: boolean
  wide?: boolean
  className?: string
  onClose: () => void
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement | null>(null)

  useEffect(() => {
    if (!open) return
    const node = ref.current
    if (node === null) return
    node.showModal()
    node.focus()
    return () => {
      node.close()
    }
  }, [open])

  if (!open) return null

  return (
    <dialog
      ref={ref}
      className={[wide ? 'wide' : '', className ?? ''].join(' ').trim()}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
    >
      {children}
    </dialog>
  )
}

export function PipeRow({ command }: { command: string }) {
  return (
    <div className="pipe-row">
      <code>{command}</code>
      <button
        className="icon-btn"
        type="button"
        aria-label={`Copy ${command}`}
        title={`Copy ${command}`}
        onClick={() => void copyText(command)}
      >
        <Icon name="copy" />
      </button>
    </div>
  )
}

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  body: string
  confirmLabel: string
  cancelLabel: string
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <DialogFrame open={open} onClose={onCancel}>
      <h2>{title}</h2>
      <p>{body}</p>
      <div className="dialog-actions">
        <button className="btn" type="button" onClick={onCancel}>
          {cancelLabel}
        </button>
        <button className="btn danger" type="button" onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </DialogFrame>
  )
}

export type SegmentValue = 'system' | 'dark' | 'light' | 'utc' | 'local' | 'on' | 'off'

export function Segment({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: Array<{ value: SegmentValue; label: string }>
  onChange: (value: SegmentValue) => void
}) {
  return (
    <div className="segment" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

export function SettingsSheet({
  open,
  onClose,
  prefs,
  onSave,
  port,
  bufferCap,
}: {
  open: boolean
  onClose: () => void
  prefs: {
    theme: 'system' | 'dark' | 'light'
    zone: 'utc' | 'local'
    autoscroll: boolean
    wrap: boolean
  }
  onSave: (prefs: {
    theme: 'system' | 'dark' | 'light'
    zone: 'utc' | 'local'
    autoscroll: boolean
    wrap: boolean
  }) => void
  port: string
  bufferCap: number
}) {
  const [draft, setDraft] = useState(prefs)

  useEffect(() => {
    if (open) setDraft(prefs)
  }, [open, prefs])

  return (
    <DialogFrame open={open} wide onClose={onClose}>
      <h2>Settings</h2>
      <p>One save applies every setting on this sheet.</p>
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
          onChange={(value) => setDraft({ ...draft, theme: value as 'system' | 'dark' | 'light' })}
        />
      </div>
      <div className="setting-row">
        <div className="setting-copy">
          <div className="name">Default timestamp zone</div>
          <div className="desc">Applies to rows, the inspector and exports.</div>
        </div>
        <Segment
          label="Timestamp zone"
          value={draft.zone}
          options={[
            { value: 'utc', label: 'UTC' },
            { value: 'local', label: 'Local' },
          ]}
          onChange={(value) => setDraft({ ...draft, zone: value as 'utc' | 'local' })}
        />
      </div>
      <div className="setting-row">
        <div className="setting-copy">
          <div className="name">Default auto-scroll</div>
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
          <div className="name">Default word wrap</div>
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
          <div className="name">Buffer cap</div>
          <div className="desc">Retained lines per stream, fixed in this build.</div>
        </div>
        <span className="readout">{formatNumber(bufferCap)} lines</span>
      </div>
      <div className="setting-row">
        <div className="setting-copy">
          <div className="name">Daemon port</div>
          <div className="desc">Set with log-ui --port when the daemon starts.</div>
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
    <DialogFrame open={open} wide onClose={onClose}>
      <h2>Help and shortcuts</h2>
      <p>Pipe a command into log-ui, or load a file in manual mode.</p>
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

export function ManualDialog({
  open,
  cap,
  onClose,
  onParse,
}: {
  open: boolean
  cap: number
  onClose: () => void
  onParse: (records: LogRecord[], totalLines: number) => void
}) {
  const [text, setText] = useState('')
  const [guard, setGuard] = useState('')
  const [over, setOver] = useState(false)
  const [fileLabel, setFileLabel] = useState('Drop a .txt or .log file here')
  const fileInput = useRef<HTMLInputElement | null>(null)

  const readFile = async (file: File): Promise<void> => {
    if (file.size > MANUAL_FILE_LIMIT) {
      setFileLabel('Drop a .txt or .log file here')
      setGuard(
        `This file is ${(file.size / (1024 * 1024)).toFixed(1)} MB. Manual mode accepts up to 25 MB.`,
      )
      return
    }
    const raw = await file.text()
    setText(raw)
    setFileLabel(`${file.name} · ${(file.size / 1024).toFixed(1)} kB`)
    setGuard('')
  }

  return (
    <DialogFrame open={open} wide onClose={onClose}>
      <h2>Manual mode</h2>
      <p>Paste log text or drop a .txt / .log file. Files over 25 MB are refused before parsing.</p>
      <div className="field">
        <span className="field-label">Pasted text</span>
        <textarea
          className="paste"
          placeholder="Paste raw log lines here"
          spellCheck={false}
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
      </div>
      <div className="field">
        <span className="field-label">File</span>
        <div
          className={`drop-zone${over ? ' over' : ''}`}
          onDragOver={(event) => {
            event.preventDefault()
            setOver(true)
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(event) => {
            event.preventDefault()
            setOver(false)
            const file = event.dataTransfer.files[0]
            if (file !== undefined) void readFile(file)
          }}
        >
          <Icon name="file" />
          <span className="grow">{fileLabel}</span>
          <button className="btn" type="button" onClick={() => fileInput.current?.click()}>
            Choose file
          </button>
          <input
            type="file"
            accept=".txt,.log,text/plain"
            hidden
            ref={fileInput}
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file !== undefined) void readFile(file)
            }}
          />
        </div>
      </div>
      <p className="guard">{guard}</p>
      <div className="dialog-actions">
        <button
          className="btn ghost"
          type="button"
          onClick={() => {
            setText(MANUAL_SAMPLE)
            setFileLabel('Sample lines loaded')
            setGuard('')
          }}
        >
          Try a sample
        </button>
        <button className="btn" type="button" onClick={onClose}>
          Cancel
        </button>
        <button
          className="btn primary"
          type="button"
          onClick={() => {
            const result = parseManual(text, cap)
            if (result.totalLines === 0) {
              setGuard('Paste some log lines, drop a file, or try the sample.')
              return
            }
            onParse(result.records, result.totalLines)
            setText('')
            setFileLabel('Drop a .txt or .log file here')
            setGuard('')
            onClose()
          }}
        >
          Parse logs
        </button>
      </div>
    </DialogFrame>
  )
}

export function PrintSheet({
  open,
  title,
  meta,
  pages,
  onClose,
}: {
  open: boolean
  title: string
  meta: string
  pages: string[]
  onClose: () => void
}) {
  return (
    <DialogFrame open={open} className="print-sheet" onClose={onClose}>
      <div className="print-head">
        <h2>{title}</h2>
        <p>{meta}</p>
      </div>
      <div>
        {pages.map((content, index) => (
          <div className="print-page" key={index}>
            <pre>{content}</pre>
            <p className="page-no">
              Page {String(index + 1)} of {String(pages.length)}
            </p>
          </div>
        ))}
      </div>
      <div className="print-actions">
        <button className="btn" type="button" onClick={onClose}>
          Close
        </button>
        <button className="btn primary" type="button" onClick={() => window.print()}>
          Print
        </button>
      </div>
    </DialogFrame>
  )
}
