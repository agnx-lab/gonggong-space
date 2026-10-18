import { asc, eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { groupBots, messages, runs } from '../src/db/schema.js'
import { createTestApp, type TestApp } from './support/app.js'
import { client } from './support/http.js'

let t: TestApp
beforeEach(async () => {
  t = await createTestApp()
})
afterEach(() => t.close())

async function world() {
  const wang = await t.seed.user({ name: '王磊' })
  const li = await t.seed.user({ name: '李建国' })
  const zhao = await t.seed.user({ name: '赵六' })
  const { machine } = await t.seed.machine(li.id)
  const bot = await t.seed.bot({ ownerId: li.id, name: '老李的 Codex', machineId: machine.id })
  const g = await t.seed.group({ createdBy: wang.id, memberIds: [li.id, zhao.id], botIds: [bot.id] })
  await t.db.update(groupBots).set({ workspaceState: 'ready' }).where(eq(groupBots.groupId, g.id))
  const [msg] = await t.db
    .insert(messages)
    .values({
      groupId: g.id,
      kind: 'user',
      authorUserId: wang.id,
      body: '@老李的 Codex 修一下',
      meta: { mentions: [bot.id] },
    })
    .returning()
  const run = async (o: Partial<typeof runs.$inferInsert> = {}) => {
    const [r] = await t.db
      .insert(runs)
      .values({
        groupId: g.id,
        botId: bot.id,
        triggerMessageId: msg!.id,
        triggerUserId: wang.id,
        originUserId: wang.id,
        status: 'interrupted',
        endedAt: new Date(),
        ...o,
      })
      .returning()
    return r!
  }
  const as = {
    wang: client(t, await t.seed.cookie(wang.id)),
    li: client(t, await t.seed.cookie(li.id)),
    zhao: client(t, await t.seed.cookie(zhao.id)),
  }
  const retry = (id: string, c = as.wang) => c.post(`/api/runs/${id}/retry`)
  const runsOf = () => t.db.select().from(runs).orderBy(asc(runs.queuedAt))
  return { msg: msg!, run, as, retry, runsOf }
}

describe('POST /api/runs/:id/retry', () => {
  it('starts a fresh hop-1 run of the same bot for the original message', async () => {
    const w = await world()
    const failed = await w.run()
    const res = await w.retry(failed.id)
    expect(res.status).toBe(204)
    const all = await w.runsOf()
    expect(all).toHaveLength(2)
    const fresh = all.find((r) => r.id !== failed.id)!
    expect(fresh).toMatchObject({
      botId: failed.botId,
      triggerMessageId: w.msg.id,
      originUserId: failed.originUserId,
      hop: 1,
    })
    expect(['queued', 'offline_wait', 'running']).toContain(fresh.status)
  })

  it('retries a run stopped by hand', async () => {
    const w = await world()
    const stopped = await w.run({ stoppedBy: w.msg.authorUserId })
    expect((await w.retry(stopped.id)).status).toBe(204)
    expect(await w.runsOf()).toHaveLength(2)
  })

  it('lets the bot owner retry an expired run; anyone else gets 403', async () => {
    const w = await world()
    const expired = await w.run({ status: 'expired' })
    expect((await w.retry(expired.id, w.as.zhao)).status).toBe(403)
    expect((await w.retry(expired.id, w.as.li)).status).toBe(204)
    expect(await w.runsOf()).toHaveLength(2)
  })

  it('refuses runs that are still going, completed or forbidden', async () => {
    const w = await world()
    for (const status of ['running', 'queued', 'completed', 'forbidden']) {
      const r = await w.run({ status })
      expect((await w.retry(r.id)).status).toBe(409)
    }
    expect(await w.runsOf()).toHaveLength(4)
  })

  it('refuses relayed runs and runs whose message was recalled', async () => {
    const w = await world()
    const relay = await w.run({ hop: 2, triggerUserId: null })
    const res = await w.retry(relay.id)
    expect(res.status).toBe(409)
    expect((res.body as { message?: string }).message).toContain('原群消息')
    const failed = await w.run()
    await t.db.update(messages).set({ recalledAt: new Date() }).where(eq(messages.id, w.msg.id))
    expect((await w.retry(failed.id)).status).toBe(409)
    expect(await w.runsOf()).toHaveLength(2)
  })

  it('hides runs of groups the user is not in', async () => {
    const w = await world()
    const outsider = await t.seed.user({ name: '路人' })
    const failed = await w.run()
    expect((await w.retry(failed.id, client(t, await t.seed.cookie(outsider.id)))).status).toBe(404)
  })
})
