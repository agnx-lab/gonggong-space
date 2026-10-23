import type { GitCommit } from '@gonggong/protocol'
import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react'
import { t } from '../../../i18n'
import { fullTime } from '../../../lib/time'
import { Button, ContextMenu, EmptyState, type MenuItem, Spinner } from '../../../ui'
import { GraphCell } from '../GraphCell'
import { layoutGraph } from '../graph'
import { parseRefs } from '../refs'
import { commitDate } from './query'
import { RefLabels, refLabels } from './RefLabels'

/** How a click picks: ⌘/Ctrl adds or drops one commit, ⇧ the range from the last one clicked. */
export interface PickHow {
  add: boolean
  range: boolean
}

/** The nearest listed commit above `hash` that has it as a parent. */
export function childOf(commits: readonly GitCommit[], hash: string): GitCommit | null {
  const at = commits.findIndex((c) => c.hash === hash)
  for (let i = at - 1; i >= 0; i--) {
    const c = commits[i]
    if (c?.parents.includes(hash)) return c
  }
  return null
}

/**
 * IDEA's commit table: the graph and subject with its ref labels, author, date and short hash; merges dimmed. ↑↓
 * move, ← goes to the parent and → to the child (`onGo`); the next page loads as the end scrolls into view. With
 * `menu`, a right click opens the actions of the commits `onMenuTarget` returns.
 */
export function CommitTable({
  commits,
  remotes,
  partial,
  selected,
  picked,
  onPick,
  onGo,
  menu,
  onMenuTarget,
  onMenu,
  hasMore,
  loading,
  error,
  onMore,
  onRetry,
  empty,
  label,
}: {
  commits: GitCommit[]
  remotes: readonly string[]
  /** The list is part of the history (a filtered log): the graph only joins the commits listed. */
  partial: boolean
  selected: string | null
  picked: ReadonlySet<string>
  onPick: (hash: string, how: PickHow) => void
  onGo?: (hash: string) => void
  menu?: (hashes: string[]) => MenuItem[]
  onMenuTarget?: (hash: string) => string[]
  onMenu?: (value: string, hashes: string[]) => void
  hasMore: boolean
  loading: boolean
  error: string | null
  onMore: () => void
  onRetry: () => void
  empty: string
  label: string
}) {
  const box = useRef<HTMLDivElement>(null)
  const end = useRef<HTMLDivElement>(null)
  const [menuFor, setMenuFor] = useState<string[] | null>(null)
  const rows = useMemo(() => {
    if (!partial) return layoutGraph(commits)
    const listed = new Set(commits.map((c) => c.hash))
    return layoutGraph(
      commits.map((c) => ({ hash: c.hash, parents: c.parents.filter((p) => listed.has(p)) })),
    )
  }, [commits, partial])

  useEffect(() => {
    if (!selected) return
    const el = box.current?.querySelector<HTMLElement>(`[data-hash="${selected}"]`)
    el?.scrollIntoView?.({ block: 'nearest' })
    if (box.current?.contains(document.activeElement)) el?.focus({ preventScroll: true })
  }, [selected])

  const more = useRef(onMore)
  more.current = onMore
  // biome-ignore lint/correctness/useExhaustiveDependencies: a longer list re-observes the end, which may still show
  useEffect(() => {
    const el = end.current
    if (!el || !hasMore || loading || error) return
    const io = new IntersectionObserver(
      (entries) => entries.some((e) => e.isIntersecting) && more.current(),
      {
        root: box.current,
        rootMargin: '0px 0px 320px 0px',
      },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [hasMore, loading, error, commits.length])

  const go = onGo ?? ((hash: string) => onPick(hash, { add: false, range: false }))
  const keyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const at = commits.findIndex((c) => c.hash === selected)
    const cur = commits[at]
    const to = (hash: string | undefined) => {
      if (!hash) return
      e.preventDefault()
      go(hash)
    }
    if (e.key === 'ArrowDown') to(commits[Math.min(commits.length - 1, at + 1)]?.hash)
    else if (e.key === 'ArrowUp') to(commits[Math.max(0, at - 1)]?.hash)
    else if (e.key === 'Home') to(commits[0]?.hash)
    else if (e.key === 'End') to(commits.at(-1)?.hash)
    else if (e.key === 'ArrowLeft' && cur) to(cur.parents[0])
    else if (e.key === 'ArrowRight' && cur) to(childOf(commits, cur.hash)?.hash)
  }

  const focusable = selected && picked.has(selected) ? selected : commits[0]?.hash
  const list = (
    <div
      role="listbox"
      tabIndex={-1}
      aria-label={label}
      aria-multiselectable={menu ? true : undefined}
      className="glog-list"
      onKeyDown={keyDown}
      onContextMenuCapture={(e) => {
        const hash = (e.target as HTMLElement).closest<HTMLElement>('[data-hash]')?.dataset.hash
        setMenuFor(hash && onMenuTarget ? onMenuTarget(hash) : null)
      }}
    >
      {commits.map((c, i) => {
        const row = rows[i]
        const merge = c.parents.length > 1
        return (
          <button
            key={c.hash}
            type="button"
            role="option"
            aria-selected={picked.has(c.hash)}
            tabIndex={c.hash === focusable ? 0 : -1}
            data-hash={c.hash}
            data-primary={c.hash === selected || undefined}
            data-merge={merge || undefined}
            className="glog-row"
            onClick={(e) => onPick(c.hash, { add: e.metaKey || e.ctrlKey, range: e.shiftKey })}
          >
            <span className="glog-row__subject">
              {row ? (
                <span className="glog-row__graph">
                  <GraphCell row={row} merge={merge} />
                </span>
              ) : null}
              <span className="glog-row__text">{c.subject}</span>
              <RefLabels labels={refLabels(parseRefs(c.refs, remotes), remotes)} />
            </span>
            <span className="glog-row__author">{c.author}</span>
            <span className="glog-row__date" title={fullTime(c.at)}>
              {commitDate(c.at)}
            </span>
            <span className="glog-row__hash">{c.shortHash}</span>
          </button>
        )
      })}
    </div>
  )
  return (
    <div ref={box} className="glog-table">
      {menu && onMenu ? (
        <ContextMenu items={menuFor ? menu(menuFor) : []} onSelect={(v) => menuFor && onMenu(v, menuFor)}>
          {list}
        </ContextMenu>
      ) : (
        list
      )}
      <div ref={end} className="glog-more">
        {error ? (
          <EmptyState
            compact
            icon="warning"
            title={t('无法读取提交历史')}
            description={error}
            action={
              <Button size="small" onClick={onRetry}>
                {t('重试')}
              </Button>
            }
          />
        ) : loading ? (
          <Spinner size={14} />
        ) : hasMore ? (
          <Button size="small" variant="plain" onClick={onMore}>
            {t('加载更多')}
          </Button>
        ) : !commits.length ? (
          <EmptyState compact icon="clock" title={empty} />
        ) : null}
      </div>
    </div>
  )
}
