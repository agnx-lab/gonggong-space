import {
  CreateKnowledgeReq,
  type GroupKnowledgeDto,
  type KnowledgeDetailDto,
  type KnowledgeVersionDto,
  RollbackKnowledgeReq,
  UpdateKnowledgeReq,
} from '@gonggong/protocol'
import { and, eq } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import type { Ctx } from '../../context.js'
import { groupKnowledge } from '../../db/schema.js'
import { fail } from '../../lib/errors.js'
import { requireUser } from '../auth/session.js'
import { requireAdmin, requireMember, requireReader } from '../groups/service.js'
import {
  createKnowledge,
  deleteKnowledge,
  detailDto,
  entryDto,
  knowledgeVersions,
  loadEntries,
  matching,
  requireEntry,
  rollbackKnowledge,
  updateKnowledge,
} from './service.js'

const adminOnly = (isAdmin: boolean) => isAdmin || fail('forbidden', '仅群管理员可操作')

/** 群知识库: members read and edit entries; group admins also pin and delete them. */
export function knowledgeRoutes(ctx: Ctx) {
  return async (app: FastifyInstance) => {
    app.get<{ Params: { id: string }; Querystring: { q?: string } }>(
      '/api/groups/:id/knowledge',
      async (req): Promise<GroupKnowledgeDto> => {
        const me = await requireUser(ctx, req)
        const { group, member } = await requireReader(ctx, req.params.id, me.id)
        const q = req.query.q?.trim()
        const rows = await loadEntries(
          ctx,
          and(eq(groupKnowledge.groupId, group.id), q ? matching(q) : undefined),
        )
        return { entries: rows.map(entryDto), canManage: !!member?.isAdmin }
      },
    )

    app.post<{ Params: { id: string } }>(
      '/api/groups/:id/knowledge',
      async (req): Promise<KnowledgeDetailDto> => {
        const me = await requireUser(ctx, req)
        const { group, member } = await requireMember(ctx, req.params.id, me.id)
        const body = CreateKnowledgeReq.parse(req.body)
        if (body.pinned) adminOnly(member.isAdmin)
        const e = await createKnowledge(ctx, group.id, body, { userId: me.id, name: me.name })
        return detailDto(await requireEntry(ctx, e.id))
      },
    )

    app.get<{ Params: { id: string } }>('/api/knowledge/:id', async (req): Promise<KnowledgeDetailDto> => {
      const me = await requireUser(ctx, req)
      const l = await requireEntry(ctx, req.params.id)
      await requireReader(ctx, l.e.groupId, me.id)
      return detailDto(l)
    })

    app.patch<{ Params: { id: string } }>('/api/knowledge/:id', async (req): Promise<KnowledgeDetailDto> => {
      const me = await requireUser(ctx, req)
      const { e } = await requireEntry(ctx, req.params.id)
      const { member } = await requireMember(ctx, e.groupId, me.id)
      const body = UpdateKnowledgeReq.parse(req.body)
      if (body.pinned !== undefined && body.pinned !== e.pinned) adminOnly(member.isAdmin)
      await updateKnowledge(ctx, e, body, { userId: me.id, name: me.name })
      return detailDto(await requireEntry(ctx, e.id))
    })

    app.delete<{ Params: { id: string } }>('/api/knowledge/:id', async (req, reply) => {
      const me = await requireUser(ctx, req)
      const { e } = await requireEntry(ctx, req.params.id)
      await requireAdmin(ctx, e.groupId, me.id)
      await deleteKnowledge(ctx, e, { userId: me.id, name: me.name })
      return reply.status(204).send()
    })

    app.get<{ Params: { id: string } }>(
      '/api/knowledge/:id/versions',
      async (req): Promise<KnowledgeVersionDto[]> => {
        const me = await requireUser(ctx, req)
        const { e } = await requireEntry(ctx, req.params.id)
        await requireReader(ctx, e.groupId, me.id)
        return knowledgeVersions(ctx, e)
      },
    )

    app.post<{ Params: { id: string } }>(
      '/api/knowledge/:id/rollback',
      async (req): Promise<KnowledgeDetailDto> => {
        const me = await requireUser(ctx, req)
        const { e } = await requireEntry(ctx, req.params.id)
        await requireMember(ctx, e.groupId, me.id)
        const { version } = RollbackKnowledgeReq.parse(req.body)
        await rollbackKnowledge(ctx, e, version, { userId: me.id, name: me.name })
        return detailDto(await requireEntry(ctx, e.id))
      },
    )
  }
}
