import { WebEvent } from '@gonggong/protocol'
import { useSyncExternalStore } from 'react'

export type RealtimeStatus = 'connecting' | 'open' | 'closed'

const BASE_DELAY = 500
const MAX_DELAY = 10_000

export function createRealtime() {
  const handlers = new Set<(e: WebEvent) => void>()
  const statusListeners = new Set<(s: RealtimeStatus) => void>()
  let status: RealtimeStatus = 'closed'
  let socket: WebSocket | null = null
  let timer: ReturnType<typeof setTimeout> | undefined
  let attempt = 0
  let running = false

  const setStatus = (s: RealtimeStatus) => {
    if (s === status) return
    status = s
    for (const l of statusListeners) l(s)
  }

  const connect = () => {
    const proto = location.protocol === 'https:' ? 'wss' : 'ws'
    const ws = new WebSocket(`${proto}://${location.host}/ws/web`)
    socket = ws
    setStatus('connecting')
    ws.onopen = () => {
      attempt = 0
      setStatus('open')
    }
    ws.onmessage = (msg: MessageEvent) => {
      let data: unknown
      try {
        data = JSON.parse(String(msg.data))
      } catch {
        return
      }
      const parsed = WebEvent.safeParse(data)
      if (!parsed.success) return
      for (const h of handlers) h(parsed.data)
    }
    ws.onclose = () => {
      if (socket !== ws || !running) return
      socket = null
      setStatus('closed')
      timer = setTimeout(connect, Math.min(MAX_DELAY, BASE_DELAY * 2 ** attempt++))
    }
  }

  const onStatus = (listener: (s: RealtimeStatus) => void) => {
    statusListeners.add(listener)
    return () => {
      statusListeners.delete(listener)
    }
  }

  return {
    start() {
      if (running) return
      running = true
      attempt = 0
      connect()
    },
    stop() {
      running = false
      clearTimeout(timer)
      const ws = socket
      socket = null
      ws?.close()
      setStatus('closed')
    },
    subscribe(handler: (e: WebEvent) => void) {
      handlers.add(handler)
      return () => {
        handlers.delete(handler)
      }
    },
    onStatus,
    /**
     * Calls `cb` whenever the socket opens again after having been open since this call: events sent meanwhile were
     * lost. The first open after subscribing while connecting is not one, so a cold start loads once.
     */
    onReconnect(cb: () => void) {
      let wasOpen = status === 'open'
      return onStatus((s) => {
        if (s !== 'open') return
        if (wasOpen) cb()
        wasOpen = true
      })
    },
    getStatus: () => status,
  }
}

export type Realtime = ReturnType<typeof createRealtime>

export const realtime = createRealtime()

export function useRealtimeStatus(rt: Realtime = realtime) {
  return useSyncExternalStore(rt.onStatus, rt.getStatus)
}
