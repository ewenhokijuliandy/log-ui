import { useState } from 'react'
import { type PrettifyIndent, prettifyJsonText } from '../lib/json-format.ts'
import { useCopyFeedback } from '../lib/use-copy-feedback.ts'
import { DialogFrame, Segment } from './dialog-frame.tsx'

const SAMPLE =
  '{"order_id":"ord_8841","status":"pending","amount":128.4,"items":[{"sku":"SKU-4471","qty":2}]}'

export function PrettifyDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [error, setError] = useState('')
  const [indent, setIndent] = useState<PrettifyIndent>(2)
  const { copied, copy } = useCopyFeedback()

  function runPrettify(): void {
    const result = prettifyJsonText(input, indent)
    if (!result.ok) {
      setError(result.error)
      setOutput('')
      return
    }
    setError('')
    setOutput(result.text)
  }

  function clear(): void {
    setInput('')
    setOutput('')
    setError('')
  }

  function loadSample(): void {
    setInput(SAMPLE)
    setOutput('')
    setError('')
  }

  function changeIndent(value: string): void {
    const next: PrettifyIndent = value === '4' ? 4 : 2
    setIndent(next)
    if (output.length === 0) return
    const result = prettifyJsonText(input, next)
    setOutput(result.ok ? result.text : '')
  }

  return (
    <DialogFrame open={open} className="prettify-dialog" label="Prettify JSON" onClose={onClose}>
      <h2>Prettify JSON</h2>
      <p>Paste messy JSON, then copy it back formatted.</p>
      <div className="prettify-grid">
        <label className="field">
          <span className="field-label">JSON in</span>
          <textarea
            className="paste"
            placeholder='{"order_id": "ord_8841"}'
            spellCheck={false}
            value={input}
            onChange={(event) => setInput(event.target.value)}
          />
          <p className="guard" role={error.length > 0 ? 'alert' : undefined}>
            {error}
          </p>
        </label>
        <div className="field">
          <span className="field-label">JSON out</span>
          <output
            className={`prettify-out${output === '' ? ' empty' : ''}`}
            aria-label="Formatted JSON"
          >
            {output === '' ? 'Formatted JSON appears here.' : output}
          </output>
        </div>
      </div>
      <p className="prettify-note">Up to 1 MB · parsed in this browser.</p>
      <div className="prettify-footer">
        <div className="prettify-tools">
          <div className="prettify-indent">
            <span>Indent</span>
            <Segment
              label="Indent"
              value={String(indent)}
              options={[
                { value: '2', label: '2 spaces' },
                { value: '4', label: '4 spaces' },
              ]}
              onChange={changeIndent}
            />
          </div>
          <button className="btn ghost" type="button" onClick={loadSample}>
            Load sample
          </button>
        </div>
        <div className="dialog-actions">
          <button className="btn" type="button" onClick={clear}>
            Clear
          </button>
          <button
            className="btn"
            type="button"
            disabled={output.length === 0}
            onClick={() => void copy(output)}
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button className="btn primary" type="button" onClick={runPrettify}>
            Prettify
          </button>
        </div>
      </div>
    </DialogFrame>
  )
}
