import type { GitOperationDto, GitOperationStatus } from '@gonggong/protocol'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { useSession } from '../../app/session'
import { useWorkbench } from '../../app/workbench'
import { useWorkspace } from '../../app/workspace'
import { t } from '../../i18n'
import { ago } from '../../lib/time'
import { Alert, Button, EmptyState, Tag, type TagTone } from '../../ui'
import { openTab } from '../workbench/open'
import { decideGitOperation } from './api'
import { ACTION_LABEL } from './notify'
import './git.css'

const NO_OPS: GitOperationDto[] = []

/** The bot's Git tab, pointing at `focus` in its operation log (a notification link). */
export const openGitPanel = (botId: string, focus: string | null = null) =>
  openTab({ kind: 'git', botId, focus, view: 'ops' })

const STATUS: Record<GitOperationStatus, { label: string; tone: TagTone }> = {
  pending_approval: { label: t('待审批'), tone: 'orange' },
  running: { label: t('执行中'), tone: 'blue' },
  succeeded: { label: t('已完成'), tone: 'green' },
  failed: { label: t('失败'), tone: 'red' },
  rejected: { label: t('已拒绝'), tone: 'gray' },
  expired: { label: t('已过期'), tone: 'gray' },
}

export const useGitOps = (groupId: string) => useWorkspace((s) => s.gitOps[groupId] ?? NO_OPS)

/** 待审批 N on a bot in the bar; opens its operation log. */
export function PendingBadge({ groupId, botId }: { groupId: string; botId: string }) {
  const ops = useGitOps(groupId)
  const n = ops.filter((o) => o.botId === botId && o.status === 'pending_approval').length
  if (!n) return null
  return (
    <button type="button" className="git-bar__pending" onClick={() => openGitPanel(botId)}>
      {t('待审批 {n}', { n })}
    </button>
  )
}

function Row({ op, owner, focused }: { op: GitOperationDto; owner: boolean; focused: boolean }) {
  const [busy, setBusy] = useState(false)
  const decide = async (approve: boolean) => {
    setBusy(true)
    await decideGitOperation(op.id, approve)
    setBusy(false)
  }
  const status = STATUS[op.status]
  const target = op.action === 'push' ? `${op.remote ?? 'origin'}/${op.branch ?? ''}` : op.branch
  return (
    <li
      className="git-op"
      data-testid={`git-op-${op.id}`}
      data-focused={focused || undefined}
      ref={focused ? (el) => el?.scrollIntoView?.({ block: 'nearest' }) : undefined}
    >
      <div className="git-op__head">
        <span className="git-op__action">{ACTION_LABEL[op.action]}</span>
        {op.repo ? <span className="git-op__mono">{op.repo}</span> : null}
        {target ? <span className="git-op__mono">{target}</span> : null}
        {op.paths?.length ? <span>{t('{n} 个文件', { n: op.paths.length })}</span> : null}
        <span className="spacer" />
        <Tag tone={status.tone}>{status.label}</Tag>
      </div>
      <div className="git-op__meta">
        <span>{op.requestedBy.name}</span>
        <span>{ago(op.createdAt)}</span>
        {op.decidedBy && op.decidedBy.id !== op.requestedBy.id ? (
          <span>{t('{name} 处理', { name: op.decidedBy.name })}</span>
        ) : null}
      </div>
      {op.message ? <div className="git-op__message">{op.message}</div> : null}
      {op.pushesBase && op.status === 'pending_approval' ? (
        <Alert variant="warning" description={t('批准即确认推送基准分支')} />
      ) : null}
      {op.error ? <div className="git-op__output git-op__output--error">{op.error}</div> : null}
      {op.output ? <div className="git-op__output">{op.output}</div> : null}
      {owner && op.status === 'pending_approval' ? (
        <div className="git-op__actions">
          <Button size="small" disabled={busy} onClick={() => void decide(false)}>
            {t('拒绝')}
          </Button>
          <Button
            size="small"
            variant={op.pushesBase ? 'destructive' : 'primary'}
            disabled={busy}
            onClick={() => void decide(true)}
          >
            {t('批准')}
          </Button>
        </div>
      ) : null}
    </li>
  )
}

/** A bot's git operations in the group, pending first: the owner approves or rejects requests, others follow them. */
export function GitOperationList({
  groupId,
  botId,
  focus,
}: {
  groupId: string
  botId: string
  focus: string | null
}) {
  const ops = useGitOps(groupId)
  const owner = useWorkspace((s) => s.bots.find((b) => b.id === botId)?.ownerId)
  const me = useSession((s) => s.user?.id)
  const list = ops.filter((o) => o.botId === botId)
  // Pending first, then newest first as the server sends them.
  const sorted = [
    ...list.filter((o) => o.status === 'pending_approval'),
    ...list.filter((o) => o.status !== 'pending_approval'),
  ]
  if (!sorted.length) return <EmptyState compact icon="git-branch" title={t('还没有 Git 操作')} />
  return (
    <ul className="git-ops">
      {sorted.map((o) => (
        <Row key={o.id} op={o} owner={!!me && owner === me} focused={o.id === focus} />
      ))}
    </ul>
  )
}

/** `?git=<operationId>` (a git request notification) opens that bot's Git tab once loaded, then leaves the URL. */
export function LinkedGitOperation({ groupId }: { groupId: string }) {
  const [params, setParams] = useSearchParams()
  const linked = params.get('git')
  const op = useWorkspace((s) => (linked ? s.gitOps[groupId]?.find((o) => o.id === linked) : undefined))
  const loaded = useWorkspace((s) => !!s.gitOps[groupId])
  // Tabs belong to the workbench's group: wait until it has switched to this one.
  const bench = useWorkbench((s) => s.groupId)
  useEffect(() => {
    if (!linked || !loaded || bench !== groupId) return
    if (op) openGitPanel(op.botId, op.id)
    setParams(
      (p) => {
        p.delete('git')
        return p
      },
      { replace: true },
    )
  }, [linked, loaded, op, groupId, bench, setParams])
  return null
}
