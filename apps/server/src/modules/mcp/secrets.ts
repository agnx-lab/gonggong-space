import type { McpSecretCard, McpServer } from '@gonggong/protocol'
import { and, eq, isNull } from 'drizzle-orm'
import type { Ctx } from '../../context.js'
import { bots, mcpSecretRequests, mcpServers, messages, users } from '../../db/schema.js'
import { zh } from '../../i18n/index.js'
import { fail } from '../../lib/errors.js'
import { authorName, type MessageMeta, memberIds, messageDto, postMessage } from '../messages/service.js'
import { type Layer, logMcp, type McpRow, type Scope } from './service.js'

/** What a bot writes for a secret: the value is filled on a card by a person, never by the agent. */
export const SECRET = /^\$\{secret:[A-Za-z0-9_.-]+\}$/

/** env (stdio) or headers (http): every value there is a secret. */
export const secretsOf = (c: McpServer) => (c.transport === 'stdio' ? c.env : c.headers)
const withSecrets = (c: McpServer, s: Record<string, string>): McpServer =>
  c.transport === 'stdio' ? { ...c, env: s } : { ...c, headers: s }

/** Keys whose values are not placeholders (plain text the agent must not set). */
export const plainSecrets = (c: McpServer) =>
  Object.entries(secretsOf(c))
    .filter(([, v]) => !SECRET.test(v))
    .map(([k]) => k)

/** A placeholder for a key the current config already has keeps its value; new keys stay pending. */
export function keepSecrets(next: McpServer, current: McpServer) {
  const old = secretsOf(current)
  return withSecrets(
    next,
    Object.fromEntries(Object.entries(secretsOf(next)).map(([k, v]) => [k, old[k] ?? v])),
  )
}

export const pendingSecrets = (c: McpServer) =>
  Object.entries(secretsOf(c))
    .filter(([, v]) => SECRET.test(v))
    .map(([k]) => k)

/** The config as an agent may see it: secrets only say whether they are filled. */
export function describeMasked(c: McpServer) {
  const lines =
    c.transport === 'stdio' ? [`  启动：${[c.command, ...c.args].join(' ')}`] : [`  地址：${c.url}`]
  const secrets = Object.entries(secretsOf(c))
  if (secrets.length)
    lines.push(
      `  ${c.transport === 'stdio' ? 'env' : 'headers'}：${secrets
        .map(([k, v]) => `${k}（${SECRET.test(v) ? '待填写' : '已填写'}）`)
        .join('、')}`,
    )
  return lines
}

const card = (r: typeof mcpSecretRequests.$inferSelect, name: string): McpSecretCard => ({
  id: r.id,
  name,
  keys: r.keys,
  userId: r.userId,
  filled: r.filledAt !== null,
})

/** Posts the 填写密钥 card for the run's originator. */
export async function requestSecrets(
  ctx: Ctx,
  run: { id: string; groupId: string; botId: string; originUserId: string },
  row: McpRow,
  keys: string[],
  forceNewSession: boolean,
) {
  const [req] = (await ctx.db
    .insert(mcpSecretRequests)
    .values({
      mcpId: row.id,
      groupId: run.groupId,
      runId: run.id,
      userId: run.originUserId,
      keys,
      forceNewSession,
      createdAt: ctx.now(),
    })
    .returning()) as [typeof mcpSecretRequests.$inferSelect]
  const [bot] = await ctx.db.select({ name: bots.name }).from(bots).where(eq(bots.id, run.botId))
  const [user] = await ctx.db.select({ name: users.name }).from(users).where(eq(users.id, run.originUserId))
  const params = { bot: bot?.name ?? '', user: user?.name ?? '', name: row.name, keys: keys.join('、') }
  const key = '{bot} 请 {user} 填写 MCP「{name}」的密钥：{keys}' as const
  const msg = await postMessage(ctx, {
    groupId: run.groupId,
    kind: 'event',
    body: zh(key, params),
    meta: { mcpSecret: card(req, row.name), i18n: { key, params } } satisfies MessageMeta,
  })
  await ctx.db.update(mcpSecretRequests).set({ messageId: msg.id }).where(eq(mcpSecretRequests.id, req.id))
}

/** The originator fills every requested key; the values go into the server's config and nowhere else. */
export async function fillSecrets(ctx: Ctx, userId: string, id: string, values: Record<string, string>) {
  const [req] = await ctx.db.select().from(mcpSecretRequests).where(eq(mcpSecretRequests.id, id))
  if (!req) return fail('not_found', '密钥请求不存在')
  if (req.userId !== userId) return fail('forbidden', '仅发起人可以填写')
  if (req.filledAt) return fail('conflict', '密钥已填写')
  const given = Object.keys(values)
  if (given.length !== req.keys.length || !req.keys.every((k) => values[k]))
    return fail('invalid', '请填写全部密钥')
  const [row] = await ctx.db.select().from(mcpServers).where(eq(mcpServers.id, req.mcpId))
  if (!row) return fail('not_found', 'MCP 不存在')
  const config = row.config as McpServer
  const secrets = secretsOf(config)
  const missing = req.keys.find((k) => !(k in secrets))
  if (missing) return fail('conflict', 'MCP 配置已变更，没有 {key}', { key: missing })
  const updated = await ctx.db.transaction(async (tx) => {
    const [claimed] = await tx
      .update(mcpSecretRequests)
      .set({ filledAt: ctx.now() })
      .where(and(eq(mcpSecretRequests.id, id), isNull(mcpSecretRequests.filledAt)))
      .returning()
    if (!claimed) return fail('conflict', '密钥已填写')
    const [saved] = (await tx
      .update(mcpServers)
      .set({ config: withSecrets(config, { ...secrets, ...values }), updatedAt: ctx.now() })
      .where(eq(mcpServers.id, row.id))
      .returning()) as [McpRow]
    return { claimed, saved }
  })
  const l: Layer = { scope: row.scope as Scope, teamId: row.teamId, groupId: row.groupId }
  await logMcp(ctx, userId, l, 'mcp.secret_set', updated.saved, req.forceNewSession, { keys: req.keys })
  if (req.messageId) await refreshCard(ctx, req.messageId, card(updated.claimed, row.name))
  return card(updated.claimed, row.name)
}

async function refreshCard(ctx: Ctx, messageId: string, mcpSecret: McpSecretCard) {
  const [m] = await ctx.db.select().from(messages).where(eq(messages.id, messageId))
  if (!m) return
  const [row] = await ctx.db
    .update(messages)
    .set({ meta: { ...(m.meta as MessageMeta), mcpSecret } })
    .where(eq(messages.id, messageId))
    .returning()
  if (!row) return
  const dto = messageDto(row, await authorName(ctx, row))
  ctx.bus.publish(await memberIds(ctx, dto.groupId), { t: 'message.edited', message: dto })
}
