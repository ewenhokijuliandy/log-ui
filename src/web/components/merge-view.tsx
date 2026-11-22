import { useEffect, useMemo, useState } from 'react'
import { countLevels, emptyLevelCounts } from '../../shared/levels.ts'
import type { LogRecord } from '../../shared/types.ts'
import { loadParseRules } from '../app/parse-rules.ts'
import { useStreams } from '../app/store.ts'
import { useUi } from '../app/ui.ts'
import { DEFAULT_FILTER, DEFAULT_SORT, type FilterState, type SortKey } from '../lib/filters.ts'
import { formatNumber } from '../lib/format-time.ts'
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
import { ToolView } from './tool-view.tsx'

const MAX_STREAMS = 8

export function MergeView({ onBack }: { onBack: () => void }) {
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

  const chipCounts = {
    error: counts.fatal + counts.error,
    warn: counts.warn,
    info: counts.info,
    debug: counts.debug + counts.trace,
    unknown: counts.unknown,
  }
  const totalCount = frozen.length
  const pending = pausedKeys === null ? 0 : merged.rows.length - pausedKeys.size

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
      onBack={onBack}
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
              {entry.name}
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
        <span className="merge-chips-count">
          {selectedIds.length} of {MAX_STREAMS}
        </span>
      </div>

      <div className="merge-toolbar">
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
        <span className="spacer" />
        <button
          className="btn ghost"
          type="button"
          aria-pressed={wrap}
          onClick={() => setWrap(!wrap)}
        >
          Wrap
        </button>
        <button
          className="btn ghost"
          type="button"
          aria-pressed={pausedKeys !== null}
          onClick={togglePause}
        >
          {pausedKeys === null ? 'Pause' : `Resume (${formatNumber(pending)})`}
        </button>
        <button className="btn ghost" type="button" onClick={exportTxt}>
          Export
        </button>
      </div>

      <div className="merge-shell">
        <div className="merge-list-wrap">
          <div className="merge-head" aria-hidden="true">
            <span>seq</span>
            <span>time</span>
            <span>stream</span>
            <span>level</span>
            <span>message</span>
          </div>
          <ul className={`merge-list${wrap ? ' wrap' : ''}`} aria-label="Merged lines">
            {visible.length === 0 ? (
              <p className="diff-empty">{emptyText}</p>
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
        </div>
        <Inspector
          record={selectedRow === null ? null : selectedRow.record}
          zone="utc"
          source={selectedRow === null ? null : selectedRow.streamName}
          width={440}
          onWidth={() => undefined}
          onResetWidth={() => undefined}
        />
      </div>

      {isolateTrace === null ? null : (
        <div className="isolate-banner open">
          <Icon name="isolate" />
          <span>Isolated trace</span>
          <span>{formatNumber(visible.length)} lines</span>
          <button className="link" type="button" onClick={() => setIsolate(null)}>
            Clear isolation
          </button>
        </div>
      )}

      <MergeSelector
        open={selectorOpen}
        streams={streams}
        selectedIds={selectedIds}
        max={MAX_STREAMS}
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
      className="merge-row"
      tabIndex={selected ? 0 : -1}
      aria-current={selected ? 'true' : undefined}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return
        event.preventDefault()
        onSelect()
      }}
    >
      <span className="seq">{formatNumber(record.seq)}</span>
      <span className="time">{record.ts === null ? '-' : new Date(record.ts).toISOString()}</span>
      <span className="source">
        <span className="dot" />
        {row.streamName}
      </span>
      <span className={`level ${record.level}`}>
        <span className="dot" />
        {record.level.toUpperCase()}
      </span>
      <span className="msg">{record.message}</span>
    </li>
  )
}
