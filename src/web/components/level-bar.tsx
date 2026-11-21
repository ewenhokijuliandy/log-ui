import { useRef, useState } from 'react'
import type { LevelChipKey } from '../../shared/levels.ts'
import type { FilterState } from '../lib/filters.ts'
import { formatNumber } from '../lib/format-time.ts'
import type { ChipCounts } from './filter-chips.tsx'

const SEGMENTS: ReadonlyArray<{ key: Exclude<LevelChipKey, 'all'>; label: string }> = [
  { key: 'error', label: 'Error' },
  { key: 'warn', label: 'Warn' },
  { key: 'info', label: 'Info' },
  { key: 'debug', label: 'Debug' },
  { key: 'unknown', label: 'Unknown' },
]

const LABELS: Record<Exclude<LevelChipKey, 'all'>, string> = {
  error: 'Error',
  warn: 'Warn',
  info: 'Info',
  debug: 'Debug',
  unknown: 'Unknown',
}

export type LevelBarProps = {
  filter: FilterState
  onFilter: (next: FilterState) => void
  chipCounts: ChipCounts
  totalCount: number
}

export function LevelBar({ filter, onFilter, chipCounts, totalCount }: LevelBarProps) {
  const selected = filter.chips.filter(
    (chip): chip is Exclude<LevelChipKey, 'all'> => chip !== 'all',
  )
  const refs = useRef<Array<HTMLButtonElement | null>>([])
  const [focusIndex, setFocusIndex] = useState(0)
  const selectedCount = selected.reduce((total, chip) => total + chipCounts[chip], 0)
  const label =
    selected.length === 0
      ? 'Levels · All'
      : `Levels · ${selected.map((chip) => LABELS[chip]).join(' + ')}`

  function setChips(chips: LevelChipKey[]): void {
    onFilter({ ...filter, chips })
  }

  function press(chip: Exclude<LevelChipKey, 'all'>, additive: boolean): void {
    if (additive) {
      setChips(
        selected.includes(chip) ? selected.filter((item) => item !== chip) : [...selected, chip],
      )
      return
    }
    if (selected.length === 1 && selected[0] === chip) {
      setChips([])
      return
    }
    setChips([chip])
  }

  function moveFocus(from: number, event: React.KeyboardEvent<HTMLButtonElement>): void {
    if (event.key === 'Escape') {
      event.preventDefault()
      setChips([])
      return
    }
    const last = SEGMENTS.length - 1
    const next =
      event.key === 'ArrowRight'
        ? (from + 1) % SEGMENTS.length
        : event.key === 'ArrowLeft'
          ? (from - 1 + SEGMENTS.length) % SEGMENTS.length
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? last
              : null
    if (next === null) return
    event.preventDefault()
    setFocusIndex(next)
    refs.current[next]?.focus()
  }

  if (totalCount === 0) {
    return (
      <fieldset className="level-bar" aria-label="Filter by level">
        <span className="level-bar-label">Levels · All</span>
        <div className="level-bar-track empty" aria-hidden="true" />
        <span className="level-bar-summary">0 lines</span>
      </fieldset>
    )
  }

  return (
    <fieldset className="level-bar" aria-label="Filter by level">
      <span className="level-bar-label">{label}</span>
      <div className="level-bar-track">
        {SEGMENTS.map((segment, index) => {
          const count = chipCounts[segment.key]
          const active = selected.includes(segment.key)
          const dimmed = selected.length > 0 && !active
          const size = count === 0 ? 2 : count
          return (
            <button
              key={segment.key}
              ref={(node) => {
                refs.current[index] = node
              }}
              className={`level-bar-segment ${segment.key}${dimmed ? ' dimmed' : ''}${count === 0 ? ' zero' : ''}`}
              type="button"
              aria-label={`${segment.label}: ${formatNumber(count)} lines`}
              aria-pressed={active}
              title={`${segment.label} · ${formatNumber(count)} lines`}
              tabIndex={focusIndex === index ? 0 : -1}
              style={{ flexGrow: count === 0 ? 0 : size, flexBasis: count === 0 ? '2px' : 0 }}
              onFocus={() => setFocusIndex(index)}
              onClick={(event) =>
                press(segment.key, event.shiftKey || event.metaKey || event.ctrlKey)
              }
              onKeyDown={(event) => moveFocus(index, event)}
            />
          )
        })}
      </div>
      <span className="level-bar-summary">
        {selected.length === 0
          ? `${formatNumber(totalCount)} lines`
          : `${formatNumber(selectedCount)} of ${formatNumber(totalCount)}`}
      </span>
    </fieldset>
  )
}
