import { useEffect, useState } from 'react'
import { useUi } from '../app/ui.ts'
import { type PrettifyIndent, prettifyJsonText } from '../lib/json-format.ts'
import { useCopyFeedback } from '../lib/use-copy-feedback.ts'
import { Segment } from './dialog-frame.tsx'
import { Icon } from './icons.tsx'
import { JsonText } from './json-tree.tsx'
import { ToolView } from './tool-view.tsx'

const SAMPLE =
  '{"order_id":"ord_8841","status":"pending","amount":128.4,"items":[{"sku":"SKU-4471","qty":2}]}'

export function PrettyView() {
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [error, setError] = useState('')
  const [decoded, setDecoded] = useState(false)
  const [indent, setIndent] = useState<PrettifyIndent>(2)
  const [mode, setMode] = useState<'pretty' | 'minify'>('pretty')
  const [sortKeys, setSortKeys] = useState(false)
  const { copied, copy } = useCopyFeedback()
  const setPrettyStats = useUi((state) => state.setPrettyStats)

  const outputLines = output === '' ? 0 : output.split('\n').length

  useEffect(() => {
    setPrettyStats({ lines: outputLines })
  }, [outputLines, setPrettyStats])

  function options(pretty: boolean, spaces: PrettifyIndent, sorted: boolean) {
    return { indent: spaces, minify: !pretty, sortKeys: sorted }
  }

  function reformat(pretty: boolean, spaces: PrettifyIndent, sorted: boolean): void {
    if (output.length === 0) return
    const result = prettifyJsonText(input, options(pretty, spaces, sorted))
    setOutput(result.ok ? result.text : '')
    setDecoded(result.ok && result.decoded)
  }

  function runPrettify(): void {
    const result = prettifyJsonText(input, options(mode === 'pretty', indent, sortKeys))
    if (!result.ok) {
      setError(result.error)
      setOutput('')
      setDecoded(false)
      return
    }
    setError('')
    setOutput(result.text)
    setDecoded(result.decoded)
  }

  function clear(): void {
    setInput('')
    setOutput('')
    setError('')
    setDecoded(false)
  }

  function loadSample(): void {
    setInput(SAMPLE)
    setOutput('')
    setError('')
    setDecoded(false)
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
      <div className="diff-panes diff-panes-input">
        <div className="diff-heads">
          <div className="diff-head">
            <span>JSON IN</span>
            <button
              className="diff-head-copy"
              type="button"
              aria-label="Copy the input"
              title="Copy the input"
              onClick={() => void copy(input)}
            >
              <Icon name="copy" />
            </button>
          </div>
          <div className="diff-head right-head">
            <span>JSON OUT</span>
            <button
              className="diff-head-copy"
              type="button"
              aria-label="Copy the output"
              title="Copy the output"
              disabled={output.length === 0}
              onClick={() => void copy(output)}
            >
              <Icon name="copy" />
            </button>
          </div>
        </div>
        <div className="diff-inputs">
          <label className="diff-input-card" data-side="JSON IN">
            <textarea
              className="diff-textarea"
              aria-label="JSON in"
              placeholder='{"order_id": "ord_8841"}'
              spellCheck={false}
              value={input}
              onChange={(event) => setInput(event.target.value)}
            />
            {error.length === 0 ? null : (
              <p className="diff-input-error" role="alert">
                {error}
              </p>
            )}
          </label>
          <div className="diff-input-card" data-side="JSON OUT">
            <output
              className={`diff-textarea diff-output${output === '' ? ' empty' : ''}`}
              aria-label="Formatted JSON"
            >
              {output === '' ? 'Formatted JSON appears here.' : <JsonText text={output} />}
            </output>
          </div>
        </div>
      </div>

      <div className="diff-summary" role="status">
        {output === '' ? (
          <span>{error === '' ? 'Paste JSON, then press Prettify.' : error}</span>
        ) : (
          <>
            <span className="changed">{outputLines} lines</span>
            <span className="note">
              {mode === 'pretty' ? `${String(indent)}-space indent` : 'minified'}
              {sortKeys ? ' · keys sorted' : ''}
            </span>
            {decoded ? <span className="prettify-decoded">Escaped JSON decoded</span> : null}
          </>
        )}
        <span className="spacer" />
        <span className="note">Up to 1 MB · parsed in this browser</span>
      </div>

      <div className="diff-actions">
        <button className="btn ghost" type="button" onClick={loadSample}>
          Load sample
        </button>
        <button
          className="btn ghost"
          type="button"
          aria-pressed={sortKeys}
          onClick={toggleSortKeys}
        >
          Sort keys
        </button>
        {mode === 'pretty' ? (
          <Segment
            label="Indent"
            value={String(indent)}
            options={[
              { value: '2', label: '2 spaces' },
              { value: '4', label: '4 spaces' },
            ]}
            onChange={changeIndent}
          />
        ) : null}
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
        <span className="spacer" />
        <button className="btn primary" type="button" onClick={runPrettify}>
          Prettify
        </button>
      </div>
    </ToolView>
  )
}
