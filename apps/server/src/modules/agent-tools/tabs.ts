import {
  type GONGGONG_TOOLS,
  type GroupTabTarget,
  type GroupTabTargetReq,
  GroupTabTargetReq as TargetReq,
} from '@gonggong/protocol'
import type { z } from 'zod'
import type { Ctx } from '../../context.js'
import type { runs } from '../../db/schema.js'
import { createTab, ENTRY_TITLES, groupTabList } from '../group-tabs/service.js'
import { activeBots } from '../groups/service.js'
import { asTool, refuse, type ToolOutput } from './service.js'

type Run = typeof runs.$inferSelect
type Args<N extends keyof typeof GONGGONG_TOOLS> = z.infer<(typeof GONGGONG_TOOLS)[N]['input']>

const describe = (t: GroupTabTarget) => {
  switch (t.kind) {
    case 'link':
      return `链接 ${t.url}`
    case 'knowledge':
      return `知识库条目 id ${t.knowledgeId}`
    case 'file':
      return `文件 ${t.path}`
    case 'entry':
      return `入口 ${ENTRY_TITLES[t.entry]}`
  }
}

export async function tabList(ctx: Ctx, run: Run): Promise<ToolOutput> {
  const { tabs } = await groupTabList(ctx, run.groupId)
  if (!tabs.length) return { text: '本群还没有标签', groups: [run.groupId] }
  const lines = tabs.map((t) => `- ${t.title}：${describe(t.target)}${t.stale ? '（已失效）' : ''}`)
  return { text: [`本群标签 ${tabs.length} 个：`, ...lines].join('\n'), groups: [run.groupId] }
}

export async function tabCreate(ctx: Ctx, run: Run, a: Args<'tab_create'>): Promise<ToolOutput> {
  const raw =
    a.kind === 'link'
      ? { kind: 'link', url: a.url }
      : a.kind === 'knowledge'
        ? { kind: 'knowledge', knowledgeId: a.knowledge_id }
        : { kind: 'file', botId: run.botId, path: a.path?.replace(/^\.?\//, '') }
  const parsed = TargetReq.safeParse(raw)
  if (!parsed.success)
    refuse(
      `kind=${a.kind} 时请给出${{ link: ' http/https 的 url', knowledge: ' knowledge_id', file: ' path' }[a.kind]}`,
    )
  const name = (await activeBots(ctx, run.groupId)).find((b) => b.id === run.botId)?.name ?? ''
  const target = parsed.data as GroupTabTargetReq
  const tab = await asTool(() =>
    createTab(ctx, run.groupId, { title: a.title, target }, { botId: run.botId, name }),
  )
  return { text: `已添加群标签「${tab.title}」`, groups: [] }
}
