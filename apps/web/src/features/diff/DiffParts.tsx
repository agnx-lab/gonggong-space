import type { DiffRepo, DiffScope } from '@gonggong/protocol'
import {
  type CSSProperties,
  Fragment,
  type MouseEvent,
  memo,
  type ReactNode,
  useMemo,
  useRef,
  useState,
} from 'react'
import { cx } from '../../lib/cx'
import { type HlToken, Icon, IconButton, langOf, SegmentedControl, Tokens, useHighlight } from '../../ui'
import {
  type DiffFile,
  type DiffNode,
  type DiffRow,
  diffCells,
  diffRows,
  diffTree,
  groupByRepo,
  isMultiRepo,
  type RepoGroup,
  repoPrefix,
} from './patch'
import { type DiffBlock, diffBlocks } from './split'
import { type DiffViewMode, useDiffLayout, useDiffSettings } from './store'
import { useWide } from './useWide'
import { type WordRange, wordMarks } from './words'
import './diff.css'
import { t } from '../../i18n'

/** Five cells split between added and deleted lines (GitHub style); the numbers stay as text beside it. */
export function DiffBar({ add, del }: { add: number; del: number }) {
  const label = t('新增 {add} 行，删除 {del} 行', { add, del })
  return (
    <span className="diff-bar" role="img" aria-label={label} title={label}>
      {diffCells(add, del).map((c, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: the five cells are positional
        <span key={i} className="diff-bar__cell" data-cell={c} style={{ '--i': i } as CSSProperties} />
      ))}
    </span>
  )
}

interface FileListProps {
  files: DiffFile[]
  /** Repos the files span; more than the root lists them per repo. */
  repos?: DiffRepo[]
  active?: DiffFile
  onPick: (path: string) => void
  /** Offers 「在文件浏览器中定位」 on each file. */
  onLocate?: (path: string) => void
}

/** Changed files, flat or as a folder tree per the shared layout switch; grouped under a header per repo. */
export function DiffFileList({ repos = [], ...props }: FileListProps) {
  return (
    <div className="diff__files">
      {isMultiRepo(repos) ? (
        groupByRepo(props.files, repos)
          .filter((g) => g.files.length || g.repo.truncated)
          .map((g) => <RepoFiles key={g.repo.path} group={g} {...props} />)
      ) : (
        <Files {...props} prefix="" />
      )}
    </div>
  )
}

function Files(props: Omit<FileListProps, 'repos'> & { prefix: string }) {
  const layout = useDiffLayout((s) => s.layout)
  if (layout === 'tree') return <DiffTree {...props} />
  return props.files.map((f) => (
    <DiffFileRow
      key={f.path}
      file={f}
      prefix={props.prefix}
      active={f === props.active}
      onPick={props.onPick}
      onLocate={props.onLocate}
    />
  ))
}

function RepoFiles({ group, ...props }: Omit<FileListProps, 'repos'> & { group: RepoGroup }) {
  const [open, setOpen] = useState(true)
  const { repo } = group
  return (
    <>
      <button
        type="button"
        className="diff__file diff__repo"
        title={repo.path || undefined}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <span className={cx('ui-disclosure', open && 'ui-disclosure--open')}>
          <Icon name="chevron-right" weight={2} />
        </span>
        <span className="diff__repo-name">{repo.path || t('根仓库')}</span>
        {repo.kind === 'extra' ? <span className="diff__repo-tag">{t('附加目录#one')}</span> : null}
        <span className="diff__repo-branch">
          {repo.base ? `${repo.branch ?? 'HEAD'} → ${repo.base}` : repo.branch}
        </span>
        <span className="diff__repo-count">{t('{n} 个文件', { n: group.files.length })}</span>
        <span className="diff__add">+{group.add}</span>
        <span className="diff__del">−{group.del}</span>
        {repo.truncated ? <span className="diff__repo-cut">{t('已截断')}</span> : null}
      </button>
      {open ? <Files {...props} files={group.files} prefix={repoPrefix(repo.path)} /> : null}
    </>
  )
}

export function DiffLayoutToggle() {
  const { layout, toggle } = useDiffLayout()
  return (
    <IconButton
      size="small"
      className="diff-layout-toggle"
      title={layout === 'tree' ? t('以列表显示') : t('以目录树显示')}
      onClick={toggle}
    >
      {layout === 'tree' ? ('list' as const) : ('folder' as const)}
    </IconButton>
  )
}

function DiffTree({
  files,
  prefix,
  active,
  onPick,
  onLocate,
}: Omit<FileListProps, 'repos'> & { prefix: string }) {
  const [closed, setClosed] = useState<ReadonlySet<string>>(new Set())
  const toggle = (path: string) =>
    setClosed((s) => {
      const next = new Set(s)
      if (!next.delete(path)) next.add(path)
      return next
    })
  const rows = (nodes: DiffNode[], depth: number): ReactNode[] =>
    nodes.map((n) => {
      if (n.kind === 'file')
        return (
          <DiffFileRow
            key={n.file.path}
            file={n.file}
            name={n.name}
            depth={depth}
            active={n.file === active}
            onPick={onPick}
            onLocate={onLocate}
          />
        )
      const open = !closed.has(n.path)
      return (
        <Fragment key={n.path}>
          <button
            type="button"
            className="diff__file diff__folder"
            style={indent(depth)}
            title={n.path}
            aria-expanded={open}
            onClick={() => toggle(n.path)}
          >
            <span className={cx('ui-disclosure', open && 'ui-disclosure--open')}>
              <Icon name="chevron-right" weight={2} />
            </span>
            <Icon name={open ? 'folder-open' : 'folder'} size={13} />
            <span className="diff__path">{n.name}</span>
          </button>
          {open ? rows(n.children, depth + 1) : null}
        </Fragment>
      )
    })
  return <>{rows(diffTree(files, prefix), 0)}</>
}

const indent = (depth: number) => ({ '--depth': depth }) as CSSProperties

function DiffFileRow({
  file,
  prefix = '',
  name,
  depth,
  active,
  onPick,
  onLocate,
}: {
  file: DiffFile
  /** Shown paths drop it: the repo the row is grouped under. */
  prefix?: string
  /** Tree rows show the bare name; list rows show the name plus its folder. */
  name?: string
  depth?: number
  active: boolean
  onPick: (path: string) => void
  onLocate?: (path: string) => void
}) {
  const parts = file.path.slice(prefix.length).split('/')
  const row = (
    <button
      type="button"
      className={cx(
        'diff__file',
        depth !== undefined && 'diff__file--nested',
        active && 'diff__file--active',
      )}
      style={depth === undefined ? undefined : indent(depth)}
      title={file.path}
      onClick={() => onPick(file.path)}
    >
      <Icon name="doc-code" size={13} />
      <span className="diff__path">
        <span className="diff__base">{name ?? parts.at(-1)}</span>
        {name ? null : <span className="diff__dir">{parts.slice(0, -1).join('/')}</span>}
      </span>
      <span className="diff__add">+{file.add}</span>
      <span className="diff__del">−{file.del}</span>
      {file.binary ? null : <DiffBar add={file.add} del={file.del} />}
    </button>
  )
  if (!onLocate) return row
  return (
    <div className="diff__row">
      {row}
      <IconButton
        size="small"
        className="diff__locate"
        title={t('在文件浏览器中定位')}
        onClick={() => onLocate(file.path)}
      >
        {'folder-open' as const}
      </IconButton>
    </div>
  )
}

/** Below this width side by side is too cramped: diffs show unified. */
export const SPLIT_MIN_PX = 640

/** 0 = the old file, 1 = the new one. */
type Side = 0 | 1
type RowTokens = (row: number, side: Side) => HlToken[] | undefined

/**
 * Syntax tokens per row once both sides are ready. Each side is tokenized as its own file (context lines belong to
 * both), so a string or comment opened on one side doesn't colour the other.
 */
function useRowTokens(rows: DiffRow[], path: string): RowTokens | null {
  const { code, at } = useMemo(() => {
    const sides: [string[], string[]] = [[], []]
    const at = rows.map((r) => [
      r.kind === 'context' || r.kind === 'del' ? sides[0].push(r.text) - 1 : -1,
      r.kind === 'context' || r.kind === 'add' ? sides[1].push(r.text) - 1 : -1,
    ])
    return { code: sides.map((s) => s.join('\n')), at }
  }, [rows])
  const lang = langOf(path)
  const old = useHighlight(code[0] ?? '', lang)
  const neu = useHighlight(code[1] ?? '', lang)
  if (!old || !neu) return null
  return (row, side) => (side ? neu : old)[at[row]?.[side] ?? -1]
}

/** The tokens' pieces within [from, to) of their line. */
function cut(tokens: HlToken[], from: number, to: number) {
  const out: HlToken[] = []
  let at = 0
  for (const tk of tokens) {
    const end = at + tk.content.length
    if (end > from && at < to)
      out.push({ ...tk, content: tk.content.slice(Math.max(from - at, 0), Math.min(to, end) - at) })
    at = end
  }
  return out
}

/** A line's code, in syntax colours once ready, its changed words (`marks`) tinted more strongly. */
function Code({
  text,
  tokens,
  marks,
  kind,
}: {
  text: string
  tokens: HlToken[] | undefined
  marks: WordRange[] | undefined
  kind: DiffRow['kind']
}) {
  if (!marks) return tokens?.length ? <Tokens tokens={tokens} /> : text
  const part = (from: number, to: number) =>
    tokens?.length ? <Tokens tokens={cut(tokens, from, to)} /> : text.slice(from, to)
  const out: ReactNode[] = []
  let at = 0
  for (const [from, to] of marks) {
    if (from > at) out.push(<Fragment key={at}>{part(at, from)}</Fragment>)
    out.push(
      <span key={from} className={`diff__word--${kind}`}>
        {part(from, to)}
      </span>,
    )
    at = to
  }
  if (at < text.length) out.push(<Fragment key={at}>{part(at, text.length)}</Fragment>)
  return out
}

const SIGN: Partial<Record<DiffRow['kind'], string>> = { add: '+', del: '-', context: ' ' }

interface LinesProps {
  rows: DiffRow[]
  blocks: DiffBlock[]
  marks: Map<number, WordRange[]>
  tokens: RowTokens | null
}

/** A change is wrapped so the toolbar can step to it; other rows go as they are. */
function blockOf(block: DiffBlock, children: ReactNode) {
  const key = block.rows[0]
  return block.change ? (
    <div key={key} className="diff__block" data-change="">
      {children}
    </div>
  ) : (
    <Fragment key={key}>{children}</Fragment>
  )
}

function UnifiedLines({ rows, blocks, marks, tokens }: LinesProps) {
  const line = (i: number) => {
    const row = rows[i]
    if (!row) return null
    const sign = SIGN[row.kind]
    return (
      <div key={i} className={cx('diff__line', row.kind !== 'context' && `diff__line--${row.kind}`)}>
        <span className="diff__num" data-n={row.oldNo ?? undefined} />
        <span className="diff__num" data-n={row.newNo ?? undefined} />
        <span className="diff__code">
          {sign === undefined ? (
            row.text
          ) : (
            <>
              {sign}
              <Code
                text={row.text}
                tokens={tokens?.(i, row.kind === 'del' ? 0 : 1)}
                marks={marks.get(i)}
                kind={row.kind}
              />
            </>
          )}
        </span>
      </div>
    )
  }
  return <div className="diff__lines">{blocks.map((b) => blockOf(b, b.rows.map(line)))}</div>
}

/** A selection stays on the side it starts on, so copying takes one file's code. */
function pickSide(e: MouseEvent<HTMLDivElement>) {
  const side = (e.target as Element).closest<HTMLElement>('[data-side]')?.dataset.side
  if (side) e.currentTarget.dataset.select = side
}

function SplitLines({ rows, blocks, marks, tokens }: LinesProps) {
  const cell = (i: number | null, side: Side) => {
    const row = i === null ? undefined : rows[i]
    const name = side ? 'new' : 'old'
    if (i === null || !row) return <div className="diff__side diff__side--empty" data-side={name} />
    return (
      <div className={cx('diff__side', row.kind !== 'context' && `diff__side--${row.kind}`)} data-side={name}>
        <span className="diff__num" data-n={(side ? row.newNo : row.oldNo) ?? undefined} />
        <span className="diff__code">
          {row.kind === 'note' ? (
            row.text
          ) : (
            <Code text={row.text} tokens={tokens?.(i, side)} marks={marks.get(i)} kind={row.kind} />
          )}
        </span>
      </div>
    )
  }
  const pair = ([o, n]: [number | null, number | null]) => {
    const hunk = o === null ? undefined : rows[o]
    if (hunk?.kind === 'hunk')
      return (
        <div key={o} className="diff__line diff__line--hunk">
          <span className="diff__num" />
          <span className="diff__code">{hunk.text}</span>
        </div>
      )
    return (
      <div key={`${o}:${n}`} className="diff__pair">
        {cell(o, 0)}
        {cell(n, 1)}
      </div>
    )
  }
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: only keeps a text selection on one side
    <div className="diff__lines diff__lines--split" onMouseDown={pickSide}>
      {blocks.map((b) => blockOf(b, b.pairs.map(pair)))}
    </div>
  )
}

/**
 * One file's diff with old and new line numbers: unified, or side by side when `view` (default: the stored choice)
 * asks for it and there is room.
 */
export const DiffView = memo(function DiffView({ file, view }: { file: DiffFile; view?: DiffViewMode }) {
  const stored = useDiffSettings((s) => s.view)
  const root = useRef<HTMLDivElement>(null)
  const roomy = useWide(root, SPLIT_MIN_PX)
  const { rows, blocks, marks, digits } = useMemo(() => {
    const rows = diffRows(file.lines)
    const blocks = diffBlocks(rows)
    const last = rows.reduce((n, r) => Math.max(n, r.oldNo ?? 0, r.newNo ?? 0), 0)
    return { rows, blocks, marks: wordMarks(rows, blocks), digits: Math.max(2, String(last).length) }
  }, [file.lines])
  const tokens = useRowTokens(rows, file.path)
  const Lines = (view ?? stored) === 'split' && roomy ? SplitLines : UnifiedLines
  return (
    <div ref={root} className="diff" style={{ '--diff-digits': digits } as CSSProperties}>
      <div className="diff__name">{file.path}</div>
      <Lines rows={rows} blocks={blocks} marks={marks} tokens={tokens} />
    </div>
  )
})

export function DiffScopeBar({
  scope,
  turn,
  onChange,
}: {
  scope: DiffScope
  /** Offer 本轮 (the view belongs to a run). */
  turn: boolean
  onChange: (scope: DiffScope) => void
}) {
  const items: { value: DiffScope; label: string }[] = [
    ...(turn ? [{ value: 'turn' as const, label: t('本轮') }] : []),
    { value: 'uncommitted', label: t('未提交') },
    { value: 'base', label: t('对比主分支') },
  ]
  return (
    <SegmentedControl
      size="small"
      aria-label={t('改动范围')}
      items={items}
      value={scope}
      onChange={onChange}
    />
  )
}

/** What the scope compares, e.g. feat/x → main. */
export function scopeNote(scope: DiffScope, branch: string | null, base: string | null) {
  if (scope === 'base' && base) return `${branch ?? 'HEAD'} → ${base}`
  return branch
}

/** Why a scope is empty, in the user's terms. */
export function emptyText(scope: DiffScope, branch: string | null, base: string | null) {
  if (scope === 'turn') return t('本轮没有文件改动')
  if (scope === 'uncommitted') return t('没有未提交的改动')
  return base
    ? t('{branch} 相对 {base} 没有改动', { branch: branch ?? t('当前分支'), base })
    : t('当前就在主分支，没有可对比的改动')
}
