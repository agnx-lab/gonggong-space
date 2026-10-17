import { randomUUID } from 'node:crypto'
import { TERMINAL_RUN_STATUS } from '@gonggong/protocol'
import { and, asc, desc, eq, inArray, isNotNull, ne, type SQLWrapper, sql } from 'drizzle-orm'
import { afterAll, beforeAll, expect, it } from 'vitest'
import { groupBots, messages, runs, syncReplicas } from '../src/db/schema.js'
import { createTestDb } from './support/db.js'

let t: Awaited<ReturnType<typeof createTestDb>>
beforeAll(async () => {
  t = await createTestDb()
})
afterAll(() => t.close())

/** Indexes the planner scans for `query` once sequential scans are priced out, as they are on large tables. */
const indexesFor = (query: SQLWrapper) =>
  t.db.transaction(async (tx) => {
    await tx.execute(sql`set local enable_seqscan = off`)
    const plan = JSON.stringify(await tx.execute(sql`explain (format json) ${query.getSQL()}`))
    return [...plan.matchAll(/"Index Name":"([^"]+)"/g)].map((m) => m[1])
  })

it('requeueing appends finds them by the run they were appended to, not through the group history', async () => {
  const query = t.db
    .select({ id: messages.id })
    .from(messages)
    .where(and(eq(messages.groupId, randomUUID()), sql`${messages.meta}->>'appendTo' = ${randomUUID()}`))
    .orderBy(asc(messages.seq))
  expect(await indexesFor(query)).toContain('messages_append_to')
})

it('a relay chain is walked down by parent run', async () => {
  const query = t.db.select({ id: runs.id }).from(runs).where(eq(runs.parentRunId, randomUUID()))
  expect(await indexesFor(query)).toContain('runs_parent')
})

it('the interrupt note reads the latest started run of the bot in the group', async () => {
  const query = t.db
    .select({ id: runs.id })
    .from(runs)
    .where(
      and(
        eq(runs.groupId, randomUUID()),
        eq(runs.botId, randomUUID()),
        ne(runs.id, randomUUID()),
        isNotNull(runs.startedAt),
      ),
    )
    .orderBy(desc(runs.startedAt))
    .limit(1)
  expect(await indexesFor(query)).toContain('runs_group_bot_started')
})

it('a schedule’s fail streak reads only the messages it fired', async () => {
  const query = t.db
    .select({ status: runs.status })
    .from(runs)
    .innerJoin(messages, eq(messages.id, runs.triggerMessageId))
    .where(
      and(
        eq(messages.groupId, randomUUID()),
        sql`${messages.meta}->>'scheduleOf' = ${randomUUID()}`,
        inArray(runs.status, [...TERMINAL_RUN_STATUS]),
      ),
    )
    .orderBy(desc(messages.seq))
    .limit(3)
  expect(await indexesFor(query)).toContain('messages_schedule_of')
})

it('a bot’s group memberships and sync replicas are found by bot', async () => {
  const bot = randomUUID()
  expect(await indexesFor(t.db.select().from(groupBots).where(eq(groupBots.botId, bot)))).toContain(
    'group_bots_bot',
  )
  expect(await indexesFor(t.db.select().from(syncReplicas).where(eq(syncReplicas.botId, bot)))).toContain(
    'sync_replicas_bot',
  )
})
