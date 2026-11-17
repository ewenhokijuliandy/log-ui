import { SORT_LABELS, type SortKey } from '../lib/filters.ts'
import { Icon } from './icons.tsx'
import { MenuItem } from './menu-item.tsx'
import { PopoverPanel, usePopover } from './popover.tsx'

const SORT_KEYS = ['newest', 'oldest'] as const

export function SortMenu({ sort, onSort }: { sort: SortKey; onSort: (next: SortKey) => void }) {
  const menu = usePopover()
  return (
    <>
      <button
        className="tool"
        type="button"
        data-tool="sort"
        ref={menu.bindTrigger}
        aria-haspopup="menu"
        aria-expanded={menu.open}
        aria-label={`Sort: ${SORT_LABELS[sort]}`}
        title={`Sort: ${SORT_LABELS[sort]}`}
        onClick={() => menu.setOpen(!menu.open)}
      >
        <Icon name="sort" />
        <span className="label">{SORT_LABELS[sort]}</span>
        <Icon name="chevron" />
      </button>
      <PopoverPanel control={menu} label="Sort">
        {SORT_KEYS.map((key) => (
          <MenuItem
            key={key}
            checked={sort === key}
            label={SORT_LABELS[key]}
            onPress={() => {
              onSort(key)
              menu.close()
            }}
          />
        ))}
      </PopoverPanel>
    </>
  )
}
