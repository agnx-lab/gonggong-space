import type { ApprovalDto, QuestionSetDto, RunDto } from '@gonggong/protocol'
import { useMemo, useState } from 'react'
import { useWorkspace } from '../../app/workspace'
import { t } from '../../i18n'
import { Button, Icon } from '../../ui'
import { BotAvatar } from '../bots/avatars'
import { ApprovalCard } from '../runs/ApprovalBlock'
import { QuestionCard } from '../runs/QuestionBlock'
import './pending-dock.css'

type Item =
  | { key: string; run: RunDto; at: string; approval: ApprovalDto }
  | { key: string; run: RunDto; at: string; set: QuestionSetDto }

/**
 * Pinned above the composer: the group's pending approvals and questions, decidable in place, so a card pushed up by
 * new messages needs no scrolling back. Several fold into 待处理 N 项; the cards themselves gate who may act.
 */
export function PendingDock({ runs, onLocate }: { runs: RunDto[]; onLocate: (run: RunDto) => void }) {
  const [open, setOpen] = useState(false)
  const items = useMemo(
    () =>
      runs
        .flatMap((run): Item[] => [
          ...run.approvals
            .filter((a) => a.status === 'pending')
            .map((approval) => ({ key: approval.id, run, at: approval.createdAt, approval })),
          ...run.questions
            .filter((s) => s.status === 'pending')
            .map((set) => ({ key: set.id, run, at: set.createdAt, set })),
        ])
        .sort((a, b) => a.at.localeCompare(b.at)),
    [runs],
  )
  if (!items.length) return null
  const single = items.length === 1
  return (
    <div className="pd-dock" data-testid="pending-dock">
      {single ? null : (
        <button type="button" className="pd-dock__head" aria-expanded={open} onClick={() => setOpen(!open)}>
          <Icon name="bell" size={14} />
          <span>{t('待处理 {n} 项', { n: items.length })}</span>
          <Icon name="chevron-up" size={12} className="pd-dock__chevron" />
        </button>
      )}
      {single || open ? (
        <ul className="pd-dock__list">
          {items.map((it) => (
            <PendingItem key={it.key} item={it} onLocate={onLocate} />
          ))}
        </ul>
      ) : null}
    </div>
  )
}

function PendingItem({ item, onLocate }: { item: Item; onLocate: (run: RunDto) => void }) {
  const name = useWorkspace((s) => s.bots.find((b) => b.id === item.run.botId)?.name ?? 'Bot')
  return (
    <li className="pd-item" data-testid="pending-item">
      <div className="pd-item__head">
        <BotAvatar id={item.run.botId} name={name} size={18} />
        <span className="pd-item__name">{name}</span>
        <Button size="small" variant="plain" icon="arrow-up" onClick={() => onLocate(item.run)}>
          {t('定位')}
        </Button>
      </div>
      {'approval' in item ? (
        <ApprovalCard run={item.run} approval={item.approval} />
      ) : (
        <QuestionCard run={item.run} set={item.set} />
      )}
    </li>
  )
}
