import type { RunDto } from '@gonggong/protocol'
import { t } from '../../i18n'
import { stepText } from './mcp'

export interface RunIssue {
  /** error: the run failed or was voided; info: stopped on purpose or still waiting. */
  tone: 'error' | 'info'
  title: string
  /** The reason as the server or the agent reported it, in full. */
  detail: string
  hint?: string
}

const AGENT_ERROR = 'agent 异常：{error}'

/** Why a run did not (yet) do its work, from its status and its card step; null while it works or once it completed. */
export function runIssue(run: RunDto): RunIssue | null {
  const detail = stepText(run)
  switch (run.status) {
    case 'interrupted': {
      if (run.stepI18n?.key === AGENT_ERROR) {
        const error = run.stepI18n.params?.error
        return {
          tone: 'error',
          title: t('运行失败：agent 异常'),
          detail: error === undefined ? detail : typeof error === 'object' ? t.text(error) : String(error),
          hint: t('看完错误信息后重新 @ Bot 再试；反复出现时检查 Bot 所在机器上 agent 的登录、额度与网络。'),
        }
      }
      if (run.stoppedBy) return { tone: 'info', title: t('运行已停止'), detail }
      return {
        tone: 'error',
        title: t('运行已中断'),
        detail: detail || t('未记录原因'),
        hint: t('重新 @ Bot 再试一次；已改的文件见「改动」。'),
      }
    }
    case 'expired':
      return {
        tone: 'error',
        title: t('运行已作废'),
        detail: detail || t('未记录原因'),
        hint: t('确认 Bot 所在机器在线、daemon 正在运行后重新 @ Bot。'),
      }
    case 'forbidden':
      return { tone: 'error', title: t('未获准运行'), detail }
    case 'offline_wait':
      return {
        tone: 'info',
        title: t('等待 Bot 上线'),
        detail,
        hint: t('Bot 所在机器离线；超过 {n} 分钟仍未上线本轮作废。', { n: run.offlineWaitMin }),
      }
    case 'queued':
      return { tone: 'info', title: t('排队中'), detail: detail || t('等待开始') }
    default:
      return null
  }
}
