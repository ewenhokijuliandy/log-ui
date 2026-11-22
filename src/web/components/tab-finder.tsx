import { useEffect, useMemo, useRef, useState } from 'react'
import { useStreams } from '../app/store.ts'
import { useUi } from '../app/ui.ts'
import { formatNumber } from '../lib/format-time.ts'
import { filterTabs } from '../lib/tab-filter.ts'
import { DialogFrame } from './dialog-frame.tsx'
import { Icon } from './icons.tsx'

export function TabFinder({ open, onClose }: { open: boolean; onClose: () => void }) {
  const streams = useStreams((state) => state.streams)
  const activeId = useStreams((state) => state.activeId)
  const setActive = useStreams((state) => state.setActive)
  const select = useUi((state) => state.select)
  const setIsolate = useUi((state) => state.setIsolate)
  const setScreen = useUi((state) => state.setScreen)
  const setWorkspaceView = useUi((state) => state.setWorkspaceView)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const matches = useMemo(() => filterTabs(streams, query), [streams, query])

  useEffect(() => {
    if (!open) return
    setQuery('')
    setActiveIndex(0)
  }, [open])

  useEffect(() => {
    if (!open) return
    inputRef.current?.focus()
  }, [open])

  useEffect(() => {
    setActiveIndex((index) => (index >= matches.length ? 0 : index))
  }, [matches.length])

  function activate(index: number): void {
    const entry = matches[index]
    if (entry === undefined) return
    setActive(entry.id)
    select(entry.id, entry.records[entry.records.length - 1]?.seq ?? null)
    setIsolate(null)
    setScreen('stream')
    setWorkspaceView('stream')
    onClose()
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((index) => (matches.length === 0 ? 0 : (index + 1) % matches.length))
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((index) =>
        matches.length === 0 ? 0 : (index - 1 + matches.length) % matches.length,
      )
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      activate(activeIndex)
    }
  }

  if (!open) return null

  return (
    <DialogFrame open className="tab-finder" label="Find a tab" onClose={onClose}>
      <div className="tab-finder-search">
        <Icon name="search" />
        <input
          ref={inputRef}
          type="text"
          aria-label="Filter streams by name"
          aria-controls="tab-finder-list"
          aria-activedescendant={
            matches[activeIndex] === undefined ? undefined : `tab-option-${matches[activeIndex].id}`
          }
          placeholder="Filter streams"
          autoComplete="off"
          spellCheck={false}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={onKeyDown}
        />
        <span className="tab-finder-count">
          {formatNumber(matches.length)} of {formatNumber(streams.length)}
        </span>
      </div>
      <div className="tab-finder-list" id="tab-finder-list" role="listbox" aria-label="Streams">
        {matches.length === 0 ? (
          <p className="tab-finder-empty">
            No stream matches “{query}”.
            <button className="link" type="button" onClick={() => setQuery('')}>
              Clear
            </button>
          </p>
        ) : (
          matches.map((entry, index) => (
            <button
              key={entry.id}
              id={`tab-option-${entry.id}`}
              className={`tab-finder-option${index === activeIndex ? ' active' : ''}`}
              type="button"
              role="option"
              aria-selected={entry.id === activeId}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => activate(index)}
            >
              <span
                className="dot"
                style={entry.status === 'stopped' ? { background: 'var(--faint)' } : undefined}
              />
              <span className="tab-finder-name">{entry.name}</span>
              <span className="tab-finder-lines">{formatNumber(entry.lineCount)}</span>
              {entry.id === activeId ? <Icon name="check" /> : null}
            </button>
          ))
        )}
      </div>
      <p className="tab-finder-hint">
        <span>↑↓ move · Enter open · Esc close</span>
        <span>⌘K</span>
      </p>
    </DialogFrame>
  )
}
