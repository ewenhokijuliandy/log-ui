import { type ReactNode, useEffect, useRef } from 'react'
import { copyText } from '../lib/clipboard.ts'
import { Icon } from './icons.tsx'

export function DialogFrame({
  open,
  wide = false,
  className,
  label,
  onClose,
  children,
}: {
  open: boolean
  wide?: boolean
  className?: string
  label?: string
  onClose: () => void
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement | null>(null)
  const returnFocus = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return
    const node = ref.current
    if (node === null) return
    const previous = document.activeElement
    returnFocus.current = previous instanceof HTMLElement ? previous : null
    node.showModal()
    node.focus()
    return () => {
      node.close()
      const target = returnFocus.current
      returnFocus.current = null
      if (target?.isConnected) target.focus()
    }
  }, [open])

  if (!open) return null

  return (
    <dialog
      ref={ref}
      className={[wide ? 'wide' : '', className ?? ''].join(' ').trim()}
      aria-label={label}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return
        const rect = event.currentTarget.getBoundingClientRect()
        const inside =
          event.clientX >= rect.left &&
          event.clientX <= rect.right &&
          event.clientY >= rect.top &&
          event.clientY <= rect.bottom
        if (inside) return
        onClose()
      }}
    >
      {children}
    </dialog>
  )
}

export function PipeRow({ command }: { command: string }) {
  return (
    <div className="pipe-row">
      <code>{command}</code>
      <button
        className="icon-btn"
        type="button"
        aria-label={`Copy ${command}`}
        title={`Copy ${command}`}
        onClick={() => void copyText(command)}
      >
        <Icon name="copy" />
      </button>
    </div>
  )
}

export type SegmentValue = string

export function Segment({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: Array<{ value: SegmentValue; label: string }>
  onChange: (value: SegmentValue) => void
}) {
  return (
    <div className="segment" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
