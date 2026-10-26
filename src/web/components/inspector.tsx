import { useEffect, useMemo, useRef, useState } from 'react'
import type { LogRecord } from '../../shared/types.ts'
import { INSPECTOR_MAX_WIDTH, INSPECTOR_MIN_WIDTH } from '../app/prefs.ts'
import { useUi } from '../app/ui.ts'
import { copyText } from '../lib/clipboard.ts'
import type { Zone } from '../lib/format-time.ts'
import { formatNumber, formatTime } from '../lib/format-time.ts'
import { copyValueText, jsonEntries, jsonLeafText } from '../lib/json-value.ts'
import { Icon } from './icons.tsx'

const COPIED_MS = 1_200

export function Inspector({
  record,
  zone,
  width,
  onWidth,
  onResetWidth,
  onCopyRaw,
  onCopyJson,
}: InspectorProps) {
  const close = useUi((state) => state.setInspectorOpen)
  const setIsolate = useUi((state) => state.setIsolate)
  const [copied, setCopied] = useState<{ seq: number; key: string } | null>(null)
  const copiedTimer = useRef<number | null>(null)

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

  useEffect(() => {
    return () => {
      if (copiedTimer.current !== null) window.clearTimeout(copiedTimer.current)
    }
  }, [])

  if (record === null) return null

  const recordSeq = record.seq
  const copiedKey = copied !== null && copied.seq === recordSeq ? copied.key : null

  function flash(key: string): void {
    setCopied({ seq: recordSeq, key })
    if (copiedTimer.current !== null) window.clearTimeout(copiedTimer.current)
    copiedTimer.current = window.setTimeout(() => setCopied(null), COPIED_MS)
  }

  async function copyNode(path: string, value: unknown): Promise<void> {
    const ok = await copyText(copyValueText(value))
    if (ok) flash(path)
  }

  async function copyFoot(key: string, action: () => Promise<boolean>): Promise<void> {
    const ok = await action()
    if (ok) flash(key)
  }

  const jsonRoot = record.json === null ? [] : jsonEntries(record.json)

  return (
    <aside className="inspector" aria-label="Line detail">
      <InspectorResizer width={width} onWidth={onWidth} onReset={onResetWidth} />
      <header className="inspector-head">
        <div>
          <h2>{`Line ${formatNumber(record.seq)}`}</h2>
          <p className="inspector-meta">
            {record.ids.length > 0
              ? record.ids.map((id) => short(id)).join(' · ')
              : formatTime(record.ts, zone)}
          </p>
        </div>
        <button
          className="icon-btn"
          type="button"
          title="Close inspector"
          aria-label="Close inspector"
          onClick={() => close(false)}
        >
          <Icon name="x" />
        </button>
      </header>
      <div className="inspector-body">
        <section className="insp-section">
          <div className="insp-label">Raw line</div>
          <pre className="raw">{record.raw}</pre>
        </section>
        <section className="insp-section">
          <div className="insp-label">Parsed fields</div>
          <dl className="parsed">
            {parsed.map((item) => (
              <InspectorField
                key={`${item.key}-${item.value}`}
                label={item.key}
                value={item.value}
              />
            ))}
          </dl>
        </section>
        {record.json !== null ? (
          <section className="insp-section">
            <div className="insp-label">JSON body</div>
            <div className="json-tree">
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
          </section>
        ) : null}
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
        <button className="btn" type="button" onClick={() => void copyFoot('raw', onCopyRaw)}>
          <Icon name={copiedKey === 'raw' ? 'check' : 'copy'} />
          {copiedKey === 'raw' ? 'Copied' : 'Copy raw'}
        </button>
        <button className="btn" type="button" onClick={() => void copyFoot('json', onCopyJson)}>
          <Icon name={copiedKey === 'json' ? 'check' : 'copy'} />
          {copiedKey === 'json' ? 'Copied' : 'Copy JSON'}
        </button>
      </footer>
    </aside>
  )
}

function short(value: string): string {
  return value.slice(0, 8)
}

export type InspectorProps = {
  record: LogRecord | null
  zone: Zone
  width: number
  onWidth: (width: number) => void
  onResetWidth: () => void
  onCopyRaw: () => Promise<boolean>
  onCopyJson: () => Promise<boolean>
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

type JsonNodeProps = {
  name: string
  value: unknown
  depth: number
  path: string
  copied: string | null
  onCopy: (path: string, value: unknown) => Promise<void>
}

function JsonNodes({ name, value, depth, path, copied, onCopy }: JsonNodeProps) {
  if (value === null || typeof value !== 'object') {
    return (
      <JsonLeaf
        name={name}
        value={value}
        depth={depth}
        path={path}
        copied={copied}
        onCopy={onCopy}
      />
    )
  }
  const entries = jsonEntries(value)
  const shape = Array.isArray(value) ? `[${entries.length}]` : `{${entries.length}}`
  return (
    <details open={depth === 0}>
      <summary style={{ paddingLeft: `${String(depth * 12)}px` }}>
        <span className="json-key">{name}:</span>
        <span className="json-punct"> {shape}</span>
        <button
          className={`json-copy${copied === path ? ' is-copied' : ''}`}
          type="button"
          title={copied === path ? 'Copied' : `Copy ${path}`}
          aria-label={`Copy ${path}`}
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            void onCopy(path, value)
          }}
        >
          <Icon name={copied === path ? 'check' : 'copy'} />
        </button>
      </summary>
      <div>
        {entries.map(([key, child]) => (
          <JsonNodes
            key={key}
            name={key}
            value={child}
            depth={depth + 1}
            path={`${path}.${key}`}
            copied={copied}
            onCopy={onCopy}
          />
        ))}
      </div>
    </details>
  )
}

function JsonLeaf({ name, value, depth, path, copied, onCopy }: JsonNodeProps) {
  const kind =
    value === null
      ? 'null'
      : typeof value === 'boolean'
        ? 'bool'
        : typeof value === 'number'
          ? 'number'
          : 'string'
  return (
    <button
      className="json-leaf"
      type="button"
      style={{ paddingLeft: `${String(depth * 12)}px` }}
      title={copied === path ? 'Copied' : 'Copy value'}
      aria-label={`Copy ${path}`}
      onClick={() => void onCopy(path, value)}
    >
      <span className="json-key">{name}:</span>
      <span className="json-punct"> </span>
      <span className={`val-${kind}`}>{jsonLeafText(value)}</span>
      {copied === path ? (
        <span className="json-copied" role="status">
          Copied
        </span>
      ) : null}
    </button>
  )
}
