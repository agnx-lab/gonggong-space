import { useSyncExternalStore } from 'react'

const subscribe = (cb: () => void) => {
  document.addEventListener('visibilitychange', cb)
  return () => document.removeEventListener('visibilitychange', cb)
}

/** False while the page's tab is in the background or its window is minimized. */
export const useDocumentVisible = () => useSyncExternalStore(subscribe, () => !document.hidden)
