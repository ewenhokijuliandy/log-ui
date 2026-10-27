import { useVirtualizer } from '@tanstack/react-virtual'
import { useEffect, useRef } from 'react'
import type { LogRecord } from '../../shared/types.ts'
import { useStreams } from '../app/store.ts'
import { useUi } from '../app/ui.ts'
import type { Zone } from '../lib/format-time.ts'
import { formatNumber, formatTime, shortId } from '../lib/format-time.ts'
import { Icon } from './icons.tsx'

export function LogList({
  visible,
  zone,
  autoscroll,
  newestFirst,
  wrap,
  isolateTrace,
  paused,
  pending,
  onResume,
  emptyText,
  onClearFilters,
}: LogListProps) {
  const listRef = useRef<HTMLDivElement | null>(null)
  const activeId = useStreams((state) => state.activeId)
  const select = useUi((state) => state.select)
  const setIsolate = useUi((state) => state.setIsolate)
  const setInspectorOpen = useUi((state) => state.setInspectorOpen)
  const activeSeq = useUi((state) =>
    activeId === null ? null : (state.selectedSeq[activeId] ?? null),
  )

  const lastIndex = visible.length - 1
  const virtualizer = useVirtualizer({
    count: visible.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => (wrap ? 46 : 30),
    getItemKey: (index) => visible[index]?.seq ?? index,
    anchorTo: 'end',
    overscan: 14,
  })

  const lastPinnedSeq = useRef<number | null>(null)
  const newestIndex = newestFirst ? 0 : lastIndex

  useEffect(() => {
    if (!autoscroll) {
      lastPinnedSeq.current = null
      return
    }
    const newest = visible[newestIndex]?.seq ?? null
    if (newest === null || newest === lastPinnedSeq.current) return
    lastPinnedSeq.current = newest
    virtualizer.scrollToIndex(newestIndex, { align: newestFirst ? 'start' : 'end' })
  }, [autoscroll, virtualizer, newestIndex, newestFirst, visible])

  const lastSelection = useRef<{
    stream: string | null
    seq: number | null
    isolate: string | null
  }>({ stream: null, seq: null, isolate: null })

  useEffect(() => {
    if (activeSeq === null) return
    const previous = lastSelection.current
    if (
      previous.stream === activeId &&
      previous.seq === activeSeq &&
      previous.isolate === isolateTrace
    ) {
      return
    }
    lastSelection.current = { stream: activeId, seq: activeSeq, isolate: isolateTrace }
    const index = visible.findIndex((record) => record.seq === activeSeq)
    if (index < 0) return
    virtualizer.scrollToIndex(index, { align: 'auto' })
  }, [virtualizer, visible, activeSeq, activeId, isolateTrace])

  const empty = visible.length === 0

  return (
    <section className={`log-panel${empty ? ' is-empty' : ''}`} aria-label="Log lines">
      {isolateTrace !== null ? (
        <div className="isolate-banner open">
          <Icon name="isolate" />
          <span>Isolated trace</span>
          <span className="trace-chip">{shortId(isolateTrace)}</span>
          <span>{formatNumber(visible.length)} lines</span>
          <button className="link" type="button" onClick={() => setIsolate(null)}>
            Clear isolation
          </button>
        </div>
      ) : null}
      {paused ? (
        <div className="pause-banner" role="status">
          <Icon name="pause" />
          <span>Paused</span>
          <span className="badge">{formatNumber(pending)}</span>
          <span>new lines buffered</span>
          <button className="link" type="button" onClick={onResume}>
            Resume
          </button>
        </div>
      ) : null}
      <div className="log-head" aria-hidden="true">
        <span />
        <span className="h-seq">seq</span>
        <span>time</span>
        <span>level</span>
        <span>message</span>
        <span className="h-ids">ids</span>
      </div>

      <div
        ref={listRef}
        className={`log-list${wrap ? ' wrap' : ''}`}
        role="log"
        aria-label="Log lines"
      >
        <div style={{ height: `${String(virtualizer.getTotalSize())}px`, position: 'relative' }}>
          {virtualizer.getVirtualItems().map((item) => {
            const record = visible[item.index]
            if (record === undefined) return null
            const selected = record.seq === activeSeq
            const thread = threadFor(record, isolateTrace, selected)
            return (
              <div
                key={record.seq}
                className="log-row"
                role="button"
                tabIndex={0}
                data-index={item.index}
                ref={virtualizer.measureElement}
                style={{ position: 'absolute', top: item.start, left: 0, width: '100%' }}
                data-thread={thread}
                aria-selected={selected}
                onClick={() => {
                  select(activeId, record.seq)
                  setInspectorOpen(true)
                }}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter' && event.key !== ' ') return
                  event.preventDefault()
                  select(activeId, record.seq)
                  setInspectorOpen(true)
                }}
              >
                <span className="thread" aria-hidden="true" />
                <span className="seq">{formatNumber(record.seq)}</span>
                <span className="time">{formatTime(record.ts, zone)}</span>
                <span className={`level ${record.level}`}>
                  <span className="dot" />
                  {record.level.toUpperCase()}
                </span>
                <span className="msg">
                  {record.json !== null ? (
                    <span className="json-mark" title="JSON body">
                      {'{ }'}
                    </span>
                  ) : null}
                  <span className="msg-text">{record.message}</span>
                </span>
                <span className="ids">
                  {record.ids.slice(0, 2).map((id) => (
                    <button
                      key={id}
                      className="trace-chip"
                      type="button"
                      title={`Isolate trace ${id}`}
                      onClick={(event) => {
                        event.stopPropagation()
                        select(activeId, record.seq)
                        setIsolate(id)
                      }}
                    >
                      {shortId(id)}
                    </button>
                  ))}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      <div className={`log-empty${empty ? ' open' : ''}`}>
        {emptyText}
        {empty && onClearFilters !== undefined ? (
          <button className="link" type="button" onClick={onClearFilters}>
            Clear filters
          </button>
        ) : null}
      </div>
    </section>
  )
}

export type LogListProps = {
  visible: readonly LogRecord[]
  zone: Zone
  autoscroll: boolean
  newestFirst: boolean
  wrap: boolean
  isolateTrace: string | null
  paused: boolean
  pending: number
  onResume: () => void
  emptyText: string
  onClearFilters?: () => void
}

function threadFor(record: LogRecord, isolateTrace: string | null, selected: boolean): string {
  if (selected && record.ids.length > 0) return 'selected'
  if (isolateTrace !== null && record.ids.includes(isolateTrace)) return 'true'
  return 'false'
}
