import { BindFeishuChatReq, type GroupFeishuView } from '@gonggong/protocol'
import { asc, eq, isNull } from 'drizzle-orm'
import type { FastifyInstance } from 'fastify'
import type { Ctx } from '../../context.js'
import { feishuChats, feishuIdentities, groupMembers, users } from '../../db/schema.js'
import { audit } from '../../lib/audit.js'
import { fail } from '../../lib/errors.js'
import { requireUser } from '../auth/session.js'
import { activeBots, publishGroup, requireAdmin } from '../groups/service.js'
import { botApp, mainApp } from './apps.js'
import { FeishuError } from './client.js'
import { credsOf } from './gateway.js'
import { joinFromFeishu, syncFromFeishu } from './members.js'
import { boundChat, markBound, unbindChat } from './mirror.js'

type Params = { Params: { id: string } }

/** Feishu's code for a call the app has no scope for. */
const NO_SCOPE = 99991672

/** Feishu's own words for a failed call, as a 共工 error. */
async function feishu<T>(call: Promise<T>) {
  try {
    return await call
  } catch (err) {
    if (!(err instanceof FeishuError)) throw err
    return fail('invalid', '飞书调用失败：{reason}', { reason: err.message })
  }
}

/** Group members in join order, with their Feishu union id when linked. */
const linkedMembers = (ctx: Ctx, groupId: string) =>
  ctx.db
    .select({ userId: users.id, name: users.name, unionId: feishuIdentities.unionId })
    .from(groupMembers)
    .innerJoin(users, eq(users.id, groupMembers.userId))
    .leftJoin(feishuIdentities, eq(feishuIdentities.userId, users.id))
    .where(eq(groupMembers.groupId, groupId))
    .orderBy(asc(groupMembers.joinedAt))

/** `added`: a bot app just added to the chat, which Feishu's chat list may not show yet. */
async function view(ctx: Ctx, groupId: string, added?: string): Promise<GroupFeishuView> {
  const main = await mainApp(ctx)
  if (!main) return { available: false, chat: null, chats: [], bots: [], members: [] }
  let chat = await boundChat(ctx.db, groupId)
  const all = await feishu(ctx.feishu.api.listChats(credsOf(main)))
  // Renamed on Feishu since binding: the stored name follows, so the group can offer to match it.
  const current = chat && all.find((c) => c.chatId === chat?.chatId)
  if (chat && current && current.name !== chat.name) {
    ;[chat] = await ctx.db
      .update(feishuChats)
      .set({ name: current.name })
      .where(eq(feishuChats.id, chat.id))
      .returning()
    await publishGroup(ctx, groupId)
  }
  const taken = new Set(
    (
      await ctx.db
        .select({ chatId: feishuChats.chatId })
        .from(feishuChats)
        .where(isNull(feishuChats.unboundAt))
    ).map((r) => r.chatId),
  )
  const chats = chat
    ? []
    : all.filter((c) => !taken.has(c.chatId)).map((c) => ({ chatId: c.chatId, name: c.name }))
  const bots = await Promise.all(
    (await activeBots(ctx, groupId)).map(async (b) => {
      const app = await botApp(ctx, b.id)
      const inChat =
        !!chat &&
        !!app &&
        (app.appId === added ||
          (await ctx.feishu.api.listChats(credsOf(app)).catch(() => [])).some(
            (c) => c.chatId === chat.chatId,
          ))
      return { botId: b.id, name: b.name, appId: app?.appId ?? null, inChat }
    }),
  )
  return {
    available: true,
    chat: chat
      ? { groupId, chatId: chat.chatId, name: chat.name, boundAt: chat.createdAt.toISOString() }
      : null,
    chats,
    bots,
    members: (await linkedMembers(ctx, groupId)).map((m) => ({
      userId: m.userId,
      name: m.name,
      linked: !!m.unionId,
    })),
  }
}

/** Feishu takes at most this many users and bots when creating a chat; the rest are added after. */
const CREATE_USERS = 50
const CREATE_BOTS = 5

/** 群设置 · 飞书: a group admin binds the group to one chat of the main app (one to one) and adds bots' apps to it. */
export function feishuChatRoutes(ctx: Ctx) {
  const admin = async (req: Parameters<typeof requireUser>[1], groupId: string) => {
    const user = await requireUser(ctx, req)
    const { group } = await requireAdmin(ctx, groupId, user.id)
    if (group.kind !== 'group') return fail('invalid', '私聊不能绑定飞书群')
    return { user, group }
  }

  return async (app: FastifyInstance) => {
    app.get<Params>('/api/groups/:id/feishu', async (req) => {
      const { group } = await admin(req, req.params.id)
      return view(ctx, group.id)
    })

    app.put<Params>('/api/groups/:id/feishu', async (req) => {
      const { user, group } = await admin(req, req.params.id)
      const { chatId } = BindFeishuChatReq.parse(req.body)
      const main = (await mainApp(ctx)) ?? fail('invalid', '系统管理员尚未配置飞书主应用')
      if (await boundChat(ctx.db, group.id)) return fail('conflict', '该群已绑定飞书群，请先解绑')
      const chat = (await feishu(ctx.feishu.api.listChats(credsOf(main)))).find((c) => c.chatId === chatId)
      if (!chat) return fail('invalid', '主应用不在该飞书群中')
      // The main app is shared by every team: only someone in the Feishu chat may tie it to their group.
      const [identity] = await ctx.db
        .select({ unionId: feishuIdentities.unionId })
        .from(feishuIdentities)
        .where(eq(feishuIdentities.userId, user.id))
      if (!identity) return fail('invalid', '请先在个人设置中绑定飞书账号')
      const members = await feishu(ctx.feishu.api.chatMembers(credsOf(main), chatId))
      if (!members.includes(identity.unionId)) return fail('invalid', '你不在该飞书群中，不能绑定')
      const [row] = await ctx.db
        .insert(feishuChats)
        .values({ groupId: group.id, chatId, name: chat.name, boundBy: user.id, createdAt: ctx.now() })
        .onConflictDoNothing()
        .returning()
      if (!row) return fail('conflict', '该飞书群已绑定其他群')
      markBound(ctx, group.id)
      await joinFromFeishu(ctx, group, members)
      await publishGroup(ctx, group.id)
      await audit(ctx, {
        category: 'admin',
        actorUserId: user.id,
        teamId: group.teamId,
        groupId: group.id,
        action: 'feishu.chat.bind',
        detail: { chatId, name: chat.name },
      })
      return view(ctx, group.id)
    })

    // 创建飞书群: a chat owned by the admin with the group's linked members and bot apps, bound to the group.
    app.post<Params>('/api/groups/:id/feishu/chat', async (req) => {
      const { user, group } = await admin(req, req.params.id)
      const main = (await mainApp(ctx)) ?? fail('invalid', '系统管理员尚未配置飞书主应用')
      if (await boundChat(ctx.db, group.id)) return fail('conflict', '该群已绑定飞书群，请先解绑')
      const members = await linkedMembers(ctx, group.id)
      const owner = members.find((m) => m.userId === user.id)?.unionId
      if (!owner) return fail('invalid', '请先在个人设置中绑定飞书账号')
      const unionIds = members.flatMap((m) => (m.unionId && m.unionId !== owner ? [m.unionId] : []))
      const appIds: string[] = []
      for (const b of await activeBots(ctx, group.id)) {
        const app = await botApp(ctx, b.id)
        if (app) appIds.push(app.appId)
      }
      const name = group.name.slice(0, 60)
      const chatId = await ctx.feishu.api
        .createChat(credsOf(main), {
          name,
          ownerUnionId: owner,
          unionIds: unionIds.slice(0, CREATE_USERS),
          botAppIds: appIds.slice(0, CREATE_BOTS),
        })
        .catch((err) =>
          err instanceof FeishuError && err.code === NO_SCOPE
            ? fail(
                'invalid',
                '飞书主应用没有建群权限，请系统管理员在飞书开放平台为主应用开通 im:chat:create 并发布版本',
              )
            : feishu(Promise.reject(err)),
        )
      const [row] = await ctx.db
        .insert(feishuChats)
        .values({ groupId: group.id, chatId, name, boundBy: user.id, createdAt: ctx.now() })
        .onConflictDoNothing()
        .returning()
      if (!row) return fail('conflict', '该群已绑定飞书群，请先解绑')
      markBound(ctx, group.id)
      for (let i = CREATE_USERS; i < unionIds.length; i += CREATE_USERS)
        await feishu(ctx.feishu.api.addUsers(credsOf(main), chatId, unionIds.slice(i, i + CREATE_USERS)))
      // One by one: a bot that cannot join (e.g. the chat's bot limit) is left to 拉入飞书群 in the list below.
      for (const appId of appIds.slice(CREATE_BOTS))
        await ctx.feishu.api.addBot(credsOf(main), chatId, appId).catch(() => {})
      await publishGroup(ctx, group.id)
      await audit(ctx, {
        category: 'admin',
        actorUserId: user.id,
        teamId: group.teamId,
        groupId: group.id,
        action: 'feishu.chat.create',
        detail: { chatId, name },
      })
      return view(ctx, group.id)
    })

    app.delete<Params>('/api/groups/:id/feishu', async (req, reply) => {
      const { user, group } = await admin(req, req.params.id)
      const chat = await unbindChat(ctx, group.id)
      if (chat) {
        await audit(ctx, {
          category: 'admin',
          actorUserId: user.id,
          teamId: group.teamId,
          groupId: group.id,
          action: 'feishu.chat.unbind',
          detail: { chatId: chat.chatId },
        })
        await publishGroup(ctx, group.id)
      }
      return reply.status(204).send()
    })

    app.post<Params>('/api/groups/:id/feishu/sync-members', async (req) => {
      const { group } = await admin(req, req.params.id)
      const chat = (await boundChat(ctx.db, group.id)) ?? fail('invalid', '该群尚未绑定飞书群')
      const main = (await mainApp(ctx)) ?? fail('invalid', '系统管理员尚未配置飞书主应用')
      return syncFromFeishu(ctx, group, await feishu(ctx.feishu.api.chatMembers(credsOf(main), chat.chatId)))
    })

    app.post<{ Params: { id: string; botId: string } }>('/api/groups/:id/feishu/bots/:botId', async (req) => {
      const { group } = await admin(req, req.params.id)
      const chat = (await boundChat(ctx.db, group.id)) ?? fail('invalid', '该群尚未绑定飞书群')
      const inGroup = (await activeBots(ctx, group.id)).some((b) => b.id === req.params.botId)
      const app = inGroup ? await botApp(ctx, req.params.botId) : undefined
      if (!app) return fail('invalid', '该 Bot 没有绑定飞书应用')
      const main = (await mainApp(ctx)) ?? fail('invalid', '系统管理员尚未配置飞书主应用')
      await feishu(ctx.feishu.api.addBot(credsOf(main), chat.chatId, app.appId))
      return view(ctx, group.id, app.appId)
    })
  }
}
