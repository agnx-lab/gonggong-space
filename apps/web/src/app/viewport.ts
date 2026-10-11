import { useSyncExternalStore } from 'react'

export const MOBILE_MAX = 768
export const RAIL_MIN = 1100

const subscribe = (cb: () => void) => {
  window.addEventListener('resize', cb)
  return () => window.removeEventListener('resize', cb)
}

/**
 * The width CSS media queries see. Not window.innerWidth: Android Chrome zooms out to fit overflowing content
 * and innerWidth grows with it, which would flip a phone into the desktop columns and keep it there.
 */
const viewportWidth = () => document.documentElement.clientWidth

export const useViewportWidth = () => useSyncExternalStore(subscribe, viewportWidth)
export const useIsMobile = () => useViewportWidth() < MOBILE_MAX
