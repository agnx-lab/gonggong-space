import type { GitRefsDto } from '@gonggong/protocol'
import { Fragment, type ReactNode, useEffect, useRef, useState } from 'react'
import type { GitLogTabFilter } from '../../../app/workbench'
import { t } from '../../../i18n'
import { pad } from '../../../lib/time'
import {
  Button,
  Icon,
  Input,
  MenuButton,
  type MenuItem,
  Popover,
  PopUpButton,
  type PopUpOption,
  TextField,
} from '../../../ui'
import { type GitTarget, shortRev } from '../api'
import { BranchesPane } from './BranchesPane'
import { baseName, type LogTab, narrowed } from './query'
import { Tool } from './Tool'

/** What the filter bar and the branches pane change in the log tab. */
export interface LogControl {
  setFilter: (fields: Partial<GitLogTabFilter>) => void
  /** The ref listed: a branch, tag or commit; null = HEAD, or every branch with `all`. */
  setRef: (ref: string | null, all: boolean) => void
  setPath: (path: string | null) => void
  setRepo: (repo: string | null) => void
  /** Shows the commit a hash (or ref) names, clearing the text filter; resolves whether it was found. */
  goTo: (rev: string) => Promise<boolean>
  /** Clears the filters, keeping the graph options. */
  clear: () => void
  refresh: () => void
}

const TYPING_MS = 400
const DAY_MS = 86_400_000
const HASH = /^[0-9a-f]{7,40}$/i

/** A local day as git takes it (YYYY-MM-DD). */
export const isoDay = (ms: number) => {
  const d = new Date(ms)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const PRESETS = [
  { days: 1, label: t('最近 24 小时') },
  { days: 7, label: t('最近 7 天') },
  { days: 30, label: t('最近 30 天') },
  { days: 365, label: t('最近一年') },
]
const presetSince = (days: number) => isoDay(Date.now() - days * DAY_MS)

/** The message filter: applied once typing pauses (or on Enter), with IDEA's regexp and match-case toggles. */
function TextFilter({
  filter,
  onText,
  onFlags,
  onGoTo,
}: {
  filter: GitLogTabFilter
  onText: (text: string) => void
  onFlags: (fields: Partial<GitLogTabFilter>) => void
  onGoTo: (rev: string) => Promise<boolean>
}) {
  const [text, setText] = useState(filter.text ?? '')
  const applied = useRef(filter.text ?? '')
  // A text set elsewhere (cleared filters) replaces what is typed.
  useEffect(() => {
    const now = filter.text ?? ''
    if (now === applied.current) return
    applied.current = now
    setText(now)
  }, [filter.text])
  const apply = (value: string) => {
    const next = value.trim()
    if (next === applied.current) return
    applied.current = next
    onText(next)
  }
  const latest = useRef(apply)
  latest.current = apply
  useEffect(() => {
    if (text.trim() === applied.current) return
    const timer = setTimeout(() => latest.current(text), TYPING_MS)
    return () => clearTimeout(timer)
  }, [text])
  const hash = text.trim()
  return (
    <>
      <span className="glf-search">
        <Icon name="search" size={13} weight={1.7} />
        <input
          type="search"
          className="glf-search__input"
          placeholder={t('文本或哈希')}
          aria-label={t('文本或哈希')}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') apply(text)
            else if (e.key === 'Escape' && text) {
              e.stopPropagation()
              setText('')
              apply('')
            }
          }}
        />
        <button
          type="button"
          className="glf-flag"
          aria-label={t('正则表达式')}
          title={t('正则表达式')}
          aria-pressed={!!filter.regexp}
          onClick={() => onFlags({ regexp: !filter.regexp })}
        >
          .*
        </button>
        <button
          type="button"
          className="glf-flag"
          aria-label={t('区分大小写')}
          title={t('区分大小写')}
          aria-pressed={!!filter.matchCase}
          onClick={() => onFlags({ matchCase: !filter.matchCase })}
        >
          Aa
        </button>
      </span>
      {HASH.test(hash) ? (
        <button
          type="button"
          className="glf-goto"
          onClick={() =>
            void onGoTo(hash).then((found) => {
              if (!found) return
              applied.current = ''
              setText('')
            })
          }
        >
          <Icon name="git-commit" size={12} />
          {t('转到提交 {hash}', { hash })}
        </button>
      ) : null}
    </>
  )
}

/** One of IDEA's filter pop-ups: its label, the value set (with a way to clear it), and its panel. */
function FilterMenu({
  label,
  value,
  title,
  panel,
  width,
  onClear,
  children,
}: {
  label: string
  value: string | null
  title?: string
  panel: string
  width: number
  onClear: () => void
  children: (close: () => void) => ReactNode
}) {
  // Each opening starts the panel afresh, also when it reopens while still fading out.
  const [opened, setOpened] = useState(0)
  return (
    <span className="glf-item" data-on={value != null || undefined}>
      <Popover
        portal
        placement="bottom-start"
        width={width}
        aria-label={panel}
        onOpenChange={(open) => open && setOpened((n) => n + 1)}
        trigger={
          <button type="button" className="glf-btn" title={title}>
            {value == null ? label : t('{label}：{value}', { label, value })}
            <Icon name="chevron-down" size={9} weight={2} />
          </button>
        }
      >
        {(close) => <Fragment key={opened}>{children(close)}</Fragment>}
      </Popover>
      {value != null ? (
        <button
          type="button"
          className="glf-clear"
          aria-label={t('清除{label}筛选', { label })}
          onClick={onClear}
        >
          <Icon name="xmark" size={8} weight={2.4} />
        </button>
      ) : null}
    </span>
  )
}

function UserPanel({
  authors,
  value,
  onPick,
}: {
  authors: string[]
  value: string | null
  onPick: (author: string) => void
}) {
  const [text, setText] = useState(value ?? '')
  const q = text.trim().toLowerCase()
  const shown = authors.filter((a) => !q || a.toLowerCase().includes(q))
  return (
    <div className="glf-panel">
      <Input
        type="text"
        aria-label={t('用户名或邮箱')}
        placeholder={t('用户名或邮箱')}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && text.trim()) onPick(text.trim())
        }}
      />
      {shown.length ? (
        <div className="glf-options">
          {shown.map((a) => (
            <button
              key={a}
              type="button"
              className="glf-option"
              aria-pressed={a === value}
              onClick={() => onPick(a)}
            >
              <Icon name="person" size={12} />
              {a}
            </button>
          ))}
        </div>
      ) : (
        <div className="glf-hint">{t('按回车筛选这个用户')}</div>
      )}
    </div>
  )
}

function DatePanel({
  since,
  until,
  onPick,
}: {
  since: string | null
  until: string | null
  onPick: (since: string | null, until: string | null) => void
}) {
  const preset = !until && since ? PRESETS.find((p) => presetSince(p.days) === since) : undefined
  const [custom, setCustom] = useState(!!until || (!!since && !preset))
  const [from, setFrom] = useState(since ?? '')
  const [to, setTo] = useState(until ?? '')
  return (
    <div className="glf-panel">
      <div className="glf-options">
        <button
          type="button"
          className="glf-option"
          aria-pressed={!since && !until}
          onClick={() => onPick(null, null)}
        >
          {t('全部')}
        </button>
        {PRESETS.map((p) => (
          <button
            key={p.days}
            type="button"
            className="glf-option"
            aria-pressed={preset === p}
            onClick={() => onPick(presetSince(p.days), null)}
          >
            {p.label}
          </button>
        ))}
        <button
          type="button"
          className="glf-option"
          aria-expanded={custom}
          onClick={() => setCustom(!custom)}
        >
          {t('自定义…')}
        </button>
      </div>
      {custom ? (
        <div className="glf-dates">
          <label className="glf-date">
            <span>{t('起始日期')}</span>
            <input
              type="date"
              className="ui-input"
              value={from}
              max={to || undefined}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label className="glf-date">
            <span>{t('截止日期')}</span>
            <input
              type="date"
              className="ui-input"
              value={to}
              min={from || undefined}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
          <Button size="small" variant="primary" onClick={() => onPick(from || null, to || null)}>
            {t('应用')}
          </Button>
        </div>
      ) : null}
    </div>
  )
}

function PathPanel({ value, onApply }: { value: string; onApply: (path: string | null) => void }) {
  const [text, setText] = useState(value)
  const apply = () =>
    onApply(
      text
        .trim()
        .replace(/^\.?\/+/, '')
        .replace(/\/+$/, '') || null,
    )
  return (
    <div className="glf-panel">
      <TextField
        label={t('路径')}
        placeholder={t('文件或文件夹，如 src/app.ts')}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') apply()
        }}
      />
      <div className="glf-panel__actions">
        {value ? (
          <Button size="small" variant="plain" onClick={() => onApply(null)}>
            {t('清除')}
          </Button>
        ) : null}
        <Button size="small" variant="primary" onClick={apply}>
          {t('应用')}
        </Button>
      </div>
    </div>
  )
}

function graphItems(f: GitLogTabFilter): MenuItem[] {
  return [
    { value: 'first-parent', label: t('仅第一父提交'), checked: !!f.firstParent },
    { value: 'no-merges', label: t('不显示合并提交'), checked: !!f.noMerges },
    { separator: true },
    { value: 'date', label: t('按日期排序'), checked: f.order !== 'topo' },
    { value: 'topo', label: t('按拓扑排序'), checked: f.order === 'topo' },
  ]
}

/**
 * IDEA's log filter bar: the branches pane toggle, the repo, text (regexp, match case, or a hash to go to), branch,
 * user, date and path filters, 清除筛选, refresh and the graph options.
 */
export function LogFilters({
  tab,
  target,
  refs,
  refsError,
  authors,
  repos,
  pane,
  onPane,
  control,
}: {
  tab: LogTab
  target: GitTarget
  refs: GitRefsDto | null
  refsError: string | null
  /** Authors seen in the log so far, most commits first. */
  authors: () => string[]
  repos: PopUpOption<string>[]
  pane: boolean
  onPane: () => void
  control: LogControl
}) {
  const f = tab.filter ?? {}
  const date =
    f.since && f.until
      ? `${f.since} ~ ${f.until}`
      : f.since
        ? t('{date} 之后', { date: f.since })
        : f.until
          ? t('{date} 之前', { date: f.until })
          : null
  return (
    <div className="glf" role="toolbar" aria-label={t('提交历史筛选')}>
      <Tool icon="sidebar" label={t('分支面板')} pressed={pane} onClick={onPane} />
      {repos.length ? (
        <PopUpButton
          size="small"
          aria-label={t('仓库')}
          value={target.repo ?? ''}
          onChange={(v) => control.setRepo(v || null)}
          options={repos}
        />
      ) : null}
      <TextFilter
        filter={f}
        onText={(text) => control.setFilter({ text: text || undefined })}
        onFlags={control.setFilter}
        onGoTo={control.goTo}
      />
      <FilterMenu
        label={t('分支')}
        value={f.all ? t('全部分支') : tab.ref ? shortRev(tab.ref) : null}
        title={tab.ref ?? undefined}
        panel={t('按分支筛选')}
        width={300}
        onClear={() => control.setRef(null, false)}
      >
        {(close) => (
          <BranchesPane
            picker
            target={target}
            refs={refs}
            error={refsError}
            selected={{ all: !!f.all, ref: tab.ref }}
            onFilter={(ref, all) => {
              control.setRef(ref, all)
              close()
            }}
          />
        )}
      </FilterMenu>
      <FilterMenu
        label={t('用户')}
        value={f.author ?? null}
        panel={t('按用户筛选')}
        width={260}
        onClear={() => control.setFilter({ author: undefined })}
      >
        {(close) => (
          <UserPanel
            authors={authors()}
            value={f.author ?? null}
            onPick={(author) => {
              control.setFilter({ author })
              close()
            }}
          />
        )}
      </FilterMenu>
      <FilterMenu
        label={t('日期')}
        value={date}
        panel={t('按日期筛选')}
        width={260}
        onClear={() => control.setFilter({ since: undefined, until: undefined })}
      >
        {(close) => (
          <DatePanel
            since={f.since ?? null}
            until={f.until ?? null}
            onPick={(since, until) => {
              control.setFilter({ since: since ?? undefined, until: until ?? undefined })
              close()
            }}
          />
        )}
      </FilterMenu>
      <FilterMenu
        label={t('路径')}
        value={tab.path ? baseName(tab.path) : null}
        title={tab.path ?? undefined}
        panel={t('按路径筛选')}
        width={300}
        onClear={() => control.setPath(null)}
      >
        {(close) => (
          <PathPanel
            value={tab.path ?? ''}
            onApply={(path) => {
              control.setPath(path)
              close()
            }}
          />
        )}
      </FilterMenu>
      {narrowed(tab) ? (
        <button type="button" className="glf-reset" onClick={control.clear}>
          <Icon name="xmark" size={9} weight={2.4} />
          {t('清除筛选')}
        </button>
      ) : null}
      <span className="spacer" />
      <Tool icon="arrow-clockwise" label={t('刷新')} onClick={control.refresh} />
      <MenuButton
        className="glog-tool"
        aria-label={t('提交图选项')}
        title={t('提交图选项')}
        align="end"
        items={graphItems(f)}
        onSelect={(v) =>
          control.setFilter(
            v === 'first-parent'
              ? { firstParent: !f.firstParent }
              : v === 'no-merges'
                ? { noMerges: !f.noMerges }
                : { order: v === 'topo' ? 'topo' : undefined },
          )
        }
      >
        <Icon name="slider-horizontal" size={14} />
      </MenuButton>
    </div>
  )
}
