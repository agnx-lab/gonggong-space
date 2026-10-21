import type { BotDto, GitActionKind, GitOperationDto } from '@gonggong/protocol'
import { useSession } from '../../app/session'
import { t } from '../../i18n'
import { toast } from '../../ui'

export const ACTION_LABEL: Record<GitActionKind, string> = {
  checkout: t('切换分支'),
  pull: t('拉取'),
  commit: t('提交'),
  push: t('推送'),
}

/** The POST answer and the realtime event both report the end of an operation: toast it once. */
const told = new Set<string>()

/** Tells the requester how their operation ended. */
export function gitOperationSettled(op: GitOperationDto, bots: Pick<BotDto, 'id' | 'name'>[]) {
  if (op.requestedBy.id !== useSession.getState().user?.id || told.has(op.id)) return
  const bot = bots.find((b) => b.id === op.botId)?.name ?? 'Bot'
  const action = ACTION_LABEL[op.action]
  if (op.status === 'succeeded')
    toast({ type: 'success', message: t('{bot}：{action}完成', { bot, action }) })
  else if (op.status === 'failed')
    toast({ type: 'error', title: t('{bot}：{action}失败', { bot, action }), message: op.error ?? '' })
  else if (op.status === 'rejected')
    toast({ type: 'warning', message: t('{bot} 的主人拒绝了{action}申请', { bot, action }) })
  else return
  told.add(op.id)
}
