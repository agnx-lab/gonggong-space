import { useState } from 'react'
import { t } from '../../../i18n'
import { Alert, Checkbox, Dialog, RadioGroup, TextField } from '../../../ui'
import { useGitStamp } from '../../diff/useWorkspaceDiff'
import { type GitTarget, useGitRefs } from '../api'
import { gitCommands } from '../commands'
import { splitRemote } from '../refs'
import { badRefName, GitError, OwnerNote, RefCombo, useActionLabel, useGitRun, useRepoStatus } from './common'

interface Props {
  target: GitTarget
  onClose: () => void
}

type Mode = 'keep' | 'smart' | 'force'

/** Checking out with changes in the way (IDEA's Smart / Force Checkout), a detached revision, or a request. */
export function CheckoutDialog({ target, rev, detach, onClose }: Props & { rev: string; detach: boolean }) {
  const status = useRepoStatus(target)
  const [mode, setMode] = useState<Mode>('smart')
  const { busy, error, submit } = useGitRun(target, onClose)
  const label = useActionLabel(target.botId)
  const dirty = !!status?.dirty
  return (
    <Dialog
      open
      title={t('检出 {ref}', { ref: rev })}
      onClose={onClose}
      closeOnBackdrop={false}
      actions={[
        { label: t('取消'), onClick: onClose },
        {
          label: label(mode === 'force' && dirty ? t('强制检出') : t('检出')),
          variant: mode === 'force' && dirty ? 'destructive' : 'primary',
          disabled: busy,
          onClick: () => void submit({ action: 'checkout', branch: rev, detach, ...(dirty && { mode }) }),
        },
      ]}
    >
      <div className="git-form">
        <OwnerNote botId={target.botId} />
        {detach ? (
          <Alert description={t('将处于游离 HEAD 状态：新的提交不属于任何分支，切走前记得新建分支保存')} />
        ) : null}
        {dirty ? (
          <>
            <p className="git-form__summary">{t('工作区有未提交的改动')}</p>
            <RadioGroup<Mode>
              aria-label={t('未提交的改动')}
              value={mode}
              onChange={setMode}
              options={[
                {
                  value: 'smart',
                  label: (
                    <Choice
                      title={t('智能检出')}
                      detail={t('先贮藏改动，切换后再恢复；恢复有冲突时留给你解决')}
                    />
                  ),
                },
                {
                  value: 'keep',
                  label: <Choice title={t('带着改动切换')} detail={t('与目标分支冲突时 git 会拒绝切换')} />,
                },
                {
                  value: 'force',
                  label: <Choice title={t('强制检出')} detail={t('丢弃未提交的改动，无法恢复')} danger />,
                },
              ]}
            />
          </>
        ) : null}
        <GitError error={error} />
      </div>
    </Dialog>
  )
}

/** A radio option: a title and its explanation. */
export function Choice({ title, detail, danger }: { title: string; detail: string; danger?: boolean }) {
  return (
    <span className="git-choice">
      <span className="git-choice__title" data-danger={danger || undefined}>
        {title}
      </span>
      <span className="git-choice__detail">{detail}</span>
    </span>
  )
}

/** IDEA's Checkout Tag or Revision: anything not a local or remote branch is checked out detached. */
export function RevisionDialog({ target, onClose }: Props) {
  const stamp = useGitStamp(target.groupId, target.botId)
  const { refs } = useGitRefs(target.groupId, target.botId, target.repo, stamp)
  const [rev, setRev] = useState('')
  const ref = rev.trim()
  const branch = refs?.branches.some((b) => b.name === ref)
  return (
    <Dialog
      open
      title={t('检出标签或修订')}
      onClose={onClose}
      closeOnBackdrop={false}
      actions={[
        { label: t('取消'), onClick: onClose },
        {
          label: t('检出'),
          variant: 'primary',
          disabled: !ref,
          onClick: () => {
            onClose()
            gitCommands(target).checkout(ref, !branch)
          },
        },
      ]}
    >
      <div className="git-form">
        <RefCombo target={target} label={t('标签、分支或提交哈希')} value={rev} onChange={setRev} />
      </div>
    </Dialog>
  )
}

export function NewBranchDialog({ target, from, onClose }: Props & { from: string | null }) {
  const stamp = useGitStamp(target.groupId, target.botId)
  const { refs } = useGitRefs(target.groupId, target.botId, target.repo, stamp)
  const [name, setName] = useState('')
  const [start, setStart] = useState(from ?? '')
  const [checkout, setCheckout] = useState(true)
  const { busy, error, submit } = useGitRun(target, onClose)
  const label = useActionLabel(target.botId)
  const n = name.trim()
  const invalid =
    badRefName(n) ??
    (refs?.branches.some((b) => b.kind === 'local' && b.name === n)
      ? t('分支 {name} 已存在', { name: n })
      : null)
  return (
    <Dialog
      open
      title={t('新建分支')}
      message={from ? t('从 {ref} 新建', { ref: from }) : t('从当前 HEAD 新建')}
      onClose={onClose}
      closeOnBackdrop={false}
      actions={[
        { label: t('取消'), onClick: onClose },
        {
          label: label(t('创建')),
          variant: 'primary',
          disabled: busy || !n || !!invalid,
          onClick: () =>
            void submit({
              action: 'branch-create',
              name: n,
              checkout,
              ...(start.trim() && { from: start.trim() }),
            }),
        },
      ]}
    >
      <div className="git-form">
        <OwnerNote botId={target.botId} />
        <TextField
          label={t('新分支名称')}
          value={name}
          autoFocus
          error={invalid ?? undefined}
          placeholder="feature/…"
          onChange={(e) => setName(e.target.value)}
        />
        <RefCombo target={target} label={t('起点（留空为当前 HEAD）')} value={start} onChange={setStart} />
        <Checkbox label={t('创建后检出')} checked={checkout} onChange={setCheckout} />
        <GitError error={error} />
      </div>
    </Dialog>
  )
}

export function RenameBranchDialog({ target, branch, onClose }: Props & { branch: string }) {
  const [name, setName] = useState(branch)
  const { busy, error, submit } = useGitRun(target, onClose)
  const label = useActionLabel(target.botId)
  const n = name.trim()
  const invalid = badRefName(n)
  return (
    <Dialog
      open
      title={t('重命名分支 {branch}', { branch })}
      onClose={onClose}
      closeOnBackdrop={false}
      actions={[
        { label: t('取消'), onClick: onClose },
        {
          label: label(t('重命名')),
          variant: 'primary',
          disabled: busy || !n || n === branch || !!invalid,
          onClick: () => void submit({ action: 'branch-rename', branch, name: n }),
        },
      ]}
    >
      <div className="git-form">
        <OwnerNote botId={target.botId} />
        <TextField
          label={t('新名称')}
          value={name}
          autoFocus
          error={invalid ?? undefined}
          onChange={(e) => setName(e.target.value)}
        />
        <p className="git-form__hint">{t('只重命名本地分支；远程分支保持原名，下次推送时以新名称创建')}</p>
        <GitError error={error} />
      </div>
    </Dialog>
  )
}

const UNMERGED = /not fully merged|未完全合并/i

/** A local branch, or a remote-tracking one (deleted on its remote); unmerged commits ask to force it. */
export function DeleteBranchDialog({ target, branch, onClose }: Props & { branch: string }) {
  const stamp = useGitStamp(target.groupId, target.botId)
  const { refs } = useGitRefs(target.groupId, target.botId, target.repo, stamp)
  const [force, setForce] = useState(false)
  const { busy, error, submit } = useGitRun(target, onClose)
  const label = useActionLabel(target.botId)
  const remote = refs?.branches.find((b) => b.name === branch)?.kind === 'remote'
  const at = remote ? splitRemote(branch, refs?.remotes.map((r) => r.name) ?? []) : null
  const unmerged = !!error && UNMERGED.test(error)
  return (
    <Dialog
      open
      title={t('删除分支 {branch}', { branch })}
      onClose={onClose}
      closeOnBackdrop={false}
      actions={[
        { label: t('取消'), onClick: onClose },
        {
          label: label(unmerged ? t('仍然删除') : t('删除')),
          variant: 'destructive',
          disabled: busy || (unmerged && !force),
          onClick: () => void submit({ action: 'branch-delete', branch, force }),
        },
      ]}
    >
      <div className="git-form">
        <OwnerNote botId={target.botId} />
        <p className="git-form__summary">
          {at
            ? t('在远程 {remote} 上删除分支 {branch}，其他人将无法再拉取它', at)
            : t('删除本地分支 {branch}', { branch })}
        </p>
        {unmerged ? (
          <Alert
            variant="warning"
            description={t('{branch} 有尚未合并的提交，删除后这些提交只能从引用日志找回', { branch })}
          >
            <Checkbox label={t('我确认删除未合并的分支')} checked={force} onChange={setForce} />
          </Alert>
        ) : (
          <GitError error={error} />
        )}
      </div>
    </Dialog>
  )
}
