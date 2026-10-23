import { type KeyboardEvent, type PointerEvent, type ReactNode, useRef, useState } from 'react'
import './split.css'

const STEP = 24

const stored = (key: string) => {
  try {
    return Number(localStorage.getItem(key)) || null
  } catch {
    return null
  }
}

/**
 * Two panes with a draggable divider (← → / ↑ ↓ on it too), `first` sized in px and kept in this browser under
 * `storageKey`; the second pane always keeps at least `min` px.
 */
export function Split({
  dir = 'row',
  storageKey,
  initial,
  min = 160,
  first,
  second,
  label,
}: {
  dir?: 'row' | 'column'
  storageKey: string
  initial: number
  min?: number
  first: ReactNode
  second: ReactNode
  label: string
}) {
  const root = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState(() => stored(storageKey) ?? initial)
  const row = dir === 'row'
  const clamp = (n: number) => {
    const el = root.current
    const total = el ? (row ? el.clientWidth : el.clientHeight) : Number.POSITIVE_INFINITY
    return Math.round(Math.max(min, Math.min(n, total - min)))
  }
  const keep = (n: number) => {
    try {
      localStorage.setItem(storageKey, String(n))
    } catch {
      // storage unavailable: the size lasts for this page only
    }
  }
  const down = (e: PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.currentTarget.setPointerCapture?.(e.pointerId)
    const from = row ? e.clientX : e.clientY
    const start = size
    let latest = size
    let frame = 0
    document.documentElement.dataset.resizing = row ? '' : 'row'
    const move = (ev: globalThis.PointerEvent) => {
      latest = clamp(start + (row ? ev.clientX : ev.clientY) - from)
      frame ||= requestAnimationFrame(() => {
        frame = 0
        setSize(latest)
      })
    }
    const up = () => {
      cancelAnimationFrame(frame)
      delete document.documentElement.dataset.resizing
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      setSize(latest)
      keep(latest)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }
  const key = (e: KeyboardEvent<HTMLDivElement>) => {
    const d = row
      ? e.key === 'ArrowRight'
        ? 1
        : e.key === 'ArrowLeft'
          ? -1
          : 0
      : e.key === 'ArrowDown'
        ? 1
        : e.key === 'ArrowUp'
          ? -1
          : 0
    if (!d) return
    e.preventDefault()
    const next = clamp(size + d * STEP)
    setSize(next)
    keep(next)
  }
  return (
    <div ref={root} className="gsplit" data-dir={dir}>
      <div className="gsplit__first" style={row ? { width: size } : { height: size }}>
        {first}
      </div>
      {/* biome-ignore lint/a11y/useSemanticElements: an <hr> cannot be focused and dragged; this is the ARIA window splitter pattern */}
      <div
        role="separator"
        aria-label={label}
        aria-orientation={row ? 'vertical' : 'horizontal'}
        aria-valuenow={size}
        tabIndex={0}
        className="gsplit__handle"
        onPointerDown={down}
        onKeyDown={key}
      />
      <div className="gsplit__second">{second}</div>
    </div>
  )
}
