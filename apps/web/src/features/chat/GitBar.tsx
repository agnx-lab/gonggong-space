import type { GroupBotStateDto, GroupDto, RepoStatus } from '@gonggong/protocol'
import { useEffect } from 'react'
import { loadBotStates, useWorkspace } from '../../app/workspace'
import { t } from '../../i18n'
import { copyWithToast } from '../../lib/clipboard'
import { realtime } from '../../lib/realtime'
import { ago } from '../../lib/time'
import { Icon, type IconName, Popover } from '../../ui'
import { openTab } from '../workbench/open'
import { ContextMeter } from './ContextMeter'

const WORKSPACE_LABEL = { managed: t('托管'), cd: t('本机目录') }

function Commits({ icon, name, n }: { icon: IconName; name: string; n: number }) {
  return (
    <span className="git-bar__ab" role="img" aria-label={name} title={name}>
      <Icon name={icon} size={12} />
      {n}
    </span>
  )
}

/**
 * Submodules / nested repos of a bot workspace and the repos of its additional directories: a count that opens the
 * list, each entry opening its diff.
 */
function SubRepos({ botId, name, repos }: { botId: string; name: string; repos: RepoStatus[] }) {
  const changed = repos.filter((r) => r.dirty || !!r.ahead).length
  return (
    <Popover
      portal
      placement="bottom-start"
      width={300}
      aria-label={t('{name} 的子仓库', { name })}
      trigger={
        <button type="button" className="git-bar__subs" data-changed={changed > 0}>
          {changed ? t('+{n} 个子仓库有改动', { n: changed }) : t('{n} 个子仓库', { n: repos.length })}
        </button>
      }
    >
      {(close) => (
        <div className="git-subs">
          {repos.map((r) => (
            <button
              key={r.path}
              type="button"
              className="git-subs__item"
              onClick={() => {
                close()
                openTab({
                  kind: 'diff',
                  botId,
                  scope: r.dirty ? 'uncommitted' : 'base',
                  file: null,
                  repo: r.path,
                })
              }}
            >
              <span className="git-subs__path">{r.path}</span>
              {r.kind === 'extra' ? <span className="diff__repo-tag">{t('附加目录#one')}</span> : null}
              <span className="git-bar__branch">{r.branch ?? t('游离')}</span>
              {r.behind ? (
                <Commits icon="arrow-down" name={t('落后 {n} 个提交', { n: r.behind })} n={r.behind} />
              ) : null}
              {r.ahead ? (
                <Commits icon="arrow-up" name={t('领先 {n} 个提交', { n: r.ahead })} n={r.ahead} />
              ) : null}
              {r.dirty ? <span className="git-bar__dirty">{t('未提交')}</span> : null}
            </button>
          ))}
        </div>
      )}
    </Popover>
  )
}

/** 执行位置: where the bot works in this group, to tell which code it is changing (郑晓佳 #1488). */
function Location({
  name,
  s,
  repo,
  machine,
}: {
  name: string
  s: GroupBotStateDto
  repo: GroupDto['repo']
  machine: string | null
}) {
  const label = t('{name} 的执行位置', { name })
  const git = s.git
  const current = git?.branch ?? null
  const changes =
    git?.dirtyCount != null
      ? git.dirtyCount
        ? t('{n} 个未提交', { n: git.dirtyCount })
        : t('无未提交改动')
      : git?.dirty
        ? t('有未提交改动')
        : t('无未提交改动')
  return (
    <Popover
      portal
      placement="bottom-end"
      width={360}
      aria-label={label}
      trigger={
        <button type="button" className="git-bar__act" aria-label={label} title={t('执行位置')}>
          <Icon name="info" size={13} />
        </button>
      }
    >
      <dl className="git-loc">
        <dt>{t('仓库')}</dt>
        {repo ? <dd className="git-loc__mono">{repo.url}</dd> : <dd>{t('未绑定仓库')}</dd>}
        <dt>{t('机器')}</dt>
        <dd>{machine ?? t('未绑定机器')}</dd>
        <dt>{t('目录#one')}</dt>
        <dd className="git-loc__dir">
          <span className="git-loc__mono">{s.path ?? '—'}</span>
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
        {repo ? (
          <>
            <dt>{t('分支')}</dt>
            <dd className="git-loc__branches">
              <span>
                {t('基准')} <span className="git-loc__mono">{repo.branch}</span>
              </span>
              <span data-mismatch={!!current && current !== repo.branch}>
                {t('当前')} <span className="git-loc__mono">{current ?? '—'}</span>
              </span>
              {current && current !== repo.branch ? (
                <span className="git-loc__warn">{t('与基准分支不同')}</span>
              ) : null}
            </dd>
          </>
        ) : null}
        {repo && git ? (
          <>
            <dt>{t('改动')}</dt>
            <dd>
              {git.checkedAt ? t('{changes} · {ago}检查', { changes, ago: ago(git.checkedAt) }) : changes}
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
    </Popover>
  )
}

function Item({
  groupId,
  name,
  s,
  showGit,
  repo,
  machine,
}: {
  groupId: string
  name: string
  s: GroupBotStateDto
  /** Partition groups with a repo, where the bar shows each bot's git status. */
  showGit: boolean
  repo: GroupDto['repo']
  machine: string | null
}) {
  const git = s.git
  // States stored before repos were reported have none.
  const subs = git?.repos ?? []
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
              {git?.branch == null && subs.length ? null : (
                <span className="git-bar__branch">{git?.branch ?? '—'}</span>
              )}
              {git?.behind ? (
                <Commits icon="arrow-down" name={t('落后 {n} 个提交', { n: git.behind })} n={git.behind} />
              ) : null}
              {git?.ahead ? (
                <Commits icon="arrow-up" name={t('领先 {n} 个提交', { n: git.ahead })} n={git.ahead} />
              ) : null}
              {git?.dirty ? <span className="git-bar__dirty">{t('未提交')}</span> : null}
              {subs.length ? <SubRepos botId={s.botId} name={name} repos={subs} /> : null}
            </>
          )}
          <span className="git-bar__ws">{WORKSPACE_LABEL[s.workspace]}</span>
        </>
      ) : null}
      {s.context ? <ContextMeter groupId={groupId} bot={name} context={s.context} /> : null}
      <span className="git-bar__actions">
        <Location name={name} s={s} repo={repo} machine={machine} />
        {showGit ? (
          <>
            <Action
              icon="git-branch"
              label={t('查看 {name} 的改动', { name })}
              title={t('改动')}
              onClick={diff}
            />
            <Action
              icon="folder"
              label={t('浏览 {name} 的文件', { name })}
              title={t('文件')}
              onClick={files}
            />
          </>
        ) : null}
      </span>
    </div>
  )
}

function Action({
  icon,
  label,
  title,
  onClick,
}: {
  icon: IconName
  label: string
  title: string
  onClick?: () => void
}) {
  return (
    <button
      type="button"
      className="git-bar__act"
      aria-label={label}
      title={title}
      disabled={!onClick}
      onClick={onClick}
    >
      <Icon name={icon} size={13} />
    </button>
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
  const botKey = group.botIds.join()

  // biome-ignore lint/correctness/useExhaustiveDependencies: reload when the group's bots change
  useEffect(() => {
    const load = () => loadBotStates(group.id).catch(() => {})
    load()
    // Updates pushed while the socket was down are lost: catch up on reconnect.
    return realtime.onReconnect(load)
  }, [group.id, botKey])

  if (!group.botIds.length) return null
  return (
    <div className="git-bar" data-testid="git-bar">
      {group.botIds.map((id) => {
        const bot = bots.find((b) => b.id === id)
        return (
          <Item
            key={id}
            groupId={group.id}
            showGit={showGit}
            repo={group.repo}
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
