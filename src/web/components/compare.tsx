import { useEffect, useState } from 'react'
import { useUi } from '../app/ui.ts'
import {
  type DiffRow,
  diffLines,
  diffRowsToText,
  diffStats,
  pairChanged,
  prettyLines,
} from '../lib/json-line-diff.ts'
import { useCopyFeedback } from '../lib/use-copy-feedback.ts'
import { Icon } from './icons.tsx'
import { ToolView } from './tool-view.tsx'

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

function gutterSign(kind: DiffRow['kind']): string {
  if (kind === 'added') return '→'
  if (kind === 'removed') return '←'
  if (kind === 'changed') return '↔'
  return ''
}

function DiffRowView({ row }: { row: DiffRow }) {
  return (
    <div className={`diff-row ${row.kind}`}>
      <span className="diff-no left-no">{row.leftNo ?? ''}</span>
      <span className="diff-cell left">{row.leftText ?? ''}</span>
      <span className="diff-gutter" aria-hidden="true">
        {gutterSign(row.kind)}
      </span>
      <span className="diff-no right-no">{row.rightNo ?? ''}</span>
      <span className="diff-cell right">{row.rightText ?? ''}</span>
    </div>
  )
}

export function CompareView({ onBack }: { onBack: () => void }) {
  const [left, setLeft] = useState('')
  const [right, setRight] = useState('')
  const [leftError, setLeftError] = useState('')
  const [rightError, setRightError] = useState('')
  const [rows, setRows] = useState<DiffRow[]>([])
  const [message, setMessage] = useState('Paste JSON into both sides, or load the sample.')
  const [mode, setMode] = useState<'input' | 'diff'>('input')
  const [wrap, setWrap] = useState(true)
  const { copied, copy } = useCopyFeedback()
  const setCompareStats = useUi((state) => state.setCompareStats)

  const stats = diffStats(rows)

  useEffect(() => {
    if (rows.length === 0) {
      setCompareStats(null)
      return
    }
    setCompareStats({
      added: stats.added,
      removed: stats.removed,
      changed: stats.changed,
      total: rows.length,
    })
  }, [rows, stats.added, stats.removed, stats.changed, setCompareStats])

  function compare(leftText: string, rightText: string): void {
    const leftSide = parseSide(leftText)
    const rightSide = parseSide(rightText)
    setLeftError(leftSide.error)
    setRightError(rightSide.error)
    if (leftSide.error.length > 0 || rightSide.error.length > 0) {
      setRows([])
      setMessage('Fix the JSON on both sides to compare.')
      return
    }
    if (!leftSide.present || !rightSide.present) {
      setRows([])
      setMessage('Paste JSON into both sides.')
      return
    }
    const next = pairChanged(diffLines(prettyLines(leftSide.value), prettyLines(rightSide.value)))
    setRows(next)
    setMessage(next.length === 0 ? 'Identical JSON' : '')
    setMode('diff')
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
    setRows([])
    setMessage('Paste JSON into both sides, or load the sample.')
    setMode('input')
  }

  async function copyDiff(): Promise<void> {
    if (rows.length === 0) return
    await copy(diffRowsToText(rows))
  }

  function prettifyBoth(): void {
    const leftSide = parseSide(left)
    const rightSide = parseSide(right)
    setLeftError(leftSide.error)
    setRightError(rightSide.error)
    if (leftSide.error.length > 0 || rightSide.error.length > 0) {
      setRows([])
      setMessage('Both sides must be valid JSON.')
      return
    }
    if (!leftSide.present || !rightSide.present) {
      setRows([])
      setMessage('Paste JSON into both sides.')
      return
    }
    const formattedLeft = JSON.stringify(leftSide.value, null, 2)
    const formattedRight = JSON.stringify(rightSide.value, null, 2)
    setLeft(formattedLeft)
    setRight(formattedRight)
    compare(formattedLeft, formattedRight)
  }

  const modeSwitch = (
    <div className="segment">
      <button type="button" aria-pressed={mode === 'input'} onClick={() => setMode('input')}>
        Input
      </button>
      <button type="button" aria-pressed={mode === 'diff'} onClick={() => setMode('diff')}>
        Diff
      </button>
    </div>
  )

  return (
    <ToolView
      title="Compare JSON"
      description="Line-by-line. Key order is ignored; added, removed and changed lines are tinted."
      onBack={onBack}
      actions={modeSwitch}
    >
      {mode === 'input' ? (
        <div className="diff-inputs">
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
      ) : (
        <div className="diff-panes">
          <div className="diff-heads">
            <div className="diff-head">
              <span>LEFT · BEFORE</span>
              <button
                className="diff-head-copy"
                type="button"
                aria-label="Copy the left side"
                title="Copy the left side"
                onClick={() => void copy(left)}
              >
                <Icon name="copy" />
              </button>
            </div>
            <div className="diff-head right-head">
              <span>RIGHT · AFTER</span>
              <button
                className="diff-head-copy"
                type="button"
                aria-label="Copy the right side"
                title="Copy the right side"
                onClick={() => void copy(right)}
              >
                <Icon name="copy" />
              </button>
            </div>
          </div>
          <div className={`diff-scroll${wrap ? ' diff-wrap' : ''}`}>
            {rows.length === 0 ? (
              <p className="diff-empty">{message}</p>
            ) : (
              rows.map((row, index) => (
                <DiffRowView key={`${String(index)}-${row.kind}`} row={row} />
              ))
            )}
          </div>
        </div>
      )}

      <div className="diff-summary" role="status">
        {rows.length === 0 ? (
          <span>{message}</span>
        ) : (
          <>
            <span className="added">{stats.added} added</span>
            <span className="removed">{stats.removed} removed</span>
            <span className="changed">{stats.changed} changed</span>
            <span className="note">{rows.length} lines compared</span>
          </>
        )}
        <span className="spacer" />
        <button
          className="btn ghost"
          type="button"
          aria-pressed={wrap}
          onClick={() => setWrap(!wrap)}
        >
          Wrap {wrap ? 'on' : 'off'}
        </button>
        <button
          className="btn ghost"
          type="button"
          disabled={rows.length === 0}
          onClick={() => void copyDiff()}
        >
          {copied ? 'Copied' : 'Copy diff'}
        </button>
      </div>

      <div className="diff-actions">
        <button className="btn ghost" type="button" onClick={loadSample}>
          Load sample
        </button>
        <button className="btn" type="button" onClick={prettifyBoth}>
          Pretty
        </button>
        <button className="btn" type="button" onClick={swap}>
          Swap
        </button>
        <button className="btn" type="button" onClick={clear}>
          Clear
        </button>
        <button className="btn" type="button" onClick={() => setMode('input')}>
          Edit
        </button>
        <span className="spacer" />
        <button className="btn primary" type="button" onClick={runCompare}>
          Compare
        </button>
      </div>
    </ToolView>
  )
}
