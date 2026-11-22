import { useEffect, useState } from 'react'
import { useUi } from '../app/ui.ts'
import { type PrettifyIndent, prettifyJsonText } from '../lib/json-format.ts'
import { useCopyFeedback } from '../lib/use-copy-feedback.ts'
import { Segment } from './dialog-frame.tsx'
import { ToolView } from './tool-view.tsx'

const SAMPLE =
  '{"order_id":"ord_8841","status":"pending","amount":128.4,"items":[{"sku":"SKU-4471","qty":2}]}'

export function PrettyView({ onBack }: { onBack: () => void }) {
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [error, setError] = useState('')
  const [indent, setIndent] = useState<PrettifyIndent>(2)
  const [mode, setMode] = useState<'pretty' | 'minify'>('pretty')
  const [sortKeys, setSortKeys] = useState(false)
  const { copied, copy } = useCopyFeedback()
  const setPrettyStats = useUi((state) => state.setPrettyStats)

  useEffect(() => {
    setPrettyStats({ lines: output === '' ? 0 : output.split('\n').length })
  }, [output, setPrettyStats])

  function options(pretty: boolean, spaces: PrettifyIndent, sorted: boolean) {
    return { indent: spaces, minify: !pretty, sortKeys: sorted }
  }

  function reformat(pretty: boolean, spaces: PrettifyIndent, sorted: boolean): void {
    if (output.length === 0) return
    const result = prettifyJsonText(input, options(pretty, spaces, sorted))
    setOutput(result.ok ? result.text : '')
  }

  function runPrettify(): void {
    const result = prettifyJsonText(input, options(mode === 'pretty', indent, sortKeys))
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
    reformat(mode === 'pretty', next, sortKeys)
  }

  function changeMode(value: string): void {
    const next = value === 'minify' ? 'minify' : 'pretty'
    setMode(next)
    reformat(next === 'pretty', indent, sortKeys)
  }

  function toggleSortKeys(): void {
    const next = !sortKeys
    setSortKeys(next)
    reformat(mode === 'pretty', indent, next)
  }

  return (
    <ToolView
      title="Pretty JSON"
      description="Paste messy JSON, then copy it back formatted. Parsed in this browser."
      onBack={onBack}
      actions={
        <Segment
          label="Format"
          value={mode}
          options={[
            { value: 'pretty', label: 'Pretty' },
            { value: 'minify', label: 'Minify' },
          ]}
          onChange={changeMode}
        />
      }
    >
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
          {mode === 'pretty' ? (
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
          ) : null}
          <button
            className="btn ghost"
            type="button"
            aria-pressed={sortKeys}
            onClick={toggleSortKeys}
          >
            Sort keys
          </button>
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
    </ToolView>
  )
}
