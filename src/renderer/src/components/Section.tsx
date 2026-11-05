import { useState, type ReactNode } from 'react'

// A titled block that folds away when its heading is clicked. The state is remembered per section.
export function Section({
  id,
  title,
  children
}: {
  id: string
  title: ReactNode
  children: ReactNode
}): React.JSX.Element {
  const storageKey = `bill-tracker:section:${id}`
  const [open, setOpen] = useState(() => window.localStorage.getItem(storageKey) !== 'closed')

  const toggle = (): void => {
    window.localStorage.setItem(storageKey, open ? 'closed' : 'open')
    setOpen(!open)
  }

  return (
    <section className={`section${open ? ' open' : ''}`}>
      <h2>
        <button type="button" className="section-toggle" aria-expanded={open} onClick={toggle}>
          <svg
            className="chevron"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
          <span>{title}</span>
        </button>
      </h2>
      <div className="section-body" inert={!open}>
        <div className="section-inner">{children}</div>
      </div>
    </section>
  )
}
