import type { GONGGONG_TOOLS, McpServer } from '@gonggong/protocol'
import { eq } from 'drizzle-orm'
import type { z } from 'zod'
import type { Ctx } from '../../context.js'
import { mcpServers } from '../../db/schema.js'
import { keptIn } from '../../lib/group-overrides.js'
import { describeMasked, missingRefs, nonRefs } from '../mcp/secrets.js'
import {
  createMcp,
  deleteMcp,
  findMcp,
  inheritedMcp,
  type Layer,
  type McpRow,
  mcpTurnedOff,
  mergeMcp,
  RANK,
  type Scope,
  setInheritedMcp,
  updateMcp,
  visibleIn,
} from '../mcp/service.js'
import { resolveSecrets } from '../secrets/resolve.js'
import { canEdit, editable, LAYER, layerOf, type Run } from './layers.js'
import { asTool, refuse, type ToolOutput } from './service.js'

type Args<N extends keyof typeof GONGGONG_TOOLS> = z.infer<(typeof GONGGONG_TOOLS)[N]['input']>

const DENIED: Record<Scope, string> = {
  group: '发起人不是本群管理员，不能修改群层 MCP',
  team: '发起人不是本群所属团队的管理员，不能修改团队层 MCP',
  platform: '发起人不是系统管理员，不能修改平台层 MCP',
}

/** The originator's writable layer, refused with a correctable reason. */
async function writable(ctx: Ctx, run: Run, scope: Scope = 'group') {
  const l = await layerOf(ctx, run, scope)
  if (!(await canEdit(ctx, run, l))) refuse(DENIED[scope])
  return l
}

async function named(ctx: Ctx, l: Layer, name: string) {
  return (
    (await findMcp(ctx, l, eq(mcpServers.name, name))) ??
    refuse(`本群没有名为「${name}」的${LAYER[l.scope]} MCP，请用 mcp_list 查看`)
  )
}

/** Secrets only as references: a value in plain text would end up in the chat, the prompt and the logs. */
function refsOnly(c: McpServer) {
  const plain = nonRefs(c)
  if (plain.length)
    refuse(
      `密钥不能明文写在对话里：${plain.join('、')} 请写成 \${secret:名称} 引用密钥（名称用大写字母、数字和下划线，secret_list 列出已有的）`,
    )
}

/** Values this run would get, for what is ready or missing. */
const envOf = async (ctx: Ctx, run: Run) => (await resolveSecrets(ctx.db, run, ctx.now())).env

const audited = (run: Run) => ({ botId: run.botId, runId: run.id })
const effect = (force?: boolean) => (force ? '相关 Bot 下一轮开新会话生效' : '下一轮新会话生效')

const pendingNote = (c: McpServer, env: Record<string, string>) => {
  const names = missingRefs(c, env)
  return names.length ? `；缺密钥：${names.join('、')}，补齐前不会下发，请用 secret_request 请人填写` : ''
}

const visible = (ctx: Ctx, run: Run) => ctx.db.select().from(mcpServers).where(visibleIn(ctx.db, run.groupId))

export async function mcpList(ctx: Ctx, run: Run): Promise<ToolOutput> {
  const rows = await visible(ctx, run)
  if (!rows.length) return { text: '本群还没有 MCP', groups: [] }
  const off = await mcpTurnedOff(ctx.db, run.groupId)
  const winner = new Map(mergeMcp(rows.filter((r) => r.enabled && keptIn(off)(r))).map((r) => [r.name, r]))
  const edit = await editable(ctx, run)
  const env = await envOf(ctx, run)
  const lines = rows
    .sort((a, b) => a.name.localeCompare(b.name) || RANK[b.scope as Scope] - RANK[a.scope as Scope])
    .flatMap((r) => {
      const scope = r.scope as Scope
      const over = winner.get(r.name)
      const state = !r.enabled
        ? '已停用'
        : !keptIn(off)(r)
          ? '本群已关闭'
          : over && over !== r
            ? `被${LAYER[over.scope as Scope]}同名 MCP 覆盖`
            : '生效'
      const right = edit[scope] ? '可修改' : scope !== 'group' && edit.group ? '本群可开关' : '发起人无权修改'
      const c = r.config as McpServer
      const missing = missingRefs(c, env)
      const lack = missing.length ? ` · 缺密钥 ${missing.join('、')}（本轮不下发）` : ''
      return [
        `- ${r.name} · ${LAYER[scope]} · ${c.transport} · ${state}${lack} · ${right}`,
        ...describeMasked(c, env),
      ]
    })
  return {
    text: [`本群可见的 MCP（${rows.length} 个，同名时群层覆盖团队层、团队层覆盖平台层）：`, ...lines].join(
      '\n',
    ),
    groups: [],
  }
}

export async function mcpGet(ctx: Ctx, run: Run, a: Args<'mcp_get'>): Promise<ToolOutput> {
  let row: McpRow
  if (a.layer) row = await named(ctx, await layerOf(ctx, run, a.layer), a.name)
  else {
    const rows = (await visible(ctx, run)).filter((r) => r.name === a.name)
    const off = await mcpTurnedOff(ctx.db, run.groupId)
    row =
      mergeMcp(rows.filter((r) => r.enabled && keptIn(off)(r)))[0] ??
      mergeMcp(rows)[0] ??
      refuse(`本群没有名为「${a.name}」的 MCP，请用 mcp_list 查看`)
  }
  const c = row.config as McpServer
  return {
    text: [
      `「${row.name}」· ${LAYER[row.scope as Scope]} · ${c.transport} · ${row.enabled ? '已启用' : '已停用'}`,
      ...describeMasked(c, await envOf(ctx, run)),
    ].join('\n'),
    groups: [],
  }
}

export async function mcpCreate(ctx: Ctx, run: Run, a: Args<'mcp_create'>): Promise<ToolOutput> {
  const l = await writable(ctx, run, a.layer)
  refsOnly(a.config)
  const force = a.forceNewSession ?? false
  const row = await asTool(() =>
    createMcp(
      ctx,
      l,
      { enabled: a.enabled ?? true, config: a.config },
      run.originUserId,
      force,
      audited(run),
    ),
  )
  return {
    text: `已新建${LAYER[l.scope]} MCP「${row.name}」，${effect(force)}${pendingNote(row.config as McpServer, await envOf(ctx, run))}`,
    groups: [],
  }
}

export async function mcpUpdate(ctx: Ctx, run: Run, a: Args<'mcp_update'>): Promise<ToolOutput> {
  const l = await writable(ctx, run, a.layer)
  const current = await named(ctx, l, a.name)
  refsOnly(a.config)
  const config = a.config
  const force = a.forceNewSession ?? false
  const row = await asTool(() =>
    updateMcp(
      ctx,
      l,
      current.id,
      { enabled: current.enabled, config },
      run.originUserId,
      force,
      audited(run),
    ),
  )
  const renamed = row.name === a.name ? '' : `（原名「${a.name}」）`
  return {
    text: `已修改${LAYER[l.scope]} MCP「${row.name}」${renamed}，${effect(force)}${pendingNote(row.config as McpServer, await envOf(ctx, run))}`,
    groups: [],
  }
}

export async function mcpToggle(ctx: Ctx, run: Run, a: Args<'mcp_toggle'>): Promise<ToolOutput> {
  const l = await writable(ctx, run, a.layer)
  if (l.scope === 'group' && !(await findMcp(ctx, l, eq(mcpServers.name, a.name))))
    return toggleInherited(ctx, run, a)
  const current = await named(ctx, l, a.name)
  const state = a.enabled ? '启用' : '停用'
  if (current.enabled === a.enabled)
    return { text: `${LAYER[l.scope]} MCP「${a.name}」已是${state}状态`, groups: [] }
  const force = a.forceNewSession ?? false
  const s = { enabled: a.enabled, config: current.config as McpServer }
  await updateMcp(ctx, l, current.id, s, run.originUserId, force, audited(run))
  return { text: `已${state}${LAYER[l.scope]} MCP「${a.name}」，${effect(force)}`, groups: [] }
}

/** No group server of that name: turns the inherited one on or off for this group alone. */
async function toggleInherited(ctx: Ctx, run: Run, a: Args<'mcp_toggle'>): Promise<ToolOutput> {
  const found =
    (await inheritedMcp(ctx.db, run.groupId)).find((r) => r.row.name === a.name) ??
    refuse(`本群没有名为「${a.name}」的群层 MCP，也没有继承的同名 MCP，请用 mcp_list 查看`)
  const what = `继承的${LAYER[found.row.scope as Scope]} MCP「${a.name}」`
  if (!(await setInheritedMcp(ctx, run.groupId, a.name, a.enabled, run.originUserId, audited(run))))
    return { text: `${what}在本群已是${a.enabled ? '启用' : '关闭'}状态`, groups: [] }
  return {
    text: a.enabled
      ? `已在本群重新启用${what}，下一轮新会话生效`
      : `已在本群关闭${what}，下一轮新会话生效（不影响其他群）`,
    groups: [],
  }
}

export async function mcpDelete(ctx: Ctx, run: Run, a: Args<'mcp_delete'>): Promise<ToolOutput> {
  const l = await writable(ctx, run, a.layer)
  const current = await named(ctx, l, a.name)
  const force = a.forceNewSession ?? false
  await deleteMcp(ctx, l, current.id, run.originUserId, force, audited(run))
  return { text: `已删除${LAYER[l.scope]} MCP「${a.name}」，${effect(force)}`, groups: [] }
}
