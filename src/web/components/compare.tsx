import { useEffect, useRef, useState } from 'react'
import { copyText } from '../lib/clipboard.ts'
import {
  type DiffEntry,
  type DiffResult,
  diffJson,
  diffToText,
  diffValueText,
} from '../lib/json-diff.ts'
import { DialogFrame } from './dialogs.tsx'

const MAX_SIDE_BYTES = 1_000_000

const SAMPLE_A = JSON.stringify(
  {
    order_id: 'ord_8841',
    status: 'pending',
    amount: 128.4,
    items: [{ sku: 'SKU-4471', qty: 2 }],
    flags: { gift: false },
  },
  null,
  2,
)

const SAMPLE_B = JSON.stringify(
  {
    order_id: 'ord_8841',
    status: 'paid',
    amount: 131.9,
    items: [
      { sku: 'SKU-4471', qty: 3 },
      { sku: 'SKU-2210', qty: 1 },
    ],
    flags: { gift: false, expedited: true },
  },
  null,
  2,
)

type ParsedSide = {
  present: boolean
  value: unknown
  error: string
}

function parseSide(text: string): ParsedSide {
  const trimmed = text.trim()
  if (trimmed.length === 0) return { present: false, value: undefined, error: '' }
  if (new TextEncoder().encode(text).length > MAX_SIDE_BYTES) {
    return { present: false, value: undefined, error: 'This side is over 1 MB.' }
  }
  try {
    return { present: true, value: JSON.parse(trimmed), error: '' }
  } catch {
    return { present: false, value: undefined, error: 'This side is not valid JSON.' }
  }
}

function CompareRow({ entry }: { entry: DiffEntry }) {
  if (entry.kind === 'changed') {
    return (
      <div className="compare-row changed">
        <span className="compare-sign">~</span>
        <div>
          <div className="compare-path">{entry.path}</div>
          <div className="compare-line compare-before">
            <span className="compare-line-sign">−</span>
            {diffValueText(entry.before)}
          </div>
          <div className="compare-line compare-after">
            <span className="compare-line-sign">+</span>
            {diffValueText(entry.after)}
          </div>
        </div>
      </div>
    )
  }
  const sign = entry.kind === 'added' ? '+' : '−'
  const value = entry.kind === 'added' ? entry.after : entry.before
  return (
    <div className={`compare-row ${entry.kind}`}>
      <span className="compare-sign">{sign}</span>
      <div>
        <div className="compare-path">{entry.path}</div>
        <div
          className={`compare-line ${entry.kind === 'added' ? 'compare-after' : 'compare-before'}`}
        >
          {diffValueText(value)}
        </div>
      </div>
    </div>
  )
}

export function CompareDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [left, setLeft] = useState('')
  const [right, setRight] = useState('')
  const [leftError, setLeftError] = useState('')
  const [rightError, setRightError] = useState('')
  const [result, setResult] = useState<DiffResult | null>(null)
  const [message, setMessage] = useState('Paste JSON into both sides, or load the sample.')
  const [copied, setCopied] = useState(false)
  const copiedTimer = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (copiedTimer.current !== null) window.clearTimeout(copiedTimer.current)
    }
  }, [])

  function compare(leftText: string, rightText: string): void {
    const leftSide = parseSide(leftText)
    const rightSide = parseSide(rightText)
    setLeftError(leftSide.error)
    setRightError(rightSide.error)
    if (leftSide.error.length > 0 || rightSide.error.length > 0) {
      setResult(null)
      setMessage('Fix the JSON on both sides to compare.')
      return
    }
    if (!leftSide.present || !rightSide.present) {
      setResult(null)
      setMessage('Paste JSON into both sides.')
      return
    }
    const next = diffJson(leftSide.value, rightSide.value)
    setResult(next)
    setMessage(next.entries.length === 0 ? 'Identical JSON' : '')
  }

  function runCompare(): void {
    compare(left, right)
  }

  function loadSample(): void {
    setLeft(SAMPLE_A)
    setRight(SAMPLE_B)
    compare(SAMPLE_A, SAMPLE_B)
  }

  function swap(): void {
    const nextLeft = right
    const nextRight = left
    setLeft(nextLeft)
    setRight(nextRight)
    compare(nextLeft, nextRight)
  }

  function clear(): void {
    setLeft('')
    setRight('')
    setLeftError('')
    setRightError('')
    setResult(null)
    setMessage('Paste JSON into both sides, or load the sample.')
  }

  async function copyDiff(): Promise<void> {
    if (result === null || result.entries.length === 0) return
    const ok = await copyText(diffToText(result.entries))
    if (!ok) return
    setCopied(true)
    if (copiedTimer.current !== null) window.clearTimeout(copiedTimer.current)
    copiedTimer.current = window.setTimeout(() => setCopied(false), 1_200)
  }

  const added =
    result === null ? 0 : result.entries.filter((entry) => entry.kind === 'added').length
  const removed =
    result === null ? 0 : result.entries.filter((entry) => entry.kind === 'removed').length
  const changed =
    result === null ? 0 : result.entries.filter((entry) => entry.kind === 'changed').length

  return (
    <DialogFrame open={open} wide className="compare-dialog" label="Compare JSON" onClose={onClose}>
      <h2>Compare JSON</h2>
      <p>
        Paste two JSON documents. Key order is ignored; added, removed and changed paths are listed
        below.
      </p>
      <div className="compare-inputs">
        <label className="field">
          <span className="field-label">A · before</span>
          <textarea
            className="paste"
            placeholder='{"order_id": "ord_8841"}'
            spellCheck={false}
            value={left}
            onChange={(event) => setLeft(event.target.value)}
          />
          <p className="guard" role={leftError.length > 0 ? 'alert' : undefined}>
            {leftError}
          </p>
        </label>
        <label className="field">
          <span className="field-label">B · after</span>
          <textarea
            className="paste"
            placeholder='{"order_id": "ord_8841"}'
            spellCheck={false}
            value={right}
            onChange={(event) => setRight(event.target.value)}
          />
          <p className="guard" role={rightError.length > 0 ? 'alert' : undefined}>
            {rightError}
          </p>
        </label>
      </div>
      <div className="compare-summary" role="status">
        {result === null ? (
          <span>{message}</span>
        ) : result.entries.length === 0 ? (
          <span>Identical JSON</span>
        ) : (
          <>
            <span className="added">{added} added</span>
            <span className="removed">{removed} removed</span>
            <span className="changed">{changed} changed</span>
            {result.truncated ? (
              <span className="compare-note">diff truncated at 5,000 paths</span>
            ) : null}
          </>
        )}
      </div>
      {result !== null && result.entries.length > 0 ? (
        <div className="compare-result">
          {result.entries.map((entry) => (
            <CompareRow key={`${entry.path}-${entry.kind}`} entry={entry} />
          ))}
        </div>
      ) : null}
      <div className="dialog-actions">
        <button className="btn ghost" type="button" onClick={loadSample}>
          Load sample
        </button>
        <button className="btn" type="button" onClick={swap}>
          Swap
        </button>
        <button className="btn" type="button" onClick={clear}>
          Clear
        </button>
        <button className="btn primary" type="button" onClick={runCompare}>
          Compare
        </button>
        <button
          className="btn"
          type="button"
          disabled={result === null || result.entries.length === 0}
          onClick={() => void copyDiff()}
        >
          {copied ? 'Copied' : 'Copy diff'}
        </button>
        <button className="btn" type="button" onClick={onClose}>
          Close
        </button>
      </div>
    </DialogFrame>
  )
}
