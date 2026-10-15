import { z } from 'zod'
import { RunStatus } from './common.js'

/** Run statuses a conversation shows as at work, queued included. */
export const LIVE_RUN_STATUSES: RunStatus[] = ['queued', 'running', 'awaiting_approval', 'awaiting_answer']

/** A run of the group not ended yet, as the viewer's conversation list shows it. */
export const LiveRun = z.object({
  id: z.string(),
  botId: z.string(),
  status: RunStatus,
  /** The viewer has to act: decide its pending approval (bot owner), or answer its question (trigger user or owner). */
  needsMe: z.boolean(),
  /** What it waits on: the pending approval's command (else its title), or the first pending question. */
  title: z.string().optional(),
})
export type LiveRun = z.infer<typeof LiveRun>

const firstLine = (s: string) => s.trim().split('\n')[0]?.trim() ?? ''

/** The viewer's (`me`) view of a live run; `ownerId` is its bot's owner. */
export function liveRunOf(
  run: {
    id: string
    botId: string
    status: RunStatus
    originUserId: string
    approvals: { status: string; title: string; detail: string }[]
    questions: { status: string; questions: { title: string }[] }[]
  },
  me: string,
  ownerId: string | null,
): LiveRun {
  const base = { id: run.id, botId: run.botId, status: run.status }
  const approval = run.approvals.find((a) => a.status === 'pending')
  if (run.status === 'awaiting_approval' && approval)
    return { ...base, needsMe: me === ownerId, title: firstLine(approval.detail) || approval.title }
  const question = run.questions.find((q) => q.status === 'pending')
  if (run.status === 'awaiting_answer' && question)
    return {
      ...base,
      needsMe: me === run.originUserId || me === ownerId,
      ...(question.questions[0] && { title: question.questions[0].title }),
    }
  return { ...base, needsMe: false }
}
