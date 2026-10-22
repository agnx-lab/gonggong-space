import { type GroupPinsDto, PinMessageReq } from '@gonggong/protocol'
import type { FastifyInstance } from 'fastify'
import type { Ctx } from '../../context.js'
import { requireUser } from '../auth/session.js'
import { requireMember } from '../groups/service.js'
import { groupPins, pinMessage, unpinMessage } from './service.js'

type Req = { Params: { id: string; messageId?: string } }

/** 消息置顶: any member pins and unpins a message of the group. */
export function pinRoutes(ctx: Ctx) {
  return async (app: FastifyInstance) => {
    app.get<Req>('/api/groups/:id/pins', async (req): Promise<GroupPinsDto> => {
      const me = await requireUser(ctx, req)
      const { group } = await requireMember(ctx, req.params.id, me.id)
      return groupPins(ctx, group.id)
    })

    app.post<Req>('/api/groups/:id/pins', async (req): Promise<GroupPinsDto> => {
      const me = await requireUser(ctx, req)
      const { group } = await requireMember(ctx, req.params.id, me.id)
      await pinMessage(ctx, group.id, PinMessageReq.parse(req.body).messageId, me)
      return groupPins(ctx, group.id)
    })

    app.delete<Req>('/api/groups/:id/pins/:messageId', async (req, reply) => {
      const me = await requireUser(ctx, req)
      const { group } = await requireMember(ctx, req.params.id, me.id)
      await unpinMessage(
        ctx,
        group.id,
        PinMessageReq.parse({ messageId: req.params.messageId }).messageId,
        me,
      )
      return reply.status(204).send()
    })
  }
}
