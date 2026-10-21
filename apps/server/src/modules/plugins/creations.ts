import { randomUUID } from 'node:crypto'
import type { CreationCard, CreationReq, PluginManifest } from '@gonggong/protocol'
import type { Ctx } from '../../context.js'
import { messages } from '../../db/schema.js'
import type { MessageKey } from '../../i18n/index.js'
import { fail } from '../../lib/errors.js'
import { claimAttachments } from '../attachments/service.js'
import { mirrorUserMessage } from '../feishu/mirror.js'
import { requireMember } from '../groups/service.js'
import { type MessageMeta, type MessageRow, messageDto, publishMessage } from '../messages/service.js'
import { triggerRuns } from '../runs/trigger.js'
import { botStates, groupPluginList, pluginBlocker, requirePluginsOn } from './service.js'

/** The picked one of `list`; null only when the plugin offers none. */
function pick<T extends { id: string }>(
  list: T[],
  id: string | null,
  missing: MessageKey,
  unknown: MessageKey,
) {
  if (id === null) return list.length ? fail('invalid', missing) : null
  return list.find((x) => x.id === id) ?? fail('invalid', unknown)
}

/** The form values as `label：value` lines; defaults fill what was left out. */
function inputLines(m: PluginManifest, values: CreationReq['inputs']) {
  return m.inputs.flatMap((i) => {
    const v = values[i.id] ?? i.default
    const label = { label: i.label }
    if (i.type === 'boolean') {
      if (v !== null && typeof v !== 'boolean') fail('invalid', '参数格式不对：{label}', label)
      return v === null ? [] : [{ label: i.label, value: v ? '是' : '否' }]
    }
    if (v !== null && typeof v !== 'string') fail('invalid', '参数格式不对：{label}', label)
    const text = ((v as string | null) ?? '').trim()
    if (!text) return i.required ? fail('invalid', '请填写{label}', label) : []
    if (i.type === 'select' && !i.options.includes(text)) fail('invalid', '{label}的取值不在选项里', label)
    return [{ label: i.label, value: text }]
  })
}

/** What the agent is asked to do (agent-facing: not translated). */
function instructions(m: PluginManifest, card: CreationCard) {
  const ds = card.designSystem && m.designSystems.find((d) => d.id === card.designSystem?.id)
  return [
    `@${card.botName} 请用插件「${m.title}」（${m.name} v${m.version}）创作。`,
    `Skill：Claude 用 ${m.name}:${m.entry}；Codex 用 ${m.entry}（目录 .agents/skills/${m.name}-${m.entry}）。`,
    ...(card.template ? [`模板：${card.template.title}（${card.template.id}）`] : []),
    ...(ds
      ? [
          `设计系统：${ds.title}（${ds.id}），先读取 skill 目录下的 ${ds.dir}/DESIGN.md 和 ${ds.dir}/tokens.css。`,
        ]
      : []),
    `先出 2–3 个视觉方向：${card.directions ? '是' : '否'}`,
    ...(card.inputs.length ? ['参数：', ...card.inputs.map((i) => `- ${i.label}：${i.value}`)] : []),
    '产物写到 design/<slug>/index.html（slug 用简短的英文小写和连字符），完成后用 preview_static 发布，再简短说明做了什么。',
  ].join('\n')
}

/** POST /api/groups/:id/creations: a creation card from the requester @-ing the bot, which triggers its turn. */
export async function createCreation(
  ctx: Ctx,
  me: { id: string; name: string },
  groupId: string,
  req: CreationReq,
) {
  const { group } = await requireMember(ctx, groupId, me.id)
  await requirePluginsOn(ctx.db)
  const found =
    (await groupPluginList(ctx.db, group.id)).find((r) => r.plugin.id === req.pluginId && r.enabledInGroup) ??
    fail('conflict', '这个插件没有在本群启用')
  const m = found.version.manifest
  const template = pick(m.templates, req.templateId, '请选择模板', '模板不存在')
  const ds = pick(m.designSystems, req.designSystemId, '请选择设计系统', '设计系统不存在')
  const inputs = inputLines(m, req.inputs)
  const [bot] = await botStates(ctx, group.id, me.id, req.botId)
  if (!bot) return fail('not_found', 'Bot 不在本群')
  if (pluginBlocker(m, bot.state)) fail('conflict', '{bot} 现在用不了这个插件', { bot: bot.name })

  const card: CreationCard = {
    type: 'creation',
    pluginId: found.plugin.id,
    pluginTitle: m.title,
    category: m.category,
    pluginVersion: m.version,
    template: template && { id: template.id, title: template.title },
    designSystem: ds && { id: ds.id, title: ds.title, swatches: ds.swatches },
    inputs,
    directions: req.directions,
    botId: bot.id,
    botName: bot.name,
  }
  const row = await ctx.db.transaction(async (tx) => {
    const id = randomUUID()
    const files = await claimAttachments(tx, req.attachmentIds, {
      uploaderId: me.id,
      groupId: group.id,
      messageId: id,
    })
    const meta: MessageMeta = { mentions: [bot.id], card, ...(files.length > 0 && { attachments: files }) }
    const [inserted] = await tx
      .insert(messages)
      .values({ id, groupId: group.id, kind: 'user', authorUserId: me.id, body: instructions(m, card), meta })
      .returning()
    return inserted as MessageRow
  })
  const dto = messageDto(row, me.name)
  await publishMessage(ctx, dto)
  await mirrorUserMessage(ctx, row, me)
  await triggerRuns(ctx, row)
  return dto
}
