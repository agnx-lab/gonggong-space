import { type ReactNode, type RefObject, useRef } from 'react'
import { t } from '../../i18n'
import { Checkbox, IconButton, SegmentedControl } from '../../ui'
import { SPLIT_MIN_PX } from './DiffParts'
import { type DiffViewMode, useDiffSettings } from './store'
import { useWide } from './useWide'

interface Span {
  top: number
  bottom: number
}

/**
 * The change to move to: the neighbour of `current` while that one is on screen, otherwise the first change from the
 * top of the view down (or the last one above it); -1 past either end.
 */
export function changeTarget(blocks: Span[], view: Span, current: number, dir: 1 | -1) {
  const at = blocks[current]
  if (at && at.bottom >= view.top && at.top <= view.bottom) return blocks[current + dir] ? current + dir : -1
  return dir > 0
    ? blocks.findIndex((b) => b.top >= view.top - 1)
    : blocks.findLastIndex((b) => b.top < view.top - 1)
}

/** Room kept above a change too tall to centre, clear of the sticky toolbar. */
const TOP_GAP = 48

/** The nearest ancestor scrolling vertically; null when it is the page. */
function scroller(el: HTMLElement) {
  for (let p = el.parentElement; p; p = p.parentElement)
    if (p.scrollHeight > p.clientHeight + 1 && /auto|scroll/.test(getComputedStyle(p).overflowY)) return p
  return null
}

/** Centres the next (or previous) change of `root` in its scroll box and flashes it; returns its index. */
function jump(root: HTMLElement, dir: 1 | -1, current: number) {
  const blocks = [...root.querySelectorAll<HTMLElement>('[data-change]')]
  if (!blocks[0]) return current
  const box = scroller(blocks[0])
  const view = box?.getBoundingClientRect() ?? { top: 0, bottom: window.innerHeight }
  const i = changeTarget(
    blocks.map((b) => b.getBoundingClientRect()),
    view,
    current,
    dir,
  )
  const target = blocks[i]
  if (!target) return current
  const r = target.getBoundingClientRect()
  const page = box ?? document.scrollingElement
  if (page) page.scrollTop += r.top - view.top - Math.max(TOP_GAP, (view.bottom - view.top - r.height) / 2)
  for (const b of blocks) b.removeAttribute('data-flash')
  target.setAttribute('data-flash', '')
  target.addEventListener('animationend', () => target.removeAttribute('data-flash'), { once: true })
  return i
}

/**
 * IDEA-style controls over a diff: unified or side by side, whitespace, whole file, and stepping through the changes
 * inside `target`; the caller's `actions` sit at the right end.
 */
export function DiffToolbar({
  target,
  actions,
}: {
  target: RefObject<HTMLElement | null>
  actions?: ReactNode
}) {
  const { view, ignoreWhitespace, fullContext, set } = useDiffSettings()
  const root = useRef<HTMLDivElement>(null)
  const roomy = useWide(root, SPLIT_MIN_PX)
  const current = useRef(-1)
  const go = (dir: 1 | -1) => {
    if (target.current) current.current = jump(target.current, dir, current.current)
  }
  const views: { value: DiffViewMode; label: string; disabled?: boolean }[] = [
    { value: 'unified', label: t('统一') },
    { value: 'split', label: t('并排'), disabled: !roomy },
  ]
  return (
    <div ref={root} className="diff-toolbar">
      <SegmentedControl
        size="small"
        aria-label={t('差异视图')}
        items={views}
        value={roomy ? view : 'unified'}
        onChange={(v) => set({ view: v })}
      />
      <Checkbox
        label={t('忽略空白')}
        checked={ignoreWhitespace}
        onChange={(on) => set({ ignoreWhitespace: on })}
      />
      <Checkbox label={t('显示完整文件')} checked={fullContext} onChange={(on) => set({ fullContext: on })} />
      <span className="diff-toolbar__end">
        <IconButton size="small" title={t('上一处改动')} onClick={() => go(-1)}>
          {'arrow-up' as const}
        </IconButton>
        <IconButton size="small" title={t('下一处改动')} onClick={() => go(1)}>
          {'arrow-down' as const}
        </IconButton>
        {actions}
      </span>
    </div>
  )
}
