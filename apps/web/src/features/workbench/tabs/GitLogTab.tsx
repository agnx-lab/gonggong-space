import type { GitChange, GitCommit, GitCompareDto, GitLogDto } from '@gonggong/protocol'
import { useEffect, useRef, useState } from 'react'
import { useWorkbench } from '../../../app/workbench'
import { useWorkspace } from '../../../app/workspace'
import { t } from '../../../i18n'
import { api, errorText } from '../../../lib/api'
import { ago, fullTime } from '../../../lib/time'
import { Button, EmptyState, PopUpButton, Spinner, Tag } from '../../../ui'
import { useWide } from '../../diff/DiffPane'
import { GitFileDiff } from '../../diff/GitFileDiff'
import { gitBase, gitUrls, useGitRefs } from '../../git/api'
import { ChangeList } from '../../git/changes'
import { openTab } from '../open'
import type { TabMeta, TabProps } from '../types'

/** Below this a picked commit replaces the list. */
const WIDE_PX = 640

/** What a root commit is compared against. */
const EMPTY_TREE = '4b825dc642cb6eb9a060e54bf8d69288fbee4904'

interface Log {
  key: string
  commits: GitCommit[]
  hasMore: boolean
  loading: boolean
  error: string | null
}

function CommitDetail({
  base,
  botId,
  commit,
  file,
  onFile,
  onBack,
}: {
  base: string
  botId: string
  commit: GitCommit
  /** The file shown; null = the first. */
  file: string | null
  onFile: (path: string) => void
  /** Narrow: back to the commit list. */
  onBack?: () => void
}) {
  const parent = commit.parents[0] ?? EMPTY_TREE
  const url = gitUrls.compare(base, parent, commit.hash)
  const [changes, setChanges] = useState<{ url: string; list: GitChange[] | null; error: string | null }>()
  useEffect(() => {
    let live = true
    api.get<GitCompareDto>(url).then(
      (r) => live && setChanges({ url, list: r.changes, error: null }),
      (e: unknown) => live && setChanges({ url, list: null, error: errorText(e) }),
    )
    return () => {
      live = false
    }
  }, [url])
  const shown = changes?.url === url ? changes : null
  const picked = shown?.list?.find((c) => c.path === file) ?? shown?.list?.[0]
  return (
    <div className="git-log__detail wb-commit">
      {onBack ? (
        <Button size="small" variant="plain" icon="chevron-left" className="wb-commit__back" onClick={onBack}>
          {t('全部提交')}
        </Button>
      ) : null}
      <h3>{commit.subject}</h3>
      <div className="git-log__meta">
        <span className="git-log__hash">{commit.hash}</span>
      </div>
      <div className="git-log__meta">
        <span>
          {commit.author} &lt;{commit.email}&gt;
        </span>
        <span>{fullTime(commit.at)}</span>
      </div>
      {!shown ? (
        <Spinner />
      ) : shown.error ? (
        <EmptyState compact icon="warning" title={t('无法读取变更')} description={shown.error} />
      ) : shown.list && picked ? (
        <>
          <div className="wb-commit__files">
            <ChangeList changes={shown.list} selected={picked.path} onPick={(c) => onFile(c.path)} />
          </div>
          <div className="wb-commit__bar">
            <Button
              size="small"
              variant="plain"
              icon="doc"
              onClick={() =>
                openTab({
                  kind: 'file',
                  source: {
                    botId,
                    path: picked.path,
                    rev: picked.change === 'deleted' ? parent : commit.hash,
                  },
                })
              }
            >
              {t('打开此版本')}
            </Button>
          </div>
          <GitFileDiff
            key={picked.path}
            url={gitUrls.diff(base, parent, commit.hash, picked.path)}
            path={picked.path}
          />
        </>
      ) : (
        <EmptyState compact icon="doc" title={t('没有文件变化')} />
      )}
    </div>
  )
}

/**
 * A bot workspace's commits on a ref, paged; picking one lists its changes against its first parent and shows a
 * changed file's diff. Narrow, the picked commit takes the whole tab.
 */
export function GitLogTab({ tab, tabKey }: TabProps<'git-log'>) {
  const groupId = useWorkbench((s) => s.groupId) ?? ''
  const patch = useWorkbench((s) => s.patch)
  const root = useRef<HTMLDivElement>(null)
  const wide = useWide(root, WIDE_PX)
  const base = gitBase(groupId, tab.botId)
  const { refs } = useGitRefs(groupId, tab.botId)
  const key = `${base}|${tab.ref ?? ''}`
  const fresh: Log = { key, commits: [], hasMore: false, loading: true, error: null }
  const [log, setLog] = useState(fresh)
  const shown = log.key === key ? log : fresh

  const load = (skip: number) => {
    setLog((l) => ({ ...(l.key === key ? l : fresh), loading: true, error: null }))
    api.get<GitLogDto>(gitUrls.log(base, tab.ref, skip)).then(
      (r) =>
        setLog((l) =>
          l.key === key
            ? {
                key,
                commits: [...l.commits.slice(0, skip), ...r.commits],
                hasMore: r.hasMore,
                loading: false,
                error: null,
              }
            : l,
        ),
      (e: unknown) => setLog((l) => (l.key === key ? { ...l, loading: false, error: errorText(e) } : l)),
    )
  }
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new ref starts the list over
  useEffect(() => load(0), [key])

  const names = (refs?.branches ?? []).map((b) => b.name).filter((n) => !n.endsWith('/HEAD'))
  // A ref typed elsewhere (a commit) stays selectable.
  if (tab.ref && !names.includes(tab.ref)) names.push(tab.ref)
  const options = [{ value: '', label: t('当前分支') }, ...names.map((n) => ({ value: n, label: n }))]
  const picked = shown.commits.find((c) => c.hash === tab.commit)
  const list = (
    <div className="git-log__list">
      {shown.commits.map((c) => (
        <button
          key={c.hash}
          type="button"
          className="git-log__row"
          aria-pressed={c.hash === tab.commit}
          onClick={() => patch(tabKey, { commit: c.hash, file: null })}
        >
          <span className="git-log__subject">
            {c.subject}
            {c.refs.map((r) => (
              <Tag key={r} tone="blue">
                {r}
              </Tag>
            ))}
          </span>
          <span className="git-log__meta">
            <span className="git-log__hash">{c.shortHash}</span>
            <span>{c.author}</span>
            <span>{ago(c.at)}</span>
          </span>
        </button>
      ))}
      {shown.error ? (
        <EmptyState
          compact
          icon="warning"
          title={t('无法读取提交历史')}
          description={shown.error}
          action={<Button onClick={() => load(shown.commits.length)}>{t('重试')}</Button>}
        />
      ) : shown.loading ? (
        <div className="git-log__more">
          <Spinner />
        </div>
      ) : shown.hasMore ? (
        <div className="git-log__more">
          <Button size="small" onClick={() => load(shown.commits.length)}>
            {t('加载更多')}
          </Button>
        </div>
      ) : !shown.commits.length ? (
        <EmptyState compact icon="clock" title={t('还没有提交')} />
      ) : null}
    </div>
  )
  return (
    <div ref={root} className="git-log wb-log" data-layout={wide ? 'wide' : 'narrow'}>
      <div className="git-log__bar">
        <PopUpButton
          size="small"
          aria-label={t('分支')}
          value={tab.ref ?? ''}
          onChange={(v) => patch(tabKey, { ref: v || null, commit: null, file: null })}
          options={options}
        />
      </div>
      <div className="git-log__main">
        {wide || !picked ? list : null}
        {picked ? (
          <CommitDetail
            key={picked.hash}
            base={base}
            botId={tab.botId}
            commit={picked}
            file={tab.file ?? null}
            onFile={(file) => patch(tabKey, { file })}
            onBack={wide ? undefined : () => patch(tabKey, { commit: null, file: null })}
          />
        ) : wide ? (
          <div className="git-log__detail">
            <EmptyState compact icon="git-branch" title={t('选择一个提交查看变更')} />
          </div>
        ) : null}
      </div>
    </div>
  )
}

export function useGitLogTabMeta(tab: TabProps<'git-log'>['tab']): TabMeta {
  const name = useWorkspace((s) => s.bots.find((b) => b.id === tab.botId)?.name) ?? 'Bot'
  return { icon: 'clock', title: t('提交历史 · {name}', { name }) }
}
