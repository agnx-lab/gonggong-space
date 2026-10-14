import { join } from 'node:path'
import multipart from '@fastify/multipart'
import { eq } from 'drizzle-orm'
import type { FastifyInstance, FastifyRequest } from 'fastify'
import type { Ctx } from '../../context.js'
import { bots, feishuIdentities, groupMembers, groups, teams, users } from '../../db/schema.js'
import { audit } from '../../lib/audit.js'
import { fail } from '../../lib/errors.js'
import { openFile } from '../../lib/seal.js'
import { assertNotDemo } from '../admin/params.js'
import { dataDir } from '../attachments/service.js'
import { requireUser } from '../auth/session.js'
import { publishBot, publishBots } from '../bots/dto.js'
import { assertCanManage, auditForeign, loadBot } from '../bots/routes.js'
import { groupDto, publishGroup, requireAdmin } from '../groups/service.js'
import { meDto, myTeam, publishTeam } from '../teams/dto.js'
import { requireTeam } from '../teams/service.js'
import { dropAvatar, EXT, LOCAL, receiveAvatar } from './store.js'

const MIME = Object.fromEntries(Object.entries(EXT).map(([mime, ext]) => [ext, mime]))
const FILE = /^[0-9a-f-]{36}\.(png|jpg|webp|gif)$/

type P = { Params: { id: string } }

/** Group members and bot owners see the caller's new name or avatar. */
export async function publishProfile(ctx: Ctx, userId: string) {
  const mine = await ctx.db
    .select({ id: groupMembers.groupId })
    .from(groupMembers)
    .where(eq(groupMembers.userId, userId))
  for (const g of mine) await publishGroup(ctx, g.id)
  await publishBots(ctx, eq(bots.ownerId, userId))
}

export function avatarRoutes(ctx: Ctx) {
  return async (app: FastifyInstance) => {
    await app.register(multipart)

    const setAvatar = async (user: typeof users.$inferSelect, avatar: string | null) => {
      const [row] = await ctx.db.update(users).set({ avatar }).where(eq(users.id, user.id)).returning()
      await dropAvatar(user.avatar)
      await publishProfile(ctx, user.id)
      return meDto(ctx, row ?? user)
    }

    app.put('/api/me/avatar', async (req) => {
      const user = await requireUser(ctx, req)
      return setAvatar(user, await receiveAvatar(ctx, req, user))
    })

    app.post('/api/me/avatar/feishu', async (req) => {
      const user = await requireUser(ctx, req)
      await assertNotDemo(ctx, user)
      const [identity] = await ctx.db
        .select({ avatar: feishuIdentities.avatar })
        .from(feishuIdentities)
        .where(eq(feishuIdentities.userId, user.id))
      if (!identity?.avatar) return fail('invalid', '未绑定飞书或飞书账号没有头像')
      return setAvatar(user, identity.avatar)
    })

    app.delete('/api/me/avatar', async (req) => {
      const user = await requireUser(ctx, req)
      await assertNotDemo(ctx, user)
      return setAvatar(user, null)
    })

    const setTeamAvatar = async (req: FastifyRequest<P>, upload: boolean) => {
      const me = await requireUser(ctx, req)
      const { team } = await requireTeam(ctx, me.id, req.params.id, 'admin')
      const avatar = upload ? await receiveAvatar(ctx, req, me) : null
      if (!upload) await assertNotDemo(ctx, me)
      await ctx.db.update(teams).set({ avatar }).where(eq(teams.id, team.id))
      await dropAvatar(team.avatar)
      await audit(ctx, {
        category: 'admin',
        actorUserId: me.id,
        teamId: team.id,
        action: 'team.update',
        detail: { avatar: upload ? 'image' : null },
      })
      await publishTeam(ctx, team.id)
      return myTeam(ctx, me.id, team.id)
    }
    app.put<P>('/api/teams/:id/avatar', (req) => setTeamAvatar(req, true))
    app.delete<P>('/api/teams/:id/avatar', (req) => setTeamAvatar(req, false))

    const setBotAvatar = async (req: FastifyRequest<P>, upload: boolean) => {
      const user = await requireUser(ctx, req)
      const bot = await loadBot(ctx, req.params.id)
      assertCanManage(user, bot)
      const avatarImage = upload ? await receiveAvatar(ctx, req, user) : null
      if (!upload) await assertNotDemo(ctx, user)
      await ctx.db.update(bots).set({ avatarImage }).where(eq(bots.id, bot.id))
      await dropAvatar(bot.avatarImage)
      await auditForeign(ctx, user, bot, 'bot.update', { changes: { avatarImage: upload ? 'image' : null } })
      return publishBot(ctx, bot.id)
    }
    app.put<P>('/api/bots/:id/avatar', (req) => setBotAvatar(req, true))
    app.delete<P>('/api/bots/:id/avatar', (req) => setBotAvatar(req, false))

    const setGroupAvatar = async (req: FastifyRequest<P>, upload: boolean) => {
      const user = await requireUser(ctx, req)
      const { group } = await requireAdmin(ctx, req.params.id, user.id)
      if (group.kind !== 'group') return fail('invalid', '私聊的头像跟随 Bot')
      const avatar = upload ? await receiveAvatar(ctx, req, user) : null
      if (!upload) await assertNotDemo(ctx, user)
      await ctx.db.update(groups).set({ avatar }).where(eq(groups.id, group.id))
      await dropAvatar(group.avatar)
      await publishGroup(ctx, group.id)
      return groupDto(ctx, user.id, group.id)
    }
    app.put<P>('/api/groups/:id/avatar', (req) => setGroupAvatar(req, true))
    app.delete<P>('/api/groups/:id/avatar', (req) => setGroupAvatar(req, false))

    app.get<{ Params: { file: string } }>('/api/avatars/:file', async (req, reply) => {
      await requireUser(ctx, req)
      const { file } = req.params
      if (!FILE.test(file)) return fail('not_found', '头像不存在')
      const stream = await openFile(join(dataDir(), LOCAL, file)).catch(() => fail('not_found', '头像不存在'))
      return reply
        .header('content-type', MIME[file.split('.')[1] as string])
        .header('cache-control', 'private, max-age=31536000, immutable')
        .header('x-content-type-options', 'nosniff')
        .send(stream)
    })
  }
}
