import { type AgentKind, fieldsFor } from '@gonggong/protocol'
import { Button, GroupBox, GroupRow, Icon } from '@web/ui'
import { t } from '../i18n'
import { ipc, type Providers } from '../ipc'
import { fail } from '../lib/ui'
import { agentSettingRows } from './settings'

/** This machine's Agent 设置 of one agent, read-only: they are edited on the Web. */
export function AgentSettingsBox({ agent, data }: { agent: AgentKind; data: Providers }) {
  if (!fieldsFor(agent, 'agent').length) return null
  const settings = data.agentSettings?.[agent]
  const inherit = settings?.inheritCli ?? true
  const rows = agentSettingRows(agent, settings?.values ?? {})
  const conflicts = inherit ? (data.cli?.[agent]?.conflicts ?? []) : []

  return (
    <GroupBox>
      <div className="dk-row">
        <span className="dk-row__main">
          <span className="dk-strong">{t('Agent 设置')}</span>
          <span className="dk-sub">{t('本机默认，新会话生效；Bot 可在 Web 端覆盖部分项')}</span>
        </span>
        <Button onClick={() => ipc.openProvidersInWeb().catch(fail)}>{t('在 Web 中管理')}</Button>
      </div>
      {rows.length ? (
        rows.map((r) => <GroupRow key={r.id} label={r.label} wideValue value={r.value} />)
      ) : (
        <div className="dk-row">
          <span className="dk-row__main dk-sub">{t('未设置，使用 Claude Code 默认值')}</span>
        </div>
      )}
      <GroupRow
        label={t('继承本机 CLI 配置')}
        description={t('加载 ~/.claude 下的个人配置、CLAUDE.md、记忆、hooks 与 Skill')}
        wideValue
        value={inherit ? t('是') : t('否')}
      />
      {conflicts.length ? (
        <div className="dk-row dk-warn">
          <Icon name="warning" size={16} color="var(--system-orange)" />
          <span className="dk-row__main">
            {t('本机 CLI 配置设置了 {list}，会盖过共工的对应设置', { list: conflicts.join(t('、')) })}
          </span>
        </div>
      ) : null}
    </GroupBox>
  )
}
