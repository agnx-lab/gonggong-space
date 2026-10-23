import type { ApprovalDto, QuestionSetDto, RunDto } from '@gonggong/protocol'
import { type RefObject, useEffect, useMemo, useState } from 'react'
import { useSession } from '../../app/session'
import { useWorkspace } from '../../app/workspace'
import { t } from '../../i18n'
import { Icon } from '../../ui'
import { BotAvatar } from '../bots/avatars'
import './pending-dock.css'

type Item =
  | { key: string; run: RunDto; at: string; approval: ApprovalDto }
  | { key: string; run: RunDto; at: string; set: QuestionSetDto }

/**
 * Above the composer: an index of the approvals and questions *I* may decide whose card is out of view. Each entry
 * scrolls to its card in the timeline, where it is answered; the forms themselves stay there.
 */
export function PendingDock({
  runs,
  root,
  onLocate,
}: {
  runs: RunDto[]
  root?: RefObject<HTMLElement | null>
  onLocate: (run: RunDto) => void
}) {
  const me = useSession((s) => s.user?.id)
  const bots = useWorkspace((s) => s.bots)
  const [visible, setVisible] = useState<Record<string, boolean> | null>(() => (root ? null : {}))
  const candidates = useMemo(() => {
    const owner = (run: RunDto) => bots.find((b) => b.id === run.botId)?.ownerId
    return runs
      .flatMap((run): Item[] => [
        ...(me && me === owner(run) ? run.approvals : [])
          .filter((a) => a.status === 'pending')
          .map((approval) => ({ key: approval.id, run, at: approval.createdAt, approval })),
        ...(me && (me === run.originUserId || me === owner(run)) ? run.questions : [])
          .filter((s) => s.status === 'pending')
          .map((set) => ({ key: set.id, run, at: set.createdAt, set })),
      ])
      .sort((a, b) => a.at.localeCompare(b.at))
  }, [runs, me, bots])
  const keys = candidates.map((item) => item.key).join('\n')
  useEffect(() => {
    const scope = root?.current
    if (!root) return
    if (!scope) {
      setVisible({})
      return
    }
    const next: Record<string, boolean> = {}
    const nodes = new Map<Element, string>()
    const io = new IntersectionObserver(
      (entries) => {
        const changes: Record<string, boolean> = {}
        for (const entry of entries) {
          const key = nodes.get(entry.target)
          if (key) changes[key] = entry.isIntersecting
        }
        setVisible((current) => ({ ...current, ...changes }))
      },
      { root: scope },
    )
    const wanted = new Set(keys ? keys.split('\n') : [])
    for (const node of scope.querySelectorAll<HTMLElement>('[data-pending-id]')) {
      const key = node.dataset.pendingId
      if (!key || !wanted.has(key)) continue
      nodes.set(node, key)
      next[key] = false
      io.observe(node)
    }
    setVisible({ ...next })
    return () => io.disconnect()
  }, [root, keys])
  const items = candidates.filter((item) => !root || visible?.[item.key] === false)
  if (!items.length) return null
  const locate = (item: Item) => {
    const card = [...(root?.current?.querySelectorAll<HTMLElement>('[data-pending-id]') ?? [])].find(
      (node) => node.dataset.pendingId === item.key,
    )
    if (card) card.scrollIntoView?.({ block: 'center', behavior: 'smooth' })
    else onLocate(item.run)
  }
  return (
    <div className="pd-dock" data-testid="pending-dock">
      <span className="pd-dock__label">
        <Icon name="bell" size={13} />
        {t('待处理 {n} 项', { n: items.length })}
      </span>
      <ul className="pd-dock__list">
        {items.map((it) => (
          <PendingItem key={it.key} item={it} onLocate={() => locate(it)} />
        ))}
      </ul>
    </div>
  )
}

function PendingItem({ item, onLocate }: { item: Item; onLocate: () => void }) {
  const name = useWorkspace((s) => s.bots.find((b) => b.id === item.run.botId)?.name ?? 'Bot')
  const approval = 'approval' in item
  const text = approval ? item.approval.title : (item.set.questions[0]?.title ?? '')
  return (
    <li>
      <button type="button" className="pd-item" data-testid="pending-item" onClick={onLocate}>
        <BotAvatar id={item.run.botId} name={name} size={16} />
        <span className="pd-item__name">{name}</span>
        <span className="pd-item__kind" data-kind={approval ? 'approval' : 'question'}>
          {approval ? t('待审批') : t('待回答')}
        </span>
        <span className="pd-item__text">{text}</span>
        <Icon name="arrow-up" size={12} />
      </button>
    </li>
  )
}
