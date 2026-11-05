import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface Pos {
  left: number
  top?: number
  bottom?: number
  up: boolean
  closing: boolean
}

const CLOSE_MS = 140

// Button that opens an animated popover. The popover is rendered in a portal so tables with
// overflow/backdrop-filter cannot clip it.
export function PopoverButton({
  className,
  label,
  estimatedHeight = 120,
  children
}: {
  className: string
  label: ReactNode
  estimatedHeight?: number
  children: (close: () => void) => ReactNode
}): React.JSX.Element {
  const [pos, setPos] = useState<Pos | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)

  const close = useCallback(() => setPos((p) => (p ? { ...p, closing: true } : p)), [])

  // Unmount once the closing animation has played; reopening resets `closing` and cancels this.
  useEffect(() => {
    if (!pos?.closing) return
    const t = window.setTimeout(() => setPos(null), CLOSE_MS)
    return () => window.clearTimeout(t)
  }, [pos])

  const toggle = (): void => {
    if (pos && !pos.closing) {
      close()
      return
    }
    const r = btnRef.current!.getBoundingClientRect()
    const up = window.innerHeight - r.bottom < estimatedHeight + 16
    setPos({
      // stay inside the screen on a narrow phone (the widest popover is the 230px month grid)
      left: Math.max(8, Math.min(r.left, window.innerWidth - 250)),
      top: up ? undefined : r.bottom + 6,
      bottom: up ? window.innerHeight - r.top + 6 : undefined,
      up,
      closing: false
    })
  }

  useEffect(() => {
    if (!pos || pos.closing) return
    const onDown = (e: MouseEvent): void => {
      const t = e.target as Node
      if (!popRef.current?.contains(t) && !btnRef.current?.contains(t)) close()
    }
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    window.addEventListener('resize', close)
    window.addEventListener('scroll', close, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('resize', close)
      window.removeEventListener('scroll', close, true)
    }
  }, [pos, close])

  return (
    <>
      <button ref={btnRef} type="button" className={className} onClick={toggle}>
        {label} <span className="caret">▾</span>
      </button>
      {pos &&
        createPortal(
          <div
            ref={popRef}
            className={`popover${pos.up ? ' up' : ''}${pos.closing ? ' closing' : ''}`}
            style={{ left: pos.left, top: pos.top, bottom: pos.bottom }}
          >
            {children(close)}
          </div>,
          document.body
        )}
    </>
  )
}
