import { useEffect } from 'react'
import type { LogRecord } from '../../shared/types.ts'
import { useUi } from './ui.ts'

export function nextVisibleSeq(
  visible: readonly LogRecord[],
  currentSeq: number | null,
  step: number,
): number | null {
  if (visible.length === 0) return null
  const index = currentSeq === null ? -1 : visible.findIndex((record) => record.seq === currentSeq)
  const target =
    index === -1
      ? step > 0
        ? 0
        : visible.length - 1
      : Math.max(0, Math.min(visible.length - 1, index + step))
  return visible[target]?.seq ?? null
}

export type KeyboardShortcuts = {
  activeId: string | null
  visible: readonly LogRecord[]
  quickOpen: boolean
  sheetOpen: boolean
  closeSheet: () => void
  openHelp: () => void
  openInspector: () => void
  toggleTheme: () => void
}

export function useKeyboardShortcuts({
  activeId,
  visible,
  quickOpen,
  sheetOpen,
  closeSheet,
  openHelp,
  openInspector,
  toggleTheme,
}: KeyboardShortcuts): void {
  const select = useUi((state) => state.select)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && sheetOpen) {
        closeSheet()
        return
      }
      if (document.querySelector('dialog[open]') !== null) return
      const target = event.target as HTMLElement | null
      const typing =
        target !== null && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')
      if (typing) return
      if (event.key === '/') {
        event.preventDefault()
        const box = document.querySelector('[data-search]') as HTMLInputElement | null
        box?.focus()
        return
      }
      if (quickOpen) return
      if (event.key === 'j' || event.key === 'k') {
        event.preventDefault()
        const current = activeId === null ? null : (useUi.getState().selectedSeq[activeId] ?? null)
        const seq = nextVisibleSeq(visible, current, event.key === 'j' ? 1 : -1)
        if (seq === null) return
        select(activeId, seq)
        return
      }
      if (event.key === 'Enter') {
        if (visible.length === 0) return
        openInspector()
        return
      }
      if (event.key === 't') {
        event.preventDefault()
        toggleTheme()
        return
      }
      if (event.key === '?') {
        event.preventDefault()
        openHelp()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [
    activeId,
    closeSheet,
    openHelp,
    openInspector,
    quickOpen,
    select,
    sheetOpen,
    toggleTheme,
    visible,
  ])
}
