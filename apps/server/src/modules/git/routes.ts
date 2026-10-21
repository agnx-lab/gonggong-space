import { randomUUID } from 'node:crypto'
import {
  type DaemonFeature,
  type DaemonToServer,
  DecideGitOperationReq,
  FILE_TEXT_MAX_BYTES,
  type FilesTreeDto,
  type FileTextDto,
  GitActionReq,
  type GitCompareDto,
  GitCompareQuery,
  type GitDiffDto,
  GitDiffQuery,
  type GitLogDto,
  GitLogQuery,
  type GitOperationDto,
  type GitOperationsDto,
  GitRefPathQuery,
  GitRefreshReq,
  type GitRefsDto,
  type ServerToDaemon,
} from '@gonggong/protocol'
import { and, desc, eq, ne } from 'drizzle-orm'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import type { Ctx } from '../../context.js'
import { gitOperations, groups } from '../../db/schema.js'
import { audit } from '../../lib/audit.js'
import { fail, HttpError } from '../../lib/errors.js'
import { idParam } from '../../lib/ids.js'
import { requireUser } from '../auth/session.js'
import { requireMember } from '../groups/service.js'
import { notify, resolveNotifications } from '../notifications/notify.js'
import { groupRedactor } from '../secrets/resolve.js'
import { onlineMachine } from '../workspaces/provision.js'
import {
  assertIdle,
  auditDetail,
  execute,
  featureFor,
  fields,
  type GitOperation,
  type GitTarget,
  gitTarget,
  operationDtos,
  PENDING_MS,
  publishOperation,
  summary,
} from './service.js'

type Read = Extract<
  ServerToDaemon,
  { t: 'git.refs' | 'git.log' | 'git.tree' | 'git.read' | 'git.compare' | 'git.diff' | 'git.refresh' }
>
type Answer = Extract<DaemonToServer, { t: `${Read['t']}.result` }>
type ReadBody = {
  [K in Read['t']]: Omit<Extract<Read, { t: K }>, 'requestId' | 'groupId' | 'botId' | 'workspace'>
}[Read['t']]
type Req = FastifyRequest<{ Params: { id: string; botId: string }; Querystring: unknown }>

const READ_TIMEOUT_MS = 15_000
/** The daemon gives `git fetch` 120 s. */
const FETCH_TIMEOUT_MS = 130_000
const DIFF_MAX_BYTES = 1024 * 1024
const LOG_PAGE = 50
const SETTLED_SHOWN = 20
const strip = (p: string) => p.replace(/^\/+|\/+$/g, '')

/**
 * 群内手动 Git: reads for members; writes run at once for the bot owner and wait for the owner's approval otherwise
 * (see GitActionReq in the protocol).
 */
export function gitRoutes(ctx: Ctx) {
  async function member(req: Req, feature?: DaemonFeature) {
    const me = await requireUser(ctx, req)
    const { group } = await requireMember(ctx, req.params.id, me.id)
    return { me, target: await gitTarget(ctx, group, req.params.botId, feature) }
  }

  async function ask<T extends Answer['t']>(
    t: GitTarget,
    msg: ReadBody,
    reply: T,
    timeoutMs = READ_TIMEOUT_MS,
  ) {
    const offline = () => fail('conflict', '{bot} 离线，无法读取 Git 信息', { bot: t.bot.name })
    const machineId = onlineMachine(ctx, t.bot.machineId) ?? offline()
    const full = {
      ...msg,
      requestId: randomUUID(),
      groupId: t.group.id,
      botId: t.bot.id,
      workspace: t.workspace,
    }
    const res =
      ((await ctx.hub.request(machineId, full as Read, reply, timeoutMs)) as
        | Extract<Answer, { t: T }>
        | undefined) ?? offline()
    if (res.error) throw new HttpError('conflict', res.error)
    return res
  }

  /** Runs a `running` operation; a daemon refusing because a turn holds the directory is a 409 for the caller. */
  async function run(op: GitOperation, t: GitTarget, refuseBusy: boolean) {
    const { operation, busy } = await execute(ctx, op, t)
    if (busy && refuseBusy) fail('conflict', '{bot} 正在运行，等运行结束后再操作', { bot: t.bot.name })
    return operation
  }

  return async (app: FastifyInstance) => {
    app.get('/api/groups/:id/bots/:botId/git/refs', async (req: Req): Promise<GitRefsDto> => {
      const { target } = await member(req)
      const res = await ask(target, { t: 'git.refs' }, 'git.refs.result')
      return { branches: res.branches, remotes: res.remotes }
    })

    app.get('/api/groups/:id/bots/:botId/git/log', async (req: Req): Promise<GitLogDto> => {
      const { target } = await member(req)
      const { ref, skip } = GitLogQuery.parse(req.query)
      const res = await ask(
        target,
        { t: 'git.log', ref: ref ?? null, skip, limit: LOG_PAGE },
        'git.log.result',
      )
      return { commits: res.commits, hasMore: res.hasMore }
    })

    app.get('/api/groups/:id/bots/:botId/git/tree', async (req: Req): Promise<FilesTreeDto> => {
      const { target } = await member(req)
      const q = GitRefPathQuery.parse(req.query)
      const path = strip(q.path)
      const res = await ask(target, { t: 'git.tree', ref: q.ref, path }, 'git.tree.result')
      return { path, entries: res.entries, truncated: res.truncated }
    })

    app.get('/api/groups/:id/bots/:botId/git/text', async (req: Req): Promise<FileTextDto> => {
      const { target } = await member(req)
      const q = GitRefPathQuery.parse(req.query)
      const path = strip(q.path)
      if (!path) return fail('invalid', '缺少文件路径')
      const msg = { t: 'git.read', ref: q.ref, path, maxBytes: FILE_TEXT_MAX_BYTES } as const
      const res = await ask(target, msg, 'git.read.result')
      return { path, size: res.size, binary: res.binary, mime: res.mime, text: res.text }
    })

    app.get('/api/groups/:id/bots/:botId/git/compare', async (req: Req): Promise<GitCompareDto> => {
      const { target } = await member(req)
      const { from, to } = GitCompareQuery.parse(req.query)
      const res = await ask(target, { t: 'git.compare', from, to: to ?? null }, 'git.compare.result')
      return { changes: res.changes }
    })

    app.get('/api/groups/:id/bots/:botId/git/diff', async (req: Req): Promise<GitDiffDto> => {
      const { target } = await member(req, 'gitOps2')
      const q = GitDiffQuery.parse(req.query)
      const msg = {
        t: 'git.diff',
        from: q.from,
        to: q.to ?? null,
        path: (q.path && strip(q.path)) || null,
        maxBytes: DIFF_MAX_BYTES,
      } as const
      const res = await ask(target, msg, 'git.diff.result')
      const redact = await groupRedactor(ctx, target.group.id)
      return { patch: res.patch && redact(res.patch), truncated: res.truncated }
    })

    app.post('/api/groups/:id/bots/:botId/git/refresh', async (req: Req, reply: FastifyReply) => {
      const { target } = await member(req, 'gitOps2')
      const { fetch } = GitRefreshReq.parse(req.body ?? {})
      await ask(
        target,
        { t: 'git.refresh', fetch },
        'git.refresh.result',
        fetch ? FETCH_TIMEOUT_MS : READ_TIMEOUT_MS,
      )
      return reply.code(204).send()
    })

    app.post('/api/groups/:id/bots/:botId/git/actions', async (req: Req): Promise<GitOperationDto> => {
      const me = await requireUser(ctx, req)
      const { group } = await requireMember(ctx, req.params.id, me.id)
      const body = GitActionReq.parse(req.body)
      const target = await gitTarget(ctx, group, req.params.botId, featureFor(fields(body)))
      const base = target.workspace.repo.branch
      const pushesBase = body.action === 'push' && target.group.protectBase && body.branch === base
      const owner = target.bot.ownerId === me.id
      if (owner) {
        if (pushesBase && !body.confirmBase) fail('conflict', '推送基准分支需要再次确认')
        await assertIdle(ctx, target)
      }
      const [op] = (await ctx.db
        .insert(gitOperations)
        .values({
          groupId: target.group.id,
          botId: target.bot.id,
          ...fields(body),
          pushesBase,
          status: owner ? 'running' : 'pending_approval',
          requestedBy: me.id,
          createdAt: ctx.now(),
          expiresAt: new Date(ctx.now().getTime() + PENDING_MS),
        })
        .returning()) as [GitOperation]
      if (owner) return run(op, target, true)
      await notify(ctx, target.bot.ownerId, 'git_operation_request', {
        groupId: target.group.id,
        botId: target.bot.id,
        botName: target.bot.name,
        byName: me.name,
        summary: summary(op),
        operationId: op.id,
      })
      await audit(ctx, {
        category: 'admin',
        actorUserId: me.id,
        groupId: target.group.id,
        action: 'git.request',
        detail: auditDetail(op),
      })
      return publishOperation(ctx, op)
    })

    app.post<{ Params: { id: string } }>(
      '/api/git-operations/:id/decide',
      async (req): Promise<GitOperationDto> => {
        const me = await requireUser(ctx, req)
        const { approve } = DecideGitOperationReq.parse(req.body)
        const [row] = await ctx.db
          .select({ op: gitOperations, group: groups })
          .from(gitOperations)
          .innerJoin(groups, eq(groups.id, gitOperations.groupId))
          .where(eq(gitOperations.id, idParam(req.params.id, '操作不存在')))
        if (!row) return fail('not_found', '操作不存在')
        await requireMember(ctx, row.group.id, me.id)
        const target = await gitTarget(ctx, row.group, row.op.botId, approve ? featureFor(row.op) : 'gitOps')
        if (target.bot.ownerId !== me.id) return fail('forbidden', '只有 Bot 主人可以处理 Git 操作申请')
        if (row.op.status !== 'pending_approval') return fail('conflict', '该操作已处理')
        if (row.op.expiresAt <= ctx.now()) return fail('conflict', '该操作已过期')
        if (approve) await assertIdle(ctx, target)
        const [op] = await ctx.db
          .update(gitOperations)
          .set({
            status: approve ? 'running' : 'rejected',
            decidedBy: me.id,
            ...(!approve && { finishedAt: ctx.now() }),
          })
          .where(and(eq(gitOperations.id, row.op.id), eq(gitOperations.status, 'pending_approval')))
          .returning()
        if (!op) return fail('conflict', '该操作已处理')
        await resolveNotifications(ctx, 'git_operation_request', 'operationId', [op.id])
        await audit(ctx, {
          category: 'admin',
          actorUserId: me.id,
          groupId: op.groupId,
          action: 'git.decide',
          detail: { operationId: op.id, botId: op.botId, action: op.action, approve },
        })
        return approve ? run(op, target, false) : publishOperation(ctx, op)
      },
    )

    app.get<{ Params: { id: string } }>(
      '/api/groups/:id/git/operations',
      async (req): Promise<GitOperationsDto> => {
        const me = await requireUser(ctx, req)
        const { group } = await requireMember(ctx, req.params.id, me.id)
        const [pending, done] = await Promise.all([
          ctx.db
            .select()
            .from(gitOperations)
            .where(and(eq(gitOperations.groupId, group.id), eq(gitOperations.status, 'pending_approval'))),
          ctx.db
            .select()
            .from(gitOperations)
            .where(and(eq(gitOperations.groupId, group.id), ne(gitOperations.status, 'pending_approval')))
            .orderBy(desc(gitOperations.createdAt))
            .limit(SETTLED_SHOWN),
        ])
        const rows = [...pending, ...done].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        return { operations: await operationDtos(ctx, rows) }
      },
    )
  }
}
