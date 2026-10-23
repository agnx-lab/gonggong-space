import type { GitLogTabFilter, WorkbenchTab } from '../../../app/workbench'
import { ago, fullTime } from '../../../lib/time'
import type { LogFilter } from '../api'

export type LogTab = Extract<WorkbenchTab, { kind: 'git-log' }>

/**
 * The tab's filters as the log query takes them: the regexp and case flags only go with a text, the default date
 * order is left out, so a plain log still works with daemons that predate the filters.
 */
export function logQuery(tab: Pick<LogTab, 'filter' | 'path'>): LogFilter {
  const f = tab.filter ?? {}
  const text = f.text?.trim() || undefined
  return {
    all: f.all || undefined,
    author: f.author || undefined,
    text,
    regexp: (text && f.regexp) || undefined,
    matchCase: (text && f.matchCase) || undefined,
    since: f.since || undefined,
    until: f.until || undefined,
    path: tab.path || undefined,
    firstParent: f.firstParent || undefined,
    noMerges: f.noMerges || undefined,
    order: f.order === 'topo' ? 'topo' : undefined,
  }
}

/** A query listing only part of the history: its graph is drawn from the commits listed. */
export const partialLog = (q: LogFilter) =>
  !!(q.author || q.text || q.since || q.until || q.path || q.noMerges || q.firstParent)

/** Whether a filter narrows the log (清除筛选 clears these; the graph options stay). */
export const narrowed = (tab: Pick<LogTab, 'filter' | 'path' | 'ref'>) => {
  const f = tab.filter ?? {}
  return !!(tab.ref || tab.path || f.all || f.author || f.text || f.since || f.until)
}

/** The filter without its unset fields; null when none is left. */
export function cleanFilter(f: GitLogTabFilter): GitLogTabFilter | null {
  const kept = Object.fromEntries(
    Object.entries(f).filter(([, v]) => v !== undefined && v !== false && v !== ''),
  ) as GitLogTabFilter
  return Object.keys(kept).length ? kept : null
}

/** The graph options, which survive 清除筛选. */
export const graphOptions = (f: GitLogTabFilter | null | undefined) =>
  cleanFilter({ firstParent: f?.firstParent, noMerges: f?.noMerges, order: f?.order })

const WEEK_MS = 7 * 86_400_000

/** A commit's date in the table: relative within a week, the day otherwise. */
export const commitDate = (iso: string) =>
  Date.now() - Date.parse(iso) < WEEK_MS ? ago(iso) : fullTime(iso).slice(0, 10)

/** A version as the tabs name it: a full hash shortened, keeping a suffix like `^1`. */
export const revLabel = (rev: string) => rev.replace(/^([0-9a-f]{7})[0-9a-f]{33}(?![0-9a-f])/i, '$1')

/** The last part of a path, for titles. */
export const baseName = (path: string) => path.replace(/\/+$/, '').split('/').pop() || path
