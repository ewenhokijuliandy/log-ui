import { useRef } from 'react'
import { BUFFER_CAP, useStreams } from '../app/store.ts'
import { useUi } from '../app/ui.ts'
import { formatNumber } from '../lib/format-time.ts'
import { Icon } from './icons.tsx'

export function StreamTabs({ onQuickStart, onCloseTab }: StreamTabsProps) {
  const streams = useStreams((state) => state.streams)
  const activeId = useStreams((state) => state.activeId)
  const setActive = useStreams((state) => state.setActive)
  const moveTab = useStreams((state) => state.moveTab)
  const select = useUi((state) => state.select)
  const setIsolate = useUi((state) => state.setIsolate)
  const setScreen = useUi((state) => state.setScreen)

  const dragId = useRef<string | null>(null)

  return (
    <div className="tabs" role="tablist" aria-label="Log streams">
      {streams.map((entry) => {
        const selected = entry.id === activeId
        return (
          <div
            key={entry.id}
            className="stream-tab"
            role="tab"
            tabIndex={0}
            aria-selected={selected}
            draggable
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
            onClick={(event) => {
              const target = event.target as HTMLElement
              if (target.closest('.close') !== null) return
              setActive(entry.id)
              select(entry.id, entry.records[entry.records.length - 1]?.seq ?? null)
              setIsolate(null)
              setScreen('stream')
            }}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' && event.key !== ' ') return
              event.preventDefault()
              setActive(entry.id)
              setScreen('stream')
            }}
          >
            <span
              className="dot"
              style={entry.status === 'stopped' ? { background: 'var(--faint)' } : undefined}
            />
            <span className="tab-label">{entry.name}</span>
            <span className="tab-count">{formatNumber(Math.min(entry.lineCount, BUFFER_CAP))}</span>
            <button
              className="close"
              type="button"
              aria-label={`Close ${entry.name}`}
              title={`Close ${entry.name}`}
              onClick={(event) => {
                event.stopPropagation()
                onCloseTab(entry.id)
              }}
            >
              <Icon name="x" />
            </button>
          </div>
        )
      })}
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
