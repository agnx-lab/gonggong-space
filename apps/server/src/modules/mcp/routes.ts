import { FillMcpSecretReq, type InheritedMcpDto, SaveMcpReq, ToggleInheritedReq } from '@gonggong/protocol'
import { asc } from 'drizzle-orm'
import type { FastifyInstance, FastifyRequest } from 'fastify'
import type { Ctx } from '../../context.js'
import { mcpServers } from '../../db/schema.js'
import { fail } from '../../lib/errors.js'
import { idParam } from '../../lib/ids.js'
import { requireSysadmin, requireUser } from '../auth/session.js'
import { requireAdmin } from '../groups/service.js'
import { requireTeam } from '../teams/service.js'
import { fillSecrets } from './secrets.js'
import {
  createMcp,
  deleteMcp,
  inheritedMcp,
  inLayer,
  type Layer,
  mcpDto,
  setInheritedMcp,
  updateMcp,
} from './service.js'

type Params = { Params: { id?: string; mcpId?: string } }

/** The same list / create / update / delete under `base` for each layer; `authorize` resolves the caller's layer. */
function layerRoutes(ctx: Ctx, app: FastifyInstance, base: string, authorize: Authorize) {
  app.get<Params>(base, async (req) => {
    const { layer } = await authorize(req)
    return (await ctx.db.select().from(mcpServers).where(inLayer(layer)).orderBy(asc(mcpServers.name))).map(
      mcpDto,
    )
  })

  app.post<Params>(base, async (req, reply) => {
    const { actorId, layer } = await authorize(req)
    const body = SaveMcpReq.parse(req.body)
    const row = await createMcp(ctx, layer, body, actorId, body.forceNewSession)
    return reply.status(201).send(mcpDto(row))
  })

  app.patch<Params>(`${base}/:mcpId`, async (req) => {
    const { actorId, layer } = await authorize(req)
    const id = idParam(req.params.mcpId ?? '', 'MCP 不存在')
    const body = SaveMcpReq.parse(req.body)
    return mcpDto(await updateMcp(ctx, layer, id, body, actorId, body.forceNewSession))
  })

  app.delete<Params & { Querystring: { forceNewSession?: string } }>(`${base}/:mcpId`, async (req, reply) => {
    const { actorId, layer } = await authorize(req)
    const id = idParam(req.params.mcpId ?? '', 'MCP 不存在')
    await deleteMcp(ctx, layer, id, actorId, req.query.forceNewSession === 'true')
    return reply.status(204).send()
  })
}

/** Platform / team servers in effect for a group, which its admins turn on or off for the group alone. */
function inheritedRoutes(ctx: Ctx, app: FastifyInstance) {
  type P = { Params: { id: string; name?: string } }
  const list = async (groupId: string): Promise<InheritedMcpDto[]> =>
    (await inheritedMcp(ctx.db, groupId)).map(({ row, enabledInGroup }) => ({
      ...mcpDto(row),
      scope: row.scope as InheritedMcpDto['scope'],
      enabledInGroup,
    }))

  app.get<P>('/api/groups/:id/inherited-mcp', async (req) => {
    const me = await requireUser(ctx, req)
    const { group } = await requireAdmin(ctx, req.params.id, me.id)
    return list(group.id)
  })

  app.put<P>('/api/groups/:id/inherited-mcp/:name', async (req) => {
    const me = await requireUser(ctx, req)
    const { group } = await requireAdmin(ctx, req.params.id, me.id)
    const { enabled } = ToggleInheritedReq.parse(req.body)
    const found = (await list(group.id)).find((s) => s.config.name === req.params.name)
    if (!found) return fail('not_found', 'MCP 不存在')
    await setInheritedMcp(ctx, group.id, found.config.name, enabled, me.id)
    return { ...found, enabledInGroup: enabled }
  })
}

export type Authorize = (
  req: FastifyRequest<{ Params: { id?: string } }>,
) => Promise<{ actorId: string; layer: Layer }>

/** Platform layer for sysadmins, team layer for team admins, group layer for group admins (plan D8). */
export function eachLayer(ctx: Ctx, segment: string, routes: (base: string, authorize: Authorize) => void) {
  routes(`/api/admin/${segment}`, async (req) => ({
    actorId: (await requireSysadmin(ctx, req)).id,
    layer: { scope: 'platform', teamId: null, groupId: null },
  }))
  routes(`/api/teams/:id/${segment}`, async (req) => {
    const me = await requireUser(ctx, req)
    const { team } = await requireTeam(ctx, me.id, req.params.id ?? '', 'admin')
    return { actorId: me.id, layer: { scope: 'team', teamId: team.id, groupId: null } }
  })
  routes(`/api/groups/:id/${segment}`, async (req) => {
    const me = await requireUser(ctx, req)
    const { group } = await requireAdmin(ctx, req.params.id ?? '', me.id)
    return { actorId: me.id, layer: { scope: 'group', teamId: group.teamId, groupId: group.id } }
  })
}

export function mcpRoutes(ctx: Ctx) {
  return async (app: FastifyInstance) => {
    eachLayer(ctx, 'mcp', (base, authorize) => layerRoutes(ctx, app, base, authorize))
    inheritedRoutes(ctx, app)
    app.post<{ Params: { id: string } }>('/api/mcp-secrets/:id', async (req) => {
      const me = await requireUser(ctx, req)
      const { values } = FillMcpSecretReq.parse(req.body)
      return fillSecrets(ctx, me.id, idParam(req.params.id, '密钥请求不存在'), values)
    })
  }
}
