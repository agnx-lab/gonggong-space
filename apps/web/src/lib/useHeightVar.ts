import { type RefObject, useLayoutEffect } from 'react'

/** Keeps `source`'s rendered height in a CSS variable on `target`, e.g. to stick something just below it. */
export function useHeightVar(
  source: RefObject<HTMLElement | null>,
  target: RefObject<HTMLElement | null>,
  name: string,
) {
  useLayoutEffect(() => {
    const el = source.current
    const to = target.current
    if (!el || !to) return
    const measure = () => to.style.setProperty(name, `${el.offsetHeight}px`)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [source, target, name])
}
