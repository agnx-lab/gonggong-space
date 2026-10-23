import type { GitChange, GitConflict } from '@gonggong/protocol'
import { type CSSProperties, type KeyboardEvent, type MouseEvent, type ReactNode, useState } from 'react'
import { create } from 'zustand'
import { t } from '../../i18n'
import { cx } from '../../lib/cx'
import { Checkbox, ContextMenu, FileIcon, Icon, type MenuItem } from '../../ui'
import { type DiffNode, diffTree } from '../diff/patch'
import './changes.css'

const LAYOUT_KEY = 'gg.git.treeLayout'

/** How git change trees list files: grouped by directory (IDEA's default) or flat; kept across visits. */
export const useChangeLayout = create<{ layout: 'tree' | 'list'; toggle: () => void }>((set) => ({
  layout: localStorage.getItem(LAYOUT_KEY) === 'list' ? 'list' : 'tree',
  toggle: () =>
    set((s) => {
      const layout = s.layout === 'tree' ? 'list' : 'tree'
      localStorage.setItem(LAYOUT_KEY, layout)
      return { layout }
    }),
}))

/** A row of the tree: a change, an untracked file, or (with `conflict`) an unmerged path. */
export interface TreeChange {
  path: string
  change: GitChange['change']
  oldPath?: string | null
  untracked?: boolean
  add?: number | null
  del?: number | null
  conflict?: GitConflict
}

export interface ChangeGroup {
  key: string
  label: string
  changes: TreeChange[]
  /** Its files have commit checkboxes. */
  checkable?: boolean
}

/** What a context menu or an action is about: one file, a folder's files or a group's. */
export interface ChangeTarget {
  changes: TreeChange[]
  /** The file right-clicked, when it was one. */
  file: TreeChange | null
}

/** IDEA's file status colours and letters. */
export function statusOf(c: TreeChange): { tone: string; letter: string; label: string } {
  if (c.conflict) return { tone: 'conflict', letter: 'C', label: t('冲突') }
  if (c.untracked) return { tone: 'untracked', letter: 'U', label: t('未跟踪') }
  switch (c.change) {
    case 'added':
      return { tone: 'added', letter: 'A', label: t('新增') }
    case 'deleted':
      return { tone: 'deleted', letter: 'D', label: t('删除') }
    case 'renamed':
      return { tone: 'renamed', letter: 'R', label: t('重命名') }
    default:
      return { tone: 'modified', letter: 'M', label: t('修改') }
  }
}

const filesOf = (n: DiffNode<TreeChange>): TreeChange[] =>
  n.kind === 'file' ? [n.file] : n.children.flatMap(filesOf)
const dirOf = (path: string) => (path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '')
const nameOf = (path: string) => path.slice(path.lastIndexOf('/') + 1)

/** Every folder path of the groups' trees, for 全部折叠. */
export function folderPaths(groups: ChangeGroup[]): string[] {
  const out: string[] = []
  const walk = (key: string, nodes: DiffNode<TreeChange>[]) => {
    for (const n of nodes)
      if (n.kind === 'dir') {
        out.push(`${key}:${n.path}`)
        walk(key, n.children)
      }
  }
  for (const g of groups) {
    out.push(`${g.key}:`)
    walk(g.key, diffTree(g.changes))
  }
  return out
}

/**
 * IDEA's change tree: groups (更改 / 未跟踪的文件 / 冲突) of files as `/` folders or a flat list, each file in its status
 * colour with its line counts; checkboxes pick files for a commit; ↑↓ move, Space checks, Enter opens, ←→ fold.
 */
export function ChangeTree({
  groups,
  layout,
  selected,
  onSelect,
  onOpen,
  checked,
  onCheck,
  closed,
  onToggleFolder,
  menu,
  onMenu,
  label,
}: {
  groups: ChangeGroup[]
  layout: 'tree' | 'list'
  selected: string | null
  onSelect: (c: TreeChange) => void
  /** Double click or Enter: the diff in its own tab, a conflict's merge. */
  onOpen?: (c: TreeChange) => void
  /** Checked paths (of checkable groups). */
  checked?: ReadonlySet<string>
  onCheck?: (paths: string[], on: boolean) => void
  /** Folded `group:path` keys ('group:' folds the group). */
  closed: ReadonlySet<string>
  onToggleFolder: (key: string) => void
  menu?: (target: ChangeTarget) => MenuItem[]
  onMenu?: (value: string, target: ChangeTarget) => void
  label: string
}) {
  const [target, setTarget] = useState<ChangeTarget | null>(null)
  const byPath = new Map<string, TreeChange>(
    groups.flatMap((g) => g.changes.map((c) => [`${g.key}:${c.path}`, c] as const)),
  )
  const indent = (depth: number) => ({ '--depth': depth }) as CSSProperties

  /** `name`: what the checkbox picks (a file or folder path, a group's label). */
  const check = (paths: string[], all: boolean, g: ChangeGroup, name: string) =>
    g.checkable && checked && onCheck ? (
      <Checkbox
        checked={all}
        indeterminate={!all && paths.some((p) => checked.has(p))}
        onChange={(on) => onCheck(paths, on)}
        label={<span className="git-sr">{t('选择 {path}', { path: name })}</span>}
      />
    ) : null

  const fileRow = (g: ChangeGroup, c: TreeChange, depth: number, flat: boolean): ReactNode => {
    const s = statusOf(c)
    const dir = flat ? dirOf(c.path) : ''
    return (
      <li
        key={`${g.key}:${c.path}`}
        className="gt-row"
        style={indent(depth)}
        data-gt-file={`${g.key}:${c.path}`}
      >
        {check([c.path], !!checked?.has(c.path), g, c.path)}
        <button
          type="button"
          className={cx('gt-file', `gt-file--${s.tone}`)}
          aria-current={c.path === selected || undefined}
          aria-label={t('{status}：{path}', { status: s.label, path: c.path })}
          title={c.oldPath ? `${c.oldPath} → ${c.path}` : c.path}
          onClick={() => onSelect(c)}
          onDoubleClick={() => onOpen?.(c)}
        >
          <FileIcon name={nameOf(c.path)} size={14} />
          <span className="gt-file__name">{nameOf(c.path)}</span>
          {dir ? <span className="gt-file__dir">{dir}</span> : null}
          {c.oldPath && !flat ? <span className="gt-file__dir">← {nameOf(c.oldPath)}</span> : null}
          <span className="spacer" />
          {c.add || c.del ? (
            <span className="gt-file__stat">
              {c.add ? <span className="gt-file__add">+{c.add}</span> : null}
              {c.del ? <span className="gt-file__del">−{c.del}</span> : null}
            </span>
          ) : null}
          <span className="gt-file__mark" aria-hidden="true">
            {s.letter}
          </span>
        </button>
      </li>
    )
  }

  const rows = (g: ChangeGroup, nodes: DiffNode<TreeChange>[], depth: number): ReactNode[] =>
    nodes.map((n) => {
      if (n.kind === 'file') return fileRow(g, n.file, depth, false)
      const key = `${g.key}:${n.path}`
      const open = !closed.has(key)
      const files = filesOf(n)
      const paths = files.map((f) => f.path)
      return (
        <li key={key} className="gt-dir" data-gt-dir={key}>
          <div className="gt-row" style={indent(depth)} data-gt-dir={key}>
            {check(paths, !!checked && paths.every((p) => checked.has(p)), g, n.path)}
            <button
              type="button"
              className="gt-folder"
              aria-expanded={open}
              onClick={() => onToggleFolder(key)}
            >
              <span className={cx('ui-disclosure', open && 'ui-disclosure--open')}>
                <Icon name="chevron-right" weight={2} size={10} />
              </span>
              <Icon name={open ? 'folder-open' : 'folder'} size={14} />
              <span className="gt-file__name">{n.name}</span>
              <span className="gt-folder__count">{files.length}</span>
            </button>
          </div>
          {open ? <ul className="gt-list">{rows(g, n.children, depth + 1)}</ul> : null}
        </li>
      )
    })

  const targetOf = (el: HTMLElement): ChangeTarget | null => {
    const fileKey = el.closest<HTMLElement>('[data-gt-file]')?.dataset.gtFile
    if (fileKey) {
      const c = byPath.get(fileKey)
      return c ? { changes: [c], file: c } : null
    }
    const dir = el.closest<HTMLElement>('[data-gt-dir]')?.dataset.gtDir
    const groupKey = el.closest<HTMLElement>('[data-gt-group]')?.dataset.gtGroup
    if (dir) {
      const [gk, ...rest] = dir.split(':')
      const prefix = rest.join(':')
      const g = groups.find((x) => x.key === gk)
      return g ? { changes: g.changes.filter((c) => c.path.startsWith(`${prefix}/`)), file: null } : null
    }
    const g = groups.find((x) => x.key === groupKey)
    return g ? { changes: g.changes, file: null } : null
  }

  const keyDown = (e: KeyboardEvent<HTMLElement>) => {
    const all = groups.flatMap((g) => (closed.has(`${g.key}:`) ? [] : g.changes))
    const flatOrder =
      layout === 'list'
        ? all
        : groups.flatMap((g) =>
            closed.has(`${g.key}:`) ? [] : visibleFiles(g.key, diffTree(g.changes), closed),
          )
    const at = flatOrder.findIndex((c) => c.path === selected)
    const cur = flatOrder[at]
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      const next =
        flatOrder[Math.max(0, Math.min(flatOrder.length - 1, at + (e.key === 'ArrowDown' ? 1 : -1)))]
      if (next) {
        e.preventDefault()
        onSelect(next)
        requestAnimationFrame(() =>
          e.currentTarget
            ?.querySelector<HTMLElement>('.gt-file[aria-current="true"]')
            ?.scrollIntoView?.({ block: 'nearest' }),
        )
      }
    } else if (e.key === 'Enter' && cur && (e.target as HTMLElement).tagName !== 'INPUT') {
      e.preventDefault()
      onOpen?.(cur)
    } else if (e.key === ' ' && cur && onCheck && checked && (e.target as HTMLElement).tagName !== 'INPUT') {
      const g = groups.find((x) => x.checkable && x.changes.includes(cur))
      if (!g) return
      e.preventDefault()
      onCheck([cur.path], !checked.has(cur.path))
    }
  }

  const body = (
    <section
      className="gt"
      aria-label={label}
      onKeyDown={keyDown}
      onContextMenuCapture={(e: MouseEvent<HTMLElement>) => {
        // A right-clicked file becomes the selected one, as in IDEA.
        const tg = targetOf(e.target as HTMLElement)
        setTarget(tg)
        if (tg?.file) onSelect(tg.file)
      }}
    >
      {groups.map((g) => {
        if (!g.changes.length) return null
        const open = !closed.has(`${g.key}:`)
        const paths = g.changes.map((c) => c.path)
        return (
          <section key={g.key} className="gt-group" data-gt-group={g.key}>
            <div className="gt-row gt-row--group" data-gt-group={g.key}>
              {check(paths, !!checked && paths.every((p) => checked.has(p)), g, g.label)}
              <button
                type="button"
                className="gt-folder gt-folder--group"
                aria-expanded={open}
                onClick={() => onToggleFolder(`${g.key}:`)}
              >
                <span className={cx('ui-disclosure', open && 'ui-disclosure--open')}>
                  <Icon name="chevron-right" weight={2} size={10} />
                </span>
                <span className="gt-group__label">{g.label}</span>
                <span className="gt-folder__count">{t('{n} 个文件', { n: g.changes.length })}</span>
              </button>
            </div>
            {open ? (
              <ul className="gt-list">
                {layout === 'list'
                  ? g.changes.map((c) => fileRow(g, c, 1, true))
                  : rows(g, diffTree(g.changes), 1)}
              </ul>
            ) : null}
          </section>
        )
      })}
    </section>
  )
  if (!menu) return body
  return (
    <ContextMenu items={target ? menu(target) : []} onSelect={(v) => target && onMenu?.(v, target)}>
      {body}
    </ContextMenu>
  )
}

function visibleFiles(key: string, nodes: DiffNode<TreeChange>[], closed: ReadonlySet<string>): TreeChange[] {
  return nodes.flatMap((n) =>
    n.kind === 'file'
      ? [n.file]
      : closed.has(`${key}:${n.path}`)
        ? []
        : visibleFiles(key, n.children, closed),
  )
}
