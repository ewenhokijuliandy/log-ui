import { useEffect, useRef, useState } from 'react'
import type { LevelChipKey } from '../../shared/levels.ts'
import type { FilterState, RangeKey, SortKey } from '../lib/filters.ts'
import { filterError, RANGE_LABELS, SORT_LABELS } from '../lib/filters.ts'
import { formatNumber } from '../lib/format-time.ts'
import { Icon } from './icons.tsx'
import { PopoverPanel, usePopover } from './popover.tsx'

const LEVEL_CHIPS: readonly LevelChipKey[] = ['all', 'error', 'warn', 'info', 'debug']

const CHIP_LABELS: Record<LevelChipKey, string> = {
  all: 'All',
  error: 'Error',
  warn: 'Warn',
  info: 'Info',
  debug: 'Debug',
}

export function Toolbar(props: ToolbarProps) {
  const {
    filter,
    sort,
    onFilter,
    onSort,
    totalCount,
    zone,
    autoscroll,
    wrap,
    onToggleZone,
    onToggleWrap,
    onToggleAutoscroll,
    presets,
    onApplyPreset,
    onSavePreset,
    onDeletePreset,
  } = props

  const rangeMenu = usePopover()
  const sortMenu = usePopover()
  const presetMenu = usePopover()
  const [query, setQuery] = useState(filter.query)
  const [regexMode, setRegexMode] = useState(filter.regexMode)
  const [presetName, setPresetName] = useState('')

  useEffect(() => {
    setQuery(filter.query)
  }, [filter.query])

  useEffect(() => {
    setRegexMode(filter.regexMode)
  }, [filter.regexMode])

  const handleDebounce = useRef<number | null>(null)
  useEffect(() => {
    if (query === filter.query && regexMode === filter.regexMode) return
    if (handleDebounce.current !== null) window.clearTimeout(handleDebounce.current)
    handleDebounce.current = window.setTimeout(() => {
      onFilter({ ...filter, query, regexMode })
    }, 150)
    return () => {
      if (handleDebounce.current !== null) window.clearTimeout(handleDebounce.current)
    }
  }, [query, regexMode, filter, onFilter])

  const error = filterError(filter)
  const searchBox = usePopover()
  void searchBox

  return (
    <div className="toolbar">
      <div className={`search${error !== null ? ' invalid' : ''}`}>
        <Icon name="search" />
        <input
          data-search
          type="text"
          placeholder="Search logs or /regex/"
          aria-label="Search logs"
          autoComplete="off"
          spellCheck={false}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              setQuery('')
              onFilter({ ...filter, query: '' })
            }
          }}
        />
        <button
          className="regex"
          type="button"
          aria-pressed={regexMode}
          title="Treat the search as a regular expression"
          onClick={() => setRegexMode(!regexMode)}
        >
          .*
        </button>
      </div>

      <div className="level-filters" role="group" aria-label="Filter by level" id="level-filters">
        {LEVEL_CHIPS.map((chip) => (
          <LevelChip
            key={chip}
            chip={chip}
            pressed={filter.chip === chip}
            count={chip === 'all' ? totalCount : props.chipCounts[chip]}
            onPress={() =>
              onFilter(
                filter.chip === chip && chip !== 'all'
                  ? { ...filter, chip: 'all' }
                  : { ...filter, chip },
              )
            }
          />
        ))}
      </div>

      <div className="tools">
        <button
          className="tool"
          type="button"
          ref={rangeMenu.bindTrigger}
          aria-haspopup="menu"
          aria-expanded={rangeMenu.open}
          onClick={() => rangeMenu.setOpen(!rangeMenu.open)}
        >
          <Icon name="calendar" />
          <span>{RANGE_LABELS[filter.range]}</span>
          <Icon name="chevron" />
        </button>
        <PopoverPanel control={rangeMenu} label="Time range">
          {(['5m', '15m', '1h', 'all'] as const).map((key) => (
            <MenuItem
              key={key}
              checked={filter.range === key}
              label={RANGE_LABELS[key]}
              onPress={() => {
                onFilter({ ...filter, range: key })
                rangeMenu.close()
              }}
            />
          ))}
        </PopoverPanel>

        <button
          className="tool"
          type="button"
          ref={sortMenu.bindTrigger}
          aria-haspopup="menu"
          aria-expanded={sortMenu.open}
          onClick={() => sortMenu.setOpen(!sortMenu.open)}
        >
          <Icon name="sort" />
          <span>{SORT_LABELS[sort]}</span>
          <Icon name="chevron" />
        </button>
        <PopoverPanel control={sortMenu} label="Sort">
          {(['newest', 'oldest'] as const).map((key) => (
            <MenuItem
              key={key}
              checked={sort === key}
              label={SORT_LABELS[key]}
              onPress={() => {
                onSort(key)
                sortMenu.close()
              }}
            />
          ))}
        </PopoverPanel>

        <button className="tool" type="button" onClick={onToggleZone}>
          <Icon name="globe" />
          <span>{zone === 'utc' ? 'UTC' : 'Local'}</span>
        </button>

        <button className="tool" type="button" aria-pressed={wrap} onClick={onToggleWrap}>
          <Icon name="wrap" />
          <span>{wrap ? 'Wrap on' : 'Wrap off'}</span>
        </button>

        <button
          className="tool"
          type="button"
          aria-pressed={autoscroll}
          onClick={onToggleAutoscroll}
        >
          <Icon name="autoscroll" />
          <span>{autoscroll ? 'Auto-scroll on' : 'Auto-scroll off'}</span>
        </button>

        <button
          className="tool"
          type="button"
          ref={presetMenu.bindTrigger}
          aria-haspopup="menu"
          aria-expanded={presetMenu.open}
          onClick={() => presetMenu.setOpen(!presetMenu.open)}
        >
          <Icon name="bookmark" />
          Presets <span className="badge">{presets.length}</span>
        </button>
        <PopoverPanel control={presetMenu} label="Filter presets">
          <div className="popover-title">Saved views</div>
          {presets.length === 0 ? (
            <p className="menu-note">No presets saved yet.</p>
          ) : (
            presets.map((preset) => (
              <div key={preset.id} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <MenuItem
                  label={preset.name}
                  onPress={() => {
                    onApplyPreset(preset)
                    presetMenu.close()
                  }}
                />
                <button
                  className="icon-btn"
                  type="button"
                  aria-label={`Delete preset ${preset.name}`}
                  title={`Delete preset ${preset.name}`}
                  onClick={() => onDeletePreset(preset.id)}
                >
                  <Icon name="trash" />
                </button>
              </div>
            ))
          )}
          <button
            className="menu-item"
            type="button"
            role="menuitem"
            onClick={() => {
              const name = presetName.trim()
              onSavePreset(name)
              setPresetName('')
              presetMenu.close()
            }}
          >
            <Icon name="save" />
            <span className="grow">Save current view</span>
          </button>
          <div className="menu-form">
            <input
              type="text"
              placeholder="Name this view"
              aria-label="Preset name"
              autoComplete="off"
              value={presetName}
              onChange={(event) => setPresetName(event.target.value)}
            />
          </div>
          <p className="menu-note">
            Presets keep the search, regex mode, level and time range in this browser.
          </p>
        </PopoverPanel>
      </div>
    </div>
  )
}

export type ToolbarProps = {
  filter: FilterState
  sort: SortKey
  onFilter: (next: FilterState) => void
  onSort: (next: SortKey) => void
  chipCounts: Record<Exclude<LevelChipKey, 'all'>, number>
  totalCount: number
  zone: 'utc' | 'local'
  autoscroll: boolean
  wrap: boolean
  onToggleZone: () => void
  onToggleWrap: () => void
  onToggleAutoscroll: () => void
  presets: PresetView[]
  onApplyPreset: (preset: PresetView) => void
  onSavePreset: (name: string) => void
  onDeletePreset: (id: string) => void
}

export type PresetView = {
  id: string
  name: string
  query: string
  regex: boolean
  level: LevelChipKey
  range: RangeKey
  sort: SortKey
  trace: string | null
}

function LevelChip({ chip, pressed, count, onPress }: LevelChipProps) {
  const dotColor = DOT_COLORS[chip]
  return (
    <button className="level-chip" type="button" aria-pressed={pressed} onClick={onPress}>
      <span className="dot" style={dotColor === undefined ? undefined : { background: dotColor }} />
      {CHIP_LABELS[chip]}
      <span className="count">{formatNumber(count)}</span>
    </button>
  )
}

const DOT_COLORS: Partial<Record<LevelChipKey, string>> = {
  error: 'var(--negative)',
  warn: 'var(--warning)',
  info: 'var(--info)',
}

type LevelChipProps = {
  chip: LevelChipKey
  pressed: boolean
  count: number
  onPress: () => void
}

export function MenuItem({
  checked,
  label,
  note,
  onPress,
}: {
  checked?: boolean
  label: string
  note?: string
  onPress: () => void
}) {
  const selected = checked ?? false
  const role: 'menuitem' | 'menuitemradio' = checked === undefined ? 'menuitem' : 'menuitemradio'
  return (
    <button
      className="menu-item"
      type="button"
      role={role}
      aria-checked={checked === undefined ? undefined : selected}
      onClick={onPress}
    >
      <span className="grow">{label}</span>
      {note !== undefined ? <span className="note">{note}</span> : null}
    </button>
  )
}
