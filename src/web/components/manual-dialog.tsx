import { useRef, useState } from 'react'
import type { ParseRules } from '../../shared/parse-rules.ts'
import type { LogRecord } from '../../shared/types.ts'
import { MANUAL_SAMPLE } from '../app/legacy-data.ts'
import { manualFileProblem, parseManual } from '../lib/manual.ts'
import { DialogFrame } from './dialog-frame.tsx'
import { Icon } from './icons.tsx'

export function ManualDialog({
  open,
  cap,
  rules,
  onClose,
  onParse,
}: {
  open: boolean
  cap: number
  rules: ParseRules
  onClose: () => void
  onParse: (records: LogRecord[], totalLines: number) => void
}) {
  const [text, setText] = useState('')
  const [guard, setGuard] = useState('')
  const [over, setOver] = useState(false)
  const [fileLabel, setFileLabel] = useState('Drop a .txt or .log file here')
  const fileInput = useRef<HTMLInputElement | null>(null)

  const readFile = async (file: File): Promise<void> => {
    const problem = manualFileProblem(file)
    if (problem !== null) {
      setFileLabel('Drop a .txt or .log file here')
      setGuard(problem)
      return
    }
    try {
      const raw = await file.text()
      setText(raw)
      setFileLabel(`${file.name} · ${(file.size / 1024).toFixed(1)} kB`)
      setGuard('')
    } catch {
      setFileLabel('Drop a .txt or .log file here')
      setGuard('That file could not be read. Try a .txt or .log file.')
    }
  }

  return (
    <DialogFrame open={open} wide label="Manual mode" onClose={onClose}>
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
      <p className="guard" role={guard === '' ? undefined : 'alert'}>
        {guard}
      </p>
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
            const result = parseManual(text, cap, rules)
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
