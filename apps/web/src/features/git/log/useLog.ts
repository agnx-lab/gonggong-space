import type { GitCommit, GitLogDto } from '@gonggong/protocol'
import { useEffect, useRef, useState } from 'react'
import { api, errorText } from '../../../lib/api'
import { gitUrls, type LogFilter } from '../api'

interface LogState {
  key: string
  commits: GitCommit[]
  hasMore: boolean
  loading: boolean
  error: string | null
}

const same = (a: GitCommit, b: GitCommit | undefined) =>
  !!b && a.hash === b.hash && a.refs.join('\n') === b.refs.join('\n')

/**
 * A repo's log, a page at a time (`more` appends the next). A new query starts over; a new `stamp` (the git status
 * changed) re-reads the first page and keeps what is loaded when that page is unchanged.
 */
export function useLog(
  base: string,
  repo: string | null,
  ref: string | null,
  filter: LogFilter,
  stamp: string,
) {
  const page = (skip: number) => gitUrls.log(base, ref, skip, repo, filter)
  const key = page(0)
  const fresh: LogState = { key, commits: [], hasMore: false, loading: true, error: null }
  const [state, setState] = useState(fresh)
  const shown = state.key === key ? state : fresh

  const load = (skip: number, mode: 'append' | 'refresh') => {
    setState((s) => (s.key !== key ? fresh : mode === 'append' ? { ...s, loading: true, error: null } : s))
    api.get<GitLogDto>(page(skip)).then(
      (r) =>
        setState((s) => {
          if (s.key !== key) return s
          if (mode === 'refresh' && s.commits.length && r.commits.every((c, i) => same(c, s.commits[i])))
            return { ...s, loading: false }
          const kept = mode === 'append' ? s.commits.slice(0, skip) : []
          // A commit made between two pages shifts the history: the next page repeats the last ones listed.
          const listed = new Set(kept.map((c) => c.hash))
          const commits = [...kept, ...r.commits.filter((c) => !listed.has(c.hash))]
          // A page with nothing new would only be asked for again.
          const hasMore = r.hasMore && commits.length > kept.length
          return { key, commits, hasMore, loading: false, error: null }
        }),
      // A failed refresh keeps the list it would have replaced.
      (e: unknown) =>
        setState((s) =>
          s.key !== key || (mode === 'refresh' && s.commits.length)
            ? s
            : { ...s, loading: false, error: errorText(e) },
        ),
    )
  }
  const latest = useRef(load)
  latest.current = load

  // biome-ignore lint/correctness/useExhaustiveDependencies: a new query starts the list over
  useEffect(() => latest.current(0, 'append'), [key])
  const seen = useRef(stamp)
  useEffect(() => {
    if (seen.current === stamp) return
    seen.current = stamp
    latest.current(0, 'refresh')
  }, [stamp])

  return {
    ...shown,
    more: () => {
      if (shown.hasMore && !shown.loading) load(shown.commits.length, 'append')
    },
    /** Reads the first page again. */
    reload: () => load(0, 'refresh'),
    /** Retries the page that failed. */
    retry: () => load(shown.commits.length, 'append'),
  }
}
