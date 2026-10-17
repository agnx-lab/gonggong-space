import type { TeamDto } from '@gonggong/protocol'
import { Avatar } from '../../ui'

/** An uploaded image's URL; `avatar` otherwise holds a glyph. */
export const teamImage = (team: Pick<TeamDto, 'avatar'>) =>
  team.avatar?.startsWith('/api/') ? team.avatar : undefined

export function TeamAvatar({ team, size }: { team: Pick<TeamDto, 'name' | 'avatar'>; size: number }) {
  const image = teamImage(team)
  return <Avatar name={image ? team.name : team.avatar || team.name} src={image} shape="square" size={size} />
}
