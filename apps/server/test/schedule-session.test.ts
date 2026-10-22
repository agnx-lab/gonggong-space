import { PROTOCOL_VERSION, type RunStart } from '@gonggong/protocol'
import { and, eq } from 'drizzle-orm'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { groupBots, messages, runs } from '../src/db/schema.js'
import { triggerRuns } from '../src/modules/runs/trigger.js'
import { createTestApp, inbox, type TestApp } from './support/app.js'

let t: TestApp
beforeEach(async () => {
  t = await createTestApp()
})
afterEach(() => t.close())

async function world() {
  const alice = await t.seed.user({ name: '王磊' })
  const { machine, token } = await t.seed.machine(alice.id)
  const a = await t.seed.bot({ ownerId: alice.id, name: 'A', machineId: machine.id, binding: 'bound' })
  const group = await t.seed.group({ createdBy: alice.id, botIds: [a.id] })
  const where = and(eq(groupBots.groupId, group.id), eq(groupBots.botId, a.id))
  await t.db.update(groupBots).set({ sessionId: 'main-sess' }).where(where)
  const ws = t.ws('/ws/daemon')
  const box = inbox(ws)
  await box.opened
  ws.send(
    JSON.stringify({
      t: 'hello',
      protocol: PROTOCOL_VERSION,
      token,
      daemonVersion: '0.1.0',
      machine: { name: 'mbp', os: 'macos', arch: 'aarch64' },
      agents: [],
    }),
  )
  expect(await box.next()).toMatchObject({ t: 'welcome' })
  /** Sends `body` as the group's message and returns the run.start it led to. */
  const start = async (body: string, meta: Record<string, unknown> = {}) => {
    const [m] = await t.db
      .insert(messages)
      .values({
        groupId: group.id,
        kind: 'user',
        authorUserId: alice.id,
        body,
        meta: { mentions: [a.id], ...meta },
      })
      .returning()
    await triggerRuns(t.ctx, m!)
    return box.next<RunStart>()
  }
  const done = async (runId: string, sessionId: string) => {
    ws.send(
      JSON.stringify({
        t: 'run.done',
        runId,
        outcome: 'completed',
        reply: '好了',
        filesChanged: 0,
        usage: null,
        sessionId,
        newSessionReason: null,
        error: null,
        git: null,
        patch: null,
        appendsApplied: 0,
      }),
    )
    for (let i = 0; i < 50; i++) {
      const [r] = await t.db.select().from(runs).where(eq(runs.id, runId))
      if (r?.status === 'completed' && !r.finalizing) return
      await new Promise((ok) => setTimeout(ok, 20))
    }
    throw new Error(`run ${runId} did not finish`)
  }
  const gb = async () => (await t.db.select().from(groupBots).where(where))[0]!
  return { start, done, gb }
}

it('a scheduled task starts a fresh session every time and leaves the group’s own session alone', async () => {
  const w = await world()
  const scheduled = { scheduleOf: '00000000-0000-0000-0000-000000000001' }

  const first = await w.start('@A 日报', scheduled)
  expect(first).toMatchObject({ resumeSessionId: null, newSessionReason: 'schedule' })
  await w.done(first.runId, 'sched-1')
  expect(await w.gb()).toMatchObject({ sessionId: 'main-sess', newSessionReason: null })

  const second = await w.start('@A 日报', scheduled)
  expect(second).toMatchObject({ resumeSessionId: null, newSessionReason: 'schedule' })
  await w.done(second.runId, 'sched-2')

  // A member's @ carries on the group's conversation, as before.
  const manual = await w.start('@A 继续刚才的话题')
  expect(manual).toMatchObject({ resumeSessionId: 'main-sess', newSessionReason: null })
  await w.done(manual.runId, 'main-sess')
  expect((await w.gb()).sessionId).toBe('main-sess')
})

it('a pending /new is kept for the next member turn, not used up by a scheduled one', async () => {
  const w = await world()
  await t.db.update(groupBots).set({ sessionId: null, newSessionReason: 'requested' })
  const run = await w.start('@A 日报', { scheduleOf: '00000000-0000-0000-0000-000000000001' })
  expect(run.newSessionReason).toBe('schedule')
  await w.done(run.runId, 'sched-1')
  expect(await w.gb()).toMatchObject({ sessionId: null, newSessionReason: 'requested' })
  expect(await w.start('@A 新话题')).toMatchObject({ resumeSessionId: null, newSessionReason: 'requested' })
})
