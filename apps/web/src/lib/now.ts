import { useEffect, useState } from 'react'

/** Current time, re-rendered every second while `ticking`. */
export function useNow(ticking: boolean) {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    if (!ticking) return
    setNow(Date.now())
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [ticking])
  return now
}

/**
 * Time from `from` to `to`, or to now while `to` is null; a leaf, so the per-second tick (while `ticking`) re-renders
 * only this text and not the view around it.
 */
export function Elapsed({
  from,
  to = null,
  ticking,
  format,
}: {
  from: number
  to?: number | null
  ticking: boolean
  format: (ms: number) => string
}) {
  const now = useNow(ticking && to === null)
  return format((to ?? now) - from)
}
