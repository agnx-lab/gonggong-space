import {
  type ConversationDayDto,
  type ConversationMetricsDto,
  type ConversationOverviewDto,
  ConversationStatsQuery,
  type ConversationStatsRowDto,
  ConversationStatsRowsQuery,
  type RunStatus,
  TERMINAL_RUN_STATUS,
} from '@gonggong/protocol'
import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, lt, type SQL, sql } from 'drizzle-orm'
import type { FastifyInstance, FastifyRequest } from 'fastify'
import type { Ctx } from '../../context.js'
import { bots, groups, messages, runs, teams, users } from '../../db/schema.js'
import { idParam } from '../../lib/ids.js'
import { requireSysadmin, requireUser } from '../auth/session.js'
import { requireTeam } from '../teams/service.js'

const DAY_MS = 86_400_000
const count = sql<number>`count(*)`.mapWith(Number)
const chat = inArray(messages.kind, ['user', 'bot'])
const msg = {
  userMessages: sql<number>`count(*) filter (where ${messages.kind} = 'user')`.mapWith(Number),
  botMessages: sql<number>`count(*) filter (where ${messages.kind} = 'bot')`.mapWith(Number),
  activeUsers: sql<number>`count(distinct ${messages.authorUserId})`.mapWith(Number),
  conversations: sql<number>`count(distinct ${messages.groupId})`.mapWith(Number),
}
const run = {
  runs: count,
  endedRuns: sql<number>`count(*) filter (where ${inArray(runs.status, [...TERMINAL_RUN_STATUS])})`.mapWith(
    Number,
  ),
  completedRuns: sql<number>`count(*) filter (where ${runs.status} = 'completed')`.mapWith(Number),
}
const avgRunMs = sql<number | null>`round(avg(extract(epoch from ${runs.endedAt} - ${runs.startedAt}) * 1000)
  filter (where ${runs.status} = 'completed'))`.mapWith(Number)

/** Where each breakdown finds its key in messages and in runs. */
const DIMENSIONS = {
  conversation: { msg: messages.groupId, run: runs.groupId },
  user: { msg: messages.authorUserId, run: runs.originUserId },
  bot: { msg: messages.authorBotId, run: runs.botId },
  team: { msg: groups.teamId, run: groups.teamId },
} as const

/** 管理后台 · 会话统计: every team, or the one picked. */
async function platformScope(ctx: Ctx, req: FastifyRequest, teamId?: string) {
  await requireSysadmin(ctx, req)
  return teamId ? eq(groups.teamId, idParam(teamId, '团队不存在')) : undefined
}

/** 团队设置 · 会话统计: the team's admins. */
async function teamScope(ctx: Ctx, req: FastifyRequest) {
  const me = await requireUser(ctx, req)
  const { id } = req.params as { id: string }
  return eq(groups.teamId, (await requireTeam(ctx, me.id, id, 'admin')).team.id)
}

const dayIn = (at: Date, timeZone: string) =>
  new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(at)
const minusDays = (day: string, n: number) =>
  new Date(Date.parse(`${day}T00:00:00Z`) - n * DAY_MS).toISOString().slice(0, 10)
const latest = (...xs: (Date | null | undefined)[]) =>
  xs.reduce<Date | null>((a, b) => (b && (!a || b > a) ? b : a), null)?.toISOString() ?? null

/** Message, run and conversation counts per window, day and breakdown; counts only, never content. */
export function conversationStatsRoutes(ctx: Ctx) {
  return async (app: FastifyInstance) => {
    stats(app, '/api/admin/conversation-stats', (req, teamId) => platformScope(ctx, req, teamId))
    stats(app, '/api/teams/:id/conversation-stats', (req) => teamScope(ctx, req))
  }

  function stats(
    app: FastifyInstance,
    base: string,
    scoped: (req: FastifyRequest, teamId?: string) => Promise<SQL | undefined>,
  ) {
    app.get(`${base}/overview`, async (req): Promise<ConversationOverviewDto> => {
      const q = ConversationStatsQuery.parse(req.query)
      const scope = await scoped(req, q.teamId)
      const now = ctx.now().getTime()
      const from = new Date(now - q.days * DAY_MS)
      const [kinds, statuses, current, previous, days] = await Promise.all([
        ctx.db
          .select({ kind: groups.kind, n: count })
          .from(groups)
          .where(and(isNull(groups.archivedAt), scope))
          .groupBy(groups.kind),
        ctx.db
          .select({ status: sql<RunStatus>`${runs.status}`, count })
          .from(runs)
          .innerJoin(groups, eq(groups.id, runs.groupId))
          .where(and(gte(runs.queuedAt, from), scope))
          .groupBy(runs.status)
          .orderBy(desc(count), asc(runs.status)),
        metrics(scope, from, new Date(now)),
        metrics(scope, new Date(now - 2 * q.days * DAY_MS), from),
        daily(scope, q.days, q.tz),
      ])
      return {
        groups: kinds.find((k) => k.kind === 'group')?.n ?? 0,
        dms: kinds.find((k) => k.kind === 'dm')?.n ?? 0,
        current,
        previous,
        daily: days,
        statuses,
      }
    })

    app.get(base, async (req): Promise<ConversationStatsRowDto[]> => {
      const q = ConversationStatsRowsQuery.parse(req.query)
      return rows(await scoped(req, q.teamId), q.by, new Date(ctx.now().getTime() - q.days * DAY_MS))
    })
  }

  async function metrics(scope: SQL | undefined, from: Date, to: Date): Promise<ConversationMetricsDto> {
    const [[m], [r], [c]] = await Promise.all([
      ctx.db
        .select(msg)
        .from(messages)
        .innerJoin(groups, eq(groups.id, messages.groupId))
        .where(and(chat, gte(messages.createdAt, from), lt(messages.createdAt, to), scope)),
      ctx.db
        .select({ ...run, avgRunMs })
        .from(runs)
        .innerJoin(groups, eq(groups.id, runs.groupId))
        .where(and(gte(runs.queuedAt, from), lt(runs.queuedAt, to), scope)),
      ctx.db
        .select({ n: count })
        .from(groups)
        .where(and(gte(groups.createdAt, from), lt(groups.createdAt, to), scope)),
    ])
    const { conversations, ...rest } = m!
    return { activeConversations: conversations, newConversations: c!.n, ...rest, ...r! }
  }

  async function daily(scope: SQL | undefined, n: number, tz: string): Promise<ConversationDayDto[]> {
    const now = ctx.now()
    const days = Array.from({ length: n }, (_, i) => minusDays(dayIn(now, tz), n - 1 - i))
    // A day spans at most 26h across zones/DST; the exact cut happens on `day` below.
    const since = new Date(now.getTime() - (n + 1) * DAY_MS)
    const dayOf = (at: typeof messages.createdAt | typeof runs.queuedAt) =>
      sql<string>`to_char(${at} at time zone ${tz}, 'YYYY-MM-DD')`
    // Positional GROUP BY: the tz parameter makes the expression differ textually between SELECT and GROUP BY.
    const msgRows = await ctx.db
      .select({ day: dayOf(messages.createdAt), ...msg })
      .from(messages)
      .innerJoin(groups, eq(groups.id, messages.groupId))
      .where(and(chat, gte(messages.createdAt, since), scope))
      .groupBy(sql`1`)
    const runRows = await ctx.db
      .select({ day: dayOf(runs.queuedAt), runs: count })
      .from(runs)
      .innerJoin(groups, eq(groups.id, runs.groupId))
      .where(and(gte(runs.queuedAt, since), scope))
      .groupBy(sql`1`)
    const byDay = new Map(msgRows.map((r) => [r.day, r]))
    const runsByDay = new Map(runRows.map((r) => [r.day, r.runs]))
    return days.map((day) => {
      const m = byDay.get(day)
      return {
        day,
        activeConversations: m?.conversations ?? 0,
        userMessages: m?.userMessages ?? 0,
        botMessages: m?.botMessages ?? 0,
        activeUsers: m?.activeUsers ?? 0,
        runs: runsByDay.get(day) ?? 0,
      }
    })
  }

  async function rows(
    scope: SQL | undefined,
    by: keyof typeof DIMENSIONS,
    from: Date,
  ): Promise<ConversationStatsRowDto[]> {
    const dim = DIMENSIONS[by]
    const msgRows = await ctx.db
      .select({
        key: dim.msg,
        ...msg,
        last: sql<Date>`max(${messages.createdAt})`.mapWith(messages.createdAt),
      })
      .from(messages)
      .innerJoin(groups, eq(groups.id, messages.groupId))
      .where(and(chat, gte(messages.createdAt, from), isNotNull(dim.msg), scope))
      .groupBy(dim.msg)
    const runRows = await ctx.db
      .select({
        key: dim.run,
        ...run,
        users: sql<number>`count(distinct ${runs.originUserId})`.mapWith(Number),
        last: sql<Date>`max(${runs.queuedAt})`.mapWith(runs.queuedAt),
      })
      .from(runs)
      .innerJoin(groups, eq(groups.id, runs.groupId))
      .where(and(gte(runs.queuedAt, from), scope))
      .groupBy(dim.run)
    const keys = [...new Set([...msgRows, ...runRows].map((r) => r.key as string))]
    if (!keys.length) return []
    const names = new Map((await entities(by, keys)).map((e) => [e.key, e]))
    const msgBy = new Map(msgRows.map((r) => [r.key, r]))
    const runBy = new Map(runRows.map((r) => [r.key, r]))
    return keys
      .flatMap((key) => {
        const e = names.get(key)
        if (!e) return []
        const m = msgBy.get(key)
        const r = runBy.get(key)
        return [
          {
            ...e,
            conversations: m?.conversations ?? 0,
            userMessages: m?.userMessages ?? 0,
            botMessages: m?.botMessages ?? 0,
            activeUsers: (by === 'bot' ? r?.users : m?.activeUsers) ?? 0,
            runs: r?.runs ?? 0,
            endedRuns: r?.endedRuns ?? 0,
            completedRuns: r?.completedRuns ?? 0,
            lastActiveAt: latest(m?.last, r?.last),
          },
        ]
      })
      .sort(
        (a, b) =>
          b.userMessages + b.botMessages - (a.userMessages + a.botMessages) ||
          b.runs - a.runs ||
          a.name.localeCompare(b.name),
      )
  }

  /** Display fields of the rows' subjects. */
  function entities(by: keyof typeof DIMENSIONS, keys: string[]) {
    const none = { kind: sql<null>`null`, teamName: sql<null>`null`, ownerName: sql<null>`null` }
    switch (by) {
      case 'conversation':
        return ctx.db
          .select({
            key: groups.id,
            name: groups.name,
            kind: sql<'group' | 'dm'>`${groups.kind}`,
            teamName: teams.name,
            ownerName: users.name,
          })
          .from(groups)
          .innerJoin(teams, eq(teams.id, groups.teamId))
          .innerJoin(users, eq(users.id, groups.createdBy))
          .where(inArray(groups.id, keys))
      case 'user':
        return ctx.db
          .select({ key: users.id, name: users.name, ...none })
          .from(users)
          .where(inArray(users.id, keys))
      case 'bot':
        return ctx.db
          .select({
            key: bots.id,
            name: bots.name,
            kind: none.kind,
            teamName: teams.name,
            ownerName: users.name,
          })
          .from(bots)
          .innerJoin(teams, eq(teams.id, bots.teamId))
          .innerJoin(users, eq(users.id, bots.ownerId))
          .where(inArray(bots.id, keys))
      case 'team':
        return ctx.db
          .select({ key: teams.id, name: teams.name, ...none })
          .from(teams)
          .where(inArray(teams.id, keys))
    }
  }
}
