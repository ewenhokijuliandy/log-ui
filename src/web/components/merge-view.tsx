import { useEffect, useMemo, useState } from 'react'
import { countLevels, emptyLevelCounts } from '../../shared/levels.ts'
import type { LogRecord } from '../../shared/types.ts'
import { loadParseRules } from '../app/parse-rules.ts'
import { useStreams } from '../app/store.ts'
import { useUi } from '../app/ui.ts'
import { DEFAULT_FILTER, DEFAULT_SORT, type FilterState, type SortKey } from '../lib/filters.ts'
import { formatNumber, formatTime } from '../lib/format-time.ts'
import {
  type MergedRow,
  mergedExportText,
  mergedPauseKeys,
  mergeStreamRecords,
  orderMergedRows,
  visibleMergedRows,
} from '../lib/merged-timeline.ts'
import { downloadText } from './export.tsx'
import { Icon } from './icons.tsx'
import { Inspector } from './inspector.tsx'
import { LevelBar } from './level-bar.tsx'
import { MergeSelector } from './merge-selector.tsx'
import { SignalStrip } from './signal.tsx'
import { ToolView } from './tool-view.tsx'

export function MergeView() {
  const streams = useStreams((state) => state.streams)
  const bufferCap = useStreams((state) => state.bufferCap)
  const isolateTrace = useUi((state) => state.isolateTrace)
  const setIsolate = useUi((state) => state.setIsolate)
  const selectedMergedKey = useUi((state) => state.selectedMergedKey)
  const selectMerged = useUi((state) => state.selectMerged)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [filter, setFilter] = useState<FilterState>(() => ({ ...DEFAULT_FILTER }))
  const [sort] = useState<SortKey>(DEFAULT_SORT)
  const [pausedKeys, setPausedKeys] = useState<Set<string> | null>(null)
  const [selectorOpen, setSelectorOpen] = useState(false)
  const [wrap, setWrap] = useState(false)
  const rules = useMemo(() => loadParseRules(), [])

  const selectedEntries = useMemo(
    () => selectedIds.map((id) => streams.find((entry) => entry.id === id)).filter(Boolean),
    [selectedIds, streams],
  )

  useEffect(() => {
    const live = new Set(streams.map((entry) => entry.id))
    setSelectedIds((ids) => ids.filter((id) => live.has(id)))
  }, [streams])

  const merged = useMemo(() => {
    const entries = selectedEntries.filter((entry) => entry !== undefined)
    return mergeStreamRecords(entries, rules, bufferCap)
  }, [selectedEntries, rules, bufferCap])

  const frozen = useMemo(() => {
    if (pausedKeys === null) return merged.rows
    return merged.rows.filter((row) => pausedKeys.has(row.key))
  }, [merged.rows, pausedKeys])

  const visible = useMemo(
    () => visibleMergedRows(frozen, filter, isolateTrace, sort),
    [frozen, filter, isolateTrace, sort],
  )

  const counts = useMemo(() => {
    if (frozen.length === 0) return emptyLevelCounts()
    return countLevels(frozen.map((row) => row.record))
  }, [frozen])

  const selectedRow = useMemo(
    () => merged.rows.find((row) => row.key === selectedMergedKey) ?? null,
    [merged.rows, selectedMergedKey],
  )

  useEffect(() => {
    if (merged.rows.length === 0) return
    if (selectedRow !== null) return
    const newest = merged.rows[merged.rows.length - 1]
    if (newest === undefined) return
    selectMerged(newest.key)
  }, [merged.rows, selectedRow, selectMerged])

  const chipCounts = {
    error: counts.fatal + counts.error,
    warn: counts.warn,
    info: counts.info,
    debug: counts.debug + counts.trace,
    unknown: counts.unknown,
  }
  const totalCount = frozen.length
  const pending = pausedKeys === null ? 0 : merged.rows.length - pausedKeys.size
  const paused = pausedKeys !== null

  function togglePause(): void {
    if (pausedKeys !== null) {
      setPausedKeys(null)
      return
    }
    setPausedKeys(mergedPauseKeys(merged.rows))
  }

  function exportTxt(): void {
    downloadText('merged', mergedExportText(orderMergedRows(visible, sort)))
  }

  const emptyText =
    selectedIds.length < 2
      ? 'Select at least two streams to merge.'
      : visible.length === 0
        ? 'No lines match the current filters.'
        : ''

  return (
    <ToolView
      title="Merge log"
      description="Two streams on one timeline. Each row names the stream it came from."
      flush
      actions={
        <button className="btn" type="button" onClick={() => setSelectorOpen(true)}>
          {selectedIds.length === 0 ? 'Select streams' : `${String(selectedIds.length)} streams`}
        </button>
      }
    >
      <div className="merge-chips">
        <span className="merge-chips-label">Merging</span>
        {selectedEntries.map((entry) =>
          entry === undefined ? null : (
            <span className="merge-chip" key={entry.id}>
              <span className="dot" />
              <span className="merge-chip-name">{entry.name}</span>
              <button
                type="button"
                aria-label={`Remove ${entry.name} from the merge`}
                onClick={() => setSelectedIds((ids) => ids.filter((id) => id !== entry.id))}
              >
                ×
              </button>
            </span>
          ),
        )}
        <button className="link" type="button" onClick={() => setSelectorOpen(true)}>
          + Add stream
        </button>
        <span className="spacer" />
        {merged.truncated ? (
          <span className="merge-chips-note">
            Showing the newest {formatNumber(bufferCap)} lines
          </span>
        ) : null}
        <span className="merge-chips-count">{selectedIds.length} selected</span>
      </div>

      <div className="toolbar">
        <label className="search">
          <Icon name="search" />
          <input
            type="text"
            aria-label="Search streams and logs"
            placeholder="Search streams and logs"
            value={filter.query}
            onChange={(event) => setFilter({ ...filter, query: event.target.value })}
          />
        </label>
        <LevelBar
          filter={filter}
          onFilter={setFilter}
          chipCounts={chipCounts}
          totalCount={totalCount}
        />
        <div className="tools">
          <button
            className="tool"
            type="button"
            aria-pressed={wrap}
            title="Wrap long lines"
            aria-label="Wrap long lines"
            onClick={() => setWrap(!wrap)}
          >
            <Icon name="wrap" />
            <span className="label">Wrap</span>
          </button>
          <button
            className="tool"
            type="button"
            aria-pressed={paused}
            title={paused ? 'Resume the merged view' : 'Pause the merged view'}
            aria-label={paused ? 'Resume the merged view' : 'Pause the merged view'}
            onClick={togglePause}
          >
            <Icon name={paused ? 'play' : 'pause'} />
            <span className="label">{paused ? `Resume ${formatNumber(pending)}` : 'Pause'}</span>
          </button>
          <button
            className="tool"
            type="button"
            title="Export the merged view as text"
            aria-label="Export the merged view as text"
            onClick={exportTxt}
          >
            <Icon name="download" />
            <span className="label">Export</span>
          </button>
        </div>
      </div>

      <SignalStrip records={frozen.map((row) => row.record)} zone="utc" />

      <div className="log-shell">
        <section className="log-panel" aria-label="Merged lines">
          {isolateTrace === null ? null : (
            <div className="isolate-banner open">
              <Icon name="isolate" />
              <span>Isolated trace</span>
              <span className="trace-chip">{isolateTrace.slice(0, 8)}</span>
              <span>{formatNumber(visible.length)} lines</span>
              <button className="link" type="button" onClick={() => setIsolate(null)}>
                Clear isolation
              </button>
            </div>
          )}
          {paused ? (
            <div className="pause-banner" role="status">
              <Icon name="pause" />
              <span>Paused</span> <span className="badge">{formatNumber(pending)}</span>{' '}
              <span>new {pending === 1 ? 'line' : 'lines'} buffered</span>{' '}
              <button className="link" type="button" onClick={togglePause}>
                Resume
              </button>
            </div>
          ) : null}
          <div className="log-head merge-head" aria-hidden="true">
            <span />
            <span className="h-seq">seq</span>
            <span>time</span>
            <span>stream</span>
            <span>level</span>
            <span>message</span>
            <span className="h-ids">ids</span>
          </div>
          <ul className={`log-list merge-list${wrap ? ' wrap' : ''}`}>
            {visible.length === 0 ? (
              <p className="log-empty open">{emptyText}</p>
            ) : (
              visible.map((row) => (
                <MergedRowView
                  key={row.key}
                  row={row}
                  selected={row.key === selectedMergedKey}
                  onSelect={() => selectMerged(row.key)}
                />
              ))
            )}
          </ul>
        </section>
        <Inspector
          record={selectedRow === null ? null : selectedRow.record}
          zone="utc"
          source={selectedRow === null ? null : selectedRow.streamName}
          width={440}
          onWidth={() => undefined}
          onResetWidth={() => undefined}
        />
      </div>

      <MergeSelector
        open={selectorOpen}
        streams={streams}
        selectedIds={selectedIds}
        onChange={setSelectedIds}
        onClose={() => setSelectorOpen(false)}
      />
    </ToolView>
  )
}

function MergedRowView({
  row,
  selected,
  onSelect,
}: {
  row: MergedRow
  selected: boolean
  onSelect: () => void
}) {
  const record: LogRecord = row.record
  return (
    <li
      className="log-row merge-row"
      tabIndex={selected ? 0 : -1}
      aria-current={selected ? 'true' : undefined}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return
        event.preventDefault()
        onSelect()
      }}
    >
      <span className="thread" aria-hidden="true" />
      <span className="seq">{formatNumber(record.seq)}</span>
      <span className="time">{formatTime(record.ts, 'utc')}</span>
      <span className="source">
        <span className="dot" />
        {row.streamName}
      </span>
      <span className={`level ${record.level}`}>
        <span className="dot" />
        {record.level.toUpperCase()}
      </span>
      <span className="msg">
        <span className="msg-text">{record.message}</span>
      </span>
      <span className="ids">
        {record.ids.slice(0, 2).map((id) => (
          <span className="trace-chip" key={id}>
            {id.slice(0, 8)}
          </span>
        ))}
      </span>
    </li>
  )
}
