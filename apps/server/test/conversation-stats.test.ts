import type { ConversationOverviewDto, ConversationStatsRowDto } from '@gonggong/protocol'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { groups, messages, runs } from '../src/db/schema.js'
import { createTestApp, type TestApp } from './support/app.js'
import { client } from './support/http.js'

let t: TestApp
beforeEach(async () => {
  t = await createTestApp()
})
afterEach(() => t.close())

const DAY = 86_400_000

async function world() {
  const alice = await t.seed.user({ name: '王磊' })
  const bob = await t.seed.user({ name: '陈晨' })
  const admin = await t.seed.user({ name: '管理员', role: 'sysadmin', teamId: null })
  const carol = await t.seed.user({ name: '卡罗', teamId: null })
  const teamB = await t.seed.team({ ownerId: carol.id, name: 'B 团队' })
  const claude = await t.seed.bot({ ownerId: alice.id, name: '小王的 Claude' })
  const carolBot = await t.seed.bot({ ownerId: carol.id, name: '卡罗的 Bot', teamId: teamB.id })
  const g1 = await t.seed.group({ createdBy: alice.id, name: '支付服务重构', memberIds: [bob.id] })
  const dm = await t.seed.group({ createdBy: alice.id, name: '小王的 Claude', kind: 'dm' })
  const g3 = await t.seed.group({ createdBy: carol.id, name: 'B 群', teamId: teamB.id })
  const old = await t.seed.group({ createdBy: alice.id, name: '旧群' })
  const now = Date.now()
  const ago = (days: number, ms = 0) => new Date(now - days * DAY + ms)
  await t.db
    .update(groups)
    .set({ createdAt: ago(40), archivedAt: ago(1) })
    .where(eq(groups.id, old.id))

  const say = async (
    groupId: string,
    kind: 'user' | 'bot' | 'event',
    author: string | null,
    daysAgo: number,
  ) => {
    const [m] = await t.db
      .insert(messages)
      .values({
        groupId,
        kind,
        authorUserId: kind === 'user' ? author : null,
        authorBotId: kind === 'bot' ? author : null,
        body: 'x',
        createdAt: ago(daysAgo),
      })
      .returning()
    return m!
  }
  const m1 = await say(g1.id, 'user', alice.id, 0)
  await say(g1.id, 'user', bob.id, 1)
  await say(g1.id, 'bot', claude.id, 0)
  await say(g1.id, 'event', null, 0)
  await say(g1.id, 'user', alice.id, 40)
  const m2 = await say(dm.id, 'user', alice.id, 2)
  await say(dm.id, 'bot', claude.id, 2)
  const m3 = await say(g3.id, 'user', carol.id, 0)
  await say(g3.id, 'bot', carolBot.id, 0)
  const m4 = await say(old.id, 'user', alice.id, 45)

  const run = (o: {
    msg: typeof m1
    bot: string
    origin: string
    status: string
    daysAgo: number
    secs?: number
  }) => ({
    groupId: o.msg.groupId,
    botId: o.bot,
    triggerMessageId: o.msg.id,
    originUserId: o.origin,
    status: o.status,
    queuedAt: ago(o.daysAgo),
    startedAt: o.status === 'forbidden' ? null : ago(o.daysAgo),
    endedAt: o.secs ? ago(o.daysAgo, o.secs * 1000) : null,
  })
  await t.db
    .insert(runs)
    .values([
      run({ msg: m1, bot: claude.id, origin: alice.id, status: 'completed', daysAgo: 0, secs: 60 }),
      run({ msg: m1, bot: claude.id, origin: bob.id, status: 'interrupted', daysAgo: 1, secs: 5 }),
      run({ msg: m1, bot: claude.id, origin: bob.id, status: 'forbidden', daysAgo: 0 }),
      run({ msg: m2, bot: claude.id, origin: alice.id, status: 'completed', daysAgo: 2, secs: 120 }),
      run({ msg: m3, bot: carolBot.id, origin: carol.id, status: 'running', daysAgo: 0 }),
      run({ msg: m4, bot: claude.id, origin: alice.id, status: 'completed', daysAgo: 45, secs: 30 }),
    ])
  return { alice, bob, admin, carol, teamA: g1.teamId, teamB, claude, carolBot, g1, dm, g3 }
}

const as = async (userId: string) => client(t, await t.seed.cookie(userId))
const byName = (rows: ConversationStatsRowDto[]) => Object.fromEntries(rows.map((r) => [r.name, r]))

describe('conversation stats', () => {
  it('summarises every team for sysadmins, against the previous period', async () => {
    const w = await world()
    const res = await (await as(w.admin.id)).get<ConversationOverviewDto>(
      '/api/admin/conversation-stats/overview?days=30&tz=UTC',
    )
    expect(res.status).toBe(200)
    const o = res.body
    expect([o.groups, o.dms]).toEqual([2, 1])
    expect(o.current).toEqual({
      activeConversations: 3,
      newConversations: 3,
      userMessages: 4,
      botMessages: 3,
      activeUsers: 3,
      runs: 5,
      endedRuns: 4,
      completedRuns: 2,
      avgRunMs: 90_000,
    })
    expect(o.previous).toEqual({
      activeConversations: 2,
      newConversations: 1,
      userMessages: 2,
      botMessages: 0,
      activeUsers: 1,
      runs: 1,
      endedRuns: 1,
      completedRuns: 1,
      avgRunMs: 30_000,
    })
    expect(o.statuses).toEqual([
      { status: 'completed', count: 2 },
      { status: 'forbidden', count: 1 },
      { status: 'interrupted', count: 1 },
      { status: 'running', count: 1 },
    ])
    expect(o.daily).toHaveLength(30)
    expect(o.daily.at(-1)).toMatchObject({
      day: new Date().toISOString().slice(0, 10),
      activeConversations: 2,
      userMessages: 2,
      botMessages: 2,
      activeUsers: 2,
      runs: 3,
    })
    expect(o.daily.at(-2)).toMatchObject({ activeConversations: 1, userMessages: 1, botMessages: 0, runs: 1 })

    const b = (
      await (
        await as(w.admin.id)
      ).get<ConversationOverviewDto>(`/api/admin/conversation-stats/overview?teamId=${w.teamB.id}`)
    ).body
    expect([b.groups, b.dms, b.current.userMessages, b.current.runs, b.current.avgRunMs]).toEqual([
      1,
      0,
      1,
      1,
      null,
    ])
  })

  it('breaks activity down by conversation, member, bot and team', async () => {
    const w = await world()
    const admin = await as(w.admin.id)
    const rows = async (q: string) =>
      byName((await admin.get<ConversationStatsRowDto[]>(`/api/admin/conversation-stats?${q}`)).body)

    const conv = await rows('by=conversation')
    expect(Object.keys(conv).sort()).toEqual(['B 群', '小王的 Claude', '支付服务重构'].sort())
    expect(conv['支付服务重构']).toMatchObject({
      key: w.g1.id,
      kind: 'group',
      teamName: '默认团队',
      ownerName: '王磊',
      userMessages: 2,
      botMessages: 1,
      activeUsers: 2,
      runs: 3,
      endedRuns: 3,
      completedRuns: 1,
    })
    expect(conv['支付服务重构']?.lastActiveAt).toEqual(expect.any(String))
    expect(conv['小王的 Claude']).toMatchObject({ kind: 'dm', userMessages: 1, botMessages: 1, runs: 1 })
    expect(conv['B 群']).toMatchObject({ teamName: 'B 团队', runs: 1, endedRuns: 0 })

    const people = await rows('by=user')
    expect(people['王磊']).toMatchObject({ userMessages: 2, conversations: 2, runs: 2, completedRuns: 2 })
    expect(people['陈晨']).toMatchObject({
      userMessages: 1,
      conversations: 1,
      runs: 2,
      endedRuns: 2,
      completedRuns: 0,
    })
    expect(people['卡罗']).toMatchObject({ userMessages: 1, runs: 1 })

    const bots = await rows('by=bot')
    expect(bots['小王的 Claude']).toMatchObject({
      ownerName: '王磊',
      teamName: '默认团队',
      botMessages: 2,
      conversations: 2,
      activeUsers: 2,
      runs: 4,
      completedRuns: 2,
    })

    const teams = await rows('by=team')
    expect(teams['默认团队']).toMatchObject({
      conversations: 2,
      userMessages: 3,
      botMessages: 2,
      activeUsers: 2,
      runs: 4,
    })
    expect(teams['B 团队']).toMatchObject({ conversations: 1, userMessages: 1, runs: 1 })

    expect(Object.keys(await rows(`by=team&teamId=${w.teamB.id}`))).toEqual(['B 团队'])
  })

  it('shows a team its own numbers, to its admins only', async () => {
    const w = await world()
    const alice = await as(w.alice.id)
    const o = (await alice.get<ConversationOverviewDto>(`/api/teams/${w.teamA}/conversation-stats/overview`))
      .body
    expect([o.groups, o.dms, o.current.userMessages, o.current.runs]).toEqual([1, 1, 3, 4])
    const conv = (
      await alice.get<ConversationStatsRowDto[]>(`/api/teams/${w.teamA}/conversation-stats?by=conversation`)
    ).body
    expect(conv.map((r) => r.name).sort()).toEqual(['小王的 Claude', '支付服务重构'].sort())

    expect((await (await as(w.bob.id)).get(`/api/teams/${w.teamA}/conversation-stats/overview`)).status).toBe(
      403,
    )
    expect((await alice.get(`/api/teams/${w.teamB.id}/conversation-stats?by=user`)).status).toBe(404)
    expect((await alice.get('/api/admin/conversation-stats/overview')).status).toBe(403)
  })
})
