import { useSyncExternalStore } from 'react'

const subscribe = (onChange: () => void) => {
  const mo = new MutationObserver(onChange)
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  return () => mo.disconnect()
}
const isDark = () => document.documentElement.dataset.theme === 'dark'

/** The app's resolved theme (`data-theme` on <html>), for libraries that take colours instead of CSS. */
export const useDark = () => useSyncExternalStore(subscribe, isDark)

/** A design token's current value. */
export const token = (name: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim()
