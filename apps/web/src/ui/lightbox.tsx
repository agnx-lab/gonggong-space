import { type ReactNode, type TouchEvent, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { t } from '../i18n'
import { cx } from '../lib/cx'
import { CloseButton } from './controls'
import { Icon } from './icon'
import { useEscape, useFocusTrap } from './overlay'
import './lightbox.css'

export type LightboxItem = { src: string; alt: string }

/** A horizontal swipe longer than this (and wider than tall) pages. */
const SWIPE_PX = 50

type Source =
  | { src: string; alt: string; items?: undefined; index?: undefined; onIndexChange?: undefined }
  | {
      /** Several images paged with ←/→, swipes and the side buttons; no wrap-around at either end. */
      items: LightboxItem[]
      index: number
      onIndexChange: (index: number) => void
      src?: undefined
      alt?: undefined
    }

/** Full-window image viewer: fits the window, click the image for its natural size; Escape or the scrim closes. */
export function Lightbox({
  onClose,
  actions,
  ...source
}: Source & {
  onClose: () => void
  /** Extra toolbar items left of the close button, e.g. 下载. */
  actions?: ReactNode
}) {
  const items = source.items ?? [{ src: source.src as string, alt: source.alt as string }]
  const index = source.index ?? 0
  const item = items[index] ?? items[0]!
  const ref = useRef<HTMLDivElement>(null)
  const [zoomed, setZoomed] = useState(false)
  const touch = useRef<{ x: number; y: number } | null>(null)
  useEscape(onClose)
  useFocusTrap(ref, true)
  const go = (to: number) => {
    if (to < 0 || to >= items.length || to === index) return
    setZoomed(false)
    source.onIndexChange?.(to)
  }
  const goRef = useRef(go)
  goRef.current = go
  const paged = items.length > 1
  useEffect(() => {
    if (!paged) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goRef.current(index - 1)
      else if (e.key === 'ArrowRight') goRef.current(index + 1)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [paged, index])
  // Neighbours load ahead so paging shows them at once.
  useEffect(() => {
    for (const n of [items[index - 1], items[index + 1]]) if (n) new Image().src = n.src
  }, [items, index])
  const onTouchStart = (e: TouchEvent) => {
    const p = e.touches[0]
    touch.current = p && !zoomed ? { x: p.clientX, y: p.clientY } : null
  }
  const onTouchEnd = (e: TouchEvent) => {
    const from = touch.current
    const p = e.changedTouches[0]
    touch.current = null
    if (!from || !p) return
    const dx = p.clientX - from.x
    if (Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(p.clientY - from.y)) go(index + (dx < 0 ? 1 : -1))
  }
  return createPortal(
    <div
      ref={ref}
      className="ui-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={item.alt}
      tabIndex={-1}
      onTouchStart={paged ? onTouchStart : undefined}
      onTouchEnd={paged ? onTouchEnd : undefined}
    >
      <div className="ui-lightbox__scrim" onClick={onClose} aria-hidden="true" />
      <div className="ui-lightbox__bar">
        <span className="ui-lightbox__title">{item.alt}</span>
        {paged ? <span className="ui-lightbox__count">{`${index + 1} / ${items.length}`}</span> : null}
        {actions}
        <CloseButton onClick={onClose} />
      </div>
      <div className={cx('ui-lightbox__stage', zoomed && 'ui-lightbox__stage--zoomed')}>
        <button
          type="button"
          className="ui-lightbox__img"
          aria-label={zoomed ? t('缩小') : t('放大')}
          onClick={() => setZoomed((z) => !z)}
        >
          <img src={item.src} alt={item.alt} />
        </button>
      </div>
      {paged ? (
        <>
          <button
            type="button"
            className="ui-lightbox__nav ui-lightbox__nav--prev"
            aria-label={t('上一张')}
            disabled={index === 0}
            onClick={() => go(index - 1)}
          >
            <Icon name="chevron-left" size={22} />
          </button>
          <button
            type="button"
            className="ui-lightbox__nav ui-lightbox__nav--next"
            aria-label={t('下一张')}
            disabled={index === items.length - 1}
            onClick={() => go(index + 1)}
          >
            <Icon name="chevron-right" size={22} />
          </button>
        </>
      ) : null}
    </div>,
    document.body,
  )
}
