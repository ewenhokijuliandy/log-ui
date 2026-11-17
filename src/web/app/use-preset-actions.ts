import { useCallback } from 'react'
import type { FilterState, SortKey } from '../lib/filters.ts'
import { createPreset, type Preset, savePresets } from '../lib/presets.ts'

export type PresetActions = {
  savePreset: (name: string, filter: FilterState, sort: SortKey, trace: string | null) => void
  renamePreset: (id: string, name: string) => void
  deletePreset: (id: string) => void
}

export function usePresetActions(
  presets: readonly Preset[],
  setPresets: (next: Preset[]) => void,
): PresetActions {
  const savePreset = useCallback(
    (name: string, filter: FilterState, sort: SortKey, trace: string | null): void => {
      if (name.length === 0) return
      const preset = createPreset(crypto.randomUUID(), name, filter, sort, trace)
      const next = [...presets, preset]
      setPresets(next)
      savePresets(window.localStorage, next)
    },
    [presets, setPresets],
  )

  const renamePreset = useCallback(
    (id: string, name: string): void => {
      const clean = name.trim()
      if (clean.length === 0) return
      const next = presets.map((preset) => (preset.id === id ? { ...preset, name: clean } : preset))
      setPresets(next)
      savePresets(window.localStorage, next)
    },
    [presets, setPresets],
  )

  const deletePreset = useCallback(
    (id: string): void => {
      const next = presets.filter((preset) => preset.id !== id)
      setPresets(next)
      savePresets(window.localStorage, next)
    },
    [presets, setPresets],
  )

  return { savePreset, renamePreset, deletePreset }
}
