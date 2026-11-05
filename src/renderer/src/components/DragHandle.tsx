import type { HandleProps } from '../useSortable'

// The grip a row or section is dragged by (see useSortable). The arrow keys move it too.
export function DragHandle({
  label,
  ...props
}: HandleProps & { label: string }): React.JSX.Element {
  return (
    <button
      type="button"
      className="icon drag-handle"
      data-drag-handle
      title={label}
      aria-label={label}
      {...props}
    >
      <svg width="12" height="16" viewBox="0 0 12 16" fill="currentColor" aria-hidden>
        <circle cx="3.5" cy="3" r="1.5" />
        <circle cx="8.5" cy="3" r="1.5" />
        <circle cx="3.5" cy="8" r="1.5" />
        <circle cx="8.5" cy="8" r="1.5" />
        <circle cx="3.5" cy="13" r="1.5" />
        <circle cx="8.5" cy="13" r="1.5" />
      </svg>
    </button>
  )
}
