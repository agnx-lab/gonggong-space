import { useEffect, useRef } from 'react'
import { api } from '../../lib/api'

/** Each read mark makes the server rebuild and push the group, so a burst of messages is marked at most once a second. */
const READ_INTERVAL_MS = 1000

/**
 * Marks `groupId` read up to `lastSeq`: at once when idle, then throttled. What is pending goes out right away
 * when the tab hides, the page unloads or the view leaves the group, so the read position is never lost.
 */
export function useMarkRead(groupId: string, lastSeq: number, enabled: boolean) {
  const latest = useRef(lastSeq)
  latest.current = lastSeq
  // Survives StrictMode's remount so entering a group is marked once.
  const sent = useRef({ groupId, seq: 0 })
  const seen = useRef(() => {})

  useEffect(() => {
    if (!enabled) return
    if (sent.current.groupId !== groupId) sent.current = { groupId, seq: 0 }
    let pending = 0
    let lastAt = 0
    let timer: ReturnType<typeof setTimeout> | undefined
    const flush = () => {
      clearTimeout(timer)
      timer = undefined
      if (pending <= sent.current.seq) return
      sent.current.seq = pending
      lastAt = Date.now()
      api.post(`/groups/${groupId}/read`, { seq: pending }).catch(() => {})
    }
    // A hidden tab has not really seen new messages: they count once it is visible again.
    const see = () => {
      if (document.hidden) return flush()
      pending = Math.max(pending, latest.current)
      if (pending <= sent.current.seq || timer) return
      const wait = lastAt + READ_INTERVAL_MS - Date.now()
      if (wait <= 0) flush()
      else timer = setTimeout(flush, wait)
    }
    seen.current = see
    see()
    document.addEventListener('visibilitychange', see)
    window.addEventListener('pagehide', flush)
    return () => {
      document.removeEventListener('visibilitychange', see)
      window.removeEventListener('pagehide', flush)
      seen.current = () => {}
      flush()
    }
  }, [groupId, enabled])

  // biome-ignore lint/correctness/useExhaustiveDependencies: lastSeq is the trigger; the effect reads it via `latest`
  useEffect(() => seen.current(), [lastSeq])
}
