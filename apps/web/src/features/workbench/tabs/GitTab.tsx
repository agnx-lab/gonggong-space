import type { GitChange, GitCompareDto } from '@gonggong/protocol'
import { type CSSProperties, type KeyboardEvent, type ReactNode, useEffect, useRef, useState } from 'react'
import { useWorkbench } from '../../../app/workbench'
import { useWorkspace } from '../../../app/workspace'
import { t } from '../../../i18n'
import { api, errorText } from '../../../lib/api'
import { cx } from '../../../lib/cx'
import { toastError } from '../../../lib/errors'
import { Alert, Button, Checkbox, EmptyState, Icon, Presence, Spinner, TextField } from '../../../ui'
import { useWide } from '../../diff/DiffPane'
import { GitFileDiff } from '../../diff/GitFileDiff'
import { type DiffNode, diffTree } from '../../diff/patch'
import { useGitStamp } from '../../diff/useWorkspaceDiff'
import { gitActionTaken, gitBase, gitUrls, refreshGit, refreshGitQuietly, runGitAction } from '../../git/api'
import { ChangeMark } from '../../git/changes'
import { BranchPicker, Counts, PushDialog, useOwner } from '../../git/GitControls'
import { GitOperationList, useGitOps } from '../../git/GitOperations'
import { openTab } from '../open'
import type { TabMeta, TabProps } from '../types'

/** Below this the picked file's diff opens in its own tab instead of beside the changes. */
const WIDE_PX = 720

/** Uncommitted changes of the root repo, read again whenever the git status changes; only while the tab is shown. */
function useChanges(groupId: string, botId: string, active: boolean) {
  const stamp = useGitStamp(groupId, botId)
  const [state, setState] = useState<{ changes: GitChange[] | null; error: string | null }>({
    changes: null,
    error: null,
  })
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new git stamp means the work tree changed
  useEffect(() => {
    if (!active) return
    let live = true
    api.get<GitCompareDto>(gitUrls.compare(gitBase(groupId, botId), 'HEAD', null)).then(
      (r) => live && setState({ changes: r.changes, error: null }),
      (e: unknown) => live && setState({ changes: null, error: errorText(e) }),
    )
    return () => {
      live = false
    }
  }, [groupId, botId, active, stamp])
  return state
}

const indent = (depth: number) => ({ '--depth': depth }) as CSSProperties

const filesOf = (n: DiffNode<GitChange>): GitChange[] =>
  n.kind === 'file' ? [n.file] : n.children.flatMap(filesOf)

/** The changes as a folder tree, each file and folder with a checkbox picking it for the commit. */
function ChangeTree({
  changes,
  skipped,
  selected,
  onToggle,
  onPick,
}: {
  changes: GitChange[]
  skipped: ReadonlySet<string>
  selected: string | null
  onToggle: (paths: string[], on: boolean) => void
  onPick: (c: GitChange) => void
}) {
  const [closed, setClosed] = useState<ReadonlySet<string>>(new Set())
  const rows = (nodes: DiffNode<GitChange>[], depth: number): ReactNode[] =>
    nodes.map((n) => {
      if (n.kind === 'file') {
        const c = n.file
        return (
          <li key={c.path} className="wb-git__row" style={indent(depth)}>
            <Checkbox
              checked={!skipped.has(c.path)}
              onChange={(on) => onToggle([c.path], on)}
              label={<span className="git-sr">{c.path}</span>}
            />
            <button
              type="button"
              className="git-change"
              title={c.oldPath ? `${c.oldPath} → ${c.path}` : c.path}
              aria-label={t('查看 {path} 的改动', { path: c.path })}
              aria-current={c.path === selected || undefined}
              onClick={() => onPick(c)}
            >
              <Icon name="doc-code" size={13} />
              <span className="git-commit__path">{n.name}</span>
              <ChangeMark change={c.change} />
            </button>
          </li>
        )
      }
      const open = !closed.has(n.path)
      const paths = filesOf(n).map((c) => c.path)
      const picked = paths.filter((p) => !skipped.has(p)).length
      return (
        <li key={n.path} className="wb-git__dir">
          <div className="wb-git__row" style={indent(depth)}>
            <Checkbox
              checked={picked === paths.length}
              indeterminate={picked > 0 && picked < paths.length}
              onChange={(on) => onToggle(paths, on)}
              label={<span className="git-sr">{n.path}</span>}
            />
            <button
              type="button"
              className="git-change"
              title={n.path}
              aria-expanded={open}
              onClick={() =>
                setClosed((s) => {
                  const next = new Set(s)
                  if (!next.delete(n.path)) next.add(n.path)
                  return next
                })
              }
            >
              <span className={cx('ui-disclosure', open && 'ui-disclosure--open')}>
                <Icon name="chevron-right" weight={2} />
              </span>
              <Icon name={open ? 'folder-open' : 'folder'} size={13} />
              <span className="git-commit__path">{n.name}</span>
            </button>
          </div>
          {open ? <ul className="wb-git__tree">{rows(n.children, depth + 1)}</ul> : null}
        </li>
      )
    })
  return (
    <ul className="wb-git__tree" aria-label={t('要提交的文件')}>
      {rows(diffTree(changes), 0)}
    </ul>
  )
}

function Section({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <section className="wb-git__section">
      <h3 className="wb-git__heading">{title}</h3>
      {children}
    </section>
  )
}

/**
 * A bot workspace's source control: its branch (switch, fetch, pull, push, history), its uncommitted changes as a tree
 * to pick and commit with the picked file's diff beside them, and its git operation log. Non-owners request instead.
 */
export function GitTab({ tab, tabKey, active }: TabProps<'git'>) {
  const groupId = useWorkbench((s) => s.groupId) ?? ''
  const patch = useWorkbench((s) => s.patch)
  const group = useWorkspace((s) => s.groups.find((g) => g.id === groupId))
  const git = useWorkspace((s) => s.botStates[groupId]?.[tab.botId]?.git ?? null)
  const name = useWorkspace((s) => s.bots.find((b) => b.id === tab.botId)?.name) ?? 'Bot'
  const { owner } = useOwner(tab.botId)
  const root = useRef<HTMLDivElement>(null)
  const wide = useWide(root, WIDE_PX)
  // Without a root repo (only sub-repos) there is nothing to commit here: each sub-repo has its own changes.
  const rootRepo = !git || git.branch != null || !git.repos.length
  const list = useChanges(groupId, tab.botId, active && rootRepo)
  const stamp = useGitStamp(groupId, tab.botId)
  const [message, setMessage] = useState('')
  // Unpicked rather than picked: files that turn up later start picked.
  const [skipped, setSkipped] = useState<ReadonlySet<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [pushing, setPushing] = useState(false)

  // biome-ignore lint/correctness/useExhaustiveDependencies: refresh once each time the tab is shown
  useEffect(() => {
    if (active && git) refreshGitQuietly(groupId, tab.botId)
  }, [active, groupId, tab.botId])

  if (!git)
    return (
      <div className="wb-git">
        <EmptyState compact icon="git-branch" title={t('{name} 的工作区还没有 Git 仓库', { name })} />
      </div>
    )

  const changes = list.changes ?? []
  const picked = changes.filter((c) => !skipped.has(c.path))
  const all = picked.length === changes.length
  const ready = !busy && !!message.trim() && picked.length > 0
  const shown = changes.find((c) => c.path === tab.file) ?? (wide ? changes[0] : undefined)
  const base = gitBase(groupId, tab.botId)

  const toggle = (paths: string[], on: boolean) =>
    setSkipped((s) => {
      const next = new Set(s)
      for (const p of paths) {
        if (on) next.delete(p)
        else next.add(p)
      }
      return next
    })
  const pick = (c: GitChange) => {
    if (wide) patch(tabKey, { file: c.path })
    else openTab({ kind: 'diff', botId: tab.botId, scope: 'uncommitted', file: c.path, repo: null })
  }
  const commit = async () => {
    if (!ready) return
    setBusy(true)
    // A rename commits both sides: the old path's removal and the new one.
    const paths = picked.flatMap((c) => (c.oldPath ? [c.oldPath, c.path] : [c.path]))
    const op = await runGitAction(groupId, tab.botId, { action: 'commit', message: message.trim(), paths })
    if (gitActionTaken(op)) {
      setMessage('')
      setSkipped(new Set())
    }
    setBusy(false)
  }
  const keyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Enter' || !(e.metaKey || e.ctrlKey)) return
    e.preventDefault()
    void commit()
  }
  const fetchRemote = async () => {
    setFetching(true)
    try {
      await refreshGit(groupId, tab.botId, true)
    } catch (e) {
      toastError(e)
    }
    setFetching(false)
  }

  return (
    <div ref={root} className="wb-git" data-layout={wide ? 'wide' : 'narrow'} data-testid="git-tab">
      <div className="wb-git__bar">
        <BranchPicker groupId={groupId} botId={tab.botId} name={name} git={git} />
        <Counts ahead={git.ahead} behind={git.behind} />
        <span className="spacer" />
        <Button
          size="small"
          variant="plain"
          icon="arrow-clockwise"
          aria-label={fetching ? t('正在获取远程更新…') : t('获取远程更新')}
          title={t('获取远程更新')}
          disabled={fetching}
          onClick={() => void fetchRemote()}
        />
        <Button
          size="small"
          variant="plain"
          icon="arrow-down"
          onClick={() => void runGitAction(groupId, tab.botId, { action: 'pull' })}
        >
          {owner ? t('拉取') : t('申请拉取')}
          {git.behind ? <span className="git-menu__note">↓{git.behind}</span> : null}
        </Button>
        <Button size="small" variant="plain" icon="arrow-up" onClick={() => setPushing(true)}>
          {owner ? t('推送…') : t('申请推送…')}
          <span className="git-menu__note">
            {git.ahead == null ? t('未发布#branch') : git.ahead ? `↑${git.ahead}` : t('无新提交')}
          </span>
        </Button>
        <Button
          size="small"
          variant="plain"
          icon="clock"
          onClick={() => openTab({ kind: 'git-log', botId: tab.botId, ref: null, commit: null })}
        >
          {t('提交历史')}
        </Button>
      </div>
      <div className="wb-git__main">
        <div className="wb-git__side">
          <Section
            title={
              <>
                {t('更改')}
                {changes.length ? (
                  <span className="wb-git__count">
                    {t('已选 {n} / {total} 个文件', { n: picked.length, total: changes.length })}
                  </span>
                ) : null}
              </>
            }
          >
            <TextField
              multiline
              label={t('提交说明')}
              value={message}
              autoGrow
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={keyDown}
            />
            <div className="wb-git__commit">
              {changes.length ? (
                <Button
                  size="small"
                  variant="plain"
                  onClick={() => setSkipped(all ? new Set(changes.map((c) => c.path)) : new Set())}
                >
                  {all ? t('取消全选') : t('全选')}
                </Button>
              ) : null}
              <span className="spacer" />
              <Button size="small" variant="primary" disabled={!ready} onClick={() => void commit()}>
                {busy ? <Spinner size={12} /> : null}
                {owner ? t('提交') : t('提交申请')}
              </Button>
            </div>
            {!rootRepo ? (
              <EmptyState
                compact
                icon="folder-git"
                title={t('根目录不是 Git 仓库，各子仓库的改动在分支菜单中查看')}
              />
            ) : list.error ? (
              <Alert variant="error" description={t('读取改动失败：{error}', { error: list.error })} />
            ) : !list.changes ? (
              <div className="git-refs__note">
                <Spinner size={14} />
              </div>
            ) : changes.length ? (
              <ChangeTree
                changes={changes}
                skipped={skipped}
                selected={shown?.path ?? null}
                onToggle={toggle}
                onPick={pick}
              />
            ) : (
              <EmptyState compact icon="checkmark-circle" title={t('没有未提交的改动')} />
            )}
          </Section>
          <Section title={t('操作记录')}>
            <GitOperationList groupId={groupId} botId={tab.botId} focus={tab.focus ?? null} />
          </Section>
        </div>
        {wide ? (
          <div className="wb-git__diff">
            {shown ? (
              <GitFileDiff
                key={shown.path}
                url={gitUrls.diff(base, 'HEAD', null, shown.path)}
                path={shown.path}
                stamp={stamp}
              />
            ) : (
              <EmptyState compact icon="doc-text" title={t('选择一个文件查看改动')} />
            )}
          </div>
        ) : null}
      </div>
      <Presence>
        {pushing ? (
          <PushDialog
            groupId={groupId}
            botId={tab.botId}
            git={git}
            owner={owner}
            base={group?.protectBase ? (group.repo?.branch ?? null) : null}
            onClose={() => setPushing(false)}
          />
        ) : null}
      </Presence>
    </div>
  )
}

export function useGitTabMeta(tab: TabProps<'git'>['tab']): TabMeta {
  const groupId = useWorkbench((s) => s.groupId) ?? ''
  const name = useWorkspace((s) => s.bots.find((b) => b.id === tab.botId)?.name) ?? 'Bot'
  const pending = useGitOps(groupId).filter(
    (o) => o.botId === tab.botId && o.status === 'pending_approval',
  ).length
  return {
    icon: 'git-branch',
    title: t('Git · {name}', { name }),
    badge: pending ? t('待审批 {n}', { n: pending }) : undefined,
  }
}
