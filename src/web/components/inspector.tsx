import { useMemo } from 'react'
import type { LogRecord } from '../../shared/types.ts'
import { useUi } from '../app/ui.ts'
import type { Zone } from '../lib/format-time.ts'
import { formatNumber, formatTime } from '../lib/format-time.ts'
import { Icon } from './icons.tsx'

export function Inspector({ record, zone, onCopyRaw, onCopyJson }: InspectorProps) {
  const close = useUi((state) => state.setInspectorOpen)
  const setIsolate = useUi((state) => state.setIsolate)

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

  if (record === null) return null

  const title = `Line ${formatNumber(record.seq)}`

  return (
    <aside className="inspector" aria-label="Line detail">
      <header className="inspector-head">
        <div>
          <h2>{title}</h2>
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
              <JsonNodes name="root" value={record.json} depth={0} />
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
        <button className="btn" type="button" onClick={onCopyRaw}>
          <Icon name="copy" /> Copy raw
        </button>
        <button className="btn" type="button" onClick={onCopyJson}>
          <Icon name="copy" /> Copy JSON
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
  onCopyRaw: () => void
  onCopyJson: () => void
}

function InspectorField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd title={value}>{value}</dd>
    </div>
  )
}

export function JsonNodes({ name, value, depth }: { name: string; value: unknown; depth: number }) {
  if (value === null || typeof value !== 'object') {
    return <JsonLeaf name={name} value={value} depth={depth} />
  }
  const entries = Array.isArray(value)
    ? value.map((item, index) => [String(index), item] as const)
    : Object.entries(value as Record<string, unknown>)
  return (
    <details open>
      <summary>
        <span className="json-key">{name}:</span>
        <span className="json-punct">
          {Array.isArray(value) ? ` [${entries.length}]` : ` {${entries.length}}`}
        </span>
      </summary>
      <div style={{ paddingLeft: `${String(depth === 0 ? 0 : 12)}px` }}>
        {entries.map(([key, child]) => (
          <JsonNodes key={key} name={key} value={child} depth={depth + 1} />
        ))}
      </div>
    </details>
  )
}

function JsonLeaf({ name, value, depth }: { name: string; value: unknown; depth: number }) {
  const kind =
    value === null
      ? 'null'
      : typeof value === 'boolean'
        ? 'bool'
        : typeof value === 'number'
          ? 'number'
          : 'string'
  return (
    <div className="json-leaf" style={{ paddingLeft: `${String(depth * 12)}px` }}>
      <span className="json-key">{name}:</span>
      <span className="json-punct"> </span>
      <span className={`val-${kind}`}>
        {typeof value === 'string' ? `"${value}"` : value === null ? 'null' : String(value)}
      </span>
    </div>
  )
}
