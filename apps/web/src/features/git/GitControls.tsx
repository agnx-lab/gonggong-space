import type { GitStatus, GroupDto } from '@gonggong/protocol'
import { useState } from 'react'
import { t } from '../../i18n'
import { Alert, Checkbox, Dialog, Icon, Popover, PopUpButton, Presence, TextField } from '../../ui'
import { openTab } from '../workbench/open'
import { runGitAction, useGitRefs } from './api'
import { openGitPanel } from './GitOperations'
import { RefList } from './RefList'
import './git.css'

interface BotGit {
  groupId: string
  botId: string
  name: string
  git: GitStatus
}

/** Remote-tracking `origin/feat` checks out as the local `feat` (git creates it tracking the remote). */
const localName = (name: string, remotes: string[]) => {
  const remote = remotes.find((r) => name.startsWith(`${r}/`))
  return remote ? name.slice(remote.length + 1) : name
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
    <>
      <RefList
        refs={refs}
        error={error}
        onPick={(b, name) => {
          if (!b?.current) onPick(localName(name, refs?.remotes.map((r) => r.name) ?? []))
        }}
      />
      {refs?.remotes.length ? (
        <div className="git-refs__group">
          <div className="git-refs__head">{t('远程仓库')}</div>
          {refs.remotes.map((r) => (
            <div key={r.name} className="git-refs__remote">
              <span className="git-refs__name">{r.name}</span>
              <span className="git-refs__url">{r.url}</span>
            </div>
          ))}
        </div>
      ) : null}
    </>
  )
}

/** The bar's branch name: opens the branches to switch to (checkout after confirming) and the remotes. */
export function BranchPicker({ groupId, botId, name, git }: BotGit) {
  const [target, setTarget] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const checkout = async (branch: string) => {
    setBusy(true)
    const ok = await runGitAction(groupId, botId, { action: 'checkout', branch })
    setBusy(false)
    if (ok) setTarget(null)
  }
  return (
    <>
      <Popover
        portal
        placement="bottom-start"
        width={320}
        aria-label={t('{name} 的分支', { name })}
        trigger={
          <button
            type="button"
            className="git-bar__branch git-bar__branch-btn"
            aria-label={t('切换 {name} 的分支', { name })}
          >
            {git.branch ?? '—'}
          </button>
        }
      >
        {(close) => (
          <BranchList
            groupId={groupId}
            botId={botId}
            onPick={(b) => {
              close()
              setTarget(b)
            }}
          />
        )}
      </Popover>
      <Presence>
        {target ? (
          <Dialog
            open
            title={t('切换分支')}
            message={t('将 {name} 的工作区切换到 {branch}', { name, branch: target })}
            onClose={() => setTarget(null)}
            actions={[
              { label: t('取消'), onClick: () => setTarget(null) },
              { label: t('切换'), variant: 'primary', disabled: busy, onClick: () => void checkout(target) },
            ]}
          >
            {git.dirty ? (
              <Alert variant="warning" description={t('工作区有未提交改动，切换可能失败')} />
            ) : null}
          </Dialog>
        ) : null}
      </Presence>
    </>
  )
}

function CommitDialog({ groupId, botId, git, onClose }: Omit<BotGit, 'name'> & { onClose: () => void }) {
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async () => {
    setBusy(true)
    if (await runGitAction(groupId, botId, { action: 'commit', message: message.trim() })) onClose()
    else setBusy(false)
  }
  return (
    <Dialog
      open
      title={t('提交改动')}
      message={
        git.dirtyCount != null
          ? t('{n} 个未提交文件', { n: git.dirtyCount })
          : git.dirty
            ? t('有未提交改动')
            : t('无未提交改动')
      }
      closeOnBackdrop={false}
      onClose={onClose}
      actions={[
        { label: t('取消'), onClick: onClose },
        {
          label: t('提交'),
          variant: 'primary',
          disabled: busy || !message.trim(),
          onClick: () => void submit(),
        },
      ]}
    >
      <TextField
        multiline
        label={t('提交说明')}
        value={message}
        autoGrow
        onChange={(e) => setMessage(e.target.value)}
      />
    </Dialog>
  )
}

function PushDialog({
  groupId,
  botId,
  git,
  base,
  onClose,
}: Omit<BotGit, 'name'> & { base: string | null; onClose: () => void }) {
  const { refs } = useGitRefs(groupId, botId)
  const [remote, setRemote] = useState<string | null>(null)
  const [branch, setBranch] = useState(git.branch ?? '')
  const [confirmed, setConfirmed] = useState(false)
  const [busy, setBusy] = useState(false)
  const remotes = refs?.remotes ?? []
  const picked = remote ?? remotes.find((r) => r.name === 'origin')?.name ?? remotes[0]?.name ?? 'origin'
  const target = branch.trim()
  const toBase = !!base && target === base
  const submit = async () => {
    setBusy(true)
    const req = { action: 'push' as const, remote: picked, branch: target, confirmBase: toBase }
    if (await runGitAction(groupId, botId, req)) onClose()
    else setBusy(false)
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
          label: t('推送'),
          variant: toBase ? 'destructive' : 'primary',
          disabled: busy || !target || (toBase && !confirmed),
          onClick: () => void submit(),
        },
      ]}
    >
      <div className="git-form">
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

type Open = 'commit' | 'push' | null

/** The bar's git menu: pull, commit, push, history and the operation log; non-owners' actions become requests. */
export function GitActions({ group, botId, name, git }: Omit<BotGit, 'groupId'> & { group: GroupDto }) {
  const [open, setOpen] = useState<Open>(null)
  const groupId = group.id
  const item = (
    icon: Parameters<typeof Icon>[0]['name'],
    label: string,
    run: () => void,
    close: () => void,
  ) => (
    <button
      type="button"
      className="git-subs__item"
      onClick={() => {
        close()
        run()
      }}
    >
      <Icon name={icon} size={13} />
      {label}
    </button>
  )
  return (
    <>
      <Popover
        portal
        placement="bottom-end"
        width={200}
        aria-label={t('{name} 的 Git 操作', { name })}
        trigger={
          <button
            type="button"
            className="git-bar__act"
            aria-label={t('{name} 的 Git 操作', { name })}
            title={t('Git 操作')}
          >
            <Icon name="git-fork" size={13} />
          </button>
        }
      >
        {(close) => (
          <div className="git-subs">
            {item(
              'arrow-down',
              t('拉取'),
              () => void runGitAction(groupId, botId, { action: 'pull' }),
              close,
            )}
            {item('checkmark-circle', t('提交…'), () => setOpen('commit'), close)}
            {item('arrow-up', t('推送…'), () => setOpen('push'), close)}
            {item(
              'clock',
              t('提交历史'),
              () => openTab({ kind: 'git-log', botId, ref: null, commit: null }),
              close,
            )}
            {item('list', t('操作记录'), () => openGitPanel(groupId, botId), close)}
          </div>
        )}
      </Popover>
      <Presence>
        {open === 'commit' ? (
          <CommitDialog groupId={groupId} botId={botId} git={git} onClose={() => setOpen(null)} />
        ) : open === 'push' ? (
          <PushDialog
            groupId={groupId}
            botId={botId}
            git={git}
            base={group.protectBase ? (group.repo?.branch ?? null) : null}
            onClose={() => setOpen(null)}
          />
        ) : null}
      </Presence>
    </>
  )
}
