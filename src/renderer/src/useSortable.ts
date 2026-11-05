import { useLayoutEffect, useRef } from 'react'

// Reordering by dragging a handle, with the mouse or a finger (pointer events), or with the arrow keys
// while the handle has focus. The items are moved with CSS transforms while dragging; the new order is
// reported once, on release.

const THRESHOLD = 4 // px the pointer travels before a press becomes a drag (a tap stays a tap)
const EDGE = 64 // px from the top/bottom of the window where the page scrolls by itself
const MAX_SPEED = 14 // px per frame at the very edge

export interface HandleProps {
  disabled: boolean
  onPointerDown: (e: React.PointerEvent<HTMLElement>) => void
  onPointerMove: (e: React.PointerEvent<HTMLElement>) => void
  onPointerUp: (e: React.PointerEvent<HTMLElement>) => void
  onPointerCancel: (e: React.PointerEvent<HTMLElement>) => void
  onLostPointerCapture: (e: React.PointerEvent<HTMLElement>) => void
  onKeyDown: (e: React.KeyboardEvent<HTMLElement>) => void
}

export interface Sortable {
  // the element that moves, one per id
  itemRef: (id: string) => (el: HTMLElement | null) => void
  // for the handle inside that element
  handleProps: (id: string) => HandleProps
}

interface Drag {
  pointerId: number
  ids: string[]
  from: number
  to: number
  startY: number // page position of the press
  grab: number // distance from the pointer to the top of the item, at the press
  clientY: number
  started: boolean
  els: HTMLElement[]
  tops: number[] // page positions, measured when the drag starts
  heights: number[]
  step: number // how far the other items move to make room
  frame: number
  onScroll: () => void
}

const moved = (ids: string[], from: number, to: number): string[] => {
  const next = [...ids]
  next.splice(to, 0, ...next.splice(from, 1))
  return next
}

export function useSortable(
  ids: string[],
  onMove: (ids: string[]) => void,
  // onStart may change the layout (e.g. fold the sections); the items are measured after it
  options: { onStart?: () => void; onEnd?: () => void } = {}
): Sortable {
  const elements = useRef(new Map<string, HTMLElement>())
  const refs = useRef(new Map<string, (el: HTMLElement | null) => void>())
  const drag = useRef<Drag | null>(null)
  // what the event handlers below read: the list and callbacks of the latest render
  const latest = useRef({ ids, onMove, options })
  useLayoutEffect(() => {
    latest.current = { ids, onMove, options }
  })

  const layout = (d: Drag): void => {
    const top = d.clientY + window.scrollY - d.grab
    const center = top + d.heights[d.from] / 2
    const mid = (i: number): number => d.tops[i] + d.heights[i] / 2
    let to = d.from
    for (let i = d.from + 1; i < d.ids.length && center > mid(i); i++) to = i
    for (let i = d.from - 1; i >= 0 && center < mid(i); i--) to = i
    d.to = to
    d.els.forEach((el, i) => {
      let y = 0
      if (i === d.from) y = top - d.tops[i]
      else if (i > d.from && i <= to) y = -d.step
      else if (i < d.from && i >= to) y = d.step
      el.style.transform = y ? `translateY(${y}px)` : ''
    })
  }

  // near the top or bottom edge the page scrolls, so a row can be taken past what is on screen
  const autoScroll = (): void => {
    const d = drag.current
    if (!d?.started) return
    const fromBottom = window.innerHeight - d.clientY
    const speed =
      d.clientY < EDGE
        ? -MAX_SPEED * (1 - d.clientY / EDGE)
        : fromBottom < EDGE
          ? MAX_SPEED * (1 - fromBottom / EDGE)
          : 0
    if (speed) window.scrollBy(0, speed)
    d.frame = requestAnimationFrame(autoScroll)
  }

  const start = (d: Drag): boolean => {
    document.documentElement.classList.add('sort-active')
    latest.current.options.onStart?.()
    const els = d.ids.map((id) => elements.current.get(id))
    if (els.some((el) => !el)) {
      document.documentElement.classList.remove('sort-active')
      latest.current.options.onEnd?.()
      return false
    }
    d.els = els as HTMLElement[]
    const rects = d.els.map((el) => el.getBoundingClientRect())
    d.tops = rects.map((r) => r.top + window.scrollY)
    d.heights = rects.map((r) => r.height)
    const gap = d.ids.length > 1 ? Math.max(0, rects[1].top - rects[0].bottom) : 0
    d.step = d.heights[d.from] + gap
    // the press was measured before onStart; keep the same grab point on the item as it is now
    d.grab = Math.min(Math.max(d.grab, 0), d.heights[d.from])
    d.els.forEach((el, i) => el.classList.add(i === d.from ? 'sort-dragging' : 'sort-shifting'))
    // the pointer stays put while the page scrolls (wheel or autoScroll); the item must follow
    d.onScroll = () => layout(d)
    window.addEventListener('scroll', d.onScroll, { passive: true })
    d.started = true
    d.frame = requestAnimationFrame(autoScroll)
    return true
  }

  const finish = (save: boolean): void => {
    const d = drag.current
    drag.current = null
    if (!d?.started) return
    cancelAnimationFrame(d.frame)
    window.removeEventListener('scroll', d.onScroll)
    d.els.forEach((el) => {
      el.style.transform = ''
      el.classList.remove('sort-dragging', 'sort-shifting')
    })
    document.documentElement.classList.remove('sort-active')
    latest.current.options.onEnd?.()
    if (save && d.to !== d.from) latest.current.onMove(moved(d.ids, d.from, d.to))
  }

  const itemRef = (id: string): ((el: HTMLElement | null) => void) => {
    let ref = refs.current.get(id)
    if (!ref) {
      ref = (el) => {
        if (el) elements.current.set(id, el)
        else elements.current.delete(id)
      }
      refs.current.set(id, ref)
    }
    return ref
  }

  const handleProps = (id: string): HandleProps => ({
    disabled: ids.length < 2,
    onPointerDown(e) {
      const el = elements.current.get(id)
      const from = latest.current.ids.indexOf(id)
      if (e.button !== 0 || drag.current || !el || from < 0) return
      e.preventDefault()
      e.currentTarget.setPointerCapture(e.pointerId)
      drag.current = {
        pointerId: e.pointerId,
        ids: latest.current.ids,
        from,
        to: from,
        startY: e.clientY + window.scrollY,
        grab: e.clientY - el.getBoundingClientRect().top,
        clientY: e.clientY,
        started: false,
        els: [],
        tops: [],
        heights: [],
        step: 0,
        frame: 0,
        onScroll: () => {}
      }
    },
    onPointerMove(e) {
      const d = drag.current
      if (!d || e.pointerId !== d.pointerId) return
      d.clientY = e.clientY
      if (!d.started) {
        if (Math.abs(e.clientY + window.scrollY - d.startY) < THRESHOLD) return
        if (!start(d)) {
          drag.current = null
          return
        }
      }
      layout(d)
    },
    onPointerUp(e) {
      if (drag.current?.pointerId === e.pointerId) finish(true)
    },
    onPointerCancel(e) {
      if (drag.current?.pointerId === e.pointerId) finish(false)
    },
    // after a normal release the drag is already over; otherwise the browser took the pointer away
    onLostPointerCapture(e) {
      if (drag.current?.pointerId === e.pointerId) finish(false)
    },
    onKeyDown(e) {
      const step = e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0
      const current = latest.current.ids
      const from = current.indexOf(id)
      const to = from + step
      if (!step || from < 0 || to < 0 || to >= current.length) return
      e.preventDefault()
      latest.current.onMove(moved(current, from, to))
      // the item is put in its new place in the page, which can take the focus off the handle
      requestAnimationFrame(() =>
        elements.current.get(id)?.querySelector<HTMLElement>('[data-drag-handle]')?.focus()
      )
    }
  })

  return { itemRef, handleProps }
}
