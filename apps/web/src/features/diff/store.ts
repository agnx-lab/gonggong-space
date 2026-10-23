import { create } from 'zustand'

/** Whose changes: a bot's workspace in a group; `runId` adds the 本轮 scope for that turn. */
export interface DiffSource {
  groupId: string
  botId: string
  runId: string | null
}

export type DiffLayout = 'list' | 'tree'

const LAYOUT_KEY = 'gonggong.diffLayout'

/** How changed files are listed (flat or as a folder tree), shared by the run and diff tabs and kept across visits. */
export const useDiffLayout = create<{ layout: DiffLayout; toggle: () => void }>((set) => ({
  layout: localStorage.getItem(LAYOUT_KEY) === 'tree' ? 'tree' : 'list',
  toggle: () =>
    set((s) => {
      const layout = s.layout === 'tree' ? 'list' : 'tree'
      localStorage.setItem(LAYOUT_KEY, layout)
      return { layout }
    }),
}))

export type DiffViewMode = 'unified' | 'split'

export interface DiffSettings {
  view: DiffViewMode
  /** Git diffs are read with whitespace changes left out. */
  ignoreWhitespace: boolean
  /** Git diffs are read with the whole file as context. */
  fullContext: boolean
}

const VIEW_KEY = 'gonggong.diffView'
const WHITESPACE_KEY = 'gonggong.diffIgnoreWhitespace'
const FULL_KEY = 'gonggong.diffFullContext'

/** How diffs are shown and read, shared by every diff and kept across visits. */
export const useDiffSettings = create<DiffSettings & { set: (patch: Partial<DiffSettings>) => void }>(
  (setState) => ({
    view: localStorage.getItem(VIEW_KEY) === 'split' ? 'split' : 'unified',
    ignoreWhitespace: localStorage.getItem(WHITESPACE_KEY) === '1',
    fullContext: localStorage.getItem(FULL_KEY) === '1',
    set: (patch) =>
      setState((s) => {
        const next = { ...s, ...patch }
        localStorage.setItem(VIEW_KEY, next.view)
        localStorage.setItem(WHITESPACE_KEY, next.ignoreWhitespace ? '1' : '0')
        localStorage.setItem(FULL_KEY, next.fullContext ? '1' : '0')
        return patch
      }),
  }),
)
