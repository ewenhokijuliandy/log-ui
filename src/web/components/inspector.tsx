import { useEffect, useMemo, useRef, useState } from 'react'
import type { LogRecord } from '../../shared/types.ts'
import { INSPECTOR_MAX_WIDTH, INSPECTOR_MIN_WIDTH } from '../app/prefs.ts'
import { useUi } from '../app/ui.ts'
import type { Zone } from '../lib/format-time.ts'
import { formatNumber, formatTime } from '../lib/format-time.ts'
import { jsonTokens, prettyJson } from '../lib/json-pretty.ts'
import { copyValueText, jsonEntries } from '../lib/json-value.ts'
import { useCopyFeedback } from '../lib/use-copy-feedback.ts'
import { Icon } from './icons.tsx'
import { JsonNodes, PrettyJson } from './json-tree.tsx'

export function Inspector({
  record,
  zone,
  source = null,
  width,
  onWidth,
  onResetWidth,
  onShowAll,
  showAllCount,
  sheet = false,
}: InspectorProps) {
  const close = useUi((state) => state.setInspectorOpen)
  const setIsolate = useUi((state) => state.setIsolate)
  const { copiedKey, copy } = useCopyFeedback(record?.seq ?? null)
  const [jsonView, setJsonView] = useState<'tree' | 'pretty'>('pretty')
  const [jsonWrap, setJsonWrap] = useState(false)
  const treeRef = useRef<HTMLDivElement | null>(null)

  const parsed = useMemo(() => {
    if (record === null) return [] as Array<{ key: string; value: string }>
    const base: Array<{ key: string; value: string }> = [
      { key: 'seq', value: formatNumber(record.seq) },
      { key: 'time', value: formatTime(record.ts, zone) },
      { key: 'level', value: record.level.toUpperCase() },
      { key: 'raw', value: record.raw.length > 84 ? `${record.raw.slice(0, 84)}…` : record.raw },
    ]
    for (const id of record.ids) base.push({ key: 'id', value: id })
    return base
  }, [record, zone])

  const parsedWithSource = useMemo(() => {
    if (source === null) return parsed
    return [{ key: 'stream', value: source }, ...parsed]
  }, [parsed, source])

  const tokens = useMemo(
    () => (record === null || record.json === null ? [] : jsonTokens(record.json)),
    [record],
  )

  if (record === null) return null

  const jsonBody = record.json
  const jsonRoot = jsonBody === null ? [] : jsonEntries(jsonBody)

  function setTreeOpen(open: boolean): void {
    const tree = treeRef.current
    if (tree === null) return
    for (const details of tree.querySelectorAll('details')) details.open = open
  }

  function copyNode(path: string, value: unknown): Promise<void> {
    return copy(copyValueText(value), path)
  }

  return (
    <aside className="inspector" aria-label="Line detail">
      {sheet ? null : <InspectorResizer width={width} onWidth={onWidth} onReset={onResetWidth} />}
      <header className="inspector-head">
        <div>
          <h2>{`Line ${formatNumber(record.seq)}`}</h2>
          <p className="inspector-meta">
            {record.ids.length > 0
              ? record.ids.map((id) => short(id)).join(' · ')
              : formatTime(record.ts, zone)}
          </p>
        </div>
        <div className="inspector-head-actions">
          {onShowAll === undefined ? null : (
            <button
              className="inspector-showall"
              type="button"
              title="Clear the filter and keep this line in view"
              onClick={onShowAll}
            >
              <Icon name="list" />
              {showAllCount === undefined
                ? 'Show all lines'
                : `Show all ${formatNumber(showAllCount)} lines`}
            </button>
          )}
          <button
            className="icon-btn"
            type="button"
            title="Close inspector"
            aria-label="Close inspector"
            onClick={() => close(false)}
          >
            <Icon name="x" />
          </button>
        </div>
      </header>
      <div className="inspector-body">
        <section className="insp-section">
          <div className="insp-label">Parsed fields</div>
          <dl className="parsed">
            {parsedWithSource.map((item) => (
              <InspectorField
                key={`${item.key}-${item.value}`}
                label={item.key}
                value={item.value}
              />
            ))}
          </dl>
        </section>
        {jsonBody === null ? (
          <section className="insp-section">
            <div className="insp-label">JSON body</div>
            <p className="json-empty">No JSON body on this line. The raw text is below.</p>
          </section>
        ) : (
          <section className="insp-section json-section">
            <div className="insp-section-head">
              <div className="insp-label">JSON body</div>
              <div className="json-actions">
                <fieldset className="segment small" aria-label="JSON view">
                  <button
                    type="button"
                    aria-pressed={jsonView === 'pretty'}
                    onClick={() => setJsonView('pretty')}
                  >
                    Pretty
                  </button>
                  <button
                    type="button"
                    aria-pressed={jsonView === 'tree'}
                    onClick={() => setJsonView('tree')}
                  >
                    Tree
                  </button>
                </fieldset>
                <button
                  className="tool"
                  type="button"
                  aria-pressed={jsonWrap}
                  title="Wrap long JSON values"
                  onClick={() => setJsonWrap(!jsonWrap)}
                >
                  Wrap
                </button>
                {jsonView === 'tree' ? (
                  <>
                    <button className="tool" type="button" onClick={() => setTreeOpen(true)}>
                      Expand
                    </button>
                    <button className="tool" type="button" onClick={() => setTreeOpen(false)}>
                      Collapse
                    </button>
                  </>
                ) : null}
                <button
                  className="tool"
                  type="button"
                  aria-label="Copy pretty JSON"
                  title={copiedKey === 'pretty' ? 'Copied' : 'Copy pretty JSON'}
                  onClick={() => void copy(prettyJson(jsonBody), 'pretty')}
                >
                  <Icon name={copiedKey === 'pretty' ? 'check' : 'copy'} />
                </button>
              </div>
            </div>
            {jsonView === 'tree' ? (
              <div className={`json-tree${jsonWrap ? ' wrap' : ''}`} ref={treeRef}>
                {jsonRoot.length === 0 ? (
                  <p className="json-empty">Empty JSON body.</p>
                ) : (
                  jsonRoot.map(([key, value]) => (
                    <JsonNodes
                      key={key}
                      name={key}
                      value={value}
                      depth={0}
                      path={key}
                      copied={copiedKey}
                      onCopy={copyNode}
                    />
                  ))
                )}
              </div>
            ) : (
              <PrettyJson tokens={tokens} wrap={jsonWrap} />
            )}
          </section>
        )}
        <section className="insp-section">
          <details className="raw-block" open={jsonBody === null}>
            <summary>Raw line</summary>
            <pre className="raw">{record.raw}</pre>
          </details>
          {record.truncated ? (
            <p className="json-note">This line was truncated at 100 KB.</p>
          ) : null}
        </section>
        {record.ids.length > 0 ? (
          <div className="trace-line">
            <span>Isolate</span>
            {record.ids.map((id) => (
              <button
                key={id}
                className="trace-chip"
                type="button"
                title={`Isolate trace ${id}`}
                onClick={() => setIsolate(id)}
              >
                {short(id)}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <footer className="inspector-foot">
        <button className="btn" type="button" onClick={() => void copy(record.raw, 'raw')}>
          <Icon name={copiedKey === 'raw' ? 'check' : 'copy'} />
          {copiedKey === 'raw' ? 'Copied' : 'Copy raw'}
        </button>
        <button
          className="btn"
          type="button"
          onClick={() => void copy(jsonCopyText(record), 'json')}
        >
          <Icon name={copiedKey === 'json' ? 'check' : 'copy'} />
          {copiedKey === 'json' ? 'Copied' : 'Copy JSON'}
        </button>
      </footer>
    </aside>
  )
}

export type InspectorProps = {
  record: LogRecord | null
  zone: Zone
  source?: string | null
  width: number
  onWidth: (width: number) => void
  onResetWidth: () => void
  onShowAll?: () => void
  showAllCount?: number
  sheet?: boolean
}

function jsonCopyText(record: LogRecord): string {
  if (record.json === null) return record.raw
  return JSON.stringify(record.json, null, 2)
}

function short(value: string): string {
  return value.slice(0, 8)
}

function InspectorField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd title={value}>{value}</dd>
    </div>
  )
}

function InspectorResizer({
  width,
  onWidth,
  onReset,
}: {
  width: number
  onWidth: (width: number) => void
  onReset: () => void
}) {
  const handleRef = useRef<HTMLHRElement | null>(null)
  const rightEdge = useRef(0)
  const dragging = useRef(false)
  const [active, setActive] = useState(false)

  useEffect(() => {
    return () => {
      document.body.classList.remove('is-resizing')
    }
  }, [])

  function finish(): void {
    dragging.current = false
    setActive(false)
    document.body.classList.remove('is-resizing')
  }

  function start(event: React.PointerEvent<HTMLHRElement>): void {
    const panel = handleRef.current?.parentElement
    if (panel === null || panel === undefined) return
    rightEdge.current = panel.getBoundingClientRect().right
    dragging.current = true
    setActive(true)
    event.currentTarget.setPointerCapture(event.pointerId)
    document.body.classList.add('is-resizing')
    event.preventDefault()
  }

  function move(event: React.PointerEvent<HTMLHRElement>): void {
    if (!dragging.current) return
    onWidth(rightEdge.current - event.clientX)
  }

  function stop(event: React.PointerEvent<HTMLHRElement>): void {
    if (!dragging.current) return
    finish()
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  function widen(): void {
    onWidth(width + 24)
  }

  return (
    <hr
      ref={handleRef}
      className={`inspector-resizer${active ? ' is-dragging' : ''}`}
      aria-orientation="vertical"
      aria-label="Resize inspector"
      aria-valuemin={INSPECTOR_MIN_WIDTH}
      aria-valuemax={INSPECTOR_MAX_WIDTH}
      aria-valuenow={width}
      tabIndex={0}
      title="Drag to resize. Double-click to reset."
      onPointerDown={start}
      onPointerMove={move}
      onPointerUp={stop}
      onPointerCancel={stop}
      onLostPointerCapture={finish}
      onDoubleClick={onReset}
      onKeyDown={(event) => {
        if (event.key === 'ArrowLeft') {
          event.preventDefault()
          widen()
        }
        if (event.key === 'ArrowRight') {
          event.preventDefault()
          onWidth(width - 24)
        }
      }}
    />
  )
}
