import type { ReactNode } from 'react'
import { useStreams } from '../app/store.ts'
import { useUi } from '../app/ui.ts'
import type { Zone } from '../lib/format-time.ts'
import { Icon } from './icons.tsx'
import { PopoverPanel, usePopover } from './popover.tsx'

export type SheetName = 'settings' | 'help' | 'manual' | null

export function Rail({ openSheet, toggleTheme, onStreams }: RailProps) {
  const streamsOpen = useUi((state) => state.screen === 'stream')
  return (
    <aside className="rail" aria-label="Workspace">
      <span className="rail-mark">
        <Icon name="mark" />
      </span>
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
        title="Line detail"
        aria-label="Line detail"
        onClick={onStreams}
      >
        <Icon name="panel" />
        <span className="rail-label">Detail</span>
      </button>
      <button
        className="rail-btn"
        type="button"
        title="Manual mode"
        aria-label="Manual mode"
        onClick={() => openSheet('manual')}
      >
        <Icon name="terminal" />
        <span className="rail-label">Manual</span>
      </button>
      <span className="rail-divider" />
      <button
        className="rail-btn"
        type="button"
        title="Settings"
        aria-label="Settings"
        onClick={() => openSheet('settings')}
      >
        <Icon name="settings" />
        <span className="rail-label">Settings</span>
      </button>
      <div className="bottom">
        <button
          className="rail-btn"
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
      </div>
    </aside>
  )
}

export type RailProps = {
  openSheet: (sheet: Exclude<SheetName, null> | null) => void
  toggleTheme: () => void
  onStreams: () => void
}

function ThemeGlyph() {
  const theme = useUi((state) => state.theme)
  return <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
}

export function TopBar({ openSheet, toggleTheme, onExport, onSimulateLoss }: TopBarProps) {
  const manual = usePopover()
  const connection = usePopover()
  const phase = useStreams((state) => (state.simulatedLost ? 'reconnecting' : state.connection))
  const host = window.location.host

  return (
    <header className="topbar">
      <div className="brand">
        <span className="wordmark">log-ui</span>
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
        <span>{phaseLabel(phase)}</span>
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
