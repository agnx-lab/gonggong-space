import { eq } from 'drizzle-orm'
import type { Ctx } from '../../context.js'
import { groups, type runs, users } from '../../db/schema.js'
import { HttpError } from '../../lib/errors.js'
import { requireAdmin } from '../groups/service.js'
import type { Layer, Scope } from '../mcp/service.js'
import { requireTeam } from '../teams/service.js'

export type Run = typeof runs.$inferSelect

export const LAYER: Record<Scope, string> = { platform: '平台层', team: '团队层', group: '群层' }

export async function teamOf(ctx: Ctx, run: Run) {
  const [g] = await ctx.db.select({ teamId: groups.teamId }).from(groups).where(eq(groups.id, run.groupId))
  return g!.teamId
}

/** The run's group's layer `scope` (platform has neither id). */
export async function layerOf(ctx: Ctx, run: Run, scope: Scope = 'group'): Promise<Layer> {
  if (scope === 'platform') return { scope, teamId: null, groupId: null }
  const teamId = await teamOf(ctx, run)
  return { scope, teamId, groupId: scope === 'group' ? run.groupId : null }
}

/** Whether the run's originator may change the layer on the web (as `eachLayer`). */
export const canEdit = (ctx: Ctx, run: Run, l: Layer) =>
  isLayerAdmin(ctx, run.originUserId, { ...l, groupId: l.scope === 'group' ? run.groupId : l.groupId })

/** Sysadmin for platform, team owner / admin for a team, group admin for a group. */
export async function isLayerAdmin(ctx: Ctx, userId: string, l: Layer) {
  try {
    if (l.scope === 'group') await requireAdmin(ctx, l.groupId!, userId)
    else if (l.scope === 'team') await requireTeam(ctx, userId, l.teamId!, 'admin')
    else {
      const [u] = await ctx.db.select().from(users).where(eq(users.id, userId))
      return u?.role === 'sysadmin' && !u.disabledAt
    }
    return true
  } catch (e) {
    if (e instanceof HttpError) return false
    throw e
  }
}

/** Who may change each layer for the run's originator. */
export async function editable(ctx: Ctx, run: Run) {
  const team = await teamOf(ctx, run)
  return {
    platform: await canEdit(ctx, run, { scope: 'platform', teamId: null, groupId: null }),
    team: await canEdit(ctx, run, { scope: 'team', teamId: team, groupId: null }),
    group: await canEdit(ctx, run, { scope: 'group', teamId: team, groupId: run.groupId }),
  }
}
