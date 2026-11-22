import { useMemo, useState } from 'react'
import type { StreamEntry } from '../app/store.ts'
import { formatNumber } from '../lib/format-time.ts'
import { filterTabs } from '../lib/tab-filter.ts'
import { DialogFrame } from './dialog-frame.tsx'

export function MergeSelector({
  open,
  streams,
  selectedIds,
  onChange,
  onClose,
}: {
  open: boolean
  streams: readonly StreamEntry[]
  selectedIds: readonly string[]
  onChange: (ids: string[]) => void
  onClose: () => void
}) {
  const [query, setQuery] = useState('')
  const matches = useMemo(() => filterTabs(streams, query), [streams, query])
  function toggle(id: string): void {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((item) => item !== id))
      return
    }
    onChange([...selectedIds, id])
  }

  return (
    <DialogFrame
      open={open}
      className="merge-selector"
      label="Select streams to merge"
      onClose={onClose}
    >
      <div className="merge-selector-head">
        <h2>Select streams to merge</h2>
        <span className="merge-selector-count">{selectedIds.length} selected</span>
      </div>
      <input
        className="merge-selector-search"
        type="text"
        aria-label="Filter streams"
        placeholder="Filter streams"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <div className="merge-selector-list">
        {matches.length === 0 ? (
          <p className="tab-finder-empty">No stream matches “{query}”.</p>
        ) : (
          matches.map((entry) => {
            const checked = selectedIds.includes(entry.id)
            return (
              <label key={entry.id} className="merge-selector-item">
                <input type="checkbox" checked={checked} onChange={() => toggle(entry.id)} />
                <span
                  className="dot"
                  style={entry.status === 'stopped' ? { background: 'var(--faint)' } : undefined}
                />
                <span className="merge-selector-name">{entry.name}</span>
                <span className="merge-selector-lines">{formatNumber(entry.lineCount)}</span>
              </label>
            )
          })
        )}
      </div>
      <div className="dialog-actions">
        <button className="btn" type="button" onClick={onClose}>
          Cancel
        </button>
        <button className="btn primary" type="button" onClick={onClose}>
          Merge {selectedIds.length}
        </button>
      </div>
    </DialogFrame>
  )
}
