import type { GitChangesDto, GitConflict, GitConflictDto, GitOngoing } from '@gonggong/protocol'
import { type ReactNode, useState } from 'react'
import { useWorkbench } from '../../../app/workbench'
import { useWorkspace } from '../../../app/workspace'
import { t } from '../../../i18n'
import { Alert, Button, EmptyState, Icon, MenuButton, Spinner } from '../../../ui'
import { useGitStamp } from '../../diff/useWorkspaceDiff'
import { gitActionTaken, gitBase, gitUrls, repoStatus, runGitAction, useGitGet } from '../../git/api'
import { inTarget, ongoingLabel } from '../../git/commands'
import {
  assemble,
  hasMarkers,
  type MergeSegment,
  parseMerge,
  type Resolution,
  resolved,
  sameOnBothSides,
} from '../../git/merge'
import { useOwner } from '../../git/owner'
import type { TabMeta, TabProps } from '../types'
import '../../git/merge.css'

type Conflict = Extract<MergeSegment, { kind: 'conflict' }>

/** Agreed runs longer than this fold to their first and last lines. */
const FOLD = 8
const EDGE = 3

/** Who "ours" and "theirs" are in what stopped midway (in a rebase, ours is the branch rebased onto). */
function sides(ongoing: GitOngoing | null, branch: string | null) {
  const subject = ongoing?.subject ?? ''
  const current = branch ? t('{branch}（当前分支）', { branch }) : t('当前 HEAD')
  if (!ongoing) return { ours: current, theirs: t('恢复的贮藏') }
  if (ongoing.kind === 'rebase')
    return { ours: t('变基到的分支'), theirs: t('正在重放的 {subject}', { subject }) }
  if (ongoing.kind === 'cherry-pick') return { ours: current, theirs: t('正在优选的 {subject}', { subject }) }
  if (ongoing.kind === 'revert') return { ours: current, theirs: t('还原 {subject} 的改动', { subject }) }
  return { ours: current, theirs: subject || t('合并进来的分支') }
}

const SIDE: Record<GitConflict['ours'], string> = {
  modified: t('修改了文件'),
  added: t('新增了文件'),
  deleted: t('删除了文件'),
}

/**
 * IDEA's Merge Revisions for one conflicted file: git's merge with each conflict shown as yours | theirs (the base on
 * demand), settled one by one (yours, theirs, both, or edited) or all at once, or the whole file edited; applying
 * writes the result and marks it resolved, then moves on to the next conflicted file.
 */
export function GitMergeTab({ tab, tabKey }: TabProps<'git-merge'>) {
  const groupId = useWorkbench((s) => s.groupId) ?? ''
  const patch = useWorkbench((s) => s.patch)
  const closeTab = useWorkbench((s) => s.closeTab)
  const git = useWorkspace((s) => s.botStates[groupId]?.[tab.botId]?.git ?? null)
  const { owner } = useOwner(tab.botId)
  const target = { groupId, botId: tab.botId, repo: tab.repo ?? null }
  const stamp = useGitStamp(groupId, tab.botId)
  const base = gitBase(groupId, tab.botId)
  // Read once per file: a status change while resolving must not throw the choices away.
  const read = useGitGet<GitConflictDto>(gitUrls.conflict(base, tab.path, target.repo))
  const changes = useGitGet<GitChangesDto>(gitUrls.changes(base, target.repo), stamp)
  const [choices, setChoices] = useState<{ path: string; map: ReadonlyMap<number, Resolution> }>({
    path: tab.path,
    map: new Map(),
  })
  const [editing, setEditing] = useState<number | null>(null)
  const [whole, setWhole] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const map = choices.path === tab.path ? choices.map : new Map<number, Resolution>()
  const setMap = (next: ReadonlyMap<number, Resolution>) => setChoices({ path: tab.path, map: next })

  const conflicts = changes.data?.conflicts ?? []
  const mine = conflicts.find((c) => c.path === tab.path) ?? null
  const at = conflicts.findIndex((c) => c.path === tab.path)
  const status = git ? repoStatus(git, target.repo) : null
  const label = sides(changes.data?.ongoing ?? null, status?.branch ?? null)
  const go = (path: string) => {
    setWhole(null)
    setEditing(null)
    setError(null)
    patch(tabKey, { path })
  }

  const finish = async (req: { side?: 'ours' | 'theirs'; content?: string }) => {
    setBusy(true)
    setError(null)
    const op = await runGitAction(
      groupId,
      tab.botId,
      inTarget(target, { action: 'resolve', path: tab.path, ...req }),
    )
    setBusy(false)
    if (!gitActionTaken(op)) return setError(op?.error ?? null)
    if (op?.status !== 'succeeded') return
    const left = conflicts.filter((c) => c.path !== tab.path)
    const next = left[at] ?? left[0]
    if (next) go(next.path)
    else closeTab(tabKey)
  }

  if (changes.data && !mine)
    return (
      <div className="gm">
        <EmptyState
          compact
          icon="checkmark-circle"
          title={t('{path} 的冲突已解决', { path: tab.path })}
          description={conflicts.length ? t('还有 {n} 个文件有冲突', { n: conflicts.length }) : undefined}
          action={
            conflicts[0] ? (
              <Button onClick={() => go(conflicts[0]?.path ?? '')}>{t('下一个冲突')}</Button>
            ) : (
              <Button onClick={() => closeTab(tabKey)}>{t('关闭')}</Button>
            )
          }
        />
      </div>
    )
  if (read.error) return <Alert variant="error" description={read.error} />
  if (!read.data)
    return (
      <div className="gm gm--loading">
        <Spinner />
      </div>
    )

  const data = read.data
  const segments = data.merged != null ? parseMerge(data.merged) : null
  const blocks = (segments ?? []).filter((s): s is Conflict => s.kind === 'conflict')
  const done = blocks.filter((c) => map.has(c.id)).length
  const set = (id: number, r: Resolution | null) => {
    const next = new Map(map)
    if (r) next.set(id, r)
    else next.delete(id)
    setMap(next)
  }
  const all = (r: Resolution) => setMap(new Map(blocks.map((c) => [c.id, r])))
  const result = whole ?? (segments ? assemble(segments, map) : (data.merged ?? ''))
  const ready = whole != null ? !hasMarkers(whole) : !!segments && done === blocks.length
  const apply = owner ? t('应用') : t('提交申请')

  const header = (
    <div className="gm-bar">
      <Icon name="git-merge" size={15} />
      <div className="gm-bar__title">
        <span className="gm-bar__path" title={tab.path}>
          {tab.path}
        </span>
        <span className="gm-bar__sides">
          <span className="gm-ours">{t('你的：{label}', { label: label.ours })}</span>
          <span className="gm-theirs">{t('他们的：{label}', { label: label.theirs })}</span>
        </span>
      </div>
      <span className="spacer" />
      {conflicts.length > 1 ? (
        <span className="gm-nav">
          <button
            type="button"
            className="gc-tool"
            aria-label={t('上一个冲突文件')}
            onClick={() => go(conflicts[(at - 1 + conflicts.length) % conflicts.length]?.path ?? tab.path)}
          >
            <Icon name="chevron-left" size={13} />
          </button>
          {t('第 {i} / {n} 个文件', { i: at + 1, n: conflicts.length })}
          <button
            type="button"
            className="gc-tool"
            aria-label={t('下一个冲突文件')}
            onClick={() => go(conflicts[(at + 1) % conflicts.length]?.path ?? tab.path)}
          >
            <Icon name="chevron-right" size={13} />
          </button>
        </span>
      ) : null}
      <MenuButton
        className="gtb-btn"
        aria-label={t('整个文件取一方')}
        align="end"
        items={[
          { value: 'ours', label: t('整个文件用你的版本') },
          { value: 'theirs', label: t('整个文件用他们的版本') },
          { separator: true },
          { value: 'reload', label: t('重新读取冲突'), icon: 'arrow-clockwise' },
        ]}
        onSelect={(v) => {
          if (v === 'reload') {
            setChoices({ path: tab.path, map: new Map() })
            setWhole(null)
            read.reload()
          } else void finish({ side: v === 'ours' ? 'ours' : 'theirs' })
        }}
      >
        <Icon name="more" size={14} />
      </MenuButton>
    </div>
  )

  // A side deleted the file, a side added it, or it is binary: only a whole side can be taken.
  if (data.merged == null)
    return (
      <div className="gm">
        {header}
        <div className="gm-pick">
          <p className="gm-pick__note">
            {data.binary
              ? t('二进制文件无法逐处合并，请选择保留哪一方')
              : t('两边对这个文件的处理不同，请选择保留哪一方')}
          </p>
          <div className="gm-pick__sides">
            <SideCard
              title={t('你的版本')}
              who={label.ours}
              did={mine ? SIDE[mine.ours] : ''}
              text={data.ours}
              action={busy ? <Spinner size={12} /> : t('保留你的版本')}
              onPick={() => void finish({ side: 'ours' })}
              tone="ours"
            />
            <SideCard
              title={t('他们的版本')}
              who={label.theirs}
              did={mine ? SIDE[mine.theirs] : ''}
              text={data.theirs}
              action={busy ? <Spinner size={12} /> : t('保留他们的版本')}
              onPick={() => void finish({ side: 'theirs' })}
              tone="theirs"
            />
          </div>
          {owner ? null : <Alert description={t('解决冲突需要 Bot 主人批准后才会写入')} />}
          {error ? <Alert variant="error" description={error} /> : null}
        </div>
      </div>
    )

  return (
    <div className="gm">
      {header}
      <div className="gm-tools">
        <span className="gm-tools__count">
          {segments
            ? t('{n} 处冲突，已解决 {done} 处', { n: blocks.length, done })
            : t('无法识别冲突标记，请直接编辑全文')}
        </span>
        <span className="spacer" />
        {whole == null && segments ? (
          <>
            <Button size="small" variant="plain" onClick={() => all('ours')}>
              {t('冲突处都用你的')}
            </Button>
            <Button size="small" variant="plain" onClick={() => all('theirs')}>
              {t('冲突处都用他们的')}
            </Button>
            {done ? (
              <Button size="small" variant="plain" onClick={() => setMap(new Map())}>
                {t('全部撤销')}
              </Button>
            ) : null}
          </>
        ) : null}
        {whole == null ? (
          <Button size="small" icon="doc-text" onClick={() => setWhole(result)}>
            {t('编辑全文')}
          </Button>
        ) : segments ? (
          <Button size="small" onClick={() => setWhole(null)}>
            {t('放弃全文编辑')}
          </Button>
        ) : null}
        <Button
          size="small"
          variant="primary"
          disabled={busy || !ready}
          onClick={() => void finish({ content: result })}
        >
          {busy ? <Spinner size={12} /> : null}
          {apply}
        </Button>
      </div>
      {error ? <Alert variant="error" description={error} /> : null}
      {whole != null || !segments ? (
        <div className="gm-whole">
          {whole != null && hasMarkers(whole) ? (
            <Alert
              variant="warning"
              description={t('文本里还有冲突标记（<<<<<<< / >>>>>>>），删掉后才能应用')}
            />
          ) : null}
          <textarea
            className="gm-whole__text"
            aria-label={t('合并结果')}
            spellCheck={false}
            value={whole ?? data.merged ?? ''}
            onChange={(e) => setWhole(e.target.value)}
          />
        </div>
      ) : (
        <div className="gm-doc" role="document" aria-label={t('合并结果')}>
          {segments.map((s, i) =>
            s.kind === 'same' ? (
              // biome-ignore lint/suspicious/noArrayIndexKey: agreed runs sit between numbered conflicts
              <Same key={`s${i}`} lines={s.lines} first={i === 0} last={i === segments.length - 1} />
            ) : (
              <Block
                key={s.id}
                c={s}
                n={s.id + 1}
                r={map.get(s.id) ?? null}
                editing={editing === s.id}
                onEdit={(on) => setEditing(on ? s.id : null)}
                onResolve={(r) => {
                  set(s.id, r)
                  setEditing(null)
                }}
                labels={label}
              />
            ),
          )}
        </div>
      )}
    </div>
  )
}

function SideCard({
  title,
  who,
  did,
  text,
  action,
  onPick,
  tone,
}: {
  title: string
  who: string
  did: string
  text: string | null
  action: ReactNode
  onPick: () => void
  tone: 'ours' | 'theirs'
}) {
  return (
    <section className="gm-side" data-tone={tone} aria-label={title}>
      <header className="gm-side__head">
        <span className="gm-side__title">{title}</span>
        <span className="gm-side__who">{who}</span>
      </header>
      <p className="gm-side__did">{did}</p>
      {text != null ? (
        <pre className="gm-side__text">{text.length > 4000 ? `${text.slice(0, 4000)}…` : text}</pre>
      ) : null}
      <Button size="small" variant="primary" onClick={onPick}>
        {action}
      </Button>
    </section>
  )
}

/** An agreed run; long ones fold to their edges with a line to unfold them. */
function Same({ lines, first, last }: { lines: string[]; first: boolean; last: boolean }) {
  const [open, setOpen] = useState(false)
  const shown = lines.at(-1) === '' && last ? lines.slice(0, -1) : lines
  if (open || shown.length <= FOLD) return <Lines lines={shown} />
  const head = first ? [] : shown.slice(0, EDGE)
  const tail = last ? [] : shown.slice(-EDGE)
  const hidden = shown.length - head.length - tail.length
  return (
    <>
      <Lines lines={head} />
      <button type="button" className="gm-fold" onClick={() => setOpen(true)}>
        {t('… {n} 行相同的内容', { n: hidden })}
      </button>
      <Lines lines={tail} />
    </>
  )
}

function Lines({ lines, tone }: { lines: string[]; tone?: string }) {
  if (!lines.length) return null
  return (
    <pre className="gm-lines" data-tone={tone}>
      {lines.join('\n')}
    </pre>
  )
}

const CHOICE: Record<Exclude<Resolution, { text: string }>, string> = {
  ours: t('已用你的'),
  theirs: t('已用他们的'),
  'ours-theirs': t('已保留两者（你的在前）'),
  'theirs-ours': t('已保留两者（他们的在前）'),
}

/** One conflict: yours | theirs side by side with the base on demand, or what it was settled with. */
function Block({
  c,
  n,
  r,
  editing,
  onEdit,
  onResolve,
  labels,
}: {
  c: Conflict
  n: number
  r: Resolution | null
  editing: boolean
  onEdit: (on: boolean) => void
  onResolve: (r: Resolution | null) => void
  labels: { ours: string; theirs: string }
}) {
  const [showBase, setShowBase] = useState(false)
  const [text, setText] = useState('')
  if (r && !editing)
    return (
      <div className="gm-block gm-block--done" data-conflict={n}>
        <div className="gm-block__head">
          <Icon name="checkmark-circle" size={13} />
          <span>{t('冲突 {n}#nth', { n })}</span>
          <span className="gm-block__choice">{typeof r === 'object' ? t('已手动编辑') : CHOICE[r]}</span>
          <span className="spacer" />
          <button type="button" className="gm-link" onClick={() => onResolve(null)}>
            {t('撤销')}
          </button>
        </div>
        <Lines lines={resolved(c, r)} tone="result" />
      </div>
    )
  if (editing)
    return (
      <div className="gm-block gm-block--edit" data-conflict={n}>
        <div className="gm-block__head">
          <span>{t('编辑冲突 {n}', { n })}</span>
        </div>
        <textarea
          className="gm-block__text"
          aria-label={t('冲突 {n} 的合并结果', { n })}
          spellCheck={false}
          // biome-ignore lint/a11y/noAutofocus: the editor opens on request, ready to type
          autoFocus
          value={text}
          rows={Math.min(16, Math.max(4, c.ours.length + c.theirs.length + 1))}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="gm-block__actions">
          <Button size="small" variant="primary" onClick={() => onResolve({ text })}>
            {t('完成')}
          </Button>
          <Button size="small" variant="plain" onClick={() => onEdit(false)}>
            {t('取消')}
          </Button>
        </div>
      </div>
    )
  const same = sameOnBothSides(c)
  return (
    <div className="gm-block" data-conflict={n}>
      <div className="gm-block__head">
        <Icon name="warning" size={13} />
        <span>{t('冲突 {n}#nth', { n })}</span>
        {same ? <span className="gm-block__choice">{t('两边改得一样')}</span> : null}
        <span className="spacer" />
        {c.base.length ? (
          <button
            type="button"
            className="gm-link"
            aria-pressed={showBase}
            onClick={() => setShowBase(!showBase)}
          >
            {showBase ? t('隐藏基准') : t('显示基准')}
          </button>
        ) : null}
      </div>
      {showBase ? (
        <div className="gm-base">
          <span className="gm-base__label">{t('共同的基准版本')}</span>
          <Lines lines={c.base} tone="base" />
        </div>
      ) : null}
      <div className="gm-block__sides">
        <div className="gm-block__side" data-tone="ours">
          <span className="gm-block__label">{t('你的 · {label}', { label: labels.ours })}</span>
          {c.ours.length ? (
            <Lines lines={c.ours} tone="ours" />
          ) : (
            <span className="gm-empty">{t('（删除了这几行）')}</span>
          )}
          <Button size="small" onClick={() => onResolve('ours')}>
            {t('接受你的')}
          </Button>
        </div>
        <div className="gm-block__side" data-tone="theirs">
          <span className="gm-block__label">{t('他们的 · {label}', { label: labels.theirs })}</span>
          {c.theirs.length ? (
            <Lines lines={c.theirs} tone="theirs" />
          ) : (
            <span className="gm-empty">{t('（删除了这几行）')}</span>
          )}
          <Button size="small" onClick={() => onResolve('theirs')}>
            {t('接受他们的')}
          </Button>
        </div>
      </div>
      <div className="gm-block__actions">
        <Button size="small" variant="plain" onClick={() => onResolve('ours-theirs')}>
          {t('两者都要（你的在前）')}
        </Button>
        <Button size="small" variant="plain" onClick={() => onResolve('theirs-ours')}>
          {t('两者都要（他们的在前）')}
        </Button>
        <span className="spacer" />
        <Button
          size="small"
          variant="plain"
          icon="doc-text"
          onClick={() => {
            setText([...c.ours, ...c.theirs].join('\n'))
            onEdit(true)
          }}
        >
          {t('手动编辑')}
        </Button>
      </div>
    </div>
  )
}

export function useGitMergeTabMeta(tab: TabProps<'git-merge'>['tab']): TabMeta {
  const groupId = useWorkbench((s) => s.groupId) ?? ''
  const ongoing = useWorkspace((s) => s.botStates[groupId]?.[tab.botId]?.git?.ongoing)
  const name = tab.path.slice(tab.path.lastIndexOf('/') + 1)
  return {
    icon: 'git-merge',
    title: ongoing
      ? t('{op}冲突 · {name}', { op: ongoingLabel(ongoing), name })
      : t('合并 · {name}', { name }),
  }
}
