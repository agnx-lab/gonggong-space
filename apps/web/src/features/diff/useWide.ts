import { type RefObject, useLayoutEffect, useState } from 'react'

/** Whether the element is at least `px` wide, tracked as the workbench is resized. */
export function useWide(ref: RefObject<HTMLElement | null>, px: number) {
  const [wide, setWide] = useState(true)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    // A hidden tab (display: none) measures 0; keep its last layout rather than folding it.
    const measure = () => el.clientWidth && setWide(el.clientWidth >= px)
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    measure()
    return () => ro.disconnect()
  }, [ref, px])
  return wide
}
