import { named } from '../../lib/lazy'

export const BotDialog = named(() => import('./BotDialog'), 'BotDialog')
export const BotPage = named(() => import('./BotPage'), 'BotPage')
export const NewBotDialog = named(() => import('./NewBotDialog'), 'NewBotDialog')
