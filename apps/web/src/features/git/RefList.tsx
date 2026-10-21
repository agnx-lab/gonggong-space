import type { GitBranch, GitRefsDto } from '@gonggong/protocol'
import { type ReactNode, useState } from 'react'
import { t } from '../../i18n'
import { Icon, SearchField, Spinner } from '../../ui'
import './git.css'

const HASH = /^[0-9a-f]{4,40}$/i

function Counts({ b }: { b: GitBranch }) {
  return (
    <>
      {b.behind ? (
        <span className="git-refs__ab" role="img" aria-label={t('落后 {n} 个提交', { n: b.behind })}>
          <Icon name="arrow-down" size={11} />
          {b.behind}
        </span>
      ) : null}
      {b.ahead ? (
        <span className="git-refs__ab" role="img" aria-label={t('领先 {n} 个提交', { n: b.ahead })}>
          <Icon name="arrow-up" size={11} />
          {b.ahead}
        </span>
      ) : null}
    </>
  )
}

/**
 * Searchable branches of a workspace, local and remote apart, the current one checked. `commits` also offers the
 * typed text as a commit when it looks like a hash; `top` comes first (e.g. 工作区).
 */
export function RefList({
  refs,
  error,
  selected,
  onPick,
  commits = false,
  top,
}: {
  refs: GitRefsDto | null
  error: string | null
  /** Marked instead of the checked-out branch (a picker's value). */
  selected?: string | null
  onPick: (branch: GitBranch | null, name: string) => void
  commits?: boolean
  top?: ReactNode
}) {
  const [query, setQuery] = useState('')
  if (error) return <div className="git-refs__note git-refs__note--error">{error}</div>
  if (!refs)
    return (
      <div className="git-refs__note">
        <Spinner size={14} />
      </div>
    )
  const q = query.trim().toLowerCase()
  // `origin/HEAD` only points at another remote branch.
  const shown = refs.branches.filter((b) => !b.name.endsWith('/HEAD') && b.name.toLowerCase().includes(q))
  const marked = (b: GitBranch) => (selected === undefined ? b.current : b.name === selected)
  const section = (kind: GitBranch['kind'], label: string) => {
    const list = shown.filter((b) => b.kind === kind)
    if (!list.length) return null
    return (
      <fieldset aria-label={label} className="git-refs__group">
        <div className="git-refs__head">{label}</div>
        {list.map((b) => (
          <button
            key={b.name}
            type="button"
            className="git-refs__item"
            data-ref={b.name}
            aria-current={marked(b) || undefined}
            title={b.subject || b.name}
            onClick={() => onPick(b, b.name)}
          >
            <span className="git-refs__check">
              {marked(b) ? <Icon name="check" size={12} weight={2} /> : null}
            </span>
            <span className="git-refs__name">{b.name}</span>
            {b.upstream ? <Counts b={b} /> : null}
          </button>
        ))}
      </fieldset>
    )
  }
  const asCommit = commits && HASH.test(q) ? query.trim() : null
  return (
    <div className="git-refs">
      <SearchField
        className="git-refs__search"
        placeholder={commits ? t('搜索分支或输入提交哈希') : t('搜索分支')}
        aria-label={t('搜索分支')}
        value={query}
        onChange={setQuery}
      />
      <div className="git-refs__list">
        {top}
        {section('local', t('本地'))}
        {section('remote', t('远程'))}
        {asCommit ? (
          <button type="button" className="git-refs__item" onClick={() => onPick(null, asCommit)}>
            <span className="git-refs__check" />
            <span className="git-refs__name">{t('提交 {hash}', { hash: asCommit })}</span>
          </button>
        ) : null}
        {!shown.length && !asCommit ? <div className="git-refs__note">{t('没有匹配的分支')}</div> : null}
      </div>
    </div>
  )
}
