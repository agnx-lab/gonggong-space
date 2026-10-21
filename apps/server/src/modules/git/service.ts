import { randomUUID } from 'node:crypto'
import type { GitActionReq, GitOperationDto, GitOperationStatus } from '@gonggong/protocol'
import { and, eq, inArray, lte, or } from 'drizzle-orm'
import type { Ctx } from '../../context.js'
import { bots, gitOperations, groupBots, type groups, runs, users } from '../../db/schema.js'
import { translator } from '../../i18n/index.js'
import { audit } from '../../lib/audit.js'
import { fail } from '../../lib/errors.js'
import { idParam } from '../../lib/ids.js'
import { startSweep } from '../../lib/sweep.js'
import { gitIdentity } from '../bots/git.js'
import { activeBots } from '../groups/service.js'
import { memberIds } from '../messages/service.js'
import { resolveNotifications } from '../notifications/notify.js'
import { groupRedactor } from '../secrets/resolve.js'
import { currentRepo, onlineMachine } from '../workspaces/provision.js'

export type GitOperation = typeof gitOperations.$inferSelect
type Group = typeof groups.$inferSelect
export type GitTarget = Awaited<ReturnType<typeof gitTarget>>

export const PENDING_MS = 30 * 60_000
const ACTION_TIMEOUT_MS = 120_000
const SWEEP_MS = 30_000
const LIVE = ['running', 'awaiting_approval', 'awaiting_answer']
/** Stored once for every reader. */
const zh = translator('zh')

/** The bot's workspace in a partition group with a repo: the only place manual git is offered. */
export async function gitTarget(ctx: Ctx, group: Group, rawBotId: string) {
  const botId = idParam(rawBotId, 'Bot 不存在')
  const repo = group.mode === 'partition' ? await currentRepo(ctx, group.id, botId) : null
  if (!repo) return fail('conflict', '仅绑定了仓库的分区模式群可以使用 Git 操作')
  const active = (await activeBots(ctx, group.id)).find((b) => b.id === botId)
  if (!active) return fail('not_found', '该 Bot 不在群内')
  const [row] = await ctx.db
    .select({
      bot: bots,
      cdPath: groupBots.cdPath,
      state: groupBots.workspaceState,
      path: groupBots.workspacePath,
    })
    .from(groupBots)
    .innerJoin(bots, eq(bots.id, groupBots.botId))
    .where(and(eq(groupBots.groupId, group.id), eq(groupBots.botId, active.id)))
  if (!row) return fail('not_found', '该 Bot 不在群内')
  if (row.state === 'unbound' || row.state === 'confirm')
    return fail('conflict', '{bot} 尚未设置工作区', { bot: row.bot.name })
  // A daemon predating manual git ignores its messages: say so now rather than after the request times out.
  const machineId = row.bot.machineId
  if (machineId && ctx.hub.isOnline(machineId) && !ctx.hub.features(machineId).includes('gitOps'))
    return fail('conflict', '{bot} 所在机器的客户端版本过旧，升级后才能使用 Git 操作', { bot: row.bot.name })
  return {
    group,
    bot: row.bot,
    workspacePath: row.path,
    workspace: { repo, cdPath: row.cdPath },
  }
}

/** A live run of the bot here, or of any bot working in the same directory of the same machine (plan W10). */
export async function assertIdle(ctx: Ctx, t: GitTarget) {
  const sameDir =
    t.workspacePath && t.bot.machineId
      ? and(eq(bots.machineId, t.bot.machineId), eq(groupBots.workspacePath, t.workspacePath))
      : undefined
  const [live] = await ctx.db
    .select({ id: runs.id })
    .from(runs)
    .innerJoin(groupBots, and(eq(groupBots.groupId, runs.groupId), eq(groupBots.botId, runs.botId)))
    .innerJoin(bots, eq(bots.id, runs.botId))
    .where(
      and(
        inArray(runs.status, LIVE),
        or(and(eq(runs.groupId, t.group.id), eq(runs.botId, t.bot.id)), sameDir),
      ),
    )
    .limit(1)
  if (live) busy(t.bot.name)
}

const busy = (bot: string) => fail('conflict', '{bot} 正在运行，等运行结束后再操作', { bot })

/** One line naming the action, for the owner's notification (git verbs read the same in both languages). */
export function summary(op: Pick<GitOperation, 'action' | 'branch' | 'remote' | 'message'>) {
  if (op.action === 'checkout') return `checkout ${op.branch}`
  if (op.action === 'push') return `push ${op.branch} → ${op.remote}`
  if (op.action === 'commit') {
    const line = (op.message ?? '').split('\n')[0] ?? ''
    return `commit「${line.length > 60 ? `${line.slice(0, 60)}…` : line}」`
  }
  return op.action
}

export const fields = (req: GitActionReq) => ({
  action: req.action,
  branch: 'branch' in req ? req.branch : null,
  remote: req.action === 'push' ? req.remote : null,
  message: req.action === 'commit' ? req.message : null,
})

export async function operationDtos(ctx: Ctx, rows: GitOperation[]): Promise<GitOperationDto[]> {
  const ids = [
    ...new Set(rows.flatMap((r) => (r.decidedBy ? [r.requestedBy, r.decidedBy] : [r.requestedBy]))),
  ]
  const names = new Map(
    ids.length
      ? (
          await ctx.db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, ids))
        ).map((u) => [u.id, u.name])
      : [],
  )
  const who = (id: string) => ({ id, name: names.get(id) ?? '' })
  return rows.map((r) => ({
    id: r.id,
    groupId: r.groupId,
    botId: r.botId,
    action: r.action as GitOperationDto['action'],
    branch: r.branch,
    remote: r.remote,
    message: r.message,
    pushesBase: r.pushesBase,
    status: r.status as GitOperationStatus,
    requestedBy: who(r.requestedBy),
    decidedBy: r.decidedBy ? who(r.decidedBy) : null,
    output: r.output,
    error: r.error,
    createdAt: r.createdAt.toISOString(),
    expiresAt: r.expiresAt.toISOString(),
    finishedAt: r.finishedAt?.toISOString() ?? null,
  }))
}

export async function publishOperation(ctx: Ctx, row: GitOperation) {
  const [operation] = await operationDtos(ctx, [row])
  if (operation)
    ctx.bus.publish(await memberIds(ctx, row.groupId), {
      t: 'group.gitOperation',
      groupId: row.groupId,
      operation,
    })
  return operation as GitOperationDto
}

/**
 * Sends a `running` operation to the bot's daemon and records git's answer (redacted). `busy` is true when the daemon
 * refused because a turn holds the directory.
 */
export async function execute(ctx: Ctx, op: GitOperation, t: GitTarget) {
  await publishOperation(ctx, op)
  const machineId = onlineMachine(ctx, t.bot.machineId)
  const res = machineId
    ? await ctx.hub.request(
        machineId,
        {
          t: 'git.action',
          requestId: randomUUID(),
          groupId: t.group.id,
          botId: t.bot.id,
          workspace: t.workspace,
          action: op.action as GitOperationDto['action'],
          branch: op.branch,
          remote: op.remote,
          message: op.message,
          identity: op.action === 'commit' ? gitIdentity(t.bot) : null,
        },
        'git.action.result',
        ACTION_TIMEOUT_MS,
      )
    : undefined
  const error = !machineId
    ? zh('{bot} 离线，无法执行 Git 操作', { bot: t.bot.name })
    : !res
      ? zh('{bot} 未响应，Git 操作结果未知', { bot: t.bot.name })
      : res.busy
        ? zh('{bot} 正在运行，等运行结束后再操作', { bot: t.bot.name })
        : res.ok
          ? null
          : (res.error ?? zh('未知错误'))
  const redact = await groupRedactor(ctx, t.group.id)
  const [done] = (await ctx.db
    .update(gitOperations)
    .set({
      status: error ? 'failed' : 'succeeded',
      output: res?.output ? redact(res.output) : null,
      error: error && redact(error),
      finishedAt: ctx.now(),
    })
    .where(eq(gitOperations.id, op.id))
    .returning()) as [GitOperation]
  await audit(ctx, {
    category: 'admin',
    actorUserId: op.decidedBy ?? op.requestedBy,
    groupId: op.groupId,
    action: 'git.run',
    detail: {
      operationId: op.id,
      botId: op.botId,
      action: op.action,
      branch: op.branch,
      remote: op.remote,
      status: done.status,
    },
  })
  return { operation: await publishOperation(ctx, done), busy: !!res?.busy }
}

/** Overdue requests the owner never decided. */
export async function expireGitOperations(ctx: Ctx) {
  const expired = await ctx.db
    .update(gitOperations)
    .set({ status: 'expired', finishedAt: ctx.now() })
    .where(and(eq(gitOperations.status, 'pending_approval'), lte(gitOperations.expiresAt, ctx.now())))
    .returning()
  await resolveNotifications(
    ctx,
    'git_operation_request',
    'operationId',
    expired.map((o) => o.id),
  )
  for (const o of expired) await publishOperation(ctx, o)
}

export function startGitOperationSweep(ctx: Ctx) {
  return startSweep('git operation expiry', () => expireGitOperations(ctx), SWEEP_MS)
}
