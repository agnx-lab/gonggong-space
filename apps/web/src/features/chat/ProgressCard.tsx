import type { ProgressCard as Card, ProgressStageStatus } from '@gonggong/protocol'
import { memo } from 'react'
import { useWorkspace } from '../../app/workspace'
import { t } from '../../i18n'
import { Icon, type IconName, ProgressIndicator, Tag, type TagTone } from '../../ui'
import './progress-card.css'

const STATUS: Record<Card['status'], [string, TagTone]> = {
  running: [t('进行中'), 'blue'],
  done: [t('已完成'), 'green'],
  failed: [t('失败'), 'red'],
}

const STAGE_ICON: Record<ProgressStageStatus, IconName> = {
  pending: 'clock',
  running: 'arrow-clockwise',
  done: 'checkmark-circle',
  failed: 'xmark-circle',
  skipped: 'minus',
}

/** A bot's progress card (progress_card), e.g. a build and deploy; updated in place as the bot polls. */
export const ProgressCard = memo(function ProgressCard({ card }: { card: Card }) {
  const bot = useWorkspace((s) => s.bots.find((b) => b.id === card.botId)?.name ?? 'Bot')
  const [label, tone] = STATUS[card.status]
  return (
    <div className="pg-card" data-testid="progress-card" data-status={card.status}>
      <div className="pg-card__head">
        <Icon name="bolt" size={14} />
        <span className="pg-card__title">{card.title}</span>
        <Tag tone={tone}>{label}</Tag>
      </div>
      <span className="pg-card__bot">{bot}</span>
      <ol className="pg-stages">
        {card.stages.map((s, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: stages are replaced whole and may repeat a name
          <li key={i} className="pg-stage" data-testid="progress-stage" data-status={s.status}>
            <Icon name={STAGE_ICON[s.status]} size={12} />
            {s.name}
          </li>
        ))}
      </ol>
      {card.percent === null ? null : <ProgressIndicator value={card.percent} aria-label={card.title} />}
      {card.detail ? <span className="pg-card__detail">{card.detail}</span> : null}
      {card.link ? (
        <a className="pg-card__link" href={card.link.url} target="_blank" rel="noreferrer">
          {card.link.label}
        </a>
      ) : null}
    </div>
  )
})
