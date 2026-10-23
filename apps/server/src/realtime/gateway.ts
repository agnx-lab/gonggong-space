import { WebClientMsg } from '@gonggong/protocol'
import type { FastifyInstance } from 'fastify'
import type { Ctx } from '../context.js'
import { resolveSession, SESSION_COOKIE } from '../modules/auth/session.js'

/** Past this much unsent data the client is not keeping up: it is dropped and refills after reconnecting. */
const MAX_BUFFERED_BYTES = 8 << 20
/** A focus or visibility message is far smaller: anything longer is not one and is not parsed. */
const MAX_CLIENT_MSG_BYTES = 1024

export function webGateway(ctx: Ctx) {
  return async (app: FastifyInstance) => {
    app.get('/ws/web', { websocket: true }, async (ws, req) => {
      let detach: (() => void) | undefined
      let closed = false
      /** The group the client shows; undefined until it says, so a client predating focus still gets everything. */
      let focus: string | null | undefined
      let visible = false
      ws.on('close', () => {
        closed = true
        detach?.()
      })
      // Listened before the session lookup: the client sends its focus as soon as the socket opens.
      ws.on('message', (data: Buffer) => {
        if (data.byteLength > MAX_CLIENT_MSG_BYTES) return
        let json: unknown
        try {
          json = JSON.parse(String(data))
        } catch {
          return
        }
        const msg = WebClientMsg.safeParse(json)
        if (!msg.success) return
        if (msg.data.t === 'focus') focus = msg.data.groupId
        else visible = msg.data.visible
      })
      const user = await resolveSession(ctx, req.cookies[SESSION_COOKIE])
      if (closed) return
      if (!user) return ws.close(4401, 'unauthorized')
      detach = ctx.bus.attach(
        user.id,
        (_, json, group) => {
          if (group !== undefined && focus !== undefined && group !== focus) return
          if (ws.bufferedAmount > MAX_BUFFERED_BYTES) ws.terminate()
          else ws.send(json())
        },
        () => ws.close(4401, 'unauthorized'),
        () => (visible ? (focus ?? null) : null),
      )
    })
  }
}
