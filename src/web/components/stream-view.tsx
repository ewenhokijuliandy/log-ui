import { type CSSProperties, useState } from 'react'
import type { LogRecord } from '../../shared/types.ts'
import type { Prefs } from '../app/prefs.ts'
import type { StreamEntry } from '../app/store.ts'
import type { ConnectionPhase } from '../app/ws-client.ts'
import type { FilterState, SortKey } from '../lib/filters.ts'
import { filtersActive } from '../lib/filters.ts'
import type { Preset } from '../lib/presets.ts'
import { ConnectionBanner } from './connection-banner.tsx'
import type { ChipCounts } from './filter-chips.tsx'
import { Inspector } from './inspector.tsx'
import { LogList } from './logs.tsx'
import { SaveLogDialog } from './save-log-dialog.tsx'
import { SignalStrip } from './signal.tsx'
import { StreamHeader } from './stream-header.tsx'
import { Toolbar } from './toolbar.tsx'

export type StreamData = {
  active: StreamEntry | null
  derivedRecords: readonly LogRecord[]
  visible: readonly LogRecord[]
  paused: boolean
  pending: number
  chipCounts: ChipCounts
  totalCount: number
  totalLines: number
  droppedLines: number
  clearedActive: boolean
  bootError: string | null
  connection: ConnectionPhase
  simulatedLost: boolean
  filterProblem: string | null
  emptyText: string
  selectedRecord: LogRecord | null
  inspectorOpen: boolean
  inspectorWidth: number
}

export type StreamActions = {
  isolateTrace: string | null
  onFilter: (next: FilterState) => void
  onSort: (next: SortKey) => void
  onApplyPreset: (preset: Preset) => void
  onSavePreset: (name: string) => void
  onRenamePreset: (id: string, name: string) => void
  onDeletePreset: (id: string) => void
  onToggleZone: () => void
  onToggleWrap: () => void
  onToggleAutoscroll: () => void
  onTogglePause: () => void
  onResume: () => void
  onRetry: () => void
  onClearFilters: () => void
  onClearBuffer: (id: string) => void
  onSaveLog: (id: string, name: string) => void
  onInspectorWidth: (width: number) => void
  onResetInspectorWidth: () => void
}

export type StreamViewProps = {
  data: StreamData
  actions: StreamActions
  filter: FilterState
  sort: SortKey
  prefs: Prefs
  presets: Preset[]
}

export function StreamView({ data, actions, filter, sort, prefs, presets }: StreamViewProps) {
  const { active } = data
  const [saveTarget, setSaveTarget] = useState<string | null>(null)
  const saveOpen = active !== null && saveTarget === active.id

  if (active === null) return null
  const on = filtersActive(filter, actions.isolateTrace)
  return (
    <section className="view" id="stream-view" role="tabpanel" aria-labelledby={`tab-${active.id}`}>
      <StreamHeader
        entry={active}
        totalLines={data.totalLines}
        droppedLines={data.droppedLines}
        bootError={data.bootError}
        onClearBuffer={() => actions.onClearBuffer(active.id)}
        onSave={() => setSaveTarget(active.id)}
        canSave={active.kind !== 'manual'}
        saveDisabled={data.totalLines === 0}
      />

      <ConnectionBanner
        connection={data.connection}
        simulatedLost={data.simulatedLost}
        onRetry={actions.onRetry}
      />

      {active.kind !== 'manual' && active.status === 'stopped' && !data.clearedActive ? (
        <div className="banner" role="status">
          <span>The pipe for {active.name} ended. Restart the stream to see new lines.</span>
        </div>
      ) : null}

      <Toolbar
        filter={filter}
        sort={sort}
        onFilter={actions.onFilter}
        onSort={actions.onSort}
        chipCounts={data.chipCounts}
        totalCount={data.totalCount}
        zone={prefs.zone}
        autoscroll={prefs.autoscroll}
        wrap={prefs.wrap}
        paused={data.paused}
        pending={data.pending}
        onToggleZone={actions.onToggleZone}
        onToggleWrap={actions.onToggleWrap}
        onToggleAutoscroll={actions.onToggleAutoscroll}
        onTogglePause={actions.onTogglePause}
        presets={presets}
        onApplyPreset={actions.onApplyPreset}
        onSavePreset={actions.onSavePreset}
        onDeletePreset={actions.onDeletePreset}
        onRenamePreset={actions.onRenamePreset}
      />

      <SignalStrip records={data.derivedRecords} zone={prefs.zone} />

      <div
        className={`log-shell${data.inspectorOpen && data.selectedRecord !== null ? '' : ' no-inspector'}`}
        style={
          {
            '--inspector-w': `${String(data.inspectorWidth)}px`,
          } as CSSProperties
        }
      >
        <LogList
          visible={data.visible}
          zone={prefs.zone}
          autoscroll={prefs.autoscroll}
          newestFirst={sort === 'newest'}
          wrap={prefs.wrap}
          isolateTrace={actions.isolateTrace}
          paused={data.paused}
          pending={data.pending}
          onResume={actions.onResume}
          emptyText={data.emptyText}
          onClearFilters={data.filterProblem === null && on ? actions.onClearFilters : undefined}
        />
        <Inspector
          record={data.selectedRecord}
          zone={prefs.zone}
          width={data.inspectorWidth}
          onWidth={actions.onInspectorWidth}
          onResetWidth={actions.onResetInspectorWidth}
        />
      </div>
      <SaveLogDialog
        open={saveOpen}
        streamName={active.name}
        defaultName={active.name}
        onCancel={() => setSaveTarget(null)}
        onConfirm={(name) => {
          setSaveTarget(null)
          actions.onSaveLog(active.id, name)
        }}
      />
    </section>
  )
}
