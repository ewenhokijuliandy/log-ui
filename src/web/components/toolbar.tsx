import { useEffect, useRef, useState } from 'react'
import { LEVEL_CHIPS, type LevelChipKey } from '../../shared/levels.ts'
import type { FilterState, SortKey } from '../lib/filters.ts'
import {
  customRangeError,
  filterError,
  MAX_PATTERN_LENGTH,
  parseDateTimeInput,
  RANGE_LABELS,
  SORT_LABELS,
  toDateTimeInput,
} from '../lib/filters.ts'
import { formatNumber } from '../lib/format-time.ts'
import type { Preset } from '../lib/presets.ts'
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
    paused,
    pending,
    onToggleZone,
    onToggleWrap,
    onToggleAutoscroll,
    onTogglePause,
    presets,
    onApplyPreset,
    onSavePreset,
    onDeletePreset,
    onRenamePreset,
  } = props

  const rangeMenu = usePopover()
  const sortMenu = usePopover()
  const presetMenu = usePopover()
  const levelsMenu = usePopover()
  const moreMenu = usePopover()
  const [query, setQuery] = useState(filter.query)
  const [regexMode, setRegexMode] = useState(filter.regexMode)
  const [customOpen, setCustomOpen] = useState(filter.range === 'custom')
  const [fromInput, setFromInput] = useState(() => toDateTimeInput(filter.from))
  const [toInput, setToInput] = useState(() => toDateTimeInput(filter.to))
  const [saving, setSaving] = useState(false)
  const [presetName, setPresetName] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const saveRef = useRef<HTMLInputElement | null>(null)
  const renameRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    setQuery(filter.query)
  }, [filter.query])

  useEffect(() => {
    setRegexMode(filter.regexMode)
  }, [filter.regexMode])

  useEffect(() => {
    if (!rangeMenu.open) return
    setFromInput(toDateTimeInput(filter.from))
    setToInput(toDateTimeInput(filter.to))
    setCustomOpen(filter.range === 'custom')
  }, [rangeMenu.open, filter.range, filter.from, filter.to])

  useEffect(() => {
    if (presetMenu.open) return
    setSaving(false)
    setRenamingId(null)
    setPresetName('')
    setRenameValue('')
  }, [presetMenu.open])

  useEffect(() => {
    if (!saving) return
    saveRef.current?.focus()
  }, [saving])

  useEffect(() => {
    if (renamingId === null) return
    renameRef.current?.focus()
  }, [renamingId])

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
  const fromMs = parseDateTimeInput(fromInput)
  const toMs = parseDateTimeInput(toInput)
  const customProblem = customRangeError(fromMs, toMs)

  function applyCustomRange(): void {
    if (fromMs === null || toMs === null || fromMs > toMs) return
    onFilter({ ...filter, range: 'custom', from: fromMs, to: toMs })
    setCustomOpen(false)
    rangeMenu.close()
  }

  function commitPresetName(): void {
    const name = presetName.trim()
    if (name.length === 0) return
    onSavePreset(name)
    setPresetName('')
    setSaving(false)
    presetMenu.close()
  }

  function commitRename(id: string): void {
    const name = renameValue.trim()
    if (name.length > 0) onRenamePreset(id, name)
    setRenamingId(null)
    setRenameValue('')
  }

  function toggleLevel(chip: LevelChipKey): void {
    if (chip === 'all') {
      onFilter({ ...filter, chips: [] })
      return
    }
    if (filter.chips.includes(chip)) {
      onFilter({ ...filter, chips: filter.chips.filter((item) => item !== chip) })
      return
    }
    onFilter({ ...filter, chips: [...filter.chips, chip] })
  }

  const chipPressed = (chip: LevelChipKey): boolean =>
    chip === 'all' ? filter.chips.length === 0 : filter.chips.includes(chip)
  const chipCount = (chip: LevelChipKey): number =>
    chip === 'all' ? totalCount : props.chipCounts[chip]

  return (
    <div className="toolbar">
      <div className={`search${error !== null ? ' invalid' : ''}`}>
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
            if (event.key === 'Escape') {
              setQuery('')
              onFilter({ ...filter, query: '' })
            }
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

      <div className="level-filters" role="group" aria-label="Filter by level" id="level-filters">
        {LEVEL_CHIPS.map((chip) => (
          <LevelChip
            key={chip}
            chip={chip}
            pressed={chipPressed(chip)}
            count={chipCount(chip)}
            onPress={() => toggleLevel(chip)}
          />
        ))}
      </div>

      <button
        className="tool levels-trigger"
        type="button"
        id="levels-trigger"
        ref={levelsMenu.bindTrigger}
        aria-haspopup="menu"
        aria-expanded={levelsMenu.open}
        aria-label={`Filter by level${filter.chips.length > 0 ? ` (${String(filter.chips.length)} selected)` : ''}`}
        title="Filter by level"
        onClick={() => levelsMenu.setOpen(!levelsMenu.open)}
      >
        <Icon name="list" />
        <span className="label">Levels</span>
        <span className="badge">{filter.chips.length === 0 ? 'All' : filter.chips.length}</span>
        <Icon name="chevron" />
      </button>
      <PopoverPanel control={levelsMenu} label="Filter by level" width={220} align="start">
        <div className="popover-title">Levels</div>
        <div className="level-popover-list">
          {LEVEL_CHIPS.map((chip) => (
            <LevelChip
              key={chip}
              chip={chip}
              menu
              pressed={chipPressed(chip)}
              count={chipCount(chip)}
              onPress={() => toggleLevel(chip)}
            />
          ))}
        </div>
        <p className="menu-note">Combine levels. All clears the selection.</p>
      </PopoverPanel>

      <div className="tools">
        <button
          className="tool"
          type="button"
          data-tool="range"
          ref={rangeMenu.bindTrigger}
          aria-haspopup="menu"
          aria-expanded={rangeMenu.open}
          aria-label={`Time range: ${RANGE_LABELS[filter.range]}`}
          title={`Time range: ${RANGE_LABELS[filter.range]}`}
          onClick={() => rangeMenu.setOpen(!rangeMenu.open)}
        >
          <Icon name="calendar" />
          <span className="label">{RANGE_LABELS[filter.range]}</span>
          <Icon name="chevron" />
        </button>
        <PopoverPanel control={rangeMenu} label="Time range" width={300}>
          {(['5m', '15m', '1h', 'all'] as const).map((key) => (
            <MenuItem
              key={key}
              checked={filter.range === key}
              label={RANGE_LABELS[key]}
              onPress={() => {
                setCustomOpen(false)
                onFilter({ ...filter, range: key })
                rangeMenu.close()
              }}
            />
          ))}
          <MenuItem
            checked={filter.range === 'custom'}
            label="Custom range…"
            onPress={() => setCustomOpen(true)}
          />
          {customOpen ? (
            <div className="range-form">
              <label className="range-field">
                <span>From</span>
                <input
                  type="datetime-local"
                  step={1}
                  aria-label="Range start"
                  max={toInput === '' ? undefined : toInput}
                  value={fromInput}
                  onChange={(event) => setFromInput(event.target.value)}
                />
              </label>
              <label className="range-field">
                <span>To</span>
                <input
                  type="datetime-local"
                  step={1}
                  aria-label="Range end"
                  min={fromInput === '' ? undefined : fromInput}
                  value={toInput}
                  onChange={(event) => setToInput(event.target.value)}
                />
              </label>
              {customProblem !== null ? <p className="range-error">{customProblem}</p> : null}
              <button
                className="btn primary"
                type="button"
                disabled={customProblem !== null}
                onClick={applyCustomRange}
              >
                Apply range
              </button>
            </div>
          ) : null}
        </PopoverPanel>

        <button
          className="tool"
          type="button"
          data-tool="sort"
          ref={sortMenu.bindTrigger}
          aria-haspopup="menu"
          aria-expanded={sortMenu.open}
          aria-label={`Sort: ${SORT_LABELS[sort]}`}
          title={`Sort: ${SORT_LABELS[sort]}`}
          onClick={() => sortMenu.setOpen(!sortMenu.open)}
        >
          <Icon name="sort" />
          <span className="label">{SORT_LABELS[sort]}</span>
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

        <button
          className="tool"
          type="button"
          data-tool="zone"
          data-secondary
          aria-label={`Timestamp zone: ${zone === 'utc' ? 'UTC' : 'Local'}`}
          title={`Timestamp zone: ${zone === 'utc' ? 'UTC' : 'Local'}`}
          onClick={onToggleZone}
        >
          <Icon name="globe" />
          <span className="label">{zone === 'utc' ? 'UTC' : 'Local'}</span>
        </button>

        <button
          className="tool"
          type="button"
          data-tool="wrap"
          data-secondary
          aria-pressed={wrap}
          aria-label={`Word wrap: ${wrap ? 'On' : 'Off'}`}
          title={`Word wrap: ${wrap ? 'On' : 'Off'}`}
          onClick={onToggleWrap}
        >
          <Icon name="wrap" />
          <span className="label">{wrap ? 'Wrap on' : 'Wrap off'}</span>
        </button>

        <button
          className="tool"
          type="button"
          data-tool="scroll"
          data-secondary
          aria-pressed={autoscroll}
          aria-label={`Auto-scroll: ${autoscroll ? 'On' : 'Off'}`}
          title={`Auto-scroll: ${autoscroll ? 'On' : 'Off'}`}
          onClick={onToggleAutoscroll}
        >
          <Icon name="autoscroll" />
          <span className="label">{autoscroll ? 'Auto-scroll on' : 'Auto-scroll off'}</span>
        </button>

        <button
          className="tool"
          type="button"
          data-tool="pause"
          aria-pressed={paused}
          aria-label={paused ? 'Resume' : 'Pause'}
          title={paused ? 'Resume the view' : 'Pause the view and keep ingesting'}
          onClick={onTogglePause}
        >
          <Icon name={paused ? 'play' : 'pause'} />
          <span className="label">{paused ? 'Resume' : 'Pause'}</span>
          {paused ? <span className="badge">{formatNumber(pending)}</span> : null}
        </button>

        <button
          className="tool"
          type="button"
          data-tool="presets"
          ref={presetMenu.bindTrigger}
          aria-haspopup="menu"
          aria-expanded={presetMenu.open}
          aria-label="Filter presets"
          title="Filter presets"
          onClick={() => presetMenu.setOpen(!presetMenu.open)}
        >
          <Icon name="bookmark" />
          <span className="label">Presets</span> <span className="badge">{presets.length}</span>
        </button>
        <PopoverPanel control={presetMenu} label="Filter presets" width={300}>
          <div className="popover-title">Saved views</div>
          {presets.length === 0 ? (
            <p className="menu-note">No presets saved yet.</p>
          ) : (
            presets.map((preset) =>
              renamingId === preset.id ? (
                <div key={preset.id} className="menu-form">
                  <input
                    ref={renameRef}
                    type="text"
                    aria-label={`Rename preset ${preset.name}`}
                    autoComplete="off"
                    value={renameValue}
                    onChange={(event) => setRenameValue(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') commitRename(preset.id)
                      if (event.key === 'Escape') setRenamingId(null)
                    }}
                  />
                  <button className="btn" type="button" onClick={() => commitRename(preset.id)}>
                    Save
                  </button>
                </div>
              ) : (
                <div key={preset.id} className="preset-row">
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
                    aria-label={`Rename preset ${preset.name}`}
                    title={`Rename preset ${preset.name}`}
                    onClick={() => {
                      setRenamingId(preset.id)
                      setRenameValue(preset.name)
                    }}
                  >
                    <Icon name="pencil" />
                  </button>
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
              ),
            )
          )}
          <button
            className="menu-item"
            type="button"
            role="menuitem"
            onClick={() => {
              setSaving(true)
              setRenamingId(null)
            }}
          >
            <Icon name="save" />
            <span className="grow">Save current view</span>
          </button>
          {saving ? (
            <div className="menu-form">
              <input
                ref={saveRef}
                type="text"
                placeholder="Name this view"
                aria-label="Preset name"
                autoComplete="off"
                value={presetName}
                onChange={(event) => setPresetName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') commitPresetName()
                }}
              />
              <button className="btn" type="button" onClick={commitPresetName}>
                Save
              </button>
            </div>
          ) : null}
          <p className="menu-note">
            Presets keep the search, regex mode, levels, time range and trace in this browser.
          </p>
        </PopoverPanel>

        <button
          className="tool tool-more"
          type="button"
          id="more-trigger"
          data-tool="more"
          ref={moreMenu.bindTrigger}
          aria-haspopup="menu"
          aria-expanded={moreMenu.open}
          aria-label="More tools"
          title="More tools"
          onClick={() => moreMenu.setOpen(!moreMenu.open)}
        >
          <Icon name="more" />
        </button>
        <PopoverPanel control={moreMenu} label="More tools" width={240}>
          <div className="popover-title">More tools</div>
          <MenuItem
            label="Timestamp zone"
            note={zone === 'utc' ? 'UTC' : 'Local'}
            onPress={() => {
              onToggleZone()
              moreMenu.close()
            }}
          />
          <MenuItem
            label="Word wrap"
            note={wrap ? 'On' : 'Off'}
            onPress={() => {
              onToggleWrap()
              moreMenu.close()
            }}
          />
          <MenuItem
            label="Auto-scroll"
            note={autoscroll ? 'On' : 'Off'}
            onPress={() => {
              onToggleAutoscroll()
              moreMenu.close()
            }}
          />
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
  paused: boolean
  pending: number
  onToggleZone: () => void
  onToggleWrap: () => void
  onToggleAutoscroll: () => void
  onTogglePause: () => void
  presets: Preset[]
  onApplyPreset: (preset: Preset) => void
  onSavePreset: (name: string) => void
  onDeletePreset: (id: string) => void
  onRenamePreset: (id: string, name: string) => void
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
