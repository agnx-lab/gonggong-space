import type { GroupBotStateDto, GroupDto, RepoStatus } from '@gonggong/protocol'
import { useEffect, useRef } from 'react'
import { useSession } from '../../app/session'
import { loadBotStates, loadGitOperations, useWorkspace } from '../../app/workspace'
import { t } from '../../i18n'
import { copyWithToast } from '../../lib/clipboard'
import { realtime } from '../../lib/realtime'
import { Icon, type IconName } from '../../ui'
import { refreshGitQuietly } from '../git/api'
import { BranchLabel, WorkspaceMenu } from '../git/GitControls'
import { PendingBadge } from '../git/GitOperations'
import { openTab } from '../workbench/open'
import { ContextMeter } from './ContextMeter'

const WORKSPACE_LABEL = { managed: t('托管目录'), cd: t('本机目录') }
const FOCUS_REFRESH_MS = 30_000

function Commits({ icon, name, n }: { icon: IconName; name: string; n: number }) {
  return (
    <span className="git-bar__ab" role="img" aria-label={name} title={name}>
      <Icon name={icon} size={12} />
      {n}
    </span>
  )
}

/** 执行位置 at the head of a bot's menu: where it works in this group, to tell which code it is changing (郑晓佳 #1488). */
function Where({
  s,
  repo,
  machine,
}: {
  s: GroupBotStateDto
  repo: GroupDto['repo']
  machine: string | null
}) {
  const current = s.git?.branch ?? null
  return (
    <dl className="git-loc">
      <dt>{t('机器')}</dt>
      <dd>{machine ?? t('未绑定机器')}</dd>
      <dt>{t('目录#one')}</dt>
      <dd className="git-loc__dir">
        <span className="git-loc__mono">
          {s.path ?? '—'}
          <span className="git-loc__kind">{WORKSPACE_LABEL[s.workspace]}</span>
        </span>
        {s.path ? (
          <button
            type="button"
            className="git-bar__act"
            aria-label={t('复制目录')}
            onClick={() => void copyWithToast(s.path ?? '', t('已复制目录'))}
          >
            <Icon name="copy" size={13} />
          </button>
        ) : null}
      </dd>
      <dt>{t('仓库')}</dt>
      {repo ? <dd className="git-loc__mono">{repo.url}</dd> : <dd>{t('未绑定仓库')}</dd>}
      {repo ? (
        <>
          <dt>{t('基准')}</dt>
          <dd>
            <span className="git-loc__mono">{repo.branch}</span>
            {current && current !== repo.branch ? (
              <span className="git-loc__warn">{t('当前在 {branch}', { branch: current })}</span>
            ) : null}
          </dd>
        </>
      ) : null}
      {s.extraDirs.length ? (
        <>
          <dt>{t('附加目录')}</dt>
          <dd>
            {s.extraDirs.map((d) => (
              <div key={d} className="git-loc__mono">
                {d}
              </div>
            ))}
          </dd>
        </>
      ) : null}
    </dl>
  )
}

function Item({
  group,
  name,
  s,
  showGit,
  machine,
}: {
  group: GroupDto
  name: string
  s: GroupBotStateDto
  /** Partition groups with a repo, where the bar shows each bot's git status. */
  showGit: boolean
  machine: string | null
}) {
  const groupId = group.id
  const git = s.git
  const hint =
    s.state === 'unbound' ? (
      <span className="git-bar__hint">{t('待绑定')}</span>
    ) : s.state === 'confirm' ? (
      <span className="git-bar__hint">{t('待主人确认')}</span>
    ) : s.state === 'pending' && !git ? (
      <span className="git-bar__hint">{t('待创建')}</span>
    ) : s.state === 'cloning' ? (
      <span className="git-bar__hint">{t('clone 中…')}</span>
    ) : s.state === 'failed' ? (
      <span className="git-bar__error" title={s.error ?? undefined}>
        {t('工作区创建失败')}
      </span>
    ) : null
  // Uncommitted work first; a clean feature branch shows what it holds against main.
  const diff = git
    ? () => openTab({ kind: 'diff', botId: s.botId, scope: git.dirty ? 'uncommitted' : 'base', file: null })
    : undefined
  const files =
    git || s.state === 'ready'
      ? () => openTab({ kind: 'files', botId: s.botId, dir: '', selected: null })
      : undefined
  return (
    <div className="git-bar__item" data-testid={`git-${s.botId}`}>
      <span className="git-bar__name">{name}</span>
      {showGit ? (
        <>
          {hint ?? (
            <>
              {git ? (
                <button
                  type="button"
                  className="git-bar__branch git-bar__branch-btn"
                  aria-label={t('打开 {name} 的 Git', { name })}
                  title={t('Git 面板')}
                  onClick={() => openTab({ kind: 'git', botId: s.botId })}
                >
                  <BranchLabel git={git} />
                </button>
              ) : (
                <span className="git-bar__branch">—</span>
              )}
              {git?.behind ? (
                <Commits icon="arrow-down" name={t('落后 {n} 个提交', { n: git.behind })} n={git.behind} />
              ) : null}
              {git?.ahead ? (
                <Commits icon="arrow-up" name={t('领先 {n} 个提交', { n: git.ahead })} n={git.ahead} />
              ) : null}
              {git?.dirty ? <span className="git-bar__dirty">{t('未提交')}</span> : null}
            </>
          )}
          <PendingBadge groupId={groupId} botId={s.botId} />
        </>
      ) : null}
      {s.context ? <ContextMeter groupId={groupId} bot={name} context={s.context} /> : null}
      <span className="git-bar__actions">
        <WorkspaceMenu
          botId={s.botId}
          name={name}
          git={showGit && !hint ? git : null}
          head={<Where s={s} repo={group.repo} machine={machine} />}
          showDiff={showGit}
          onDiff={hint ? undefined : diff}
          onFiles={files}
        />
      </span>
    </div>
  )
}

/**
 * Bot bar under the header: every bot's 执行位置, its context occupancy (once reported) and, in partition groups with
 * a repo, its git status refreshed after every turn (spec §5.3 / §8.4). The workspace banner reads the same states.
 */
export function GitBar({ group }: { group: GroupDto }) {
  const showGit = group.mode === 'partition' && !!group.repo
  const states = useWorkspace((s) => s.botStates[group.id])
  const bots = useWorkspace((s) => s.bots)
  const me = useSession((s) => s.user?.id)
  const botKey = group.botIds.join()

  // biome-ignore lint/correctness/useExhaustiveDependencies: reload when the group's bots change
  useEffect(() => {
    const load = () => {
      loadBotStates(group.id).catch(() => {})
      if (showGit) loadGitOperations(group.id).catch(() => {})
    }
    load()
    // Updates pushed while the socket was down are lost: catch up on reconnect.
    return realtime.onReconnect(load)
  }, [group.id, botKey, showGit])

  // The status is only taken after each turn: re-read it when the user comes back, as files may have changed since.
  const focusedAt = useRef(0)
  // biome-ignore lint/correctness/useExhaustiveDependencies: re-bind when the group's bots change
  useEffect(() => {
    if (!showGit) return
    const onFocus = () => {
      const now = Date.now()
      if (now - focusedAt.current < FOCUS_REFRESH_MS) return
      focusedAt.current = now
      const shown = useWorkspace.getState().botStates[group.id] ?? {}
      for (const id of group.botIds) if (shown[id]?.git) refreshGitQuietly(group.id, id)
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [group.id, botKey, showGit])

  if (!group.botIds.length) return null
  // My own bots first (what I act on most), the group's order otherwise; sort is stable.
  const mine = (id: string) => bots.find((b) => b.id === id)?.ownerId === me
  const ordered = [...group.botIds].sort((a, b) => Number(mine(b)) - Number(mine(a)))
  return (
    <div className="git-bar" data-testid="git-bar">
      {ordered.map((id) => {
        const bot = bots.find((b) => b.id === id)
        return (
          <Item
            key={id}
            group={group}
            showGit={showGit}
            machine={bot?.machineName ?? null}
            name={bot?.name ?? 'bot'}
            s={
              states?.[id] ?? {
                botId: id,
                workspace: 'managed',
                state: 'pending',
                path: null,
                git: null,
                error: null,
                reason: null,
                tier: null,
                model: null,
                effort: null,
                context: null,
                extraDirs: [],
              }
            }
          />
        )
      })}
    </div>
  )
}
