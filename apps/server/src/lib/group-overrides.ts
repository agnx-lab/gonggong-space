import { and, eq } from 'drizzle-orm'
import type { Ctx } from '../context.js'
import type { Db } from '../db/client.js'
import type { groupMcpOverrides, groupSkillOverrides } from '../db/schema.js'
import { audit } from './audit.js'

/** Inherited skills / MCP servers a group turned off for itself, by name. */
export type Overrides = typeof groupSkillOverrides | typeof groupMcpOverrides

export async function turnedOff(db: Pick<Db, 'select'>, table: Overrides, groupId: string) {
  const rows = await db.select({ name: table.name }).from(table).where(eq(table.groupId, groupId))
  return new Set(rows.map((r) => r.name))
}

/** Drops inherited rows the group turned off; its own group-layer rows are not affected. */
export const keptIn = (off: Set<string>) => (r: { scope: string; name: string }) =>
  r.scope === 'group' || !off.has(r.name)

/** Turns inherited `name` on or off for the group alone, audited as `action`; false when it already was. */
export async function setInherited(
  ctx: Ctx,
  table: Overrides,
  action: string,
  groupId: string,
  name: string,
  enabled: boolean,
  actorId: string,
  extra?: Record<string, unknown>,
) {
  const where = and(eq(table.groupId, groupId), eq(table.name, name))
  const changed = enabled
    ? await ctx.db.delete(table).where(where).returning({ name: table.name })
    : await ctx.db
        .insert(table)
        .values({ groupId, name, updatedBy: actorId, updatedAt: ctx.now() })
        .onConflictDoNothing()
        .returning({ name: table.name })
  if (!changed.length) return false
  await audit(ctx, {
    category: 'admin',
    actorUserId: actorId,
    groupId,
    action,
    detail: { name, enabled, ...extra },
  })
  return true
}
