import type { CreationCard as Card, MessageDto } from '@gonggong/protocol'
import { useState } from 'react'
import { t } from '../../i18n'
import { attempt } from '../../lib/errors'
import { Button } from '../../ui'
import { MessageAttachments } from '../attachments/MessageAttachments'
import { draftOfCard, requestOf } from './model'
import { PluginTile } from './PluginTile'
import { createInGroup, openCreation, useEnabledPlugins } from './store'
import './plugins.css'

/**
 * The 创作请求 card (prototype #result): a summary of what was asked instead of the agent-facing body, the full
 * parameters on demand, and 再来一版 / 改参数重做… while the plugin is still on in the group.
 */
export function CreationCardView({ m, card }: { m: MessageDto; card: Card }) {
  const [all, setAll] = useState(false)
  const [busy, setBusy] = useState(false)
  const plugin = useEnabledPlugins(m.groupId).find((p) => p.id === card.pluginId)
  const draft = plugin && draftOfCard(card, plugin)
  const [head, ...rest] = card.inputs
  const summary = [card.template?.title, card.designSystem?.title].filter(Boolean).join(' · ')
  const files = m.attachments.length
  const again = async () => {
    const req = draft && requestOf(draft, [])
    if (!req) return
    setBusy(true)
    await attempt(() => createInGroup(m.groupId, req))
    setBusy(false)
  }
  return (
    <div className="plg-req" data-testid="creation-card">
      <div className="plg-req__head">
        <PluginTile m={card} size={22} />
        <b>{t('创作请求 · {title}', { title: card.pluginTitle })}</b>
        <span className="plg-req__to">{t('已交给 @{bot}', { bot: card.botName })}</span>
      </div>
      <div className="plg-req__body">
        <div className="plg-req__line">
          {[summary, head ? `「${head.value}」` : ''].filter(Boolean).join(' ·')}
        </div>
        {all ? (
          <div className="plg-req__all">
            {card.inputs.map((i) => (
              <div key={i.label}>{`${i.label}：${i.value}`}</div>
            ))}
            <div>{card.directions ? t('先出视觉方向：是') : t('先出视觉方向：否')}</div>
            <MessageAttachments list={m.attachments} from={m.authorName} />
          </div>
        ) : (
          <div className="plg-req__muted">
            {[
              rest.length ? t('另有 {n} 项参数', { n: rest.length }) : '',
              files ? t('{n} 个参考附件', { n: files }) : '',
            ]
              .filter(Boolean)
              .join(' · ')}
            <button type="button" className="plg-req__more" onClick={() => setAll(true)}>
              {t('查看全部')}
            </button>
          </div>
        )}
      </div>
      <div className="plg-req__foot">
        <Button
          size="small"
          disabled={!draft || busy}
          title={draft ? undefined : t('这个插件已在本群停用')}
          onClick={() => void again()}
        >
          {t('再来一版')}
        </Button>
        <Button
          size="small"
          disabled={!draft}
          onClick={() => draft && openCreation({ groupId: m.groupId, draft, step: 2 })}
        >
          {t('改参数重做…')}
        </Button>
        <span className="plg-req__ver">
          {t('插件 {name} {version}', {
            name: plugin?.manifest.name ?? card.pluginTitle,
            version: card.pluginVersion,
          })}
        </span>
      </div>
    </div>
  )
}
