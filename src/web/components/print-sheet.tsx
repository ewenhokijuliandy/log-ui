import { DialogFrame } from './dialog-frame.tsx'

export function PrintSheet({
  open,
  title,
  meta,
  pages,
  onClose,
}: {
  open: boolean
  title: string
  meta: string
  pages: string[]
  onClose: () => void
}) {
  return (
    <DialogFrame
      open={open}
      className="print-sheet"
      label={title === '' ? 'Print preview' : title}
      onClose={onClose}
    >
      <div className="print-head">
        <h2>{title}</h2>
        <p>{meta}</p>
      </div>
      <div>
        {pages.map((content, index) => (
          <div className="print-page" key={index}>
            <pre>{content}</pre>
            <p className="page-no">
              Page {String(index + 1)} of {String(pages.length)}
            </p>
          </div>
        ))}
      </div>
      <div className="print-actions">
        <button className="btn" type="button" onClick={onClose}>
          Close
        </button>
        <button className="btn primary" type="button" onClick={() => window.print()}>
          Print
        </button>
      </div>
    </DialogFrame>
  )
}
