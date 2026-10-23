import type { MessageDto } from '@gonggong/protocol'
import { and, eq } from 'drizzle-orm'
import type { Ctx } from '../../context.js'
import { bots, messages, runs, users } from '../../db/schema.js'
import { fail } from '../../lib/errors.js'
import { idParam } from '../../lib/ids.js'
import { userAuthorName } from './service.js'

/** Quoted text sent to the agent is capped; the UI shows one line of it anyway. */
export const QUOTE_MAX = 2000

export type Quote = NonNullable<MessageDto['quote']>

/** Snapshot of a quoted message / run card of this group. A quote never triggers a bot (plan D11); an @ does. */
export async function resolveQuote(ctx: Ctx, groupId: string, q: { kind: 'message' | 'run'; id: string }) {
  const id = idParam(q.id, '引用的内容不存在')
  if (q.kind === 'message') {
    const [m] = await ctx.db
      .select({
        body: messages.body,
        bot: bots.name,
        user: userAuthorName,
        recalledAt: messages.recalledAt,
      })
      .from(messages)
      .leftJoin(users, eq(users.id, messages.authorUserId))
      .leftJoin(bots, eq(bots.id, messages.authorBotId))
      .where(and(eq(messages.id, id), eq(messages.groupId, groupId)))
    if (!m) return fail('not_found', '引用的消息不存在')
    if (m.recalledAt) return fail('conflict', '该消息已撤回')
    return snapshot(q.kind, id, m.bot ?? m.user ?? '', m.body)
  }
  const [r] = await ctx.db
    .select({ bot: bots.name, step: runs.step, status: runs.status })
    .from(runs)
    .innerJoin(bots, eq(bots.id, runs.botId))
    .where(and(eq(runs.id, id), eq(runs.groupId, groupId)))
  if (!r) return fail('not_found', '引用的运行不存在')
  const [reply] = await ctx.db
    .select({ body: messages.body })
    .from(messages)
    .where(and(eq(messages.runId, id), eq(messages.kind, 'bot')))
  return snapshot(q.kind, id, `${r.bot} 的运行卡片`, reply?.body || r.step || r.status)
}

const snapshot = (kind: Quote['kind'], id: string, who: string, text: string): Quote => ({
  kind,
  id,
  who,
  text: text.slice(0, QUOTE_MAX),
})
