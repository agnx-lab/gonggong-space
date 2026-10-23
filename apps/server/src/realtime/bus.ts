import type { WebEvent } from '@gonggong/protocol'

/**
 * `json` serializes the event, once per publish however many connections receive it. `group` is set for events
 * only wanted by a connection showing that group: the sink drops them otherwise.
 */
type Sink = (event: WebEvent, json: () => string, group?: string) => void

/** Fan-out of realtime events to connected browser sessions, keyed by user. */
export class Bus {
  private sinks = new Map<string, Set<Sink>>()
  private closers = new Map<Sink, () => void>()
  private readers = new Map<Sink, () => string | null>()

  /**
   * `close` ends the underlying connection when the user is disconnected (account disabled); `reading` names the group
   * the user is looking at through it right now, if any.
   */
  attach(userId: string, sink: Sink, close?: () => void, reading?: () => string | null) {
    const set = this.sinks.get(userId) ?? new Set()
    set.add(sink)
    this.sinks.set(userId, set)
    if (close) this.closers.set(sink, close)
    if (reading) this.readers.set(sink, reading)
    return () => {
      set.delete(sink)
      this.closers.delete(sink)
      this.readers.delete(sink)
      if (!set.size) this.sinks.delete(userId)
    }
  }

  disconnect(userId: string) {
    for (const sink of [...(this.sinks.get(userId) ?? [])]) this.closers.get(sink)?.()
  }

  publish(userIds: Iterable<string>, event: WebEvent, group?: string) {
    let text: string | undefined
    const json = () => (text ??= JSON.stringify(event))
    for (const id of new Set(userIds)) for (const sink of this.sinks.get(id) ?? []) sink(event, json, group)
  }

  isConnected(userId: string) {
    return this.sinks.has(userId)
  }

  isReading(userId: string, groupId: string) {
    return [...(this.sinks.get(userId) ?? [])].some((sink) => this.readers.get(sink)?.() === groupId)
  }
}
