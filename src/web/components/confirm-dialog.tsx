import { DialogFrame } from './dialog-frame.tsx'

export type SheetIntroProps = {
  open: boolean
  title: string
  body: string
  confirmLabel: string
  cancelLabel: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: SheetIntroProps) {
  return (
    <DialogFrame open={open} label={title} onClose={onCancel}>
      <h2>{title}</h2>
      <p>{body}</p>
      <div className="dialog-actions">
        <button className="btn" type="button" onClick={onCancel}>
          {cancelLabel}
        </button>
        <button className="btn danger" type="button" onClick={onConfirm}>
          {confirmLabel}
        </button>
      </div>
    </DialogFrame>
  )
}
