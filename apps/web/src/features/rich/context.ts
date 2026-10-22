import type { MessageDto } from '@gonggong/protocol'
import { createContext } from 'react'

/** The bot reply the Markdown belongs to: its blocks may act as the viewer (answer actions, widget replies). */
export const RichMessage = createContext<MessageDto | null>(null)
