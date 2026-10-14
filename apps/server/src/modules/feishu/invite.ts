import type { Ctx } from '../../context.js'
import { translator } from '../../i18n/index.js'
import { noticeCard } from './cards.js'
import { creatingChats } from './chats.js'
import { credsOf, onFeishu } from './gateway.js'
import { publicUrl } from './identity.js'
import { boundGroupOf } from './members.js'

const zt = translator('zh')

/**
 * 主应用进群: a chat no group is bound to gets a card linking to 从飞书群创建 with the chat preselected. The main app
 * serves every team, so the team (and who may create it) is decided in 共工, not here.
 */
export function startFeishuInvite(ctx: Ctx) {
  onFeishu(ctx, 'im.chat.member.bot.added_v1', async (app, ev) => {
    if (app.kind !== 'main' || !ev.chat_id) return
    // A chat 创建飞书群 just made is bound once that request finishes.
    await Promise.allSettled([...creatingChats])
    const base = await publicUrl(ctx)
    if (!base || (await boundGroupOf(ctx, ev.chat_id))) return
    const card = noticeCard(
      zt(
        '把这个飞书群接入共工：在共工创建对应的群并绑定，已绑定飞书账号的成员会自动加入，之后在群里 @Bot 即可使用。',
      ),
      { label: zt('在共工创建对应群'), url: `${base}/?feishuChat=${encodeURIComponent(ev.chat_id)}` },
    )
    await ctx.feishu.api.send(credsOf(app), ev.chat_id, {
      msgType: 'interactive',
      content: JSON.stringify(card),
    })
  })
}
