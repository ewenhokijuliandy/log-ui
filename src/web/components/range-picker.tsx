import { useEffect, useState } from 'react'
import {
  customRangeError,
  type FilterState,
  parseDateTimeInput,
  RANGE_LABELS,
  toDateTimeInput,
} from '../lib/filters.ts'
import { Icon } from './icons.tsx'
import { MenuItem } from './menu-item.tsx'
import { PopoverPanel, usePopover } from './popover.tsx'

const RANGE_KEYS = ['5m', '15m', '1h', 'all'] as const

export function RangePicker({
  filter,
  onFilter,
}: {
  filter: FilterState
  onFilter: (next: FilterState) => void
}) {
  const menu = usePopover()
  const [customOpen, setCustomOpen] = useState(filter.range === 'custom')
  const [fromInput, setFromInput] = useState(() => toDateTimeInput(filter.from))
  const [toInput, setToInput] = useState(() => toDateTimeInput(filter.to))

  useEffect(() => {
    if (!menu.open) return
    setFromInput(toDateTimeInput(filter.from))
    setToInput(toDateTimeInput(filter.to))
    setCustomOpen(filter.range === 'custom')
  }, [menu.open, filter.range, filter.from, filter.to])

  const fromMs = parseDateTimeInput(fromInput)
  const toMs = parseDateTimeInput(toInput)
  const customProblem = customRangeError(fromMs, toMs)

  function applyCustomRange(): void {
    if (fromMs === null || toMs === null || fromMs > toMs) return
    onFilter({ ...filter, range: 'custom', from: fromMs, to: toMs })
    setCustomOpen(false)
    menu.close()
  }

  return (
    <>
      <button
        className="tool"
        type="button"
        data-tool="range"
        ref={menu.bindTrigger}
        aria-haspopup="menu"
        aria-expanded={menu.open}
        aria-label={`Time range: ${RANGE_LABELS[filter.range]}`}
        title={`Time range: ${RANGE_LABELS[filter.range]}`}
        onClick={() => menu.setOpen(!menu.open)}
      >
        <Icon name="calendar" />
        <span className="label">{RANGE_LABELS[filter.range]}</span>
        <Icon name="chevron" />
      </button>
      <PopoverPanel control={menu} label="Time range" width={300}>
        {RANGE_KEYS.map((key) => (
          <MenuItem
            key={key}
            checked={filter.range === key}
            label={RANGE_LABELS[key]}
            onPress={() => {
              setCustomOpen(false)
              onFilter({ ...filter, range: key })
              menu.close()
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
            {customProblem === null ? null : <p className="range-error">{customProblem}</p>}
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
    </>
  )
}
