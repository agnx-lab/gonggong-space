import type { ApprovalDto, QuestionSetDto, RunDto } from '@gonggong/protocol'
import { type RefObject, useEffect, useMemo, useState } from 'react'
import { useSession } from '../../app/session'
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

/** Phones: the dock starts folded and folds again when the keyboard opens, so it never covers the composer. */
const PHONE = '(max-width: 640px)'
/** The visual viewport shrinking this much means the on-screen keyboard came up. */
const KEYBOARD_PX = 150

const isPhone = () => typeof window.matchMedia === 'function' && window.matchMedia(PHONE).matches

/**
 * Pinned above the composer: pending approvals and questions *I* may decide, in place, once their card is out of
 * view. Others' stay read-only on their own cards. Several fold into 待处理 N 项.
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
  const [phone] = useState(isPhone)
  const [open, setOpen] = useState(false)
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
  useEffect(() => {
    const vv = window.visualViewport
    if (!phone || !vv) return
    let full = vv.height
    const onResize = () => {
      if (vv.height < full - KEYBOARD_PX) setOpen(false)
      full = Math.max(full, vv.height)
    }
    vv.addEventListener('resize', onResize)
    return () => vv.removeEventListener('resize', onResize)
  }, [phone])
  if (!items.length) return null
  const folded = phone || items.length > 1
  return (
    <div className="pd-dock" data-testid="pending-dock">
      {folded ? (
        <button type="button" className="pd-dock__head" aria-expanded={open} onClick={() => setOpen(!open)}>
          <Icon name="bell" size={14} />
          <span>{t('待处理 {n} 项', { n: items.length })}</span>
          <Icon name="chevron-up" size={12} className="pd-dock__chevron" />
        </button>
      ) : null}
      {!folded || open ? (
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
