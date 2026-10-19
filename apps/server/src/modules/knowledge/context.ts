import { and, desc, eq, gt, isNull, or } from 'drizzle-orm'
import type { Db } from '../../db/client.js'
import { groupKnowledge } from '../../db/schema.js'
import { estimateTokens } from '../runs/context-budget.js'

type Tx = Pick<Db, 'select'>
type Entry = Pick<
  typeof groupKnowledge.$inferSelect,
  | 'id'
  | 'title'
  | 'body'
  | 'tags'
  | 'pinned'
  | 'version'
  | 'createdAt'
  | 'updatedAt'
  | 'archivedAt'
  | 'updatedByBotId'
>

/** Pinned entries go into a run.start in full up to this many tokens; the rest are listed by title. */
const PINNED_TOKENS = 4000
const INDEX_TOKENS = 2000

// Agent-facing: not translated.
const GUIDE =
  '需要时用 kb_search 按关键词查找。了解到值得长期记住的本群事实（约定、环境、决策、踩过的坑）时，用 kb_create / kb_update 维护知识库，不要重复已有条目。'
const tagsOf = (e: Entry) => (e.tags.length ? ` · 标签：${e.tags.join('、')}` : '')
const indexLine = (e: Entry) => `${e.title}（id ${e.id}${e.pinned ? ' · 置顶' : ''}${tagsOf(e)}）`

/** Pinned entries in full while they fit; the one crossing the budget is clipped, later ones are returned. */
function pinnedBlocks(pinned: Entry[]) {
  const blocks: string[] = []
  let room = PINNED_TOKENS
  let i = 0
  for (; i < pinned.length && room > 0; i++) {
    const e = pinned[i] as Entry
    const head = `## ${e.title}（id ${e.id} · v${e.version} · 置顶${tagsOf(e)}）`
    const cost = estimateTokens(`${head}\n${e.body}`)
    if (cost <= room) {
      blocks.push(`${head}\n${e.body}`)
      room -= cost
      continue
    }
    const note = `…（已截断，全文用 kb_get(id=${e.id}) 读取）`
    let left = room - estimateTokens(`${head}\n${note}`)
    let body = ''
    for (const c of e.body) {
      left -= estimateTokens(c)
      if (left < 0) break
      body += c
    }
    blocks.push(`${head}\n${body}${note}`)
    room = 0
  }
  return { blocks, rest: pinned.slice(i) }
}

function indexLines(entries: Entry[]) {
  const lines: string[] = []
  let room = INDEX_TOKENS
  for (const e of entries) {
    const line = `- ${indexLine(e)}`
    room -= estimateTokens(line)
    if (room < 0) {
      lines.push(`- …另有 ${entries.length - lines.length} 条，用 kb_list 查看`)
      break
    }
    lines.push(line)
  }
  return lines
}

function fullBlock(live: Entry[]) {
  const { blocks, rest } = pinnedBlocks(live.filter((e) => e.pinned))
  const others = indexLines([...rest, ...live.filter((e) => !e.pinned)])
  const sections = [
    ...(blocks.length ? [blocks.join('\n\n')] : []),
    ...(others.length ? [['其他条目（全文用 gonggong 的 kb_get 读取）：', ...others].join('\n')] : []),
    GUIDE,
  ]
  return `群知识库（本群成员与 Bot 共同维护的长期信息，共 ${live.length} 条）：\n${sections.join('\n\n')}`
}

/** What changed after `since`, leaving out the bot's own last edits (it made them in this session). */
function changesBlock(rows: Entry[], since: Date, botId: string) {
  const changed = rows.filter((e) => !e.archivedAt && e.updatedAt > since && e.updatedByBotId !== botId)
  const deleted = rows.filter((e) => e.archivedAt && e.createdAt <= since)
  if (!changed.length && !deleted.length) return null
  const { blocks, rest } = pinnedBlocks(changed.filter((e) => e.pinned))
  const titled = [...rest, ...changed.filter((e) => !e.pinned)]
  const lines = [
    ...titled.map((e) => `- ${e.createdAt > since ? '新增' : '更新'}：${indexLine(e)}`),
    ...deleted.map((e) => `- 已删除：${e.title}`),
  ]
  const sections = [
    ...(blocks.length ? [blocks.join('\n\n')] : []),
    ...(lines.length ? [lines.join('\n')] : []),
    '全文用 gonggong 的 kb_get 读取。',
  ]
  return `群知识库自你上次读取后有变化：\n${sections.join('\n\n')}`
}

/**
 * The group knowledge base for a run.start: `full` (null when empty) opens a session; `changes` tells a session that
 * got it at `since` what changed since then (null when nothing did).
 */
export async function knowledgeContext(tx: Tx, groupId: string, botId: string, since: Date | null) {
  const rows: Entry[] = await tx
    .select({
      id: groupKnowledge.id,
      title: groupKnowledge.title,
      body: groupKnowledge.body,
      tags: groupKnowledge.tags,
      pinned: groupKnowledge.pinned,
      version: groupKnowledge.version,
      createdAt: groupKnowledge.createdAt,
      updatedAt: groupKnowledge.updatedAt,
      archivedAt: groupKnowledge.archivedAt,
      updatedByBotId: groupKnowledge.updatedByBotId,
    })
    .from(groupKnowledge)
    .where(
      and(
        eq(groupKnowledge.groupId, groupId),
        since
          ? or(isNull(groupKnowledge.archivedAt), gt(groupKnowledge.archivedAt, since))
          : isNull(groupKnowledge.archivedAt),
      ),
    )
    .orderBy(desc(groupKnowledge.pinned), desc(groupKnowledge.updatedAt))
  const live = rows.filter((e) => !e.archivedAt)
  return {
    full: live.length ? fullBlock(live) : null,
    changes: since ? changesBlock(rows, since, botId) : null,
  }
}
