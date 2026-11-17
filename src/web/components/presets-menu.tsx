import { useEffect, useRef, useState } from 'react'
import type { Preset } from '../lib/presets.ts'
import { Icon } from './icons.tsx'
import { MenuItem } from './menu-item.tsx'
import { PopoverPanel, usePopover } from './popover.tsx'

export type PresetsMenuProps = {
  presets: Preset[]
  onApplyPreset: (preset: Preset) => void
  onSavePreset: (name: string) => void
  onDeletePreset: (id: string) => void
  onRenamePreset: (id: string, name: string) => void
}

export function PresetsMenu({
  presets,
  onApplyPreset,
  onSavePreset,
  onDeletePreset,
  onRenamePreset,
}: PresetsMenuProps) {
  const menu = usePopover()
  const [saving, setSaving] = useState(false)
  const [presetName, setPresetName] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const saveRef = useRef<HTMLInputElement | null>(null)
  const renameRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (menu.open) return
    setSaving(false)
    setRenamingId(null)
    setPresetName('')
    setRenameValue('')
  }, [menu.open])

  useEffect(() => {
    if (!saving) return
    saveRef.current?.focus()
  }, [saving])

  useEffect(() => {
    if (renamingId === null) return
    renameRef.current?.focus()
  }, [renamingId])

  function commitPresetName(): void {
    const name = presetName.trim()
    if (name.length === 0) return
    onSavePreset(name)
    setPresetName('')
    setSaving(false)
    menu.close()
  }

  function commitRename(id: string): void {
    const name = renameValue.trim()
    if (name.length > 0) onRenamePreset(id, name)
    setRenamingId(null)
    setRenameValue('')
  }

  return (
    <>
      <button
        className="tool"
        type="button"
        data-tool="presets"
        ref={menu.bindTrigger}
        aria-haspopup="menu"
        aria-expanded={menu.open}
        aria-label="Filter presets"
        title="Filter presets"
        onClick={() => menu.setOpen(!menu.open)}
      >
        <Icon name="bookmark" />
        <span className="label">Presets</span> <span className="badge">{presets.length}</span>
      </button>
      <PopoverPanel control={menu} label="Filter presets" width={300}>
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
                    menu.close()
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
    </>
  )
}
