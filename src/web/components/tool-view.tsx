import type { ReactNode } from 'react'

export function ToolView({
  title,
  description,
  actions,
  children,
}: {
  title: string
  description: string
  actions?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="tool-view" aria-label={title} tabIndex={-1}>
      <header className="tool-view-head">
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
