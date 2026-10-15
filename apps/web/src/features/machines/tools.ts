import { compareVersions } from '@gonggong/protocol'

export const hasUpdate = (t: { version?: string | null; latest?: string | null }) =>
  !!(t.latest && t.version && compareVersions(t.latest, t.version) > 0)

/** Managed, or installed by the user in a way the daemon knows how to upgrade (brew, claude update, npm). */
export const canUpgrade = (t: {
  managed: boolean
  upgradeCommand?: string | null
  version?: string | null
  latest?: string | null
}) => (t.managed || !!t.upgradeCommand) && hasUpdate(t)
