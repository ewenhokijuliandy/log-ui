import { useCallback, useEffect, useMemo, useState } from 'react'
import { countLevels } from '../../shared/levels.ts'
import type { LogRecord } from '../../shared/types.ts'
import {
  deleteSavedLog,
  fetchSaved,
  fetchSavedList,
  renameSavedLog,
  type SavedMeta,
} from '../app/api.ts'
import { formatNumber, formatTime } from '../lib/format-time.ts'
import { ConfirmDialog } from './confirm-dialog.tsx'
import { Segment } from './dialog-frame.tsx'
import { Icon } from './icons.tsx'
import { Inspector } from './inspector.tsx'
import { ToolView } from './tool-view.tsx'

type SavedSort = 'newest' | 'name' | 'rows'

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'name', label: 'Name' },
  { value: 'rows', label: 'Rows' },
]

function mixLabel(counts: SavedMeta['counts']): string {
  if (counts.error > 0) return `${formatNumber(counts.error)} err`
  if (counts.warn > 0) return `${formatNumber(counts.warn)} warn`
  return 'clean'
}

function mixLabelClass(counts: SavedMeta['counts']): string {
  if (counts.error > 0) return 'saved-mix-label has-error'
  if (counts.warn > 0) return 'saved-mix-label has-warn'
  return 'saved-mix-label'
}

function LevelMix({ counts }: { counts: SavedMeta['counts'] }) {
  const total = counts.error + counts.warn + counts.info + counts.debug + counts.unknown
  if (total === 0) return <span className="saved-mix-empty">no levels</span>
  return (
    <span
      className="saved-mix"
      title={`${String(counts.error)} error · ${String(counts.warn)} warn · ${String(counts.info)} info · ${String(counts.debug)} debug`}
    >
      <span className="saved-mix-bar" aria-hidden="true">
        {counts.error === 0 ? null : <span className="error" style={{ flex: counts.error }} />}
        {counts.warn === 0 ? null : <span className="warn" style={{ flex: counts.warn }} />}
        {counts.info === 0 ? null : <span className="info" style={{ flex: counts.info }} />}
        {counts.debug === 0 ? null : <span className="debug" style={{ flex: counts.debug }} />}
        {counts.unknown === 0 ? null : (
          <span className="unknown" style={{ flex: counts.unknown }} />
        )}
      </span>
      <span className={mixLabelClass(counts)}>{mixLabel(counts)}</span>
    </span>
  )
}

export function SavedView({
  active,
  inspectorWidth,
  onInspectorWidth,
  onResetInspectorWidth,
}: SavedViewProps) {
  const [list, setList] = useState<SavedMeta[]>([])
  const [openId, setOpenId] = useState<string | null>(null)
  const [rows, setRows] = useState<LogRecord[]>([])
  const [zone, setZone] = useState<'utc' | 'local'>('utc')
  const [selectedSeq, setSelectedSeq] = useState<number | null>(null)
  const [inspectorOpen, setInspectorOpen] = useState(false)
  const [error, setError] = useState('')
  const [renaming, setRenaming] = useState<string | null>(null)
  const [draftName, setDraftName] = useState('')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SavedSort>('newest')
  const [deleteTarget, setDeleteTarget] = useState<SavedMeta | null>(null)

  const refresh = useCallback(async (): Promise<void> => {
    setList(await fetchSavedList())
  }, [])

  useEffect(() => {
    if (!active) return
    void refresh()
  }, [active, refresh])

  const openSaved = useCallback(async (id: string): Promise<void> => {
    const envelope = await fetchSaved(id)
    if (envelope === null) {
      setError('Could not open this saved log.')
      return
    }
    setError('')
    setOpenId(id)
    setRows(envelope.rows)
    setZone(envelope.zone)
    setSelectedSeq(null)
    setInspectorOpen(false)
  }, [])

  const closeSaved = (): void => {
    setOpenId(null)
    setRows([])
    setSelectedSeq(null)
    setInspectorOpen(false)
  }

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    const matched =
      needle.length === 0
        ? list
        : list.filter(
            (meta) =>
              meta.name.toLowerCase().includes(needle) ||
              meta.streamName.toLowerCase().includes(needle),
          )
    const ordered = [...matched]
    if (sort === 'name') ordered.sort((a, b) => a.name.localeCompare(b.name))
    if (sort === 'rows') ordered.sort((a, b) => b.rowCount - a.rowCount)
    if (sort === 'newest') ordered.sort((a, b) => b.savedAt - a.savedAt)
    return ordered
  }, [list, query, sort])

  const counts = useMemo(() => (rows.length === 0 ? null : countLevels(rows)), [rows])
  const selected = useMemo(
    () => (selectedSeq === null ? null : (rows.find((row) => row.seq === selectedSeq) ?? null)),
    [rows, selectedSeq],
  )

  async function commitRename(id: string): Promise<void> {
    const outcome = await renameSavedLog(id, draftName)
    setRenaming(null)
    if (!outcome.ok) {
      setError(outcome.error)
      return
    }
    await refresh()
  }

  async function remove(id: string): Promise<void> {
    const outcome = await deleteSavedLog(id)
    if (!outcome.ok) {
      setError(outcome.error)
      return
    }
    if (openId === id) closeSaved()
    await refresh()
  }

  if (openId !== null) {
    return (
      <ToolView
        title={list.find((item) => item.id === openId)?.name ?? 'Saved log'}
        description="A saved snapshot. Read-only — filters and saving are disabled here."
        flush
        actions={
          <button className="btn" type="button" onClick={closeSaved}>
            Back to saved logs
          </button>
        }
      >
        {error.length === 0 ? null : <p className="saved-error">{error}</p>}
        <div className="saved-summary">
          <span className="note">
            {formatNumber(rows.length)} rows · Times {zone === 'utc' ? 'UTC' : 'Local'}
          </span>
          {counts === null ? null : (
            <>
              <span className="removed">{formatNumber(counts.fatal + counts.error)} error</span>
              <span className="warn">{formatNumber(counts.warn)} warn</span>
              <span className="note">{formatNumber(counts.info)} info</span>
              <span className="note">{formatNumber(counts.debug + counts.trace)} debug</span>
            </>
          )}
        </div>
        <div
          className={`log-shell${inspectorOpen && selected !== null ? '' : ' no-inspector'}`}
          style={{ '--inspector-w': `${String(inspectorWidth)}px` } as React.CSSProperties}
        >
          <section className="log-panel" aria-label="Saved lines">
            <div className="log-head merge-head" aria-hidden="true">
              <span />
              <span className="h-seq">seq</span>
              <span>time</span>
              <span>level</span>
              <span>message</span>
              <span className="h-ids">ids</span>
            </div>
            <ul className="log-list">
              {rows.map((record) => (
                <li
                  key={`${String(record.seq)}-${String(record.ts)}`}
                  className="log-row"
                  tabIndex={record.seq === selectedSeq ? 0 : -1}
                  aria-current={record.seq === selectedSeq ? 'true' : undefined}
                  onClick={() => {
                    setSelectedSeq(record.seq)
                    setInspectorOpen(true)
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter' && event.key !== ' ') return
                    event.preventDefault()
                    setSelectedSeq(record.seq)
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
                  <span className="msg">{record.message}</span>
                  <span className="ids">
                    {record.ids.slice(0, 2).map((id) => (
                      <span className="trace-chip" key={id}>
                        {id.slice(0, 8)}
                      </span>
                    ))}
                  </span>
                </li>
              ))}
            </ul>
          </section>
          <Inspector
            record={selected}
            zone={zone}
            width={inspectorWidth}
            onWidth={onInspectorWidth}
            onResetWidth={onResetInspectorWidth}
          />
        </div>
      </ToolView>
    )
  }

  return (
    <ToolView
      title="Saved logs"
      description="Snapshots you saved from a stream. Rename or delete them here."
      actions={
        <button className="btn" type="button" onClick={() => void refresh()}>
          Refresh
        </button>
      }
    >
      {error.length === 0 ? null : <p className="saved-error">{error}</p>}
      <div className="saved-toolbar">
        <label className="search saved-search">
          <Icon name="search" />
          <input
            type="text"
            aria-label="Search saved logs"
            placeholder="Search name or source"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <Segment
          label="Sort saved logs"
          value={sort}
          options={SORT_OPTIONS}
          onChange={(value) =>
            setSort(value === 'name' ? 'name' : value === 'rows' ? 'rows' : 'newest')
          }
        />
        <span className="spacer" />
        <span className="saved-count">
          {visible.length === list.length
            ? `${formatNumber(list.length)} saved`
            : `${formatNumber(visible.length)} of ${formatNumber(list.length)}`}
        </span>
      </div>
      {list.length === 0 ? (
        <div className="saved-empty">
          <p className="saved-empty-title">Nothing saved yet</p>
          <p className="saved-empty-body">
            Open a stream and choose <strong>Save log</strong> in its header to keep a snapshot
            here. Saved logs survive restarts and clearing the buffer.
          </p>
        </div>
      ) : visible.length === 0 ? (
        <div className="saved-empty">
          <p className="saved-empty-title">No saved log matches “{query.trim()}”</p>
          <p className="saved-empty-body">
            Try a shorter term, or{' '}
            <button className="link" type="button" onClick={() => setQuery('')}>
              clear the search
            </button>{' '}
            to see all {formatNumber(list.length)} saved logs.
          </p>
        </div>
      ) : (
        <div className="saved-table">
          <div className="saved-head" aria-hidden="true">
            <span>name</span>
            <span>source</span>
            <span>levels</span>
            <span className="num">rows</span>
            <span className="num">saved</span>
            <span />
          </div>
          <ul className="saved-list">
            {visible.map((meta) => (
              <li className="saved-row" key={meta.id}>
                {renaming === meta.id ? (
                  <input
                    className="saved-rename"
                    aria-label={`Rename ${meta.name}`}
                    value={draftName}
                    onChange={(event) => setDraftName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') void commitRename(meta.id)
                      if (event.key === 'Escape') setRenaming(null)
                    }}
                  />
                ) : (
                  <button
                    className="saved-open"
                    type="button"
                    title={`Open ${meta.name}`}
                    onClick={() => void openSaved(meta.id)}
                  >
                    {meta.name}
                  </button>
                )}
                <span className="saved-source">
                  <span className="dot" />
                  {meta.streamName}
                </span>
                <LevelMix counts={meta.counts} />
                <span className="saved-rows">{formatNumber(meta.rowCount)}</span>
                <span className="saved-when">{formatTime(meta.savedAt, 'utc')}</span>
                <span className="saved-actions">
                  {renaming === meta.id ? (
                    <>
                      <button className="btn ghost" type="button" onClick={() => setRenaming(null)}>
                        Cancel
                      </button>
                      <button
                        className="btn ghost"
                        type="button"
                        onClick={() => void commitRename(meta.id)}
                      >
                        Save
                      </button>
                    </>
                  ) : (
                    <button
                      className="btn ghost"
                      type="button"
                      aria-label={`Rename ${meta.name}`}
                      onClick={() => {
                        setRenaming(meta.id)
                        setDraftName(meta.name)
                      }}
                    >
                      Rename
                    </button>
                  )}
                  <button
                    className="btn ghost saved-delete"
                    type="button"
                    aria-label={`Delete ${meta.name}`}
                    title={`Delete ${meta.name}`}
                    disabled={renaming === meta.id}
                    onClick={() => setDeleteTarget(meta)}
                  >
                    <Icon name="trash" />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <ConfirmDialog
        open={deleteTarget !== null}
        title={deleteTarget === null ? 'Delete saved log' : `Delete “${deleteTarget.name}”?`}
        body="This removes the snapshot from disk. It cannot be undone."
        confirmLabel="Delete log"
        cancelLabel="Keep log"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          const target = deleteTarget
          setDeleteTarget(null)
          if (target !== null) void remove(target.id)
        }}
      />
    </ToolView>
  )
}

export type SavedViewProps = {
  active: boolean
  inspectorWidth: number
  onInspectorWidth: (width: number) => void
  onResetInspectorWidth: () => void
}
