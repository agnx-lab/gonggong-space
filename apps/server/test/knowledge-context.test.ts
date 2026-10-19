import { PROTOCOL_VERSION, type RunStart } from '@gonggong/protocol'
import { and, eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { groupBots, groupKnowledge, messages } from '../src/db/schema.js'
import { triggerRuns } from '../src/modules/runs/trigger.js'
import { createTestApp, inbox, type TestApp } from './support/app.js'

let t: TestApp
let clock = new Date('2026-10-19T08:00:00Z')
beforeEach(async () => {
  clock = new Date('2026-10-19T08:00:00Z')
  t = await createTestApp({ now: () => clock })
})
afterEach(() => t.close())

const KB = '共工空间'
const hour = (h: number) => new Date(`2026-10-19T0${h}:00:00Z`)

async function world() {
  const wang = await t.seed.user({ name: '王磊' })
  const { machine, token } = await t.seed.machine(wang.id)
  const bot = await t.seed.bot({ ownerId: wang.id, name: 'Claude', machineId: machine.id })
  const group = await t.seed.group({ createdBy: wang.id, botIds: [bot.id] })
  const ws = t.ws('/ws/daemon')
  const box = inbox(ws)
  await box.opened
  ws.send(
    JSON.stringify({
      t: 'hello',
      protocol: PROTOCOL_VERSION,
      token,
      daemonVersion: '0.1.0',
      machine: { name: 'mbp', os: 'macos', arch: 'aarch64' },
      agents: [],
    }),
  )
  expect(await box.next()).toMatchObject({ t: 'welcome' })
  const gb = and(eq(groupBots.groupId, group.id), eq(groupBots.botId, bot.id))
  const session = (o: { sessionId?: string | null; knowledgeAt?: Date | null }) =>
    t.db.update(groupBots).set(o).where(gb)
  const entry = (o: Partial<typeof groupKnowledge.$inferInsert> & { title: string }) =>
    t.db
      .insert(groupKnowledge)
      .values({ groupId: group.id, body: '', createdAt: hour(1), updatedAt: hour(1), ...o })
      .returning()
      .then((r) => r[0]!)
  const mention = async (meta: Record<string, unknown> = {}) => {
    const [m] = await t.db
      .insert(messages)
      .values({
        groupId: group.id,
        kind: 'user',
        authorUserId: wang.id,
        body: '@Claude hi',
        meta: { mentions: [bot.id], ...meta },
      })
      .returning()
    await triggerRuns(t.ctx, m!)
    return box.next<RunStart>()
  }
  const cursor = async () => (await t.db.select().from(groupBots).where(gb))[0]!.knowledgeAt
  return { session, entry, mention, cursor }
}

const notes = (list: RunStart['prompt']['context']) => list.filter((c) => c.author === KB).map((c) => c.body)

describe('knowledge base in the run context', () => {
  it('sends nothing while the knowledge base is empty', async () => {
    const w = await world()
    const start = await w.mention()
    expect(notes(start.prompt.context)).toEqual([])
    expect(await w.cursor()).toEqual(clock)
  })

  it('opens a new session with the pinned entries in full and an index of the rest', async () => {
    const w = await world()
    const rules = await w.entry({ title: '代码约定', body: '注释用英文', pinned: true, version: 2 })
    const deploy = await w.entry({ title: '部署流程', tags: ['部署', '运维'] })
    await w.entry({ title: '已删除', archivedAt: hour(2) })
    const start = await w.mention()
    expect(start.resumeSessionId).toBeNull()
    expect(start.prompt.context[0]).toMatchObject({ seq: 0, author: KB, kind: 'user' })
    expect(notes(start.prompt.context)).toEqual([
      [
        '群知识库（本群成员与 Bot 共同维护的长期信息，共 2 条）：',
        `## 代码约定（id ${rules.id} · v2 · 置顶）`,
        '注释用英文',
        '',
        '其他条目（全文用 gonggong 的 kb_get 读取）：',
        `- 部署流程（id ${deploy.id} · 标签：部署、运维）`,
        '',
        '需要时用 kb_search 按关键词查找。了解到值得长期记住的本群事实（约定、环境、决策、踩过的坑）时，用 kb_create / kb_update 维护知识库，不要重复已有条目。',
      ].join('\n'),
    ])
    expect(start.prompt.fallbackContext).toEqual([])
    expect(await w.cursor()).toEqual(clock)
  })

  it('clips pinned entries beyond the budget with a pointer to kb_get', async () => {
    const w = await world()
    const big = await w.entry({ title: '长文', body: '字'.repeat(6000), pinned: true })
    const [note] = notes((await w.mention()).prompt.context)
    expect(note).toContain(`…（已截断，全文用 kb_get(id=${big.id}) 读取）`)
    expect(note!.length).toBeLessThan(4500)
  })

  it('tells a resumed session only what changed since it last got the knowledge base', async () => {
    const w = await world()
    await w.session({ sessionId: 'sess-1', knowledgeAt: hour(2) })
    await w.entry({ title: '没变', pinned: true, body: '旧的' })
    const rules = await w.entry({
      title: '代码约定',
      body: '新规则',
      pinned: true,
      version: 3,
      updatedAt: hour(3),
    })
    const fresh = await w.entry({ title: '新条目', createdAt: hour(3), updatedAt: hour(3) })
    await w.entry({ title: '旧条目', archivedAt: hour(3) })
    await w.entry({ title: '来去匆匆', createdAt: hour(3), archivedAt: hour(4) })
    const start = await w.mention()
    expect(start.resumeSessionId).toBe('sess-1')
    expect(notes(start.prompt.context)).toEqual([
      [
        '群知识库自你上次读取后有变化：',
        `## 代码约定（id ${rules.id} · v3 · 置顶）`,
        '新规则',
        '',
        `- 新增：新条目（id ${fresh.id}）`,
        '- 已删除：旧条目',
        '',
        '全文用 gonggong 的 kb_get 读取。',
      ].join('\n'),
    ])
    const [full] = notes(start.prompt.fallbackContext)
    expect(full).toContain('群知识库（本群成员与 Bot 共同维护的长期信息，共 3 条）')
    expect(full).toContain('没变')
  })

  it('sends a resumed session nothing when nothing changed, keeping the whole base for its fallback', async () => {
    const w = await world()
    await w.entry({ title: '代码约定', body: '注释用英文', pinned: true })
    await w.session({ sessionId: 'sess-1', knowledgeAt: hour(2) })
    const unchanged = await w.mention()
    expect(notes(unchanged.prompt.context)).toEqual([])
    expect(notes(unchanged.prompt.fallbackContext)).toHaveLength(1)
  })

  it('sends the whole base to a resumed session that never got it', async () => {
    const w = await world()
    await w.entry({ title: '代码约定', body: '注释用英文', pinned: true })
    await w.session({ sessionId: 'sess-1', knowledgeAt: null })
    const [note] = notes((await w.mention()).prompt.context)
    expect(note).toContain('群知识库（本群成员与 Bot 共同维护的长期信息，共 1 条）')
  })

  it('leaves agent commands and their cursor alone', async () => {
    const w = await world()
    await w.entry({ title: '代码约定', pinned: true })
    await w.session({ sessionId: 'sess-1', knowledgeAt: hour(0) })
    const start = await w.mention({ agentCommand: '/compact' })
    expect(start.command).toBe('/compact')
    expect(notes(start.prompt.context)).toEqual([])
    expect(await w.cursor()).toEqual(hour(0))
  })
})
