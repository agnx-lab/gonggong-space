import {
  CreateGroupTabReq,
  type GroupTabsDto,
  type LinkMetaDto,
  LinkMetaReq,
  ReorderGroupTabsReq,
  UpdateGroupTabReq,
} from '@gonggong/protocol'
import type { FastifyInstance } from 'fastify'
import type { Ctx } from '../../context.js'
import { idParam } from '../../lib/ids.js'
import { requireUser } from '../auth/session.js'
import { requireMember, requireReader } from '../groups/service.js'
import { linkMeta } from './link-meta.js'
import { createTab, deleteTab, groupTabList, renameTab, reorderTabs } from './service.js'

type Req = { Params: { id: string; tabId: string } }

/** 群标签栏: every member adds, renames, reorders and deletes the group's shared tabs. */
export function groupTabRoutes(ctx: Ctx) {
  return async (app: FastifyInstance) => {
    app.get<Req>('/api/groups/:id/tabs', async (req): Promise<GroupTabsDto> => {
      const me = await requireUser(ctx, req)
      const { group } = await requireReader(ctx, req.params.id, me.id)
      return groupTabList(ctx, group.id)
    })

    app.post<Req>('/api/groups/:id/tabs', async (req): Promise<GroupTabsDto> => {
      const me = await requireUser(ctx, req)
      const { group } = await requireMember(ctx, req.params.id, me.id)
      await createTab(ctx, group.id, CreateGroupTabReq.parse(req.body), { userId: me.id, name: me.name })
      return groupTabList(ctx, group.id)
    })

    app.patch<Req>('/api/groups/:id/tabs/:tabId', async (req): Promise<GroupTabsDto> => {
      const me = await requireUser(ctx, req)
      const { group } = await requireMember(ctx, req.params.id, me.id)
      const tabId = idParam(req.params.tabId, '标签不存在')
      return renameTab(ctx, group.id, tabId, UpdateGroupTabReq.parse(req.body).title)
    })

    app.delete<Req>('/api/groups/:id/tabs/:tabId', async (req): Promise<GroupTabsDto> => {
      const me = await requireUser(ctx, req)
      const { group } = await requireMember(ctx, req.params.id, me.id)
      return deleteTab(ctx, group.id, idParam(req.params.tabId, '标签不存在'), me)
    })

    app.put<Req>('/api/groups/:id/tabs/order', async (req): Promise<GroupTabsDto> => {
      const me = await requireUser(ctx, req)
      const { group } = await requireMember(ctx, req.params.id, me.id)
      return reorderTabs(ctx, group.id, ReorderGroupTabsReq.parse(req.body).ids)
    })

    app.post('/api/link-meta', async (req): Promise<LinkMetaDto> => {
      await requireUser(ctx, req)
      return linkMeta(LinkMetaReq.parse(req.body).url)
    })
  }
}
