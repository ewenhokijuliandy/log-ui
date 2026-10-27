import { useEffect, useRef, useState } from 'react'
import { MAX_STREAM_NAME } from '../../shared/stream-name.ts'
import { type StreamEntry, useStreams } from '../app/store.ts'
import { useUi } from '../app/ui.ts'
import { formatNumber } from '../lib/format-time.ts'
import { Icon } from './icons.tsx'

export function StreamTabs({ onQuickStart, onCloseTab }: StreamTabsProps) {
  const streams = useStreams((state) => state.streams)
  const activeId = useStreams((state) => state.activeId)
  const setActive = useStreams((state) => state.setActive)
  const moveTab = useStreams((state) => state.moveTab)
  const renameStream = useStreams((state) => state.renameStream)
  const select = useUi((state) => state.select)
  const setIsolate = useUi((state) => state.setIsolate)
  const setScreen = useUi((state) => state.setScreen)

  const dragId = useRef<string | null>(null)
  const renameRef = useRef<HTMLInputElement | null>(null)
  const errorRef = useRef<HTMLSpanElement | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (editingId === null) return
    renameRef.current?.focus()
    renameRef.current?.select()
  }, [editingId])

  useEffect(() => {
    if (error === null) return
    errorRef.current?.scrollIntoView({ inline: 'nearest', block: 'nearest' })
  }, [error])

  function beginRename(entry: StreamEntry): void {
    setEditingId(entry.id)
    setDraft(entry.name)
    setError(null)
  }

  function cancelRename(): void {
    setEditingId(null)
    setDraft('')
    setError(null)
  }

  async function commitRename(entry: StreamEntry): Promise<void> {
    const result = await renameStream(entry.id, draft)
    if (!result.ok) {
      setError(result.error)
      return
    }
    cancelRename()
  }

  function activate(entry: StreamEntry): void {
    setActive(entry.id)
    select(entry.id, entry.records[entry.records.length - 1]?.seq ?? null)
    setIsolate(null)
    setScreen('stream')
  }

  function moveFocus(entry: StreamEntry, direction: 'left' | 'right' | 'first' | 'last'): void {
    const index = streams.findIndex((item) => item.id === entry.id)
    if (index < 0) return
    const next =
      direction === 'first'
        ? 0
        : direction === 'last'
          ? streams.length - 1
          : direction === 'right'
            ? (index + 1) % streams.length
            : (index - 1 + streams.length) % streams.length
    const target = streams[next]
    if (target === undefined) return
    activate(target)
    document.getElementById(`tab-${target.id}`)?.focus()
  }

  return (
    <div className="tabs">
      <div className="tab-scroll" role="tablist" aria-label="Log streams">
        {streams.map((entry) => {
          const selected = entry.id === activeId
          const editing = editingId === entry.id
          return (
            <div
              key={entry.id}
              className={`stream-tab${selected ? ' selected' : ''}${editing ? ' editing' : ''}`}
              role="presentation"
              draggable={!editing}
              title={editing ? undefined : entry.name}
              onDragStart={(event) => {
                dragId.current = entry.id
                event.dataTransfer.effectAllowed = 'move'
              }}
              onDragEnd={() => {
                dragId.current = null
              }}
              onDragOver={(event) => {
                if (dragId.current === null) return
                event.preventDefault()
                const rect = event.currentTarget.getBoundingClientRect()
                moveTab(dragId.current, entry.id, event.clientX < rect.left + rect.width / 2)
              }}
            >
              <div
                role={editing ? undefined : 'tab'}
                id={editing ? undefined : `tab-${entry.id}`}
                aria-controls={editing ? undefined : 'stream-view'}
                aria-selected={editing ? undefined : selected}
                tabIndex={editing ? undefined : selected ? 0 : -1}
                className="tab-target"
                title={editing ? undefined : `${entry.name} — double-click or F2 to rename`}
                onClick={() => {
                  if (editing) return
                  activate(entry)
                }}
                onDoubleClick={() => {
                  if (editing) return
                  beginRename(entry)
                }}
                onKeyDown={(event) => {
                  if (editing) return
                  if (event.key === 'F2') {
                    event.preventDefault()
                    beginRename(entry)
                    return
                  }
                  if (event.key === 'ArrowRight') {
                    event.preventDefault()
                    moveFocus(entry, 'right')
                    return
                  }
                  if (event.key === 'ArrowLeft') {
                    event.preventDefault()
                    moveFocus(entry, 'left')
                    return
                  }
                  if (event.key === 'Home') {
                    event.preventDefault()
                    moveFocus(entry, 'first')
                    return
                  }
                  if (event.key === 'End') {
                    event.preventDefault()
                    moveFocus(entry, 'last')
                    return
                  }
                  if (event.key !== 'Enter' && event.key !== ' ') return
                  event.preventDefault()
                  activate(entry)
                }}
              >
                <span
                  className="dot"
                  style={entry.status === 'stopped' ? { background: 'var(--faint)' } : undefined}
                />
                {editing ? (
                  <input
                    ref={renameRef}
                    className="tab-rename"
                    type="text"
                    aria-label={`Rename ${entry.name}`}
                    aria-invalid={error !== null}
                    maxLength={MAX_STREAM_NAME}
                    value={draft}
                    onClick={(event) => event.stopPropagation()}
                    onChange={(event) => {
                      setDraft(event.target.value)
                      setError(null)
                    }}
                    onKeyDown={(event) => {
                      event.stopPropagation()
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        void commitRename(entry)
                      }
                      if (event.key === 'Escape') {
                        event.preventDefault()
                        cancelRename()
                      }
                    }}
                    onBlur={cancelRename}
                  />
                ) : (
                  <>
                    <span className="tab-label" title={entry.name}>
                      {entry.name}
                    </span>
                    <span className="tab-count">{formatNumber(entry.lineCount)}</span>
                  </>
                )}
              </div>
              {editing ? null : (
                <button
                  className="close"
                  type="button"
                  tabIndex={selected ? 0 : -1}
                  aria-label={`Close ${entry.name}`}
                  title={`Close ${entry.name}`}
                  onClick={(event) => {
                    event.stopPropagation()
                    onCloseTab(entry.id)
                  }}
                >
                  <Icon name="x" />
                </button>
              )}
            </div>
          )
        })}
      </div>
      {error === null ? null : (
        <span ref={errorRef} className="tab-error" role="alert">
          {error}
        </span>
      )}
      <button
        className="tab-add"
        type="button"
        title="Open quick start"
        aria-label="Open quick start"
        onClick={onQuickStart}
      >
        <Icon name="plus" />
      </button>
    </div>
  )
}

export type StreamTabsProps = {
  onQuickStart: () => void
  onCloseTab: (id: string) => void
}
