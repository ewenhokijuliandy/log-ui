import { useEffect, useRef, useState } from 'react'
import { LEVEL_CHIPS, type LevelChipKey } from '../../shared/levels.ts'
import { type FilterState, filterError, MAX_PATTERN_LENGTH } from '../lib/filters.ts'
import { formatNumber } from '../lib/format-time.ts'
import { Icon } from './icons.tsx'
import { PopoverPanel, usePopover } from './popover.tsx'

const CHIP_LABELS: Record<LevelChipKey, string> = {
  all: 'All',
  error: 'Error',
  warn: 'Warn',
  info: 'Info',
  debug: 'Debug',
  unknown: 'Unknown',
}

export type ChipCounts = Record<Exclude<LevelChipKey, 'all'>, number>

export type LevelFilterProps = {
  filter: FilterState
  onFilter: (next: FilterState) => void
  chipCounts: ChipCounts
  totalCount: number
}

export function toggleChips(chips: readonly LevelChipKey[], chip: LevelChipKey): LevelChipKey[] {
  if (chip === 'all') return []
  if (chips.includes(chip)) return chips.filter((item) => item !== chip)
  return [...chips, chip]
}

function chipPressed(filter: FilterState, chip: LevelChipKey): boolean {
  if (chip === 'all') return filter.chips.length === 0
  return filter.chips.includes(chip)
}

function chipCount(props: LevelFilterProps, chip: LevelChipKey): number {
  if (chip === 'all') return props.totalCount
  return props.chipCounts[chip]
}

export function SearchField({
  filter,
  onFilter,
}: {
  filter: FilterState
  onFilter: (next: FilterState) => void
}) {
  const [query, setQuery] = useState(filter.query)
  const [regexMode, setRegexMode] = useState(filter.regexMode)

  useEffect(() => {
    setQuery(filter.query)
  }, [filter.query])

  useEffect(() => {
    setRegexMode(filter.regexMode)
  }, [filter.regexMode])

  const debounce = useRef<number | null>(null)
  useEffect(() => {
    if (query === filter.query && regexMode === filter.regexMode) return
    if (debounce.current !== null) window.clearTimeout(debounce.current)
    debounce.current = window.setTimeout(() => {
      onFilter({ ...filter, query, regexMode })
    }, 150)
    return () => {
      if (debounce.current !== null) window.clearTimeout(debounce.current)
    }
  }, [query, regexMode, filter, onFilter])

  const error = filterError(filter)

  return (
    <div className={`search${error === null ? '' : ' invalid'}`}>
      <Icon name="search" />
      <input
        data-search
        type="text"
        placeholder="Search logs"
        aria-label="Search logs"
        aria-invalid={error !== null}
        aria-describedby={error === null ? undefined : 'search-error'}
        autoComplete="off"
        spellCheck={false}
        maxLength={MAX_PATTERN_LENGTH}
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== 'Escape') return
          setQuery('')
          onFilter({ ...filter, query: '' })
        }}
      />
      <button
        className="regex"
        type="button"
        aria-label="Regular expression"
        aria-pressed={regexMode}
        title="Treat the search as a regular expression"
        onClick={() => setRegexMode(!regexMode)}
      >
        .*
      </button>
      {error === null ? null : (
        <p className="search-error" id="search-error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

export function LevelFilters(props: LevelFilterProps) {
  const { filter, onFilter } = props
  return (
    <div className="level-filters" role="group" aria-label="Filter by level" id="level-filters">
      {LEVEL_CHIPS.map((chip) => (
        <LevelChip
          key={chip}
          chip={chip}
          pressed={chipPressed(filter, chip)}
          count={chipCount(props, chip)}
          onPress={() => onFilter({ ...filter, chips: toggleChips(filter.chips, chip) })}
        />
      ))}
    </div>
  )
}

export function LevelsMenu(props: LevelFilterProps) {
  const { filter, onFilter } = props
  const menu = usePopover()
  const selected = filter.chips.length > 0 ? ` (${String(filter.chips.length)} selected)` : ''
  return (
    <>
      <button
        className="tool levels-trigger"
        type="button"
        id="levels-trigger"
        ref={menu.bindTrigger}
        aria-haspopup="menu"
        aria-expanded={menu.open}
        aria-label={`Filter by level${selected}`}
        title="Filter by level"
        onClick={() => menu.setOpen(!menu.open)}
      >
        <Icon name="list" />
        <span className="label">Levels</span>
        <span className="badge">{filter.chips.length === 0 ? 'All' : filter.chips.length}</span>
        <Icon name="chevron" />
      </button>
      <PopoverPanel control={menu} label="Filter by level" width={220} align="start">
        <div className="popover-title">Levels</div>
        <div className="level-popover-list">
          {LEVEL_CHIPS.map((chip) => (
            <LevelChip
              key={chip}
              chip={chip}
              menu
              pressed={chipPressed(filter, chip)}
              count={chipCount(props, chip)}
              onPress={() => onFilter({ ...filter, chips: toggleChips(filter.chips, chip) })}
            />
          ))}
        </div>
        <p className="menu-note">Combine levels. All clears the selection.</p>
      </PopoverPanel>
    </>
  )
}

function LevelChip({ chip, pressed, count, onPress, menu = false }: LevelChipProps) {
  return (
    <button
      className="level-chip"
      type="button"
      role={menu ? 'menuitemcheckbox' : undefined}
      aria-checked={menu ? pressed : undefined}
      aria-pressed={menu ? undefined : pressed}
      onClick={onPress}
    >
      <span className={chip === 'all' ? 'dot' : `dot ${chip}`} />
      {CHIP_LABELS[chip]}
      <span className="count">{formatNumber(count)}</span>
    </button>
  )
}

type LevelChipProps = {
  chip: LevelChipKey
  pressed: boolean
  count: number
  onPress: () => void
  menu?: boolean
}
