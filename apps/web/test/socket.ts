import { act } from '@testing-library/react'
import { onTestFinished, vi } from 'vitest'
import { realtime } from '../src/lib/realtime'

/**
 * Starts the shared realtime client on a stubbed WebSocket: it stays connecting until `open()`; `reconnect()` drops
 * the connection and opens a new one. Stopped when the test ends.
 */
export function startRealtime() {
  let socket: { onopen: (() => void) | null } | undefined
  vi.stubGlobal(
    'WebSocket',
    class {
      onopen: (() => void) | null = null
      onclose: (() => void) | null = null
      onmessage: (() => void) | null = null
      constructor() {
        socket = this
      }
      close() {}
    },
  )
  realtime.start()
  onTestFinished(() => realtime.stop())
  return {
    open: () => act(async () => socket?.onopen?.()),
    reconnect: () =>
      act(async () => {
        realtime.stop()
        realtime.start()
        socket?.onopen?.()
      }),
  }
}
