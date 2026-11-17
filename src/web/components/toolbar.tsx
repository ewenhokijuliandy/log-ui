import type { FilterState, SortKey } from '../lib/filters.ts'
import type { Preset } from '../lib/presets.ts'
import { DisplayTools, MoreTools } from './display-tools.tsx'
import { type ChipCounts, LevelFilters, LevelsMenu, SearchField } from './filter-chips.tsx'
import { PresetsMenu } from './presets-menu.tsx'
import { RangePicker } from './range-picker.tsx'
import { SortMenu } from './sort-menu.tsx'

export function Toolbar(props: ToolbarProps) {
  return (
    <div className="toolbar">
      <SearchField filter={props.filter} onFilter={props.onFilter} />
      <LevelFilters
        filter={props.filter}
        onFilter={props.onFilter}
        chipCounts={props.chipCounts}
        totalCount={props.totalCount}
      />
      <LevelsMenu
        filter={props.filter}
        onFilter={props.onFilter}
        chipCounts={props.chipCounts}
        totalCount={props.totalCount}
      />

      <div className="tools">
        <RangePicker filter={props.filter} onFilter={props.onFilter} />
        <SortMenu sort={props.sort} onSort={props.onSort} />
        <DisplayTools
          zone={props.zone}
          autoscroll={props.autoscroll}
          wrap={props.wrap}
          paused={props.paused}
          pending={props.pending}
          onToggleZone={props.onToggleZone}
          onToggleWrap={props.onToggleWrap}
          onToggleAutoscroll={props.onToggleAutoscroll}
          onTogglePause={props.onTogglePause}
        />
        <PresetsMenu
          presets={props.presets}
          onApplyPreset={props.onApplyPreset}
          onSavePreset={props.onSavePreset}
          onDeletePreset={props.onDeletePreset}
          onRenamePreset={props.onRenamePreset}
        />
        <MoreTools
          zone={props.zone}
          autoscroll={props.autoscroll}
          wrap={props.wrap}
          onToggleZone={props.onToggleZone}
          onToggleWrap={props.onToggleWrap}
          onToggleAutoscroll={props.onToggleAutoscroll}
        />
      </div>
    </div>
  )
}

export type ToolbarProps = {
  filter: FilterState
  sort: SortKey
  onFilter: (next: FilterState) => void
  onSort: (next: SortKey) => void
  chipCounts: ChipCounts
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
