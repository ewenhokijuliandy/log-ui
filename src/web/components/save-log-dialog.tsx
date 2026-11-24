import { useEffect, useRef, useState } from 'react'
import { DialogFrame } from './dialog-frame.tsx'

const MAX_NAME = 120

export function SaveLogDialog({
  open,
  streamName,
  defaultName,
  onCancel,
  onConfirm,
}: SaveLogDialogProps) {
  const [name, setName] = useState(defaultName)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!open) return
    setName(defaultName)
    const node = inputRef.current
    if (node === null) return
    node.focus()
    node.select()
  }, [open, defaultName])

  const trimmed = name.trim()

  function submit(): void {
    if (trimmed.length === 0) return
    onConfirm(trimmed)
  }

  return (
    <DialogFrame open={open} label="Save log" onClose={onCancel} className="save-dialog">
      <h2>Save log</h2>
      <p>
        Keep a snapshot of <strong>{streamName}</strong>. Saved logs survive restarts and clearing
        the buffer.
      </p>
      <label className="field">
        <span className="field-label">Name</span>
        <input
          ref={inputRef}
          type="text"
          aria-label="Saved log name"
          autoComplete="off"
          spellCheck={false}
          maxLength={MAX_NAME}
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault()
              submit()
            }
          }}
        />
      </label>
      <div className="dialog-actions">
        <button className="btn" type="button" onClick={onCancel}>
          Cancel
        </button>
        <button
          className="btn primary"
          type="button"
          disabled={trimmed.length === 0}
          onClick={submit}
        >
          Save log
        </button>
      </div>
    </DialogFrame>
  )
}

export type SaveLogDialogProps = {
  open: boolean
  streamName: string
  defaultName: string
  onCancel: () => void
  onConfirm: (name: string) => void
}
