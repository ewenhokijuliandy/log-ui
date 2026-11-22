import type { ReactNode } from 'react'

export function ToolView({
  title,
  description,
  onBack,
  actions,
  children,
}: {
  title: string
  description: string
  onBack: () => void
  actions?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="tool-view" aria-label={title} tabIndex={-1}>
      <header className="tool-view-head">
        <button className="tool-view-back" type="button" onClick={onBack}>
          ← Back to logs
        </button>
        <div className="tool-view-title-row">
          <div>
            <h1 className="tool-view-title">{title}</h1>
            <p className="tool-view-desc">{description}</p>
          </div>
          {actions === undefined ? null : <div className="tool-view-actions">{actions}</div>}
        </div>
      </header>
      <div className="tool-view-body">{children}</div>
    </section>
  )
}
