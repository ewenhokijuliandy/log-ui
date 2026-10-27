import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export type PopoverControl = {
  open: boolean
  setOpen: (value: boolean) => void
  close: () => void
  bindTrigger: (node: HTMLElement | null) => void
  rect: () => DOMRect | null
}

export function usePopover(): PopoverControl {
  const [open, setOpen] = useState(false)
  const nodeRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null
      if (target === null) return
      const trigger = nodeRef.current
      if (trigger?.contains(target)) return
      if ((target as HTMLElement).closest?.('.popover') !== null) return
      setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return {
    open,
    setOpen,
    close: () => {
      setOpen(false)
      nodeRef.current?.focus()
    },
    bindTrigger: (node) => {
      nodeRef.current = node
    },
    rect: () => nodeRef.current?.getBoundingClientRect() ?? null,
  }
}

export function PopoverPanel({
  control,
  label,
  align = 'end',
  width = 260,
  children,
}: {
  control: PopoverControl
  label: string
  align?: 'start' | 'end'
  width?: number
  children: ReactNode
}) {
  const [box, setBox] = useState<{ left: number; top: number } | null>(null)
  const panelRef = useRef<HTMLDivElement | null>(null)

  useLayoutEffect(() => {
    if (!control.open) {
      setBox(null)
      return
    }
    const rect = control.rect()
    if (rect === null) {
      setBox({ left: window.innerWidth - width - 12, top: 12 })
      return
    }
    const left = align === 'end' ? rect.right - width : rect.left
    setBox({
      left: Math.max(8, Math.min(left, window.innerWidth - width - 8)),
      top: rect.bottom + 6,
    })
  }, [control.open, align, width, control])

  useEffect(() => {
    if (!control.open) return
    const first = panelRef.current?.querySelector<HTMLElement>('[role^="menuitem"]')
    first?.focus()
  }, [control.open])

  if (!control.open) return null

  function moveFocus(event: React.KeyboardEvent<HTMLDivElement>): void {
    const target = event.target as HTMLElement
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      control.close()
      return
    }
    if (event.key === 'Tab') {
      control.close()
      return
    }
    if (
      event.key !== 'ArrowDown' &&
      event.key !== 'ArrowUp' &&
      event.key !== 'Home' &&
      event.key !== 'End'
    ) {
      return
    }
    const items = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>('[role^="menuitem"]'),
    )
    if (items.length === 0) return
    event.preventDefault()
    const current = items.indexOf(document.activeElement as HTMLElement)
    let next = 0
    if (event.key === 'End') next = items.length - 1
    if (event.key === 'ArrowDown') next = current < 0 ? 0 : (current + 1) % items.length
    if (event.key === 'ArrowUp') {
      next = current < 0 ? items.length - 1 : (current - 1 + items.length) % items.length
    }
    items[next]?.focus()
  }

  return createPortal(
    <div
      ref={panelRef}
      className="popover"
      role="menu"
      aria-label={label}
      style={{ left: box?.left ?? 0, top: box?.top ?? 0, minWidth: width }}
      onKeyDown={moveFocus}
    >
      {children}
    </div>,
    document.body,
  )
}
