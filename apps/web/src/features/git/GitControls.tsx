import type { GitChange, GitCompareDto, GitStatus, GroupDto } from '@gonggong/protocol'
import { type KeyboardEvent, useEffect, useState } from 'react'
import { useSession } from '../../app/session'
import { useWorkspace } from '../../app/workspace'
import { t } from '../../i18n'
import { api, errorText } from '../../lib/api'
import { toastError } from '../../lib/errors'
import {
  Alert,
  Button,
  Checkbox,
  Dialog,
  EmptyState,
  Icon,
  type IconName,
  Popover,
  PopUpButton,
  Presence,
  Spinner,
  TextField,
} from '../../ui'
import { openTab } from '../workbench/open'
import {
  gitActionTaken,
  gitBase,
  gitUrls,
  refreshGit,
  refreshGitQuietly,
  runGitAction,
  useGitRefs,
} from './api'
import { ChangeMark } from './changes'
import { openGitPanel } from './GitOperations'
import { RefList } from './RefList'
import './git.css'

interface BotGit {
  groupId: string
  botId: string
  name: string
  git: GitStatus
}

/** Anyone but the bot's owner only requests git actions, which the owner then approves. */
function useOwner(botId: string) {
  const me = useSession((s) => s.user?.id)
  const bot = useWorkspace((s) => s.bots.find((b) => b.id === botId))
  return { owner: !!me && bot?.ownerId === me, ownerName: bot?.ownerName ?? '' }
}

/** The bar's branch name: opens the branches; a clean tree switches at once, uncommitted work asks first. */
export function BranchPicker({ groupId, botId, name, git }: BotGit) {
  const { owner, ownerName } = useOwner(botId)
  const [target, setTarget] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const checkout = async (branch: string) => {
    setBusy(true)
    const op = await runGitAction(groupId, botId, { action: 'checkout', branch })
    setBusy(false)
    if (gitActionTaken(op)) setTarget(null)
  }
  const pick = (branch: string) => {
    if (git.dirty || !owner) setTarget(branch)
    else void checkout(branch)
  }
  return (
    <>
      <Popover
        portal
        placement="bottom-start"
        width={320}
        aria-label={t('{name} 的分支', { name })}
        onOpenChange={(open) => open && refreshGitQuietly(groupId, botId)}
        trigger={
          <button
            type="button"
            className="git-bar__branch git-bar__branch-btn"
            aria-label={t('切换 {name} 的分支', { name })}
            disabled={busy}
          >
            {busy && !target ? (
              <>
                <Spinner size={10} />
                {t('切换中…')}
              </>
            ) : (
              <>
                {git.branch ?? '—'}
                <Icon name="chevron-down" size={10} />
              </>
            )}
          </button>
        }
      >
        {(close) => (
          <BranchList
            groupId={groupId}
            botId={botId}
            onPick={(b) => {
              close()
              pick(b)
            }}
          />
        )}
      </Popover>
      <Presence>
        {target ? (
          <Dialog
            open
            title={owner ? t('切换分支') : t('申请切换分支')}
            message={t('将 {name} 的工作区切换到 {branch}', { name, branch: target })}
            onClose={() => setTarget(null)}
            actions={[
              { label: t('取消'), onClick: () => setTarget(null) },
              {
                label: owner ? t('切换') : t('提交申请'),
                variant: 'primary',
                disabled: busy,
                onClick: () => void checkout(target),
              },
            ]}
          >
            <div className="git-form">
              {owner ? null : (
                <Alert description={t('需要 Bot 主人 {name} 批准后才会切换', { name: ownerName })} />
              )}
              {git.dirty ? (
                <Alert
                  variant="warning"
                  description={t('未提交的改动会带到新分支；与目标分支冲突时 git 会拒绝切换')}
                />
              ) : null}
            </div>
          </Dialog>
        ) : null}
      </Presence>
    </>
  )
}

function BranchList({
  groupId,
  botId,
  onPick,
}: {
  groupId: string
  botId: string
  onPick: (b: string) => void
}) {
  const { refs, error } = useGitRefs(groupId, botId)
  return (
    <RefList
      refs={refs}
      error={error}
      onPick={(b, name) => {
        // A remote-tracking `origin/feat` goes as is: the daemon switches to (or creates) the local `feat` tracking it.
        if (!b?.current) onPick(name)
      }}
    />
  )
}

/** What a commit dialog left behind to look at a file's diff: restored when it reopens. */
const drafts = new Map<string, { message: string; skipped: string[] }>()

function CommitDialog({
  groupId,
  botId,
  owner,
  onClose,
}: Omit<BotGit, 'name' | 'git'> & { owner: boolean; onClose: () => void }) {
  const key = `${groupId}/${botId}`
  const [draft] = useState(() => drafts.get(key))
  const [message, setMessage] = useState(draft?.message ?? '')
  // Unpicked rather than picked: files that turn up later start picked.
  const [skipped, setSkipped] = useState(() => new Set(draft?.skipped))
  const [list, setList] = useState<{ changes: GitChange[] | null; error: string | null }>({
    changes: null,
    error: null,
  })
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    let live = true
    refreshGitQuietly(groupId, botId)
    api.get<GitCompareDto>(gitUrls.compare(gitBase(groupId, botId), 'HEAD', null)).then(
      (r) => live && setList({ changes: r.changes, error: null }),
      (e: unknown) => live && setList({ changes: null, error: errorText(e) }),
    )
    return () => {
      live = false
    }
  }, [groupId, botId])
  const changes = list.changes ?? []
  const picked = changes.filter((c) => !skipped.has(c.path))
  const all = picked.length === changes.length
  const ready = !busy && !!message.trim() && picked.length > 0
  const close = () => {
    drafts.delete(key)
    onClose()
  }
  const submit = async () => {
    if (!ready) return
    setBusy(true)
    // A rename commits both sides: the old path's removal and the new one.
    const paths = picked.flatMap((c) => (c.oldPath ? [c.oldPath, c.path] : [c.path]))
    const op = await runGitAction(groupId, botId, { action: 'commit', message: message.trim(), paths })
    if (gitActionTaken(op)) close()
    else setBusy(false)
  }
  const view = (c: GitChange) => {
    drafts.set(key, { message, skipped: [...skipped] })
    onClose()
    openTab({ kind: 'diff', botId, scope: 'uncommitted', file: c.path, repo: null })
  }
  const toggle = (path: string, on: boolean) =>
    setSkipped((s) => {
      const next = new Set(s)
      if (on) next.delete(path)
      else next.add(path)
      return next
    })
  const keyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Enter' || !(e.metaKey || e.ctrlKey)) return
    e.preventDefault()
    void submit()
  }
  return (
    <Dialog
      open
      title={t('提交改动')}
      message={
        changes.length
          ? t('已选 {n} / {total} 个文件', { n: picked.length, total: changes.length })
          : undefined
      }
      width={520}
      closeOnBackdrop={false}
      onClose={close}
      footer={
        changes.length ? (
          <Button
            size="small"
            variant="plain"
            onClick={() => setSkipped(all ? new Set(changes.map((c) => c.path)) : new Set())}
          >
            {all ? t('取消全选') : t('全选')}
          </Button>
        ) : undefined
      }
      actions={[
        { label: t('取消'), onClick: close },
        {
          label: owner ? t('提交') : t('提交申请'),
          variant: 'primary',
          disabled: !ready,
          onClick: () => void submit(),
        },
      ]}
    >
      <div className="git-form">
        {list.error ? (
          <Alert variant="error" description={t('读取改动失败：{error}', { error: list.error })} />
        ) : !list.changes ? (
          <div className="git-refs__note">
            <Spinner size={14} />
          </div>
        ) : changes.length ? (
          <ul className="git-commit__files" aria-label={t('要提交的文件')}>
            {changes.map((c) => (
              <li key={c.path} className="git-commit__file">
                <Checkbox
                  checked={!skipped.has(c.path)}
                  onChange={(on) => toggle(c.path, on)}
                  label={<span className="git-sr">{c.path}</span>}
                />
                <button
                  type="button"
                  className="git-change"
                  title={c.path}
                  aria-label={t('查看 {path} 的改动', { path: c.path })}
                  onClick={() => view(c)}
                >
                  <ChangeMark change={c.change} />
                  <span className="git-commit__path">{c.oldPath ? `${c.oldPath} → ${c.path}` : c.path}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState compact icon="checkmark-circle" title={t('没有未提交的改动')} />
        )}
        <TextField
          multiline
          label={t('提交说明')}
          value={message}
          autoGrow
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={keyDown}
        />
      </div>
    </Dialog>
  )
}

/** git's words for a push the remote refused because it moved on. */
const REJECTED = /rejected|non-fast-forward|fetch first/i

function PushDialog({
  groupId,
  botId,
  git,
  base,
  owner,
  onClose,
}: Omit<BotGit, 'name'> & { base: string | null; owner: boolean; onClose: () => void }) {
  const { refs } = useGitRefs(groupId, botId)
  const [remote, setRemote] = useState<string | null>(null)
  const [branch, setBranch] = useState(git.branch ?? '')
  const [confirmed, setConfirmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [rejected, setRejected] = useState(false)
  const remotes = refs?.remotes ?? []
  const picked = remote ?? remotes.find((r) => r.name === 'origin')?.name ?? remotes[0]?.name ?? 'origin'
  const target = branch.trim()
  const toBase = !!base && target === base
  const current = refs?.branches.find((b) => b.kind === 'local' && b.current)
  const dest = `${picked}/${target}`
  const summary =
    !refs || !target
      ? null
      : target !== git.branch || (current?.upstream && current.upstream !== dest)
        ? t('将 {branch} 推送到 {dest}', { branch: git.branch ?? 'HEAD', dest })
        : !current?.upstream
          ? t('首次推送，会在远程创建 {branch} 并设为上游', { branch: target })
          : current.ahead
            ? t('将 {n} 个提交推送到 {dest}', { n: current.ahead, dest })
            : t('{dest} 已包含全部提交，没有新的提交可推送', { dest })
  const submit = async () => {
    setBusy(true)
    setRejected(false)
    const req = { action: 'push' as const, remote: picked, branch: target, confirmBase: toBase }
    const op = await runGitAction(groupId, botId, req)
    if (gitActionTaken(op)) return onClose()
    setBusy(false)
    setRejected(REJECTED.test(op?.error ?? ''))
  }
  return (
    <Dialog
      open
      title={t('推送')}
      closeOnBackdrop={false}
      onClose={onClose}
      actions={[
        { label: t('取消'), onClick: onClose },
        {
          label: owner ? t('推送') : t('提交申请'),
          variant: toBase ? 'destructive' : 'primary',
          disabled: busy || !target || (toBase && !confirmed),
          onClick: () => void submit(),
        },
      ]}
    >
      <div className="git-form">
        {summary ? <p className="git-form__summary">{summary}</p> : null}
        <span className="git-form__label">{t('远程')}</span>
        {remotes.length ? (
          <PopUpButton
            aria-label={t('远程')}
            value={picked}
            onChange={setRemote}
            options={remotes.map((r) => ({ value: r.name, label: r.name }))}
          />
        ) : (
          <span className="git-refs__name">{picked}</span>
        )}
        <TextField label={t('分支')} value={branch} onChange={(e) => setBranch(e.target.value)} />
        {rejected ? <Alert variant="warning" description={t('远程有新的提交，请先拉取再推送')} /> : null}
        {toBase ? (
          <Alert
            variant="warning"
            description={t('{branch} 是受保护的基准分支，推送会直接改动它', { branch: target })}
          >
            <Checkbox label={t('我确认推送到基准分支')} checked={confirmed} onChange={setConfirmed} />
          </Alert>
        ) : null}
      </div>
    </Dialog>
  )
}

function MenuItem({
  icon,
  label,
  note,
  disabled,
  spin,
  aria,
  onClick,
}: {
  icon: IconName
  label: string
  note?: string | null
  disabled?: boolean
  spin?: boolean
  aria?: string
  onClick: () => void
}) {
  return (
    <button type="button" className="git-subs__item" aria-label={aria} disabled={disabled} onClick={onClick}>
      <span className="git-menu__icon" data-spin={spin || undefined}>
        <Icon name={icon} size={13} />
      </span>
      {label}
      {note ? <span className="git-menu__note">{note}</span> : null}
    </button>
  )
}

type Open = 'commit' | 'push' | null

/**
 * The bar's one git menu: the changes, fetch, pull, commit, push, history and the operation log, with how far the
 * branch is from its upstream; non-owners' actions read as requests.
 */
export function GitActions({
  group,
  botId,
  name,
  git,
  onDiff,
}: Omit<BotGit, 'groupId'> & { group: GroupDto; onDiff: () => void }) {
  const { owner } = useOwner(botId)
  const [open, setOpen] = useState<Open>(null)
  const [fetching, setFetching] = useState(false)
  const groupId = group.id
  const fetchRemote = async () => {
    setFetching(true)
    try {
      await refreshGit(groupId, botId, true)
    } catch (e) {
      toastError(e)
    }
    setFetching(false)
  }
  const pushNote = git.ahead == null ? t('未发布#branch') : git.ahead ? `↑${git.ahead}` : t('无新提交')
  return (
    <>
      <Popover
        portal
        placement="bottom-end"
        width={220}
        aria-label={t('{name} 的 Git 操作', { name })}
        onOpenChange={(o) => o && refreshGitQuietly(groupId, botId)}
        trigger={
          <button
            type="button"
            className="git-bar__act"
            aria-label={t('{name} 的 Git 操作', { name })}
            title={t('Git 操作')}
          >
            <Icon name="git-branch" size={13} />
          </button>
        }
      >
        {(close) => {
          const then = (run: () => void) => () => {
            close()
            run()
          }
          return (
            <div className="git-subs">
              <MenuItem
                icon="doc-text"
                label={t('查看改动')}
                aria={t('查看 {name} 的改动', { name })}
                onClick={then(onDiff)}
              />
              <MenuItem
                icon="arrow-clockwise"
                label={fetching ? t('正在获取远程更新…') : t('获取远程更新')}
                disabled={fetching}
                spin={fetching}
                onClick={() => void fetchRemote()}
              />
              <MenuItem
                icon="arrow-down"
                label={owner ? t('拉取') : t('申请拉取')}
                note={git.behind ? `↓${git.behind}` : null}
                onClick={then(() => void runGitAction(groupId, botId, { action: 'pull' }))}
              />
              <MenuItem
                icon="checkmark-circle"
                label={owner ? t('提交…') : t('申请提交…')}
                disabled={!git.dirty}
                onClick={then(() => setOpen('commit'))}
              />
              <MenuItem
                icon="arrow-up"
                label={owner ? t('推送…') : t('申请推送…')}
                note={pushNote}
                onClick={then(() => setOpen('push'))}
              />
              <MenuItem
                icon="clock"
                label={t('提交历史')}
                onClick={then(() => openTab({ kind: 'git-log', botId, ref: null, commit: null }))}
              />
              <MenuItem
                icon="list"
                label={t('操作记录')}
                onClick={then(() => openGitPanel(groupId, botId))}
              />
            </div>
          )
        }}
      </Popover>
      <Presence>
        {open === 'commit' ? (
          <CommitDialog groupId={groupId} botId={botId} owner={owner} onClose={() => setOpen(null)} />
        ) : open === 'push' ? (
          <PushDialog
            groupId={groupId}
            botId={botId}
            git={git}
            owner={owner}
            base={group.protectBase ? (group.repo?.branch ?? null) : null}
            onClose={() => setOpen(null)}
          />
        ) : null}
      </Presence>
    </>
  )
}
