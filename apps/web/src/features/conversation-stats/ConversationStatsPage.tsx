import { useState } from 'react'
import { t } from '../../i18n'
import { AdminPage } from '../admin/AdminPage'
import { TeamFilter } from '../admin/TeamFilter'
import { ConversationStatsPanel } from './ConversationStatsPanel'

/** 管理后台 · 会话统计: every team, or one picked. */
export function ConversationStatsPage() {
  const [teamId, setTeamId] = useState('')
  return (
    <AdminPage
      title={t('会话统计')}
      desc={t('全站会话、消息与运行概览，可按会话、成员、Bot、团队查看明细。')}
      actions={<TeamFilter value={teamId} onChange={setTeamId} />}
    >
      <ConversationStatsPanel base="/admin/conversation-stats" teamId={teamId} />
    </AdminPage>
  )
}
