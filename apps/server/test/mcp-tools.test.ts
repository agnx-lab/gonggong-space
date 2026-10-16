import type { InheritedMcpDto, McpSecretCard, McpServer, McpServerDto, ToolCallRes } from '@gonggong/protocol'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { auditLogs, groupBots, mcpServers, messages, runs } from '../src/db/schema.js'
import { createMcp, enabledMcpServers } from '../src/modules/mcp/service.js'
import { createTestApp, type TestApp } from './support/app.js'
import { client } from './support/http.js'

let t: TestApp
beforeEach(async () => {
  t = await createTestApp({ now: () => new Date('2026-10-15T03:00:00Z') })
})
afterEach(() => t.close())

const PLATFORM = { scope: 'platform' as const, teamId: null, groupId: null }
const stdio = (name: string, env: Record<string, string> = {}) => ({
  transport: 'stdio' as const,
  name,
  command: 'npx',
  args: ['-y', `${name}-mcp`],
  env,
})

/** Wang owns the team, Li administers the group, Zhao is a plain member, Root a sysadmin in the group. */
async function world() {
  const wang = await t.seed.user({ name: '王磊' })
  const li = await t.seed.user({ name: '李建国' })
  const zhao = await t.seed.user({ name: '赵敏' })
  const root = await t.seed.user({ name: '根', role: 'sysadmin' })
  const { machine, token } = await t.seed.machine(wang.id)
  const bot = await t.seed.bot({ ownerId: wang.id, name: 'Claude', machineId: machine.id })
  const group = await t.seed.group({
    createdBy: li.id,
    name: '研发群',
    memberIds: [wang.id, zhao.id, root.id],
    botIds: [bot.id],
  })
  const runOf = async (user: { id: string }) => {
    const [m] = await t.db
      .insert(messages)
      .values({ groupId: group.id, kind: 'user', authorUserId: user.id, body: '@Claude 加个 MCP', meta: {} })
      .returning()
    const [r] = await t.db
      .insert(runs)
      .values({
        groupId: group.id,
        botId: bot.id,
        triggerMessageId: m!.id,
        originUserId: user.id,
        status: 'running',
      })
      .returning()
    const call = async (name: string, args: unknown = {}) => {
      const res = await t.app.inject({
        method: 'POST',
        url: `/api/daemon/runs/${r!.id}/tools/${name}`,
        headers: { authorization: `Bearer ${token}` },
        payload: { arguments: args },
      })
      return res.json<ToolCallRes>()
    }
    return { run: r!, call }
  }
  const as = async (u: { id: string }) => client(t, await t.seed.cookie(u.id))
  const platform = (name: string) =>
    createMcp(t.ctx, PLATFORM, { enabled: true, config: stdio(name) }, root.id, false)
  return { wang, li, zhao, root, bot, group, runOf, as, platform }
}

const names = async (groupId: string) => (await enabledMcpServers(t.db, groupId)).map((s) => s.name)

describe('mcp tools', () => {
  it('writes each layer only for whoever may on the web', async () => {
    const w = await world()
    const zhao = await w.runOf(w.zhao)
    expect(await zhao.call('mcp_create', { config: stdio('wiki') })).toMatchObject({
      isError: true,
      text: '发起人不是本群管理员，不能修改群层 MCP',
    })
    const li = await w.runOf(w.li)
    expect((await li.call('mcp_create', { config: stdio('wiki') })).text).toBe(
      '已新建群层 MCP「wiki」，下一轮新会话生效',
    )
    expect(await li.call('mcp_create', { layer: 'team', config: stdio('jira') })).toMatchObject({
      isError: true,
      text: '发起人不是本群所属团队的管理员，不能修改团队层 MCP',
    })
    expect(await li.call('mcp_create', { layer: 'platform', config: stdio('jira') })).toMatchObject({
      isError: true,
      text: '发起人不是系统管理员，不能修改平台层 MCP',
    })
    const wang = await w.runOf(w.wang)
    expect((await wang.call('mcp_create', { layer: 'team', config: stdio('jira') })).isError).toBe(false)
    const root = await w.runOf(w.root)
    expect((await root.call('mcp_create', { layer: 'platform', config: stdio('docs') })).isError).toBe(false)
    expect(await li.call('mcp_create', { config: stdio('gonggong') })).toMatchObject({ isError: true })
    expect(await li.call('mcp_create', { config: stdio('wiki') })).toMatchObject({
      isError: true,
      text: 'MCP 名称已存在',
    })

    const rows = await t.db.select().from(mcpServers)
    expect(rows.map((r) => [r.name, r.scope]).sort()).toEqual([
      ['docs', 'platform'],
      ['jira', 'team'],
      ['wiki', 'group'],
    ])
    expect(await names(w.group.id)).toEqual(['docs', 'jira', 'wiki'])
    expect((await zhao.call('mcp_list')).text.split('\n')).toEqual([
      '本群可见的 MCP（3 个，同名时群层覆盖团队层、团队层覆盖平台层）：',
      '- docs · 平台层 · stdio · 生效 · 发起人无权修改',
      '  启动：npx -y docs-mcp',
      '- jira · 团队层 · stdio · 生效 · 发起人无权修改',
      '  启动：npx -y jira-mcp',
      '- wiki · 群层 · stdio · 生效 · 发起人无权修改',
      '  启动：npx -y wiki-mcp',
    ])

    expect((await li.call('mcp_toggle', { name: 'wiki', enabled: false })).text).toBe(
      '已停用群层 MCP「wiki」，下一轮新会话生效',
    )
    expect(await names(w.group.id)).toEqual(['docs', 'jira'])
    expect((await li.call('mcp_delete', { name: 'wiki', forceNewSession: true })).text).toBe(
      '已删除群层 MCP「wiki」，相关 Bot 下一轮开新会话生效',
    )
    const [gb] = await t.db.select().from(groupBots).where(eq(groupBots.groupId, w.group.id))
    expect(gb!.newSessionReason).toBe('config_changed')
    const log = await t.db.select().from(auditLogs).where(eq(auditLogs.action, 'mcp.delete'))
    expect(log[0]!.detail).toMatchObject({ name: 'wiki', layer: 'group', botId: w.bot.id, runId: li.run.id })
  })

  it('keeps other teams out', async () => {
    const w = await world()
    const outsider = await t.seed.user({ name: '外人', teamId: null })
    const other = await t.seed.team({ ownerId: outsider.id, name: '别的团队' })
    const elsewhere = await t.seed.group({ createdBy: outsider.id, teamId: other.id })
    await (await w.runOf(w.wang)).call('mcp_create', { layer: 'team', config: stdio('jira') })
    expect(await names(elsewhere.id)).toEqual([])
    expect((await (await w.as(outsider)).get(`/api/teams/${w.group.teamId}/mcp`)).status).toBe(404)
  })

  it('takes secrets only as placeholders and masks them', async () => {
    const w = await world()
    const li = await w.runOf(w.li)
    expect(await li.call('mcp_create', { config: stdio('wiki', { TOKEN: 'sk-live-123' }) })).toMatchObject({
      isError: true,
      text: '密钥不能明文写在对话里：TOKEN 请写成占位符 ${secret:名称}，再用 mcp_secret_request 让发起人在卡片里填写',
    })
    expect(await t.db.select().from(mcpServers)).toEqual([])
    const made = await li.call('mcp_create', {
      config: stdio('wiki', { TOKEN: '${secret:TOKEN}', REGION: '${secret:REGION}' }),
    })
    expect(made.text).toBe(
      '已新建群层 MCP「wiki」，下一轮新会话生效；密钥待填写：TOKEN、REGION，请用 mcp_secret_request 请发起人填写',
    )
    expect((await li.call('mcp_get', { name: 'wiki' })).text.split('\n')).toEqual([
      '「wiki」· 群层 · stdio · 已启用',
      '  启动：npx -y wiki-mcp',
      '  env：TOKEN（待填写）、REGION（待填写）',
    ])
    const http = {
      transport: 'http',
      name: 'docs',
      url: 'https://mcp.corp/docs',
      headers: { Authorization: 'Bearer x' },
    }
    expect((await li.call('mcp_create', { config: http })).isError).toBe(true)
  })

  it('collects secrets on a card only the originator fills; the values never reach the agent or the logs', async () => {
    const w = await world()
    const li = await w.runOf(w.li)
    await li.call('mcp_create', { config: stdio('wiki', { TOKEN: '${secret:TOKEN}' }) })
    expect(await li.call('mcp_secret_request', { name: 'wiki', keys: ['NOPE'] })).toMatchObject({
      isError: true,
      text: '「wiki」的 env 里没有 NOPE，先用 mcp_update 加上（值写占位符 ${secret:名称}）',
    })
    expect(
      await (await w.runOf(w.zhao)).call('mcp_secret_request', { name: 'wiki', keys: ['TOKEN'] }),
    ).toMatchObject({ isError: true })
    const asked = await li.call('mcp_secret_request', {
      name: 'wiki',
      keys: ['TOKEN'],
      forceNewSession: true,
    })
    expect(asked.text).toContain('已在群里发出填写密钥卡片（TOKEN）')

    const [msg] = await t.db.select().from(messages).where(eq(messages.kind, 'event'))
    expect(msg!.body).toBe('Claude 请 李建国 填写 MCP「wiki」的密钥：TOKEN')
    const card = (msg!.meta as { mcpSecret: McpSecretCard }).mcpSecret
    expect(card).toMatchObject({ name: 'wiki', keys: ['TOKEN'], userId: w.li.id, filled: false })

    const url = `/api/mcp-secrets/${card.id}`
    expect((await (await w.as(w.zhao)).post(url, { values: { TOKEN: 'sk-live-123' } })).status).toBe(403)
    const li2 = await w.as(w.li)
    expect((await li2.post(url, { values: {} })).status).toBe(400)
    const filled = await li2.post<McpSecretCard>(url, { values: { TOKEN: 'sk-live-123' } })
    expect(filled.body).toMatchObject({ filled: true })
    expect((await li2.post(url, { values: { TOKEN: 'again' } })).status).toBe(409)

    const [server] = await enabledMcpServers(t.db, w.group.id)
    expect((server as Extract<McpServer, { transport: 'stdio' }>).env).toEqual({ TOKEN: 'sk-live-123' })
    expect((await li.call('mcp_get', { name: 'wiki' })).text).toContain('TOKEN（已填写）')
    const [after] = await t.db.select().from(messages).where(eq(messages.id, msg!.id))
    expect((after!.meta as { mcpSecret: McpSecretCard }).mcpSecret.filled).toBe(true)
    const everywhere = JSON.stringify([
      await t.db.select().from(messages),
      await t.db.select().from(auditLogs),
      (await li.call('mcp_list')).text,
    ])
    expect(everywhere).not.toContain('sk-live-123')
    const [set] = await t.db.select().from(auditLogs).where(eq(auditLogs.action, 'mcp.secret_set'))
    expect(set!.detail).toMatchObject({ name: 'wiki', keys: ['TOKEN'], forceNewSession: true })
    const [gb] = await t.db.select().from(groupBots).where(eq(groupBots.groupId, w.group.id))
    expect(gb!.newSessionReason).toBe('config_changed')

    expect(
      (
        await li.call('mcp_update', {
          name: 'wiki',
          config: stdio('wiki', { TOKEN: '${secret:TOKEN}', MORE: '${secret:MORE}' }),
        })
      ).text,
    ).toBe('已修改群层 MCP「wiki」，下一轮新会话生效；密钥待填写：MORE，请用 mcp_secret_request 请发起人填写')
    const [kept] = await enabledMcpServers(t.db, w.group.id)
    expect((kept as Extract<McpServer, { transport: 'stdio' }>).env.TOKEN).toBe('sk-live-123')
  })

  it('turns an inherited server off for this group only, from the tool or the settings', async () => {
    const w = await world()
    await w.platform('docs')
    await w.platform('jira')
    const sibling = await t.seed.group({ createdBy: w.li.id })
    const li = await w.runOf(w.li)
    expect((await li.call('mcp_toggle', { name: 'docs', enabled: false })).text).toBe(
      '已在本群关闭继承的平台层 MCP「docs」，下一轮新会话生效（不影响其他群）',
    )
    expect(await names(w.group.id)).toEqual(['jira'])
    expect(await names(sibling.id)).toEqual(['docs', 'jira'])
    expect((await li.call('mcp_list')).text).toContain('- docs · 平台层 · stdio · 本群已关闭 · 本群可开关')

    const url = `/api/groups/${w.group.id}/inherited-mcp`
    const api = await w.as(w.li)
    expect(
      (await api.get<InheritedMcpDto[]>(url)).body.map((m) => [m.config.name, m.scope, m.enabledInGroup]),
    ).toEqual([
      ['docs', 'platform', false],
      ['jira', 'platform', true],
    ])
    expect((await api.put(`${url}/docs`, { enabled: true })).status).toBe(200)
    expect((await api.put(`${url}/jira`, { enabled: false })).status).toBe(200)
    expect(await names(w.group.id)).toEqual(['docs'])
    expect((await api.put(`${url}/nope`, { enabled: false })).status).toBe(404)
    expect((await (await w.as(w.zhao)).put(`${url}/docs`, { enabled: false })).status).toBe(403)
    const log = await t.db.select().from(auditLogs).where(eq(auditLogs.action, 'mcp.group_toggle'))
    expect(log.map((l) => l.detail)).toEqual([
      { name: 'docs', enabled: false, botId: w.bot.id, runId: li.run.id },
      { name: 'docs', enabled: true },
      { name: 'jira', enabled: false },
    ])
  })
})

describe('group MCP for members', () => {
  it('lets plain members read the group and inherited servers without secrets, but not change them', async () => {
    const w = await world()
    const GROUP = { scope: 'group' as const, teamId: w.group.teamId, groupId: w.group.id }
    const wiki = await createMcp(
      t.ctx,
      GROUP,
      { enabled: false, config: stdio('wiki', { TOKEN: 'sk-live-123' }) },
      w.li.id,
      false,
    )
    const docs = {
      transport: 'http' as const,
      name: 'docs',
      url: 'https://mcp.corp/docs?key=sk-url-456',
      headers: { Authorization: 'Bearer sk-hdr-789' },
    }
    await createMcp(t.ctx, PLATFORM, { enabled: true, config: docs }, w.root.id, false)
    const base = `/api/groups/${w.group.id}/mcp`
    const inherited = `/api/groups/${w.group.id}/inherited-mcp`
    const zhao = await w.as(w.zhao)

    const own = await zhao.get<McpServerDto[]>(base)
    expect(own.status).toBe(200)
    expect(own.body.map((m) => [m.id, m.enabled, m.config])).toEqual([
      [wiki.id, false, { transport: 'stdio', name: 'wiki', command: '', args: [], env: {} }],
    ])
    const up = await zhao.get<InheritedMcpDto[]>(inherited)
    expect(up.body.map((m) => [m.config, m.scope, m.enabledInGroup])).toEqual([
      [{ transport: 'http', name: 'docs', url: '', headers: {} }, 'platform', true],
    ])
    expect(JSON.stringify([own.body, up.body])).not.toMatch(/sk-|npx|mcp\.corp/)

    const li = await w.as(w.li)
    expect((await li.get<McpServerDto[]>(base)).body[0]!.config).toEqual(
      stdio('wiki', { TOKEN: 'sk-live-123' }),
    )
    expect((await li.get<InheritedMcpDto[]>(inherited)).body[0]!.config).toEqual(docs)

    expect((await zhao.post(base, { enabled: true, config: stdio('x') })).status).toBe(403)
    expect((await zhao.patch(`${base}/${wiki.id}`, { enabled: true, config: stdio('wiki') })).status).toBe(
      403,
    )
    expect((await zhao.del(`${base}/${wiki.id}`)).status).toBe(403)
    expect((await zhao.put(`${inherited}/docs`, { enabled: false })).status).toBe(403)
    const outsider = await w.as(await t.seed.user({ name: '路人' }))
    expect((await outsider.get(base)).status).toBe(404)
    expect((await outsider.get(inherited)).status).toBe(404)
  })
})
