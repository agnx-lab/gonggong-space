import type { GitBranch, GitRefsDto, GitTag, RepoStatus } from '@gonggong/protocol'
import { type KeyboardEvent, type ReactNode, useState } from 'react'
import { useWorkspace } from '../../app/workspace'
import { t } from '../../i18n'
import { cx } from '../../lib/cx'
import { toastError } from '../../lib/errors'
import { ago } from '../../lib/time'
import { Icon, type IconName, Popover, SearchField, Spinner } from '../../ui'
import { useGitStamp } from '../diff/useWorkspaceDiff'
import { type GitTarget, refreshGit, refreshGitQuietly, useGitRefs } from './api'
import { type PickedRef, type RefAction, refActions } from './branchActions'
import { gitCommands } from './commands'
import { type BranchNode, branchTree, loadFavorites, remoteGroups, saveFavorites } from './refs'
import './branches.css'

/**
 * IDEA's branch popup (the VCS widget): search, the top actions, then recent, local, remote branches and tags, `/`
 * folders and starred favourites first; picking one lists its actions.
 */
export function BranchPopup({
  target,
  status,
  children,
}: {
  target: GitTarget
  status: RepoStatus
  /** The trigger's content. */
  children: ReactNode
}) {
  const name = useWorkspace((s) => s.bots.find((b) => b.id === target.botId)?.name) ?? 'Bot'
  return (
    <Popover
      portal
      placement="bottom-start"
      width={400}
      aria-label={t('{name} 的分支', { name })}
      onOpenChange={(open) => open && refreshGitQuietly(target.groupId, target.botId)}
      trigger={
        <button type="button" className="gb-trigger" aria-label={t('切换 {name} 的分支', { name })}>
          {children}
          <Icon name="chevron-down" size={10} />
        </button>
      }
    >
      {(close) => <BranchPanel target={target} status={status} close={close} />}
    </Popover>
  )
}

type Row =
  | { kind: 'action'; key: string; icon: IconName; label: string; run: () => void; busy?: boolean }
  | { kind: 'head'; key: string; label: string }
  | { kind: 'folder'; key: string; path: string; name: string; depth: number; open: boolean }
  | { kind: 'ref'; key: string; ref: PickedRef; label: string; depth: number }

const move = (e: KeyboardEvent<HTMLDivElement>) => {
  if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
  const rows = [...e.currentTarget.querySelectorAll<HTMLElement>('.gb__row')]
  const at = rows.indexOf(document.activeElement as HTMLElement)
  const next =
    rows[at + (e.key === 'ArrowDown' ? 1 : -1)] ?? rows[e.key === 'ArrowDown' ? 0 : rows.length - 1]
  if (!next) return
  e.preventDefault()
  next.focus()
}

export function BranchPanel({
  target,
  status,
  close,
}: {
  target: GitTarget
  status: RepoStatus
  close: () => void
}) {
  const stamp = useGitStamp(target.groupId, target.botId)
  const { refs, error } = useGitRefs(target.groupId, target.botId, target.repo, stamp)
  const base = useWorkspace((s) => s.groups.find((g) => g.id === target.groupId)?.repo?.branch ?? null)
  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState<PickedRef | null>(null)
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set())
  const [favorites, setFavorites] = useState<ReadonlySet<string>>(
    () => loadFavorites(target.botId) ?? new Set(base ? [base, `origin/${base}`] : []),
  )
  const [fetching, setFetching] = useState(false)
  const cmd = gitCommands(target)
  const then = (run: () => void) => () => {
    close()
    run()
  }
  const remote = refs?.remotes.find((r) => r.name === 'origin')?.name ?? refs?.remotes[0]?.name ?? null

  if (picked) {
    const actions = refActions(cmd, picked, status.branch, remote)
    return (
      <div className="gb">
        <div className="gb__drill">
          <button type="button" className="gb__back" aria-label={t('返回')} onClick={() => setPicked(null)}>
            <Icon name="chevron-left" size={12} weight={2} />
          </button>
          <div className="gb__drill-title">
            <span className="gb__drill-name">{picked.name}</span>
            <RefMeta refItem={picked} />
          </div>
        </div>
        {/* biome-ignore lint/a11y/noStaticElementInteractions: arrow keys move between the rows' buttons */}
        <div className="gb__list" onKeyDown={move}>
          {actions.map((a, i) =>
            'separator' in a ? (
              // biome-ignore lint/suspicious/noArrayIndexKey: separators sit between fixed actions
              <div key={`sep${i}`} className="gb__sep" />
            ) : (
              <ActionRow key={a.value} action={a} onRun={then(a.run)} />
            ),
          )}
        </div>
      </div>
    )
  }

  const toggleStar = (name: string) => {
    const next = new Set(favorites)
    if (!next.delete(name)) next.add(name)
    setFavorites(next)
    saveFavorites(target.botId, next)
  }
  const fetchAll = async () => {
    setFetching(true)
    try {
      await refreshGit(target.groupId, target.botId, true)
    } catch (e) {
      toastError(e)
    }
    setFetching(false)
  }
  const q = query.trim().toLowerCase()
  const rows = refs ? buildRows(refs, { q, favorites, open, current: status.branch }) : []
  const actions: Row[] = q
    ? []
    : [
        { kind: 'action', key: 'pull', icon: 'arrow-down', label: t('更新…'), run: then(cmd.pull) },
        { kind: 'action', key: 'push', icon: 'arrow-up', label: t('推送…'), run: then(() => cmd.push()) },
        { kind: 'action', key: 'new', icon: 'plus', label: t('新建分支…'), run: then(() => cmd.newBranch()) },
        {
          kind: 'action',
          key: 'revision',
          icon: 'tag',
          label: t('检出标签或修订…'),
          run: then(cmd.checkoutRevision),
        },
        {
          kind: 'action',
          key: 'fetch',
          icon: 'arrow-clockwise',
          label: fetching ? t('正在获取远程更新…') : t('获取远程更新'),
          run: () => void fetchAll(),
          busy: fetching,
        },
      ]
  return (
    <div className="gb">
      <SearchField
        className="gb__search"
        placeholder={t('搜索分支和标签')}
        aria-label={t('搜索分支和标签')}
        value={query}
        onChange={setQuery}
      />
      {/* biome-ignore lint/a11y/noStaticElementInteractions: arrow keys move between the rows' buttons */}
      <div className="gb__list" onKeyDown={move}>
        {[
          ...actions,
          ...(actions.length ? [{ kind: 'head', key: 'sep', label: '' } as Row] : []),
          ...rows,
        ].map((r) => {
          if (r.kind === 'action')
            return (
              <button
                key={r.key}
                type="button"
                className="gb__row gb__row--action"
                disabled={r.busy}
                onClick={r.run}
              >
                <span className="gb__icon">
                  {r.busy ? <Spinner size={11} /> : <Icon name={r.icon} size={13} />}
                </span>
                <span className="gb__name">{r.label}</span>
              </button>
            )
          if (r.kind === 'head')
            return r.label ? (
              <div key={r.key} className="gb__head">
                {r.label}
              </div>
            ) : (
              <div key={r.key} className="gb__sep" />
            )
          if (r.kind === 'folder')
            return (
              <button
                key={r.key}
                type="button"
                className="gb__row gb__row--folder"
                style={{ paddingLeft: 10 + r.depth * 16 }}
                aria-expanded={r.open}
                onClick={() =>
                  setOpen((s) => {
                    const next = new Set(s)
                    if (!next.delete(r.path)) next.add(r.path)
                    return next
                  })
                }
              >
                <span className={cx('gb__icon ui-disclosure', r.open && 'ui-disclosure--open')}>
                  <Icon name="chevron-right" size={11} weight={2} />
                </span>
                <span className="gb__name">{r.name}</span>
              </button>
            )
          const current = r.ref.kind === 'local' && r.ref.name === status.branch
          const star = favorites.has(r.ref.name)
          return (
            <div key={r.key} className="gb__item" data-current={current || undefined}>
              <button
                type="button"
                className="gb__row"
                style={{ paddingLeft: 10 + r.depth * 16 }}
                title={r.ref.name}
                onClick={() => setPicked(r.ref)}
              >
                <span className="gb__icon" data-star={(star && !current) || undefined}>
                  <Icon
                    name={r.ref.kind === 'tag' ? 'tag' : current ? 'check' : star ? 'star' : 'git-branch'}
                    size={13}
                    weight={current ? 2 : undefined}
                  />
                </span>
                <span className="gb__name">
                  <Highlight text={r.label} q={q} />
                </span>
                {r.ref.kind === 'local' ? <Track b={r.ref.branch} /> : null}
                <Icon name="chevron-right" size={10} className="gb__more" />
              </button>
              {r.ref.kind === 'tag' ? null : (
                <button
                  type="button"
                  className="gb__star"
                  data-on={star || undefined}
                  aria-label={
                    star ? t('取消收藏 {name}', { name: r.ref.name }) : t('收藏 {name}', { name: r.ref.name })
                  }
                  aria-pressed={star}
                  onClick={() => toggleStar(r.ref.name)}
                >
                  <Icon name="star" size={11} />
                </button>
              )}
            </div>
          )
        })}
        {error ? <div className="git-refs__note git-refs__note--error">{error}</div> : null}
        {!refs && !error ? (
          <div className="git-refs__note">
            <Spinner size={14} />
          </div>
        ) : null}
        {refs && q && !rows.length ? <div className="git-refs__note">{t('没有匹配的分支或标签')}</div> : null}
      </div>
    </div>
  )
}

function ActionRow({ action, onRun }: { action: Extract<RefAction, { value: string }>; onRun: () => void }) {
  return (
    <button
      type="button"
      className="gb__row gb__row--action"
      data-destructive={action.destructive || undefined}
      onClick={onRun}
    >
      <span className="gb__icon">{action.icon ? <Icon name={action.icon} size={13} /> : null}</span>
      <span className="gb__name">{action.label}</span>
    </button>
  )
}

function RefMeta({ refItem }: { refItem: PickedRef }) {
  const tip = refItem.kind === 'tag' ? refItem.tag : refItem.branch
  const upstream = refItem.kind === 'local' ? refItem.branch.upstream : null
  return (
    <span className="gb__drill-meta">
      {tip.subject ? `${tip.subject} · ${ago(tip.at)}` : null}
      {upstream ? ` · ${t('跟踪 {upstream}', { upstream })}` : null}
    </span>
  )
}

/** How far a local branch is from its upstream: ↓ incoming (blue), ↑ outgoing (green), as in IDEA. */
function Track({ b }: { b: GitBranch }) {
  if (!b.upstream) return null
  return (
    <span className="gb__track">
      {b.behind ? (
        <span className="gb__in" role="img" aria-label={t('落后 {n} 个提交', { n: b.behind })}>
          ↓{b.behind}
        </span>
      ) : null}
      {b.ahead ? (
        <span className="gb__out" role="img" aria-label={t('领先 {n} 个提交', { n: b.ahead })}>
          ↑{b.ahead}
        </span>
      ) : null}
    </span>
  )
}

function Highlight({ text, q }: { text: string; q: string }) {
  const at = q ? text.toLowerCase().indexOf(q) : -1
  if (at < 0) return <>{text}</>
  return (
    <>
      {text.slice(0, at)}
      <mark className="gb__mark">{text.slice(at, at + q.length)}</mark>
      {text.slice(at + q.length)}
    </>
  )
}

/** Branches of a section up to which its `/` folders start unfolded. */
const UNFOLDED = 10

/** The popup's rows: sections of refs, favourites first, `/` folders unless searching. */
export function buildRows(
  refs: GitRefsDto,
  o: { q: string; favorites: ReadonlySet<string>; open: ReadonlySet<string>; current: string | null },
): Row[] {
  const match = (name: string) => !o.q || name.toLowerCase().includes(o.q)
  const fav = (a: { name: string }, b: { name: string }) =>
    +o.favorites.has(b.name) - +o.favorites.has(a.name)
  const locals = refs.branches.filter((b) => b.kind === 'local' && match(b.name))
  const rows: Row[] = []
  const branchRows = (
    list: GitBranch[],
    kind: 'local' | 'remote',
    strip: string,
    keyPrefix: string,
    depth: number,
  ) => {
    const ref = (b: GitBranch): PickedRef => ({ kind, name: b.name, branch: b })
    const stars = list.filter((b) => o.favorites.has(b.name) || b.name === o.current)
    const rest = list.filter((b) => !stars.includes(b))
    for (const b of stars.sort(fav))
      rows.push({
        kind: 'ref',
        key: `${keyPrefix}*${b.name}`,
        ref: ref(b),
        label: b.name.slice(strip.length),
        depth,
      })
    if (o.q) {
      for (const b of rest)
        rows.push({
          kind: 'ref',
          key: `${keyPrefix}${b.name}`,
          ref: ref(b),
          label: b.name.slice(strip.length),
          depth,
        })
      return
    }
    // A few branches show unfolded; many start folded. Toggling flips the default either way.
    const unfolded = rest.length <= UNFOLDED
    const walk = (nodes: BranchNode[], d: number) => {
      for (const n of nodes) {
        if (n.kind === 'branch') {
          rows.push({
            kind: 'ref',
            key: `${keyPrefix}${n.name}`,
            ref: ref(n.branch),
            label: n.label,
            depth: d,
          })
          continue
        }
        const isOpen = unfolded !== o.open.has(`${keyPrefix}${n.path}`)
        rows.push({
          kind: 'folder',
          key: `${keyPrefix}${n.path}/`,
          path: `${keyPrefix}${n.path}`,
          name: n.name,
          depth: d,
          open: isOpen,
        })
        if (isOpen) walk(n.children, d + 1)
      }
    }
    walk(branchTree(rest, strip), depth)
  }
  const recent = refs.recent
    .map((name) => refs.branches.find((b) => b.kind === 'local' && b.name === name))
    .filter((b): b is GitBranch => !!b && match(b.name))
  if (recent.length && !o.q) {
    rows.push({ kind: 'head', key: 'h-recent', label: t('最近') })
    for (const b of recent)
      rows.push({
        kind: 'ref',
        key: `recent:${b.name}`,
        ref: { kind: 'local', name: b.name, branch: b },
        label: b.name,
        depth: 0,
      })
  }
  if (locals.length) {
    rows.push({ kind: 'head', key: 'h-local', label: t('本地') })
    branchRows(locals, 'local', '', 'l:', 0)
  }
  const groups = remoteGroups(refs)
    .map((g) => ({ ...g, branches: g.branches.filter((b) => match(b.name)) }))
    .filter((g) => g.branches.length)
  const [only] = groups
  if (groups.length === 1 && only) {
    rows.push({ kind: 'head', key: 'h-remote', label: t('远程 · {remote}', { remote: only.remote }) })
    branchRows(only.branches, 'remote', `${only.remote}/`, `r:${only.remote}/`, 0)
  } else if (groups.length) {
    rows.push({ kind: 'head', key: 'h-remote', label: t('远程') })
    for (const g of groups) {
      const path = `r:${g.remote}`
      const isOpen = !!o.q || o.open.has(path)
      rows.push({ kind: 'folder', key: `${path}/`, path, name: g.remote, depth: 0, open: isOpen })
      if (isOpen) branchRows(g.branches, 'remote', `${g.remote}/`, `r:${g.remote}/`, 1)
    }
  }
  const tags = refs.tags.filter((tag: GitTag) => match(tag.name))
  if (tags.length) {
    rows.push({ kind: 'head', key: 'h-tags', label: t('标签') })
    const path = 'tags'
    const shown = o.q || tags.length <= 8 || o.open.has(path)
    for (const tag of shown ? tags : tags.slice(0, 8))
      rows.push({
        kind: 'ref',
        key: `t:${tag.name}`,
        ref: { kind: 'tag', name: tag.name, tag },
        label: tag.name,
        depth: 0,
      })
    if (!shown)
      rows.push({
        kind: 'folder',
        key: 'tags/',
        path,
        name: t('更多 {n} 个标签', { n: tags.length - 8 }),
        depth: 0,
        open: false,
      })
  }
  return rows
}
