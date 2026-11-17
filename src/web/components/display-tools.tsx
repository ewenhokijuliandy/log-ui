import { formatNumber } from '../lib/format-time.ts'
import { Icon } from './icons.tsx'
import { MenuItem } from './menu-item.tsx'
import { PopoverPanel, usePopover } from './popover.tsx'

export type DisplayToolsProps = {
  zone: 'utc' | 'local'
  autoscroll: boolean
  wrap: boolean
  paused: boolean
  pending: number
  onToggleZone: () => void
  onToggleWrap: () => void
  onToggleAutoscroll: () => void
  onTogglePause: () => void
}

export function DisplayTools({
  zone,
  autoscroll,
  wrap,
  paused,
  pending,
  onToggleZone,
  onToggleWrap,
  onToggleAutoscroll,
  onTogglePause,
}: DisplayToolsProps) {
  return (
    <>
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
    </>
  )
}

export function MoreTools({
  zone,
  autoscroll,
  wrap,
  onToggleZone,
  onToggleWrap,
  onToggleAutoscroll,
}: Omit<DisplayToolsProps, 'paused' | 'pending' | 'onTogglePause'>) {
  const menu = usePopover()
  return (
    <>
      <button
        className="tool tool-more"
        type="button"
        id="more-trigger"
        data-tool="more"
        ref={menu.bindTrigger}
        aria-haspopup="menu"
        aria-expanded={menu.open}
        aria-label="More tools"
        title="More tools"
        onClick={() => menu.setOpen(!menu.open)}
      >
        <Icon name="more" />
      </button>
      <PopoverPanel control={menu} label="More tools" width={240}>
        <div className="popover-title">More tools</div>
        <MenuItem
          label="Timestamp zone"
          note={zone === 'utc' ? 'UTC' : 'Local'}
          onPress={() => {
            onToggleZone()
            menu.close()
          }}
        />
        <MenuItem
          label="Word wrap"
          note={wrap ? 'On' : 'Off'}
          onPress={() => {
            onToggleWrap()
            menu.close()
          }}
        />
        <MenuItem
          label="Auto-scroll"
          note={autoscroll ? 'On' : 'Off'}
          onPress={() => {
            onToggleAutoscroll()
            menu.close()
          }}
        />
      </PopoverPanel>
    </>
  )
}
