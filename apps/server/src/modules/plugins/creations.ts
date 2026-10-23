import { randomUUID } from 'node:crypto'
import {
  type CreationCard,
  type CreationDraftCard,
  type CreationReq,
  type PluginInput,
  type PluginManifest,
  templateInputs,
  usesDesignSystem,
} from '@gonggong/protocol'
import { eq } from 'drizzle-orm'
import type { Ctx } from '../../context.js'
import { messages } from '../../db/schema.js'
import { type MessageKey, zh } from '../../i18n/index.js'
import { fail } from '../../lib/errors.js'
import { isUuid } from '../../lib/ids.js'
import { claimAttachments } from '../attachments/service.js'
import { mirrorUserMessage } from '../feishu/mirror.js'
import { requireMember } from '../groups/service.js'
import {
  authorName,
  type MessageMeta,
  type MessageRow,
  memberIds,
  messageDto,
  postMessage,
  publishMessage,
} from '../messages/service.js'
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

/**
 * The template's form values as `label：value` lines; defaults fill what was left out, values of other inputs are
 * dropped. `missing` lists blank required ones, which only a proposal may leave.
 */
function inputLines(asked: PluginInput[], values: CreationReq['inputs'], lenient: boolean) {
  const missing: string[] = []
  const lines = asked.flatMap((i) => {
    const v = values[i.id] ?? i.default
    const label = { label: i.label }
    if (i.type === 'boolean') {
      if (v !== null && typeof v !== 'boolean') fail('invalid', '参数格式不对：{label}', label)
      return v === null ? [] : [{ label: i.label, value: v ? '是' : '否' }]
    }
    if (v !== null && typeof v !== 'string') fail('invalid', '参数格式不对：{label}', label)
    const text = ((v as string | null) ?? '').trim()
    if (!text) {
      if (i.required && !lenient) fail('invalid', '请填写{label}', label)
      if (i.required) missing.push(i.label)
      return []
    }
    if (i.type === 'select' && !i.options.includes(text)) fail('invalid', '{label}的取值不在选项里', label)
    return [{ label: i.label, value: text }]
  })
  return { lines, missing }
}

type Draft = Pick<
  CreationReq,
  'pluginId' | 'templateId' | 'designSystemId' | 'inputs' | 'directions' | 'botId'
>

/** A creation checked against the group's plugins and the bot as `originUserId` would start it now. */
async function resolve(ctx: Ctx, groupId: string, originUserId: string, req: Draft, lenient: boolean) {
  await requirePluginsOn(ctx.db)
  const found =
    (await groupPluginList(ctx.db, groupId)).find((r) => r.plugin.id === req.pluginId && r.enabledInGroup) ??
    fail('conflict', '这个插件没有在本群启用')
  const m = found.version.manifest
  const template = pick(m.templates, req.templateId, '请选择模板', '模板不存在')
  const ds = usesDesignSystem(m, template)
    ? pick(m.designSystems, req.designSystemId, '请选择设计系统', '设计系统不存在')
    : req.designSystemId === null
      ? null
      : fail('invalid', '这个模板不用设计系统')
  const { lines, missing } = inputLines(templateInputs(m, template), req.inputs, lenient)
  const [bot] = await botStates(ctx, groupId, originUserId, req.botId)
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
    inputs: lines,
    directions: req.directions,
    botId: bot.id,
    botName: bot.name,
  }
  return { m, card, missing }
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

/** A pending 创作确认卡 of the group. */
async function pendingDraft(ctx: Ctx, groupId: string, messageId: string) {
  const [row] = isUuid(messageId)
    ? await ctx.db.select().from(messages).where(eq(messages.id, messageId))
    : []
  const card = (row?.meta as MessageMeta | undefined)?.card
  if (!row || row.groupId !== groupId || card?.type !== 'creation-draft')
    return fail('not_found', '这张创作确认卡不存在')
  if (card.status !== 'pending') fail('conflict', '这张创作确认卡已经处理过了')
  return { row: row as MessageRow, card }
}

async function settleDraft(
  ctx: Ctx,
  row: MessageRow,
  card: CreationDraftCard,
  patch: Pick<CreationDraftCard, 'status' | 'by' | 'creationId'>,
) {
  const [updated] = await ctx.db
    .update(messages)
    .set({ meta: { ...(row.meta as MessageMeta), card: { ...card, ...patch } } })
    .where(eq(messages.id, row.id))
    .returning()
  const dto = messageDto(updated as MessageRow, await authorName(ctx, updated as MessageRow))
  ctx.bus.publish(await memberIds(ctx, dto.groupId), { t: 'message.edited', message: dto })
}

/**
 * POST /api/groups/:id/creations: a creation card from the requester @-ing the bot, which triggers its turn. With
 * `fromDraft` it also marks that 创作确认卡 started.
 */
export async function createCreation(
  ctx: Ctx,
  me: { id: string; name: string },
  groupId: string,
  req: CreationReq,
) {
  const { group } = await requireMember(ctx, groupId, me.id)
  const draft = req.fromDraft ? await pendingDraft(ctx, group.id, req.fromDraft) : null
  const { m, card } = await resolve(ctx, group.id, me.id, req, false)
  const row = await ctx.db.transaction(async (tx) => {
    const id = randomUUID()
    const files = await claimAttachments(tx, req.attachmentIds, {
      uploaderId: me.id,
      groupId: group.id,
      messageId: id,
    })
    const meta: MessageMeta = {
      mentions: [card.botId],
      card,
      ...(files.length > 0 && { attachments: files }),
    }
    const [inserted] = await tx
      .insert(messages)
      .values({ id, groupId: group.id, kind: 'user', authorUserId: me.id, body: instructions(m, card), meta })
      .returning()
    return inserted as MessageRow
  })
  const dto = messageDto(row, me.name)
  await publishMessage(ctx, dto)
  if (draft)
    await settleDraft(ctx, draft.row, draft.card, { status: 'started', by: me.name, creationId: row.id })
  await mirrorUserMessage(ctx, row, me)
  await triggerRuns(ctx, row)
  return dto
}

/** POST /api/groups/:id/creation-drafts/:messageId/dismiss — 不用了. */
export async function dismissDraft(
  ctx: Ctx,
  me: { id: string; name: string },
  groupId: string,
  messageId: string,
) {
  await requireMember(ctx, groupId, me.id)
  const { row, card } = await pendingDraft(ctx, groupId, messageId)
  await settleDraft(ctx, row, card, { status: 'dismissed', by: me.name, creationId: null })
}

/** creation_propose: the run's bot posts a 创作确认卡 for a member to start; blank required inputs are listed. */
export async function proposeCreation(
  ctx: Ctx,
  run: { groupId: string; botId: string; originUserId: string },
  req: Omit<Draft, 'botId'>,
  note: string | null,
) {
  const { card, missing } = await resolve(
    ctx,
    run.groupId,
    run.originUserId,
    { ...req, botId: run.botId },
    true,
  )
  const draft: CreationDraftCard = {
    ...card,
    type: 'creation-draft',
    missing,
    note,
    status: 'pending',
    by: null,
    creationId: null,
  }
  const i18n = {
    key: '{bot} 提议用「{plugin}」创作，等群成员确认',
    params: { bot: card.botName, plugin: card.pluginTitle },
  } as const
  const summary = [
    card.template?.title,
    card.designSystem?.title,
    ...card.inputs.map((i) => `${i.label}：${i.value}`),
  ]
  const dto = await postMessage(ctx, {
    groupId: run.groupId,
    kind: 'event',
    body: [zh(i18n.key, i18n.params), summary.filter(Boolean).join(' · ')].filter(Boolean).join('\n'),
    meta: { card: draft, i18n } satisfies MessageMeta,
  })
  return { id: dto.id, missing }
}
