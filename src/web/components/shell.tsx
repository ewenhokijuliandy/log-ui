import type { ReactNode } from 'react'
import { useStreams } from '../app/store.ts'
import type { WorkspaceView } from '../app/ui.ts'
import { useUi } from '../app/ui.ts'
import type { Zone } from '../lib/format-time.ts'
import { Icon } from './icons.tsx'
import { PopoverPanel, usePopover } from './popover.tsx'
import type { SheetName } from './sheets-model.ts'

export type { SheetName }

export function Rail({
  openSheet,
  toggleTheme,
  onStreams,
  onMerge,
  onCompare,
  onPretty,
  workspaceView,
  expanded,
  onToggleExpanded,
}: RailProps) {
  const streamsOpen = workspaceView === 'stream'
  return (
    <aside className={`rail${expanded ? ' rail-expanded' : ''}`} aria-label="Workspace">
      <div className="rail-head">
        <span className="rail-mark">
          <Icon name="mark" />
        </span>
        <button
          className="rail-toggle"
          type="button"
          aria-expanded={expanded}
          aria-label={expanded ? 'Collapse the sidebar' : 'Expand the sidebar'}
          title={expanded ? 'Collapse the sidebar' : 'Expand the sidebar'}
          onClick={onToggleExpanded}
        >
          <Icon name="panel" />
        </button>
      </div>
      <nav className="rail-nav" aria-label="Views">
        <span className="rail-group-label">Views</span>
        <button
          className="rail-btn"
          type="button"
          aria-current={streamsOpen ? 'page' : undefined}
          title="Streams"
          aria-label="Streams"
          onClick={onStreams}
        >
          <Icon name="list" />
          <span className="rail-label">Streams</span>
        </button>
        <button
          className="rail-btn"
          type="button"
          aria-current={workspaceView === 'merge' ? 'page' : undefined}
          title="Merge log"
          aria-label="Merge log"
          onClick={onMerge}
        >
          <Icon name="merge" />
          <span className="rail-label">Merge</span>
        </button>
        <button
          className="rail-btn"
          type="button"
          title="Compare JSON"
          aria-label="Compare JSON"
          aria-current={workspaceView === 'compare' ? 'page' : undefined}
          onClick={onCompare}
        >
          <Icon name="diff" />
          <span className="rail-label">Compare</span>
        </button>
        <button
          className="rail-btn"
          type="button"
          title="Pretty JSON"
          aria-label="Pretty JSON"
          aria-current={workspaceView === 'prettify' ? 'page' : undefined}
          onClick={onPretty}
        >
          <Icon name="prettify" />
          <span className="rail-label">Pretty</span>
        </button>
      </nav>
      <nav className="rail-nav rail-nav-app" aria-label="Application">
        <span className="rail-group-label">App</span>
        <button
          className="rail-btn rail-btn-phone"
          type="button"
          title="Manual mode"
          aria-label="Manual mode"
          onClick={() => openSheet('manual')}
        >
          <Icon name="terminal" />
          <span className="rail-label">Manual</span>
        </button>
        <button
          className="rail-btn rail-btn-app"
          type="button"
          title="Settings"
          aria-label="Settings"
          onClick={() => openSheet('settings')}
        >
          <Icon name="settings" />
          <span className="rail-label">Settings</span>
        </button>
        <button
          className="rail-btn rail-btn-app"
          type="button"
          title="Help and shortcuts"
          aria-label="Help and shortcuts"
          onClick={() => openSheet('help')}
        >
          <Icon name="help" />
          <span className="rail-label">Help</span>
        </button>
        <button
          className="rail-btn"
          type="button"
          data-rail="theme"
          title="Switch theme"
          aria-label="Switch theme"
          onClick={toggleTheme}
        >
          <ThemeGlyph />
          <span className="rail-label">Theme</span>
        </button>
      </nav>
    </aside>
  )
}

export type RailProps = {
  openSheet: (sheet: Exclude<SheetName, null> | null) => void
  toggleTheme: () => void
  onStreams: () => void
  onMerge: () => void
  onCompare: () => void
  onPretty: () => void
  workspaceView: WorkspaceView
  expanded: boolean
  onToggleExpanded: () => void
}

function ThemeGlyph() {
  const theme = useUi((state) => state.theme)
  return <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
}

export function TopBar({
  openSheet,
  toggleTheme,
  onExport,
  onSimulateLoss,
  exportDisabled = false,
}: TopBarProps) {
  const manual = usePopover()
  const connection = usePopover()
  const phase = useStreams((state) => (state.simulatedLost ? 'reconnecting' : state.connection))
  const host = window.location.host

  return (
    <header className="topbar">
      <div className="brand">
        <span className="wordmark">logdeck</span>
        <span className="scope">{host}</span>
      </div>
      <div className="spacer" />
      <button
        className="connection"
        type="button"
        ref={connection.bindTrigger}
        aria-haspopup="menu"
        aria-expanded={connection.open}
        onClick={() => connection.setOpen(!connection.open)}
      >
        <span
          className="live-dot"
          style={phase === 'connected' ? undefined : { background: 'var(--warning)' }}
        />
        <span aria-live="polite">{phaseLabel(phase)}</span>
      </button>
      <PopoverPanel control={connection} label="Connection">
        <div className="popover-title">Daemon on {host}</div>
        <button
          className="menu-item"
          type="button"
          role="menuitem"
          onClick={() => {
            onSimulateLoss()
            connection.close()
          }}
        >
          <Icon name="retry" />
          <span className="grow">Simulate connection loss</span>
        </button>
      </PopoverPanel>
      <div className="top-actions">
        <button className="btn ghost" type="button" onClick={() => openSheet('manual')}>
          <Icon name="terminal" />
          <span className="label">Manual mode</span>
        </button>
        <button
          className="btn primary"
          type="button"
          ref={manual.bindTrigger}
          aria-label="Export"
          aria-haspopup="menu"
          aria-expanded={manual.open}
          disabled={exportDisabled}
          title={exportDisabled ? 'Export applies to log views' : undefined}
          onClick={() => manual.setOpen(!manual.open)}
        >
          <Icon name="download" />
          <span className="label">Export</span>
          <Icon name="chevron" />
        </button>
        <PopoverPanel control={manual} label="Export">
          {onExport}
        </PopoverPanel>
        <button
          className="icon-btn"
          type="button"
          title="Switch theme"
          aria-label="Switch theme"
          onClick={toggleTheme}
        >
          <ThemeGlyph />
        </button>
      </div>
    </header>
  )
}

export type TopBarProps = {
  openSheet: (sheet: Exclude<SheetName, null> | null) => void
  toggleTheme: () => void
  onExport: ReactNode
  onSimulateLoss: () => void
  exportDisabled?: boolean
}

function phaseLabel(phase: string): string {
  switch (phase) {
    case 'connected':
      return 'connected'
    case 'reconnecting':
      return 'reconnecting'
    case 'connecting':
      return 'connecting'
    default:
      return 'connecting'
  }
}

export function Statusbar({ showing, retained, dropped, zone }: StatusbarProps) {
  return (
    <footer className="statusbar">
      <span className="live">
        <span className="live-dot" />
        <span>ws://{window.location.host}/ws</span>
      </span>
      <span className="spacer" />
      <span>{showing}</span>
      <span className="hide-sm">·</span>
      <span className="hide-sm">
        <span className="num">{retained}</span> retained · <span className="num">{dropped}</span>{' '}
        dropped
      </span>
      <span className="hide-sm">·</span>
      <span className="hide-sm">Times {zone === 'utc' ? 'UTC' : 'Local'}</span>
    </footer>
  )
}

export type StatusbarProps = {
  showing: string
  retained: string
  dropped: string
  zone: Zone
}
