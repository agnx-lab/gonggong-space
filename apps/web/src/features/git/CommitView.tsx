import type { GitChangesDto } from '@gonggong/protocol'
import { useState } from 'react'
import { t } from '../../i18n'
import { Alert, Button, EmptyState, Icon, type MenuItem, Spinner, Tooltip } from '../../ui'
import { openTab } from '../workbench/open'
import type { GitTarget } from './api'
import {
  type ChangeGroup,
  type ChangeTarget,
  ChangeTree,
  folderPaths,
  type TreeChange,
  useChangeLayout,
} from './ChangeTree'
import { CommitBox } from './CommitBox'
import { gitCommands, ongoingLabel } from './commands'

/** A rename commits both sides: the old path's removal and the new one. */
export const commitPaths = (changes: TreeChange[]) =>
  changes.flatMap((c) => (c.oldPath ? [c.oldPath, c.path] : [c.path]))

/** The change list's groups: conflicts first, then tracked changes, then untracked files. */
export function changeGroups(data: GitChangesDto): ChangeGroup[] {
  return [
    {
      key: 'conflicts',
      label: t('合并冲突'),
      changes: data.conflicts.map((c) => ({ path: c.path, change: 'modified' as const, conflict: c })),
    },
    { key: 'changes', label: t('更改'), changes: data.changes.filter((c) => !c.untracked), checkable: true },
    {
      key: 'untracked',
      label: t('未跟踪的文件'),
      changes: data.changes.filter((c) => c.untracked),
      checkable: true,
    },
  ]
}

/**
 * IDEA's Commit window: the toolbar, the change tree with commit checkboxes and a context menu per file or folder, and
 * the message area. `onPick` shows a change (beside it when wide, in its own tab otherwise).
 */
export function CommitView({
  target,
  data,
  error,
  selected,
  onPick,
  onReload,
}: {
  target: GitTarget
  data: GitChangesDto | null
  error: string | null
  selected: string | null
  onPick: (c: TreeChange) => void
  onReload: () => void
}) {
  const layout = useChangeLayout((s) => s.layout)
  const toggleLayout = useChangeLayout((s) => s.toggle)
  // Unpicked rather than picked: files that turn up later start picked.
  const [skipped, setSkipped] = useState<ReadonlySet<string>>(new Set())
  const [closed, setClosed] = useState<ReadonlySet<string>>(new Set())
  const cmd = gitCommands(target)
  if (error) return <Alert variant="error" description={t('读取改动失败：{error}', { error })} />
  if (!data)
    return (
      <div className="git-refs__note">
        <Spinner size={14} />
      </div>
    )
  const groups = changeGroups(data)
  const all = data.changes
  const checked = new Set(all.filter((c) => !skipped.has(c.path)).map((c) => c.path))
  const picked = all.filter((c) => checked.has(c.path))
  const pickedOrAll = (target: ChangeTarget) => target.changes.filter((c) => !c.conflict)
  const check = (paths: string[], on: boolean) =>
    setSkipped((s) => {
      const next = new Set(s)
      for (const p of paths) {
        if (on) next.delete(p)
        else next.add(p)
      }
      return next
    })
  const toggleFolder = (key: string) =>
    setClosed((s) => {
      const next = new Set(s)
      if (!next.delete(key)) next.add(key)
      return next
    })
  const open = (c: TreeChange) =>
    c.conflict
      ? cmd.openMerge(c.path)
      : openTab({ kind: 'diff', botId: target.botId, scope: 'uncommitted', file: c.path, repo: target.repo })
  const rollback = (changes: TreeChange[]) =>
    changes.length &&
    cmd.discard(commitPaths(changes), changes.filter((c) => c.untracked).length, changes.length)
  const menu = (tg: ChangeTarget): MenuItem[] => {
    const f = tg.file
    const files = pickedOrAll(tg)
    if (f?.conflict)
      return [
        { value: 'merge', label: t('合并…'), icon: 'git-merge' },
        { value: 'ours', label: t('接受你的版本') },
        { value: 'theirs', label: t('接受他们的版本') },
        { separator: true },
        { value: 'copy', label: t('复制路径'), icon: 'copy' },
      ]
    return [
      ...(f
        ? ([
            { value: 'diff', label: t('显示差异'), icon: 'doc-text' },
            ...(f.change !== 'deleted' ? [{ value: 'open', label: t('打开文件'), icon: 'doc' }] : []),
            { separator: true },
          ] as MenuItem[])
        : []),
      { value: 'rollback', label: t('回滚…'), icon: 'undo', destructive: true, disabled: !files.length },
      { value: 'stash', label: t('贮藏所选文件…'), icon: 'archive', disabled: !files.length },
      ...(f
        ? ([
            { separator: true },
            { value: 'history', label: t('显示历史'), icon: 'clock', disabled: !!f.untracked },
            { value: 'copy', label: t('复制路径'), icon: 'copy' },
          ] as MenuItem[])
        : []),
    ]
  }
  const onMenu = (value: string, tg: ChangeTarget) => {
    const f = tg.file
    const files = pickedOrAll(tg)
    if (value === 'diff' && f) open(f)
    else if (value === 'open' && f)
      openTab({
        kind: 'file',
        source: { botId: target.botId, path: target.repo ? `${target.repo}/${f.path}` : f.path },
      })
    else if (value === 'rollback') rollback(files)
    else if (value === 'stash') cmd.stash(commitPaths(files))
    else if (value === 'history' && f) cmd.openLog({ path: f.path })
    else if (value === 'copy' && f) cmd.copy(f.path)
    else if (value === 'merge' && f) cmd.openMerge(f.path)
    else if ((value === 'ours' || value === 'theirs') && f) void cmd.resolve(f.path, value)
  }
  const ongoing = data.ongoing
  return (
    <div className="gc">
      <div className="gc-bar" role="toolbar" aria-label={t('更改')}>
        <ToolIcon icon="arrow-clockwise" label={t('刷新')} onClick={onReload} />
        <ToolIcon
          icon="undo"
          label={t('回滚所选文件…')}
          disabled={!picked.length}
          onClick={() => rollback(picked)}
        />
        <ToolIcon
          icon="doc-text"
          label={t('显示差异')}
          disabled={!selected}
          onClick={() => {
            const c = groups.flatMap((g) => g.changes).find((x) => x.path === selected)
            if (c) open(c)
          }}
        />
        <ToolIcon
          icon="archive"
          label={t('贮藏…')}
          disabled={!all.length}
          onClick={() => cmd.stash(picked.length === all.length ? null : commitPaths(picked))}
        />
        <span className="gc-bar__sep" />
        <ToolIcon
          icon={layout === 'tree' ? 'list' : 'folder'}
          label={layout === 'tree' ? t('平铺显示') : t('按目录分组')}
          onClick={toggleLayout}
        />
        <ToolIcon icon="plus" label={t('全部展开')} onClick={() => setClosed(new Set())} />
        <ToolIcon
          icon="minus"
          label={t('全部折叠')}
          onClick={() => setClosed(new Set(folderPaths(groups)))}
        />
        <span className="spacer" />
        {all.length ? (
          <button
            type="button"
            className="gc-bar__all"
            onClick={() =>
              setSkipped(picked.length === all.length ? new Set(all.map((c) => c.path)) : new Set())
            }
          >
            {picked.length === all.length ? t('取消全选') : t('全选')}
          </button>
        ) : null}
      </div>
      {data.limited ? (
        <Alert
          description={t('Bot 所在机器的客户端版本较旧：未跟踪文件、冲突与修改上一次提交需升级后使用')}
        />
      ) : null}
      <div className="gc-tree">
        {all.length || data.conflicts.length ? (
          <ChangeTree
            groups={groups}
            layout={layout}
            selected={selected}
            onSelect={onPick}
            onOpen={open}
            checked={checked}
            onCheck={check}
            closed={closed}
            onToggleFolder={toggleFolder}
            menu={menu}
            onMenu={onMenu}
            label={t('要提交的文件')}
          />
        ) : (
          <EmptyState
            compact
            icon="checkmark-circle"
            title={ongoing ? t('冲突已全部解决') : t('没有未提交的改动')}
            description={ongoing ? t('完成{op}后提交', { op: ongoingLabel(ongoing.kind) }) : undefined}
          />
        )}
      </div>
      <CommitBox
        target={target}
        paths={commitPaths(picked)}
        count={picked.length}
        head={data.head}
        total={all.length}
        onCommitted={() => setSkipped(new Set())}
      />
    </div>
  )
}

export function ToolIcon({
  icon,
  label,
  disabled,
  onClick,
}: {
  icon: Parameters<typeof Icon>[0]['name']
  label: string
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <Tooltip content={label}>
      <button type="button" className="gc-tool" aria-label={label} disabled={disabled} onClick={onClick}>
        <Icon name={icon} size={14} />
      </button>
    </Tooltip>
  )
}

/**
 * What stopped midway (IDEA's "Merging" / "Rebasing" state): the conflicts left and the ways out — resolve them,
 * continue (a merge commits with git's message), skip the commit, or abort.
 */
export function OngoingBanner({ target, data }: { target: GitTarget; data: GitChangesDto | null }) {
  const ongoing = data?.ongoing ?? null
  const conflicts = data?.conflicts ?? []
  if (!ongoing && !conflicts.length) return null
  const cmd = gitCommands(target)
  const subject = ongoing?.subject ?? ''
  const title = !ongoing
    ? t('有未解决的冲突')
    : ongoing.kind === 'merge'
      ? t('正在合并 {subject}', { subject })
      : ongoing.kind === 'rebase'
        ? ongoing.step && ongoing.total
          ? t('正在变基 {subject}（第 {step} / {total} 个提交）', {
              subject,
              step: ongoing.step,
              total: ongoing.total,
            })
          : t('正在变基 {subject}', { subject })
        : ongoing.kind === 'cherry-pick'
          ? t('正在优选 {subject}', { subject })
          : t('正在还原 {subject}', { subject })
  const [first] = conflicts
  return (
    <div className="gc-ongoing" role="status">
      <Icon name={conflicts.length ? 'warning' : 'git-merge'} size={15} />
      <div className="gc-ongoing__text">
        <span className="gc-ongoing__title">{title}</span>
        <span className="gc-ongoing__detail">
          {conflicts.length
            ? t('{n} 个文件有冲突，解决后才能继续', { n: conflicts.length })
            : t('冲突已全部解决，可以继续')}
        </span>
      </div>
      <span className="spacer" />
      {first ? (
        <Button size="small" variant="primary" onClick={() => cmd.openMerge(first.path)}>
          {t('解决冲突')}
        </Button>
      ) : ongoing ? (
        <Button size="small" variant="primary" onClick={() => cmd.continueOngoing(ongoing)}>
          {ongoing.kind === 'merge' ? t('提交合并…') : t('继续{op}', { op: ongoingLabel(ongoing.kind) })}
        </Button>
      ) : null}
      {ongoing && ongoing.kind !== 'merge' ? (
        <Button size="small" onClick={cmd.skipCommit}>
          {t('跳过此提交')}
        </Button>
      ) : null}
      <Button size="small" variant="plain" onClick={() => cmd.abortOngoing(ongoing)}>
        {ongoing ? t('中止{op}', { op: ongoingLabel(ongoing.kind) }) : t('放弃')}
      </Button>
    </div>
  )
}
