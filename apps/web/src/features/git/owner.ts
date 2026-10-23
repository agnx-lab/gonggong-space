import { useSession } from '../../app/session'
import { useWorkspace } from '../../app/workspace'

/** Anyone but the bot's owner only requests git actions, which the owner then approves. */
export function useOwner(botId: string) {
  const me = useSession((s) => s.user?.id)
  const bot = useWorkspace((s) => s.bots.find((b) => b.id === botId))
  return { owner: !!me && bot?.ownerId === me, ownerName: bot?.ownerName ?? '' }
}
