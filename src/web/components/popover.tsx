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
    close: () => setOpen(false),
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

  if (!control.open) return null

  return createPortal(
    <div
      className="popover"
      role="menu"
      aria-label={label}
      style={{ left: box?.left ?? 0, top: box?.top ?? 0, minWidth: width }}
    >
      {children}
    </div>,
    document.body,
  )
}
